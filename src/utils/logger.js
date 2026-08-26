import chalk from 'chalk';
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import config from '../../config/default.js';

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LOG_LEVELS[config.logging.level] || 1;

/**
 * Logger centralizado con colores y guardado a archivo
 */
const logger = {
  debug(message, ...args) {
    if (currentLevel <= LOG_LEVELS.debug) {
      const msg = `[DEBUG] ${message}`;
      console.log(chalk.gray(msg), ...args);
      saveToFile(msg);
    }
  },

  info(message, ...args) {
    if (currentLevel <= LOG_LEVELS.info) {
      const msg = `[INFO] ${message}`;
      console.log(chalk.blue(msg), ...args);
      saveToFile(msg);
    }
  },

  warn(message, ...args) {
    if (currentLevel <= LOG_LEVELS.warn) {
      const msg = `[WARN] ${message}`;
      console.log(chalk.yellow(msg), ...args);
      saveToFile(msg);
    }
  },

  error(message, ...args) {
    if (currentLevel <= LOG_LEVELS.error) {
      const msg = `[ERROR] ${message}`;
      console.error(chalk.red(msg), ...args);
      saveToFile(msg);
    }
  },

  spoiler(result) {
    const msg = `🚨 SPOILER DETECTADO | Usuario: ${result.username} | Juego: ${result.matchedGame || 'Global'} | Score: ${result.score.toFixed(2)} | Tipo: ${result.matchType} | Mensaje: "${result.originalMessage}"`;
    console.log(chalk.bgRed.white(msg));
    saveToFile(msg);
  },

  safe(message, username) {
    if (currentLevel <= LOG_LEVELS.debug) {
      const msg = `✅ [${username}]: ${message}`;
      console.log(chalk.green(msg));
    }
  },

  platform(platform, message) {
    const prefix = platform === 'youtube'
      ? chalk.red('▶ [YouTube]')
      : chalk.magenta('♪ [TikTok]');
    console.log(`${prefix} ${message}`);
    saveToFile(`[${platform.toUpperCase()}] ${message}`);
  },
};

function saveToFile(message) {
  if (!config.logging.saveLogs) return;

  try {
    const logDir = config.logging.logDir;
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const date = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString();
    const logFile = join(logDir, `${date}.log`);
    appendFileSync(logFile, `[${timestamp}] ${message}\n`);
  } catch {
    // Silently fail on log write errors
  }
}

export default logger;
