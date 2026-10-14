# Filtro vertical de NPC — experimento central 4

Build `daytona-rev-a-central-experimental-4`. La revisión reproduce el defecto numérico comunicado como desapariciones rápidas de NPC en los clientes y aplica una corrección localizada. Conserva el protocolo, contador completo e interpolación de jugadores del experimento 3.

## Causa reproducida

El callback original de tráfico ejecuta el filtro vertical 0x0ce38 en los coches que corresponde. Lee un sello de 16 bits de cada objeto, lee el reloj compartido en PC 0x0ce3c, guarda el nuevo sello y obtiene su diferencia. El camino para diferencias inferiores a cinco divide la variación de altura por el intervalo, excepto cuando vale uno. El intervalo cero no tiene protección.

Con la entrega central independiente, un cliente puede actualizar sus NPC mientras conserva el último reloj recibido del master. El intervalo del filtro vale cero. La división del TGP usa tablas de recíprocos: genera valores enormes, no necesariamente NaN. En la captura anterior al arreglo se observan escrituras reales de velocidad vertical de hasta `2.06835145e37`, seguidas de coordenadas visuales de hasta `6.86612933e36`. La posición física sigue avanzando. Esto proporciona un mecanismo directo para sacar el modelo de la vista y devolverlo cuando el filtro recupera valores normales.

La comparación usa cabinas Chrome independientes, ROM local y canales PeerJS reales. Las únicas alteraciones de transporte son retrasos FIFO del harness, sin reordenar paquetes ni modificar los datos del juego. Las sondas leen el sello exacto escrito por la CPU, el resultado de su cálculo vertical y el estado de los coches por paso. Las capturas finales son imágenes estáticas; no se presenta una filmación del incidente ni una reproducción en los dispositivos originales.

## Cambio

`M2Board::read_word` devuelve el contador real local de RAM `0x5010b0` exclusivamente cuando la lectura es de `0x540058`, la instrucción de CPU es `0x0ce3c`, el modo central está configurado con al menos dos cabinas y el enlace está activo. El sello anterior y nuevo de cada NPC pertenecen así a la misma referencia que avanza su cálculo local. No genera tiempo sintético ni altera la memoria del reloj compartido.

Las otras lecturas conservan su valor original. La ROM, código generado, protocolo, orden de paquetes y buffer de jugadores no se modifican. El filtro original sigue ejecutándose, con sus reset cuando el intervalo es grande y su comportamiento de wrap. Single player y el enlace central desactivado conservan el bus anterior. La revisión incrementa el identificador del build para que todos carguen el mismo motor.

## Resultados

| Captura | Cabinas | Intervalos NPC cero | Cálculos verticales desbordados |
|---|---:|---:|---:|
| Antes, conexión normal/retraso/jitter/recuperación | 2 | 2.054 en cliente, 0 en host | 798 en cliente, 0 en host |
| Después, las mismas fases | 2 | 0 en ambas | 0 en ambas |
| Después, jitter y pausa de 500 ms de un cliente | 3 | 0 en todas | 0 en todas |

El cliente de la comparación posterior sigue teniendo 570 pasos con reloj compartido repetido. Se elimina el error del filtro sin ocultar esas repeticiones ni cambiar el tiempo de carrera. Las tres cabinas adicionales tienen 0/1.002/1.011 repeticiones del reloj compartido, respectivamente, pero ningún filtro con intervalo cero. En esas capturas no quedan estados físicos o visuales fuera del umbral conservador `1e10`, ni valores no finitos.

El harness verifica directamente el bus real de cada cabina: instrucción y dirección exactas, lectura adyacente, otra instrucción, central desactivado, reloj local `0xffff → 0x10000`, y memoria compartida intacta. Las siete comprobaciones pasan en las tres cabinas. La prueba de wrap comprueba la lectura del bus; no simula una carrera completa de 65.536 ticks.

También pasan las 42 pruebas JS y el harness nativo de todos los 35 pares ID/cantidad de 2–8 cabinas, interpolación y contador completo. La validación del motor final sin sondas comprueba lobby, reinicio Grand Prix y regreso a single player.

Resultados resumidos: `NPC_FILTER_RESULTS.json`. Fuentes reproducibles de auditoría: `scripts/build-npc-audit.py`, `tests/npc-filter-browser.cjs` y `scripts/check-npc-audits.py`. Las capturas completas y motores con sondas permanecen en `build/`, fuera del ZIP. La ROM no se distribuye.

## Alcance

La validación nueva es local en Chrome; falta confirmar el aspecto visual entre hogares y en iPhone. El filtro comparte campos del objeto con la dinámica original, por lo que se conserva la condición de experimento y conviene revisar interacción con tráfico en una partida real. No se atribuye a esta corrección una solución del bloqueo previamente comunicado al regresar a attract con el host fuera de carrera: esa incidencia sigue abierta.

RC1 y los ZIP 1, 2 y 3 se verifican por hash y permanecen intactos. El ZIP 4 incluye solamente el runtime y documentación, sin sondas ni retrasos de prueba. Todos deben usar el build 4 durante la nueva prueba.
