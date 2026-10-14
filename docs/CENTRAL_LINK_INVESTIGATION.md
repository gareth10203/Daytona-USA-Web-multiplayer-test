# CommBoard centralizada — experimento 1

## Investigación y diseño

Se conservaron la candidata RC1 y sus archivos. La referencia de transporte es [MAME m2comm](https://github.com/mamedev/mame/blob/master/src/mame/sega/m2comm.cpp); el diseño local original está en `../upstream/docs/daytona-usa-recomp-design.md`, sección Link play. También se revisaron los accesos de la recompilación local en 0x1b600–0x1b8b0 y la investigación previa de fase FG. No se modifica ni se distribuye la ROM o su código generado.

El dispositivo original incorpora un bloque de 0xe00 bytes a partir de RAM compartida 0x21c0 y transmite desde 0x2000. El desplazamiento 0x1c0 crea ocho posiciones de 448 bytes: la primera posición saliente pertenece a la cabina local; las demás arrastran los datos de sus predecesoras. Cada slave envía al recibir DATA. Esta dependencia permanece aunque el transporte físico ya pase por el host.

El nuevo dispositivo mantiene los registros CN/FG y los encabezados de RAM de enlace, pero reemplaza descubrimiento, circulación y temporización de DATA. La membresía de la sala proporciona ID/cantidad. Se mantienen los IDs de RC1: host=1, primer slave=N, siguiente=N-1, último=2. El período de arranque original de 232 pasos se conserva.

## Comunicación independiente

Cada cabina produce una muestra de 449 bytes (ID + 448 bytes propios) por vblank, leyendo los datos reales del juego. Recibir datos nunca provoca retransmisión. El host autentica la muestra por conexión y asiento, conserva la última de cada participante y rechaza duplicados/counters anteriores.

Sólo el arranque espera la primera muestra real de todos: no se rellenan puestos con valores inventados. Después, cada muestra del host dispara estados personalizados para todos, usando las últimas muestras disponibles. Un jugador lento conserva su último bloque real; los demás se actualizan independientemente.

Para cada destinatario se construyen ocho posiciones en el mismo orden circular de memoria que espera el programa. El orden de RAM permanece; el anillo de comunicación desaparece. El estado enviado usa una etiqueta interna 0xfd y 3584 bytes de contenido, además de epoch y secuencia en PeerJS. Una secuencia vieja o una sesión terminada no se reaplica.

La recepción nativa conserva el estado completo más reciente. Una vez recibido el primero, cada paso local vuelve a aplicar los últimos datos reales y expone una transición FG tras la instantánea del IRQ, usando la corrección de fase anterior. Por ello FG ahora indica una entrega local, incluyendo estados retenidos; no certifica un paquete recién llegado. DATA del diagnóstico cuenta aplicaciones a RAM. Esta es una adaptación intencional de la CommBoard, no una emulación idéntica de su firmware.

## Pruebas y método

- Pruebas de distribución con todas las cantidades 2–8, cada destinatario y todos los bytes de las ocho posiciones, duplicados, identidad, calentamiento y una muestra lenta.
- Harness C++ ejecutado en WebAssembly con los 35 pares ID/cantidad posibles entre 2 y 8: muestreo independiente, ausencia de reenvío en recepción, transición única por paso, retención del último estado, drenaje de estados anteriores, rechazo de etiquetas inválidas y modo original con central desactivado.
- Pruebas de sala, ready, chat, presencia, desconexiones, pausa por visibilidad y recuperación, adaptadas al nuevo protocolo.
- Cabinas Chrome reales y PeerJS, con ROM local, gráficos Classic y volumen 0. Tráfico de juego retrasado de manera ordenada por enlace: 10/30/50 ms en cada dirección, más 0–6 ms de jitter. Ping no se retrasa: su RTT no representa este retraso aplicativo.
- Comparación contra RC1 en localhost:8087 y experimento en localhost:8088, ejecuciones consecutivas con cuatro cabinas. Se calculan hashes de los bloques propios emitidos y se cotejan con los recibidos, usando el reloj de pared del mismo equipo. Es una estimación de antigüedad hasta recepción JavaScript; no mide latencia de mando a pantalla. Repeticiones de contenido, colisiones de hash y planificación del navegador limitan la interpretación.

Los retrasos, controles de prueba y throttling sólo se inyectan en el harness HTTP. No se incluyen en el sitio jugable.

## Resultados iniciales de cuatro cabinas

| Condición | RC1: mediana / p95 de antigüedad | Central: mediana / p95 |
| --- | --- | --- |
| Carrera, sin retraso añadido | 70 / 202 ms | 15 / 35 ms |
| Retrasos asimétricos + jitter | 191 / 352 ms | 71 / 141 ms |
| Después de pausa de un cliente de 500 ms | 233 / 762 ms | 71 / 150 ms |
| Recuperación sin retraso añadido | 174 / 747 ms | 15 / 34 ms |

En ambos ensayos, las listas gráficas se mantuvieron aproximadamente a 57–58/s. La mejora importante en esta comparación es la frescura de datos y la recuperación, no una multiplicación de FPS. Tras la pausa, RC1 conservó en el host una cola nativa media de ~217 KiB; central, ~3.5 KiB en las últimas cuatro muestras.

En carrera sin retraso, el cliente pasó de ~402 KiB/s enviados a ~25 KiB/s. El host pasó de ~1209 KiB/s enviados / recibidos a ~599 enviados y ~75 recibidos. Son bytes de payload medidos; no incluyen cabeceras PeerJS, SCTP, DTLS o IP.

Evidencia inicial: `build/rc1-four.json`, `build/central-four-initial.json`. La validación ampliada está en `build/central-four-extended.json`: objetivo de throttling 30 Hz, resultado efectivo ~24.7–25 Hz por la planificación del harness. Con un cliente lento, los otros tres mantuvieron ~57.5–57.8 listas/s. Con el host lento, dos clientes mantuvieron ~57.7 listas/s y el cliente que recuperaba tiempo pendiente publicó temporalmente ~83 listas/s; todos volvieron a ~57–58/s al recuperarse. La cola nativa se mantuvo acotada. El tramo etiquetado originalmente race-end seguía en carrera por las bonificaciones de checkpoints: no se interpreta como llegada a meta.

El ensayo equivalente extendido de RC1 terminó por protección: después de ralentizar la cabina 4, todas volvieron al lobby con "The arcade receive queue overflowed". Se conservó el fallo en `build/rc1-four-extended.partial.json`; no se presenta como ensayo completado. Una comprobación de ciclo de sala se ejecutó en paralelo durante parte de ese ensayo ampliado, por lo que no se utiliza para comparar tiempos de CPU. La causa registrada es desbordamiento de la cola del cliente, no un fallo del experimento central.

`build/central-eight.json` valida ocho cabinas Chrome reales en attract y carrera: ~57.4–57.7 listas/s bajo retrasos por enlace de 10/30/50/20/40/60/70 ms más jitter. Antigüedad mediana/p95: 17/31 ms en carrera sin retraso, 108/165 ms con retrasos, 109/177 ms después de una pausa de 500 ms y 17/30 ms al recuperarse. El protocolo y los IDs de las ocho cabinas permanecieron activos.

`build/central-two-timeover.json` incluye una carrera de dos cabinas, seguida por frenado y 55 segundos de ejecución: ambas volvieron al attract mode y el enlace siguió activo. `tests/lobby-browser.cjs` verificó con PeerJS real chat, audio de solicitudes, admisión, retirada, timeout de un jugador silencioso, vuelta al lobby, segundo arranque en Grand Prix y restauración de single player. `tests/lobby-layout.cjs` verificó entrada y lobby entre 1024×640 y 1920×1080 y móvil 390×844. Las 28 pruebas JavaScript y el harness nativo para los 35 pares ID/cantidad pasaron, incluyendo pérdida de transporte sin transición falsa de FG.

Estas comprobaciones no incluyen un replay exacto de una llegada a meta comparado con PCB/MAME.

## Límites

La física original continúa calculándose en cada cabina. No se añade rollback, interpolación, predicción, migración de host ni autoridad de física central. Menos antigüedad de datos no elimina la latencia de internet. Retener/coalescer estados puede alterar la percepción de transitorios y colisiones respecto del anillo; las carreras visuales y los tests de bytes no prueban equivalencia contra PCB/MAME de una carrera completa. El host sigue distribuyendo datos y su conexión sigue siendo necesaria. Se conservan los watchdogs de carrera y el regreso a sala ante una interrupción prolongada o cambio de visibilidad.

No hay aún validación física en iPhone o entre hogares para este protocolo nuevo. La candidata RC1 permanece como referencia estable.
