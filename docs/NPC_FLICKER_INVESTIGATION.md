# NPC que desaparecen rápidamente en los clientes — revisión estática

Build revisado: `daytona-rev-a-central-experimental-3`. No se han arrancado cabinas, repetido la partida ni modificado el motor/frontend/ZIP. Se han leído código generado, tablas locales del TGP y capturas existentes de la validación del experimento 3.

## Hallazgo concreto

El callback de tráfico 0x0cfa0 llega a 0x0ce38 cuando corresponde ejecutar el filtro vertical de la cabina. La rutina lee el reloj compartido de 16 bits en 0x540058, guarda el sello por coche en objeto+0x282 y resta el anterior (0x0ce38–0x0ce48). Para un intervalo de 1 toma el camino directo. Para un intervalo de 0 toma el camino que convierte ese intervalo a Float32 y lo pasa como denominador al comando TGP 3 (0x0ce90–0x0ceb0). No tiene guarda de intervalo cero.

El puerto 0x30 identifica comando 3 según `TgpBoard::function_port_w`: offset>>2. La tabla de despacho del programa del TGP usa base 0x58; 0x58+3=0x5b salta a 0xc4–0xd1. Esa rutina implementa división con las tablas de inversa y refinamiento por multiplicaciones. Se leyó `copro_tables.bin` local para evaluar las expresiones Float32 del código: denominadores 1, 2 y 4 producen factores 1, 0,5 y 0,25; denominador 0 produce aproximadamente 1,7014118e38. No es correcto describirlo simplemente como una división IEEE que siempre produce NaN.

Una variación vertical de 0,01, dividida mediante esa ruta por el intervalo 0, da aproximadamente 1,7014118e36. El resultado se guarda en objeto+0x288 y también entra en el cálculo posterior del filtro de la rutina. Puede alterar enormemente la representación vertical del coche sin exigir que deje de avanzar su posición de carrera. Esto proporciona un mecanismo concreto compatible con desaparición/reaparición; todavía falta demostrar que sea la causa del incidente visual comunicado en los dispositivos reales.

## Por qué aparece en clientes

La adaptación central reaplica el estado más reciente a la cadencia local y el arreglo del contador completo conserva correctamente el reloj real del host. Si no llegó un reloj nuevo, este se repite: no se inventa un tick de host. La rutina visual original de los NPC no contempla esa repetición.

En `build/motion-fixed-3-coherent-four.json`, fase `delay-and-jitter`, los tres clientes tienen 270 intervalos de reloj compartido cero entre 404 pasos observados; el host tiene cero. Sin jitter añadido, las cuatro cabinas tienen cero intervalos repetidos entre 402 pasos. Esta captura mide el reloj al terminar cada paso, no la lectura exacta dentro del callback de cada NPC; correlación temporal más ruta de código, sin prueba visual nueva.

El suavizado de jugadores modifica campos del primer coche del bloque de 448 bytes. La tabla compacta de tráfico en bloque+0x120 conserva sus bytes originales: cada coche ocupa 4 bytes con flags bajos y la referencia en objeto+0x13a. Esa referencia alimenta corrección de trayectoria en 0x11334; no es una posición XYZ completa. Los flags 2/3/4 también se usan y consumen en rutinas de interacción. No se ha identificado una alternancia directa de visibilidad provocada por esos flags; esa hipótesis inicial queda sin demostrar.

Los flags de cuatro NPC por observador en las capturas anteriores se mantienen constantes al final de los pasos. Eso no descarta transitorios dentro del paso, pero no apoya atribuir el parpadeo a flags de visibilidad ya identificados.

## Corrección propuesta

Separar la referencia temporal de este filtro visual local del reloj de carrera compartido. En la adaptación del bus, únicamente en modo central y en la lectura original de 0x540058 desde PC 0x0ce3c, devolver el contador real local de RAM 0x5010b0. El sello por NPC se actualiza entonces con la misma referencia local que su filtro, sin modificar el reloj compartido que usa el resto del juego, la ROM ni el protocolo.

Debe comprobarse también el intervalo cero dentro de ese filtro, los cambios de escena y el wrap de 16 bits. La alternativa es conservar la última solución válida cuando no avanzó su referencia temporal; no forzar visibilidad de todos los NPC ni cambiar globalmente la división del TGP. La evaluación debe abarcar la trayectoria y las interacciones además del aspecto visual, porque el filtro original comparte campos de objetos.

Estado histórico de esta revisión estática: no se había aplicado ni probado el arreglo. Tras la nueva autorización del usuario, se reprodujo el defecto numérico y se corrigió en el experimento 4. La comparación y sus límites figuran en [NPC_FILTER_FIX.md](NPC_FILTER_FIX.md) y [NPC_FILTER_RESULTS.json](NPC_FILTER_RESULTS.json).
