import tmi from 'tmi.js';
import config from '../../config/default.js';
import SpoilerDetector from '../detection/spoiler-detector.js';
import AIDetector from '../detection/ai-detector.js';
import logger from '../utils/logger.js';
import notifier from '../utils/notifier.js';

/**
 * Bot de moderación anti-spoilers para Twitch Live Chat.
 *
 * Funcionalidades:
 * - Lee el chat en tiempo real vía IRC/WebSocket
 * - Detecta spoilers con el motor de reglas + IA opcional
 * - Elimina mensajes automáticamente (requiere ser moderador)
 * - Puede aplicar timeout a usuarios reincidentes
 * - Envía mensajes de advertencia
 */
class TwitchLiveBot {
  constructor() {
    this.client = null;
    this.detector = new SpoilerDetector();
    this.aiDetector = new AIDetector();
    this.isRunning = false;
    this.stats = {
      messagesProcessed: 0,
      spoilersDetected: 0,
      messagesDeleted: 0,
      startTime: null,
    };
    this.userStrikes = new Map();
  }

  /**
   * Crea el cliente de tmi.js con la configuración
   */
  createClient() {
    const opts = {
      identity: {
        username: config.twitch.botUsername,
        password: config.twitch.oauthToken,
      },
      channels: [config.twitch.channel],
      connection: {
        reconnect: true,
        secure: true,
      },
    };

    this.client = new tmi.Client(opts);
  }

  /**
   * Inicia el bot y conecta al chat de Twitch
   */
  async start() {
    logger.platform('twitch', 'Conectando al chat de Twitch...');

    this.createClient();

    // Registrar event listeners antes de conectar
    this.registerEventListeners();

    try {
      await this.client.connect();
      this.isRunning = true;
      this.stats.startTime = new Date();

      logger.platform('twitch', `🟣 Conectado al canal #${config.twitch.channel}`);
      logger.platform('twitch', '🤖 Bot Anti-Spoilers ACTIVO - Monitoreando chat...');
      notifier.botStarted('Twitch');
    } catch (error) {
      logger.error(`Error conectando a Twitch: ${error.message}`);
      notifier.error(`Twitch: ${error.message}`);
      throw error;
    }
  }

  /**
   * Registra los event listeners del chat
   */
  registerEventListeners() {
    // Mensaje recibido
    this.client.on('message', (channel, tags, message, self) => {
      // Ignorar mensajes del propio bot
      if (self) return;
      this.processMessage(channel, tags, message);
    });

    // Conexión exitosa
    this.client.on('connected', (addr, port) => {
      logger.platform('twitch', `✅ Conectado a ${addr}:${port}`);
    });

    // Desconexión
    this.client.on('disconnected', (reason) => {
      logger.platform('twitch', `⚠️ Desconectado: ${reason}`);
      if (this.isRunning) {
        logger.platform('twitch', '🔄 Reconexión automática habilitada...');
      }
    });

    // Reconexión
    this.client.on('reconnect', () => {
      logger.platform('twitch', '🔄 Reconectando...');
    });
  }

  /**
   * Procesa un mensaje del chat
   * @param {string} channel - Canal donde se envió el mensaje
   * @param {object} tags - Metadatos del mensaje (usuario, badges, etc.)
   * @param {string} message - Texto del mensaje
   */
  async processMessage(channel, tags, message) {
    const username = tags['display-name'] || tags.username || 'Unknown';
    const isModerator = tags.mod || false;
    const isBroadcaster = tags.badges?.broadcaster === '1';
    const isVIP = tags.badges?.vip === '1';
    const messageId = tags.id || '';

    // No moderar a moderadores, broadcaster ni VIPs
    if (isModerator || isBroadcaster || isVIP) return;

    // Ignorar mensajes muy cortos
    if (message.length < 5) return;

    // Ignorar comandos (empiezan con !)
    if (message.startsWith('!')) return;

    this.stats.messagesProcessed++;

    // Detectar spoiler
    const result = this.detector.analyze(message, username);

    // Si la detección por reglas no es concluyente, intentar con IA
    if (!result.isSpoiler && result.score > 0.2 && config.detection.useAI) {
      const gameNames = this.detector.activeGames.map((g) => g.name);
      const aiResult = await this.aiDetector.analyze(message, gameNames);

      if (aiResult.isSpoiler && aiResult.confidence >= 0.7) {
        result.isSpoiler = true;
        result.score = aiResult.confidence;
        result.matchType = 'ai_detection';
        result.matchedTerms = [aiResult.reason];
      }
    }

    if (result.isSpoiler) {
      await this.handleSpoiler(channel, result, messageId, username, tags);
    } else {
      logger.safe(message, username);
    }
  }

  /**
   * Maneja un spoiler detectado
   * @param {string} channel - Canal
   * @param {object} result - Resultado de detección
   * @param {string} messageId - ID del mensaje
   * @param {string} username - Nombre del usuario
   * @param {object} tags - Tags del mensaje
   */
  async handleSpoiler(channel, result, messageId, username, tags) {
    this.stats.spoilersDetected++;
    logger.spoiler(result);
    notifier.spoilerDetected(result, 'twitch');

    // Registrar strike
    const strikes = (this.userStrikes.get(username) || 0) + 1;
    this.userStrikes.set(username, strikes);

    const action = config.twitch.spoilerAction;

    try {
      // Eliminar mensaje
      if (action === 'delete') {
        await this.deleteMessage(channel, messageId);
        this.stats.messagesDeleted++;
        logger.platform('twitch', `🗑️ Mensaje eliminado de ${username} (strike ${strikes})`);
      }

      // Enviar advertencia
      if (config.bot.sendWarningMessage && strikes <= 2) {
        await this.client.say(
          channel,
          `⚠️ @${username} ${config.bot.warningMessage}`
        );
      }

      // Timeout si reincide
      if (strikes >= 3 && config.twitch.timeoutSeconds > 0) {
        await this.timeoutUser(channel, username, config.twitch.timeoutSeconds);
        logger.platform('twitch', `⏰ Timeout de ${config.twitch.timeoutSeconds}s aplicado a ${username} (${strikes} strikes)`);
      }
    } catch (error) {
      logger.error(`Error manejando spoiler en Twitch: ${error.message}`);
    }
  }

  /**
   * Elimina un mensaje del chat
   * @param {string} channel - Canal
   * @param {string} messageId - ID del mensaje a eliminar
   */
  async deleteMessage(channel, messageId) {
    try {
      await this.client.deletemessage(channel, messageId);
    } catch (error) {
      logger.error(`Error eliminando mensaje en Twitch: ${error.message}`);
    }
  }

  /**
   * Aplica timeout a un usuario
   * @param {string} channel - Canal
   * @param {string} username - Usuario
   * @param {number} duration - Duración en segundos
   */
  async timeoutUser(channel, username, duration) {
    try {
      await this.client.timeout(
        channel,
        username,
        duration,
        'Spoiler detectado - Bot Anti-Spoilers'
      );
    } catch (error) {
      logger.error(`Error aplicando timeout en Twitch: ${error.message}`);
    }
  }

  /**
   * Detiene el bot
   */
  stop() {
    this.isRunning = false;

    if (this.client) {
      this.client.disconnect();
    }

    const uptime = this.stats.startTime
      ? Math.round((Date.now() - this.stats.startTime.getTime()) / 1000 / 60)
      : 0;

    logger.platform('twitch', '⏹️ Bot detenido');
    logger.platform('twitch', `📊 Resumen: ${this.stats.messagesProcessed} mensajes | ${this.stats.spoilersDetected} spoilers | ${this.stats.messagesDeleted} eliminados | ${uptime} min activo`);
  }

  /**
   * Recarga la base de datos de spoilers sin reiniciar
   */
  reloadDatabase() {
    this.detector.reload();
    logger.platform('twitch', '🔄 Base de datos recargada');
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

export default TwitchLiveBot;

// Ejecución standalone
if (process.argv[1] && process.argv[1].includes('twitch-live')) {
  import('../../config/default.js').then(({ validateConfig }) => {
    validateConfig('twitch');
    const bot = new TwitchLiveBot();
    bot.start().catch((err) => {
      console.error('Fatal:', err.message);
      process.exit(1);
    });

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
