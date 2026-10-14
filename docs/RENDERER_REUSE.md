# Reutilización de datos gráficos — experimento 5

Build `daytona-rev-a-central-experimental-5`. Mantiene cada dibujo de `requestAnimationFrame` y reutiliza las entradas de GPU cuando no avanzó la simulación. No añade interpolación, no modifica la resolución y no cambia el reloj, controles, audio ni transporte multiplayer. `main.js` y el WASM son idénticos al ZIP 4.

## Implementación

El renderizador identifica el estado preparado por el módulo WASM, su contador real de pasos y el buffer de memoria actual. En un refresco repetido conserva las dos texturas de capas, tablas de iluminación/color, buffer de vértices y recortes de los lotes. Cada dibujo crea su pase contra la textura actual del canvas, usa los datos preparados y vuelve a presentar normalmente.

Las coordenadas de recorte se preparan una vez por nuevo estado o nueva configuración de pantalla. El uniforme de pantalla utiliza un Float32Array persistente y se envía cuando cambia su configuración. Las texturas principales conservan su generación independiente, por lo que un cambio de tamaño no vuelve a enviar automáticamente sus 4 MiB.

Se invalida la caché al hacer reset, cambiar el módulo, sustituir el buffer del heap, preparar otra configuración de display o recrear las texturas de capas. Un cambio de tamaño del canvas sin nuevo paso también reconstruye uniforme y recortes. La recarga del mismo módulo con contador reiniciado fuerza los datos nuevos. Un estado sin vértices limpia los lotes anteriores. Se aplica al renderizador compartido por single player y multiplayer.

La revisión evita trabajo en refrescos repetidos. Las capas y tablas siguen enviándose en cada nuevo paso aunque sus bytes particulares no hayan cambiado; no se añadió comparación/hash por byte ni versiones nativas de esos campos. La preparación nativa de geometría por paso y los comandos de dibujo por refresco siguen ejecutándose.

## Validación

`tests/renderer-reuse-browser.cjs` ejecuta el motor real con ROM local en Chrome y renderiza el mismo estado con dos dispositivos WebGPU: renderizador extraído del ZIP 4 y versión optimizada. Lee los píxeles de ambos canvases y cuenta bytes/writes/submits de las colas reales, con instrumentación exclusiva del test.

Diez casos pasan con cero diferencias de píxeles y seis presentaciones en ambos renderizadores: attract clásico, siguiente paso, panorámico, vertical, resize de salida sin avanzar, reset sin avanzar, sustitución de vista del heap, regreso a clásico y recarga/reinicio. Hay estados con geometría y estados sin vértices. La sustitución del heap se prueba mediante una copia de su vista con las mismas direcciones/datos, no mediante un crecimiento real de memoria.

También se recorren tres programas controlados de refresco. Cada uno ejecuta 57 pasos reales y dibuja 75, 120 o 144 veces en ambos renderizadores. No son mediciones de un monitor físico ni de tiempo real:

| Dibujos | Pasos | Reducción de bytes de capas enviados | Diferencias de píxeles |
|---:|---:|---:|---:|
| 75 | 57 | 24 % | 0 |
| 120 | 57 | 52,5 % | 0 |
| 144 | 57 | 60,4 % | 0 |

En régimen continuo a 57,52 pasos/s y 75 refrescos/s, el ahorro teórico de estas transferencias repetidas es aproximadamente 23,3 %. Estos porcentajes se refieren a bytes de capas, no a FPS, carga total de GPU o duración de un frame. El beneficio de tiempo depende del dispositivo y del cuello de botella.

Las 42 pruebas JS pasan. `tests/lobby-browser.cjs` valida el motor final: inicio con enlace PeerJS, menú durante emulación, retorno al lobby, reinicio Grand Prix y restauración de single player. Mantiene SIM/LIST/DATA alrededor de 57–58 Hz. Se reutiliza el WASM validado en el experimento 4; no se recompila ni se atribuyen nuevas pruebas nativas a esta revisión.

Resultados detallados: `RENDERER_REUSE_RESULTS.json`. El test no distribuye ROM, instrumentación de colas ni renderizador de referencia. El paquete verifica por hash RC1, fuentes originales y los ZIP 1–4. El runtime cambia solamente `renderer.js` y el identificador del build respecto del 4, además de documentación/manifiesto.

## Límites

La validación nueva es Chrome local. Falta probar percepción, rendimiento sostenido y consumo en el iPhone y PC remoto. No se midió tiempo de ejecución de GPU ni se promete un porcentaje de mejora de FPS. El juego conserva sus aproximadamente 57,52 pasos/s y la cadencia de presentación del navegador. Las incidencias independientes de attract y limitaciones del enlace siguen descritas en los informes anteriores.
