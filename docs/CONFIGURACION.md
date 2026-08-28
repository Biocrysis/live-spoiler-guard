# Guía de Configuración por Plataforma

Esta guía explica paso a paso cómo configurar cada plataforma para el Bot Anti-Spoilers.

---

## YouTube Live

### Capacidades
- Leer chat en tiempo real (polling)
- Eliminar mensajes automáticamente
- Aplicar timeout a reincidentes
- Enviar mensajes de advertencia

### Requisitos
- Cuenta de Google con un canal de YouTube
- Proyecto en Google Cloud Console
- YouTube Data API v3 habilitada

### Paso 1: Crear proyecto en Google Cloud

1. Ir a [console.cloud.google.com](https://console.cloud.google.com/)
2. Crear un nuevo proyecto (o usar uno existente)
3. Ir a **APIs y servicios** → **Biblioteca**
4. Buscar **YouTube Data API v3** → **Habilitar**

### Paso 2: Crear credenciales OAuth 2.0

1. Ir a **APIs y servicios** → **Credenciales**
2. Click en **Crear credenciales** → **ID de cliente OAuth**
3. Si pide pantalla de consentimiento, configurarla primero:
   - Tipo: Externo
   - Nombre de la app: Bot Anti-Spoilers (o cualquier nombre)
   - Agregar scope: `youtube.force-ssl`
4. Tipo de aplicación: **Aplicación web**
5. Nombre: lo que quieras
6. URI de redirección autorizada: agregar estas dos:
   - `http://localhost:3000/oauth2callback`
   - `https://developers.google.com/oauthplayground`
7. Click **Crear**
8. Copiar el **Client ID** y **Client Secret**

### Paso 3: Obtener Refresh Token

1. Ir a [OAuth2 Playground](https://developers.google.com/oauthplayground/)
2. Click en ⚙️ (engranaje, arriba derecha)
3. Marcar ✅ **"Use your own OAuth credentials"**
4. Pegar tu Client ID y Client Secret
5. En el panel izquierdo buscar **YouTube Data API v3 v3**
6. Seleccionar scope: `https://www.googleapis.com/auth/youtube.force-ssl`
7. Click **"Authorize APIs"** → autorizar con tu cuenta Google
8. Click **"Exchange authorization code for tokens"**
9. Copiar el valor de `refresh_token`

### Paso 4: Obtener Channel ID

- Ir a [YouTube Studio](https://studio.youtube.com/)
- Configuración → Canal → Información básica
- El ID tiene formato: `UCxxxxxxxxxxxxxxxxxx`

### Paso 5: Configurar .env

```env
YOUTUBE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
YOUTUBE_CLIENT_SECRET=GOCSPX-tu_secret
YOUTUBE_REDIRECT_URI=http://localhost:3000/oauth2callback
YOUTUBE_REFRESH_TOKEN=1//tu_refresh_token
YOUTUBE_CHANNEL_ID=UCxxxxxxxxxxxxxxxxxx
YOUTUBE_SPOILER_ACTION=delete
YOUTUBE_TIMEOUT_SECONDS=300
```

### Opciones de YOUTUBE_SPOILER_ACTION
- `delete` — Elimina el mensaje del chat
- `hide` — Oculta el mensaje (mismo efecto que delete)
- `warn` — Solo envía advertencia sin eliminar

### Ejecutar
```bash
npm run youtube
# o
npm start → opción 1
```

---

## TikTok Live

### Capacidades
- Leer chat en tiempo real (WebSocket)
- Detectar spoilers
- Notificación de escritorio al streamer
- Registrar usuarios problemáticos
- Exportar lista de filtros para TikTok nativo
- **NO puede eliminar mensajes** (limitación de la plataforma)

### Requisitos
- Solo el username del streamer
- El streamer debe estar en vivo para que el bot se conecte

### Paso 1: Configurar .env

```env
TIKTOK_USERNAME=tu_username
```

Solo eso. Sin @, sin credenciales extra. La librería se conecta al live público.

### Limitaciones
- No se pueden eliminar mensajes vía API
- No se puede banear usuarios vía API
- Solo funciona mientras el streamer está en vivo
- La librería `tiktok-live-connector` no es oficial y puede dejar de funcionar

### Complemento: Filtros nativos de TikTok

El bot puede exportar una lista de palabras para importar en los filtros nativos de TikTok:

1. Ejecutar el bot o desde el menú elegir **"Exportar filtros"**
2. O escribir `export` mientras el bot está corriendo
3. Copiar la lista generada
4. En TikTok: **Configuración de Live** → **Filtro de palabras clave** → Pegar

### Ejecutar
```bash
npm run tiktok
# o
npm start → opción 2
```

---

## Twitch Live

### Capacidades
- Leer chat en tiempo real (IRC/WebSocket)
- Eliminar mensajes automáticamente
- Aplicar timeout a reincidentes
- Enviar mensajes de advertencia
- Reconexión automática
- Ignora moderadores, broadcaster, VIPs y comandos (!)

### Requisitos
- Una cuenta de Twitch (puede ser tu misma cuenta o una cuenta bot dedicada)
- OAuth token con permisos de moderador
- La cuenta bot debe ser moderador del canal

### Paso 1: Obtener OAuth Token

**Opción rápida (twitchapps):**
1. Ir a [twitchapps.com/tmi](https://twitchapps.com/tmi/)
2. Autorizar con tu cuenta de Twitch
3. Copiar el token (formato: `oauth:xxxxxxxxxxxxxxxxxx`)

**Opción avanzada (Twitch Developer Console):**
1. Ir a [dev.twitch.tv/console](https://dev.twitch.tv/console)
2. Registrar aplicación
3. Generar token con scopes: `chat:read`, `chat:edit`, `channel:moderate`

### Paso 2: Hacer moderador al bot

Si usás una cuenta separada como bot, el broadcaster debe ejecutar en su chat:
```
/mod nombre_del_bot
```

Si usás tu propia cuenta de broadcaster, ya tenés permisos.

### Paso 3: Configurar .env

```env
TWITCH_BOT_USERNAME=tu_bot_username
TWITCH_OAUTH_TOKEN=oauth:tu_token_aqui
TWITCH_CHANNEL=tu_canal
TWITCH_SPOILER_ACTION=delete
TWITCH_TIMEOUT_SECONDS=300
```

### Campos explicados
- `TWITCH_BOT_USERNAME` — Username de la cuenta que enviará mensajes (puede ser tu cuenta)
- `TWITCH_OAUTH_TOKEN` — Token OAuth con prefijo `oauth:`
- `TWITCH_CHANNEL` — Nombre del canal a monitorear (sin #)
- `TWITCH_SPOILER_ACTION` — `delete` (elimina) o `warn` (solo advierte)
- `TWITCH_TIMEOUT_SECONDS` — Duración del timeout tras 3 strikes (0 = desactivado)

### Ejecutar
```bash
npm run twitch
# o
npm start → opción 4
```

---

## Kick Live

### Capacidades
- Leer chat en tiempo real (WebSocket)
- Detectar spoilers
- Notificación de escritorio al streamer
- Registrar usuarios problemáticos
- Generar lista de palabras para importar en filtros nativos de Kick
- **NO puede eliminar mensajes** (limitación de la librería, solo lectura)

### Requisitos
- Solo el username del streamer en Kick
- El streamer debe estar en vivo para que el bot se conecte

### Paso 1: Configurar .env

```env
KICK_USERNAME=tu_username_kick
```

Solo eso. Sin credenciales. La librería `kick-live-connector` se conecta al live público vía WebSocket.

### Limitaciones
- No se pueden eliminar mensajes (librería de solo lectura)
- No se puede banear usuarios vía la librería
- Solo funciona mientras el streamer está en vivo
- La librería `kick-live-connector` no es oficial y puede dejar de funcionar si Kick cambia su protocolo

### Nota: API Oficial de Kick
Kick tiene una [API oficial](https://github.com/KickEngineering/KickDevDocs) con OAuth 2.1 que permitiría moderación completa (eliminar mensajes, banear usuarios). Sin embargo, requiere registro como desarrollador y aprobación. Si en el futuro se obtiene acceso, el bot puede ser actualizado para usar la API oficial y tener las mismas capacidades que YouTube/Twitch.

### Complemento: Filtros nativos de Kick

El bot puede exportar una lista de palabras para importar en los filtros nativos de Kick:

1. Escribir `export` mientras el bot está corriendo
2. Copiar la lista generada
3. En Kick: **Configuración del canal** → **Moderación** → **Palabras bloqueadas** → Pegar

### Ejecutar
```bash
npm run kick
# o
npm start → opción 4
```

> En el menú interactivo puedes seleccionar varias plataformas separadas por coma (ej: `1,4`) o escribir `all` para todas.

---

## Facebook Live

### Capacidades
- Leer comentarios del live en tiempo real (polling vía Graph API)
- Eliminar u ocultar comentarios automáticamente
- Enviar advertencias
- Detección por reglas + IA
- Sistema de strikes

### Requisitos
- Una **App** en Meta for Developers
- Una **Página de Facebook** (los lives deben ser en una Page, no en perfil personal)
- **Page Access Token** con permisos de moderación
- Para producción, Meta debe aprobar los permisos (proceso de revisión)

### Paso 1: Crear App en Meta for Developers

1. Ir a [developers.facebook.com](https://developers.facebook.com/)
2. **Mis Apps** → **Crear App**
3. Tipo de app: **Empresa** (Business)
4. Agregar el producto **Facebook Login** o **Graph API**

### Paso 2: Obtener el Page ID

1. Ir a tu Página de Facebook
2. **Configuración** → **Información de la página** → **ID de la página**
3. O usar el [Graph API Explorer](https://developers.facebook.com/tools/explorer/) con la query `/me/accounts`

### Paso 3: Obtener el Page Access Token

1. Ir a [Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Seleccionar tu app
3. En **Permisos**, agregar:
   - `pages_read_engagement` (leer comentarios)
   - `pages_manage_engagement` (ocultar/eliminar comentarios)
   - `pages_read_user_content`
4. Generar el token de usuario
5. Intercambiar por un **Page Access Token** (query `/me/accounts` devuelve tokens por página)
6. Recomendado: convertir a **token de larga duración** (dura ~60 días) o usar un System User token para producción

### Paso 4: Configurar .env

```env
FACEBOOK_PAGE_ID=tu_page_id
FACEBOOK_PAGE_ACCESS_TOKEN=tu_page_access_token
FACEBOOK_SPOILER_ACTION=hide
FACEBOOK_POLL_INTERVAL=5000
```

### Campos explicados
- `FACEBOOK_PAGE_ID` — ID numérico de tu página
- `FACEBOOK_PAGE_ACCESS_TOKEN` — Token de acceso de la página con permisos de moderación
- `FACEBOOK_SPOILER_ACTION` — `hide` (oculta, reversible) o `delete` (elimina permanentemente)
- `FACEBOOK_POLL_INTERVAL` — Milisegundos entre consultas de comentarios (default 5000)

### Limitaciones
- Los lives deben ser en una **Página**, no en un perfil personal
- El Page Access Token expira (usar token de larga duración o System User)
- Para uso en producción con usuarios externos, Meta requiere revisión de la app (App Review)
- En modo desarrollo funciona solo con tu propia página y cuentas de prueba

### Nota sobre `hide` vs `delete`
- `hide` — Oculta el comentario para los demás pero el autor lo sigue viendo (menos conflictivo, reversible)
- `delete` — Elimina el comentario permanentemente

### Ejecutar
```bash
npm run facebook
# o
npm start → opción 5
```

---

## Configuración Compartida (Todas las plataformas)

Estas opciones aplican a todos los bots:

### Comportamiento del bot

```env
# Enviar mensaje de advertencia al detectar spoiler
SEND_WARNING_MESSAGE=true

# Mensaje personalizado
WARNING_MESSAGE=⚠️ Mensaje eliminado por posible spoiler. Por favor respeta a quienes no han terminado el juego.

# Notificaciones de escritorio
DESKTOP_NOTIFICATIONS=true

# Sonido de alerta
SOUND_ALERTS=true
```

### Detección

```env
# Sensibilidad: low (solo obvios) | medium (balanceado) | high (agresivo)
DETECTION_SENSITIVITY=medium

# Usar IA como complemento (requiere OpenAI API key)
USE_AI_DETECTION=true

# API key de OpenAI (solo si USE_AI_DETECTION=true)
OPENAI_API_KEY=sk-tu-key
```

### Niveles de sensibilidad

| Nivel | Threshold | Comportamiento |
|-------|-----------|----------------|
| `low` | 0.8 | Solo spoilers muy evidentes (keywords exactas) |
| `medium` | 0.5 | Balance entre detección y falsos positivos |
| `high` | 0.3 | Agresivo, puede dar falsos positivos |

### Logging

```env
# Nivel: debug | info | warn | error
LOG_LEVEL=info

# Guardar logs en archivo (./logs/)
SAVE_LOGS=true
```

---

## Ejecución Múltiple

### Todas las plataformas a la vez
```bash
npm run all
# o
npm start → escribir "all"
```

### Combinaciones desde CLI
```bash
node src/index.js --youtube    # Solo YouTube
node src/index.js --tiktok     # Solo TikTok
node src/index.js --twitch     # Solo Twitch
node src/index.js --kick       # Solo Kick
node src/index.js --facebook   # Solo Facebook
node src/index.js --both       # YouTube + TikTok
node src/index.js --all        # Todas
```

### Comandos en runtime
Mientras el bot está corriendo, escribí en la consola:

| Comando | Descripción |
|---------|-------------|
| `stats` | Ver estadísticas de todos los bots activos |
| `reload` | Recargar base de datos de spoilers (sin reiniciar) |
| `export` | Exportar filtros para TikTok/Kick |
| `stop` | Detener todos los bots y salir |

---

## Resumen de Capacidades

| Característica | YouTube | TikTok | Twitch | Kick | Facebook |
|---------------|:---:|:---:|:---:|:---:|:---:|
| Leer chat en tiempo real | ✅ | ✅ | ✅ | ✅ | ✅ |
| Detección por reglas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Detección con IA | ✅ | ✅ | ✅ | ✅ | ✅ |
| Eliminar mensajes | ✅ | ❌ | ✅ | ❌ | ✅ |
| Ocultar mensajes | ❌ | ❌ | ❌ | ❌ | ✅ |
| Timeout/ban | ✅ | ❌ | ✅ | ❌ | ❌ |
| Mensaje de advertencia | ✅ | ❌ | ✅ | ❌ | ❌ |
| Notificación escritorio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Reconexión automática | ✅ | ✅ | ✅ | ✅ | ✅ |
| Exportar filtros nativos | ❌ | ✅ | ❌ | ✅ | ❌ |
