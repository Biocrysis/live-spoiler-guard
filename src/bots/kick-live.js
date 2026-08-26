import { KickConnection, Events } from 'kick-live-connector';
import config from '../../config/default.js';
import SpoilerDetector from '../detection/spoiler-detector.js';
import AIDetector from '../detection/ai-detector.js';
import logger from '../utils/logger.js';
import notifier from '../utils/notifier.js';

/**
 * Bot de moderación anti-spoilers para Kick Live Chat.
 *
 * Limitaciones de Kick (vía kick-live-connector):
 * - NO se pueden eliminar mensajes (librería de solo lectura)
 * - NO se puede banear usuarios
 *
 * Lo que SÍ puede hacer:
 * - Leer el chat en tiempo real vía WebSocket
 * - Detectar spoilers
 * - Alertar al streamer con notificación de escritorio + sonido
 * - Registrar usuarios problemáticos
 * - Generar lista de palabras para filtros nativos de Kick
 */
class KickLiveBot {
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
    this.flaggedUsers = new Map();
    this.spoilerLog = [];
  }

  /**
   * Conecta al live de Kick
   */
  async connect() {
    const username = config.kick.username;

    if (!username) {
      throw new Error('KICK_USERNAME no configurado');
    }

    logger.platform('kick', `Conectando al live de @${username}...`);

    this.connection = new KickConnection(username);
    return this.connection;
  }

  /**
   * Inicia el monitoreo del chat
   */
  async start() {
    try {
      await this.connect();

      const status = await this.connection.connect();
      this.isRunning = true;
      this.stats.startTime = new Date();

      logger.platform('kick', `🟢 Conectado al chatroom ${status.roomID} de @${config.kick.username}`);
      logger.platform('kick', '🤖 Bot Anti-Spoilers ACTIVO - Monitoreando chat...');
      notifier.botStarted('Kick');

      this.registerEventListeners();
    } catch (error) {
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        logger.error(`Usuario @${config.kick.username} no encontrado en Kick.`);
      } else if (error.message?.includes('offline') || error.message?.includes('not live')) {
        logger.error(`El live de @${config.kick.username} no está activo.`);
        logger.platform('kick', '💡 Asegúrate de que el usuario esté en vivo.');
      } else {
        logger.error(`Error conectando a Kick: ${error.message}`);
      }
      notifier.error(`Kick: ${error.message}`);
      throw error;
    }
  }

  /**
   * Registra los event listeners del chat
   */
  registerEventListeners() {
    // Mensajes del chat
    this.connection.on(Events.ChatMessage, (data) => {
      this.processMessage(data);
    });

    // Desconexión
    this.connection.on(Events.Disconnected, () => {
      logger.platform('kick', '⚠️ Desconectado del live');
      if (this.isRunning) {
        logger.platform('kick', '🔄 Intentando reconectar en 5 segundos...');
        setTimeout(() => this.reconnect(), 5000);
      }
    });

    // Errores
    this.connection.on(Events.Error, (err) => {
      logger.error(`Kick WebSocket error: ${err.message || err}`);
    });

    // Stream terminado
    this.connection.on(Events.StreamEnd, (data) => {
      logger.platform('kick', `📴 El stream ha terminado`);
      this.stop();
    });

    // Viewer count
    this.connection.on(Events.ViewerCount, (data) => {
      logger.debug(`Kick viewers: ${data.viewers}`);
    });
  }

  /**
   * Procesa un mensaje del chat
   * @param {object} data - Datos del mensaje de Kick
   */
  async processMessage(data) {
    const text = data.content || '';
    const username = data.sender?.username || 'Unknown';
    const badges = data.sender?.identity?.badges || [];

    // Ignorar mensajes del broadcaster o moderadores
    const isBroadcaster = badges.some((b) => b.type === 'broadcaster');
    const isModerator = badges.some((b) => b.type === 'moderator');
    if (isBroadcaster || isModerator) return;

    // Ignorar mensajes muy cortos
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
      this.handleSpoiler(result, username);
    } else {
      logger.safe(text, username);
    }
  }

  /**
   * Maneja un spoiler detectado
   * NOTA: En Kick NO podemos eliminar mensajes con esta librería, solo alertar
   * @param {object} result - Resultado de detección
   * @param {string} username - Nombre del usuario
   */
  handleSpoiler(result, username) {
    this.stats.spoilersDetected++;
    logger.spoiler(result);

    // Notificación de escritorio al streamer
    notifier.spoilerDetected(result, 'kick');

    // Registrar usuario flaggeado
    const strikes = (this.flaggedUsers.get(username) || 0) + 1;
    this.flaggedUsers.set(username, strikes);

    // Guardar en log de spoilers
    this.spoilerLog.push({
      timestamp: new Date().toISOString(),
      username,
      message: result.originalMessage,
      score: result.score,
      matchType: result.matchType,
      game: result.matchedGame,
      strikes,
    });

    // Alertas especiales para reincidentes
    if (strikes >= 3) {
      logger.platform('kick', `🚨 REINCIDENTE: @${username} tiene ${strikes} strikes - Considera banearlo manualmente`);
      notifier.spoilerDetected({
        ...result,
        username: `⚠️ REINCIDENTE (${strikes}x): ${username}`,
      }, 'kick');
    }
  }

  /**
   * Intenta reconectar al live
   */
  async reconnect() {
    if (!this.isRunning) return;

    try {
      logger.platform('kick', '🔄 Reconectando...');
      await this.connection.connect();
      logger.platform('kick', '✅ Reconectado exitosamente');
    } catch (error) {
      if (error.message?.includes('offline') || error.message?.includes('ended')) {
        logger.platform('kick', '📴 El live ha terminado.');
        this.stop();
      } else {
        logger.error(`Error reconectando a Kick: ${error.message}`);
        setTimeout(() => this.reconnect(), 15000);
      }
    }
  }

  /**
   * Detiene el bot
   */
  stop() {
    this.isRunning = false;

    const uptime = this.stats.startTime
      ? Math.round((Date.now() - this.stats.startTime.getTime()) / 1000 / 60)
      : 0;

    logger.platform('kick', '⏹️ Bot detenido');
    logger.platform('kick', `📊 Resumen: ${this.stats.messagesProcessed} mensajes | ${this.stats.spoilersDetected} spoilers detectados | ${uptime} min activo`);

    if (this.flaggedUsers.size > 0) {
      logger.platform('kick', '👤 Usuarios flaggeados:');
      const sorted = [...this.flaggedUsers.entries()].sort((a, b) => b[1] - a[1]);
      sorted.forEach(([user, strikes]) => {
        logger.platform('kick', `   @${user}: ${strikes} strike(s)`);
      });
    }
  }

  /**
   * Recarga la base de datos de spoilers sin reiniciar
   */
  reloadDatabase() {
    this.detector.reload();
    logger.platform('kick', '🔄 Base de datos recargada');
  }

  /**
   * Exporta lista de palabras bloqueadas para filtros nativos de Kick
   * @returns {string[]}
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
    logger.platform('kick', `📋 Lista exportada: ${list.length} palabras/frases para filtros nativos`);
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

export default KickLiveBot;

// Ejecución standalone
if (process.argv[1] && process.argv[1].includes('kick-live')) {
  import('../../config/default.js').then(({ validateConfig }) => {
    validateConfig('kick');
    const bot = new KickLiveBot();
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
