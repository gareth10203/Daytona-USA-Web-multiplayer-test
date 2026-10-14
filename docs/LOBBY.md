# Daytona USA — enlace centralizado experimental

Build `daytona-rev-a-central-experimental-2`. Copia independiente de RC1; la candidata original se conserva en `../multiplayer-lobby/releases/RC1`. El ZIP del experimento 1 también se conserva.

Cada cabina envía sus datos directamente al host de manera independiente. El host distribuye estados preparados para cada destinatario sin circulación por las cabinas ni espera de todos por actualización. La CommBoard adaptada mantiene la interfaz de memoria del juego y la entrega FG corregida. El programa original, física y assets de la ROM permanecen intactos. La temporización del dispositivo de enlace cambia intencionalmente; no se afirma equivalencia con el hardware.

El lobby conserva ocho asientos, chat, nombre guardado, controles alineados, retirada de jugadores y aviso sonoro. Comprueba presencia tras 12 segundos sin respuesta y reserva el asiento 30 segundos mientras intenta reconectar. Restaura la sala y confirma Ready/chat sin duplicar acciones; los cortes recuperables de señalización conservan los canales existentes. Todos los participantes deben usar el build 2; su ingreso no es compatible con RC1 ni con el experimento 1.

## Probar

```powershell
node scripts/serve.js dist 8088
```

Abrir http://localhost:8088 y cargar la ROM local. Para Pages, publicar el contenido de `dist/` o el ZIP experimental, sin ROM. No sustituir RC1 hasta probarlo entre dispositivos.

## Compilar y verificar

`node scripts/build.mjs` copia el frontend a dist conservando el motor centralizado.

`scripts/build-central.py` compila las fuentes del dispositivo en `native/` y reenlaza con los objetos locales del juego y bibliotecas originales ya compilados. Requiere el emsdk y la caché existente del workspace; no modifica esos objetos. `native/m2_board.cpp` conserva la instrumentación y corrección de fase de RC1 y se recompila para el nuevo tamaño del dispositivo.

`node --test tests/*.test.js` pasa 41 pruebas y verifica protocolo, distribución, permisos, chat, presencia y recuperación. `tests/lobby-recovery-browser.cjs` prueba recuperación con tres cabinas Chrome y conexiones PeerJS reales. `tests/lobby-layout.cjs` verifica desktop/móvil y `tests/lobby-browser.cjs` el arranque/reinicio del motor y single player. `tests/central-native.cpp` prueba directamente el dispositivo nativo en WASM. `tests/central-benchmark.cjs` compara cabinas reales con retrasos, jitter y pausas controladas; admite TEST_URL, TEST_CABINETS, TEST_TAG y TEST_EXTENDED. Usa el Playwright instalado y una ROM local; no empaqueta los assets.

La recuperación y sus límites están en [docs/LOBBY_RECOVERY.md](docs/LOBBY_RECOVERY.md). La investigación y resultados del motor central del experimento 1 están en [docs/CENTRAL_LINK_INVESTIGATION.md](docs/CENTRAL_LINK_INVESTIGATION.md). No hay extrapolación de posiciones ni datos ficticios; se retienen las últimas muestras reales. La centralización no añade todavía netcode de predicción/rollback ni garantiza colisiones idénticas con RTT alto. La recuperación requiere mantener la página abierta y no incorpora migración del host ni reanudación de una carrera interrumpida.
