# Bot Anti-Spoilers - Convenciones del Proyecto

## Descripción
Bot de moderación de chat anti-spoilers para YouTube Live y TikTok Live. Detecta y elimina mensajes que contienen spoilers de videojuegos en tiempo real.

## Stack Tecnológico
- **Runtime:** Node.js v18+ con ES Modules (type: "module")
- **YouTube API:** googleapis (YouTube Data API v3, OAuth2)
- **TikTok:** tiktok-live-connector (WebSocket, no oficial)
- **IA (opcional):** OpenAI API (gpt-4o-mini)
- **Utilidades:** chalk (colores), node-notifier (alertas escritorio), dotenv (env vars)

## Estructura de Archivos
- `config/` — Configuración centralizada (carga desde .env)
- `data/` — Base de datos de spoilers en JSON (editable en caliente)
- `src/bots/` — Bots por plataforma (youtube-live.js, tiktok-live.js)
- `src/detection/` — Motor de detección de spoilers (reglas + IA)
- `src/utils/` — Utilidades compartidas (logger, notifier, CLI tools)
- `src/index.js` — Orquestador principal con menú interactivo

## Convenciones de Código
- Usar ES Modules (import/export), NUNCA CommonJS (require)
- Clases con JSDoc para tipado
- Nombrar archivos en kebab-case
- Funciones asíncronas con async/await (nunca callbacks anidados)
- Manejo de errores con try/catch y mensajes descriptivos en español
- Los logs usan emojis para identificar rápidamente el tipo de evento

## Base de Datos de Spoilers (data/spoilers.json)
- Cada juego tiene un slug como key (kebab-case)
- Los campos son: name, active, releaseDate, keywords, partialMatch, characters, contextPhrases, safeWords
- Solo los juegos con `"active": true` se procesan
- El template no debe activarse nunca
- Las keywords deben ser frases exactas en minúsculas
- Los personajes van en minúsculas sin títulos

## Motor de Detección
- 4 niveles de scoring: exact_keyword (1.0), partial_match (0.8), character_context (0.6-0.9), global_pattern (0.7-0.9)
- Safe words reducen el score (máximo -0.5)
- El threshold depende de la sensibilidad configurada (low: 0.8, medium: 0.5, high: 0.3)
- La normalización de mensajes elimina emojis, caracteres repetidos y normaliza espacios

## Reglas Importantes
- NUNCA almacenar credenciales en el código (siempre .env)
- Los bots deben manejar desconexiones y reconectar automáticamente
- Las notificaciones de escritorio son opcionales (respetar configuración)
- El bot de TikTok NO puede eliminar mensajes (limitación de la plataforma), solo alertar
- El bot de YouTube SÍ puede eliminar mensajes y aplicar timeout
- No moderar mensajes de moderadores ni del dueño del canal
- Ignorar mensajes menores a 5 caracteres
- El comando `reload` recarga la base de datos sin reiniciar los bots

## Testing
- `npm run test-detection` ejecuta pruebas predefinidas del motor de detección
- Al agregar keywords, verificar que no generen falsos positivos con mensajes comunes
- Los safe words existen para prevenir falsos positivos

## Flujo de Agregar un Juego
1. Usar `npm run add-game` (CLI interactivo) o editar `data/spoilers.json` directamente
2. Activar con `"active": true`
3. Escribir `reload` en la consola del bot (o reiniciar)
4. Verificar con `npm run test-detection` que no rompa detección existente
