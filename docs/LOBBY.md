# Daytona USA — predicción temporal, experimento 18

Build `daytona-rev-a-central-experimental-18-temporal-prediction`. Copia independiente de la revisión 17 con el botón de Discord corregido. La carpeta y los ZIP de la 17 se conservan.

Esta revisión intenta reducir la diferencia entre la posición que conduce una cabina y la que ven las demás. Estima la antigüedad de las muestras con intercambios de cuatro marcas de tiempo, incluye la retención en el host y el segundo trayecto entre clientes, reduce la reserva de interpolación y permite una continuación horizontal corta basada en velocidad y dirección auténticas. Compensa los dos pasos de proyección que ya aplica el programa arcade para evitar predecir dos veces.

No introduce un servidor de física ni una clasificación nueva. Las reglas, clasificación y resultado siguen perteneciendo al juego original. Las posiciones y contactos de todas las cabinas no se vuelven idénticos con este cambio. Sigue siendo un experimento para comparar personalmente con la 17.

Para probar: `npm run serve`, abrir http://localhost:8100 y cargar la ROM local. Todas las cabinas deben usar la misma revisión. El ZIP `daytona_temporal_prediction_experimental_18_github_pages.zip` contiene los archivos para publicar en la raíz de GitHub Pages, sin ROM ni instrumentos de prueba. Los módulos, estilos, motor y WASM incluyen una referencia de versión para evitar mezclar archivos de la 17 que conserve la caché.

Se conservan el enlace central, ocho estados en vuelo y uno pendiente por conexión, la supervisión de confirmaciones de la 17 y el retorno al lobby al ocultar una cabina. Single player conserva el funcionamiento anterior; la predicción sólo se utiliza en el enlace central multiplayer.

Detalles, metodología y límites en [docs/TEMPORAL_PREDICTION.md](docs/TEMPORAL_PREDICTION.md). Los documentos de las revisiones anteriores en `docs/` son históricos.

`npm test` ejecuta las regresiones de JavaScript. Las pruebas nativas están en `tests/temporal-motion.cpp` y `tests/temporal-comm.cpp`. Las comparaciones con dos motores reales, canal RTC y deterioro de datagramas se realizan con `tests/finish-line-audit.cjs`; sus instrumentos sólo se compilan en `build/finish-audit`, nunca en el motor publicable. `tests/single-player-parity.cjs` compara audio, geometría, guardados, controles y píxeles contra la 17. `scripts/package-temporal.py` verifica las pruebas y la preservación de la 17 antes de crear el ZIP.
