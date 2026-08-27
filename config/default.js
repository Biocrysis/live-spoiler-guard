import 'dotenv/config';

const config = {
  // YouTube settings
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/oauth2callback',
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN || '',
    channelId: process.env.YOUTUBE_CHANNEL_ID || '',
    spoilerAction: process.env.YOUTUBE_SPOILER_ACTION || 'delete', // delete | hide | warn
    timeoutSeconds: parseInt(process.env.YOUTUBE_TIMEOUT_SECONDS || '300', 10),
    // Intervalo de polling del chat en ms (YouTube no tiene WebSocket, usa polling)
    pollInterval: 5000,
  },

  // TikTok settings
  tiktok: {
    username: process.env.TIKTOK_USERNAME || '',
    signApiKey: process.env.TIKTOK_SIGN_API_KEY || '',
  },

  // Twitch settings
  twitch: {
    botUsername: process.env.TWITCH_BOT_USERNAME || '',
    oauthToken: process.env.TWITCH_OAUTH_TOKEN || '',
    channel: process.env.TWITCH_CHANNEL || '',
    spoilerAction: process.env.TWITCH_SPOILER_ACTION || 'delete', // delete | warn
    timeoutSeconds: parseInt(process.env.TWITCH_TIMEOUT_SECONDS || '300', 10),
  },

  // Kick settings
  kick: {
    username: process.env.KICK_USERNAME || '',
  },

  // Bot behavior
  bot: {
    sendWarningMessage: process.env.SEND_WARNING_MESSAGE === 'true',
    warningMessage: process.env.WARNING_MESSAGE || '⚠️ Mensaje eliminado por posible spoiler.',
    desktopNotifications: process.env.DESKTOP_NOTIFICATIONS === 'true',
    soundAlerts: process.env.SOUND_ALERTS === 'true',
  },

  // Detection settings
  detection: {
    sensitivity: process.env.DETECTION_SENSITIVITY || 'medium', // low | medium | high
    useAI: process.env.USE_AI_DETECTION === 'true',
    openaiKey: process.env.OPENAI_API_KEY || '',
    // Puntuación mínima para considerar spoiler según sensibilidad
    thresholds: {
      low: 0.8,
      medium: 0.5,
      high: 0.3,
    },
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    saveLogs: process.env.SAVE_LOGS === 'true',
    logDir: './logs',
  },
};

/**
 * Valida que las configuraciones mínimas estén presentes
 * @param {'youtube' | 'tiktok' | 'both'} platform
 */
export function validateConfig(platform = 'both') {
  const errors = [];

  if (platform === 'youtube' || platform === 'both') {
    if (!config.youtube.clientId) errors.push('YOUTUBE_CLIENT_ID es requerido');
    if (!config.youtube.clientSecret) errors.push('YOUTUBE_CLIENT_SECRET es requerido');
    if (!config.youtube.refreshToken) errors.push('YOUTUBE_REFRESH_TOKEN es requerido');
    if (!config.youtube.channelId) errors.push('YOUTUBE_CHANNEL_ID es requerido');
  }

  if (platform === 'tiktok' || platform === 'both') {
    if (!config.tiktok.username) errors.push('TIKTOK_USERNAME es requerido');
  }

  if (platform === 'twitch' || platform === 'all') {
    if (!config.twitch.botUsername) errors.push('TWITCH_BOT_USERNAME es requerido');
    if (!config.twitch.oauthToken) errors.push('TWITCH_OAUTH_TOKEN es requerido');
    if (!config.twitch.channel) errors.push('TWITCH_CHANNEL es requerido');
  }

  if (platform === 'kick' || platform === 'all') {
    if (!config.kick.username) errors.push('KICK_USERNAME es requerido');
  }

  if (config.detection.useAI && !config.detection.openaiKey) {
    errors.push('OPENAI_API_KEY es requerido cuando USE_AI_DETECTION=true');
  }

  if (errors.length > 0) {
    console.error('❌ Errores de configuración:');
    errors.forEach((err) => console.error(`   - ${err}`));
    console.error('\n📄 Revisa tu archivo .env (usa .env.example como referencia)');
    process.exit(1);
  }

  return true;
}

export default config;
