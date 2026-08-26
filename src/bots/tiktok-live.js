import { WebcastPushConnection } from 'tiktok-live-connector';
import config from '../../config/default.js';
import SpoilerDetector from '../detection/spoiler-detector.js';
import AIDetector from '../detection/ai-detector.js';
import logger from '../utils/logger.js';
import notifier from '../utils/notifier.js';

/**
 * Bot de moderación anti-spoilers para TikTok Live Chat.
 * 
 * Limitaciones de TikTok:
 * - NO se pueden eliminar mensajes vía API (solo lectura)
 * - NO se puede banear usuarios vía API
 * 
 * Lo que SÍ puede hacer:
 * - Leer el chat en tiempo real vía WebSocket
 * - Detectar spoilers
 * - Alertar al streamer con notificación de escritorio + sonido
 * - Registrar usuarios problemáticos
 * - Generar lista de palabras para importar en filtros nativos de TikTok
 */
class TikTokLiveBot {
  constructor() {
    this.connection = null;
    this.detector = new SpoilerDetector();
    this.aiDetector = new AIDetector();
    this.isRunning = false;
    this.stats = {
      messagesProcessed: 0,
      spoilersDetected: 0,
      startTime: null,
    };
    // Registro de usuarios que hacen spoilers
    this.flaggedUsers = new Map();
    // Historial de spoilers para reporte
    this.spoilerLog = [];
  }

  /**
   * Conecta al live de TikTok
   */
  async connect() {
    const username = config.tiktok.username;

    if (!username) {
      throw new Error('TIKTOK_USERNAME no configurado');
    }

    logger.platform('tiktok', `Conectando al live de @${username}...`);

    this.connection = new WebcastPushConnection(username, {
      processInitialData: false,
      enableExtendedGiftInfo: false,
      enableWebsocketUpgrade: true,
      requestPollingIntervalMs: 2000,
      sessionId: null,
    });

    return this.connection;
  }

  /**
   * Inicia el monitoreo del chat
   */
  async start() {
    try {
      await this.connect();

      const state = await this.connection.connect();
      this.isRunning = true;
      this.stats.startTime = new Date();

      logger.platform('tiktok', `🔴 Conectado al live de @${config.tiktok.username}`);
      logger.platform('tiktok', `👥 Viewers: ${state.roomInfo?.user_count || 'N/A'}`);
      logger.platform('tiktok', `📺 Título: ${state.roomInfo?.title || 'N/A'}`);
      logger.platform('tiktok', '🤖 Bot Anti-Spoilers ACTIVO - Monitoreando chat...');
      notifier.botStarted('TikTok');

      // Registrar event listeners
      this.registerEventListeners();
    } catch (error) {
      if (error.message?.includes('LIVE has ended')) {
        logger.error(`El live de @${config.tiktok.username} no está activo.`);
        logger.platform('tiktok', '💡 Asegúrate de que el usuario esté en vivo.');
      } else if (error.message?.includes('not found')) {
        logger.error(`Usuario @${config.tiktok.username} no encontrado.`);
      } else {
        logger.error(`Error conectando a TikTok: ${error.message}`);
      }
      notifier.error(`TikTok: ${error.message}`);
      throw error;
    }
  }

  /**
   * Registra los event listeners para el chat
   */
  registerEventListeners() {
    // Mensajes del chat
    this.connection.on('chat', (data) => {
      this.processMessage(data);
    });

    // Comentarios (algunos lives usan esto en vez de chat)
    this.connection.on('comment', (data) => {
      this.processMessage(data);
    });

    // Desconexión
    this.connection.on('disconnected', () => {
      logger.platform('tiktok', '⚠️ Desconectado del live');
      if (this.isRunning) {
        logger.platform('tiktok', '🔄 Intentando reconectar en 5 segundos...');
        setTimeout(() => this.reconnect(), 5000);
      }
    });

    // Errores
    this.connection.on('error', (err) => {
      logger.error(`TikTok WebSocket error: ${err.message}`);
    });

    // Stream terminado
    this.connection.on('streamEnd', (actionId) => {
      logger.platform('tiktok', `📴 El stream ha terminado (action: ${actionId})`);
      this.stop();
    });

    // Info de viewers (opcional, para estadísticas)
    this.connection.on('roomUser', (data) => {
      logger.debug(`TikTok viewers: ${data.viewerCount}`);
    });
  }

  /**
   * Procesa un mensaje del chat
   * @param {object} data - Datos del mensaje de TikTok
   */
  async processMessage(data) {
    const text = data.comment || data.message || '';
    const username = data.nickname || data.uniqueId || 'Unknown';
    const userId = data.userId || data.uniqueId || '';

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
      this.handleSpoiler(result, username, userId);
    } else {
      logger.safe(text, username);
    }
  }

  /**
   * Maneja un spoiler detectado
   * NOTA: En TikTok NO podemos eliminar mensajes, solo alertar
   * @param {object} result - Resultado de detección
   * @param {string} username - Nombre del usuario
   * @param {string} userId - ID del usuario
   */
  handleSpoiler(result, username, userId) {
    this.stats.spoilersDetected++;
    logger.spoiler(result);

    // Notificación de escritorio al streamer
    notifier.spoilerDetected(result, 'tiktok');

    // Registrar usuario flaggeado
    const strikes = (this.flaggedUsers.get(username) || 0) + 1;
    this.flaggedUsers.set(username, strikes);

    // Guardar en log de spoilers
    this.spoilerLog.push({
      timestamp: new Date().toISOString(),
      username,
      userId,
      message: result.originalMessage,
      score: result.score,
      matchType: result.matchType,
      game: result.matchedGame,
      strikes,
    });

    // Alertas especiales para reincidentes
    if (strikes >= 3) {
      logger.platform('tiktok', `🚨 REINCIDENTE: @${username} tiene ${strikes} strikes - Considera banearlo manualmente`);
      notifier.spoilerDetected({
        ...result,
        username: `⚠️ REINCIDENTE (${strikes}x): ${username}`,
      }, 'tiktok');
    }
  }

  /**
   * Intenta reconectar al live
   */
  async reconnect() {
    if (!this.isRunning) return;

    try {
      logger.platform('tiktok', '🔄 Reconectando...');
      await this.connection.connect();
      logger.platform('tiktok', '✅ Reconectado exitosamente');
    } catch (error) {
      if (error.message?.includes('LIVE has ended')) {
        logger.platform('tiktok', '📴 El live ha terminado.');
        this.stop();
      } else {
        logger.error(`Error reconectando: ${error.message}`);
        // Reintentar en 15 segundos
        setTimeout(() => this.reconnect(), 15000);
      }
    }
  }

  /**
   * Detiene el bot
   */
  stop() {
    this.isRunning = false;

    if (this.connection) {
      this.connection.disconnect();
    }

    const uptime = this.stats.startTime
      ? Math.round((Date.now() - this.stats.startTime.getTime()) / 1000 / 60)
      : 0;

    logger.platform('tiktok', '⏹️ Bot detenido');
    logger.platform('tiktok', `📊 Resumen: ${this.stats.messagesProcessed} mensajes | ${this.stats.spoilersDetected} spoilers detectados | ${uptime} min activo`);

    // Mostrar reporte de usuarios problemáticos
    if (this.flaggedUsers.size > 0) {
      logger.platform('tiktok', '👤 Usuarios flaggeados:');
      const sorted = [...this.flaggedUsers.entries()].sort((a, b) => b[1] - a[1]);
      sorted.forEach(([user, strikes]) => {
        logger.platform('tiktok', `   @${user}: ${strikes} strike(s)`);
      });
    }
  }

  /**
   * Recarga la base de datos de spoilers sin reiniciar
   */
  reloadDatabase() {
    this.detector.reload();
    logger.platform('tiktok', '🔄 Base de datos recargada');
  }

  /**
   * Genera un reporte de la sesión
   * @returns {object}
   */
  getReport() {
    return {
      stats: this.stats,
      flaggedUsers: Object.fromEntries(this.flaggedUsers),
      spoilerLog: this.spoilerLog,
      uptime: this.stats.startTime
        ? Math.round((Date.now() - this.stats.startTime.getTime()) / 1000)
        : 0,
    };
  }

  /**
   * Exporta lista de palabras bloqueadas para importar en filtros nativos de TikTok
   * @returns {string[]} Lista de palabras/frases para bloquear
   */
  exportBlockList() {
    const words = new Set();

    for (const game of this.detector.activeGames) {
      game.keywords.forEach((k) => words.add(k));
      game.partialMatch.forEach((p) => words.add(p));
    }

    const globalPatterns = this.detector.database.globalPatterns;
    (globalPatterns.spoilerIndicators || []).forEach((p) => words.add(p));
    (globalPatterns.deathPatterns || []).forEach((p) => words.add(p));
    (globalPatterns.endingPatterns || []).forEach((p) => words.add(p));

    const list = [...words].sort();
    logger.platform('tiktok', `📋 Lista exportada: ${list.length} palabras/frases para filtros nativos`);
    return list;
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
      flaggedUsers: Object.fromEntries(this.flaggedUsers),
      detectorStats: this.detector.getStats(),
    };
  }
}

export default TikTokLiveBot;

// Ejecución standalone
if (process.argv[1] && process.argv[1].includes('tiktok-live')) {
  import('../../config/default.js').then(({ validateConfig }) => {
    validateConfig('tiktok');
    const bot = new TikTokLiveBot();
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
