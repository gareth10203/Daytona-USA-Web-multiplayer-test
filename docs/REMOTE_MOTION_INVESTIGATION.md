# Saltos de coches remotos en el enlace central

Revisión del build `daytona-rev-a-central-experimental-2`, 2026-10-13. Se reprodujo el movimiento entrecortado con dos cabinas Chrome y PeerJS real. Se identificaron dos efectos distintos: retención/salto de coordenadas remotas y un fallo de reconstrucción del contador compartido cuando se descarta el estado que contiene su paso por cero.

Esta revisión es de diagnóstico: no cambia `web/`, `dist/`, el motor publicado ni los ZIP. Las sondas y el motor instrumentado se encuentran únicamente en `build/motion-audit/`. El arreglo jugable queda pendiente.

## Coordenadas retenidas y correcciones

La rutina original en 0x1a9e8–0x1ab90 toma coordenadas y otros campos de RAM de comunicaciones y los copia a los objetos remotos. Las escrituras de posición están en 0x1aa80/84/88; luego 0x1ab94 realiza trabajo del TGP sobre el estado recibido. Las coordenadas de tres componentes son los campos 0x1c, 0x20 y 0x24 del objeto, presentes en el bloque transmitido desde su desplazamiento 0x40. Se leyó la recompilación existente de la ROM, sin modificarla.

`central-link.js` conserva una muestra independiente por cabina. `central_read_fg()` drena estados completos y retiene el último. Luego reaplica ese estado en cada paso local, incluso sin recepción nueva. El juego continúa y vuelve a escribir posiciones recibidas desde ese bloque retenido.

Con retrasos variables, los coches remotos repiten posición durante varios pasos y luego avanzan varias posiciones a la vez. Se registraron correcciones internas hacia atrás al copiar el estado de red sobre el estado que tenía el objeto. Estas correcciones también existen con recepción regular y en RC1: por sí solas no demuestran un salto visible. El dato decisivo es la posición al terminar cada paso local y cómo se alternan retenciones con avances mayores.

Comparación bajo retrasos estrictamente ordenados, cliente observando al host, fase de siete segundos con jitter:

| Medida | RC1 / anillo | Central / build 2 |
| --- | ---: | ---: |
| Pasos con posición remota prácticamente idéntica al anterior | 4 / 402 | 280 / 402 |
| Posición propia detenida en esos pasos | 0 / 402 | 0 / 402 |
| Avance remoto relativo al propio, percentil 95 | 1,02× | 4,11× |
| Contadores de muestra que retrocedieron en las aplicaciones | 0 | 0 |

El cociente de avance compara distancias tridimensionales de dos coches distintos, que pueden ir a velocidades diferentes y sufrir colisiones; no es una medida exacta de aceleración ni de errores en metros. Describe la alternancia temporal observada, sin atribuir cada corrección a una única causa. Los datos de la cabina host también muestran retenciones frecuentes: 253 de 403 pasos en esa fase central. En la fase sin retraso añadido las retenciones fueron escasas, y al quitar el jitter se recuperó la actualización regular.

## Fallo del contador compartido

El juego transmite el byte bajo de su contador local, RAM 0x5010b0, en el campo 0x0a de la cabecera. La rutina 0x1ae20–0x1ae48 reconstruye el contador compartido de 32 bits de RAM 0x540058: reduce ese byte en uno, lo escribe en el byte bajo del contador existente y suma uno al valor completo. Así, recibir exactamente el byte 0 produce el acarreo a los bytes superiores.

Esta operación depende de cómo se entrega el paso por cero:

- Secuencia 255 → 0 → 1: el contador reconstruido avanza normalmente.
- Secuencia 255 → 3, omitiendo 0: el acarreo no ocurre y el contador puede retroceder 252 ticks.
- Reaplicar 0 dos veces: puede generar un acarreo extra de 256 ticks. Esta segunda situación se reprodujo en la aritmética exacta de la rutina; no se presenta como evento observado en las carreras registradas.

En dos carreras centrales instrumentadas se observó el primer fallo. La repetición confirmatoria preserva explícitamente el orden de todos los mensajes con una cola FIFO por conexión. El retroceso no requiere paquetes de red fuera de orden:

| Paso nativo del cliente | Byte de muestra aplicado | Contador compartido | Contador local |
| --- | ---: | ---: | ---: |
| 3858 | 255 | 3583 | 3078 |
| 3859 | 255 | 3583 | 3079 |
| 3860 | 255 | 3583 | 3080 |
| 3861 | 255 | 3583 | 3081 |
| 3862 | 3 | 3331 | 3082 |

El host sí emitió los bytes 0, 1, 2 y 3. El cliente sí los recibió en JavaScript, en ese orden, entre 1791943411696 y 1791943411697 ms del reloj de pared del mismo equipo. Al empezar el siguiente paso nativo, `central_read_fg()` drenó los cuatro estados y conservó únicamente el 3. El juego no procesó el 0 y el contador compartido retrocedió 252 ticks. Después permaneció un ciclo de 256 ticks por detrás de la evolución anterior; recuperar la llegada regular no corrigió ese desfase de la parte alta.

Las posiciones y los contadores locales siguieron avanzando; esto no significa que toda la simulación retrocediera 4,4 segundos. Es el contador compartido el que presenta el salto, equivalente a unos 4,4 segundos de su cadencia normal. La RAM 0x540058 tiene numerosos lectores en el juego. No se ha aislado todavía qué consumidores amplifican específicamente los saltos de posición ni su impacto exacto sobre colisiones y resultados.

En la comparación RC1 con FIFO explícita no se observó un retroceso grande de ese contador durante las fases registradas. Conservó estados intermedios mucho más regularmente, a cambio de datos más antiguos. Este ensayo de dos cabinas y fases cortas no sustituye los ensayos anteriores de lag y colas con más jugadores.

## Método y archivos

- Sondas de lectura de RAM al terminar cada paso; registro de la escritura real de coordenadas en PC 0x1aa80. Se captura el estado anterior y el valor que escribe el programa. La sonda no modifica registros, RAM, coordenadas ni paquetes.
- El motor de auditoría recompila únicamente una copia instrumentada de `m2_board.cpp` y reenlaza con los objetos centrales existentes. RC1 se prueba con la configuración central desactivada; conserva el camino original de CommBoard. El frontend RC1 se obtiene del servidor original, sin editar sus archivos.
- Dos contextos Chrome por ensayo, gráficos Classic, ROM local. Se inyectan controles de selección/accelerador y retrasos únicamente en el harness HTTP. Fases: sin retraso añadido, 50 ms por sentido, 20 ms más jitter de 0–90 ms por sentido, recuperación sin retrasos añadidos. Cada fase dura siete segundos; no se afirma una carrera completa ni equivalencia con hardware.
- Los dos primeros ensayos utilizaron timers independientes. El primer comparador RC1 mostró reordenamientos creados por esos timers al agrupar entregas y se descartó para conclusiones comparativas. Los ensayos finales usan una FIFO explícita y preservan también su cola al quitar el retraso.
- Los ensayos finales central y RC1 se solaparon durante parte de su ejecución; no se usan para comparar consumo de CPU o límites de FPS. Se comparan coordenadas y contadores por paso de simulación. Las edades, RTT y condiciones reales de Internet pueden diferir.
- Los eventos de escritura se asignan al paso que termina en `frame_ + 1`; las capturas de RAM se toman después del paso. Se corrigió esa correspondencia en los resúmenes.

Datos definitivos: `build/motion-central-ordered.json`, `build/motion-rc1-ordered-clock.json`. Resúmenes: los archivos `*-summary.json`, `*-detail.json` y `*-clock.json` correspondientes. El ejemplo completo del rollover está en `build/motion-clock-example.json`. La segunda reproducción central está en `build/motion-central-clock.json`.

Harnesses: `build/motion-audit-build.py`, `build/motion-audit.cjs`, `build/analyze-motion.cjs`, `build/motion-detail.cjs`, `build/analyze-clock.cjs`, `build/motion-example.cjs` y `build/clock-rollover.cjs`. No se distribuyen en el sitio.

## Corrección que procede investigar

1. Corregir primero la coherencia del contador compartido en la adaptación central: descartar estados de posición antiguos no debe perder ni duplicar el rollover del reloj. Evaluar un contador completo y autenticado del master como metadato, y su entrega compatible con la interfaz esperada por el juego. Hay que verificar arranque, reinicios, retenciones y pasos por cero; no basta con incrementar ciegamente un byte ni con aplicar un filtro visual.
2. Dar a los estados remotos una entrega temporal regular, con un búfer pequeño y acotado por cabina. No esperar al jugador más lento ni volver a introducir una cola ilimitada. Medir el retraso que añade y cómo responde a pausas/reconexiones.
3. Si aún es necesario, suavizar únicamente campos de pose identificados y separar presentación de colisiones. El bloque contiene cabeceras, checksums, estados, punteros y datos de otros coches; no se puede interpolar todo el paquete. La interpolación combina estados reales con un retraso controlado, pero su integración aquí debe respetar el tratamiento original del TGP y las colisiones.

Se debe conservar la centralización. El problema identificado está en la adaptación de entrega y temporización al programa original, no demuestra que haga falta reinstaurar el anillo.

Referencia general sobre jitter y búferes de interpolación: [Snapshot Interpolation, Glenn Fiedler](https://gafferongames.com/post/snapshot_interpolation/). La evidencia específica de Daytona procede del código local y las trazas descritas, no de esa referencia general.
