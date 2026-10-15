# Resultado de la composición gráfica en GPU

15 de octubre de 2026. Build `daytona-rev-a-central-experimental-15`.

La caída sostenida de rendimiento ultraancho identificada en la candidata 14 queda resuelta en las pruebas locales de single player: la composición del fondo deja de crecer en CPU con el ancho de la vista. El juego conserva su cadencia nativa y el campo de visión lateral. Esta conclusión se limita al equipo y escenas probados.

## Implementación

La GPU lee memoria System-24 original: tile RAM, caracteres y paletas. Un compute shader aplica las reglas de categoría, transparencia, prioridad, ventanas, capas deshabilitadas, scroll por línea y modos de separación. Produce dos texturas fijas de 496×384. La presentación interpola el fondo según las coordenadas enteras del bitmap nativo, mantiene los bordes de las pantallas 2D y compone fondo → geometría → HUD.

El HUD conserva el análisis original de grupos conectados en CPU, a dimensiones de arcade, para que un banner no se divida al cruzar grupos. La GPU recibe direcciones por píxel auxiliar y realiza la colocación visual. El análisis se reutiliza cuando no cambia la presencia de píxeles; un cambio sólo de color no altera el agrupamiento. La ruta natural de la secuencia probada no activó la recolocación lateral; se validaron sus combinaciones con patrones sintéticos y se conservaron las reglas de clasificación originales.

Las instantáneas se versionan por páginas de 4 KiB, con tamaños, alineación y vida independientes del heap de WebAssembly. Sólo se envían páginas modificadas. Un cambio de módulo, heap o recarga invalida la caché. Cada presentación sigue dibujándose con la cadencia del navegador; cuando no cambia el contenido, no vuelve a componer ni subir capas. Las reglas de simulación, el acumulador de tiempo, física, sonido y enlace permanecen intactos.

## Comparación pareada

Chrome headless, WebGPU real, adaptador NVIDIA Turing, DPR 1. Una cabina original y una nueva ejecutan entradas idénticas y la misma secuencia. Para cada pareja: arranque clásico de 1600 pasos, cambio de formato, dos pasos de estabilización y 180 pasos medidos por motor. Se repitió tres pantallas invirtiendo el orden de medición. Audio nativo habilitado.

| Configuración | Paso nativo, candidata 14 | Paso nativo, GPU | Reducción medida |
|---|---:|---:|---:|
| 1600×900, 1× | 8,71 ms | 2,74 ms | 68,5 % |
| 5760×1080, 1× | 18,83 ms | 2,89 ms | 84,6 % |
| Repetición de 5760×1080 | 18,57 ms | 2,89 ms | 84,4 % |
| 7680×1440, 2× | 19,14 ms | 3,29 ms | 82,8 % |
| 1600×120, 1× | 41,09 ms | 3,13 ms | 92,4 % |
| Clásico | 3,48 ms | 2,51 ms | 27,8 % |

Estos tiempos corresponden al paso nativo completo, no sólo a CPU de física ni a tiempo puro de GPU. Las medidas separan también preparación/envío gráfico y espera de finalización GPU. Esta última incluye callbacks del navegador y el método usa una espera por paso para aislar trabajo; no es el bucle habitual ni una predicción directa de FPS.

En tres pantallas la candidata sube 6 MiB de texturas de capas por paso. La nueva versión sube cero imágenes de capas; transmite páginas de datos cuando cambian. Las tablas y vértices 3D mantienen su transferencia existente. Cinco presentaciones repetidas sin un paso nuevo suben cero buffers y cero texturas en la nueva versión.

## Bucle real

Se ejecutó la interfaz real de single player, con sonido activo, alternando formatos durante intervalos de 12 segundos:

| Viewport | Simulación medida | Retraso pendiente final |
|---|---:|---:|
| 1600×900 | 57,54 pasos/s | 3,5 ms |
| 5760×1080 | 57,52 pasos/s | 3,4 ms |
| 7680×1440 | 57,55 pasos/s | 7,2 ms |
| 1600×120 | 57,44 pasos/s | 11,1 ms |
| Regreso a 1600×900 | 57,49 pasos/s | 14,8 ms |

Las pequeñas diferencias se deben al intervalo de conteo. La frecuencia nativa es aproximadamente 57,524 Hz. El retraso residual inferior a un paso es normal; no se acumularon segundos de deuda ni hubo una fase sostenida de recuperación acelerada en estas mediciones. El contexto de audio permaneció `running`; no se realizó una medición acústica de altavoces. ESC pausó y reanudó el single player y abrió/cerró los ajustes correctamente.

## Corrección visual y del estado

En 20 puntos del juego real, ambas versiones produjeron imágenes idénticas píxel por píxel, y coincidieron los hashes de vértices, lotes, audio, EEPROM, backup y niveles de vibración. Se cubrieron arranque, attract, curso/coche, carrera Normal, avance después del agotamiento del tiempo, menú arcade, cambios de proporción y recarga.

Trece patrones adicionales comprobaron scroll y máscaras de ventana, capas deshabilitadas, modos 1/2/3, composición del HUD desplazado y banners, reset y reemplazo de heap. Doce coincidieron exactamente; en un patrón de interpolación se observaron 45 canales con diferencia de un nivel (1/255). Es el límite de redondeo admitido para las operaciones de coma flotante de la GPU, no una diferencia de posición, orden o transparencia.

El test nativo de instantáneas validó páginas iniciales, conservación de versiones sin cambios, cambios de un único bloque, final de RAM de caracteres, cambios de presencia/color del HUD y recarga.

## Alcance

Sólo se probó **single player**. No se probaron salas ni multiplayer, siguiendo la petición. Su código de transporte y sincronización permanece igual; la nueva ruta gráfica se comparte por la aplicación. No se certifican tres monitores físicos, sincronización entre paneles, Safari/Metal ni el portátil del amigo. La mejora de clásico es medible aquí, pero no demuestra que todos los microtirones de otro equipo tengan la misma causa.

La candidata 14 y su ZIP se conservan con comprobación SHA-256. Los scripts de prueba y observadores de navegador no se incluyen en el ZIP publicable. Los recibos completos permanecen en `build/single-player-validation.json`, `build/gpu-fixtures-validation.json`, `build/gpu-benchmark-results.json`, `build/gpu-live-validation.json` y `build/gpu-snapshot-validation.txt`.
