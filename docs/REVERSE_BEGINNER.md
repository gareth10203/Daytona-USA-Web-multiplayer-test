# Beginner inverso — revisión 26

Versión independiente de la revisión 25. La distribución comprueba los hashes de la versión anterior y de su ZIP para conservarlos intactos.

## Uso

El host elige **Race settings → Direction → Beginner reverse**. La política se comparte con todas las cabinas, selecciona Beginner, desactiva los coches CPU y reinicia Ready. Normal sigue siendo el valor inicial. Advanced y Expert inversos siguen disponibles y conservan su salida detenida.

## Salida lanzada

Beginner es el circuito interno 0 y contiene sectores 0…195. La API conserva 0=Normal, 1=Expert inverso y 2=Advanced inverso; añade 3=Beginner inverso. Se conserva también la API anterior de Expert.

Antes de iniciar la conducción automática se refleja la parrilla real respecto a meta, sobre la geometría y los carriles originales. El carril fraccionario se interpola con la tabla del propio juego. Se conserva la velocidad inicial original y se prepara una sola vez por carrera la parrilla local completa, que incluye las representaciones de los otros participantes.

El conductor original propio usa el callback `0xD8A4`; los otros vehículos durante esta fase usan `0xDB6C`. Ambos reciben un objetivo de carretera cuatro sectores hacia el sentido inverso. Sus consumidores de inclinación y zonas de aceleración/freno siguen la misma dirección. El juego continúa calculando la conducción, las físicas y la velocidad.

Los consumidores del contador original detectan los umbrales cruzados de 3/2/1 aunque una actualización no coincida exactamente con el sector esperado. No se sustituye el audio ni se introduce un temporizador de carrera distinto. La entrega de control requiere completar ese contador y detectar meta, un cruce real de la unión entre sectores o el callback jugable confirmado de un participante. Para aceptar este último debe haberse recibido antes su callback de salida lanzada en esa carrera; un paquete antiguo de la carrera anterior no sirve.

La comunicación lee los slots recibidos de la comboard en `0x01A021C0`, con paso `0x1C0`. El callback de jugador está en el offset `0x4C` y conserva la actualización de control más reciente. La entrega a `0xDC64` mantiene la velocidad y la vuelta válida cero. El contador de vuelta interno distingue correctamente un coche que aún se aproxima a meta de otro que acaba de cruzarla en sentido inverso.

Si sólo una cabina entra en carrera y las demás siguen en attract, se conserva la ruta original de Time Attack: 40 estructuras internas y un solo coche activo. La preparación inversa filtra el bit de actividad original, sin reducir artificialmente el contador de estructuras ni modificar las rutinas de rivales del arcade.

Se reutilizan las correcciones de clasificación, admisión de vueltas según desplazamiento real, aviso de dirección y orientación de recuperación de los otros circuitos inversos. Beginner no tiene checkpoints intermedios; no se inventan para este modo. Se mantienen las ocho vueltas originales en Normal.

## Verificación

Los ensayos de motor ejecutan instancias reales del juego y el distribuidor central de producción. El piloto de laboratorio utiliza acelerador y dirección ordinarios. Las lecturas de auditoría y ese piloto quedan fuera del ZIP de producción.

Resultados de la compilación final:

- Dos cabinas completan una carrera de ocho vueltas en Normal/Easy. El primer finalista queda primero y una nueva moneda inicia otra salida lanzada completa sin recargar.
- Ocho motores reales muestran los tres pasos del contador nativo y entregan el control en el mismo tick de simulación (2780), manteniendo velocidad y vuelta cero. Esta prueba usa entrega local, sin latencia de internet.
- El host sigue en attract y el invitado completa una vuelta inversa con un solo coche activo, manteniendo la ruta original de Time Attack.
- El host da la vuelta mediante dirección ordinaria y cruza meta en el sentido original: no obtiene vueltas inversas y sigue detrás del corredor válido en ambas cabinas.
- Se conservan las regresiones de carreras completas de Expert y Advanced, las recuperaciones reales de Expert y la paridad del MB de RAM original en single player.
- Dos navegadores con el motor de producción y TURN/UDP WebRTC local completan la salida automática inversa y la entrega de control; volver a Normal desbloquea CPU cars.
- 139 pruebas unitarias pasan. La interfaz cabe en desktop a 1366×768 sin scroll interno; el selector muestra el nombre completo y móvil de 390 px no desborda horizontalmente.

Los informes reproducibles se guardan en `build/`: carrera completa de Beginner y repetición inmediata, salida con ocho cabinas, regresiones de Expert y Advanced, recuperación de Expert, paridad de RAM de single player y arranque WebRTC del motor de producción. Las pruebas de interfaz revisan desktop a 1366×768 y móvil de 390 px. La emulación de viewport móvil no acredita rendimiento en un iPhone físico.

La compilación final conserva los flags de optimización de la revisión 25. El motor de auditoría sólo añade observaciones; el paquete verifica que el fuente coincide con producción al retirar esas observaciones y que los exports de auditoría no están presentes en el motor distribuido.

## Alcance

Es un modo experimental sin coches CPU. Las carreras completas de laboratorio usan dos cabinas y entrega local; la prueba de ocho cubre la salida. Todos los modos, impactos en todos los puntos de la pista y condiciones de internet no están exhaustivamente cubiertos. Todos los participantes deben actualizar a la misma versión.
