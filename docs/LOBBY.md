# Daytona USA — recuperación de movimiento experimental 9

Build `daytona-rev-a-central-experimental-9`. Copia independiente en `multiplayer-interpolation/`; conserva el experimento 8, sus archivos y su ZIP.

Primera etapa: reserva adaptativa de muestras y corrección gradual de la pose remota al recuperar datos tras una interrupción. El transporte sigue siendo el del experimento 8: fiable y ordenado, ocho instantáneas en vuelo por conexión, una pendiente reciente y bloques repetidos compactados sin pérdida de campos. No se modifican los plazos de desconexión ni la pausa/visibilidad, no hay reincorporación en carrera ni migración del host.

La reserva se ajusta entre 4 y 16 ticks del reloj de origen. Las correcciones de recuperación se reparten durante 12 pasos locales, aproximadamente 200 ms cuando la simulación funciona a 57,5 Hz. Se mantienen los reinicios por escena, coche y desplazamientos incompatibles con el movimiento registrado. No se añade extrapolación a la proyección que ya realiza el TGP original.

## Probar

`node scripts/serve.js dist 8090`

Abrir http://localhost:8090, cargar la ROM local y usar **build 9 en todas las cabinas**. El ZIP está preparado para GitHub Pages: subir su contenido conservando la estructura. No incluye ROM, objetos de compilación ni motores de diagnóstico.

## Verificar

- `node --test tests/*.test.js`: pruebas del lobby, control, flujo y formato de estados.
- `tests/central-motion-native.cpp`: recuperación, reinicios reales, relojes desbordados, límites y preservación de bytes de control.
- `scripts/build-central.py`: motor O2; objetos del juego original reutilizados sin cambios.
- `scripts/build-motion-network-audit.py`: motor con sondas de lectura separado del distribuido.
- `tests/motion-network-browser.cjs`: dos motores reales y problemas TURN/UDP, con `MOTION_CASE=cuts`, `rtt340`, `rtt1000` o `disconnect`.
- `tests/interpolation-regression-browser.cjs`: comparación de single player y cadencia nativa frente al motor 8.
- `tests/motion-audit-parity.cjs`: comparación de salidas del motor 9 con y sin sondas.
- `tests/npc-filter-browser.cjs`: regresión del filtro de NPC con tres cabinas.

El bucle principal, audio, renderer y frontend de juego permanecen iguales al experimento 8; cambian el motor de reproducción de poses y la identidad del build. Los informes históricos conservan el alcance de sus versiones. Resultados y límites: [docs/INTERPOLATION_RECOVERY.md](docs/INTERPOLATION_RECOVERY.md).
