# Simulación y presentación coordinadas — revisión 16

## Problema y cambio

La versión 15 ya reutilizaba datos gráficos entre presentaciones y componía tiles, fondo y HUD en GPU. Su bucle continuaba dependiendo de `requestAnimationFrame`: admitía como máximo dos pasos nativos por callback y preparaba la geometría final en cada paso. Si sólo había diez callbacks por segundo, esa ruta no podía sostener los aproximadamente 57,524 pasos nativos por segundo.

La versión 16 introduce `web/simulation-clock.js`. Su primera implementación podía omitir estados por la fase del temporizador y una política de presentación demasiado restrictiva. La revisión `experimental-16-coordinated` procesa pasos vencidos inmediatamente antes de dibujar, con la marca temporal estable de RAF. Usa el temporizador como respaldo del mismo reloj cuando no llegan refrescos durante 32 ms. Todo sigue en un único hilo y no hay paralelismo entre JavaScript, simulación y preparación visual.

El reloj contabiliza también el tiempo real consumido por los pasos ejecutados antes de programar su siguiente plazo. Una deuda final menor de dos intervalos espera a un refresco regular en lugar de intercalar un paso justo después del dibujo. Recupera deuda mayor en lotes de presupuesto orientativo de 6 ms, con un máximo de ocho pasos por lote y cesiones entre ellos. Un paso individual puede superar ese presupuesto: no hay interrupción preventiva de llamadas nativas. Los temporizadores sustituidos se invalidan para evitar dos callbacks activos; una marca de RAF anterior a trabajo ya realizado nunca hace retroceder el tiempo. No se eliminan pasos para hacer parecer que se recuperó la cadencia.

`daytona_step()` marca la salida visual como pendiente. `daytona_prepare_visual()` convierte la geometría exportable sólo cuando el renderer va a presentar y únicamente si cambió el estado. Los cambios de dimensiones invalidan esta caché y recargar reinicia su contador. No se omite la ejecución original del juego, física, TGP, procesamiento interno de geometría, generación de audio o comunicaciones por paso.

El renderer admite como máximo tres presentaciones en vuelo y libera ese límite mediante `GPUQueue.onSubmittedWorkDone()`. Mientras espera, devuelve el control inmediatamente; tampoco prepara un estado gráfico que no podrá enviar. Si ya existe una presentación pendiente del mismo estado y dimensiones, evita encolar su repetición. Tres huecos toleran callbacks de finalización entregados tarde sin el límite agresivo de una sola imagen de la 16 inicial. Se acepta una cola pequeña a cambio de menos omisiones; sigue existiendo contrapresión cuando la GPU tarda realmente. Se retira la supresión anterior de presentaciones durante 100 ms.

## Pruebas y alcance

Pruebas realizadas sólo en single player, con ROM local, Chrome headless y WebGPU real en NVIDIA Turing. Los flags de las pruebas evitan throttling de las ventanas de automatización; **no certifican ejecución en segundo plano**. Los tamaños de viewport son resoluciones simuladas, no tres monitores físicos. No se han probado iPhone, el portátil del amigo o sesiones multiplayer en esta entrega.

`tests/pacing-live.cjs` usa el bucle real e inyecta observadores externos a la descarga. Limita sólo los callbacks RAF y, en un caso, demora 100 ms la entrega de la señal de GPU terminada. Esto comprueba la independencia del reloj y la contrapresión; no representa una medición de tiempo físico de GPU ni garantiza el mismo resultado si un controlador bloquea el hilo principal.

Los valores exactos de cada ejecución están en `build/pacing-live-validation.json`. La simulación debe permanecer entre 56,5 y 58,5 pasos/s en cada fase, con deuda final inferior a 35 ms. Se comprueba generación PCM próxima a 48 kHz, AudioContext activo y como máximo un reinicio de planificación por fase. Esto valida entrega de muestras; no equivale a una escucha física de los altavoces.

Los resultados de la revisión y su comparación contra la 15 se recogen en `COORDINATED_RESULTS.md`. Los recibos iniciales de la 16 se conservan en `build/before-coordination`; no deben confundirse con las nuevas ejecuciones. Reducir conversiones finales al presentar menos estados no implica la misma reducción porcentual de CPU total.

También se comprueban mando y teclado a 10 FPS; una interrupción real del hilo de 140 ms seguida de recuperación; y ESC, ajustes y reanudación sin acumular tiempo del menú. Una interrupción real detiene todo el hilo, y puede obligar al audio a replanificarse. El objetivo es recuperar mediante lotes cooperativos, no hacer imposible un corte.

`tests/single-player-parity.cjs` compara veinte estados reales contra dos instancias independientes de la versión 15: imágenes idénticas y hashes coincidentes de geometría, batches, audio, EEPROM, backup y vibración. Incluye carrera Normal y avance posterior al agotamiento del tiempo. La secuencia natural no activó el HUD lateral; patrones explícitos cubren esa composición.

`tests/gpu-fixtures.cjs` comprueba trece casos de scroll, ventanas, máscaras, capas, HUD y cachés. `tests/visual-cache.cjs` comprueba explícitamente que 1600 pasos no producen ninguna conversión final antes de presentar, que ocho pasos intermedios sólo preparan el último estado y que redimensionar y recargar invalidan la caché correctamente. `tests/simulation-clock.test.js` cubre catorce casos del reloj con tiempo controlado.

`tests/coordinated-comparison.cjs` ejecuta la misma secuencia nativa de carrera en la 15, la 16 original conservada y la revisión. Mide estados distintos enviados, pasos intermedios omitidos y huecos entre cambios. Usa `SystemInfo.getProcessInfo` para obtener tiempo de CPU de todos los hilos de los procesos renderer; el porcentaje representa un núcleo como 100 %. `Performance.getMetrics` aporta además duración de tareas del hilo principal. No es el contador parcial de CPU del panel. Las repeticiones en orden inverso ayudan a ver variabilidad, pero no constituyen una certificación estadística o de todos los dispositivos.

## Límites y diagnóstico

- El reloj no depende del número de dibujos, pero comparte el hilo. Si un paso nativo consume más de su intervalo o la preparación visual bloquea demasiado tiempo, no puede garantizarse la cadencia. La deuda se recupera cuando vuelve a existir margen; todavía puede percibirse aceleración de recuperación.
- No hay interpolación de toda la escena entre estados nativos. Un monitor de 144 Hz puede recibir presentaciones repetidas; no aparecen 144 estados de simulación por segundo.
- El límite de tres imágenes protege frente a acumulación ilimitada y puede omitir estados si la GPU no sostiene el ritmo. No se garantiza un dibujo por refresco ni ausencia total de tirones de sistema. Los estados omitidos por presentar a 10/30 FPS con simulación a 57,5 Hz son inevitables y deben distinguirse de omisiones con margen de presentación suficiente.
- ESC y ocultar la página conservan la política existente. Un Worker tampoco se ha añadido ni se promete continuidad ante suspensión del navegador.
- El transporte y los módulos de lobby no cambian, salvo la identificación de build. Sin embargo, el bucle compartido cambió y multiplayer requiere su propia validación posterior.
- El contador de CPU por paso del diagnóstico ya no incluye la conversión visual final, que ocurre al dibujar. Compararlo directamente con versiones anteriores no mide por sí solo toda la mejora de CPU. La prueba de bucle mide también duración de lotes, pero no tiempo puro de GPU.

## Archivos y reproducción

- `node --test tests/simulation-clock.test.js`
- `node tests/single-player-parity.cjs`
- `node tests/gpu-fixtures.cjs`
- `node tests/pacing-live.cjs`
- `node tests/visual-cache.cjs`
- `node tests/coordinated-comparison.cjs`

Las pruebas de navegador requieren Playwright (`PLAYWRIGHT_PATH` permite señalar la instalación local), Chrome y la ROM local en la ruta indicada por los scripts. Ejecutar las mediciones de cadencia sin otras pruebas pesadas en paralelo. `PACING_CONTROL_ONLY=1` ejecuta sólo controles y recuperación y genera un recibo independiente; no sustituye la prueba completa.

`scripts/package-pacing.py` exige los recibos completos aprobados, comprueba que se conserva la versión 15, verifica los archivos publicados y genera el manifiesto SHA-256 y el ZIP. La distribución no contiene pruebas, observadores ni ROM.
