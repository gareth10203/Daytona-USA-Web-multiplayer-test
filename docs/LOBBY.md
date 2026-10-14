# Daytona USA — enlace centralizado experimental

Build `daytona-rev-a-central-experimental-7`. Copia independiente de RC1; la candidata original se conserva en `../multiplayer-lobby/releases/RC1`. Los ZIP de los experimentos 1–6 también se conservan. Esta revisión corrige la apertura y RTT del lobby, amplía esperas e incorpora eventos locales de conexión. Mantiene exactamente el motor O2 de la versión 6 y el renderizador del 5.

Cada cabina envía sus datos directamente al host de manera independiente. El host distribuye estados preparados para cada destinatario sin circulación por las cabinas ni espera de todos por actualización. El experimento 3 entrega el contador completo del master y reproduce movimiento remoto mediante una historia acotada, interpolando posición, velocidad y ángulos identificados. La adaptación mantiene FG a cadencia local. La ROM y sus objetos generados permanecen intactos; el tratamiento nativo del reloj/enlace y de los estados remotos cambia intencionalmente, sin afirmar equivalencia de colisiones o comportamiento con el hardware.

El lobby conserva ocho asientos, chat, nombre guardado, controles alineados, retirada de jugadores y aviso sonoro. Comprueba presencia tras 20 segundos sin respuesta y reserva el asiento 30 segundos mientras intenta reconectar. Restaura la sala y confirma Ready/chat sin duplicar acciones; los cortes recuperables de señalización conservan los canales existentes. Todos los participantes deben usar el build 7; conserva el protocolo central, pero el lobby exige un build coincidente. No es compatible con RC1 ni con los experimentos 1 y 2.

## Probar

```powershell
node scripts/serve.js dist 8088
```

Abrir http://localhost:8088 y cargar la ROM local. Para Pages, publicar el contenido de `dist/` o el ZIP experimental, sin ROM. No sustituir RC1 hasta probarlo entre dispositivos.

## Compilar y verificar

`node scripts/build.mjs` copia el frontend a dist conservando el motor centralizado.

`scripts/build-central.py` compila las fuentes del dispositivo en `native/` y reenlaza con los objetos locales del juego y bibliotecas originales ya compilados. Requiere el emsdk y la caché existente del workspace; no modifica esos objetos. `native/m2_board.cpp` conserva la instrumentación y corrección de fase de RC1 y se recompila para el nuevo tamaño del dispositivo.

`node --test tests/*.test.js` pasa 49 pruebas y verifica protocolo, distribución, permisos, chat, presencia y recuperación. `tests/lobby-recovery-browser.cjs` prueba recuperación con tres cabinas Chrome y conexiones PeerJS reales. `tests/lobby-layout.cjs` verifica desktop/móvil y `tests/lobby-browser.cjs` el arranque/reinicio del motor y single player. `tests/central-native.cpp` prueba directamente el dispositivo nativo en WASM, con una pila de 1 MiB para sus varios dispositivos locales. Las auditorías de movimiento de dos/cuatro cabinas, jitter FIFO y pausas se describen en el informe del arreglo. `tests/central-benchmark.cjs` admite TEST_URL, TEST_CABINETS, TEST_TAG y TEST_EXTENDED. Usa el Playwright instalado y una ROM local; no empaqueta los assets.

El arreglo del reloj/movimiento y sus límites están en [docs/REMOTE_MOTION_FIX.md](docs/REMOTE_MOTION_FIX.md), y el diagnóstico previo en [docs/REMOTE_MOTION_INVESTIGATION.md](docs/REMOTE_MOTION_INVESTIGATION.md). El búfer añade normalmente 4–8 ticks de retraso a los coches remotos, sin pasar los controles propios por ese búfer ni extrapolar posiciones. La recuperación del lobby requiere mantener la página abierta y no incorpora migración del host ni reanudación de una carrera interrumpida; se describe en [docs/LOBBY_RECOVERY.md](docs/LOBBY_RECOVERY.md). Los resultados del motor anterior permanecen en [docs/CENTRAL_LINK_INVESTIGATION.md](docs/CENTRAL_LINK_INVESTIGATION.md).

La corrección de NPC y su comparación antes/después se documentan en [docs/NPC_FILTER_FIX.md](docs/NPC_FILTER_FIX.md). La prueba nueva usa dos y tres cabinas Chrome con jitter y pausa de 500 ms: elimina los intervalos cero y valores desbordados, conservando el reloj compartido real. Falta validación nueva en iPhone y entre hogares. El bloqueo al regresar a attract sigue siendo una incidencia independiente abierta.

La reutilización del renderizador y sus pruebas de paridad están en [docs/RENDERER_REUSE.md](docs/RENDERER_REUSE.md). Mantiene la cadencia de pantalla y ahorra copias/preparación cuando no avanzó el juego; no aumenta los FPS únicos. `tests/renderer-reuse-browser.cjs` compara imágenes WebGPU y envíos reales contra el renderizador del ZIP 4.

La optimización final O2 y la comparación O0/O2/O3 están en [docs/WASM_O2.md](docs/WASM_O2.md). `scripts/build-central.py` usa O2 al enlazar y conserva O3 en las fuentes existentes con precisión estricta. Puede usarse para pruebas durante desarrollo; el diagnóstico de la emulación continúa disponible. No activa LTO, SIMD ni hilos nuevos. `tests/wasm-optimization-browser.cjs` mide pasos nativos con sonido y compara outputs y paquetes centrales con la versión 5.

La tolerancia del lobby está en [docs/LOBBY_LATENCY.md](docs/LOBBY_LATENCY.md): apertura 30 s, falta de progreso 10 s, silencio 20 s, recuperación 30 s. No hay expulsión por un valor de RTT. El diagnóstico schema 3 registra eventos aun con el overlay apagado. `tests/high-latency-browser.cjs` aplica retrasos FIFO de aplicación y una cola limitada en el harness, sin alterar el runtime distribuido ni emular toda una WAN.
