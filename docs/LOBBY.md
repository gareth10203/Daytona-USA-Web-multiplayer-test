# Daytona USA — lobby multiplayer

Versión independiente basada en el experimento de temporización que funcionó: `daytona-rev-a-lobby-7`.

## Cambios

- El lobby muestra los ocho asientos numerados: los puestos vacíos son tarjetas Open seat y se reemplazan al admitir jugadores. El contador de plazas se sustituye visualmente por esas tarjetas. En desktop bajo las plazas vacías se compactan cuando hay solicitudes, cuyo panel tiene scroll interno para mantener accesible el footer.

- La pantalla de crear/unirse conserva debajo la guía original de teclado, mando y controles de servicio; dentro del lobby permanece oculta. La guía ocupa el mismo ancho que la ventana. Los espacios se adaptan a ventanas desktop bajas.
- Presencia del lobby mediante ping/pong cada segundo: tras 12 segundos sin recibir respuesta o datos se retira al participante o solicitud pendiente, se renumera la lista, se invalida Ready y se actualiza a todos. La limpieza funciona aunque PeerJS no emita `close`. El cliente limpia su lista si deja de recibir al host. Salir anuncia la partida o el cierre de sala; el cierre de conexión y el timeout quedan como respaldo. Las pausas breves conservan el puesto.
- El nombre se guarda en el navegador al editarlo, sin esperar a crear o unirse a una sala, y se recupera al recargar.

- La invitación se vuelve a leer desde la URL actual en cambios del fragmento, navegación del historial y restauración de pestaña (`pageshow`). Los formularios restaurados no prevalecen sobre el enlace. Una invitación nueva puede sustituir una sala anterior del lobby; no interrumpe una carrera activa automáticamente.
- El host puede retirar jugadores admitidos desde el lobby. La lista se renumera y Ready se reinicia al cambiar sus miembros. Durante una carrera hay que volver a la sala para modificarla.
- Las nuevas solicitudes producen un aviso breve de dos notas. El aviso está siempre habilitado y respeta el silencio y volumen general del juego. Se usa el contexto y volumen del juego y no se reinicia su reloj de audio. El navegador necesita el gesto de Create/Join/Ready para habilitar audio.
- Desktop usa columnas para jugadores, opciones y chat; se verificó sin scroll exterior entre 1024×640 y 1920×1080, con ocho jugadores y hasta siete solicitudes. En móvil se separan las vistas ROOM y CHAT; los inputs usan 16 px para evitar zoom de enfoque en iPhone.
- El aviso inferior identifica al jugador y su número de cabina cuando se interrumpe la sesión. El host verifica quién solicita la interrupción; una desconexión conserva el número anterior a renumerar el lobby.
- Chat privado de lobby para jugadores admitidos: texto plano, 240 caracteres, máximo de 60 mensajes en memoria y límite de frecuencia. El host asigna el remitente y orden de mensajes. Los recién admitidos reciben el historial; los pendientes no lo reciben. Se conserva al volver de una carrera y se borra al salir de la sala. Durante una carrera no se envían mensajes.

## Probar y publicar

```powershell
node scripts/serve.js dist 8087
```

Abrir `http://localhost:8087`, cargar la ROM propia y elegir Multiplayer. Para GitHub Pages, publicar el contenido de `dist/` en la raíz del sitio o extraer el ZIP listo para Pages. Todos los jugadores deben usar esta versión; no es compatible con el identificador de las versiones anteriores.

Las fuentes del frontend están en `web/`. `node scripts/build.mjs` las copia a `dist/` conservando el motor existente. Esta revisión no recompila ni modifica el motor: los archivos JS/WASM son idénticos al experimento de fase 4, con la recepción después de la instantánea de FG y las correcciones de ESC.

## Verificación

`node --test tests/*.test.js`: 23 pruebas de chat, identidad del remitente, historial, permisos de retirada, Ready, numeración, señalización, presencia, salida explícita, transporte silencioso y recuperación del enlace, además del aviso sonoro.

`tests/lobby-layout.cjs`: medidas de desktop, solicitudes, móvil, guía de entrada, nombre persistente al recargar, escape de texto, pestañas y acceso a ajustes. Usa fixtures de roster y el motor real.

`tests/lobby-browser.cjs`: tres cabinas Chrome con ROM local y PeerJS real; enlace actualizado y formulario restaurado, aviso sonoro sin duplicación, chat e historial, exclusión de pendientes, retirada, arranque, vuelta al lobby y desconexión automática al cortar las respuestas de un jugador. Las pruebas usan el Playwright ya instalado y una ruta local de ROM; no empaquetan la ROM.

No se modifican las versiones originales ni los ZIP anteriores. Los archivos de build y las capturas son locales.
