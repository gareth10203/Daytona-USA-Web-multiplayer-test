# Listas gráficas completas — revisión 33

## Fallo y causa

Se reproduce con dos motores reales y controles ordinarios: host en attract, invitado elige Advanced. En Endurance inverso el host fallaba en el frame 2909, escena 3, con `Max polygon limit exceeded`. La lista de lectura y la que estaba siendo escrita compartían el banco 0x10000. La escritura había llegado a 68160 mientras la CPU estaba en 17B9C, copiando una matriz desde el TGP. La última entrega completa era del frame 2905. No había empezado una parrilla inversa en el host ni cambiado sus datos de pista a Advanced.

El scheduler puede alcanzar el presupuesto de un fotograma antes de que la CPU termine de escribir la nueva lista. El vblank leía entonces datos nuevos incompletos mezclados con restos del banco. La lectura puede desalinear los comandos y disparar el límite de polígonos. El error no prueba un exceso de complejidad de la pista ni una pérdida de paquetes.

## Corrección

El puente sigue los registros auténticos de inicio de escritura GEO (0x801008) y entrega de lectura (0x803008). La rutina original termina la lista en 17F0C y la entrega en 17F10. Si llega el momento de procesar geometría y el banco de lectura está siendo reescrito, se conserva el resultado gráfico completo anterior. La siguiente entrega vuelve a procesarse normalmente. No se incrementa el límite de polígonos ni se ignora la excepción; se evita leer la lista incompleta antes de producirla.

CPU, vblank, enlace, audio y capas 2D continúan. No se cambian presupuesto de instrucciones, simulación, física, reloj de red, interpolación, modos ni tiempos. El estado se limpia al construir cada tablero, también al recargar y preparar otra sesión.

La versión de observación retiene el estado al fallar y expone métricas de lectura; esas funciones no se incluyen en el motor de producción. Las pruebas sólo introducen controles normales y leen memoria/paquetes, sin fabricar posiciones, checkpoints o vueltas.

## Checkpoints y vueltas

En la revisión 33 el parche de referencia intermedia era exclusivo de Advanced. La revisión 34 lo extiende a Expert tras reproducir el mismo fallo: ver [EXPERT_CHECKPOINTS.md](EXPERT_CHECKPOINTS.md). `reverse_expert.h` y la lógica de ese parche permanecen respecto a la 32. Beginner conserva su lógica de meta, vueltas y salida lanzada. Se comprueban al menos cuatro vueltas por cabina, con y sin CPU, y se prueba que avanzar en sentido original no otorgue vueltas inversas. Las pruebas usan Endurance del arcade para disponer de tiempo; el modo por defecto no cambia.

## Verificación

- `solo-submit-before.json`: reproducción observada antes de activar la protección; banco en escritura y fallo real.
- `standing-grid-solo.json`: invitado completa una vuelta de Advanced inverso con sus 19 bots nativos mientras el host continúa en attract. Se comprueba que ambos motores sigan generando gráficos nuevos.
- `solo-normal-start.json`: mismo uso parcial con dirección original y modo Normal.
- `advanced-checkpoints.json`, `beginner-checkpoints.json`: vueltas, registro del líder y rechazo de créditos en sentido incorrecto, con y sin CPU.
- `standing-grid-eight.json`, `standing-grid-advanced-eight.json`: ocho motores por pista con CPU y parrilla nativa.
- `standing-grid-lifecycle.json`: cambios de pista y revancha sin volver al lobby.
- `reverse-normal-parity.json`, `beginner-preserved-parity.json`: memoria completa de simulación comparada con las bases conservadas.
- `attract-browser.json`: producción WebGPU, PeerJS y TURN/UDP local, host sin moneda e invitado en Advanced.
- `unit-tests.log`: 139 pruebas unitarias.

Los informes finales incluyen huellas del motor y el empaquetado exige que coincidan. Se verifica que todos los archivos de la 32, incluido su ZIP, permanezcan intactos. Las pruebas locales no cubren todos los dispositivos y redes; el ZIP continúa siendo una versión experimental.
