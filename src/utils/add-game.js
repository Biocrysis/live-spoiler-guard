import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, '../../data/spoilers.json');

/**
 * Utilidad CLI para agregar un nuevo juego a la base de datos de spoilers.
 * Uso: npm run add-game
 */

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(chalk.cyan(question), (answer) => {
      resolve(answer.trim());
    });
  });
}

function askList(question) {
  return new Promise((resolve) => {
    rl.question(chalk.cyan(question), (answer) => {
      const items = answer
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      resolve(items);
    });
  });
}

async function main() {
  console.log(chalk.green('\n🎮 Agregar nuevo juego a la base de datos de spoilers\n'));
  console.log(chalk.gray('(Las listas se separan por comas)\n'));

  const name = await ask('Nombre del juego: ');
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const releaseDate = await ask('Fecha de lanzamiento (YYYY-MM-DD): ');
  const characters = await askList('Personajes principales (separados por coma): ');
  const keywords = await askList('Frases exactas de spoiler (separadas por coma): ');
  const partialMatch = await askList('Frases parciales que sugieren spoiler (separadas por coma): ');
  const contextPhrases = await askList('Frases de contexto (ej: muere, traiciona, etc.): ');
  const safeWords = await askList('Palabras seguras / falsos positivos (separadas por coma): ');

  const newGame = {
    name,
    active: true,
    releaseDate,
    keywords,
    partialMatch,
    characters,
    contextPhrases,
    safeWords: safeWords.length > 0 ? safeWords : ['gameplay', 'trailer'],
  };

  console.log(chalk.yellow('\n📋 Nuevo juego a agregar:'));
  console.log(JSON.stringify(newGame, null, 2));

  const confirm = await ask('\n¿Confirmar? (s/n): ');

  if (confirm.toLowerCase() === 's' || confirm.toLowerCase() === 'si') {
    const database = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
    database.games[slug] = newGame;
    database._metadata.lastUpdated = new Date().toISOString().split('T')[0];

    writeFileSync(DATA_PATH, JSON.stringify(database, null, 2), 'utf-8');
    console.log(chalk.green(`\n✅ Juego "${name}" agregado exitosamente con ID: ${slug}`));
    console.log(chalk.gray('   Si el bot está corriendo, usa el comando "reload" para aplicar los cambios.\n'));
  } else {
    console.log(chalk.gray('\n❌ Cancelado.\n'));
  }

  rl.close();
}

main().catch((err) => {
  console.error('Error:', err.message);
  rl.close();
  process.exit(1);
});
