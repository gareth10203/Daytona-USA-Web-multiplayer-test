# Parrilla inversa original de Advanced y Expert — revisión 32

## Comportamiento

La parrilla inversa respeta la fila, el carril y las separaciones que asigna el arcade original a cada coche. Los humanos ya no se colocan en una formación inventada delante de los bots. Se conservan las filas compartidas entre humanos y CPU y el hueco mayor de la cabeza de parrilla.

En la sala seleccionar **Reverse** y **CPU cars: On**, y elegir Advanced o Expert en el arcade. CPU Off sigue disponible. Todos los participantes necesitan la revisión 32. La revisión 31 y su ZIP quedan conservados por separado.

## Implementación

El puente captura la fila y el carril que escribe el inicializador original E898 (sector en E8F4 y carril en E988), antes de que los paquetes entrantes puedan reemplazar las posiciones de otros jugadores. Los datos se indexan por ID de coche, independientemente de la estructura local que pone primero al coche propio. No se envía un protocolo nuevo.

Al preparar la carrera se refleja la parrilla completa, con sus carriles nativos, y se invierte la fase de progreso respecto a la meta. El punto cero se normaliza a sector cero; usar el centinela final de la carretera podría producir un ángulo incorrecto o una vuelta bruta negativa para la fila que coincide con la meta, especialmente en Advanced.

Los bots conservan las líneas CPU inversas y perfiles originales. Se preparan sus cursores y referencias de suelo para las nuevas posiciones. La colocación ocurre una vez al arrancar, sin recolocar coches durante la carrera. Se retira la fórmula anterior basada en `4 + ID * 4`.

La lista circular de tráfico y la zona de seguridad del jugador lento también reciben coordenadas en el sentido de marcha. Se refleja tanto el productor del mapa de frenado como su consumidor: de lo contrario los bots adelantados podían frenar por un humano detenido detrás de ellos. Las fuerzas de frenado y sus umbrales originales se conservan. La corrección de velocidad CPU para un único participante recibe asimismo el progreso en el sentido correcto.

En Advanced inverso se corrige además una vuelta que podía perderse tras saltarse los dos sectores exactos que usa la referencia intermedia de meta. Se reprodujo con controles ordinarios, CPU desactivada: el líder pasó de sector 250 a 242, conservó una referencia de salida menor que 243 y llegó a meta con todos los checkpoints marcados, pero no obtuvo vuelta. Al conservarse la máscara de checkpoints de la vuelta rechazada, los cruces siguientes tampoco volvían a emitir sus avisos hasta lograr una meta válida. La corrección conserva la referencia 243 cuando el intervalo real de sectores cruza ese punto en sentido inverso. Se aplica sólo a la rama original de salto de varios sectores, al coche propio de Advanced inverso; no concede checkpoints, vueltas ni tiempo. La rutina original sigue exigiendo todos los checkpoints y una vuelta bruta nueva; el bloqueo del sentido incorrecto se conserva.

Beginner conserva la formación lanzada de la revisión 31. No se cambian la física, el transporte de red, los modos ni los tiempos del arcade.

## Pruebas

Las pruebas utilizan ROM propia, motores originales, controles ordinarios y observadores de lectura excluidos del ZIP. Los informes incluyen la huella del motor utilizado; el empaquetado exige que coincidan con el motor actual.

- `standing-original-probe.json`: comparación inicial con Expert y Advanced normales, mostrando humanos en las filas traseras y filas compartidas.
- `standing-grid-lifecycle.json`: filas y progreso inverso derivados del inicializador original, tráfico CPU en movimiento, timeout original con humanos detenidos y cambios Expert → Advanced → Expert sin volver al lobby.
- `standing-traffic-probe.json`: los 14 bots circulan con ambos humanos detenidos; se compara además con el original.
- `standing-grid-solo-host.json`: un humano host y 29 bots nativos de Expert, con la otra cabina en attract.
- `advanced-checkpoints.json`: cuatro vueltas inversas por cabina, con y sin CPU; cruces de checkpoint y meta del líder; dos cruces de meta en sentido original no dan vueltas ni checkpoints inversos. La reproducción anterior se conserva en `advanced-checkpoints-before.json`.
- `standing-grid-endurance.json`: pruebas prolongadas usando exclusivamente el modo Endurance del arcade para comprobar vueltas con tráfico. Ese modo sólo se elige en la prueba.
- `standing-grid-eight.json`, `standing-grid-advanced-eight.json`: ocho motores en cada pista con sus ocho bots, filas nativas y movimiento posterior.
- `standing-grid-off.json`: ambos circuitos con dos humanos y CPU desactivada.
- `standing-grid-browser.json`: producción WebGPU y PeerJS por TURN/UDP local; orden de las filas humanas, interfaz y capturas.
- `beginner-preserved-parity.json`: comparación exacta de todo el MB de RAM con la revisión 31 en dos cabinas de Beginner, desde la salida lanzada hasta 1.440 pasos posteriores.
- `reverse-normal-parity.json`: single player normal conserva la RAM de la base original de referencia.
- `unit-tests.log`: 139 pruebas unitarias.

Las pruebas locales no validan todas las redes ni sustituyen una prueba con ocho dispositivos por internet. Los pilotos automáticos de prueba pueden perder por el tiempo original: no se amplían tiempos ni se cambian velocidades para hacerlos ganar.

## Incidencia detectada en la 32, corregida en la 33

El error de geometría del host en attract al entrar sólo el invitado a Advanced se investiga y corrige en [GEO_SUBMISSION.md](GEO_SUBMISSION.md). No hace falta que el host entre a correr para evitarlo en la revisión 33. El resto de este documento describe los cambios de parrilla y validación de vuelta introducidos en la 32, que se conservan.
