# Dashers Bot

Bot oficial de **Dashers Community ES**, reescritura v1.0. Node.js 22 + discord.js 14.

## Objetivo

Configurar 8 categorías, 53 canales, 23 roles (8 visibles / 15 sin sección lateral) y gestionar Daily/Weekly, anuncios oficiales de Steam, paneles de roles y soporte, estadísticas, logros, salas de voz temporales y moderación. **No acepta integrantes automáticamente**: Thiago gestiona las admisiones por TikTok.

## Desplegar desde Veltramon

1. Fuente: `https://github.com/euphoriafan755-lgtm/Dashers-Bot.git`, rama `main`.
2. Entorno: Node.js 22 o posterior; inicio: `npm start`.
3. En los **secretos privados del hosting**, configurar `BOT_TOKEN`, `CLIENT_ID` y `GUILD_ID`. No pegar el token en GitHub, el chat ni canales públicos.
4. Usar almacenamiento persistente para `DATA_DIR` si Veltramon lo ofrece. Si no lo ofrece, descargar copias regulares: los reinicios podrían borrar estadísticas, sanciones y tickets.
5. Cuando el bot esté conectado, activar **Comunidad** desde los ajustes de Discord y ejecutar `/setup modo:preview`, después `/setup modo:apply` y finalmente `/paneles`.
6. El rol del bot debe estar por encima de los roles que asignará. Al principio, autorizalo solamente en tu servidor.

## Funciones

- **Administración:** `/setup`, `/paneles`, `/config`, `/salud`, `/limpieza`, `/actualizar-estadisticas`, `/rolusuario`.
- **Todos:** `/ping`, `/daily`, `/estadisticas`. Solo staff puede forzar la publicación de Daily.
- **Moderación:** `/logro`, `/advertir`, `/advertencias`, `/timeout`.
- **Automático:** anuncios Daily/Weekly y Steam a intervalos de 60 min, estadísticas cada 6 h, limpieza horaria de temporales **del propio bot** y antispam sin inspección semántica de mensajes.

## Auditoría y seguridad

`src/services/geometryDash.js` y `src/services/steamNews.js` solo consultan endpoints públicos fijos. No cargan ficheros del proceso ni acceden al token. `src/core/config.js` lee las variables provistas por el hosting exclusivamente en el arranque y nunca las publica. No incluye ofuscación, llamadas remotas dinámicas ni desactivación de medidas de seguridad.

El código se valida con `npm run verify`. Aun pasando estas comprobaciones, Veltramon puede detectar el proyecto por sus propias reglas. Si lo bloquea, solicitar revisión manual con la ruta y el mensaje exactos de detección; **no** cambiar código para evadir el antivirus.

## Limitaciones transparentes

Los tests son locales y no prueban conectividad real, APIs remotas ni cuotas del hosting. El primer `/setup` crea elementos de forma gradual, reutiliza por nombre/ID los existentes y **no borra canales ni roles**. Las notificaciones y comandos requieren los intents `Server Members` y `Message Content` habilitados para bienvenida y antispam. Los foros necesitan la función Comunidad activada en Discord.
