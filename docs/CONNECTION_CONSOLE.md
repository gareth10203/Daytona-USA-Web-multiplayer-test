# Consola de conexiones — experimento 10

Build `daytona-rev-a-central-experimental-10`, copia independiente del experimento 9. Todas las cabinas deben usar el build 10. El motor WASM y su cargador son idénticos al 9: se conserva su recuperación de movimiento. Esta implementación añade observaciones e informes; no cambia los límites de desconexión, la interpolación, la topología ni el transporte.

## Uso

El host abre **Connections** desde el lobby o desde el menú de una carrera. El juego continúa ejecutándose. **Players** muestra las conexiones y **Events** conserva hasta 128 eventos. Pulsar el nombre abre sus detalles; Back o Esc devuelve al menú anterior. **Export report** descarga un JSON.

Al abandonar la sala, se guarda en memoria el último informe del host. Se consulta en **Settings → Experimental → Last host room report** y se pierde al recargar la página. Los participantes desconectados se muestran como históricos, con sus últimas mediciones congeladas; no ocupan un asiento. Se conservan como máximo 32 registros de participantes más la fila local del host. El archivo exportado permite conservar el informe fuera de la página.

## Qué significan los datos

| Dato | Fuente y alcance |
| --- | --- |
| RTT | Ping/pong de esa conexión, observado por el host. Es el viaje completo host ↔ jugador. Si aún no hay ping, puede mostrarse el RTT del navegador, identificado en el detalle. No mide cliente ↔ cliente. |
| SIM | Pasos de emulación completados divididos por tiempo real transcurrido, medidos durante al menos 500 ms. Cada cliente informa su propia medición; el host mide la suya. No son fotogramas de pantalla. |
| Game update age | Tiempo desde el último estado nuevo aceptado de esa cabina en la carrera actual. El host local no tiene una recepción remota propia. |
| Outgoing queue | Bytes en `RTCDataChannel.bufferedAmount` observados por el host para esa conexión. La fila local del host suma sus conexiones. No incluye datos ya entregados a SCTP. |
| States in flight / pending | Estados enviados pendientes de confirmación y estado reciente aún por enviar, según el flujo del host. |
| Oldest state receipt wait | Tiempo que lleva esperando la confirmación de su estado más antiguo. |
| Game payload TX / RX | Variación de bytes de estados de juego por segundo en esa conexión. Excluye mensajes del lobby y sobrecarga de los protocolos. “—” indica que falta una segunda medición. |
| Last message / progress | Edad del último mensaje y del último contador remoto de emulación creciente observado por el host. Un ping con el mismo contador no renueva el progreso. |
| Report age / tab / signaling | Edad y contenido del último informe opcional del participante. Se distingue de una observación local. |
| Reported receive queue / backlog | Bytes pendientes en el enlace nativo y retraso pendiente del bucle, leídos en el dispositivo que los informa. |
| Route / Browser RTT | Ruta directa o TURN y RTT del par ICE seleccionado obtenidos con `getStats()`, con edad de esa consulta. No se recopilan direcciones ni candidatos ICE completos. |

Los informes de los clientes viajan en el ping ya existente de un segundo, sólo al host. No se envían informes por fotograma ni se difunden a los otros clientes. Funcionan aunque la superposición de rendimiento esté desactivada. `getStats()` se consulta cada dos segundos mientras la consola está abierta, además de las consultas que ya haga la superposición existente. Los fallos de estadísticas se ignoran y no cierran la sesión.

## Estados y causas

Una latencia sostenida de 340 o 1000 ms no se considera por sí sola una desconexión. Se diferencian mensajes ausentes, falta de estados nuevos, SIM remoto bajo, pestaña oculta y transporte cerrado o fallido. Una lectura antigua de SIM queda marcada como antigua; una ausencia de datos se representa con “—”.

El historial distingue **Observed**, **Reported** y **Action**. Conserva la cabina y el nombre vigentes en el momento del evento, incluso si después se renumera la parrilla. La conexión autenticada identifica a quien pide detener la partida; un cliente no puede atribuirlo a otra cabina mediante campos de su mensaje. Un motivo informado por un cliente permanece identificado como informado, no como una causa comprobada remotamente.

Se registran cambio de visibilidad, falta de progreso local/remoto durante 10 s, espera de confirmación de estado durante 10 s, silencio de conexión durante 20 s, preparación fallida o expirada, error del enlace arcade, errores de envío y recepción, cierre del canal, reintentos recuperados, expulsión, salida y cierre de sala. Las transiciones RTC sólo se registran: no añaden otra regla de desconexión.

Una falta de progreso remoto puede corresponder a red o a emulación detenida. El cierre de un canal tampoco identifica por sí solo una caída de Wi-Fi, NAT, firewall, suspensión del equipo o salida del navegador. El informe conserva la condición comprobada y deja explícita esa incertidumbre. No se inventa un porcentaje de pérdida de paquetes: los contadores de mensajes de un canal fiable no permiten calcular la pérdida original en la red. Referencia: [W3C WebRTC Statistics, RTCDataChannelStats y RTCIceCandidatePairStats](https://www.w3.org/TR/webrtc-stats/).

## Integridad y coste

Los informes opcionales tienen esquema acotado, secuencia creciente y validación de época en carrera. Informes inválidos se ignoran sin detener el juego; los avisos de este tipo están limitados en frecuencia. Se ignoran mensajes de conexiones reemplazadas, solicitudes pendientes y épocas anteriores.

El JSON no contiene invitación, ID PeerJS, clave de sesión, candidatos ICE completos ni direcciones de red. Las razones de error se acotan y eliminan enlaces, claves y direcciones IPv4 reconocibles; los nombres de jugadores son parte del informe. Todo texto recibido se representa como texto, sin interpretar HTML. Las medidas de bytes corresponden a carga de juego, no a consumo total de red.

## Validación de esta versión

- 71 pruebas JavaScript: las 57 existentes y 14 de estado, autenticación, secuencias, privacidad, límites, RTC y causas.
- `tests/host-console-browser.cjs`: dos contextos Chrome, motor nativo real y conexión PeerJS. SIM e intercambio de estados con superposición desactivada; progreso durante consulta; interrupción por visibilidad identificada; reconexión real; exportación; archivo tras salir; tabs, Esc y foco.
- La comprobación visual de ocho participantes usa datos sintéticos sólo para verificar disposición en 1366×768 y 390×844. No prueba ocho jugadores reales ni rendimiento de redes externas.
- `tests/lobby-browser.cjs`: regresión del lobby, invitación, aprobación, audio, chat, expulsión, inicio/parada, caducidad por silencio, reinicio Grand Prix y restauración de single player.
- Empaquetado: comparación de SHA-256 del experimento 9, de su ZIP y del motor; identidad de frontend fuente/distribución e integridad del nuevo ZIP.

Los resultados automáticos se guardan en `build/host-console-validation.json` y `build/lobby-final-validation.json`; las capturas visuales permanecen en `build/`. Esta prueba local no establece rendimiento ni diagnóstico de raíz para una conexión remota concreta.
