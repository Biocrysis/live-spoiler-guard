import config from '../../config/default.js';

/**
 * Detector de spoilers con IA (OpenAI).
 * Se usa como complemento del detector basado en reglas
 * para detectar spoilers contextuales que no están en la base de datos.
 */
class AIDetector {
  constructor() {
    this.apiKey = config.detection.openaiKey;
    this.enabled = config.detection.useAI && !!this.apiKey;

    if (this.enabled) {
      console.log('🤖 Detector IA habilitado (OpenAI)');
    }
  }

  /**
   * Analiza un mensaje usando IA para detectar spoilers contextuales
   * @param {string} message - Mensaje a analizar
   * @param {string[]} activeGameNames - Nombres de juegos activos
   * @returns {Promise<{ isSpoiler: boolean, confidence: number, reason: string }>}
   */
  async analyze(message, activeGameNames = []) {
    if (!this.enabled) {
      return { isSpoiler: false, confidence: 0, reason: 'AI detection disabled' };
    }

    try {
      const prompt = this.buildPrompt(message, activeGameNames);
      const response = await this.callOpenAI(prompt);
      return this.parseResponse(response);
    } catch (error) {
      console.error('⚠️ Error en detección IA:', error.message);
      return { isSpoiler: false, confidence: 0, reason: `Error: ${error.message}` };
    }
  }

  /**
   * Construye el prompt para OpenAI
   */
  buildPrompt(message, gameNames) {
    return {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Eres un moderador de chat de gaming. Tu trabajo es detectar spoilers de videojuegos.
          
Juegos que se están streameando actualmente: ${gameNames.join(', ') || 'No especificado'}

Responde SOLO en JSON con este formato:
{
  "isSpoiler": true/false,
  "confidence": 0.0-1.0,
  "reason": "explicación breve"
}

Considera spoiler cualquier mensaje que revele:
- Muertes de personajes
- Giros de trama
- Finales del juego
- Identidad de villanos/traidores
- Eventos importantes de la historia

NO es spoiler:
- Opiniones generales ("el juego es bueno")
- Mecánicas de gameplay
- Información de trailers oficiales
- Preguntas sobre el juego`,
        },
        {
          role: 'user',
          content: `Analiza este mensaje del chat: "${message}"`,
        },
      ],
      temperature: 0.1,
      max_tokens: 100,
    };
  }

  /**
   * Llama a la API de OpenAI
   */
  async callOpenAI(payload) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Parsea la respuesta de OpenAI
   */
  parseResponse(responseText) {
    try {
      // Intentar extraer JSON de la respuesta
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { isSpoiler: false, confidence: 0, reason: 'No se pudo parsear respuesta' };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isSpoiler: Boolean(parsed.isSpoiler),
        confidence: Number(parsed.confidence) || 0,
        reason: String(parsed.reason || 'Sin razón proporcionada'),
      };
    } catch {
      return { isSpoiler: false, confidence: 0, reason: 'Error parseando respuesta IA' };
    }
  }
}

export default AIDetector;
