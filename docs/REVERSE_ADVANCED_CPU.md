# Advanced inverso con coches CPU — revisión 29

## Activación

En el lobby del host: **Direction → Advanced reverse**, **CPU cars → On · Arcade grid**. El ajuste se comparte con las cabinas y reinicia Ready. CPU Off conserva las carreras entre humanos. Todos deben actualizar a la revisión 29.

La revisión 28 y su ZIP permanecen intactos en `multiplayer-reverse-cpu`. Su soporte de Expert con CPU se conserva. Beginner inverso sigue sin bots y mantiene su cuenta atrás coordinada.

## Cambio

Se amplía a los circuitos internos 1 (Expert) y 2 (Advanced) la política de CPU inversa de la revisión 28. Advanced genera sus vistas de líneas de conducción a partir de sus propias tablas de la ROM; no usa las de Expert. Se conserva el controlador del arcade, sus velocidades, carriles, maniobras y colisiones. Los cursores de recuperación, las orientaciones de búsqueda y el progreso de vueltas de NPC usan el sentido inverso seleccionado.

Se retira el bloqueo CPU de Advanced tanto en la validación del lobby como en la API nativa. El host puede elegir On u Off, y los invitados reciben el mismo ajuste. El bloqueo de Beginner permanece. No se cambian el transporte, los relojes, la interpolación ni el renderizador. La clasificación multijugador continúa entre jugadores humanos, como en el arcade.

## Verificación

- **139 pruebas unitarias:** ajustes compartidos con ocho miembros, CPU On/Off en Advanced y Expert, reinicio de Ready y bloqueo de CPU en Beginner.
- **Advanced Normal/Easy, dos motores originales con entrega local:** circuito interno 2, N=486, parrilla de 16 coches (dos humanos y 14 CPU). Ambos jugadores completan vueltas válidas. El invitado completa las cuatro vueltas y obtiene el primer puesto con tiempo restante; el host termina con tres vueltas. Los 14 bots completan al menos dos vueltas inversas, con posiciones finitas en ambas cabinas.
- **Repetición inmediata:** moneda y Start después del final preparan otra parrilla Advanced inversa exactamente una vez, sin recarga ni regreso a la sala.
- **Producción por WebRTC:** dos motores de distribución con WebGPU, PeerJS y relay TURN/UDP local. On/Off se comparte; los coches CPU se ven en el cliente durante la carrera. Se vuelve a Normal, Expert conserva su opción CPU y Beginner la bloquea. Cero errores JavaScript registrados. Modal a 1366×768 sin scroll interno; móvil a 390 px sin desbordamiento horizontal.
- **Ocho cabinas:** ocho motores originales locales forman la parrilla de 16 coches, con ocho humanos y ocho CPU. Los bots avanzan en sentido inverso por sus líneas durante los 1.800 pasos posteriores a la salida. Esta prueba cubre el arranque, no una carrera completa de ocho jugadores por internet.
- **CPU Off:** dos motores arrancan Advanced inverso con sólo dos coches humanos detenidos, sin NPC ni una vuelta falsa.
- **Expert:** prueba de regresión con dos motores: 14 bots circulan en reversa en ambas cabinas.
- **Single player:** todo el MB de memoria de trabajo coincide con la revisión 21 desde el arranque hasta 1.440 pasos de carrera Expert normal con los 30 coches originales. Cargar la sesión elimina una política previa de Advanced inverso.

Evidencia local: `build/reverse-cpu-advanced-engine.json`, `build/reverse-cpu-advanced-browser.json`, `build/reverse-cpu-advanced-eight.json`, `build/reverse-cpu-advanced-off.json`, `build/reverse-cpu-expert-regression.json`, `build/reverse-normal-parity.json` y `build/unit-tests.log`. Los informes nativos registran la huella del motor; las exportaciones de observación no se distribuyen. El ZIP incluye sólo el motor de producción y no contiene ROM.

## Alcance

La carrera completa se prueba con dos motores y entrega local; la prueba WebRTC usa una red local. No equivale a comprobar todas las dificultades, modos o condiciones de internet. Se conserva la aproximación del enlace original para los NPC mediante cursores y velocidades: las posiciones de los bots no tienen por qué ser idénticas entre pantallas, especialmente durante colisiones o problemas de red. El piloto automático de las pruebas sólo aplica controles ordinarios y no forma parte del juego distribuido.
