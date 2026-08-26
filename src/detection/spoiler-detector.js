import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import config from '../../config/default.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_PATH = join(__dirname, '../../data/spoilers.json');

/**
 * Motor principal de detección de spoilers.
 * Analiza mensajes del chat y determina si contienen spoilers
 * basándose en la base de datos de juegos activos.
 */
class SpoilerDetector {
  constructor() {
    this.database = null;
    this.activeGames = [];
    this.threshold = config.detection.thresholds[config.detection.sensitivity] || 0.5;
    this.loadDatabase();
  }

  /**
   * Carga la base de datos de spoilers desde el JSON
   */
  loadDatabase() {
    try {
      const raw = readFileSync(DATA_PATH, 'utf-8');
      this.database = JSON.parse(raw);
      this.activeGames = Object.entries(this.database.games)
        .filter(([key, game]) => game.active && key !== 'template')
        .map(([key, game]) => ({ id: key, ...game }));

      console.log(`🎮 Spoiler DB cargada: ${this.activeGames.length} juego(s) activo(s)`);
      this.activeGames.forEach((game) => {
        console.log(`   ✅ ${game.name} (${game.keywords.length} keywords, ${game.characters.length} personajes)`);
      });
    } catch (error) {
      console.error('❌ Error cargando base de datos de spoilers:', error.message);
      this.database = { games: {}, globalPatterns: {} };
      this.activeGames = [];
    }
  }

  /**
   * Recarga la base de datos (útil para hot-reload)
   */
  reload() {
    console.log('🔄 Recargando base de datos de spoilers...');
    this.loadDatabase();
  }

  /**
   * Analiza un mensaje y devuelve el resultado de detección
   * @param {string} message - Mensaje del chat a analizar
   * @param {string} username - Nombre del usuario que envió el mensaje
   * @returns {DetectionResult}
   */
  analyze(message, username = 'unknown') {
    const normalizedMessage = this.normalize(message);

    const result = {
      isSpoiler: false,
      score: 0,
      matchedGame: null,
      matchType: null,
      matchedTerms: [],
      originalMessage: message,
      username,
      timestamp: new Date().toISOString(),
    };

    // 1. Verificar patrones globales de spoiler
    const globalScore = this.checkGlobalPatterns(normalizedMessage);
    if (globalScore > 0) {
      result.score += globalScore;
      result.matchType = 'global_pattern';
    }

    // 2. Verificar cada juego activo
    for (const game of this.activeGames) {
      const gameResult = this.checkGame(normalizedMessage, game);

      if (gameResult.score > result.score) {
        result.score = gameResult.score;
        result.matchedGame = game.name;
        result.matchType = gameResult.matchType;
        result.matchedTerms = gameResult.matchedTerms;
      }
    }

    // 3. Verificar safe words (pueden reducir la puntuación)
    const safeReduction = this.checkSafeWords(normalizedMessage);
    result.score = Math.max(0, result.score - safeReduction);

    // 4. Determinar si es spoiler según threshold
    result.isSpoiler = result.score >= this.threshold;

    return result;
  }

  /**
   * Normaliza un mensaje para análisis (minúsculas, sin acentos extra, etc.)
   * @param {string} message
   * @returns {string}
   */
  normalize(message) {
    return message
      .toLowerCase()
      .trim()
      // Remover emojis pero mantener texto
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
      .replace(/[\u{2600}-\u{26FF}]/gu, '')
      .replace(/[\u{2700}-\u{27BF}]/gu, '')
      // Remover caracteres repetidos (troll evasion: "muuueeere" → "muere")
      .replace(/(.)\1{2,}/g, '$1')
      // Normalizar espacios
      .replace(/\s+/g, ' ');
  }

  /**
   * Verifica patrones globales de spoiler
   * @param {string} message
   * @returns {number} score entre 0 y 1
   */
  checkGlobalPatterns(message) {
    const patterns = this.database.globalPatterns;
    let maxScore = 0;

    // Indicadores de spoiler directo
    for (const indicator of patterns.spoilerIndicators || []) {
      if (message.includes(indicator.toLowerCase())) {
        maxScore = Math.max(maxScore, 0.7);
      }
    }

    // Patrones de muerte
    for (const pattern of patterns.deathPatterns || []) {
      if (message.includes(pattern.toLowerCase())) {
        maxScore = Math.max(maxScore, 0.9);
      }
    }

    // Patrones de final
    for (const pattern of patterns.endingPatterns || []) {
      if (message.includes(pattern.toLowerCase())) {
        maxScore = Math.max(maxScore, 0.8);
      }
    }

    return maxScore;
  }

  /**
   * Verifica un mensaje contra un juego específico
   * @param {string} message
   * @param {object} game
   * @returns {{ score: number, matchType: string, matchedTerms: string[] }}
   */
  checkGame(message, game) {
    const result = { score: 0, matchType: null, matchedTerms: [] };

    // Nivel 1: Keywords exactas (máxima confianza)
    for (const keyword of game.keywords) {
      if (message.includes(keyword.toLowerCase())) {
        result.score = 1.0;
        result.matchType = 'exact_keyword';
        result.matchedTerms.push(keyword);
        return result; // No necesita más verificación
      }
    }

    // Nivel 2: Partial match (alta confianza)
    for (const partial of game.partialMatch) {
      if (message.includes(partial.toLowerCase())) {
        result.score = Math.max(result.score, 0.8);
        result.matchType = 'partial_match';
        result.matchedTerms.push(partial);
      }
    }

    // Nivel 3: Personaje + contexto (confianza media-alta)
    const mentionedCharacters = game.characters.filter((char) =>
      message.includes(char.toLowerCase())
    );

    if (mentionedCharacters.length > 0) {
      const contextMatches = game.contextPhrases.filter((phrase) =>
        message.includes(phrase.toLowerCase())
      );

      if (contextMatches.length > 0) {
        const combinedScore = 0.6 + (contextMatches.length * 0.1);
        if (combinedScore > result.score) {
          result.score = Math.min(combinedScore, 1.0);
          result.matchType = 'character_context';
          result.matchedTerms = [
            ...mentionedCharacters.map((c) => `[personaje: ${c}]`),
            ...contextMatches.map((c) => `[contexto: ${c}]`),
          ];
        }
      }
    }

    return result;
  }

  /**
   * Verifica safe words y devuelve cuánto reducir la puntuación
   * @param {string} message
   * @returns {number} reducción de score
   */
  checkSafeWords(message) {
    let reduction = 0;

    for (const game of this.activeGames) {
      for (const safeWord of game.safeWords || []) {
        if (message.includes(safeWord.toLowerCase())) {
          reduction += 0.3;
        }
      }
    }

    return Math.min(reduction, 0.5); // Máximo 0.5 de reducción
  }

  /**
   * Obtiene estadísticas del detector
   */
  getStats() {
    return {
      activeGames: this.activeGames.length,
      totalKeywords: this.activeGames.reduce((sum, g) => sum + g.keywords.length, 0),
      totalCharacters: this.activeGames.reduce((sum, g) => sum + g.characters.length, 0),
      sensitivity: config.detection.sensitivity,
      threshold: this.threshold,
    };
  }
}

/**
 * @typedef {Object} DetectionResult
 * @property {boolean} isSpoiler - Si el mensaje es un spoiler
 * @property {number} score - Puntuación de 0 a 1
 * @property {string|null} matchedGame - Nombre del juego que coincidió
 * @property {string|null} matchType - Tipo de match (exact_keyword, partial_match, character_context, global_pattern)
 * @property {string[]} matchedTerms - Términos que coincidieron
 * @property {string} originalMessage - Mensaje original
 * @property {string} username - Usuario que envió el mensaje
 * @property {string} timestamp - Fecha/hora de detección
 */

export default SpoilerDetector;
