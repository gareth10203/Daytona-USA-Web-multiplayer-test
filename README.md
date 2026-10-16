# Daytona USA Web — Advanced reverse — revision 25

Independent experimental version based on revision 24. That revision and its distribution ZIP are preserved.

Run `npm run serve` and open http://localhost:8107. Upload the contents of the distribution ZIP to GitHub Pages. No ROM is included. Everyone in a room must use this version.

The host chooses **Race settings → Direction → Advanced reverse** or **Expert reverse**. It forces the chosen course and CPU cars OFF, starts the cars stopped and applies the chosen direction to ranking, warnings, checkpoint/lap validation and recovery. Normal remains the default. Changing room settings resets Ready.

Revision 25 reuses the corrected original ranking, checkpoint and recovery consumers for Advanced. With CPU cars OFF its original start hands over stationary cars; this revision uses that path rather than adding a rolling-start script. Recovery movement and duration remain original. The angular correction follows the shortest turn across the signed heading boundary.

Verification includes Advanced's complete four-lap reverse race and immediate replay, wrong-way checkpoints/ranking, collision recovery, Expert regressions, production WebRTC startup, normal single-player RAM parity and 138 unit tests.

This remains experimental and without CPU opponents. The complete races use two running cabinets and local delivery. Eight running reverse cabinets, every track location, every race mode and internet conditions are not comprehensively validated.

See [docs/REVERSE_ADVANCED.md](docs/REVERSE_ADVANCED.md) for implementation and evidence. Previous discovery notes remain in `docs/REVERSE_EXPERT.md`, `docs/REVERSE_DIRECTION_FIX.md` and `docs/REVERSE_RECOVERY.md`.
