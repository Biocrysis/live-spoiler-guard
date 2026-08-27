# Guía de Deploy en Fly.io

Guía para desplegar el Bot Anti-Spoilers en Fly.io (hosting gratuito, proceso 24/7).

---

## Requisitos previos

- Cuenta en [fly.io](https://fly.io) (requiere tarjeta de crédito, no cobra si estás en el free tier)
- CLI de Fly.io instalado (`flyctl`)

---

## 1. Instalar flyctl

### Windows (PowerShell)
```powershell
irm https://fly.io/install.ps1 | iex
```

### Mac/Linux
```bash
curl -L https://fly.io/install.sh | sh
```

Verificar instalación:
```bash
fly version
```

---

## 2. Login

```bash
fly auth login
```

Se abre el navegador para autenticar tu cuenta.

---

## 3. Primer deploy (fly launch)

Desde la carpeta raíz del proyecto:

```bash
fly launch
```

Te va a preguntar:
- **App name:** `bot-anti-spoilers` (o el que quieras)
- **Region:** Elegir la más cercana a ti (ej: `mia` para Miami/LATAM)
- **Crear base de datos:** No
- **Deploy ahora:** No (primero configurar secrets)

---

## 4. Configurar variables de entorno (secrets)

Las credenciales se configuran como secrets en Fly.io (nunca se suben al código):

```bash
# YouTube
fly secrets set YOUTUBE_CLIENT_ID=tu_client_id
fly secrets set YOUTUBE_CLIENT_SECRET=tu_client_secret
fly secrets set YOUTUBE_REFRESH_TOKEN=tu_refresh_token
fly secrets set YOUTUBE_CHANNEL_ID=tu_channel_id
fly secrets set YOUTUBE_SPOILER_ACTION=delete
fly secrets set YOUTUBE_TIMEOUT_SECONDS=300

# TikTok
fly secrets set TIKTOK_USERNAME=tu_username

# Twitch
fly secrets set TWITCH_BOT_USERNAME=tu_bot_username
fly secrets set TWITCH_OAUTH_TOKEN=oauth:tu_token
fly secrets set TWITCH_CHANNEL=tu_canal
fly secrets set TWITCH_SPOILER_ACTION=delete
fly secrets set TWITCH_TIMEOUT_SECONDS=300

# Kick
fly secrets set KICK_USERNAME=tu_username_kick

# Bot behavior
fly secrets set SEND_WARNING_MESSAGE=true
fly secrets set WARNING_MESSAGE="⚠️ Mensaje eliminado por posible spoiler."
fly secrets set DESKTOP_NOTIFICATIONS=false
fly secrets set SOUND_ALERTS=false

# Detección
fly secrets set DETECTION_SENSITIVITY=medium
fly secrets set USE_AI_DETECTION=true
fly secrets set OPENAI_API_KEY=sk-tu-key

# Logging
fly secrets set LOG_LEVEL=info
fly secrets set SAVE_LOGS=false
```

> **Nota:** `DESKTOP_NOTIFICATIONS` y `SOUND_ALERTS` deben ser `false` en el servidor (no hay escritorio).
> **Nota:** `SAVE_LOGS=false` porque el filesystem de Fly.io es efímero (se borra al reiniciar). Si querés logs persistentes, considera agregar un volumen.

---

## 5. Deploy

```bash
fly deploy
```

Esto construye la imagen Docker y la despliega. Tarda 1-2 minutos la primera vez.

---

## 6. Verificar que funciona

### Ver logs en tiempo real
```bash
fly logs
```

### Ver estado de la app
```bash
fly status
```

### Ver secrets configurados (solo nombres, no valores)
```bash
fly secrets list
```

---

## 7. Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `fly logs` | Ver logs en tiempo real |
| `fly status` | Estado de la app |
| `fly deploy` | Redesplegar (después de cambios) |
| `fly secrets set KEY=value` | Agregar/actualizar variable de entorno |
| `fly secrets unset KEY` | Eliminar variable |
| `fly apps restart` | Reiniciar la app |
| `fly apps destroy bot-anti-spoilers` | Eliminar la app |
| `fly scale count 0` | Pausar la app (dejar de gastar créditos) |
| `fly scale count 1` | Reanudar la app |

---

## 8. Costos (Free Tier)

Fly.io otorga **$5 USD/mes de crédito gratuito**. Tu bot consume:

- **VM shared-cpu-1x, 256MB RAM:** ~$1.94/mes
- **Total estimado:** Cabe cómodamente en el free tier

Si querés pausar el bot cuando no estés streameando para ahorrar créditos:
```bash
fly scale count 0   # Pausar
fly scale count 1   # Reanudar
```

---

## 9. Actualizar el bot

Cuando hagas cambios en el código:

```bash
# 1. Commit tus cambios
git add . && git commit -m "feat: mis cambios"

# 2. Redesplegar
fly deploy
```

---

## 10. Elegir qué plataformas activar

Por defecto el `fly.toml` usa `--all` (todas las plataformas). Si solo querés algunas, editá el `fly.toml`:

```toml
[processes]
  app = "node src/index.js --youtube"         # Solo YouTube
  app = "node src/index.js --twitch"          # Solo Twitch
  app = "node src/index.js --all"             # Todas (default)
```

O usá flags combinados pasando el CLI arg en el Dockerfile.

---

## Troubleshooting

### El bot se reinicia constantemente
- Verificar logs: `fly logs`
- Probable causa: falta algún secret (variable de entorno)
- Solución: `fly secrets list` y verificar que estén todas

### Rate limit de YouTube (403)
- Normal si el polling es muy frecuente
- El bot ya maneja esto (espera 30s y reintenta)
- No requiere acción

### TikTok/Kick no conecta
- El streamer debe estar en vivo
- Si no hay live activo, el bot lanza error y lo reporta en logs

### Cambiar región
```bash
fly apps destroy bot-anti-spoilers
fly launch   # Elegir nueva región
```
