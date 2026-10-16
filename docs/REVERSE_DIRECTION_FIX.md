# Expert inverso: validación del sentido — revisión 23

Versión independiente de la revisión 22, conservada junto a su ZIP. Se mantiene la misma opción del lobby, Expert sin CPU y sentido Normal por defecto.

## Hallazgo confirmado y límite de la investigación

El usuario informó que alguien que da la vuelta y corre en el sentido original puede aparecer primero después de un checkpoint. No se reprodujo ese salto exacto en las pruebas locales: ni el host ni el invitado consiguieron el primer puesto al retroceder con la revisión 22.

Sí se confirmó un defecto relacionado: la revisión 22 admitía checkpoints en ambos sentidos. En una carrera con host que gira mediante los controles ordinarios y un invitado que continúa correctamente, la máscara de checkpoints del host terminó en 63 (todos los bits), aunque su desplazamiento ya era en el sentido incorrecto. Su clasificación observada se mantuvo segunda. Esto prueba la aceptación indebida de checkpoints, no la causa exacta del puesto reportado. No debe afirmarse que el salto a primero está reproducido o completamente resuelto.

## Corrección

Se lee la diferencia entre el sector actual `car+0x12C` y el anterior `car+0x12E`, deshaciendo el salto por la unión de meta. El circuito original utiliza sectores 0…N: +1 o -N indican sentido original; -1 o +N indican sentido inverso. La comprobación usa el desplazamiento real sobre la carretera, no la orientación del volante, la cámara o el aviso de sentido contrario.

- En la lectura de la tabla de checkpoints (PC 0x13970) se evita la coincidencia cuando se cruza en el sentido original. La tabla no se modifica. El arcade conserva sus máscaras, contador de checkpoints y cálculo del tiempo para los cruces admitidos.
- En la rama de meta del sentido original (PC 0x138B4), se devuelve una referencia no válida para que el arcade omita sus llamadas de validación de vuelta y crédito de tiempo de vuelta. El contador bruto de cruces sigue funcionando; no se congela para ocultar que el jugador retrocede.
- Las comparaciones inversas de clasificación de la revisión 22 se conservan. El coche pierde avance al volver hacia atrás; la corrección no escribe un primer/último puesto forzado.
- Los dos puntos de lectura están restringidos por PC, dirección de memoria y modo Expert inverso enlazado. El observador de sectores lee otras direcciones y no vuelve a entrar en el mismo interceptador. Las fases de attract y el modo normal conservan su comportamiento.

No se sustituyen las físicas, la interpolación ni el protocolo de red. No se alteran tablas de récords, datos del circuito ni el formato de los paquetes.

## Pruebas

- Regresión real con dos motores: el host gira con acelerador/dirección ordinarios después de avanzar inicialmente por la ruta inversa. Atraviesa los checkpoints del recorrido original; su máscara permanece en 1, no recibe vuelta validada y queda segundo detrás del invitado que sigue correctamente.
- Misma prueba con el invitado como coche que gira: no obtiene crédito indebido y queda segundo detrás del host.
- Tres motores enlazados con el distribuidor de producción: el host que gira permanece tercero, mientras los dos que circulan correctamente conservan los puestos primero y segundo. No se escriben posiciones, máscaras, clasificación ni temporizadores desde los tests; el piloto automático es una herramienta local y no se distribuye.
- Carrera inversa completa con dos motores, vueltas/checkpoints originales, llegada de un ganador antes de agotarse el tiempo y repetición por moneda/Start en la misma sesión: PASS.
- Aplicación con dos motores de producción y WebRTC mediante relay TURN/UDP local: arranque Expert inverso y retorno a Normal: PASS.
- 137 pruebas unitarias: PASS. Comparación de hashes del MB de RAM de trabajo original contra revisión 21, desde arranque hasta 1.440 ticks de carrera single player normal: PASS.

Los ensayos de conducción usan entrega local inmediata, no una simulación de internet con pérdidas. La prueba WebRTC valida el arranque por red local. No se han validado ocho motores inversos ni todas las modalidades/dificultades.

Evidencia local: `build/reverse-wrong-direction.json`, `build/reverse-wrong-client.json`, `build/reverse-wrong-direction-three.json`, `build/reverse-expert-engine.json`, `build/reverse-expert-browser.json`, `build/reverse-normal-parity.json`, `build/unit-tests.txt`.

La comparación previa está en `../multiplayer-reverse-expert/build/reverse-wrong-host-racing-baseline.json`. El ZIP y los archivos nativos/frontend de la revisión 22 se verifican por SHA-256 antes de empaquetar.

Si el salto a primero persiste, sigue pendiente capturar qué cabina cambió de sentido, si ocurre durante la carrera o en resultados y la transición exacta del HUD. Esta revisión no sustituye esa confirmación.
