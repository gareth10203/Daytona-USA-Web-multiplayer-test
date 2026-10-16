# Daytona USA — DELUXE y avisos de lobby, revisión 19

Build `daytona-rev-a-central-experimental-19-deluxe-lobby`. Copia independiente de la revisión 18 con su corrección de arranque; la versión anterior y sus ZIP se conservan.

Las cabinas usan DELUXE por defecto tanto en single player como en multiplayer. DELUXE es el tipo de cabina; el enlace sigue siendo SINGLE para jugar solo y MASTER/SLAVE en multiplayer. Los guardados anteriores se actualizan una sola vez mediante el menú original del arcade, conservando puntuaciones y demás ajustes. Después de esa actualización se respetan los cambios manuales del menú F2.

El lobby añade un aviso suave para mensajes nuevos de otros jugadores y un recordatorio para la única persona que todavía no está Ready: empieza tras 5 segundos y se repite cada 12 segundos mientras siga siendo la única pendiente. Ambos sonidos respetan el volumen y el silencio del juego. No se reproducen avisos por el historial del chat ni por tus propios mensajes.

La numeración de cabinas sigue siendo automática. Esta revisión no incluye selección de asiento o vehículo. El motor, el enlace central y la predicción temporal son los de la revisión 18; estos cambios no modifican las reglas de carrera ni la clasificación.

Para probar: `npm run serve`, abrir http://localhost:8101 y cargar la ROM local. El ZIP `daytona_multiplayer_19_deluxe_lobby_github_pages.zip` contiene los archivos para publicar en la raíz de GitHub Pages, sin ROM ni instrumentos de prueba. Todos los participantes deben usar esta misma revisión.

`npm test` ejecuta las regresiones de JavaScript. `tests/deluxe-lobby-browser.cjs` comprueba tres motores reales, chat, Ready, arranque DELUXE y retorno al lobby. `tests/deluxe-migration.cjs` verifica la actualización de guardados conservando los datos. Resultados locales en `build/`. Detalles en [docs/DELUXE_LOBBY.md](docs/DELUXE_LOBBY.md); los documentos de las revisiones anteriores son históricos.
