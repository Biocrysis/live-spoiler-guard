import notifier from 'node-notifier';
import config from '../../config/default.js';

/**
 * Sistema de notificaciones de escritorio
 * Alerta al streamer cuando se detecta un spoiler
 */
class Notifier {
  constructor() {
    this.enabled = config.bot.desktopNotifications;
  }

  /**
   * Envía una notificación de spoiler detectado
   * @param {object} result - Resultado de detección
   * @param {string} platform - 'youtube' o 'tiktok'
   */
  spoilerDetected(result, platform) {
    if (!this.enabled) return;

    const platformIcon = platform === 'youtube' ? '▶️' : '🎵';
    const title = `${platformIcon} Spoiler detectado en ${platform}`;
    const message = `Usuario: ${result.username}\nJuego: ${result.matchedGame || 'Global'}\nScore: ${(result.score * 100).toFixed(0)}%`;

    notifier.notify({
      title,
      message,
      sound: config.bot.soundAlerts,
      wait: false,
      timeout: 5,
    });
  }

  /**
   * Notificación de bot iniciado
   * @param {string} platform
   */
  botStarted(platform) {
    if (!this.enabled) return;

    notifier.notify({
      title: '🤖 Bot Anti-Spoilers Activo',
      message: `Monitoreando ${platform} Live Chat`,
      sound: false,
      wait: false,
    });
  }

  /**
   * Notificación de error
   * @param {string} message
   */
  error(message) {
    if (!this.enabled) return;

    notifier.notify({
      title: '❌ Error en Bot Anti-Spoilers',
      message,
      sound: true,
      wait: false,
    });
  }
}

export default new Notifier();
