# Daytona USA Web — revisión 46.1 experimental

La revisión 46.1 simplifica la lista: sólo puesto y nombre, conservando el color del coche y la permanencia hasta attract.

La revisión 46 añade nombres y posiciones originales del arcade debajo de Cabinet. Texto pixelado, colores del coche elegido y puestos ordenados; conserva la tabla durante resultados y registro de nombre hasta volver a attract. La asociación usa los IDs de enlace originales y respeta los asientos intercambiados. Sólo presentación: no modifica el motor ni la red de la 45. La retirada en caliente continúa siendo un experimento aislado y no se distribuye aquí.

La revisión 45 detiene la simulación al cerrarse la sala, cierra las conexiones inmediatamente al abandonar o recargar la página y atiende fallos/cierres definitivos de WebRTC sin esperar al siguiente heartbeat. Una desconexión transitoria mantiene la tolerancia existente: 10 segundos sin progreso de juego, 20 segundos sin mensajes y 30 segundos para recuperar una conexión en el lobby. Al salir una cabina durante la partida, las demás detienen el enlace y regresan al menú; si sale el host, la sala se cierra. No hay migración de host. El motor y las reglas de carrera permanecen como en la 44; su ZIP se conserva.

La revisión 44 recupera automáticamente ajustes de cabina guardados que no son utilizables. Conserva por separado la memoria de puntuaciones válida y guarda una copia del dato original en el navegador cuando el almacenamiento lo permite. Un guardado incompleto durante el arranque ya no reemplaza otro válido. Los perfiles compatibles siguen migrando a DELUXE mediante el menú original. El motor y las reglas de carrera son los de la 43; ambos ZIP anteriores se conservan.

Advanced y Expert inversos: se conservan los checkpoints intermedios bidireccionales del arcade. Los saltos cortos reales de sectores tras choques se entregan a sus rutinas originales para que no se pierdan checkpoints o cruces de meta. La clasificación y el cálculo de recuperación entre jugadores usan el mismo sentido de progreso. La vuelta aceptada exige avance nuevo en inverso: recoger checkpoints hacia delante y regresar a meta no concede una vuelta falsa. Beginner conserva su política de checkpoints y rolling start. La revisión 42 queda conservada en su ZIP.

Navegación de menús con el mando seleccionado: cruceta o stick izquierdo para mover el foco, A para entrar/aceptar y B para volver. Arriba/abajo recorre todos los controles visibles en orden del formulario; izquierda/derecha mueve entre controles de una fila o ajusta sliders. LB/RB cambian las categorías de Settings; al enfocar una pestaña secundaria también permiten cambiar ese grupo. Izquierda/derecha ajustan sliders. A abre una lista de opciones con elección temporal independiente del formulario y vuelve a confirmar; B cancela sin aplicar cambios. Las actualizaciones periódicas del lobby no borran esa elección ni devuelven la opción anterior. En el lobby B muestra Leave room cuando corresponde.

Las ayudas contextuales aparecen abajo a la derecha al usar el mando y ceden ante ratón/teclado. Se reserva su espacio mientras hay mando conectado para mantener el tamaño del modal. La versión y fecha de publicación aparecen abajo a la izquierda: v46.1 · 18.10.26, sólo mientras hay un menú abierto.

Los comandos del menú usan posiciones estándar y no modifican las asignaciones del juego. Se suspenden durante captura de mando, volante o teclado. A sobre Live input entra en prueba; B sale. Los botones usados para cerrar el menú se ignoran en la conducción hasta soltarlos. Home, en el mapeo estándar y cuando el navegador lo entrega, abre el menú durante el juego. Start conserva su asignación de conducción. Home puede estar reservado por el sistema; en ese caso se puede usar Esc o el botón de menú de la pantalla. El selector de archivos del navegador sigue requiriendo ratón/teclado; escribir nombres/chat requiere entrada de texto.

La tarjeta propia tiene un contorno completo del color del coche (1 rojo, 2 azul, 3 amarillo, 4 verde, 5 negro, 6 rosa, 7 celeste y 8 naranja). Cambia con el asiento y mantiene la etiqueta You.

Seleccionar una tarjeta de otro jugador envía una solicitud de intercambio: el destinatario acepta o rechaza; el solicitante puede cancelar. Ambos asientos siguen iguales hasta aceptar. Al aceptar se intercambian en una sola actualización y se reinicia Ready. Mientras se espera no se puede arrancar la sala ni mover los dos asientos. El aviso caduca a los 30 segundos y se cancela si alguien se desconecta o sale. B sobre el aviso rechaza/cancela sin abandonar la sala. No se cambia el orden de conexiones ni quién es host.

El indicador del juego muestra únicamente Cabinet N. La cruceta de las ayudas usa un SVG centrado.

En el lobby se asigna el primer asiento libre a cada admisión. Cada participante, incluido el host, puede elegir otro asiento libre con clic, toque o A; hover/foco sólo muestra la acción. El cambio es automático y no requiere aprobación manual del host. Las solicitudes se validan en el host y se confirman/reintentan por el canal de sala; dos personas no pueden obtener el mismo asiento. Los asientos reservados durante reconexión siguen ocupados. Cambiar asiento reinicia Ready de todos; no puede hacerse en preparación/carrera. Al salir alguien, los demás conservan su número y una nueva admisión llena la primera vacante.

El número elegido configura CAR NUMBER mediante el menú original y determina el coche al arrancar. Los identificadores internos del enlace siguen el orden de admisión, con el host primero, independientemente del número elegido. Se verificó una sala PeerJS real con host WebGPU e invitados WebGL2, coches 8/6/2 e IDs internos 1/3/2, EEPROM original y entrada a carrera Beginner. Los casos de 2–8 en unitarias comprueban layouts binarios; no son ocho dispositivos físicos.

La categoría Graphics ya no muestra el backend activo. En Settings → Experimental, al final del ajuste de volantes, se puede elegir Automatic, WebGPU o WebGL2. La elección se guarda en el dispositivo y se aplica al recargar; el botón Reload to apply guarda la memoria de la cabina antes de recargar. Es necesario volver a elegir la ROM. Si se pertenece a una sala, hay que salir antes de usar ese botón. Un parámetro renderer explícito en la URL tiene prioridad al abrir un enlace; cambiar el selector actualiza ese parámetro sin interrumpir el juego.

Debajo aparece Show performance window. Muestra las mismas mediciones locales que Connections y ambos controles se sincronizan. La política de grabación del host sigue aplicándose: si los diagnósticos están desactivados para la sala, la ventana no se puede activar.

Automatic prefiere WebGPU y recurre a WebGL2 si falla su inicialización. El backend activo se muestra en Experimental.

Ejecutar `node scripts/serve.js dist 8118` y abrir http://localhost:8118. En multiplayer, usar la misma revisión en todas las cabinas; pueden seleccionar APIs distintas.

El ZIP es un sitio estático para GitHub Pages, sin ROM ni observadores de pruebas. Subir su contenido. Los ZIP de las revisiones 36, 37 y 38 se conservan.

[Investigaciones y mediciones acumuladas](INVESTIGACIONES.md).
