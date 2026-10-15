# Daytona USA — consola del host experimental 10

Build `daytona-rev-a-central-experimental-10`. Copia independiente en `multiplayer-console/`; conserva el experimento 9, sus archivos y su ZIP. El motor nativo y su cargador siguen siendo los del experimento 9.

El host dispone de **Connections**, con estado de cada participante, RTT individual, SIM informado, edad de actualizaciones, colas, tráfico de juego y eventos de interrupción y reconexión. Las causas observadas se distinguen de las informadas por una cabina y de las acciones de los usuarios. No se modifica la política de desconexión ni la recuperación de movimiento.

## Probar

`node scripts/serve.js dist 8091`

Abrir http://localhost:8091, cargar la ROM local y usar **build 10 en todas las cabinas**. El host abre Connections desde el lobby o el menú de carrera. Export report descarga el informe. Tras salir de la sala, Settings → Experimental permite abrir el último informe del host hasta recargar la página.

El ZIP está preparado para GitHub Pages: subir su contenido conservando la estructura. No incluye ROM, sondas ni motores de diagnóstico.

## Verificar

- `npm test`: 71 pruebas del lobby, flujo y formato de estados, informes y causas.
- `npm run build`: copia el frontend a dist conservando el motor.
- `tests/host-console-browser.cjs`: consola con dos cabinas reales, exportación, interrupción identificada y reconexión; fixtures visuales de ocho participantes.
- `tests/lobby-browser.cjs`: regresión de lobby, juego enlazado y restauración de single player.
- `scripts/package-runtime.py`: comprueba preservación del 9 y genera el ZIP 10.

Para los tests de navegador, PLAYWRIGHT_PATH debe señalar el paquete Playwright instalado; se requiere Chrome y la ROM local de prueba. Los scripts nativos y ensayos de red heredados son históricos del experimento 9 y conservan sus puertos y dependencias. Esta versión no recompila el motor.

[Funcionamiento y límites de la consola](docs/CONNECTION_CONSOLE.md). [Recuperación de movimiento conservada del 9](docs/INTERPOLATION_RECOVERY.md). Los documentos y resultados históricos mantienen el alcance de sus builds.
