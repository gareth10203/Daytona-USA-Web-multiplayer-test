# Reloj completo y entrega temporal — experimento central 3

Build `daytona-rev-a-central-experimental-3`. Conserva el lobby recuperable del experimento 2 y sustituye su protocolo de carrera por muestras con contador completo y metadatos de tiempo. Todos deben usar esta versión. RC1 y los ZIP 1 y 2 permanecen intactos.

## Cambio del reloj

Cada cabina obtiene el contador real de RAM 0x5010b0 al empezar el vblank. Resuelve el byte de la cabecera que ya publicó el juego contra ese contador, eligiendo su valor anterior más cercano; no usa el reloj del navegador ni un contador ficticio de paquetes. Exporta su bloque de 448 bytes, ID y contador completo de 32 bits: 453 bytes en total.

El host conserva el contador de cada muestra junto con sus datos. Cada estado contiene 3584 bytes de RAM, etiqueta 0xfd, contador completo del master y ocho contadores correspondientes a las posiciones de RAM: 3621 bytes. La identidad de la muestra sigue vinculada a su conexión/asiento y la época/secuencia sigue rechazando estados antiguos. El contador del master procede de la propia cabina host.

La CommBoard retiene el último contador completo incluso si descarta estados intermedios. El bus M2Board, únicamente en modo central, sustituye el resultado de la reconstrucción original en PC 0x1ae38/0x1ae44 por ese contador. La escritura temporal del byte bajo se omite y la escritura final recibe el valor completo. Esto evita el acarreo perdido cuando se omite el byte 0 y el acarreo repetido cuando se reaplica. La ROM y sus objetos generados no se editan; el cambio se hace en la adaptación nativa de la interfaz del enlace. Single player y el modo original con central desactivado conservan su camino anterior.

## Cambio del movimiento

Se mantiene una historia acotada de hasta 32 muestras por posición del enlace. El objetivo inicial de reproducción es cuatro ticks de la cabina emisora; puede aumentar hasta ocho al observar huecos. Un ajuste limitado de la cadencia permite reconstruir el margen de reproducción o consumir retraso acumulado. Una estimación suavizada de la relación entre ticks del emisor y pasos locales contempla ritmos de simulación diferentes.

Solo se interpolan los campos identificados del primer coche publicado por cada cabina: coordenadas Float32 del objeto 0x1c/0x20/0x24, velocidad escalar Float32 0x34, ángulos int16 0x28/0x2a/0x2c y rumbo de movimiento int16 0x48. Los ángulos siguen la trayectoria más corta a través de cero. El juego original usa velocidad y rumbo al procesar la posición recibida en el TGP; suavizar solo XYZ dejaba saltos residuales con cuatro cabinas. Se verificaron esos campos en las rutinas originales 0x1ab94 y 0x11b70–0x11bbc/0x11830–0x11850.

La cabina propia conserva su bloque más reciente. Las cabeceras, checksum, controles, punteros y datos compactos de tráfico no se interpolan. Los cambios de escena, identidad de coche, huecos grandes y discontinuidades importantes reinician la historia para evitar mezclar fases distintas. No hay extrapolación: cuando se agotan muestras, se mantiene el último extremo disponible. Ni enviar ni recibir introduce una espera de todas las cabinas por actualización.

Se añade retraso de reproducción de coches remotos: normalmente cuatro a ocho ticks, aproximadamente 70–140 ms cuando el emisor sostiene 57,5 Hz. Es adicional al tránsito de red y varía con la cadencia del emisor. Los controles propios no pasan por este búfer. La interpolación entra por RAM del enlace y también puede influir en la representación de coches usada por colisiones; no se afirma que sea exclusivamente visual ni equivalente a la PCB. No se han añadido autoridad de física, rollback o migración del host.

## Evidencia

En la comparación de dos cabinas con PeerJS real y retrasos FIFO de 20 ms más jitter de 0–90 ms por sentido:

| Medida del cliente | Build 2 | Primera validación del arreglo |
| --- | ---: | ---: |
| Pasos con posición remota retenida | 280 / 402 | 0 / 404 |
| Avance remoto relativo al propio, p95 | 4,11× | 1,16× |
| Retroceso grande del reloj compartido | −252 ticks | Ninguno |

Son recorridos independientes con velocidades/colisiones que pueden diferir. El cociente no mide un error exacto de posición. Esta primera validación precedió al ajuste adicional de velocidad/rumbo; se conserva como evidencia del contador y del búfer.

La validación final de cuatro cabinas, con velocidad/rumbo coherentes, recorrió seis fases: sin retraso añadido, 50 ms por sentido, jitter FIFO, recuperación, pausa real de 500 ms en la cuarta cabina con jitter y recuperación. Todas mantuvieron el enlace hasta el final de las fases. En la fase con jitter, las doce observaciones de coches remotos registraron cero o un paso retenido de unos 404 pasos cada una. La revisión anterior, que suavizaba solo posición/ángulos principales, reducía retenciones pero conservaba saltos después del procesamiento del TGP; no se distribuye esa revisión.

No hubo retrocesos del contador compartido en las cuatro cabinas. La cabina pausada recuperó el reloj del host con un avance de 26 ticks al regresar: corresponde al tiempo que el host continuó ejecutando y no es el fallo de acarreo anterior. Durante la ausencia breve, el coche que no publicó nuevas muestras pudo quedar retenido; no se inventó su movimiento. Esta medida no garantiza movimiento perfecto con cualquier red o cualquier rendimiento.

Las capturas finales muestran una carrera real en la segunda vuelta. No se afirma haber completado la carrera ni validado resultados finales contra hardware. Los ensayos usan Chrome local, no conexiones entre hogares o iPhone. La prueba final de cuatro cabinas se ejecutó sin otra prueba de navegador simultánea. La validación previa de cuatro cabinas se solapó parcialmente con la regresión de arranque; no se usa para conclusiones de rendimiento.

## Pruebas y reproducción

- 42 pruebas JavaScript: protocolo con relojes completos, orden de RAM 2–8, lobby, acciones confirmadas, reconexión, permisos y estados actuales de carrera.
- Harness nativo WASM: los 35 pares ID/cantidad entre 2 y 8, muestreo independiente, FG local, muestras intermedias omitidas, repetición de contador, wrap de 32 bits, interpolación acotada, velocidad/rumbo coherentes, cruce angular por cero, ausencia prolongada sin bloqueo, cambios de escena/posición y camino original. Requiere `-sSTACK_SIZE=1048576` por los varios dispositivos locales que construye el propio harness; el motor jugable ya usa una pila de 16 MiB.
- `tests/lobby-browser.cjs`: arranque con enlace real, vuelta al lobby, segundo arranque Grand Prix y restauración de single player. En la captura del arranque se mantuvieron SIM y DATA alrededor de 57–58 Hz y un margen de pose de unos cuatro ticks.
- `tests/lobby-recovery-browser.cjs`: solicitud pendiente e ingreso admitido recuperados, señalización real interrumpida/reconectada, chat confirmado sin duplicados, expiración de reserva y cierre explícito.

Los datos completos están en `build/motion-fixed-3.json` y `build/motion-fixed-3-coherent-four.json`; los resúmenes son `*-clock.json`, `*-group.json` y los archivos de la primera validación `*-detail.json`/`*-summary.json`. La comparación anterior está en `build/motion-central-ordered.json`. `docs/MOTION_RESULTS.json` contiene un resumen compacto para distribuir.

Las sondas, controles y retrasos solo existen en el harness y en el motor instrumentado de `build/motion-audit`; `dist/` contiene el motor normal con la corrección, sin esos instrumentos. Se reutilizan los objetos originales del juego y las bibliotecas sin recompilarlos o modificarlos. Los ZIP no incluyen ROM ni herramientas de prueba.

Los diagnósticos JSON incluyen `poseBufferTicks`, `poseHeldPercent` y `poseApplicationsHz`. El primer valor es margen de reproducción adicional en ticks del emisor, no RTT ni antigüedad total. El segundo indica que la reproducción alcanzó la última muestra disponible; un coche físicamente parado puede tener posición repetida sin que falten paquetes.
