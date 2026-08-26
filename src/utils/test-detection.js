import chalk from 'chalk';
import SpoilerDetector from '../detection/spoiler-detector.js';

/**
 * Utilidad para testear el motor de detección con mensajes predefinidos.
 * Uso: npm run test-detection
 */

const detector = new SpoilerDetector();

console.log(chalk.green('\n🧪 Test del Motor de Detección de Spoilers\n'));
console.log(chalk.gray(`   Sensibilidad: ${detector.threshold}`));
console.log(chalk.gray(`   Juegos activos: ${detector.activeGames.length}\n`));

// Mensajes de prueba
const testMessages = [
  // Deberían SER spoilers
  { msg: 'lucia muere al final del juego', expected: true },
  { msg: 'jason traiciona a lucia en el ultimo acto', expected: true },
  { msg: 'el final es que lucia se queda sola', expected: true },
  { msg: 'spoiler: el villano es el mejor amigo', expected: true },
  { msg: 'mueren todos al final jajaja', expected: true },
  { msg: 'te spoileo el final verdadero', expected: true },
  { msg: 'el final secreto es increible, link se sacrifica', expected: true },

  // NO deberían ser spoilers
  { msg: 'me encanta este juego', expected: false },
  { msg: 'lucia gameplay es genial', expected: false },
  { msg: 'que buen stream bro', expected: false },
  { msg: 'el trailer de gta 6 se ve brutal', expected: false },
  { msg: 'hola a todos!', expected: false },
  { msg: 'cuando sale el proximo dlc?', expected: false },
  { msg: 'alguien tiene el link del discord?', expected: false },
];

let passed = 0;
let failed = 0;

console.log(chalk.white('─'.repeat(80)));

for (const test of testMessages) {
  const result = detector.analyze(test.msg, 'test_user');
  const correct = result.isSpoiler === test.expected;

  if (correct) {
    passed++;
    console.log(
      chalk.green(' ✅ PASS ') +
      chalk.gray(`[score: ${result.score.toFixed(2)}] `) +
      `"${test.msg}"`
    );
  } else {
    failed++;
    console.log(
      chalk.red(' ❌ FAIL ') +
      chalk.yellow(`[score: ${result.score.toFixed(2)}, expected: ${test.expected ? 'SPOILER' : 'SAFE'}] `) +
      `"${test.msg}"`
    );
    if (result.matchedTerms.length > 0) {
      console.log(chalk.gray(`         Matched: ${result.matchedTerms.join(', ')}`));
    }
  }
}

console.log(chalk.white('─'.repeat(80)));
console.log(
  `\n📊 Resultados: ${chalk.green(`${passed} passed`)} / ${chalk.red(`${failed} failed`)} / ${testMessages.length} total`
);
console.log(
  `   Precisión: ${chalk.yellow(((passed / testMessages.length) * 100).toFixed(1))}%\n`
);

if (failed > 0) {
  console.log(chalk.yellow('⚠️  Hay tests fallidos. Revisa la base de datos o ajusta la sensibilidad.\n'));
}
