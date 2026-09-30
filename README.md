# Dashers Bot v0.2 — versión para hosting Node.js gratuito

Proyecto para **Dashers Community ES**. Este paquete contiene código fuente real, no requiere Docker ni tu PC encendida cuando funciona en el hosting. **Todavía no está conectado ni probado en el hosting real**; las pruebas locales solo certifican sintaxis, la definición de canales/roles y la limpieza segura. El hosting y Discord deben probarse después.

## Tu configuración (ya incorporada)

- Nombre: **Dashers Bot**.
- Application ID: `1554881611202437221` (público).
- Server ID: `1554862905294463078` (público).
- **8 categorías / 53 canales / 23 roles** exactamente como se acordó.
- Las admisiones las hace Thiago **manualmente por TikTok**, no existe bot de solicitudes.
- Bienvenidas, despedidas, roles seleccionables, tickets, Daily/Weekly, avisos oficiales vía Steam, estadísticas, sala de voz temporal, logros y moderación básica.
- `/setup` con vista previa; `/paneles` para paneles de rol/tickets; `/salud` y `/limpieza` para el staff.

## Aclaración importante sobre la captura del hosting

`Allocated Resources → MEMORY 512 MB/512 MB`, `CPU 100%/100%` y `STORAGE 1 GB/1.5 GB` muestran **recursos reservados para las instancias**, no prueban que BOTT7 esté gastando toda esa RAM o CPU. `servers.status.error` no revela la causa. Limpiar archivos de tu bot **no aumenta** la cuota global del proveedor ni repara por sí mismo un arranque fallido. Para saber por qué BOTT7 se apaga, hacen falta sus logs de consola y su código.

Si el panel mantiene **toda** la RAM y CPU asignadas a BOTT7, no podrás reservar recursos adicionales para Dashers sin cambiar las asignaciones, elegir otro proveedor o liberar recursos voluntariamente. **No borres BOTT7 sin respaldo**.

## Configurar en hosting tipo Pterodactyl / Waifly

1. Comprobá si tenés recursos suficientes para **otra** instancia Node.js. Si solo hay 512 MB totales y están asignados íntegramente a BOTT7, primero solucioná la asignación; no crees otro servidor creyendo que el contador 1/3 implica RAM extra.
2. Creá un servidor tipo **JavaScript (Node.js)** con Node **22.12 o superior**. Ajustá el servidor existente únicamente después de respaldarlo. No necesitás un puerto público (es un bot de Discord, no una web).
3. Extraé **el contenido del ZIP** en la raíz del nuevo servidor. En la raíz deben aparecer `package.json`, `src/`, `test/` y `README.md`; no dejes todo dentro de una subcarpeta adicional.
4. En el panel, establecé las siguientes variables, especialmente el token **como secreto privado**. NO subas un `.env` rellenado a repositorios ni nos envíes el token:

   ```text
   BOT_TOKEN=<tu token en el panel, NUNCA por chat>
   CLIENT_ID=1554881611202437221
   GUILD_ID=1554862905294463078
   DATA_DIR=./data
   HOST_RAM_MB=512
   GD_FEED_ENABLED=true
   STEAM_FEED_ENABLED=true
   ```

   Si el proveedor asigna menos de 512 MB a **esa instancia**, cambiá `HOST_RAM_MB` a la cantidad real. El monitor primero intenta leer el límite real del contenedor, si está disponible.

5. Instalación de dependencias: `npm install --omit=dev`. Comando de arranque: `npm start` o `node src/index.js`, según permita el panel. Si el panel instala automáticamente, evitá reinstalar en cada reinicio. **No** subas `node_modules` desde Windows a un host Linux.
6. Si el hosting permite volumen o directorio persistente, mantené **`DATA_DIR=./data`** en ese directorio. Necesitamos persistencia de `state.json` para que las noticias, tickets, advertencias y logros no se pierdan. Evitá servicios que borran todo al reiniciar.
7. En Discord, activá **Servidor de comunidad** antes de crear canales de foro y poné el rol del bot **por encima de los 23 roles que vaya a gestionar**. En el portal del bot, activá `Server Members Intent` y `Message Content Intent`.
8. Encendé Dashers Bot y comprobá que el panel diga `Dashers Bot listo` y `Comandos sincronizados`. Si falla, guardá las últimas ~40 líneas de consola **sin tokens**.
9. En tu Discord, ejecutá `/setup modo:Vista previa` y, luego de comprobar que los permisos son correctos, `/setup modo:Aplicar configuración` (tarda algunos minutos por los límites de Discord). Finalizá con `/paneles` y `/actualizar-stats`.
10. Probá un ticket y una sala temporal antes de abrir el servidor público. Después mirá `/salud`.

### No hace falta compartir secretos

Ya están incorporados los IDs públicos, así que no hace falta volver a pasarlos. Únicamente el token se introduce **en el hosting**, no en este chat. Si alguna vez apareció públicamente, regeneralo en el Discord Developer Portal.

## Limpieza automática (qué hace Y QUÉ NO)

`src/resourceCare.cjs` se ejecuta al iniciar y luego automáticamente **cada 60 minutos**, y controla RAM/CPU de este proceso aproximadamente **cada 60 segundos**. No crea procesos extra ni usa librerías adicionales.

- Limpia exclusivamente archivos temporales propios en `data/cache`, `data/tmp` y `data/logs` si superan límites de antigüedad o espacio (2, 1 y 3 días respectivamente).
- No sigue enlaces simbólicos, no recorre carpetas extra y no toca bases de datos, `state.json`, copias de seguridad ni archivos que no pertenecen al bot.
- Depura los registros temporales de antispam para que no crezcan indefinidamente.
- Restringe la caché de mensajes de Discord, evita el fetch periódico de todos los miembros y conserva deduplicación acotada de noticias.
- Avisa cuando la RAM del proceso supera el 80 % del límite o detecta CPU alta; puede adelantar una limpieza **pero no puede añadir RAM, reparar un error del hosting ni borrar los logs administrados por el panel**.
- No reinicia en bucle ni borra sanciones, niveles, logros o datos importantes cuando hay consumo alto.

Comandos para administradores: `/salud` muestra RAM/CPU del **proceso**, `/limpieza` ejecuta una limpieza segura inmediata. El uso de CPU se mide desde la última muestra, por lo que las primeras lecturas pueden variar.

## Pruebas / limitaciones

En entorno local (con Node 22+): `npm run check` y `npm test` son independientes de iniciar sesión en Discord. `npm run preflight` se usa **después** de configurar las variables en el panel para comprobar el entorno (nunca imprime el token).

La API de Geometry Dash puede fallar o cambiar sin aviso; el bot registra errores y no inventa publicaciones. El feed oficial cubre avisos oficiales de Geometry Dash publicados en Steam, no todas las redes del desarrollador. La configuración inicial de un servidor vacío tiene muchos pasos y debe verificarse en Discord, no solo con pruebas unitarias.

Para poner **BOTT7** a prueba con la misma limpieza sin arriesgarlo, mirá el paquete separado `BOT7TV-parche-recursos-pendiente.zip`. **Aún no está instalado ni integrado** porque no tenemos sus archivos originales ni el log que explica el apagado.
