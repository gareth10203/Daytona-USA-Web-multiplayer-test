# Recuperación en Expert inverso — revisión 24

Versión independiente de la revisión 23, cuyo ZIP, archivos nativos, frontend y distribución se conservan y comprueban por SHA-256. El usuario confirmó que la validación del sentido de la revisión 23 ya funcionaba correctamente; esta revisión se limita a la orientación al recuperar el coche.

## Causa reproducida

El arcade mantiene la tangente de la carretera en `car+0x1C6`, en su sentido original. La modalidad inversa ya adaptaba varias lecturas concretas de esa tangente, pero faltaban dos consumidores:

- **PC 0x167B4**: la recuperación por colisión calcula su giro para 21 ticks, a partir de esa tangente y de la orientación actual del coche.
- **PC 0x11130**: la recolocación fuera de pista calcula el giro para 64 ticks de la misma manera.

Ambos seguían tomando la tangente original. La función de interpolación de recuperación `0xF2DC` aplicaba después ese giro durante el plazo que fija el arcade, dejando el coche orientado 180° respecto a la carrera inversa.

Se reprodujo mediante acelerador y dirección ordinarios contra el borde del puente de Expert. Sin escribir RAM desde la prueba, la revisión 23 terminó una recuperación de 21 ticks con heading 10376 frente a una tangente original de 10376; otra de 64 ticks terminó con heading 10343 frente a 10376. Ambas apuntaban al sentido original.

## Cambio

Los dos consumidores reciben ahora la tangente invertida, sumando media vuelta únicamente a sus lecturas. El dato canónico de carretera en RAM y los datos del circuito permanecen intactos.

Además, justo antes de que cada rutina divida el ángulo por su duración (PC 0x167C8 y 0x11144), la diferencia se normaliza como ángulo con signo de 16 bits. Esto evita que atravesar el límite entre +32767 y -32768 produzca una vuelta larga. Se conserva la lectura y el valor originales del temporizador `0x5010B8`.

No se cambia el desplazamiento de recolocación, la duración, las físicas del choque, los checkpoints, las vueltas, la clasificación ni la interpolación de red. No se aplica un giro continuo al coche: conducir y girar manualmente siguen dependiendo del jugador. La corrección exige Expert inverso enlazado y fases de carrera 20–25; Normal y single player conservan su comportamiento.

Archivos nativos modificados: `native/reverse_expert.h` y `native/m2_board.cpp`.

## Verificación

Prueba con dos motores reales, distribuidor de producción y entradas ordinarias. La cabina host acelera contra el lateral y luego suelta la dirección; la invitada utiliza el conductor automático del laboratorio. El piloto de laboratorio no se distribuye al usuario.

| Cabina | Recuperación completa | Error respecto al sentido inverso |
| --- | --- | --- |
| Host | 21 ticks | 19 unidades angulares, aproximadamente 0,104° |
| Host | 64 ticks | 24 unidades, aproximadamente 0,132° |
| Invitada | 21 ticks | 9 unidades, aproximadamente 0,049° |

Se comprueba el instante de finalización de la recuperación, antes de que nuevas entradas del jugador puedan volver a girar el coche. Se conserva la pequeña diferencia que resulta de la división entera original, sin imponer una orientación exacta mediante un teletransporte añadido.

Otras regresiones:

- Carrera inversa completa: vueltas/checkpoints originales, llegada antes del tiempo agotado, primer finalista clasificado primero y moneda/Start para otra carrera sin recargar: PASS.
- Host que da la vuelta y cruza checkpoints en el sentido incorrecto: no recibe crédito indebido y permanece detrás del invitado que sigue correctamente: PASS.
- Aplicación con dos motores de producción y WebRTC por relay TURN/UDP local: arranque y retorno al sentido Normal: PASS.
- Single player normal: hashes del MB de RAM de trabajo original iguales a revisión 21 desde el arranque hasta 1.440 ticks de carrera: PASS.
- 137 pruebas unitarias: PASS.

Evidencia: `build/recovery-baseline.json`, `build/reverse-recovery.json`, `build/reverse-expert-engine.json`, `build/reverse-wrong-direction.json`, `build/reverse-expert-browser.json`, `build/reverse-normal-parity.json`, `build/unit-tests.txt`.

El motor de auditoría incorpora observaciones de escrituras de orientación y cambios de callback mediante el trazador existente. Son observaciones: no reemplazan las escrituras originales. El script de compilación genera esa instrumentación solo en `build/recovery-baseline` y `build/reverse-audit`. No se incluye en el motor de producción ni en el ZIP. El empaquetado verifica que, al retirar esas dos inserciones de observación, el puente de auditoría coincide exactamente con el código de producción.

## Alcance

Esta prueba cubre recuperaciones reales del puente y los dos caminos originales identificados. No equivale a validar todos los puntos de Expert, todos los accidentes posibles, todos los modos o ocho motores en internet. Se conservan Expert sin CPU y el resto de límites experimentales de las revisiones anteriores.
