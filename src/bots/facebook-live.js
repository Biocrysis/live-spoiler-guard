import config from '../../config/default.js';
import SpoilerDetector from '../detection/spoiler-detector.js';
import AIDetector from '../detection/ai-detector.js';
import logger from '../utils/logger.js';
import notifier from '../utils/notifier.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Bot de moderación anti-spoilers para Facebook Live.
 *
 * Usa la Graph API oficial de Meta.
 *
 * Funcionalidades:
 * - Lee comentarios del live en tiempo real (polling)
 * - Detecta spoilers con el motor de reglas + IA opcional
 * - Oculta/elimina comentarios automáticamente
 * - Envía advertencias
 *
 * Requisitos:
 * - App en Meta for Developers
 * - Página de Facebook (los lives deben ser en una Page)
 * - Page Access Token con permisos:
 *   pages_read_engagement, pages_manage_engagement, pages_read_user_content
 */
class FacebookLiveBot {
  constructor() {
    this.detector = new SpoilerDetector();
    this.aiDetector = new AIDetector();
    this.pageAccessToken = config.facebook.pageAccessToken;
    this.pageId = config.facebook.pageId;
    this.liveVideoId = null;
    this.pollingTimer = null;
    this.isRunning = false;
    this.seenCommentIds = new Set();
    this.stats = {
      messagesProcessed: 0,
      spoilersDetected: 0,
      messagesDeleted: 0,
      startTime: null,
    };
    this.userStrikes = new Map();
  }

  /**
   * Realiza una petición a la Graph API
   * @param {string} endpoint - Endpoint relativo (empieza con /)
   * @param {object} options - Opciones fetch (method, body)
   * @returns {Promise<object>}
   */
  async graphRequest(endpoint, options = {}) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${GRAPH_API_BASE}${endpoint}${separator}access_token=${this.pageAccessToken}`;

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok || data.error) {
      const message = data.error?.message || `HTTP ${response.status}`;
      const err = new Error(message);
      err.code = data.error?.code || response.status;
      throw err;
    }

    return data;
  }

  /**
   * Busca el live activo de la página
   * @returns {Promise<string>} liveVideoId
   */
  async findActiveLiveVideo() {
    logger.platform('facebook', 'Buscando transmisión en vivo activa...');

    const data = await this.graphRequest(
      `/${this.pageId}/live_videos?fields=id,status,title&broadcast_status=["LIVE"]`
    );

    const liveVideos = data.data || [];
    const active = liveVideos.find((v) => v.status === 'LIVE') || liveVideos[0];

    if (!active) {
      throw new Error('No se encontró ninguna transmisión en vivo activa en la página.');
    }

    this.liveVideoId = active.id;
    logger.platform('facebook', `🔴 Live encontrado: "${active.title || 'Sin título'}" (id: ${active.id})`);
    return this.liveVideoId;
  }

  /**
   * Inicia el monitoreo del live
   */
  async start() {
    try {
      if (!this.pageAccessToken || !this.pageId) {
        throw new Error('Faltan credenciales de Facebook (token o pageId).');
      }

      await this.findActiveLiveVideo();

      this.isRunning = true;
      this.stats.startTime = new Date();

      logger.platform('facebook', '🤖 Bot Anti-Spoilers ACTIVO - Monitoreando comentarios...');
      notifier.botStarted('Facebook');

      await this.pollComments();
    } catch (error) {
      logger.error(`Error iniciando Facebook bot: ${error.message}`);
      notifier.error(`Facebook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Polling de comentarios del live
   */
  async pollComments() {
    if (!this.isRunning) return;

    try {
      // order=reverse_chronological trae los más recientes primero
      const data = await this.graphRequest(
        `/${this.liveVideoId}/comments?fields=id,message,from&order=reverse_chronological&live_filter=no_filter`
      );

      const comments = data.data || [];

      for (const comment of comments) {
        // Evitar procesar comentarios ya vistos
        if (this.seenCommentIds.has(comment.id)) continue;
        this.seenCommentIds.add(comment.id);
        await this.processComment(comment);
      }

      // Limitar tamaño del set para no consumir memoria infinita
      if (this.seenCommentIds.size > 5000) {
        this.seenCommentIds = new Set([...this.seenCommentIds].slice(-2500));
      }

      this.pollingTimer = setTimeout(() => this.pollComments(), config.facebook.pollInterval);
    } catch (error) {
      if (error.code === 190) {
        // Token inválido o expirado
        logger.error('Token de Facebook inválido o expirado. Deteniendo bot.');
        this.stop();
      } else if (error.message.includes('no se encontró') || error.code === 100) {
        logger.error('El live puede haber terminado.');
        this.stop();
      } else {
        logger.error(`Error en polling de Facebook: ${error.message}`);
        this.pollingTimer = setTimeout(() => this.pollComments(), 10000);
      }
    }
  }

  /**
   * Procesa un comentario individual
   * @param {object} comment - Comentario de la Graph API
   */
  async processComment(comment) {
    const text = comment.message || '';
    const username = comment.from?.name || 'Unknown';
    const commentId = comment.id;

    // Ignorar comentarios muy cortos
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
      await this.handleSpoiler(result, commentId, username);
    } else {
      logger.safe(text, username);
    }
  }

  /**
   * Maneja un comentario con spoiler
   * @param {object} result - Resultado de detección
   * @param {string} commentId - ID del comentario
   * @param {string} username - Nombre del usuario
   */
  async handleSpoiler(result, commentId, username) {
    this.stats.spoilersDetected++;
    logger.spoiler(result);
    notifier.spoilerDetected(result, 'facebook');

    const strikes = (this.userStrikes.get(username) || 0) + 1;
    this.userStrikes.set(username, strikes);

    const action = config.facebook.spoilerAction;

    try {
      if (action === 'delete') {
        await this.deleteComment(commentId);
        this.stats.messagesDeleted++;
        logger.platform('facebook', `🗑️ Comentario eliminado de ${username} (strike ${strikes})`);
      } else if (action === 'hide') {
        await this.hideComment(commentId);
        this.stats.messagesDeleted++;
        logger.platform('facebook', `🙈 Comentario ocultado de ${username} (strike ${strikes})`);
      }
    } catch (error) {
      logger.error(`Error manejando spoiler en Facebook: ${error.message}`);
    }
  }

  /**
   * Elimina un comentario
   * @param {string} commentId
   */
  async deleteComment(commentId) {
    await this.graphRequest(`/${commentId}`, { method: 'DELETE' });
  }

  /**
   * Oculta un comentario (menos agresivo que eliminar)
   * @param {string} commentId
   */
  async hideComment(commentId) {
    await this.graphRequest(`/${commentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_hidden: true }),
    });
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

    logger.platform('facebook', '⏹️ Bot detenido');
    logger.platform('facebook', `📊 Resumen: ${this.stats.messagesProcessed} comentarios | ${this.stats.spoilersDetected} spoilers | ${this.stats.messagesDeleted} eliminados | ${uptime} min activo`);
  }

  /**
   * Recarga la base de datos de spoilers sin reiniciar
   */
  reloadDatabase() {
    this.detector.reload();
    logger.platform('facebook', '🔄 Base de datos recargada');
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

export default FacebookLiveBot;

// Ejecución standalone
if (process.argv[1] && process.argv[1].includes('facebook-live')) {
  import('../../config/default.js').then(({ validateConfig }) => {
    validateConfig('facebook');
    const bot = new FacebookLiveBot();
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
