# Validación de vueltas de Expert inverso — revisión 34

## Reproducción real en la 33

Las primeras pruebas completaron 16 vueltas humanas de Expert entre dos cabinas con y sin CPU, además de cuatro vueltas con maniobras hacia los laterales de la pista. No perdieron registros. Una prueba más dirigida, con comandos de dirección ordinarios cerca de media vuelta, sí reprodujo el fallo del líder.

Con N=990, el coche pasó de sector 502 a 492 en el frame 7229. Se omitieron las referencias 499 y 495, y la referencia de validación quedó en 7. En el frame 11799 cruzó la meta con todos los checkpoints (máscara 63), pero la vuelta validada siguió en cero y la referencia estaba en 13, menor que 495. La vuelta bruta ya había pasado de -1 a -2. El siguiente ciclo también podía quedarse sin avisos de checkpoint al conservarse la máscara de la vuelta rechazada.

Los datos proceden del motor real y de lectura de memoria, sin escribir posiciones, sectores o contadores. El caso fallido se conserva en `build/expert-checkpoints-before.json` y en el experimento separado de la 33.

## Cambio

Se amplía a Expert la misma protección de Advanced: cuando el intervalo auténtico de sectores cruza media vuelta en sentido inverso y la rama original de salto de varios sectores habría omitido la referencia, se conserva esa referencia. Se exige el coche propio, su controlador original de carrera, una carrera inversa activa y un intervalo menor que media pista. Beginner queda fuera de esta ampliación.

La protección no escribe la máscara de checkpoints ni concede vueltas o tiempo. El arcade sigue exigiendo todos los checkpoints y una vuelta bruta nueva. El bloqueo de créditos en sentido incorrecto se conserva. La corrección se limita a la condición de circuito del puente, de Advanced a los dos circuitos de salida detenida. El resto del motor, incluida la protección gráfica de la 33, permanece.

## Verificación de la 34

- `expert-checkpoints-off.json`, `expert-checkpoints-on.json`: cuatro vueltas por cabina y perfil, registro de los checkpoints del líder, ausencia de vueltas perdidas y prueba de dos cruces de meta en sentido original sin créditos inversos.
- `expert-checkpoints-on-stress-late.json`: repetición del caso que falló con comandos normales cerca de media vuelta; referencia 495 conservada en el salto 502 → 492 y meta validada. Dos vueltas por cabina.
- `advanced-preserved-parity.json`: comparación de todo el MB de RAM de dos cabinas de Advanced contra la 33 durante parrilla y 6.000 pasos de carrera.
- `beginner-preserved-parity.json`: comparación de todo el MB de RAM de dos cabinas de Beginner contra la 31 durante salida, cuenta atrás, GO y 1.440 pasos posteriores.
- `reverse-normal-parity.json`: single player normal comparado con su base original, desde arranque hasta 1.440 pasos de carrera.
- `standing-grid-eight.json`: ocho cabinas humanas y ocho bots en Expert inverso.
- `standing-grid-browser.json`: producción WebGPU, PeerJS y TURN/UDP local con dos cabinas.
- `unit-tests.log`: 139 pruebas unitarias.

Las pruebas usan Endurance original para disponer de tiempo; no cambian el modo por defecto. Los informes finales incluyen huellas del motor y se exige coincidencia antes de empaquetar. Se verifica también que los archivos y el ZIP de la 33 estén intactos. Las pruebas locales no cubren todos los dispositivos y redes.
