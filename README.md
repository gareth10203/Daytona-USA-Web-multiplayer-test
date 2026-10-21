# Daytona USA Web — 52.5: paged race settings and optional race rules

Based on 52.4, preserved in its original folder and ZIP. All room participants must use 52.5.

The lobby's **Race settings** panel now has Previous/Next buttons and a page counter. **Race setup** contains mode, difficulty, CPU cars and direction; **Race rules** contains player collisions, pit stops and CPU liveries. Changing pages keeps the panel height and selected values stable. The page choice is local and survives room updates; guests can browse both pages. Only the host can edit settings, while in the lobby. Rule changes clear Ready and are applied to every cabinet on session start.

Original behavior remains the default: contacts On, pit service On, multiplayer CPU liveries. Optional rules:

- **Player collisions Off:** skip human–human contact response. CPU contacts and walls stay solid. Car poses, traffic ordering and slipstream routines are not disabled.
- **Pit stops Off:** prevent the original automatic pit entry/service transition. The lane stays open to drive through as a shortcut. Also available in the Single Player setup and saved on that device.
- **CPU liveries Single player:** use original single-player appearance selectors for bots in a linked game. Human colors, IDs, AI and physics are retained. This selector is disabled when CPU cars are Off.

No changes to the movement channel, network pacing, frame clock, renderer, Firebase rules, App Check or Analytics. Diagnostics remain off by default. The new rules are native, scoped read predicates in the existing recompiled engine; no Lua runtime or per-frame teleporting is added.

Validation: 270 Node tests; the paged panel tested at 1440×900, 1280×720 and mobile 390×844; two real native engines completed a lap on all three courses in both directions with the rules enabled. Original CPU appearance selectors were checked for every bot. Default-rule RAM/texture parity covers boot, attract, selection and reload. See INVESTIGACIONES.md for exact evidence and limits. Local tests do not certify all WAN conditions, physical controllers, iPhone Safari, every collision geometry or a full pit-lane finish on each course.

Publish the ZIP contents with `index.html` at the root. Local: `node scripts/serve.js dist 8130`. No ROM, generated game listing or private diagnostic bindings are packaged.

---

## Previous release notes (historical)

# Daytona USA Web — 52.4: chat controls and layout

Based on 52.3, preserved in its original folder and ZIP. All room participants should use 52.4.

Typing in the in-game chat suppresses keyboard driving only. The selected controller, calibrated wheel, separate pedals and held touch controls continue to be polled. Opening or sending chat does not clear physical device edges or remap buttons. Minimize restores canvas focus; keyboard driving resumes normally after leaving the field.

The scrollbars use the light ivory/grey room palette. New-message buttons are centered by their own anchor in both game and lobby, so shared hover/pressed transforms cannot displace them. Room heartbeats do not repeatedly scroll unchanged history. When the bounded history trims old messages, the surviving line being read stays anchored.

On touch screens the smaller CHAT button sits on the left, above steering, with a 44 px minimum target. Opening history by touch does not automatically open the software keyboard. The expanded panel leaves gear/pedal controls clear and adjusts to portrait, landscape and control sizes through 140%.

The waiting-seat policy, reliable chat protocol, native engine, movement transport, race authority, graphics and frame clock are unchanged. Chat still hides and locks at native start and returns in attract. Firebase rules/configuration are unchanged; diagnostics stay off by default.

Validation: 268 Node tests and `build/chat-polish/validation.json` (real DOM checks, seven emulated mobile layouts and two production WASM engines with browser-emulated controller/wheel/pedals). This does not certify physical devices or iPhone Safari. Private test bindings and ROM are not packaged.

Publish the ZIP contents with index.html at the root. Local: `node scripts/serve.js dist 8129`.

---

## Previous release behavior

# Daytona USA Web — 52.3: waiting seats during a session

Based on 52.2. All players must use 52.3. The previous release remains in its original folder and ZIP.

Drivers can join while the arcade is preparing or running. They reserve an open seat, see the room roster and use the shared lobby chat. They do not start a native cabinet or spectate the game. The current cabinet roster, native link count, epoch and race authority remain fixed.

- Public rooms: direct entry to waiting. On return to the lobby, connected waiting drivers join the grid automatically with their reserved car number and Ready cleared.
- Private rooms: late arrivals can wait and chat; the host admits or declines them in the lobby. These actions are disabled during the current arcade session.
- The host gets a nonmodal toast that does not move focus or pause the game.
- Capacity is eight total active, waiting and pending drivers. Explicit departure frees a reservation; transport interruption retains it for the existing 30-second recovery period.
- Attract mode inside the arcade is not the room lobby. Use **Return all to room** to incorporate waiting drivers before starting the next linked session.

Chat uses the existing reliable connection, sender identity, 60-message history, 240-character limit, rate limiting and command receipts. Waiting participants cannot send native snapshots, progress, stop, Ready, seat changes or race results. Racing cabinets retain the previous hidden-chat and unread-message behavior.

The public directory keeps the same minimal Firebase schema and security rules. Its count includes waiting seats; compatible starting/racing rooms offer **WAIT FOR NEXT RACE** when capacity remains. Chat and player names are not added to Firebase. Inactivity pause, App Check and Analytics are preserved; no console changes are required.

Diagnostics remain off by default and manually available in **Connections**. Native WASM, graphics, physics, race authority and movement transport remain unchanged from 52.2.

Publish the ZIP contents with `index.html` at the root. Local: `node scripts/serve.js dist 8128`. No ROM or private fixture bindings are included.

Validation: `unit-tests.txt`, `build/waiting-room/validation.json`, `package-validation.json`, and `INVESTIGACIONES.md`. Local Chromium touch emulation is not physical iPhone/Safari certification. No new WAN benchmark is claimed.

## Preserved 52.2 chat behavior

Derivada de la 52.1, con diagnósticos detallados apagados por defecto y el mismo transporte de movimiento. No incluye la candidata 53.

El chat de la sala aparece sobre el juego, abajo a la derecha, en una ventana translúcida del mismo estilo que el lobby. Comparte historial y mensajes con éste. Se puede minimizar; el botón Chat muestra los mensajes nuevos de otros jugadores que siguen sin leer. Abrirlo o leer el final del historial en el lobby limpia el contador. La preferencia de minimizar se guarda sólo en el dispositivo; el texto pendiente no se guarda fuera de la página.

Está disponible durante attract, selección y presentación. Al entrar en la salida nativa (escena 22, que incluye rolling start/cuenta atrás) se oculta y no permite enviar, incluso desde el menú. Permanece deshabilitado durante carrera, resultados y registro de nombre; se habilita al volver a attract (escenas 0–10). No depende de un temporizador ni de audio inventado. La captura de estado local actual evita que un paquete propio de un fotograma anterior vuelva a cambiar la disponibilidad.

La política es por cabina: quien permanece en attract puede escribir mientras otros corren. Los corredores no ven el panel ni oyen sus avisos de chat; los mensajes quedan pendientes para cuando vuelvan a attract. El host comprueba la escena recibida de cada emisor y la sesión, y conserva la identidad autenticada, límites de longitud/frecuencia y confirmaciones de comandos. No se envían mensajes de chat por el canal descartable ni se guardan en Firebase.

Al escribir, los controles de conducción reciben valores neutros. Enter envía; Escape minimiza el chat cuando tiene el foco. No se introduce una tecla global que interfiera con los mapeos personalizados. La superficie de chat permite escritura y desplazamiento táctiles sin relajar la protección de los pedales/volante frente a gestos del navegador. En pantallas táctiles la ventana reserva espacio sobre los controles.

Esta sección describe el comportamiento heredado de 52.2; la distribución actual es 52.3 y usa el puerto 8128.

Validación y límites: INVESTIGACIONES.md y build/game-chat/validation.json. No se repite aquí un benchmark de red ni se afirma un cambio en la fluidez, física, clasificaciones o precisión de las colisiones.
