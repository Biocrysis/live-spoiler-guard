# 🎮🛡️ Bot Anti-Spoilers para Lives

Bot de moderación de chat que detecta y elimina spoilers de videojuegos en **YouTube**, **TikTok**, **Twitch**, **Kick** y **Facebook** en tiempo real.

Combina un motor de detección por reglas (palabras clave, personajes, patrones) con detección contextual opcional por IA (OpenAI).

## ✨ Características

| Característica | YouTube | TikTok | Twitch | Kick | Facebook |
|---------------|:---:|:---:|:---:|:---:|:---:|
| Leer chat en tiempo real | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar mensajes | ✅ | ❌ | ✅ | ❌ | ✅ |
| Ocultar mensajes | ❌ | ❌ | ❌ | ❌ | ✅ |
| Timeout/ban a reincidentes | ✅ | ❌ | ✅ | ❌ | ❌ |
| Notificaciones de escritorio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Detección por reglas + IA | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sistema de strikes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reconexión automática | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exportar filtros nativos | ❌ | ✅ | ❌ | ✅ | ❌ |

> En TikTok y Kick la plataforma no permite eliminar mensajes vía API, así que el bot solo alerta y registra. Ver [Limitaciones](#️-limitaciones).

## 🚀 Instalación

```bash
git clone https://github.com/tu-usuario/bot-anti-spoilers.git
cd bot-anti-spoilers
npm install
cp .env.example .env   # luego edita .env con tus credenciales
npm start
```

Requiere **Node.js v18+**.

## ⚙️ Configuración

Cada plataforma necesita sus propias credenciales en el archivo `.env`:

| Plataforma | Qué necesitas |
|---|---|
| YouTube | Client ID + Secret + Refresh Token + Channel ID (OAuth2) |
| TikTok | Username (+ API key de Euler Stream para leer el chat) |
| Twitch | Bot username + OAuth token + canal |
| Kick | Username |
| Facebook | Page ID + Page Access Token (app de Meta) |

**La guía paso a paso de cada plataforma está en 👉 [docs/CONFIGURACION.md](docs/CONFIGURACION.md).**

### Detección con IA (opcional)

```env
USE_AI_DETECTION=true
OPENAI_API_KEY=sk-tu-api-key
```

Usa `gpt-4o-mini` como respaldo cuando las reglas no son concluyentes. Solo consulta la IA en casos dudosos, por lo que el costo es mínimo.

## 📖 Uso

```bash
npm start
```

Selecciona plataformas separadas por coma, o `all` para todas:

```
1) YouTube  2) TikTok  3) Twitch  4) Kick  5) Facebook

→ Plataformas: 1,3    (YouTube + Twitch)
→ Plataformas: all    (todas)
```

También directo: `npm run youtube`, `npm run tiktok`, `npm run twitch`, `npm run kick`, `npm run facebook`, `npm run all`.

### Comandos durante la ejecución

| Comando | Descripción |
|---------|-------------|
| `stats` | Ver estadísticas en tiempo real |
| `reload` | Recargar base de datos de spoilers (sin reiniciar) |
| `export` | Exportar lista de filtros para TikTok/Kick |
| `stop` | Detener los bots y salir |

## 🎯 Cómo funciona la detección

El motor analiza cada mensaje en 4 niveles y le asigna un score:

| Nivel | Ejemplo | Score |
|-------|---------|:---:|
| Keyword exacta | `"lucia muere al final"` | 1.0 |
| Coincidencia parcial | `"el final es que..."` | 0.8 |
| Personaje + contexto | `"jason"` + `"traiciona"` | 0.6–0.9 |
| Patrón global | `"te spoileo"` | 0.7–0.9 |

Las **safe words** (ej: `gameplay`, `trailer`) reducen el score para evitar falsos positivos. Un mensaje se marca como spoiler si su score supera el umbral, que depende de la sensibilidad configurada (`low` / `medium` / `high`).

## 🔧 Agregar un juego

Edita `data/spoilers.json` (o usa `npm run add-game`) y agrega un bloque:

```json
{
  "mi-juego": {
    "name": "Mi Juego Nuevo",
    "active": true,
    "keywords": ["frase exacta de spoiler"],
    "partialMatch": ["inicio de frase spoiler"],
    "characters": ["protagonista", "villano"],
    "contextPhrases": ["muere", "traiciona", "es el villano"],
    "safeWords": ["gameplay", "trailer"]
  }
}
```

Luego escribe `reload` en la consola del bot para aplicar los cambios sin reiniciar. Verifica con `npm run test-detection` que no genere falsos positivos.

## 📦 Estructura

```
├── config/default.js       # Configuración centralizada
├── data/spoilers.json      # Base de datos de spoilers por juego
├── docs/                   # Guías de configuración y deploy
├── src/
│   ├── bots/               # Un bot por plataforma
│   ├── detection/          # Motor de reglas + detector IA
│   ├── utils/              # Logger, notifier, CLI tools
│   └── index.js            # Orquestador principal
```

## ⚠️ Limitaciones

- **TikTok y Kick:** la API no permite eliminar mensajes; el bot solo alerta y registra usuarios. Como complemento, exporta filtros nativos con el comando `export`.
- **YouTube:** rate limits de la API pueden agregar unos segundos de delay.
- **Facebook:** los lives deben ser en una Página; el token expira y producción requiere revisión de Meta.
- **General:** la detección depende de que la base de datos esté actualizada; los usuarios pueden intentar evadir con errores tipográficos.

Detalle completo en [docs/CONFIGURACION.md](docs/CONFIGURACION.md).

## 📚 Más documentación

- [Guía de configuración por plataforma](docs/CONFIGURACION.md)
- [Guía de deploy (Fly.io)](docs/DEPLOY.md)
- [Roadmap de mejoras](ROADMAP.md)

## 👤 Autor

**Ing. Uriel Rodriguez A.**

## 📄 Licencia

MIT
