# Daytona USA Web — revisión 34 experimental

Corrige una vuelta perdida de Expert inverso: un salto de sectores podía omitir las referencias intermedias que exige el arcade para validar la meta, incluso con todos los checkpoints marcados. La protección ya utilizada en Advanced se extiende a Expert.

Se conserva la validación original de checkpoints, vueltas y sentido de marcha, además de la protección gráfica y funciones de la revisión 33. Beginner mantiene su lógica.

Ejecutar `node scripts/serve.js dist 8116` y abrir http://localhost:8116. Todos los jugadores deben usar esta revisión. El ZIP es un sitio estático para GitHub Pages, sin ROM. La versión 33 y su ZIP quedan conservados por separado.

[Detalles y pruebas](docs/EXPERT_CHECKPOINTS.md).
