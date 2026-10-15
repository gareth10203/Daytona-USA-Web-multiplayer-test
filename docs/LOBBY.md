# Daytona USA — recuperación de confirmaciones, revisión 17

Build `daytona-rev-a-central-experimental-17-ack-recovery`. Copia independiente de la 16 coordinada. Se conservan su carpeta y sus ZIP.

## Cambio

La sesión supervisa el tiempo sin nuevas confirmaciones válidas de estados, en lugar de detenerse únicamente porque un envío antiguo sigue pendiente. Una confirmación individual válida renueva esa supervisión; duplicados, confirmaciones inválidas, otra carrera y pings no lo hacen.

Se conservan diez segundos sin progreso de confirmaciones, ocho entregas en vuelo y un único estado pendiente por conexión. No se perdonan créditos sin confirmar ni se amplían las colas. El reloj, los gráficos, la física, el audio nativo, la interpolación y el motor WASM son idénticos a la 16 coordinada.

Connections permite distinguir la espera del estado más antiguo de la espera sin progreso de confirmaciones. Ambas medidas se conservan en los informes de rendimiento.

## Probar

`node scripts/serve.js dist 8098`

Abrir http://localhost:8098 y cargar la ROM local. Todas las cabinas deben usar esta revisión. El ZIP publicable es `daytona_ack_recovery_experimental_17_github_pages.zip`: extraer su contenido en la raíz de GitHub Pages. No incluye ROM ni hooks de prueba.

## Validación

Los resultados y límites de esta revisión se documentan en [docs/ACK_RECOVERY.md](docs/ACK_RECOVERY.md). La matriz anterior que detectó el problema pertenece a la 16 y se conserva en [docs/NETWORK_MATRIX_16.md](docs/NETWORK_MATRIX_16.md).

`node --test tests/*.test.js` ejecuta las regresiones. `tests/multiplayer-network-matrix.cjs` usa ocho motores reales o ocho conexiones con muestras sintéticas a través de TURN/UDP local. El deterioro se aplica a datagramas antes de SCTP, después de negociar ICE. No certifica ocho hogares, iPhone/Safari ni ausencia de tirones remotos tras pérdidas.

`node scripts/build.mjs` copia el frontend a dist sin recompilar el motor. `scripts/package-ack-recovery.py` verifica el alcance de los cambios, las pruebas y la preservación de la 16 antes de empaquetar.
