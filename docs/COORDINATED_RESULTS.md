# Evaluación de la revisión 16 coordinada frente a la 15

Build `daytona-rev-a-central-experimental-16-coordinated`. Pruebas exclusivamente en single player, con ROM local, Chrome headless y WebGPU real en NVIDIA Turing. La 15 y el ZIP inicial de la 16 permanecen intactos.

## Resultado y decisión

La coordinación recupera la distribución de estados nuevos de la 15 en las pruebas con margen normal de presentación. El ahorro de CPU total del proceso renderer frente a la 15 es pequeño y queda dentro de la variación entre repeticiones. La ventaja demostrada es mantener simulación y generación de audio cuando escasean los callbacks de presentación, sin preparar todos los estados visuales intermedios.

La revisión es una opción experimental para comprobar esa resistencia y la fluidez percibida. La 15 sigue siendo una base estable válida: estos datos no justifican vender la revisión como una gran optimización de CPU. Esta entrega no certifica estabilidad multiplayer.

## Cadencia y coste medidos

Cada ventana dura aproximadamente ocho segundos. Normal y 30 FPS tienen dos repeticiones por versión, en orden inverso. Ultraancho y 10 FPS tienen una sola comparación por versión. Configuración igual en todos los casos: Enhanced, distancia 1x, vibración desactivada y volumen 0,3. La CPU representa un núcleo como 100 %, no el porcentaje de toda la máquina.

| Escenario | Versión | Simulación, pasos/s | Estados omitidos | CPU renderer, % de un núcleo | Preparaciones visuales |
| --- | --- | ---: | ---: | ---: | ---: |
| Normal, unos 75 refrescos/s | 15 | 57.47 | 0 | 34.29 | 922 |
| Normal, unos 75 refrescos/s | 16 inicial | 57.47 | 66 | 33.90 | 856 |
| Normal, unos 75 refrescos/s | 16 coordinada | 57.55 | 0 | 33.91 | 922 |
| Dibujo limitado a 30 FPS | 15 | 57.63 | 440 | 28.94 | 923 |
| Dibujo limitado a 30 FPS | 16 coordinada | 57.56 | 439 | 28.27 | 481 |
| Viewport 7680×1440 | 15 | 57.52 | 0 | 34.31 | 461 |
| Viewport 7680×1440 | 16 coordinada | 57.51 | 0 | 33.93 | 461 |
| Dibujo limitado a 10 FPS | 15 | 19.95 | 79 | 15.18 | 160 |
| Dibujo limitado a 10 FPS | 16 coordinada | 57.53 | 375 | 26.96 | 80 |

Las omisiones de las ventanas repetidas están sumadas. Con dibujo a 10/30 FPS y simulación a 57,5 Hz no se pueden mostrar todos los estados: esas omisiones son inevitables y no equivalen a la regresión observada con margen de refresco normal. Los estados enviados tampoco equivalen a imágenes con píxeles distintos: aquí se sigue el número de paso nativo. No se ha medido el scanout de monitores físicos.

En normal, el cambio relativo de CPU observado es -1.12 %. La 15 oscila entre 32.33 y 36.25 % de un núcleo; la revisión, entre 33.76 y 34.05 %. La diferencia entre medias es menor que la variación observada; no demuestra un ahorro relevante.

A 30 FPS el cambio relativo observado es -2.33 %, también pequeño. La preparación final baja de 923 a 481 conversiones en las dos ventanas, pero el resto del trabajo original continúa. Reducir esas conversiones casi a la mitad no reduce a la mitad la CPU total.

A 10 FPS, la 15 usa menos CPU porque sólo ejecuta unos 20 pasos/s y acumula retraso; no es una comparación de ahorro a velocidad de juego equivalente. La revisión mantiene unos 57,5 pasos/s y consume más CPU que esa simulación ralentizada. El test limita únicamente RAF; no representa una GPU física de 10 FPS que bloquee el hilo principal.

## Qué se corrigió

- Los pasos vencidos se coordinan con la marca temporal de RAF inmediatamente antes de presentar. Se evita que el jitter de entrega altere su fase.
- El mismo reloj conserva un temporizador de respaldo de 32 ms para refrescos ausentes, sin crear dos simulaciones.
- Una deuda pequeña causada por el coste del paso espera al siguiente refresco; deuda mayor sigue recuperándose en lotes cooperativos.
- Se elimina la supresión de dibujos de hasta 100 ms de la 16 inicial.
- La cola de GPU se limita a tres imágenes. Se evita encolar otro ejemplar de un estado que ya tiene presentación pendiente. No se espera bloqueando la CPU.

En normal, algunas llamadas de dibujo pueden omitir una repetición ya pendiente sin perder estados nuevos. El número DRAW por sí solo no distingue ese caso de una pérdida de actualización. Si una GPU realmente se satura, el límite puede omitir estados y agrega como máximo una cola pequeña de presentaciones, no una espera ilimitada.

## Verificación adicional

Catorce pruebas del reloj pasan, incluyendo jitter de despacho, cancelación y respaldo sin RAF. El motor WASM es idéntico al de la 16 inicial; no se modifican física, audio ni transporte nativos. La comprobación visual contra la 15 incluye veinte estados reales y trece patrones gráficos; los recibos de esta revisión están en `build/`.

El bucle real se prueba además con 10/20/30 FPS, señal de finalización de GPU demorada 100 ms, viewport 7680×1440, mando/teclado, bloqueo real del hilo de 140 ms y ESC/ajustes/reanudación. La señal demorada simula contrapresión y no mide tiempo físico de GPU.

| Fase de regresión | Simulación, pasos/s | Presentaciones/s | Máximo GPU en vuelo | Reinicios de audio |
| --- | ---: | ---: | ---: | ---: |
| native-refresh | 57.52 | 73.40 | 3 | 0 |
| draw-30 | 57.63 | 30.06 | 2 | 0 |
| draw-20 | 57.54 | 19.98 | 1 | 0 |
| draw-10 | 57.51 | 10.08 | 1 | 0 |
| gpu-busy-100ms | 57.54 | 24.37 | 3 | 0 |
| triple1440 | 57.47 | 74.76 | 3 | 0 |
| normal-after | 57.52 | 74.40 | 3 | 0 |

El bloqueo real de 140 ms detiene todo el hilo y puede requerir replanificar audio; el reloj recupera la deuda mediante lotes y no vuelve inmune al navegador. ESC y la política de ocultación de página se conservan. No se han probado iPhone, el portátil del amigo, monitores físicos ni multiplayer.

## Evidencia y límites

- `build/coordinated-comparison.json`: catorce ventanas, datos de proceso y secuencias de estados.
- `build/coordinated-summary.json`: agregación reproducible por escenario.
- `build/pacing-live-validation.json`: bucle real, audio, controles y pausas.
- `build/single-player-validation.json`, `gpu-fixtures-validation.json`, `visual-cache-validation.json` y `clock-tests.txt`: regresiones.

`SystemInfo.getProcessInfo` mide CPU acumulada de todos los hilos de los procesos renderer, incluyendo preparación visual, JavaScript y otros trabajos de ese proceso. `TaskDuration` mide duración activa de tareas del hilo principal; tampoco es tiempo puro de GPU. Las diferencias pequeñas requieren más repeticiones y otros equipos para establecer una ventaja general. Los ensayos normales se conservaron al reanudar los escenarios limitados tras corregir sólo el sondeo de la prueba; los archivos del producto no cambiaron entre esas fases.

El indicador CPU del panel continúa midiendo sólo el paso nativo y excluye preparación final trasladada al dibujo. No se usa como prueba de ahorro total. La distribución no incorpora observadores, limitadores de FPS ni ROM.
