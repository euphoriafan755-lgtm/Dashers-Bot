# Dashers Bot — Dashers Community ES

Bot de Discord para **Dashers Community ES**. Configuración elegida: 53 canales, 23 roles, comunidad, mantenimiento automático, moderación y feeds de Geometry Dash. Las admisiones de personas las administra Thiago por TikTok, fuera del bot.

## Importación del código

Este repositorio tiene preparado un flujo para **extraer automáticamente** el ZIP del proyecto y dejar cada archivo individual en GitHub. Para completarlo una sola vez:

1. Descargá el paquete original `DashersBot-v0.2-Waifly-LISTO.zip` desde la conversación donde fue generado. **No lo descomprimas para este método.**
2. En GitHub: **Add file → Upload files**, arrastrá el ZIP y confirmá el commit directamente en `main`. El nombre debe ser exactamente `DashersBot-v0.2-Waifly-LISTO.zip`.
3. Entrá en **Actions → Importar Dashers Bot desde ZIP**. Cuando el proceso termine en verde, el repositorio contendrá los archivos originales en su sitio (`package.json`, `src/`, `test/`, etc.). El ZIP se elimina del repositorio automáticamente una vez importado.
4. Si el proceso falla, **no hagas el despliegue aún**. Consultá los errores del flujo. El ZIP se comprueba mediante SHA-256 y se ejecutan las 10 pruebas locales antes de publicar el código.

**Importante:** nunca subas `.env`, tokens, contraseñas ni datos privados. El paquete solo contiene una plantilla `.env.example`.

## Configurar el hosting

Después de que el flujo quede en verde, pegá el repositorio público en Veltramon:

`https://github.com/euphoriafan755-lgtm/Dashers-Bot` y rama `main`.

Usá Node.js **22.12 o superior** si el proveedor ofrece elegir versión. El bot necesita estas variables configuradas como **secretos privados del hosting**, no en GitHub:

```text
BOT_TOKEN=(solo en el hosting)
CLIENT_ID=1554881611202437221
GUILD_ID=1554862905294463078
DATA_DIR=./data
```

El comando de inicio es `npm start`. Verificá que el hosting **conserve `data/` entre reinicios**; si no, se perderían estadísticas, sanciones y tickets. Para crear foros debe estar habilitado el modo **Comunidad** del servidor de Discord. El despliegue definitivo solo se considera probado tras encender el bot y verificar sus funciones en Discord.

## Código y pruebas

El proyecto completo se importará en archivos editables. No se publica ningún token real. `/setup` tiene vista previa y aplicación; ejecutá la vista previa antes de autorizar cambios en el servidor.
