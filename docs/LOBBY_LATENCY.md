# Apertura y tolerancia de conexiones — experimento 7

Build `daytona-rev-a-central-experimental-7`. Corrige el ingreso y visualización del RTT, aumenta los márgenes de espera y añade eventos locales de diagnóstico. Conserva byte por byte el motor O2 del ZIP 6, su frontend de simulación y el renderizador del ZIP 5. No se cambia la física, protocolo, tamaño de paquetes ni interpolación.

## Fallos encontrados

El heartbeat podía descartar un canal nuevo con `open=false` al primer segundo, incluso mientras estaba negociando y disponía de un timeout de apertura de 15 s. La nueva conexión tiene un deadline explícito y una marca de apertura completada. Mientras no haya abierto se respeta ese deadline. Un evento real de cierre/error inicia recuperación inmediatamente; un canal que ya abrió no recibe otra espera de apertura por cerrar. La expiración mediante timer y mediante heartbeat queda acotada y probada.

El cliente medía el RTT del host en su conexión, pero el roster siguiente reemplazaba ese valor por el RTT vacío que el host publicaba para sí mismo. La validación del roster/room-sync conserva ahora la medición local de la conexión actual. No modifica los datos recibidos ni restaura la medición de un transporte anterior al reconectar.

## Límites

| Protección | Antes | Ahora |
|---|---:|---:|
| Señalización inicial / apertura de canal | 15 s | 30 s |
| Sin progreso local/remoto comunicado | 5 s | 10 s |
| Sin ningún mensaje | 12 s | 20 s |
| Reserva y recuperación | 30 s | 30 s |
| Preparación de cabinas | 60 s | 60 s |
| Cola máxima por conexión | 1 MiB | 1 MiB |

No se expulsa por un valor alto de RTT. Un segundo de ida/vuelta con progreso continuo no equivale a diez segundos sin progreso. El cambio de pestaña sigue devolviendo a todos al lobby inmediatamente cuando se detecta la pérdida de visibilidad. No se migra el host ni se reanuda una carrera tras un corte real.

No se amplía la cola: el host emite estados de 3.621 bytes a unos 57,52 pasos/s por destinatario, aproximadamente 203,4 KiB/s de payload (1,67 Mbps antes de overhead). El cliente envía muestras de 453 bytes, aproximadamente 25,45 KiB/s. La necesidad de subida del host sigue siendo mayor. Esta revisión no resuelve congestión reduciendo paquetes ni atribuye el incidente remoto a una causa confirmada.

## Diagnóstico

El mensaje de reconexión conserva la causa técnica, también en el host. Se distinguen apertura expirada, canal cerrado/error, límite de cola, error de envío/procesamiento, silencio, falta de progreso, pérdida de visibilidad y eventos de señalización.

El reporte local pasa a schema 3 e incluye `connectionEvents`: hasta 128 eventos con hora monotónica, fase, rol, número de cabina, estado de canal/ICE/conexión, bytes en cola, RTT disponible y edad del último mensaje/progreso. Se recoge aunque el overlay esté apagado. Se exporta una vez al nivel del reporte, sin duplicarlo en cada muestra de rendimiento.

No incluye texto arbitrario de errores, nombres, IDs PeerJS, tokens, invitaciones, IPs ni mensajes del chat. Las categorías de errores PeerJS se filtran por formato. El historial se conserva al detener la carrera o reconectar; se reinicia al abandonar/crear otra sala. No se envía telemetría a ningún servicio.

## Validación

49 pruebas JS pasan, incluidas las regresiones anteriores de autenticación/reconexión, mensajes tardíos, visibilidad, progreso y expiración. Los nuevos casos comprueban la espera de apertura, el cierre real durante esa espera, persistencia de RTT, tolerancia a una edad de progreso de 1.000 ms, detención ante un stall, trazas acotadas/privadas y descarga con diagnóstico apagado.

`tests/high-latency-browser.cjs` usa dos cabinas Chrome, ROM local, motor O2 y canales PeerJS reales. El harness introduce retrasos FIFO en **todos los mensajes de aplicación**, incluyendo admisión, Ready, preparación, Go, ping y tráfico del juego. No modifica el runtime distribuido.

| RTT de aplicación objetivo | Host | RTT observado en lobby | Resultado |
|---:|---|---|---|
| 340 ms | Página 1 | 347–348 ms | Ambas cabinas enlazadas/playing |
| 600 ms | Página 2 | 610–636 ms | Ambas cabinas enlazadas/playing |
| 1.000 ms | Página 2 | 1.002 ms | Ambas cabinas enlazadas/playing |

Cada caso realiza arranque, espera de enlace, entradas de carrera y pasos posteriores, sin disparar timeout o protección de cola. Las seis lecturas de RTT por caso son válidas tras refrescos del roster. Se invierten roles con nuevas salas.

Al modelar una subida del host de 1 Mbps, la cola alcanza el límite, ambas cabinas salen de playing y se registra `send-queue-limit`. El harness estima bytes de mensajes como payload más 200 bytes y añade su cola al valor nativo observado; es una simulación de backpressure, no una medición de capacidad de una WAN ni del buffer SCTP real.

`tests/lobby-recovery-browser.cjs` comprueba recuperación pendiente/admitida, identidad, asiento, ajustes, chat y pérdida real de señalización sin perder los canales. Espera el silencio real de 20 s; adelanta solo la expiración de la reserva. `tests/lobby-browser.cjs` comprueba inicio, diagnóstico, retorno al lobby, Grand Prix y single player en el motor final.

Resultados: `LOBBY_LATENCY_RESULTS.json`. La igualdad del motor y los archivos ajenos al cambio se comprueba contra el ZIP 6 al empaquetar. RC1 y los ZIP 1–6 se verifican por hash y se conservan.

## Límites pendientes

Retrasar mensajes después de abrir canales no simula negociación ICE lenta, pérdida real, control de congestión SCTP, cambios de ruta, asimetría de red o restricciones NAT. La espera de apertura se prueba de forma aislada; falta confirmación en redes físicas lentas.

Estas pruebas validan tolerancia de sesión, no calidad de colisiones/movimiento, final completo de carrera ni comodidad a 1.000 ms. Falta volver a probar con el host remoto en Windows y con iPhone. El motivo del incidente original aún no está confirmado; el nuevo reporte permitirá distinguirlo si vuelve a ocurrir.
