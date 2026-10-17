# Beginner inverso con CPU — revisión 31

## Uso

En la sala: **Direction → Reverse**, **CPU cars → On**. Elegir Beginner en el selector original del arcade. CPU Off conserva la variante sólo con jugadores. Todos deben utilizar la revisión 31. La revisión 30 y su ZIP permanecen separados.

## Cambio

La política CPU de la sala se aplica también a Beginner antes de que el arcade asigne la parrilla. Se invierte la formación lanzada completa, conservando las velocidades y los carriles originales. El bloque de bots conserva sus separaciones; si su última fila coincide con los humanos, se adelanta lo necesario para dejar cuatro sectores de margen respecto al humano delantero.

Cuando sólo una persona entra en carrera, se conservan las 40 estructuras activas del arcade: los bots que ya han pasado la meta mantienen esa fase inicial al invertir el progreso completo.

Cada CPU recibe una vista invertida de su propia línea de conducción, como en Advanced y Expert. Durante la aproximación sigue el controlador automático original. Cambia a la IA de carrera al cruzar su propia meta, antes del GO humano; no espera la salida de los jugadores. La primera pasada arma la vuelta cero: no regala una vuelta.

El GO humano sigue al jugador delantero y a los avisos originales de cada cabina. La referencia tiene que haber sido observada en la aproximación antes de aceptar un cruce: un cero provisional durante la inicialización del enlace no debe adelantar la cuenta atrás. No se sustituyen la física, los tiempos, los checkpoints ni el protocolo de movimientos por un piloto JavaScript.

Las líneas se derivan de la ROM del usuario en cada motor y no se distribuyen. El piloto automático de los tests sólo acciona dirección y acelerador para conducir los coches humanos; los bots utilizan el código original del arcade.

## Validación

Los informes de `build/` identifican la huella del motor probado. Las observaciones de RAM son de lectura y quedan fuera de la distribución. El paquete se genera únicamente cuando pasan los controles exigidos en `scripts/package-beginner-cpu.py`.

- `beginner-cpu-engine.json`: dos motores, formación con 14 bots adelantados, cuenta atrás, transición, carrera de ocho vueltas y repetición inmediata.
- `beginner-cpu-eight.json`: ocho motores y ocho bots, formación y salida lanzada.
- `beginner-cpu-solo.json`: corredor único con 39 bots y host en attract, salida y vuelta válida; CPU Off sigue usando una sola estructura activa.
- `free-reverse-engine.json`: cambiar entre los tres circuitos en la misma sesión con CPU activada.
- `free-reverse-partial.json`: CPU Off, invitado único y host en attract.
- `beginner-cpu-browser.json`: dos motores de producción, WebGPU y PeerJS mediante TURN/UDP local.
- `reverse-normal-parity.json`: single player normal frente al motor base.
- `unit-tests.log`: pruebas unitarias de la UI y la red.

Son pruebas locales de implementación; no sustituyen una prueba con ocho dispositivos por internet. Se conserva la aproximación de los NPC del enlace original: no se garantiza identidad exacta de sus posiciones en todas las cabinas bajo cualquier latencia.
