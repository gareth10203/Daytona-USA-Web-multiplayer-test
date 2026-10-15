# Daytona USA — simulación y presentación coordinadas, revisión 16

Build `daytona-rev-a-central-experimental-16-coordinated`. Revisión de la 16 que conserva la carpeta y el ZIP de la 15, y el ZIP inicial de la 16. Coordina simulación y presentación dentro del mismo hilo, sin Workers.

## Probar

`node scripts/serve.js dist 8097`

Abrir http://localhost:8097, cargar la ROM local y seleccionar **SINGLE PLAYER**. La descarga `daytona_frame_pacing_experimental_16_coordinated_github_pages.zip` contiene los archivos publicables: extraer su contenido en la raíz de GitHub Pages, conservando juntos el frontend y el motor. No incluye ROM.

## Qué cambia

- La simulación conserva su paso nativo: `16000000 / (656 × 424)`, aproximadamente **57,524 Hz**. Con refrescos regulares procesa los pasos vencidos justo antes de dibujar, usando la marca temporal estable de RAF. Un temporizador de respaldo mantiene el mismo reloj si faltan refrescos durante 32 ms.
- Cuando existe retraso, recupera pasos en lotes cooperativos: presupuesto de 6 ms y límite de ocho pasos por lote. Cede el hilo entre lotes. El presupuesto es orientativo porque una llamada nativa no se puede interrumpir; no se descarta tiempo de simulación.
- El motor prepara la geometría final exportable cuando el renderer puede usarla. Si varios pasos transcurren antes de dibujar, convierte sólo el estado más reciente. La lógica original del juego, TGP, geometría interna y audio sigue ejecutándose en cada paso.
- La presentación sigue usando los refrescos del navegador y las cachés de la versión 15. La cola tiene un máximo de tres imágenes pendientes de finalización, comprobadas asíncronamente. Un estado que ya está pendiente no vuelve a ocupar un hueco. Si la cola está llena, se omite la preparación y presentación de ese estado; el próximo intento toma el más reciente.
- Una pequeña deuda generada al terminar un paso espera al siguiente refresco regular; la recuperación inmediata se reserva para deuda mayor o refrescos ausentes. Se retira la regla que podía suprimir dibujos durante 100 ms. No se descarta tiempo de simulación.
- ESC pausa single player y cancela el reloj. Reanudar inicia una nueva referencia temporal, sin recuperar el tiempo que se pasó en el menú.

No cambia la política de visibilidad: ocultar la página sigue pausando single player y aplica el comportamiento previo de sala en multiplayer. Esta separación no garantiza ejecución en segundo plano ni permite usar dos núcleos. Una caída del rendimiento de la propia simulación o un bloqueo del hilo aún puede causar tirones y recuperación posterior.

## Validación

Se prueba **únicamente single player**, según lo solicitado. El reloj y el renderer son compartidos por la aplicación, pero esta entrega no certifica multiplayer, dispositivos remotos ni navegadores móviles.

Pruebas con ROM local y WebGPU real en Chrome/NVIDIA Turing:

- Catorce pruebas del reloj: cadencia, deuda temporal, presupuesto, pausa, reanudación, cancelación, errores, coordinación con RAF, jitter y respaldo sin refrescos.
- Veinte comparaciones de imagen y estado nativo contra la versión 15: arranque, attract, selecciones, carrera Normal, test arcade, Classic/Enhanced, ultraancho, vertical y recarga. Imágenes idénticas; coinciden los hashes de geometría, audio, guardado y vibración.
- Trece patrones gráficos System-24 y de HUD; sin diferencias de canales en esta ejecución.
- Comprobación explícita de preparación diferida: pasos sin preparar gráficos, reutilización del mismo estado, invalidación al cambiar dimensiones y reinicio al recargar.
- Bucle real con presentación limitada a 10, 20 y 30 FPS, retraso artificial de la señal de finalización de GPU y viewport de 7680×1440. Incluye controles, una interrupción real de 140 ms y pausa/ajustes/reanudación.
- Comparación de la 15, la 16 inicial y esta revisión: distribución de estados, omisiones, edad del estado y CPU de los procesos renderer completos. Incluye repeticiones de cadencia normal y 30 FPS, ultraancho y 10 FPS. Los resultados se documentan en `docs/COORDINATED_RESULTS.md`.

Los recibos están en `build/`; los resultados y límites se explican en [docs/FRAME_PACING.md](docs/FRAME_PACING.md). Las limitaciones de FPS y observadores sólo existen en las pruebas, no en la descarga.

## Compilar

`scripts/build-pacing.py` recompila el puente `native/daytona_web.cpp` y reutiliza los objetos del runtime de la versión 15. Conserva el enlace O2 y las reglas estrictas de coma flotante. No modifica el código del juego ni del transporte. `node scripts/build.mjs` copia el frontend a `dist` conservando el motor compilado.

Frontend y motor incorporan dos exportaciones nuevas de preparación visual y deben publicarse juntos. No hay requisitos nuevos de aislamiento entre orígenes. Todos los participantes de una sala necesitan la misma build.
