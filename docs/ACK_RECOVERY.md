# Recuperación de confirmaciones — revisión 17

Build `daytona-rev-a-central-experimental-17-ack-recovery`. Copia independiente de la 16 coordinada. No se recompila ni modifica el motor, el reloj, la física, el audio nativo, el renderer o la interpolación.

## Problema confirmado

En la 16, la supervisión usaba la edad del estado individual más antiguo sin confirmar. Un corte UDP de 3 s con RTT base de 1.000 ms dejaba estados antiguos en recuperación de SCTP. Aunque otras confirmaciones válidas y mensajes recientes llegaban, ese estado superaba los diez segundos y detenía la sesión completa. Se reprodujo con ocho motores reales y con ocho conexiones sin motores ni GPU.

## Corrección

Cada conexión conserva la hora de la última confirmación **válida y nueva** de una entrega actualmente pendiente. La supervisión mide el tiempo sin progreso de confirmaciones mientras existen entregas en vuelo. Sin ninguna confirmación, la referencia es el envío pendiente más antiguo; después de vaciar la ventana, un nuevo envío inicia su propia espera.

- Se conserva el umbral de **10 s sin progreso**. Pings, otros mensajes, duplicados, números inválidos, otra carrera y otra conexión no renuevan esa espera.
- Cada recibo libera exclusivamente su propia entrega. Los estados antiguos no se perdonan ni se retiran sin confirmar para crear créditos.
- Se mantienen **8 entregas en vuelo, 1 estado pendiente y el límite de admisión de 16 KiB** por conexión; el límite general de cola también permanece.
- Siguen activos los controles de progreso de simulación, visibilidad y cierre/error de transporte. Un corte prolongado continúa devolviendo la sesión al lobby.
- El cálculo de RTT, la cadencia de envío y el canal fiable/ordenado no cambian. Esta corrección permite completar la recuperación, no evita la espera física de retransmisiones.

Connections muestra por separado la antigüedad del estado pendiente más viejo y el tiempo sin progreso de confirmaciones. Los informes de rendimiento conservan ambas medidas. No se inventan pérdidas o latencias.

## Resultados

**111 pruebas JavaScript aprobadas**. Incluyen reloj y red previos y siete regresiones nuevas: progreso con entregas viejas, ausencia total de recibos, duplicados/inválidos, ventana vacía, conservación de créditos, integración del supervisor y rechazo de recibos de otra carrera.

Ocho conexiones con tráfico sintético, sin motores: el caso que fallaba en la 16 ahora mantiene las ocho activas durante los 25 s observados después de restaurar UDP. La antigüedad máxima de una entrega alcanzó **11.63 s**, pero la mayor espera sin progreso de confirmaciones fue **5.67 s**. Al final volvió a una cadencia acorde al RTT base. La batería antigua conserva su fallo como comparación.

Ocho juegos completos en Chrome/WebGPU, Classic, 640×480, Normal/Normal/Export y Beginner. Todas las cabinas entran en carrera. Se aplica deterioro real a datagramas cifrados mediante TURN/UDP local, antes de DTLS/SCTP, con candidatos relay/UDP verificados. La negociación ICE y la señalización no se deterioran.

| Condición | Ventana configurada | Pasos/s por cabina, rango de medias | Sesión |
| --- | ---: | ---: | --- |
| Red local, sin deterioro | 15 s | 57.54–57.54 | 8 activas |
| RTT distintos de 10 a 1.000 ms | 30 s | 57.50–57.53 | 8 activas |
| RTT distintos, jitter y 0–3 % de pérdida | 35 s | 57.51–57.53 | 8 activas |
| 10 % de pérdida sólo en una cabina | 30 s | 57.52–57.55 | 8 activas |
| Recuperación del corte de 1 s | 18 s | 57.51–57.55 | 8 activas |
| Recuperación del corte de 3 s a RTT base de 1.000 ms | 18 s | 57.52–57.53 | 8 activas |
| Reinicio tras corte prolongado | 15 s | 57.50–57.57 | 8 activas |

En la recuperación del corte de 3 s con motores, el máximo de antigüedad individual fue 10.56 s y la espera sin progreso llegó a 4.84 s. Se mantienen todas las ventanas acotadas. El mayor bufferedAmount agregado observado en un dispositivo fue 91143 bytes; ese agregado no equivale a un límite individual de canal.

El corte de 14 s empezó con las ocho cabinas activas, las devolvió al lobby y permitió volver a Ready y arrancar ocho cabinas de nuevo. El harness espera primero las mismas condiciones que habilitan Ready en la UI. Al concluir, la parada explícita del host llegó a todas.

## Alcance

Son pruebas locales de ocho motores en un mismo PC y perfiles sembrados. No equivalen a ocho hogares, móviles/Safari, negociación bajo NAT restrictivo o sesiones de horas. Classic reduce la carga gráfica del ensayo. Los tramos tardíos incluyen resultados y attract; no se presentan como conducción humana continua.

Las pérdidas y los cortes todavía pueden producir posiciones remotas retenidas y correcciones visibles. No se añaden extrapolación, rollback, un canal no fiable, reincorporación en carrera o migración de host. Tampoco se garantiza calidad de audio o imagen percibida: se registran generación y planificación con volumen cero, no altavoces ni scanout físico.

## Integridad y reproducción

Se verifican por SHA-256 122 archivos de web/dist/native y ZIP de la 16, que permanece intacta. El WASM conserva SHA-256 `a36dd848f3683c53e02a96597133f8646a01708c979dc361be87b39901419cab`. Cambian seis módulos del frontend: snapshot-flow, multiplayer, connection-health, host-console, performance-history y room-settings.

Servidor: `node scripts/serve.js dist 8098`. Pruebas: `node --test tests/*.test.js`. El harness `tests/multiplayer-network-matrix.cjs` acepta `MATRIX_COUNTS=8` y `PLAYWRIGHT_PATH`; para el caso aislado sin motores se usan `MATRIX_KIND=transport`, `MATRIX_CASE=isolated-cuts` y `MATRIX_SHORT_ONLY=1`. La ROM sólo se lee localmente en el modo con motores.

Recibos: `build/network-matrix-game.json`, `network-matrix-transport-isolated-cuts.json`, `unit-tests.txt`, `ack-recovery-summary.json` y `package-validation.json`. Los scripts de pruebas y la ROM no forman parte del ZIP.
