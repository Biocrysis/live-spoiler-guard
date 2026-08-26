import chalk from 'chalk';
import { createInterface } from 'readline';
import config, { validateConfig } from '../config/default.js';
import YouTubeLiveBot from './bots/youtube-live.js';
import TikTokLiveBot from './bots/tiktok-live.js';
import TwitchLiveBot from './bots/twitch-live.js';
import KickLiveBot from './bots/kick-live.js';
import logger from './utils/logger.js';

/**
 * Orquestador principal del Bot Anti-Spoilers.
 * Gestiona ambos bots (YouTube + TikTok) y provee
 * una interfaz de comandos interactiva.
 */
class AntiSpoilerOrchestrator {
  constructor() {
    this.youtubeBot = null;
    this.tiktokBot = null;
    this.twitchBot = null;
    this.kickBot = null;
    this.rl = null;
    this.platform = null;
  }

  /**
   * Muestra el banner de inicio
   */
  showBanner() {
    console.log(chalk.cyan(`
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🎮  BOT ANTI-SPOILERS  🛡️                     ║
║   Moderación de chat para Lives                  ║
║                                                  ║
║   Plataformas: YouTube Live + TikTok Live        ║
║                                                  ║
╚══════════════════════════════════════════════════╝
    `));
  }

  /**
   * Muestra el menú de selección de plataforma
   */
  showMenu() {
    console.log(chalk.white(`
Plataformas disponibles (separar con coma, o "all" para todas):

  ${chalk.red('1)')} YouTube Live     - Moderación completa (eliminar + timeout)
  ${chalk.magenta('2)')} TikTok Live      - Monitoreo + alertas (solo lectura)
  ${chalk.hex('#9146FF')('3)')} Twitch Live      - Moderación completa (eliminar + timeout)
  ${chalk.green('4)')} Kick Live        - Monitoreo + alertas (solo lectura)

  Herramientas:
  ${chalk.white('t)')} Test detector    - Probar el detector con un mensaje
  ${chalk.blue('e)')} Exportar filtros - Generar lista para filtros nativos
  ${chalk.gray('0)')} Salir

  Ejemplos: ${chalk.gray('1,3')} (YouTube + Twitch) | ${chalk.gray('all')} (todas) | ${chalk.gray('2,4')} (TikTok + Kick)
    `));
  }

  /**
   * Inicia el orquestador
   */
  async start() {
    console.clear();
    this.showBanner();

    // Verificar argumentos de CLI
    const args = process.argv.slice(2);
    if (args.includes('--youtube')) {
      return this.startSelected(['youtube']);
    } else if (args.includes('--tiktok')) {
      return this.startSelected(['tiktok']);
    } else if (args.includes('--twitch')) {
      return this.startSelected(['twitch']);
    } else if (args.includes('--kick')) {
      return this.startSelected(['kick']);
    } else if (args.includes('--both')) {
      return this.startSelected(['youtube', 'tiktok']);
    } else if (args.includes('--all')) {
      return this.startSelected(['youtube', 'tiktok', 'twitch', 'kick']);
    }

    // Menú interactivo
    this.showMenu();
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.rl.question(chalk.cyan('\n→ Plataformas: '), async (answer) => {
      const input = answer.trim().toLowerCase();

      if (input === '0') {
        this.exit();
        return;
      }

      if (input === 't') {
        await this.testDetector();
        return;
      }

      if (input === 'e') {
        this.exportFilters();
        return;
      }

      if (input === 'all') {
        await this.startSelected(['youtube', 'tiktok', 'twitch', 'kick']);
        return;
      }

      // Parsear selección por comas
      const platformMap = { '1': 'youtube', '2': 'tiktok', '3': 'twitch', '4': 'kick' };
      const selections = input.split(',').map((s) => s.trim());
      const platforms = selections
        .map((s) => platformMap[s])
        .filter(Boolean);

      if (platforms.length === 0) {
        console.log(chalk.red('Opción no válida. Usa números separados por coma (ej: 1,3) o "all"'));
        this.showMenu();
        this.start();
        return;
      }

      await this.startSelected(platforms);
    });
  }

  /**
   * Inicia las plataformas seleccionadas simultáneamente
   * @param {string[]} platforms - Array con las plataformas a iniciar
   */
  async startSelected(platforms) {
    const platformNames = platforms.map((p) => p.charAt(0).toUpperCase() + p.slice(1));
    console.log(chalk.cyan(`\n🌐 Iniciando: ${platformNames.join(' + ')}...\n`));

    const starters = [];
    const labels = [];

    if (platforms.includes('youtube')) {
      this.youtubeBot = new YouTubeLiveBot();
      starters.push(this.youtubeBot.start());
      labels.push('YouTube');
    }
    if (platforms.includes('tiktok')) {
      this.tiktokBot = new TikTokLiveBot();
      starters.push(this.tiktokBot.start());
      labels.push('TikTok');
    }
    if (platforms.includes('twitch')) {
      this.twitchBot = new TwitchLiveBot();
      starters.push(this.twitchBot.start());
      labels.push('Twitch');
    }
    if (platforms.includes('kick')) {
      this.kickBot = new KickLiveBot();
      starters.push(this.kickBot.start());
      labels.push('Kick');
    }

    const results = await Promise.allSettled(starters);

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`${labels[index]}: ${result.reason.message}`);
        const platform = platforms[index];
        if (platform === 'youtube') this.youtubeBot = null;
        else if (platform === 'tiktok') this.tiktokBot = null;
        else if (platform === 'twitch') this.twitchBot = null;
        else if (platform === 'kick') this.kickBot = null;
      }
    });

    const anyActive = this.youtubeBot || this.tiktokBot || this.twitchBot || this.kickBot;
    if (!anyActive) {
      logger.error('No se pudo iniciar ningún bot.');
      this.exit(1);
      return;
    }

    this.startCommandListener();
  }

  /**
   * Modo de prueba del detector
   */
  async testDetector() {
    const { default: SpoilerDetector } = await import('./detection/spoiler-detector.js');
    const detector = new SpoilerDetector();

    console.log(chalk.green('\n🧪 Modo de prueba del detector'));
    console.log(chalk.gray('   Escribe un mensaje para analizar (escribe "salir" para terminar)\n'));

    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const askMessage = () => {
      rl.question(chalk.cyan('💬 Mensaje: '), (message) => {
        if (message.toLowerCase() === 'salir') {
          rl.close();
          console.clear();
          this.showBanner();
          this.showMenu();
          this.start();
          return;
        }

        const result = detector.analyze(message, 'test_user');

        console.log(chalk.white('\n📊 Resultado:'));
        console.log(`   Spoiler: ${result.isSpoiler ? chalk.red('SÍ 🚨') : chalk.green('NO ✅')}`);
        console.log(`   Score: ${chalk.yellow(result.score.toFixed(2))} (threshold: ${detector.threshold})`);
        console.log(`   Tipo: ${result.matchType || 'ninguno'}`);
        console.log(`   Juego: ${result.matchedGame || 'N/A'}`);
        if (result.matchedTerms.length > 0) {
          console.log(`   Términos: ${result.matchedTerms.join(', ')}`);
        }
        console.log('');

        askMessage();
      });
    };

    askMessage();
  }

  /**
   * Exporta la lista de filtros para TikTok
   */
  exportFilters() {
    const bot = new TikTokLiveBot();
    const words = bot.exportBlockList();

    console.log(chalk.blue('\n📋 Lista de palabras para filtros nativos de TikTok:'));
    console.log(chalk.gray('   (Copia estas palabras en: TikTok → Configuración de Live → Filtro de palabras clave)\n'));

    words.forEach((word) => {
      console.log(`   • ${word}`);
    });

    console.log(chalk.gray(`\n   Total: ${words.length} palabras/frases`));
    console.log(chalk.gray('   Puedes copiar esta lista completa.\n'));

    if (this.rl) {
      this.showMenu();
    }
  }

  /**
   * Listener de comandos mientras los bots corren
   */
  startCommandListener() {
    console.log(chalk.gray('\n─────────────────────────────────────────'));
    console.log(chalk.white(' Comandos disponibles mientras está activo:'));
    console.log(chalk.gray('   stats    - Ver estadísticas'));
    console.log(chalk.gray('   reload   - Recargar base de spoilers'));
    console.log(chalk.gray('   export   - Exportar filtros TikTok'));
    console.log(chalk.gray('   stop     - Detener bots'));
    console.log(chalk.gray('─────────────────────────────────────────\n'));

    if (this.rl) this.rl.close();

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.rl.on('line', (line) => {
      const cmd = line.trim().toLowerCase();

      switch (cmd) {
        case 'stats':
          this.showStats();
          break;
        case 'reload':
          this.reloadAll();
          break;
        case 'export':
          this.exportFilters();
          break;
        case 'stop':
          this.stopAll();
          break;
        default:
          if (cmd) {
            console.log(chalk.gray(`Comando no reconocido: ${cmd}`));
          }
          break;
      }
    });
  }

  /**
   * Muestra estadísticas de ambos bots
   */
  showStats() {
    console.log(chalk.white('\n📊 === ESTADÍSTICAS ===\n'));

    if (this.youtubeBot) {
      const yt = this.youtubeBot.getStats();
      console.log(chalk.red('▶ YouTube Live:'));
      console.log(`   Mensajes: ${yt.messagesProcessed}`);
      console.log(`   Spoilers: ${yt.spoilersDetected}`);
      console.log(`   Eliminados: ${yt.messagesDeleted}`);
      console.log(`   Uptime: ${Math.round(yt.uptime / 60)} min`);
      console.log('');
    }

    if (this.tiktokBot) {
      const tt = this.tiktokBot.getStats();
      console.log(chalk.magenta('♪ TikTok Live:'));
      console.log(`   Mensajes: ${tt.messagesProcessed}`);
      console.log(`   Spoilers: ${tt.spoilersDetected}`);
      console.log(`   Uptime: ${Math.round(tt.uptime / 60)} min`);
      if (tt.flaggedUsers && Object.keys(tt.flaggedUsers).length > 0) {
        console.log(`   Usuarios flaggeados: ${Object.keys(tt.flaggedUsers).length}`);
      }
      console.log('');
    }

    if (this.twitchBot) {
      const tw = this.twitchBot.getStats();
      console.log(chalk.hex('#9146FF')('🟣 Twitch Live:'));
      console.log(`   Mensajes: ${tw.messagesProcessed}`);
      console.log(`   Spoilers: ${tw.spoilersDetected}`);
      console.log(`   Eliminados: ${tw.messagesDeleted}`);
      console.log(`   Uptime: ${Math.round(tw.uptime / 60)} min`);
      console.log('');
    }

    if (this.kickBot) {
      const kk = this.kickBot.getStats();
      console.log(chalk.green('🟢 Kick Live:'));
      console.log(`   Mensajes: ${kk.messagesProcessed}`);
      console.log(`   Spoilers: ${kk.spoilersDetected}`);
      console.log(`   Uptime: ${Math.round(kk.uptime / 60)} min`);
      if (kk.flaggedUsers && Object.keys(kk.flaggedUsers).length > 0) {
        console.log(`   Usuarios flaggeados: ${Object.keys(kk.flaggedUsers).length}`);
      }
      console.log('');
    }
  }

  /**
   * Recarga la base de datos en ambos bots
   */
  reloadAll() {
    if (this.youtubeBot) this.youtubeBot.reloadDatabase();
    if (this.tiktokBot) this.tiktokBot.reloadDatabase();
    if (this.twitchBot) this.twitchBot.reloadDatabase();
    if (this.kickBot) this.kickBot.reloadDatabase();
    console.log(chalk.green('✅ Base de datos recargada en todos los bots activos'));
  }

  /**
   * Detiene todos los bots
   */
  stopAll() {
    if (this.youtubeBot) this.youtubeBot.stop();
    if (this.tiktokBot) this.tiktokBot.stop();
    if (this.twitchBot) this.twitchBot.stop();
    if (this.kickBot) this.kickBot.stop();
    this.exit(0);
  }

  /**
   * Sale del proceso
   * @param {number} code
   */
  exit(code = 0) {
    console.log(chalk.gray('\n👋 ¡Hasta pronto!\n'));
    if (this.rl) this.rl.close();
    process.exit(code);
  }
}

// --- Iniciar aplicación ---
const orchestrator = new AntiSpoilerOrchestrator();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n⚠️ Cerrando bots...'));
  orchestrator.stopAll();
});

process.on('SIGTERM', () => {
  orchestrator.stopAll();
});

process.on('uncaughtException', (error) => {
  logger.error(`Error no capturado: ${error.message}`);
  logger.error(error.stack);
});

process.on('unhandledRejection', (reason) => {
  logger.error(`Promise rechazada: ${reason}`);
});

// Iniciar
orchestrator.start();
