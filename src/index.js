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
Selecciona una opción:

  ${chalk.red('1)')} YouTube Live     - Moderación completa (eliminar + timeout)
  ${chalk.magenta('2)')} TikTok Live      - Monitoreo + alertas (solo lectura)
  ${chalk.yellow('3)')} Ambas (YT+TT)    - Ejecutar YouTube + TikTok simultáneamente
  ${chalk.hex('#9146FF')('4)')} Twitch Live      - Moderación completa (eliminar + timeout)
  ${chalk.green('5)')} Kick Live        - Monitoreo + alertas (solo lectura)
  ${chalk.cyan('6)')} Todas            - Ejecutar todas las plataformas
  ${chalk.white('7)')} Test detector    - Probar el detector con un mensaje
  ${chalk.blue('8)')} Exportar filtros - Generar lista para filtros nativos
  ${chalk.gray('0)')} Salir
    `));
  }

  /**
   * Inicia el orquestador
   */
  async start() {
    this.showBanner();

    // Verificar argumentos de CLI
    const args = process.argv.slice(2);
    if (args.includes('--youtube')) {
      return this.startYouTube();
    } else if (args.includes('--tiktok')) {
      return this.startTikTok();
    } else if (args.includes('--twitch')) {
      return this.startTwitch();
    } else if (args.includes('--kick')) {
      return this.startKick();
    } else if (args.includes('--both')) {
      return this.startBoth();
    } else if (args.includes('--all')) {
      return this.startAll();
    }

    // Menú interactivo
    this.showMenu();
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    this.rl.question(chalk.cyan('\n→ Opción: '), async (answer) => {
      switch (answer.trim()) {
        case '1':
          await this.startYouTube();
          break;
        case '2':
          await this.startTikTok();
          break;
        case '3':
          await this.startBoth();
          break;
        case '4':
          await this.startTwitch();
          break;
        case '5':
          await this.startKick();
          break;
        case '6':
          await this.startAll();
          break;
        case '7':
          await this.testDetector();
          break;
        case '8':
          this.exportFilters();
          break;
        case '0':
          this.exit();
          break;
        default:
          console.log(chalk.red('Opción no válida'));
          this.showMenu();
          break;
      }
    });
  }

  /**
   * Inicia solo el bot de YouTube
   */
  async startYouTube() {
    validateConfig('youtube');
    console.log(chalk.red('\n▶ Iniciando YouTube Live Bot...\n'));

    this.youtubeBot = new YouTubeLiveBot();

    try {
      await this.youtubeBot.start();
      this.startCommandListener();
    } catch (error) {
      logger.error(`No se pudo iniciar YouTube bot: ${error.message}`);
      this.exit(1);
    }
  }

  /**
   * Inicia solo el bot de TikTok
   */
  async startTikTok() {
    validateConfig('tiktok');
    console.log(chalk.magenta('\n♪ Iniciando TikTok Live Bot...\n'));

    this.tiktokBot = new TikTokLiveBot();

    try {
      await this.tiktokBot.start();
      this.startCommandListener();
    } catch (error) {
      logger.error(`No se pudo iniciar TikTok bot: ${error.message}`);
      this.exit(1);
    }
  }

  /**
   * Inicia ambos bots simultáneamente
   */
  async startBoth() {
    validateConfig('both');
    console.log(chalk.yellow('\n🔄 Iniciando YouTube + TikTok...\n'));

    this.youtubeBot = new YouTubeLiveBot();
    this.tiktokBot = new TikTokLiveBot();

    const results = await Promise.allSettled([
      this.youtubeBot.start(),
      this.tiktokBot.start(),
    ]);

    results.forEach((result, index) => {
      const platform = index === 0 ? 'YouTube' : 'TikTok';
      if (result.status === 'rejected') {
        logger.error(`${platform}: ${result.reason.message}`);
        if (index === 0) this.youtubeBot = null;
        else this.tiktokBot = null;
      }
    });

    if (!this.youtubeBot && !this.tiktokBot) {
      logger.error('No se pudo iniciar ningún bot.');
      this.exit(1);
      return;
    }

    this.startCommandListener();
  }

  /**
   * Inicia solo el bot de Twitch
   */
  async startTwitch() {
    validateConfig('twitch');
    console.log(chalk.hex('#9146FF')('\n🟣 Iniciando Twitch Live Bot...\n'));

    this.twitchBot = new TwitchLiveBot();

    try {
      await this.twitchBot.start();
      this.startCommandListener();
    } catch (error) {
      logger.error(`No se pudo iniciar Twitch bot: ${error.message}`);
      this.exit(1);
    }
  }

  /**
   * Inicia solo el bot de Kick
   */
  async startKick() {
    validateConfig('kick');
    console.log(chalk.green('\n🟢 Iniciando Kick Live Bot...\n'));

    this.kickBot = new KickLiveBot();

    try {
      await this.kickBot.start();
      this.startCommandListener();
    } catch (error) {
      logger.error(`No se pudo iniciar Kick bot: ${error.message}`);
      this.exit(1);
    }
  }

  /**
   * Inicia todas las plataformas simultáneamente
   */
  async startAll() {
    console.log(chalk.cyan('\n🌐 Iniciando todas las plataformas...\n'));

    this.youtubeBot = new YouTubeLiveBot();
    this.tiktokBot = new TikTokLiveBot();
    this.twitchBot = new TwitchLiveBot();
    this.kickBot = new KickLiveBot();

    const results = await Promise.allSettled([
      this.youtubeBot.start(),
      this.tiktokBot.start(),
      this.twitchBot.start(),
      this.kickBot.start(),
    ]);

    const platforms = ['YouTube', 'TikTok', 'Twitch', 'Kick'];
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(`${platforms[index]}: ${result.reason.message}`);
        if (index === 0) this.youtubeBot = null;
        else if (index === 1) this.tiktokBot = null;
        else if (index === 2) this.twitchBot = null;
        else this.kickBot = null;
      }
    });

    if (!this.youtubeBot && !this.tiktokBot && !this.twitchBot && !this.kickBot) {
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
