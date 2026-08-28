# 🎮🛡️ Bot Anti-Spoilers para Lives

Bot de moderación de chat que detecta y elimina spoilers de videojuegos en **YouTube Live**, **TikTok Live**, **Twitch**, **Kick** y **Facebook Live** en tiempo real.

## ✨ Características

| Característica | YouTube | TikTok | Twitch | Kick | Facebook |
|---------------|:---:|:---:|:---:|:---:|:---:|
| Leer chat en tiempo real | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar mensajes automáticamente | ✅ | ❌ (limitación) | ✅ | ❌ (limitación) | ✅ |
| Ocultar mensajes | ❌ | ❌ | ❌ | ❌ | ✅ |
| Timeout/ban a reincidentes | ✅ | ❌ (solo alerta) | ✅ | ❌ (solo alerta) | ❌ |
| Notificaciones de escritorio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Detección por palabras clave | ✅ | ✅ | ✅ | ✅ | ✅ |
| Detección por contexto (IA) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Sistema de strikes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reconexión automática | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exportar filtros nativos | ❌ | ✅ | ❌ | ✅ | ❌ |

## 📁 Estructura del Proyecto

```
bot-anti-spoilers/
├── config/
│   └── default.js          # Configuración centralizada
├── data/
│   ├── spoilers.json       # Base de datos de spoilers por juego
│   └── README.md           # Documentación de la base de datos
├── docs/
│   └── CONFIGURACION.md    # Guía de configuración por plataforma
├── src/
│   ├── bots/
│   │   ├── youtube-live.js  # Bot de YouTube Live
│   │   ├── tiktok-live.js   # Bot de TikTok Live
│   │   ├── twitch-live.js   # Bot de Twitch Live
│   │   ├── kick-live.js     # Bot de Kick Live
│   │   └── facebook-live.js # Bot de Facebook Live
│   ├── detection/
│   │   ├── spoiler-detector.js  # Motor de detección por reglas
│   │   └── ai-detector.js       # Detector complementario con IA (opcional)
│   ├── utils/
│   │   ├── logger.js       # Logger con colores y archivo
│   │   ├── notifier.js     # Notificaciones de escritorio
│   │   ├── add-game.js     # CLI para agregar juegos
│   │   └── test-detection.js # Pruebas del detector
│   └── index.js            # Orquestador principal
├── .env.example            # Template de variables de entorno
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Instalación

### Requisitos previos
- **Node.js** v18 o superior
- Cuenta de **Google Cloud** (para YouTube)
- Cuenta de **TikTok** (para TikTok)
- Cuenta de **Twitch** (para Twitch)
- Cuenta de **Kick** (para Kick)
- App de **Meta for Developers** + Página (para Facebook)

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/bot-anti-spoilers.git
cd bot-anti-spoilers

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales (ver sección de configuración)

# 4. Ejecutar
npm start
```

## ⚙️ Configuración

Para la guía completa de configuración de cada plataforma, ver [docs/CONFIGURACION.md](docs/CONFIGURACION.md).

### Resumen rápido

| Plataforma | Configuración necesaria |
|---|---|
| YouTube | Client ID + Secret + Refresh Token + Channel ID (OAuth2) |
| TikTok | Solo username |
| Twitch | Bot username + OAuth token + canal |
| Kick | Solo username |
| Facebook | Page ID + Page Access Token (Meta app + permisos) |

### YouTube Live (Configuración de Google Cloud)

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la **YouTube Data API v3**
4. Ve a **Credenciales** → **Crear credenciales** → **ID de cliente OAuth 2.0**
5. Tipo de aplicación: **Aplicación web**
6. URIs de redirección autorizadas:
   - `http://localhost:3000/oauth2callback`
   - `https://developers.google.com/oauthplayground`
7. Copia el `Client ID` y `Client Secret` a tu `.env`

#### Obtener el Refresh Token

```bash
# Usa OAuth2 Playground de Google:
# https://developers.google.com/oauthplayground/
#
# 1. ⚙️ → Marcar "Use your own OAuth credentials" → pegar Client ID y Secret
# 2. Seleccionar scope: https://www.googleapis.com/auth/youtube.force-ssl
# 3. Authorize APIs → autorizar con tu cuenta
# 4. Exchange authorization code for tokens → copiar refresh_token
```

#### Encontrar tu Channel ID

- YouTube Studio → Configuración → Canal → Información básica
- Formato: `UCxxxxxxxxxxxxxxxxxx`

### TikTok Live

Solo el username (sin @):

```env
TIKTOK_USERNAME=tu_username
```

> No necesitas credenciales de API. Se conecta al live público vía WebSocket.

### Twitch Live

1. Obtener OAuth token en [twitchapps.com/tmi](https://twitchapps.com/tmi/)
2. La cuenta bot debe ser moderador del canal (`/mod nombre_bot`)

```env
TWITCH_BOT_USERNAME=tu_bot_username
TWITCH_OAUTH_TOKEN=oauth:tu_token_aqui
TWITCH_CHANNEL=tu_canal
```

### Kick Live

Solo el username:

```env
KICK_USERNAME=tu_username_kick
```

> No necesitas credenciales. Se conecta al live público vía WebSocket.
> **Nota:** Kick tiene una [API oficial](https://github.com/KickEngineering/KickDevDocs) con OAuth 2.1 que permitiría moderación completa, pero requiere aprobación como desarrollador.

### Facebook Live

1. Crear una App en [Meta for Developers](https://developers.facebook.com/)
2. Los lives deben ser en una **Página** (no perfil personal)
3. Obtener el **Page Access Token** con permisos `pages_read_engagement`, `pages_manage_engagement`, `pages_read_user_content`

```env
FACEBOOK_PAGE_ID=tu_page_id
FACEBOOK_PAGE_ACCESS_TOKEN=tu_page_access_token
FACEBOOK_SPOILER_ACTION=hide
```

> `FACEBOOK_SPOILER_ACTION` puede ser `hide` (oculta, reversible) o `delete` (elimina permanente).
> Para producción con usuarios externos, Meta requiere revisión de la app. Ver [docs/CONFIGURACION.md](docs/CONFIGURACION.md) para el detalle.

### Detección con IA (Opcional)

Si quieres usar detección contextual con OpenAI:

1. Obtén una API key en [platform.openai.com](https://platform.openai.com/)
2. Configura en `.env`:
```env
USE_AI_DETECTION=true
OPENAI_API_KEY=sk-tu-api-key
```

## 📖 Uso

### Menú interactivo

```bash
npm start
```

Muestra un menú donde seleccionas plataformas separadas por coma:
```
1) YouTube  2) TikTok  3) Twitch  4) Kick  5) Facebook

→ Plataformas: 1,3       (YouTube + Twitch)
→ Plataformas: all       (todas)
→ Plataformas: 2,5       (TikTok + Facebook)
```

### Ejecución directa

```bash
npm run youtube     # Solo YouTube
npm run tiktok      # Solo TikTok
npm run twitch      # Solo Twitch
npm run kick        # Solo Kick
npm run facebook    # Solo Facebook
npm run all         # Todas las plataformas

# También con flags:
node src/index.js --youtube
node src/index.js --facebook
node src/index.js --both    # YouTube + TikTok
node src/index.js --all     # Todas
```

### Comandos durante la ejecución

Mientras el bot está corriendo, puedes escribir:

| Comando | Descripción |
|---------|-------------|
| `stats` | Ver estadísticas en tiempo real |
| `reload` | Recargar base de datos de spoilers (sin reiniciar) |
| `export` | Exportar lista de filtros para TikTok/Kick |
| `stop` | Detener los bots y salir |

### Probar el detector

```bash
npm run test-detection
```

Ejecuta una serie de mensajes de prueba y muestra los resultados.

### Agregar un juego nuevo

```bash
npm run add-game
```

CLI interactivo para agregar un juego a la base de datos.

## 🎯 Cómo funciona la detección

El motor analiza cada mensaje en 4 niveles:

### Nivel 1: Keywords exactas (score = 1.0)
Frases exactas que son spoilers confirmados.
```
"lucia muere al final" → 🚨 SPOILER (score: 1.0)
```

### Nivel 2: Partial Match (score = 0.8)
Frases que sugieren spoiler por su inicio.
```
"el final es que..." → 🚨 SPOILER (score: 0.8)
```

### Nivel 3: Personaje + Contexto (score = 0.6-0.9)
Si un nombre de personaje aparece junto a un verbo de spoiler.
```
"jason" + "traiciona" → 🚨 SPOILER (score: 0.7)
```

### Nivel 4: Patrones globales (score = 0.7-0.9)
Frases genéricas que aplican a cualquier juego.
```
"te spoileo" → 🚨 SPOILER (score: 0.7)
```

### Safe Words (reducción de score)
Palabras que reducen la probabilidad de spoiler:
```
"lucia gameplay es genial" → ✅ SEGURO (safe word: "gameplay")
```

### Sensibilidad

Configura en `.env` con `DETECTION_SENSITIVITY`:

| Nivel | Threshold | Descripción |
|-------|-----------|-------------|
| `low` | 0.8 | Solo spoilers muy evidentes |
| `medium` | 0.5 | Balance entre detección y falsos positivos |
| `high` | 0.3 | Agresivo, puede dar falsos positivos |

## 🔧 Personalización

### Agregar spoilers de un juego nuevo

Edita `data/spoilers.json` y agrega un bloque:

```json
{
  "mi-juego": {
    "name": "Mi Juego Nuevo",
    "active": true,
    "releaseDate": "2026-01-01",
    "keywords": ["frase exacta de spoiler"],
    "partialMatch": ["inicio de frase spoiler"],
    "characters": ["protagonista", "villano"],
    "contextPhrases": ["muere", "traiciona", "es el villano"],
    "safeWords": ["gameplay", "trailer"]
  }
}
```

Luego escribe `reload` en la consola del bot para aplicar los cambios sin reiniciar.

### Cambiar acciones de moderación

En `.env`:
```env
# Acción al detectar spoiler en YouTube:
YOUTUBE_SPOILER_ACTION=delete   # delete | hide | warn

# Mensaje de advertencia:
SEND_WARNING_MESSAGE=true
WARNING_MESSAGE=⚠️ Spoiler detectado y eliminado.

# Timeout después de 3 strikes (segundos):
YOUTUBE_TIMEOUT_SECONDS=300
```

## 📊 Logs

Los logs se guardan en `./logs/` con formato `YYYY-MM-DD.log`:

```
[2026-08-26T15:30:00.000Z] [INFO] 🤖 Bot Anti-Spoilers ACTIVO
[2026-08-26T15:30:05.123Z] 🚨 SPOILER DETECTADO | Usuario: troll123 | Juego: GTA VI | Score: 0.95
[2026-08-26T15:30:05.456Z] [INFO] 🗑️ Mensaje eliminado de troll123 (strike 1)
```

## ⚠️ Limitaciones

### TikTok
- **No se pueden eliminar mensajes** vía API (limitación de la plataforma)
- El bot solo puede alertar al streamer con notificaciones
- Usa los **filtros nativos de TikTok** como complemento (comando `export`)
- La librería `tiktok-live-connector` no es oficial y puede dejar de funcionar

### YouTube
- Requiere autenticación OAuth2 (setup inicial más complejo)
- Rate limits de la API pueden causar delay de 2-5 segundos
- El timeout requiere el channelId del usuario (limitación de la API)

### Twitch
- La cuenta bot debe ser moderador del canal para eliminar mensajes
- OAuth token debe renovarse si expira

### Kick
- **No se pueden eliminar mensajes** (librería de solo lectura)
- El bot solo puede alertar al streamer con notificaciones
- La librería `kick-live-connector` no es oficial
- API oficial de Kick (OAuth 2.1) requiere aprobación como desarrollador

### Facebook
- Los lives deben ser en una **Página**, no en un perfil personal
- El Page Access Token expira (usar token de larga duración o System User)
- Para producción con usuarios externos, Meta requiere revisión de la app (App Review)
- No hay timeout/ban vía API en lives (solo eliminar u ocultar comentarios)

### General
- La detección por reglas depende de que la base de datos esté actualizada
- La detección con IA tiene un costo por mensaje (OpenAI API, ~$0.00007/consulta)
- Usuarios pueden evadir con errores tipográficos creativos

## 🤝 Contribuir

1. Agrega juegos nuevos a `data/spoilers.json`
2. Mejora los patrones de detección
3. Reporta falsos positivos/negativos
4. Sugiere nuevas funcionalidades

## 👤 Autor

**Ing. Uriel Rodriguez A.**

## 🚀 Deploy

Para desplegar el bot en un servidor 24/7, ver [docs/DEPLOY.md](docs/DEPLOY.md) (guía para Fly.io).

## 📄 Licencia

MIT
