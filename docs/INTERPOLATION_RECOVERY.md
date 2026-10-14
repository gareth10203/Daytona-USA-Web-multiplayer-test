# Recuperación de movimiento — experimento 9

Primera etapa implementada en una copia independiente. El motor suaviza las correcciones de jugadores remotos tras recuperar muestras y ajusta su reserva cuando la llegada es irregular. El experimento 8 y su ZIP permanecen intactos.

## Cambio

- Reserva objetivo entre **4 y 16 ticks del reloj de origen**, frente al máximo de ocho del experimento 8. A una cadencia de origen de 57,5 Hz equivale aproximadamente a 70–278 ms. Sube con la irregularidad de recepción y baja gradualmente al estabilizarse; no se fija únicamente por RTT.
- Historial acotado a 64 muestras por pista. Un hueco grande conserva un extremo real anterior, busca una posición reciente y aplica una corrección gradual durante **12 pasos locales**, aproximadamente 200 ms a cadencia normal. No reproduce todo el intervalo ausente para alcanzar al origen lentamente.
- Cambios de escena, identidad del coche y desplazamientos incompatibles con velocidad y tiempo registrados se aplican inmediatamente. Un salto de reloj no basta para clasificar como normal cualquier cambio de posición.
- Posición XYZ, velocidad escalar y ángulos verificados se corrigen conjuntamente. Se conservan el resto de los bytes de la última instantánea: control, encabezados, sellos, datos de NPC, punteros y comprobaciones.
- El TGP original continúa proyectando el movimiento. No se añade otra extrapolación ni se cambian los relojes, ROM, bucle de simulación, audio, renderer o transporte del experimento 8.

La corrección se aplica a las poses replicadas que recibe el juego, no a una capa exclusivamente visual. Por ello, el comportamiento de contactos entre jugadores necesita validación adicional en partidas reales; suavizar posiciones no demuestra equidad de las colisiones.

## Comparación medida

Dos motores reales en Chrome local; Normal / Easy / Beginner, gráficos Classic. TURN/UDP autenticado y candidatos relay comprobados en ambos extremos. Pérdida, jitter y retraso afectan datagramas cifrados antes de SCTP. Se leen las posiciones después de cada paso nativo, además de las escrituras originales del i960 y el estado de interpolación. Se excluyen los primeros dos segundos de parrilla.

| Condición | Mayor desplazamiento remoto en un paso, versión 8 | Versión 9 |
|---|---:|---:|
| Recuperación tras corte de 1 s, observado por host | 68,27 | 5,80 |
| Recuperación tras corte de 1 s, observado por cliente | 54,01 | 2,65 |
| Recuperación tras corte de 3 s, observado por host | 323,74 | 26,26 |
| Recuperación tras corte de 3 s, observado por cliente | 83,84 | 14,16 |
| 340 ms + 3 % de pérdida, observado por host | 44,84 | 5,24 |
| 1000 ms + 3 % de pérdida, observado por host | 93,68 | 10,56 |
| 1000 ms + 3 % de pérdida, observado por cliente | 68,42 | 8,78 |

Distancias en unidades internas del juego, sin convertirlas a metros. Son máximos de estas ejecuciones, no una garantía estadística. Aunque se conservan perfiles y semillas, los datagramas y retransmisiones de SCTP no son un replay idéntico.

El cambio reduce fuertemente las correcciones grandes observadas. **No elimina las retenciones:** a 1000 ms con pérdida, hubo hasta aproximadamente 1,8 s de posiciones remotas detenidas; el host quedó detenido en el 41,3 % de pasos y el cliente en el 14,9 %, frente a 36,4 % y 26,9 % en la ejecución 8. Los huecos de recepción también variaron entre ejecuciones. No se atribuye una mejora uniforme del tiempo detenido a la interpolación.

El objetivo de reserva está acotado, pero no constituye un límite de antigüedad total del rival: se suman el tránsito, las esperas del transporte y las correcciones. La reserva mediana fue cuatro ticks en red local, aproximadamente 6–7 en RTT 340 ms estable y unos 15 en RTT 1000 ms estable; las bases estables no tuvieron retenciones tras el arranque. Durante pérdidas se alcanzó el máximo de 16. El coche propio siguió simulándose cerca de 57,5 Hz, sin retenciones XYZ en estos tramos.

Los cortes breves mantuvieron ambas cabinas en carrera. El corte prolongado devolvió ambas al lobby por falta de progreso aproximadamente a los diez segundos, y permanecieron allí al restaurar la red. La política de parada sigue siendo la misma.

## Validación

- 57 pruebas JavaScript del lobby, control, distribución y flujo.
- 11 casos nativos: continuidad y duración de recuperación, cambios de escena/coche, reset espacial después de un corte, timestamps atrasados, wrap uint32, cadencia espaciada, límites de historial/reserva y conservación de bytes de control.
- 10 puntos de comparación de single player idénticos frente al motor 8: arranque/attract, Classic y widescreen x2, geometría, capas, texturas, audio, EEPROM/backup y vibración.
- 47 puntos idénticos entre motor 9 con y sin sondas, incluyendo paquetes del enlace. Las sondas permanecen fuera del ZIP.
- Tres cabinas reales con retrasos FIFO, jitter y una pausa de 500 ms: cero intervalos NPC nulos, cero cálculos verticales desbordados y siete comprobaciones del bus aprobadas en cada cabina.
- Motor final sin sondas: lobby, invitación, sonido, chat, expulsión, inicio/parada, timeout silencioso, reinicio Grand Prix y regreso a single player aprobados. Grand Prix fue una regresión; el modo predeterminado continúa siendo Normal.

Estas pruebas son locales en Chrome. Falta evaluar percepción y contactos entre dispositivos y hogares. No se intentó reproducir el bloqueo previamente comunicado con el host en attract y otras dos cabinas agotando el tiempo.

## Siguiente etapa

Investigar el transporte de estados recientes separado de los mensajes fiables de control. El canal actual sigue siendo fiable y ordenado; restaurar la red puede dejar datos pendientes y retransmisiones. La interpolación no puede reconstruir segundos de maniobras desconocidas. No se cambiaron todavía los canales ni se prometen movimiento perfecto, reincorporación en carrera o migración del host.

Prueba local: http://localhost:8090. Todas las cabinas deben recargar y usar `daytona-rev-a-central-experimental-9`. El ZIP mantiene el despliegue completo y los avisos de licencia. Métricas reproducibles: `INTERPOLATION_RESULTS.json`; datos brutos y motores de diagnóstico: `build/`, sin distribuir.
