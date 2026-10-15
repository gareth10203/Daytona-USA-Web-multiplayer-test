# Daytona USA — informes de rendimiento experimental 11

Build `daytona-rev-a-central-experimental-11`. Copia independiente en `multiplayer-reports/`; conserva el experimento 10 y su ZIP. Motor nativo y cargador idénticos a los de las versiones 9 y 10.

El host puede descargar desde Connections los informes de rendimiento de todas las cabinas. Se recopilan automáticamente durante el juego, aunque Show performance overlay esté apagado, y se conservan al volver al lobby. Export all reports descarga el conjunto; al abrir un jugador, Download performance descarga su informe individual.

Hasta 300 muestras por participante, aproximadamente cinco minutos recopilados. Se indican cobertura y huecos. Los informes recibidos permanecen tras una salida; la última sala del host se conserva hasta recargar la página. No se cambia la recuperación de movimiento, el transporte de estados arcade ni los límites de desconexión.

## Probar

`node scripts/serve.js dist 8092`

Abrir http://localhost:8092 y cargar la ROM local. Usar **build 11 en todas las cabinas**. El ZIP está preparado para GitHub Pages: subir su contenido conservando la estructura. No incluye ROM ni motores de diagnóstico.

## Verificar

- `npm test`: 86 pruebas de lobby, flujo, consola y rendimiento compartido.
- `npm run build`: copia el frontend conservando el motor.
- `tests/performance-browser.cjs`: tres cabinas reales, comparación de mediciones, descargas y recuperación de informes pendientes.
- `tests/host-console-browser.cjs`: consola y disposición desktop/mobile.
- `tests/lobby-browser.cjs`: lobby, juego enlazado, reinicio y single player.
- `scripts/package-runtime.py`: preservación del 10 y generación del ZIP 11.

Los tests de navegador requieren Chrome, Playwright y la ROM de prueba local. Los ensayos nativos y de red heredados son históricos y conservan sus puertos y dependencias.

[Contenido, límites y protocolo de informes](docs/REMOTE_PERFORMANCE.md). [Consola original del 10](docs/CONNECTION_CONSOLE.md). [Recuperación de movimiento conservada del 9](docs/INTERPOLATION_RECOVERY.md).
