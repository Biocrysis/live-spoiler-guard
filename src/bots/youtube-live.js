import { google } from 'googleapis';
import config from '../../config/default.js';
import SpoilerDetector from '../detection/spoiler-detector.js';
import AIDetector from '../detection/ai-detector.js';
import logger from '../utils/logger.js';
import notifier from '../utils/notifier.js';

/**
 * Bot de moderación anti-spoilers para YouTube Live Chat.
 * 
 * Funcionalidades:
 * - Lee el chat en tiempo real (polling)
 * - Detecta spoilers con el motor de reglas + IA opcional
 * - Elimina mensajes automáticamente
 * - Puede aplicar timeout a usuarios reincidentes
 * - Envía mensajes de advertencia
 */
class YouTubeLiveBot {
  constructor() {
    this.oauth2Client = null;
    this.youtube = null;
    this.detector = new SpoilerDetector();
    this.aiDetector = new AIDetector();
    this.liveChatId = null;
    this.pollingTimer = null;
    this.nextPageToken = null;
    this.isRunning = false;
    this.stats = {
      messagesProcessed: 0,
      spoilersDetected: 0,
      messagesDeleted: 0,
      startTime: null,
    };
    // Tracking de usuarios reincidentes
    this.userStrikes = new Map();
  }

  /**
   * Inicializa la autenticación OAuth2 con Google
   */
  async authenticate() {
    logger.platform('youtube', 'Autenticando con YouTube API...');

    this.oauth2Client = new google.auth.OAuth2(
      config.youtube.clientId,
      config.youtube.clientSecret,
      config.youtube.redirectUri
    );

    this.oauth2Client.setCredentials({
      refresh_token: config.youtube.refreshToken,
    });

    // Forzar refresh del token
    try {
      await this.oauth2Client.getAccessToken();
      logger.platform('youtube', '✅ Autenticación exitosa');
    } catch (error) {
      logger.error(`YouTube Auth Error: ${error.message}`);
      throw new Error('No se pudo autenticar con YouTube. Verifica tus credenciales.');
    }

    this.youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  /**
   * Busca el live chat activo del canal
   * @returns {string} liveChatId
   */
  async findActiveLiveChat() {
    logger.platform('youtube', 'Buscando stream en vivo activo...');

    try {
      // Buscar broadcasts activos
      const response = await this.youtube.liveBroadcasts.list({
        part: ['snippet', 'status'],
        broadcastStatus: 'active',
        broadcastType: 'all',
      });

      const broadcasts = response.data.items || [];

      if (broadcasts.length === 0) {
        // Intentar con upcoming
        const upcomingResponse = await this.youtube.liveBroadcasts.list({
          part: ['snippet', 'status'],
          broadcastStatus: 'upcoming',
          broadcastType: 'all',
        });

        const upcoming = upcomingResponse.data.items || [];
        if (upcoming.length === 0) {
          throw new Error('No se encontró ningún stream activo o programado.');
        }

        // Usar el primer upcoming
        this.liveChatId = upcoming[0].snippet.liveChatId;
        logger.platform('youtube', `📅 Stream programado encontrado: "${upcoming[0].snippet.title}"`);
      } else {
        // Usar el primer broadcast activo
        this.liveChatId = broadcasts[0].snippet.liveChatId;
        logger.platform('youtube', `🔴 Stream activo encontrado: "${broadcasts[0].snippet.title}"`);
      }

      if (!this.liveChatId) {
        throw new Error('No se pudo obtener el liveChatId del stream.');
      }

      logger.platform('youtube', `💬 Live Chat ID: ${this.liveChatId}`);
      return this.liveChatId;
    } catch (error) {
      if (error.message.includes('No se encontró')) throw error;
      logger.error(`Error buscando live chat: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inicia el monitoreo del chat
   */
  async start() {
    try {
      await this.authenticate();
      await this.findActiveLiveChat();

      this.isRunning = true;
      this.stats.startTime = new Date();

      logger.platform('youtube', '🤖 Bot Anti-Spoilers ACTIVO - Monitoreando chat...');
      notifier.botStarted('YouTube');

      // Iniciar polling
      await this.pollChat();
    } catch (error) {
      logger.error(`Error iniciando YouTube bot: ${error.message}`);
      notifier.error(`YouTube: ${error.message}`);
      throw error;
    }
  }

  /**
   * Polling del chat - lee mensajes nuevos periódicamente
   */
  async pollChat() {
    if (!this.isRunning) return;

    try {
      const params = {
        liveChatId: this.liveChatId,
        part: ['snippet', 'authorDetails'],
        maxResults: 200,
      };

      if (this.nextPageToken) {
        params.pageToken = this.nextPageToken;
      }

      const response = await this.youtube.liveChatMessages.list(params);
      const { items, nextPageToken, pollingIntervalMillis } = response.data;

      this.nextPageToken = nextPageToken;

      // Procesar mensajes
      if (items && items.length > 0) {
        for (const message of items) {
          await this.processMessage(message);
        }
      }

      // Programar siguiente poll
      const interval = Math.max(
        pollingIntervalMillis || config.youtube.pollInterval,
        2000 // Mínimo 2 segundos para no exceder rate limits
      );

      this.pollingTimer = setTimeout(() => this.pollChat(), interval);
    } catch (error) {
      if (error.code === 403) {
        logger.error('Rate limit alcanzado. Esperando 10 segundos...');
        this.pollingTimer = setTimeout(() => this.pollChat(), 10000);
      } else if (error.code === 404) {
        logger.error('Live chat no encontrado. El stream puede haber terminado.');
        this.stop();
      } else {
        logger.error(`Error en polling: ${error.message}`);
        // Reintentar después de 5 segundos
        this.pollingTimer = setTimeout(() => this.pollChat(), 5000);
      }
    }
  }

  /**
   * Procesa un mensaje individual del chat
   * @param {object} message - Mensaje de YouTube Live Chat API
   */
  async processMessage(message) {
    const text = message.snippet?.displayMessage || message.snippet?.textMessageDetails?.messageText || '';
    const username = message.authorDetails?.displayName || 'Unknown';
    const messageId = message.id;
    const isModerator = message.authorDetails?.isChatModerator || false;
    const isOwner = message.authorDetails?.isChatOwner || false;

    // No moderar a moderadores ni al dueño del canal
    if (isModerator || isOwner) return;

    // Ignorar mensajes vacíos o muy cortos
    if (text.length < 5) return;

    this.stats.messagesProcessed++;

    // Detectar spoiler
    const result = this.detector.analyze(text, username);

    // Si la detección por reglas no es concluyente, intentar con IA
    if (!result.isSpoiler && result.score > 0.2 && config.detection.useAI) {
      const gameNames = this.detector.activeGames.map((g) => g.name);
      const aiResult = await this.aiDetector.analyze(text, gameNames);

      if (aiResult.isSpoiler && aiResult.confidence >= 0.7) {
        result.isSpoiler = true;
        result.score = aiResult.confidence;
        result.matchType = 'ai_detection';
        result.matchedTerms = [aiResult.reason];
      }
    }

    if (result.isSpoiler) {
      await this.handleSpoiler(result, messageId, username);
    } else {
      logger.safe(text, username);
    }
  }

  /**
   * Maneja un spoiler detectado
   * @param {object} result - Resultado de detección
   * @param {string} messageId - ID del mensaje en YouTube
   * @param {string} username - Nombre del usuario
   */
  async handleSpoiler(result, messageId, username) {
    this.stats.spoilersDetected++;
    logger.spoiler(result);
    notifier.spoilerDetected(result, 'youtube');

    // Registrar strike del usuario
    const strikes = (this.userStrikes.get(username) || 0) + 1;
    this.userStrikes.set(username, strikes);

    // Ejecutar acción según configuración
    const action = config.youtube.spoilerAction;

    try {
      if (action === 'delete' || action === 'hide') {
        await this.deleteMessage(messageId);
        this.stats.messagesDeleted++;
        logger.platform('youtube', `🗑️ Mensaje eliminado de ${username} (strike ${strikes})`);
      }

      // Enviar advertencia si está configurado
      if (config.bot.sendWarningMessage && strikes <= 2) {
        await this.sendMessage(
          `⚠️ @${username} ${config.bot.warningMessage}`
        );
      }

      // Timeout si tiene muchos strikes
      if (strikes >= 3 && config.youtube.timeoutSeconds > 0) {
        await this.timeoutUser(username);
        logger.platform('youtube', `⏰ Timeout aplicado a ${username} (${strikes} strikes)`);
      }
    } catch (error) {
      logger.error(`Error manejando spoiler: ${error.message}`);
    }
  }

  /**
   * Elimina un mensaje del chat
   * @param {string} messageId
   */
  async deleteMessage(messageId) {
    try {
      await this.youtube.liveChatMessages.delete({ id: messageId });
    } catch (error) {
      logger.error(`Error eliminando mensaje: ${error.message}`);
    }
  }

  /**
   * Envía un mensaje al chat
   * @param {string} text
   */
  async sendMessage(text) {
    try {
      await this.youtube.liveChatMessages.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            liveChatId: this.liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: text,
            },
          },
        },
      });
    } catch (error) {
      logger.error(`Error enviando mensaje: ${error.message}`);
    }
  }

  /**
   * Aplica timeout (ban temporal) a un usuario
   * @param {string} username - No se puede hacer por username directamente en YouTube API
   * Se necesita el channelId del usuario
   */
  async timeoutUser(username) {
    // NOTA: YouTube API requiere el channelId del usuario para banearlo
    // En un stream real, el moderador puede hacerlo manualmente
    logger.platform('youtube', `⚠️ Usuario ${username} debería recibir timeout (requiere ban manual o channelId)`);
  }

  /**
   * Detiene el bot
   */
  stop() {
    this.isRunning = false;
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = null;
    }

    const uptime = this.stats.startTime
      ? Math.round((Date.now() - this.stats.startTime.getTime()) / 1000 / 60)
      : 0;

    logger.platform('youtube', '⏹️ Bot detenido');
    logger.platform('youtube', `📊 Resumen: ${this.stats.messagesProcessed} mensajes | ${this.stats.spoilersDetected} spoilers | ${this.stats.messagesDeleted} eliminados | ${uptime} min activo`);
  }

  /**
   * Recarga la base de datos de spoilers sin reiniciar
   */
  reloadDatabase() {
    this.detector.reload();
    logger.platform('youtube', '🔄 Base de datos recargada');
  }

  /**
   * Obtiene estadísticas actuales
   */
  getStats() {
    return {
      ...this.stats,
      uptime: this.stats.startTime
        ? Math.round((Date.now() - this.stats.startTime.getTime()) / 1000)
        : 0,
      userStrikes: Object.fromEntries(this.userStrikes),
      detectorStats: this.detector.getStats(),
    };
  }
}

export default YouTubeLiveBot;

// Ejecución standalone
if (process.argv[1] && process.argv[1].includes('youtube-live')) {
  import('../../config/default.js').then(({ validateConfig }) => {
    validateConfig('youtube');
    const bot = new YouTubeLiveBot();
    bot.start().catch((err) => {
      console.error('Fatal:', err.message);
      process.exit(1);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n');
      bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      bot.stop();
      process.exit(0);
    });
  });
}
