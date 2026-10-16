# Revisión 18 — corrección del arranque

El mensaje `Cannot read properties of null (reading 'reset')` podía aparecer al elegir una ROM después de que WASM hubiese iniciado pero WebGPU siguiera pendiente o hubiera fallado. La carga de ROM llamaba a `renderer.reset()` sin disponer de renderizador y reemplazaba la causa original del fallo.

La selección espera ahora a que termine la inicialización completa de WASM y gráficos. Si falla, conserva la causa original y evita cargar la ROM en un motor sin renderizador. El mensaje de archivos de motor ausentes también se conserva. El recurso `main.js` tiene una referencia de caché nueva.

La captura por sí sola no identifica el fallo inicial del dispositivo. En Chrome se reprodujo exactamente ese mensaje con un adaptador WebGPU ausente; también podría ocultar otros fallos del arranque. Saber sólo que el jugador usa Windows no identifica su navegador, adaptador ni causa. El parche permite obtener ese mensaje inicial, pero un fallo real de compatibilidad gráfica todavía requiere resolver su causa.

Validación: seis escenarios de navegador con el WASM publicable y ROM local. Reproducción en el frontend original; conservación del error al fallar el adaptador, el shader o el archivo del motor; selección temprana mientras están pendientes la GPU o WASM, seguida de una entrada real en single player. Pasan también las 118 regresiones de JavaScript.

No cambian el WASM, los shaders, la simulación, la red ni el identificador de compatibilidad multiplayer de la 18. Se conservan la revisión 17 y el ZIP original de la 18. Esta corrección no requiere repetir las pruebas de predicción de la 18: sus resultados anteriores corresponden al mismo motor y transporte, y no se presentan como una nueva prueba de red.

Paquete: `daytona_multiplayer_18_startup_fix_github_pages.zip`. Publicar su contenido completo en la raíz de Pages. Si el jugador aún no puede iniciar, recoger el mensaje completo que aparece y su navegador/versión antes de elegir la ROM.
