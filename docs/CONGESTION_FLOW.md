# Congestión y frescura de estados — experimento 8

La versión 7 saturaba 1 MiB aun con simulación cerca de 57,5 Hz. El caso de 340 ms sostenidos + 3 % de pérdida UDP se detuvo a los 7,10 s; 1.000 ms sin pérdida se detuvo durante el arranque. Se conservan los resultados en `../multiplayer-central/docs/PACKET_LOSS_RESULTS.json`.

La versión 8 modifica exclusivamente el frontend de instantáneas/diagnóstico en una copia independiente. No recompila el motor ni cambia física, sonido, render, código generado o fuente nativa. La versión 7 y RC1 permanecen intactas.

## Ventana independiente

`web/snapshot-flow.js` limita por conexión a ocho recibos pendientes y una instantánea aún no enviada. Si se publica otra antes de poder enviarla, sustituye esa pendiente. No borra mensajes ya entregados al RTCDataChannel. `bufferedAmount` solo refleja la cola del navegador, no toda la espera de recepción de SCTP, por lo que también se acota lo enviado sin confirmar.

El ID `delivery` se asigna al realizar el envío. Después de validar/aceptar una muestra, o admitir el estado en la cola nativa, el receptor confirma época, tipo e ID, junto a su contador real de progreso. Cada recibo concede exactamente su propio crédito. Duplicados, ID futuro, tipo equivocado, conexiones antiguas y épocas anteriores no liberan arbitrariamente la ventana. No se presupone que callbacks de deserialización completen siempre en orden.

Cuando hay crédito se envía la pendiente más reciente. Una conexión rápida sigue publicando normalmente; una lenta reduce su cadencia sin frenar otras conexiones. La muestra del propio host y su aplicación local conservan la cadencia nativa. No se inventan relojes, poses o entradas.

La variante final también espacia envíos cuando la estimación de recibo supera 80 ms. Usa el RTT de ping del lobby como estimación inicial y suaviza los tiempos reales de recibos con una media exponencial (25 % de muestra nueva). El intervalo es esa estimación dividida entre seis, reservando margen en la ventana de ocho. Así se evita llenar ocho mensajes en ráfaga, esperar un RTT y repetir la ráfaga. El vaciado se intenta desde las publicaciones locales y recibos, sin crear temporizadores por paquete. Redes rápidas conservan la cadencia nativa; no se impone una latencia artificial a los controles propios.

También se frena admisión de instantáneas a 16 KiB de cola RTC. Es un umbral de admisión, no un máximo exacto: la serialización asíncrona, overhead y control pueden sobrepasarlo transitoriamente. El límite final de 1 MiB se conserva.

Se limpia la ventana al detener/reiniciar. Permanecen los timeouts de progreso/silencio/apertura y la interrupción por visibilidad. Diez segundos sin recibo de una instantánea enviada también registran `snapshot-ack-timeout`: un ping con contador creciente no puede esconder indefinidamente un flujo de estados averiado.

## Estados y mensajes de control

Admisión, preparación, Go, Ready, chat, parada, recuperación, pings y recibos mantienen entrega fiable y ordenada. No se coalescen. Continúan en el mismo canal y comparten congestión; no hay prioridad en streams separados ni transporte parcialmente fiable.

`CommBoard::central_read_fg()` ya consumía los estados recibidos y aplicaba el último bloque completo en la siguiente FG. Los contadores completos del master y las muestras permiten saltar publicaciones sin el problema de acarreo del byte bajo corregido en el experimento 3. Se mantiene esa adaptación y el filtro de NPC.

La coalescencia no entrega cada transición intermedia de RAM: reduce qué instantáneas llegan bajo congestión. No equivale a afirmar que cualquier byte sea un evento prescindible. Conserva completo el estado entregado, pero transiciones/colisiones necesitan validación práctica. Arranque, carrera y reinicio son recorridos concretos, no una prueba exhaustiva del hardware.

## Formato reversible

Los ocho slots de 448 bytes repiten cabinas módulo el número de participantes. Se envían los primeros slots distintos, el reloj del master y sus relojes. El receptor reproduce exactamente los ocho slots antes de llamar a `onBytes`.

| Cabinas | Bytes por estado, sin envelope |
|---:|---:|
| 2 | 909 |
| 3 | 1.361 |
| 4 | 1.813 |
| 5 | 2.265 |
| 6 | 2.717 |
| 7 | 3.169 |
| 8 | 3.621 |

Se comparan todos los bytes y destinatarios para cantidades 2–8, incluidos cabeceras, control, NPC y relojes. No se filtran campos ni redondean posiciones. Con ocho no se ahorran bytes por repeticiones. TX/RX cuenta el payload compacto de transporte antes de expansión, sin recibos ni overhead.

## Pruebas

57 pruebas JS: paridad del formato, ventana bajo 1.000 publicaciones sin recibos, aplicación local y clientes sanos independientes, parada fiable, reinicio, recibos fuera de orden/duplicados/futuros, espaciado bajo RTT alto y fallo de recibo no ocultado por heartbeat. Las regresiones anteriores de permisos, presencia y recuperación se conservan.

El harness real usa dos cabinas Chrome, ROM local, WebGPU clásico y audio silenciado. Impone retraso desde ICE/DTLS/SCTP; añade pérdida después de arrancar a ese RTT. Comprueba ruta relay/UDP, colas reales y mensajes de comprobación completos/en orden. Se miden unos 30 s por condición tras las entradas. Las capturas muestran carrera real.

La primera variante de ventana, con estados completos de 3.621 bytes y umbral 64 KiB, mantuvo sesión con 340 ms + 3/10 % y 1.000 ms + 0/3 %, pero tuvo huecos de hasta unos 4 s y colas cercanas a 68 KiB. No es la variante entregada. Su JSON se conserva separado de la final, que usa formato compacto, recibos individuales y umbral 16 KiB.

La variante compacta antes del espaciado mantuvo 340 ms + 3 % con aproximadamente 57,5 Hz y colas de 9.526 / 1.090 bytes. Se conserva como comparación separada: no es el código final con espaciado.

Resultados del juego real en la variante final con espaciado:

| Condición sostenida | Resultado a los 30 s | SIM media host / cliente | Cola máxima muestreada host / cliente |
|---|---|---:|---:|
| 340 ms + 3 % pérdida | Ambas jugando | 57,50 / 57,51 Hz | 2.268 / 0 bytes |
| 1.000 ms + 3 % pérdida | Ambas jugando | 57,58 / 57,53 Hz | 2.616 / 0 bytes |
| 1.000 ms, sin pérdida | Ambas jugando | 57,51 / 57,51 Hz | 174 / 545 bytes |

Todos los mensajes de comprobación llegaron completos y en orden. En el build 7 el primer caso llegaba a 1.049.100 bytes y se detenía; el último no completaba el calentamiento. El formato completo y motor nativo permanecen idénticos al ingresar los estados.

En 1.000 ms sin pérdida, el porcentaje de aplicaciones que alcanzan el último extremo disponible pasó de 65,39 / 61,99 % en la compacta sin espaciado a 2,85 / 1,35 % con espaciado. No es un contador directo de coches visualmente inmóviles; el TGP original también proyecta poses. Es evidencia de mejor disponibilidad del búfer, no una evaluación humana ni equivalencia de colisiones.

Con pérdida persistieron huecos máximos de recepción de 951 / 873 ms (340 ms + 3 %) y 1.582 / 2.066 ms (1.000 ms + 3 %). La prueba reduce desconexiones y acumulación, sin eliminar los efectos de una mala red.

Los cortes UDP de 1 y 3 s se recuperaron, manteniendo ambas cabinas jugando durante 15 s posteriores. La ausencia total sostenida terminó por falta de progreso de unos 10 s, no por cola de 1 MiB. Se mantuvo el retorno al lobby ante ausencia real. Los máximos de recepción de las filas de recuperación empiezan después del corte; su duración y datagramas descartados están en `blackout`.

Ocho conexiones RTC reales con muestras sintéticas se mantuvieron activas durante 45 s con RTT/pérdida por cabina: 10/0 %, 60/0 %, 150/1 %, 340/3 %, 600/1 %, 1.000/3 % y 1.000/0 %. La cabina host recibió su aplicación local cada publicación; los clientes de 10/60 ms recibieron unas 2.649/2.647 aplicaciones con máximos intervalos 37/33 ms. El de 1.000 ms + 3 % recibió 56 y tuvo un hueco de hasta 4,57 s, pero no frenó los sanos. La orden fiable de parada llevó a todos a lobby. La cola agregada del host al final era unos 76 KiB repartidos entre siete conexiones; el umbral se aplica por conexión, no a esa suma.

Las pruebas de ocho endpoints y cortes se solaparon como comprobaciones funcionales y no se usan para conclusiones comparativas de CPU/FPS. Las mediciones sostenidas de dos cabinas anteriores se ejecutaron sin otra prueba de navegador simultánea.

Los datos finales están en [CONGESTION_RESULTS.json](CONGESTION_RESULTS.json). Los JSON de iteraciones anteriores quedan en `build/` y no se confunden con la variante entregada.

Las regresiones finales del lobby pasan: invitación actual, aviso sonoro, chat privado/historial, retirada de jugadores, arranque, parada identificada, expiración de presencia, reinicio Grand Prix y restauración de single player. La recuperación real PeerJS mantiene identidad/asiento/ajustes/chat, conserva conexiones cuando se pierde solo señalización, no duplica chat al perder un ACK, expira asientos fantasma y no reconecta un cierre explícito. En el arranque sin deterioro, los contadores locales SIM/DATA/FG permanecían alrededor de 57 Hz y el contador de aplicaciones de pose retenida era cero en la muestra final.

## Límites

El canal aún retransmite. Pérdidas en ráfagas pueden retener y agrupar actualizaciones. No hay nueva extrapolación, rollback, autoridad de física, migración del host o tolerancia ilimitada a desconexión. Diez segundos sin progreso sigue interrumpiendo según la política existente.

El ensayo de ocho conexiones usa tráfico sintético del tamaño/formato real sin ejecutar ocho motores/GPU. Debe distinguirse del juego real con dos cabinas y de ocho dispositivos físicos. Faltan carreras largas, Safari/iPhone y redes físicas. No se certifica experiencia uniforme entre regiones. La incidencia anterior de bloqueo al finalizar con el host en attract queda separada y sin corrección atribuida a este cambio.

## Reproducir

Servidor: `node scripts/serve.js dist 8089`. `PLAYWRIGHT_PATH` apunta al Playwright instalado. La prueba de juego lee la ROM local indicada; no se sube ni se empaqueta.

- `node --test tests/*.test.js`
- `node tests/packet-loss-browser.cjs` con `LOSS_DELAY_FROM_CONNECT=1`, `LOSS_SKIP_BLACKOUTS=1` y `LOSS_CASES=baseline,loss-3pct-rtt340ms,loss-10pct-rtt340ms,loss-3pct-rtt1000ms,rtt1000ms-no-loss`.
- Para cortes: `LOSS_CASES=blackouts-only`, sin `LOSS_DELAY_FROM_CONNECT`/`LOSS_SKIP_BLACKOUTS`; arranca sesión y ensaya 1/3 s y ausencia hasta interrupción.
- `node tests/eight-cabinet-network.cjs` para conexiones con RTT/pérdidas distintas.
- `node tests/lobby-browser.cjs` y `node tests/lobby-recovery-browser.cjs` para los recorridos de lobby, reinicio y single player.

La definición de `bufferedAmount` está en [MDN](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmount). Las mediciones adicionales proceden de las pruebas locales, no son garantías del estándar.
