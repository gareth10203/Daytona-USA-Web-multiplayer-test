# CPU cars in linked play

Build: `daytona-rev-a-central-experimental-21-cpu-cars`.

## Behavior

The host selects CPU cars in the lobby. ON preserves the arcade grid; OFF asks the original game for a humans-only race. The default is ON. Changing the option clears Ready for everyone. It is part of the validated prepare configuration and cannot change during play. No extra input or confirmation is required from players.

The setting persists for the running arcade session. Every AUTO/MANUAL selection applies it again, including a new race started by inserting another coin without visiting the lobby. The original game chooses the actual participating cabinets; a cabinet remaining in attract is not counted as a racing human. With one actual participant, the original humans-only shortcut can select its original Time Attack behavior.

## Implementation

The Revision A original routine at `0x225C90` reads Start and writes the request at `0x501A80` from instruction `0x225CA4`. A narrow bridge hook overrides only that write, only while centralized multiplayer is configured. OFF produces the original request 1; ON produces 0, so a held Start button cannot contradict the room policy. No synthetic accelerator, steering, transmission choice or general Start press is injected.

The native game continues to exchange each cabinet's selection and decide the original majority vote. Its later preparation at `0x3B34` consumes the request, uses the participating human count, and clears the request. Those writes and every other writer are untouched. There is no timer, permanent RAM freeze or modification of race positions/collisions.

A reload or disabling cabinet linking releases the room policy. Single player follows original input behavior. Existing central transport, timing, interpolation, physics and graphics objects are reused.

## Validation

See `build/unit-tests.txt`, `build/cpu-cars-browser.json`, `build/cpu-cars-engine.json` and `build/cpu-cars-modes.json`. The native audit build adds only a read-only RAM observer and is not distributed. Engine tests use actual arcade code, normal coin/Start/accelerator inputs, and the production HostDistributor with immediate local delivery. No race states, car counts, timers or laps are written by the tests. Network variability is not part of this feature's validation; the lobby test uses real WebRTC over a local TURN/UDP relay.

Previous version 20 files are checked against `build/preserved-20.json` before packaging. Engine compilation reuses the prior runtime objects and optimization settings, rebuilding only the two changed bridge units. No generated game code, ROM, test API or lab interface is included in the ZIP.
