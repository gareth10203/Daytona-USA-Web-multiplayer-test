# Optimización final WASM O2 — experimento 6

Build `daytona-rev-a-central-experimental-6`. Activa `-O2` en la etapa final de enlace de Emscripten/Binaryen y optimización del JavaScript generado. Se elige O2 como configuración principal, incluida la recompilación durante desarrollo. Conserva el renderizador de la versión 5.

## Alcance exacto

Se reenlazan los mismos objetos y bibliotecas que generaron el motor del ZIP 5, cambiando el nivel final de O0 a O2. Los objetos C++ existentes siguen compilados con O3 y las reglas `-fno-fast-math` y `-ffp-contract=off`; esta revisión no recompila todo el proyecto con O2 ni altera esas reglas. No activa LTO, SIMD, fast-math ni nuevos hilos.

No se modifica la ROM, código generado, fuentes del motor, protocolo, física, temporización ni preparación de audio. Los archivos de frontend son idénticos al ZIP 5 excepto el identificador del build. La configuración de build cambia para conservar O2 al recompilar.

## Comparación

`scripts/link-wasm-variant.py` produce motores aislados O2 y O3 a partir de la respuesta de enlace O0 guardada. La referencia O0 se extrae del ZIP 5. El motor publicado es exactamente el archivo O2 probado, comprobado por hash y por igualdad de archivos en el empaquetado.

`tests/wasm-optimization-browser.cjs` ejecuta Chrome local sin renderizado GPU ni reproducción Web Audio, pero **con emulación y generación de muestras de sonido activas**. Prueba arranque/attract individual, clásico, panorámico x2 y dos cabinas centrales con entradas de carrera y entrega FIFO determinista de tres pasos. Mide solo el tiempo de pared de `_daytona_step`, incluyendo lógica, geometría, capas y preparación de audio.

Cada workload individual tiene 600 pasos medidos y cada rol central 900, tras calentamiento. Primera pasada: O0/O2/O3. Segunda pasada: O2/O0 para comprobar el efecto del orden. Cinco ejecuciones coinciden en los 47 checkpoints de salida: hashes de capas, vértices/lotes, muestras de audio, texturas, EEPROM/backup, vibración y hash acumulado de todos los paquetes de cabina emitidos. Los hashes y estados se comparan entre variantes; no es una certificación completa de todos los posibles estados ni de equivalencia con hardware.

Promedio de las dos pasadas O0/O2:

| Workload | O0, ms/paso | O2, ms/paso | Reducción media |
|---|---:|---:|---:|
| Single clásico | 3,462 | 3,350 | 3,24 % |
| Single panorámico x2 | 11,315 | 11,003 | 2,76 % |
| Central master | 3,919 | 3,841 | 1,97 % |
| Central slave | 3,924 | 3,801 | 3,14 % |

La ganancia es moderada y hay variación entre ejecuciones. En la repetición, el promedio del master O2 fue ligeramente peor que O0; el promedio agregado de ambas pasadas mejora. No se afirma una mejora significativa uniforme ni un porcentaje fijo de ahorro en todos los equipos. O3 tuvo una sola pasada y no mostró ventaja clara frente a O2 en ella; no se generaliza esa observación a otros programas.

El WASM pasa de 4.906.221 a 4.121.686 bytes, una reducción del 15,99 %. El O3 pesa 4.103.533 bytes. Los tiempos de instanciación/importación también se registran, pero no se usan para prometer un arranque más rápido: cachés, orden y variación influyen.

Resultados: `WASM_O2_RESULTS.json`. Las capturas completas permanecen en `build/wasm-optimization-results.json` y `build/wasm-optimization-repeat.json`; no se distribuye la ROM.

## Desarrollo y regresión

Las pruebas y diagnósticos se ejecutan con el mismo motor O2 que se entrega. Las 42 pruebas JS pasan. `tests/lobby-browser.cjs` comprueba el build final con PeerJS real, contadores del diagnóstico, reinicio Grand Prix y restauración de single player.

O2 no impide investigar mediante las sondas de CPU simulada, contadores, errores y reportes. Para depuración C++ línea por línea, el código optimizado puede reorganizar instrucciones, integrar funciones o eliminar variables; cuando haga falta usaríamos una compilación separada con símbolos y/o menor optimización. No se incluyen mapas de fuentes o símbolos nuevos en el runtime distribuido.

`scripts/build-central.py` utiliza O2 por defecto al enlazar. `node scripts/build.mjs` sigue copiando el frontend sin sustituir el motor. `scripts/link-wasm-variant.py` es el helper de comparación; no cambia los assets distribuidos.

## Límites y preservación

El tiempo por paso no equivale al porcentaje de utilización de un núcleo: quedan fuera JS del renderizador, envío de red, reproducción Web Audio, GPU y trabajo del navegador. No se midió directamente el 80 % comunicado por el usuario ni se promete una reducción proporcional de ese porcentaje.

Las pruebas de rendimiento son Chrome local; falta confirmación nueva en iPhone y equipos remotos. Los casos de recuperación del retraso y bloqueo de attract siguen independientes de esta revisión. Todos deben usar el build 6, aunque el protocolo central se conserva.

RC1, los proyectos originales y los ZIP 1–5 permanecen intactos y se verifican por hash antes y después del empaquetado.
