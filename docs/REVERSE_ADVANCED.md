# Advanced inverso — revisión 25

Documento histórico. La revisión 29 habilita CPU en Advanced y Expert inversos: véase [REVERSE_ADVANCED_CPU.md](REVERSE_ADVANCED_CPU.md).

Versión independiente de la revisión 24. El empaquetado comprueba por SHA-256 que su código nativo, frontend, distribución, documentación y ZIP permanecen intactos.

## Implementación

El host elige **Direction → Advanced reverse** o **Expert reverse**, sin añadir otra fila al lobby. La selección se comparte con todas las cabinas, fuerza CPU cars OFF y reinicia Ready. Normal sigue siendo el valor inicial. Los invitados no pueden modificarla.

El selector original convierte la segunda tarjeta visible en el circuito interno 2 (Advanced); la tercera corresponde al circuito interno 1 (Expert). Se cambia la elección y su registro en PC `0x225FA4`, conservando la conversión y votación originales. La política se aplica después de preparar cada cabina y se borra al cargar o desactivar el enlace. Se conserva la API existente de Expert; la nueva selecciona 0=Normal, 1=Expert inverso o 2=Advanced inverso y rechaza otros valores.

Una prueba con el motor anterior, controles ordinarios y dos cabinas confirmó Advanced interno 2, N=486 y callback jugable `0xDC64`, con velocidad cero y CPU desactivada. En esta configuración su salida es detenida; no se añade un automatismo que conduzca primero hacia delante y teletransporte después.

La parrilla inversa ocupa sectores 4+4×ID, con dos carriles y orientaciones calculadas a partir de la geometría real de Advanced. Se inicializa una sola vez por carrera al entrar en el callback jugable. No se alteran los relojes ni las máscaras de checkpoints para fabricar vueltas.

Las correcciones de Expert se aplican al circuito inverso elegido: progreso invertido para clasificación, aviso de sentido, admisión de checkpoints y meta según desplazamiento real, alineación con la carretera y orientación de recuperación. La tangente canónica sigue en el sentido original; únicamente los consumidores identificados reciben la orientación invertida. Las recuperaciones conservan su desplazamiento y duración originales y normalizan el giro firmado antes de dividirlo.

## Pruebas

Las pruebas de motor ejecutan dos instancias del juego original y el distribuidor central de producción. El piloto de laboratorio usa acelerador y dirección ordinarios, con lecturas de estado; no escribe posiciones, vueltas, checkpoints ni temporizadores. Ese piloto y las observaciones de RAM no forman parte del ZIP.

- **Advanced, Normal/Easy:** carrera completa de cuatro vueltas, checkpoints originales en sectores 142 y 275, llegada antes de agotarse el tiempo y primer finalista clasificado primero. Otra carrera con moneda/Start sin recargar prepara la parrilla inversa exactamente una vez más.
- **Sentido incorrecto:** el host da la vuelta y cruza checkpoints hacia el sentido original. No obtiene bits adicionales ni una vuelta válida y sigue detrás del invitado que circula correctamente.
- **Recuperación de Advanced:** un impacto real completa la recuperación original de 21 ticks. Termina a una unidad angular de la tangente inversa, aproximadamente 0,0055°. No se consiguió una recuperación de 64 ticks en esa zona de Advanced; la regresión de Expert sí cubre ese mismo consumidor compartido.
- **Expert:** carrera completa, repetición inmediata y recuperaciones reales de 21 y 64 ticks; orientación inversa conservada en host e invitado.
- **Producción:** dos motores con PeerJS/WebRTC mediante TURN/UDP local arrancan Advanced y Expert inversos; retorno a Normal desbloquea CPU cars. Lobby desktop a 1366×768 sin scroll interno y móvil de 390 px sin desbordamiento horizontal.
- **Normal single player:** el MB completo de RAM de trabajo coincide con revisión 21 desde el arranque hasta 1.440 ticks de carrera Expert. Cargar single player elimina también una política previa de Advanced inverso.
- **138 pruebas unitarias:** validación, exclusión entre circuitos inversos, distribución de ajustes a ocho participantes y reinicio de Ready.

Informes: `build/reverse-advanced-engine.json`, `build/reverse-advanced-wrong-direction.json`, `build/reverse-advanced-recovery.json`, `build/reverse-advanced-browser.json`, `build/reverse-expert-engine.json`, `build/reverse-expert-browser.json`, `build/reverse-recovery.json`, `build/reverse-normal-parity.json` y `build/unit-tests.log`.

## Límites

Experimental y sin oponentes CPU. Las carreras completas cubren Normal/Easy con dos motores; no equivalen a probar exhaustivamente ocho motores en internet, todos los modos, dificultades ni puntos de accidente. El layout móvil se comprueba en Chrome emulado, no en un iPhone físico. No se cambian transporte de red, interpolación ni temporización del motor.
