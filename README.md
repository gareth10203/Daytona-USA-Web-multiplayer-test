# Daytona USA Web — CPU cars — revision 21

Independent version based on revision 20. The previous version and its ZIPs are preserved.

Run `npm run serve` and open http://localhost:8103. Upload the contents of the distribution ZIP to GitHub Pages. No ROM is included. Everyone in a room must use this version.

The host can choose **CPU cars: On · Arcade grid / Off · Players only** in Race settings. On is the default. Changes reset Ready, propagate to every cabinet and are locked for the running session. The preference applies again for every new race, including inserting coins immediately after a race without returning to the lobby. Single player keeps the original controls.

See [docs/CPU_CARS.md](docs/CPU_CARS.md) for implementation and validation.
