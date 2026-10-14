# Recuperación del lobby — experimento central 2

Build: `daytona-rev-a-central-experimental-2`.

Documento histórico. El experimento 7 conserva este diseño y modifica apertura, RTT y tiempos de silencio/progreso; valores actuales y nuevas pruebas en [LOBBY_LATENCY.md](LOBBY_LATENCY.md).

Esta actualización cambia la sala y la gestión de conexiones. Conserva el motor nativo y el protocolo central de datos de carrera del experimento 1. RC1 y el ZIP del experimento 1 permanecen intactos. Todos los jugadores deben utilizar el build 2, porque el ingreso y la recuperación incorporan nuevos mensajes.

## Comportamiento

- Los cortes de transporte reservan durante 30 segundos el asiento de un jugador admitido o su solicitud pendiente. La comprobación de presencia sigue siendo cada segundo, con 12 segundos sin mensajes antes de declarar una conexión silenciosa. La reserva empieza al detectar el corte; no se extiende con cada reintento.
- El cliente conserva en memoria el mismo identificador PeerJS y un token aleatorio de sesión de 128 bits. Para recuperar un asiento, el host exige también el mismo token de sala y build. Una solicitud pendiente vuelve a estar pendiente; nunca se convierte automáticamente en admisión.
- El host puede retirar un asiento reservado o rechazar una solicitud desconectada. Esto elimina su credencial de recuperación. Una entrada posterior requiere aprobación de nuevo.
- La reconexión reemplaza el transporte anterior de forma autenticada. Los eventos y mensajes tardíos de la conexión sustituida se ignoran. No se crea otro jugador ni se cambia su nombre al recuperar la conexión.
- Al volver, el host envía jugadores, ajustes, revisión y las últimas 60 entradas de chat. El cliente aplica únicamente estados con secuencia creciente. No se comparte el chat con solicitudes pendientes. Las solicitudes del host permanecen en su memoria durante una interrupción de señalización.
- Ready y chat tienen identificadores de acción y confirmación del host. Una acción sin confirmar se reintenta; el host conserva confirmaciones recientes y una marca de secuencia para no repetirla. Ready obsoleto se rechaza y actualiza los ajustes. Ready no se restaura automáticamente tras una reconexión: el jugador debe confirmarlo otra vez.
- La interfaz muestra el asiento reservado, el estado de recuperación y la confirmación pendiente de Ready. Durante la recuperación se deshabilitan el chat y Ready del cliente. No se puede iniciar una carrera mientras haya jugadores reconectando o solicitudes sin resolver.
- Los errores recuperables de señalización se reintentan con intervalos crecientes, limitados a 10 segundos. No detienen una carrera si los canales entre jugadores siguen funcionando. Cerrar deliberadamente una sala o abandonarla no activa reconexión; el transporte se cierra tras un breve margen de entrega del aviso.

## Límites

La recuperación cubre cortes breves dentro de la página abierta. Recargar/cerrar la página pierde la identidad de esa sesión; conservar el nombre local sigue funcionando, pero el nuevo ingreso necesita aprobación. No se incorpora persistencia de credenciales en disco, migración del host, nuevos servidores TURN ni incorporación a una carrera ya iniciada.

La desconexión de una cabina durante la carrera sigue devolviendo a los demás al lobby. La cabina ausente puede recuperar allí su asiento; no reanuda una simulación desincronizada en mitad de la carrera. Las protecciones por visibilidad y falta de progreso permanecen. Separar los canales de control y carrera y retirar coches ausentes son trabajos posteriores.

## Verificación

`node --test tests/*.test.js`: 41 pruebas, incluyendo distribución central, recuperación admitida/pendiente, credencial incorrecta, sustitución de transportes, mensajes tardíos, acciones duplicadas, ajustes obsoletos, expiración, mensajes malformados y cierre explícito.

`tests/lobby-recovery-browser.cjs`: tres contextos de Chrome, PeerJS y conexiones WebRTC reales, con ROM local para acceder a la UI. Verifica cortes de los canales de datos, reconexión con el mismo asiento e identidad, estado restaurado, desconexión/reconexión real de señalización, confirmación de chat perdida sin duplicados, detección real de silencio y cierre explícito. La expiración de la reserva se adelanta mediante el harness; no se afirma haber esperado los 30 segundos en ese ensayo. El timeout de presencia de 12 segundos sí se espera.

`tests/lobby-layout.cjs`: desktop 1920×1080, 1366×768, 1280×720 y 1024×640, y móvil 390×844. Incluye estados de reconexión, ocho asientos, controles deshabilitados y ausencia de desbordamiento horizontal. En desktop no hay scroll exterior del lobby; el menú de entrada admite un píxel de redondeo.

`tests/lobby-browser.cjs`: regresión con motor real, preparación e inicio del enlace, vuelta al lobby, segundo arranque en Grand Prix y restauración de single player. El código de inyección y las alteraciones de reloj/transporte existen únicamente en los harnesses de prueba; no se distribuyen en `dist/`.

Son pruebas locales en Chrome. Sigue pendiente validar la recuperación entre hogares y en iPhone.

## Referencias

[PeerJS: desconexión de señalización y reconnect](https://peerjs.com/client/api/peer). [WebRTC: canales de datos y estados de conexión](https://www.w3.org/TR/webrtc/). La investigación del motor central y sus resultados anteriores están en [CENTRAL_LINK_INVESTIGATION.md](CENTRAL_LINK_INVESTIGATION.md).
