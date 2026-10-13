# Multiplayer performance test

This is a separate copy in multiplayer-optimized. The previous multiplayer-version
and original single-player project are preserved. Both participants must use this
new build: daytona-rev-a-link-performance-3. Older builds are rejected at admission.

## Prueba entre dos equipos

1. Publicad el contenido del ZIP en una carpeta o repositorio de GitHub Pages.
   index.html queda en la raíz publicada. Cada jugador carga su propia ROM.
2. Abrid la nueva URL ambos jugadores, cread una sala y compartid su invitación.
3. En Ajustes → Experimental, activad Show performance overlay en ambos equipos.
4. Probad la misma pista, distancia gráfica y condiciones que antes durante una
   carrera. El menú sigue sin pausar la emulación multijugador.
5. Si hay un tirón, anotad cuándo ocurrió. Después, en Ajustes → Experimental,
   pulsad Download local report en cada equipo y conservad ambos JSON.

The overlay is off initially and does not cover the menu. Reports are created
locally; nothing is uploaded. They retain at most 300 one-second samples. No ROM,
invitation secret, player nickname, IP address or candidate address is included.

## Reading the measurements

- SIM: actual game steps per second, target approximately 57.52 Hz. DRAW counts
  renderer submissions, which can repeat a simulation frame. Normal SIM FPS also
  counts game steps now.
- CPU/p95: synchronous WASM step wall time, including game logic, geometry and
  audio preparation. GPU execution time is not measured.
- Gap: largest measured time between completed steps in the sample window.
- RTT: maximum current selected WebRTC candidate-pair RTT among the cabinet's
  connections, or application ping RTT when RTC statistics are unavailable.
  This is not a one-way latency measurement or the total logical ring delay.
- SEND: currently queued RTCDataChannel bytes across this cabinet's connections;
  RECEIVE: bytes pending in the browser-to-arcade queue. Neither includes every
  operating-system/network buffer.
- WASM: allocated linear-memory capacity; it cannot be interpreted as live
  allocations and usually does not shrink. Callbacks counts runtime callback
  slots; executed slots are now reused rather than retained indefinitely.
- Dropped: simulation time intentionally discarded by the existing catch-up cap.
  The JSON also records audio scheduling resets, visibility, draw distance,
  cumulative arcade payload bytes and whether a TURN candidate was selected.

## Runtime changes and validation

The Link play design section keeps the original ordered ring/shared RAM protocol
and optional frame synchronization off by default. No prediction, interpolation,
packet dropping or transport compression is added. CPU work is reduced by skipping
unused deadline clock reads when framesync is disabled. With framesync enabled,
timeout behavior is preserved. The existing callback-slot reuse implementation is
also enabled for the web build. The web define is PUBLIC so every translation unit
uses the same Lockstep layout. No generated ROM-derived source is edited.

scripts/apply_runtime_optimizations.py installs the runtime changes idempotently
and is invoked by apply_web_port.py. Tests include deterministic old/new ROM replay
of individual and linked cabinets, comparing video layers, geometry, audio,
EEPROM and ordered original link packets. This tests regression against the previous
web release; it is not a fresh MAME or physical PCB parity certification.

To run locally: node scripts/serve.js dist 8083, then http://localhost:8083.
For an extracted Pages ZIP, serve its root with node serve.js . 8083.
The GitHub Pages ZIP includes compiled assets, source and licenses, never the ROM.

## Recorded regression results

34 JavaScript tests passed. Deterministic replay compared six individual attract
checkpoints and 37 linked checkpoints through race inputs, with ordered packet
fingerprints covering every packet. All video-layer, geometry, audio and EEPROM
fingerprints matched the previous web release; both cabinet links remained Up.
Each linked cabinet advanced 4550 frames. Callback slots peaked at 2.
Mean synchronous step time in the Classic replay was 6.60 ms previously and
3.67 ms optimized (about 44% less). These are measurements on
this machine, not a promised improvement on every device or an Internet test.

The real-ROM Chrome test also passed with PeerJS Cloud/WebRTC, MASTER/SLAVE
enumeration, shared settings, menus without pause, local diagnostic JSON download,
disconnect recovery and returning to single player. The overlay and downloaded
report contained live simulation, CPU and RTT measurements with bounded callback
slots. Room layout passed at 1920×1080, 1366×768, 1280×720 and 1024×640 with eight
drivers and pending requests, without desktop scroll; mobile width also passed.
Internet performance between separate physical machines remains for user testing.

## Inactive cabinets — 13 October 2026

Hiding any playing/preparing cabinet stops the session and returns everyone to the
existing room. Room identity, invitation, roster and race settings are retained;
Ready flags are cleared and a new start cold-boots each cabinet. Returning to the
tab never resumes the interrupted session. Already scheduled audio sources stop
with the session. Opening ESC/settings or losing focus while still visible does
not trigger this policy. A hidden cabinet cannot start or complete preparation.

Arcade packet envelopes and pings/pongs report a session-scoped counter of successful emulation steps. Every
cabinet monitors its own progress; the host also monitors each slave and every
slave monitors the host. Ordinary keepalive traffic cannot refresh an unchanged
progress counter. The host stamps forwarded packets with its own progress, so
slave traffic cannot impersonate a progressing master. A five-second progress timeout aborts locally and informs the
host; the one-second heartbeat also checks this watchdog. A frozen tab cannot
execute a notification, so instantaneous propagation is not guaranteed in that
case. Slaves stop independently, wait for the host's acknowledgment, then enable
Ready again. When the host resumes it aborts before taking another emulation step.
Old-session stop/arcade packets cannot resurrect or interrupt a new race.

Lobby/recovery connections are not closed merely because background timers were
throttled; actual transport closure is still handled. If the browser discards a
tab, the network fails or a player closes the page, preserving that connection is
not guaranteed. The emulated arcade protocol and compiled motor are unchanged.

Validation for this update: 39 JavaScript tests passed, including host/slave
interruption, preserved readiness/settings, stale session messages, stalled
progress despite keepalives, master progress on relayed packets and resetting
counters before preparing a new race. Real-ROM PeerJS/WebRTC tests passed for
visibility handling on both roles, repeated cold restarts, ESC/blur without
interruption and a host prevented from stepping/processing messages. The latter
confirmed that the slave stops, waits for acknowledgment and preserves the room.

Headless Chrome kept tabs artificially visible and native CDP freezing did not
exercise the expected timeout, so those initial harness attempts were discarded.
The passing browser test explicitly injects DOM visibility signals and simulates
unresponsive host scheduling/message handling over real WebRTC. Physical browser
tab switching remains for manual verification. The tests also exposed stale
previous-race counters during preparation; counters now reset at preparation and
only active sessions advertise progress. No compiled runtime change was needed.
