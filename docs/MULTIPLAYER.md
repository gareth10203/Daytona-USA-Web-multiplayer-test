# Private linked-cabinet experiment

This is a separate version. The original web, bridge, runtime and dist folders
outside multiplayer-optimized are not edited. Rebuilding uses the existing SDK
and generated Revision A sources read-only; all new runtime objects and output
are inside this version.

Import a validated Revision A ROM, then choose SINGLE PLAYER or MULTIPLAYER.
Create a private room, copy its invitation, and approve your friends' requests.
Every player loads their own ROM locally. The host sets Normal / Grand Prix /
Endurance and Easy / Normal / Hard / Hardest. Region is consistently Export.
Changing settings clears readiness. With 2–8 accepted, ready players, the host
starts the linked arcade; coins, course/car selection and racing remain the
original game's interactions.

The browser uses pinned PeerJS 1.5.5 and its public signaling service. There is
no dedicated game server. Seven guests connect to the host at most. The host
relays each original board message to the next logical cabinet, preserving the
original ring topology and reliable ordered byte stream. Its own cabinet is
MASTER; every guest is SLAVE with a different cabinet number. The runtime's
existing MAME-derived CommBoard handles enumeration and race-data exchange.
Frame-sync is OFF, as in the existing native frontend. No rollback, invented
positions, prediction or interpolation are added.

Cabinet settings are applied by driving the original arcade test menu from the
verified Single/Export preset. The game computes its own settings checksum.
The resulting EEPROM is loaded into a fresh boot before enabling link play.
Multiplayer never writes to the individual NVRAM storage key. Returning to
single player reloads the engine and restores that player's saved NVRAM.

The external menu and ESC do not pause a running linked cabinet. Inputs are
neutral while the menu is open; original test/service switches are disabled
during linked play to keep the shared configuration stable. Hidden tabs may
still be throttled by the browser. Keep every playing tab visible. Audio and
controller settings remain individual. The original communication board can
declare a lost link; leaving a cabinet ends the session and returns the
remaining players to the room. Joining mid-session and host migration are not
implemented. Restarting applies a new set of cabinet IDs and a new session ID.

STUN servers are configured by default. TURN is not bundled or guaranteed by
PeerJS Cloud. Restrictive networks may fail to connect. A deployer can provide
an ICE server list in `globalThis.DAYTONA_ICE_SERVERS` before the application
loads. TURN credentials should be issued with limited lifetimes; don't publish
permanent service secrets in the static site. The room invitation contains a
random 128-bit key in the URL fragment, plus host approval. No public room list
or account signup is required.

## Validation

`node --test tests/*.test.js` runs local logic tests, including capacity,
approval, settings/readiness, three-cabinet packet routing and disconnection.
`tests/multiplayer-browser.cjs` loads a local ROM in two independent Chrome
contexts and uses actual PeerJS/WebRTC. Set TEST_ROM, TEST_URL and
PLAYWRIGHT_PATH as documented in TESTING.md. It checks original link status,
shared settings, ESC/settings without pause, disconnection and single-player
recovery. Images and ROM-derived settings evidence stay in ignored build/.

The native queue test checks partial input, packet order and overflow. The
original upstream comm-board test is also available in the copied runtime.
Passing on one computer does not certify WAN latency tolerance or eight
simultaneous physical devices. Those require separate live tests.

Recorded validation: 32 JavaScript tests passed; the actual compiled engine
linked two independent Chrome contexts through PeerJS Cloud and WebRTC.
The original arcade reported cabinet IDs 1 and 2, count 2, and both entered
a Grand Prix race. The actual EEPROM values matched Grand Prix / Hardest;
only checksum, link role and cabinet number differed between participants.
ESC and the settings modal continued advancing frames. Disconnect returned
the host to the lobby, and single-player restored saved NVRAM and pause.
The original CommBoard also enumerated and exchanged data for 2, 4 and 8
simulated cabinets, without ROMs. Queue ordering/overflow tests passed.

This frontend extends the existing design document's “Link play” section:
the runtime protocol and optional frame-sync default are retained, while the
separate browser frontend adds experimental internet traversal via PeerJS.

The multiplayer UI uses a compact cabinet header and two desktop columns:
the starting grid and admission requests on the left, shared race settings
and invitation actions on the right. Readiness and Start remain in a common
footer. The existing Settings and vibration controls stay accessible in the
header; the long single-player controls guide is hidden in multiplayer views.
The room is verified without vertical scrolling at 1024x640, 1280x720,
1366x768 and 1920x1080, including eight drivers or seven pending requests.
Mobile uses a stacked layout. `tests/room-layout.cjs` checks those layouts
with roster fixtures, real application modules and a local ROM boot.

Performance changes in this copy are documented in [PERFORMANCE_TEST.md](PERFORMANCE_TEST.md).
