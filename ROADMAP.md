# Roadmap - Mejoras Futuras

Mejoras planificadas para después de validar funcionamiento base.

| # | Mejora | Prioridad | Descripción |
|---|--------|-----------|-------------|
| 1 | Script de OAuth2 | Alta | Helper para obtener refresh token de YouTube sin ir al Playground manual |
| 2 | API oficial de Kick | Alta | Migrar a API con OAuth 2.1 para eliminar mensajes y timeout en Kick |
| 3 | Dashboard web | Media | Panel en navegador para ver estadísticas en tiempo real |
| 4 | Hot-reload con watcher | Media | Detectar cambios en spoilers.json y recargar automáticamente |
| 5 | Integración con Discord | Media | Alertar en un canal de Discord cuando se detecta spoiler |
| 6 | Base de datos en SQLite | Baja | Para historial de spoilers y estadísticas persistentes |
| 7 | Soporte multi-idioma | Baja | Detectar spoilers en inglés + español |
| 8 | Docker | Baja | Para correrlo en un servidor 24/7 |

---

## Investigación de APIs oficiales por plataforma

### Kick — Viable

- API oficial pública disponible en [dev.kick.com](https://dev.kick.com/)
- Autenticación: OAuth 2.1 con PKCE
- Endpoints de moderación: eliminar mensajes, ban, timeout, chat
- Registro gratuito en Developer Portal
- Librería JS existente: [KickTools/kick-api](https://github.com/KickTools/kick-api)
- **Acción:** Registrarse en dev.kick.com, crear app, obtener acceso y migrar el bot para moderación completa

### TikTok — No viable (a agosto 2026)

- TikTok **NO tiene API pública para moderar el chat de lives**
- La API oficial solo cubre: videos, portabilidad de datos, research (solo académicos)
- No existe endpoint para eliminar mensajes en live ni hacer timeout
- La única forma de moderar es con los filtros nativos de TikTok o manualmente
- **Acción:** Seguimos con la librería no oficial (solo lectura) + exportar filtros nativos. Monitorear si TikTok lanza API de lives en el futuro

---

**Estado actual:** Probando funcionamiento base antes de implementar mejoras.
