# 📂 Base de Datos de Spoilers

Este directorio contiene la base de datos de spoilers que el bot utiliza para detectar mensajes en el chat.

## Estructura de `spoilers.json`

### Cada juego tiene:

| Campo | Descripción |
|-------|-------------|
| `name` | Nombre completo del juego |
| `active` | Si está activo para detección (`true/false`) |
| `releaseDate` | Fecha de lanzamiento (para referencia) |
| `keywords` | Frases **exactas** que se consideran spoiler (match directo) |
| `partialMatch` | Inicios de frase que **sugieren** spoiler |
| `characters` | Nombres de personajes del juego |
| `contextPhrases` | Verbos/frases que combinados con personajes = spoiler |
| `safeWords` | Palabras que si están presentes, el mensaje NO es spoiler |

### Lógica de detección:

1. **keywords** → Match exacto = SPOILER inmediato
2. **partialMatch** → Si el mensaje empieza con una de estas frases = SPOILER
3. **characters + contextPhrases** → Si un personaje + frase de contexto aparecen juntos = PROBABLE SPOILER
4. **safeWords** → Si están presentes, se reduce la puntuación de spoiler

## Cómo agregar un juego nuevo

1. Copia el bloque `"template"` en `spoilers.json`
2. Cambia la key por un slug del juego (ej: `"elden-ring-dlc"`)
3. Llena los campos con la info del juego
4. Pon `"active": true`
5. Reinicia el bot

O usa el comando: `npm run add-game`

## Patrones globales

Los `globalPatterns` se aplican a **todos los juegos activos** y detectan frases genéricas de spoiler que no dependen del juego específico.
