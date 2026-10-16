# Daytona USA Web — Reverse Expert — revision 22

Independent experimental version based on revision 21. Revision 21 and its distribution ZIP are preserved.

Run `npm run serve` and open http://localhost:8104. Upload the contents of the distribution ZIP to GitHub Pages. No ROM is included. Everyone in a room must use this version.

The host can choose **Direction → Reverse · Expert** in Race settings. It selects Expert for every cabinet, disables CPU cars and places stopped cars facing the opposite direction. The original physics, checkpoints and lap validation run the race. Progress comparisons and road alignment use the chosen direction. The normal direction remains the default, and single player retains its original behavior.

Changing direction resets Ready. Reverse remains active for immediate coin/Start races without returning to the room. Returning to Normal unlocks the CPU cars selector again.

Validated with two running cabinets, a genuine reverse race finish and another race in the same session; actual local WebRTC startup; 137 unit tests; and normal single-player state parity against revision 21. This is an experimental Expert-only feature, not a validated reverse conversion for all tracks or CPU opponents. Eight-cabinet settings propagation is unit tested; eight running reverse cabinets and internet conditions have not been validated for this feature.

See [docs/REVERSE_EXPERT.md](docs/REVERSE_EXPERT.md) for implementation, evidence and limits. Existing CPU car behavior is documented in [docs/CPU_CARS.md](docs/CPU_CARS.md).
