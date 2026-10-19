# Daytona USA Web — versión 50.1: salas públicas

La 50.1 pausa el directorio tras cinco minutos sin interacción, retira la escucha y desconecta Realtime Database. Oculta las plazas antiguas y muestra **Room list paused** con **Reconnect**; mover el ratón o volver de otra pestaña no reconecta por sí solo una lista ya pausada. Pulsar Reconnect o volver a entrar desde el menú inicia un nuevo período. El plazo se revisa cada 15 segundos mientras la pestaña está visible y al recuperarla. No se aplica al anuncio de un host público ni a jugadores del lobby/carrera. El pie de versión muestra `v50.1 · 19.10.26`, sin «test». La compatibilidad de salas sigue siendo la de la 50 porque no cambia el protocolo del juego.

La API key se restringió en Google Cloud a Firebase App Check, Firebase Installations, Firebase Management, Identity Toolkit y Token Service; sus orígenes permitidos son `https://johannruiz.github.io/*`, `http://localhost:8122/*` y `http://127.0.0.1:8122/*`. Publicar bajo otro dominio o desarrollar en otro puerto requiere añadirlo primero. Estas restricciones se guardan en la consola, no en el JavaScript del ZIP. Se verificó de nuevo la conexión real después de aplicarlas.

La integración de App Check está en `web/firebase-security.js` y se inicializa antes de Authentication/Database. Reutiliza el SDK y sus tokens, pausa su renovación automática al desconectar el directorio y la restaura al volver a usarlo. El proveedor reCAPTCHA Enterprise está registrado, con clave restringida a `johannruiz.github.io` y TTL de una hora. **Por petición expresa del propietario, App Check ya se exige en Realtime Database y Authentication; hay que publicar este ZIP de inmediato.** La 50 anterior no envía tokens y dejará de acceder al directorio una vez propagada la exigencia (Firebase indica hasta 15 minutos). Las pruebas públicas en localhost necesitan el proveedor debug oficial y un token privado registrado; nunca debe publicarse ese token ni añadirse localhost a la clave reCAPTCHA de producción. Single player e invitaciones privadas no necesitan el directorio.

App Check no tiene un coste directo adicional, pero su proveedor reCAPTCHA usa una cuota independiente. Sin facturación, ofrece hasta 10.000 evaluaciones por mes natural agregadas por organización, entre cuentas/sitios/proyectos; al agotarla devuelve errores de cuota. No son 10.000 actualizaciones de sala ni necesariamente 10.000 jugadores. El TTL habitual de una hora reutiliza verificaciones entre solicitudes y renueva aproximadamente a mitad del plazo mientras está activo. No se habilitó facturación ni se cambió Spark. [Cuotas oficiales](https://docs.cloud.google.com/recaptcha/docs/billing-information).

## Salas públicas introducidas en la 50

La revisión 50 añade un directorio de salas públicas con Firebase Realtime Database y conserva PeerJS para las conexiones del juego. El listado aparece a la izquierda; crear una sala pública o privada y entrar mediante invitación quedan a la derecha. En móvil se apilan sin desbordamiento horizontal. Las salas públicas admiten automáticamente; las privadas conservan la aprobación del host. El máximo sigue siendo ocho participantes y sólo se admiten nuevas entradas desde el lobby.

Publicar la **50.1**. Prueba local: `node scripts/serve.js dist 8122` y http://localhost:8122/ (el directorio público requiere un token debug privado después de la exigencia). Para GitHub Pages, subir el **contenido** de `daytona_multiplayer_50_1_public_security_github_pages.zip`, con `index.html` en la raíz. No contiene ROM ni herramientas de prueba. Las revisiones 49 y el ZIP original 50 se conservan; el motor JS/WASM no cambia.

Firebase almacena únicamente siete campos por sala pública: nombre, número de participantes, estado, invitación PeerJS completa, UID propietario, fecha de actualización del servidor y versión compatible. No almacena chat, nombres de jugadores, controles, posiciones ni datos de carrera. El anuncio se elimina al salir y mediante `onDisconnect`; si una interrupción impide confirmar su retirada, el listado oculta anuncios sin actualizar durante 90 segundos. El host renueva su anuncio cada 30 segundos y al cambiar el estado. La consulta está limitada a las 50 salas actualizadas más recientemente y sólo permanece conectada mientras se consulta el listado o se anuncia una sala.

La configuración web de Firebase ya está integrada. Habilitar Authentication → Método de acceso → Anónimo y publicar `firebase.database.rules.json` en Realtime Database → Reglas. En el proyecto configurado estas reglas **ya fueron publicadas por el propietario y comprobadas con una conexión real**. Restringen la escritura al propietario, validan los siete campos y exigen consultas acotadas; no se debe sustituirlas por acceso público de escritura. `firebase.json` configura exclusivamente los emuladores de desarrollo y no hace falta subirlo a Pages.

Analytics se mantiene, se carga cuando el navegador está libre y falla de forma independiente al juego. La página enviada excluye parámetros e invitaciones del enlace; no se añaden eventos con nombres, chat o contenido de salas. Analytics no usa la cuota de Realtime Database. Si Firebase no está disponible, se informa en el directorio; una carrera ya conectada por PeerJS continúa y las invitaciones privadas siguen funcionando.

Validación de esta revisión: **209 pruebas JS**, **26 comprobaciones de reglas en emulador**, dos motores reales con PeerJS, revisión visual de escritorio/móvil y pérdida/reconexión de Firebase durante la simulación. También se comprobó el Firebase real: publicación, entrada automática, contador, rechazo de borrado por un invitado y retirada confirmada. Las dos cuentas anónimas temporales se eliminaron al terminar. Analytics se verificó con el SDK real e interceptando su envío para no contaminar las estadísticas. Evidencia: `build/public-rooms/validation.json`; metodología y límites en `INVESTIGACIONES.md`. Esto valida el directorio; no amplía la certificación de red o de llegadas de la 49.

## Antecedentes de la revisión 49

<!-- RACE AUTHORITY 49 -->
El host publica una clasificación humana compartida y un orden estimado de llegada usando los eventos originales de meta de cada cabina y relojes calibrados. La lista de nombres y las lecturas nativas de puesto reciben esa misma decisión. Los eventos no se ordenan por llegada de paquetes. Si los márgenes temporales se solapan, se conserva un puesto único y aparece **PHOTO FINISH · ESTIMATED ORDER**. No se asignan empates; la igualdad exacta entre estimaciones usa el ID nativo de coche como desempate determinista.

Usar la **49 en todas las cabinas**. Prueba local: `node scripts/serve.js dist 8121` y http://localhost:8121. La 48 y su ZIP permanecen intactos en su carpeta independiente. Subir el contenido del ZIP 49 a GitHub Pages; no contiene ROM ni herramientas privadas de inspección.

Durante la carrera se comparan progresos auténticos de un instante común. La meta se confirma mediante evidencia temporal de todos los participantes; mientras falta, se muestra **CONFIRMING FINISH…**. La simulación continúa. La decisión final queda fija y se retransmite con confirmación de recepción. Los eventos pendientes sobreviven a resultados, attract y una moneda nueva. El host puede arbitrar una carrera en la que sigue en attract.

El predictor de movimiento y los contactos conservan la 48. Esta capa no hace físicamente exactas las colisiones ni las imágenes cercanas con latencia alta. No escribe checkpoints, vueltas ni solicitudes de meta: observa la solicitud original y sustituye las lecturas de puesto humano cuando existe una decisión válida. Como el juego usa el puesto en otras reglas nativas, esas lecturas también pueden influir en sus ayudas o bonificaciones según posición. Single player no activa esta autoridad.

Validación: 199 pruebas JS; dos motores reales con TURN UDP local, RTT 150/300 ms, jitter ±25 ms por trayecto y 3 % de pérdida a 300 ms; carreras originales completas de ocho vueltas, bots, host en attract, llegadas con incertidumbre solapada y otra carrera inmediatamente después. Las carreras completas usan tiempo virtual y entregas demoradas deterministas; las pruebas UDP usan tiempo real y son una evidencia distinta. No equivalen a certificar ocho dispositivos por Internet. Ver INVESTIGACIONES.md y build/race-time/validation.json.

En la comprobación adicional de Advanced inverso el piloto agotó el tiempo tras dos de cuatro vueltas: la decisión final DNF y los puestos nativos coincidieron en ambas cabinas. El ensayo que exigía alcanzar meta falló y se conserva como tal; no demuestra una llegada inversa. Esas llegadas y las disputas reales a varias cabinas siguen pendientes de prueba manual.

## Antecedentes de la versión 48

<!-- ADAPTIVE MOTION 48 -->
Compensación gradual de movimiento para enlaces con RTT de 300–400 ms. Conserva la versión 47 en su carpeta y ZIP originales. La confianza temporal deja de cortarse en 150 ms de incertidumbre; la edad compensada cambia gradualmente. El horizonte adicional varía entre 6 y 16 pasos de origen según cambios reales de velocidad/dirección, jitter y confianza temporal. Se conservan los dos pasos posteriores del TGP original y la recuperación suave de correcciones.

Usar la **48 en todas las cabinas**; las salas tienen compatibilidad independiente de la 47. Prueba local: `node scripts/serve.js dist 8120` y http://localhost:8120. ZIP estático sin ROM ni herramientas privadas de inspección; subir su contenido a GitHub Pages.

Sólo cambia el predictor de movimiento multiplayer. La clasificación común de la 47, checkpoints, vueltas, meta, lobby y tiempos de desconexión conservan su implementación. La reconstrucción de posición también entra en los contactos nativos existentes; las colisiones ajustadas necesitan prueba manual. Esta revisión no certifica ganadores ni elimina toda discrepancia de imagen a latencia alta. Single player conserva su simulación.

181 pruebas JS; pruebas C++/WASM de continuidad, incertidumbre, pérdida, frenada, parada, curva, wrap y fuente lenta; A/B con trayectorias idénticas; dos motores reales a 150/300/400 ms con jitter y a 300 ms con 3% de pérdida UDP. Resultados y límites en INVESTIGACIONES.md y build/race-time/validation.json del árbol de trabajo.

## Antecedentes de la versión 47


La 47 corrige la edad de los estados de red desde su generación hasta su consumo nativo. La clasificación compara avances auténticos de un instante común, incluido el coordinador, y refina los empates de sector con la posición de ese mismo estado sobre la línea original del circuito. Se conservan las reglas originales de vueltas, checkpoints y meta.

Esta es una candidata para comparar con 46.1. Se comprobaron 150 ms estables y con jitter de ±25 ms, cuatro motores con host en attract y una vuelta de Advanced inverso con CPU en Grand Prix. Las llegadas muy ajustadas y la clasificación final todavía requieren validación manual; los intentos automáticos en Normal se agotaron antes de alcanzar una meta. No se presenta como una corrección definitiva de ganadores.

Todas las cabinas deben usar la 47; es incompatible con salas 46/46.1. La versión 46.1 se conserva en su carpeta y ZIP originales. Estos cambios de temporización y clasificación se activan sólo en enlace multiplayer.


La revisión 46.1 simplifica la lista: sólo puesto y nombre, conservando el color del coche y la permanencia hasta attract.

La revisión 46 añade nombres y posiciones originales del arcade debajo de Cabinet. Texto pixelado, colores del coche elegido y puestos ordenados; conserva la tabla durante resultados y registro de nombre hasta volver a attract. La asociación usa los IDs de enlace originales y respeta los asientos intercambiados. Sólo presentación: no modifica el motor ni la red de la 45. La retirada en caliente continúa siendo un experimento aislado y no se distribuye aquí.

La revisión 45 detiene la simulación al cerrarse la sala, cierra las conexiones inmediatamente al abandonar o recargar la página y atiende fallos/cierres definitivos de WebRTC sin esperar al siguiente heartbeat. Una desconexión transitoria mantiene la tolerancia existente: 10 segundos sin progreso de juego, 20 segundos sin mensajes y 30 segundos para recuperar una conexión en el lobby. Al salir una cabina durante la partida, las demás detienen el enlace y regresan al menú; si sale el host, la sala se cierra. No hay migración de host. El motor y las reglas de carrera permanecen como en la 44; su ZIP se conserva.

La revisión 44 recupera automáticamente ajustes de cabina guardados que no son utilizables. Conserva por separado la memoria de puntuaciones válida y guarda una copia del dato original en el navegador cuando el almacenamiento lo permite. Un guardado incompleto durante el arranque ya no reemplaza otro válido. Los perfiles compatibles siguen migrando a DELUXE mediante el menú original. El motor y las reglas de carrera son los de la 43; ambos ZIP anteriores se conservan.

Advanced y Expert inversos: se conservan los checkpoints intermedios bidireccionales del arcade. Los saltos cortos reales de sectores tras choques se entregan a sus rutinas originales para que no se pierdan checkpoints o cruces de meta. La clasificación y el cálculo de recuperación entre jugadores usan el mismo sentido de progreso. La vuelta aceptada exige avance nuevo en inverso: recoger checkpoints hacia delante y regresar a meta no concede una vuelta falsa. Beginner conserva su política de checkpoints y rolling start. La revisión 42 queda conservada en su ZIP.

Navegación de menús con el mando seleccionado: cruceta o stick izquierdo para mover el foco, A para entrar/aceptar y B para volver. Arriba/abajo recorre todos los controles visibles en orden del formulario; izquierda/derecha mueve entre controles de una fila o ajusta sliders. LB/RB cambian las categorías de Settings; al enfocar una pestaña secundaria también permiten cambiar ese grupo. Izquierda/derecha ajustan sliders. A abre una lista de opciones con elección temporal independiente del formulario y vuelve a confirmar; B cancela sin aplicar cambios. Las actualizaciones periódicas del lobby no borran esa elección ni devuelven la opción anterior. En el lobby B muestra Leave room cuando corresponde.

Las ayudas contextuales aparecen abajo a la derecha al usar el mando y ceden ante ratón/teclado. Se reserva su espacio mientras hay mando conectado para mantener el tamaño del modal. La versión y fecha de publicación aparecen abajo a la izquierda: v48 test · 19.10.26, sólo mientras hay un menú abierto.

Los comandos del menú usan posiciones estándar y no modifican las asignaciones del juego. Se suspenden durante captura de mando, volante o teclado. A sobre Live input entra en prueba; B sale. Los botones usados para cerrar el menú se ignoran en la conducción hasta soltarlos. Home, en el mapeo estándar y cuando el navegador lo entrega, abre el menú durante el juego. Start conserva su asignación de conducción. Home puede estar reservado por el sistema; en ese caso se puede usar Esc o el botón de menú de la pantalla. El selector de archivos del navegador sigue requiriendo ratón/teclado; escribir nombres/chat requiere entrada de texto.

La tarjeta propia tiene un contorno completo del color del coche (1 rojo, 2 azul, 3 amarillo, 4 verde, 5 negro, 6 rosa, 7 celeste y 8 naranja). Cambia con el asiento y mantiene la etiqueta You.

Seleccionar una tarjeta de otro jugador envía una solicitud de intercambio: el destinatario acepta o rechaza; el solicitante puede cancelar. Ambos asientos siguen iguales hasta aceptar. Al aceptar se intercambian en una sola actualización y se reinicia Ready. Mientras se espera no se puede arrancar la sala ni mover los dos asientos. El aviso caduca a los 30 segundos y se cancela si alguien se desconecta o sale. B sobre el aviso rechaza/cancela sin abandonar la sala. No se cambia el orden de conexiones ni quién es host.

El indicador del juego muestra únicamente Cabinet N. La cruceta de las ayudas usa un SVG centrado.

En el lobby se asigna el primer asiento libre a cada admisión. Cada participante, incluido el host, puede elegir otro asiento libre con clic, toque o A; hover/foco sólo muestra la acción. El cambio es automático y no requiere aprobación manual del host. Las solicitudes se validan en el host y se confirman/reintentan por el canal de sala; dos personas no pueden obtener el mismo asiento. Los asientos reservados durante reconexión siguen ocupados. Cambiar asiento reinicia Ready de todos; no puede hacerse en preparación/carrera. Al salir alguien, los demás conservan su número y una nueva admisión llena la primera vacante.

El número elegido configura CAR NUMBER mediante el menú original y determina el coche al arrancar. Los identificadores internos del enlace siguen el orden de admisión, con el host primero, independientemente del número elegido. Se verificó una sala PeerJS real con host WebGPU e invitados WebGL2, coches 8/6/2 e IDs internos 1/3/2, EEPROM original y entrada a carrera Beginner. Los casos de 2–8 en unitarias comprueban layouts binarios; no son ocho dispositivos físicos.

La categoría Graphics ya no muestra el backend activo. En Settings → Experimental, al final del ajuste de volantes, se puede elegir Automatic, WebGPU o WebGL2. La elección se guarda en el dispositivo y se aplica al recargar; el botón Reload to apply guarda la memoria de la cabina antes de recargar. Es necesario volver a elegir la ROM. Si se pertenece a una sala, hay que salir antes de usar ese botón. Un parámetro renderer explícito en la URL tiene prioridad al abrir un enlace; cambiar el selector actualiza ese parámetro sin interrumpir el juego.

Debajo aparece Show performance window. Muestra las mismas mediciones locales que Connections y ambos controles se sincronizan. La política de grabación del host sigue aplicándose: si los diagnósticos están desactivados para la sala, la ventana no se puede activar.

Automatic prefiere WebGPU y recurre a WebGL2 si falla su inicialización. El backend activo se muestra en Experimental.

Ejecutar `node scripts/serve.js dist 8120` y abrir http://localhost:8120. En multiplayer, usar la misma revisión en todas las cabinas; pueden seleccionar APIs distintas.

El ZIP es un sitio estático para GitHub Pages, sin ROM ni observadores de pruebas. Subir su contenido. Los ZIP de las revisiones 36, 37 y 38 se conservan.

[Investigaciones y mediciones acumuladas](INVESTIGACIONES.md).
