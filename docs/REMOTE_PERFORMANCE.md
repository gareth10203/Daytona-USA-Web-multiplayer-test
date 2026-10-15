# Informes de rendimiento de las cabinas — experimento 11

Build `daytona-rev-a-central-experimental-11`, copia independiente del 10. El motor, su cargador, la recuperación de movimiento y las reglas de conexión siguen siendo los anteriores. Todas las cabinas necesitan esta versión para compartir rendimiento.

## Descargar desde el host

- **Connections → Export all reports** descarga el estado de conexiones, los eventos y los informes de rendimiento del host y de los otros jugadores en un único JSON.
- Al abrir el nombre de un jugador, **Download performance** descarga su informe individual. Permanece desactivado mientras no haya muestras de juego recibidas.
- Tras volver al lobby se conservan las mediciones de la carrera. Los jugadores que han salido siguen disponibles mientras su registro permanezca en el historial acotado.
- Después de cerrar la sala, **Settings → Experimental → Last host room report** permite descargar lo que recibió el host hasta ese momento. Recargar la página borra esa memoria.

**No es necesario activar Show performance overlay.** Durante una partida multijugador, cada dispositivo mide automáticamente su rendimiento y lo comparte con el host. El interruptor sólo controla la visualización. En single player la recogida detallada sigue siendo opcional, ligada al interruptor existente.

## Contenido y alcance

Se incluyen cadencia de simulación y dibujo, tiempo medio y p95 del paso nativo de CPU, mayor intervalo entre pasos, reinicios de audio, retraso del bucle, bytes pendientes, capacidad WASM, contadores nativos del enlace, reserva/retenciones de poses y estadísticas de envío/recepción y confirmaciones. Se copian los números medidos por el sistema de diagnóstico local. Los campos no disponibles permanecen nulos o ausentes; no se reconstruyen valores perdidos.

El informe conjunto tiene `reportVersion: 2`. `performance.cabinets[]` contiene los informes individuales con `schema: 4`, nombre, cabina, origen, cobertura y `samples[]`. Se conservan las claves de métricas del informe local de diagnóstico. Los campos privados del informe local, como el ID de sesión y el user agent, se excluyen del intercambio y de la descarga agregada.

Cada muestra añade secuencia, hora del dispositivo, hora de recepción en el host, número de carrera asignado por el host y nombre/cabina de la parrilla de esa carrera. `source: participant-reported` indica mediciones informadas por ese dispositivo; el host no verifica su CPU de forma independiente. El propio host figura como `local`.

Los relojes de los dispositivos no están sincronizados. No se debe restar `capturedAt` a `receivedAt` para deducir latencia de ida. El RTT observado y los contadores de cada cabina mantienen sus significados anteriores. No se mide tiempo de GPU ni porcentaje real de pérdida en la red.

## Límites y recuperación

- Hasta **300 muestras de juego por participante**, aproximadamente cinco minutos de tiempo recopilado. No equivale al historial completo de una sesión larga. El registro local también está acotado a 300 muestras.
- Cada ventana normal dura al menos un segundo. Sólo se comparten muestras de juego enlazado de la carrera actual o de la última carrera terminada; el lobby no sustituye esas muestras por valores de una emulación detenida.
- Se envían hasta cuatro muestras pendientes en el ping ya existente de un segundo. El host confirma la secuencia recibida. Se reintenta hasta recibir confirmación y se ignoran duplicados.
- Si la cola de envío alcanza 16 KiB, se omite el bloque opcional de rendimiento de ese ping. Los mensajes existentes siguen su recorrido habitual. No se añaden mensajes de telemetría por fotograma.
- Después de una reconexión se pueden recuperar muestras retenidas localmente. Si el dispositivo sale definitivamente, el host dispone de las que alcanzó a recibir. Un historial no recibido no se puede descargar desde un navegador ya desconectado.
- `coverage` indica muestras retenidas, intervalo capturado, descartes por capacidad y huecos conocidos de secuencia dentro de una carrera. Estos huecos son de mediciones, no un cálculo de paquetes de red perdidos. La cobertura no garantiza ausencia de datos anteriores al primer punto recibido.
- Se acotan los registros de rendimiento a 32 participantes, preservando los miembros actuales al expulsar registros antiguos. El historial de eventos y de conexiones mantiene sus propios límites.

## Coste e integridad

La recogida automática utiliza los mismos temporizadores y sondas que la superposición existente: consultas de reloj y sondas nativas por paso, agregación una vez por segundo y consultas opcionales de estadísticas del navegador cada dos segundos. La superposición puede seguir oculta. Los informes completos se construyen al descargarlos; el refresco de la consola sólo obtiene contadores y cobertura, sin clonar todos los historiales.

Los mensajes opcionales se validan, acotan y reducen a una lista de campos numéricos/booleanos permitidos. Sólo se aceptan de la conexión vigente de un jugador admitido y de una época válida. La identidad del informe procede de la parrilla del host. Un informe inválido se ignora sin interrumpir la partida. Las confirmaciones de rendimiento no liberan créditos del flujo de estados arcade ni renuevan su contador de progreso.

El intercambio es entre los participantes de la sala y su host; no se envía a un servicio de análisis externo. La interfaz informa a los jugadores de que se comparte rendimiento con el host. El JSON contiene sus nombres y métricas de juego; no contiene invitaciones, claves, IDs PeerJS, direcciones de red ni user agent.

## Validación

- 86 pruebas JavaScript: 71 heredadas y 15 de recogida automática, ventanas, validación, privacidad, identidad, límites, confirmaciones, prioridad de envío, conservación y exportación.
- `tests/performance-browser.cjs`: tres motores reales en Chrome y PeerJS, Classic. Comparación exacta de muestras descargadas con las mediciones originales de cada cabina, superposiciones apagadas, descarga individual/conjunta, retención en lobby y tras salidas, reintentos después de suprimir bloques de diagnóstico y archivo de la sala.
- `tests/host-console-browser.cjs`: regresión de la consola, interrupción por visibilidad, reconexión, exportación y disposición de ocho filas con fixture visual en desktop/mobile.
- `tests/lobby-browser.cjs`: regresión de invitación, aprobación, audio, chat, expulsión, inicio/parada, silencio, reinicio Grand Prix y restauración de single player.
- El empaquetado compara el motor y los archivos preservados del 10, el frontend fuente/distribuido y la integridad del ZIP.

Las pruebas de navegador son locales. La supresión de bloques de diagnóstico no simula pérdida de datagramas de la red ni certifica rendimiento en ocho hogares o en iPhone. Los resultados y capturas quedan en `build/`; no se distribuyen motores de diagnóstico, ROM ni scripts de pruebas.
