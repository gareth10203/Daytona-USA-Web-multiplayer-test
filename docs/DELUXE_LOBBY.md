# DELUXE y sonidos de lobby — revisión 19

El EEPROM inicial DELUXE procede del menú original del juego, incluido su checksum. Para un guardado existente TWIN o UPLIGHT, la primera carga usa ese mismo menú para cambiar únicamente el tipo de cabina y después restaura la memoria de puntuaciones. Se guarda una marca local para no repetir el cambio: las preferencias manuales posteriores se respetan. Al preparar multiplayer se parte siempre del perfil DELUXE y se aplican el modo, la dificultad y el enlace MASTER/SLAVE de la sala.

Los sonidos usan el AudioContext y la ganancia existentes del juego, con notas triangulares cortas y entradas/salidas suaves. Chat y Ready tienen menos intensidad que el aviso de admisión. Comparten un límite de frecuencia de 500 ms para evitar ráfagas. Crear o unirse a una sala, Ready e interactuar con el chat permiten activar el audio mediante un gesto del usuario; un contexto suspendido permanece silencioso.

El chat avisa sólo de mensajes entrantes posteriores a la admisión. Los mensajes propios, el historial inicial y el historial recibido al reconectar no producen avisos. El recordatorio Ready exige al menos dos personas, ninguna admisión pendiente, ninguna conexión en recuperación y que todos salvo el jugador local estén Ready. Espera 5 segundos y repite cada 12 segundos. Se cancela al confirmar Ready, cambiar la condición, empezar la partida o abandonar la sala; se omite cuando la página está oculta.

Tras terminar una carrera, se detiene el audio del arcade y se conserva el contexto de audio del lobby para los avisos. La pausa de single player conserva su comportamiento.

La selección de número de asiento o coche queda aplazada. Se conservan la cuadrícula de ocho asientos y el orden automático de llegada. Los archivos nativos y el WASM publicable coinciden con la revisión 18, al igual que la lógica de red salvo las referencias de versión de los módulos.

Validación: regresiones de JavaScript; tres cabinas reales con WebGPU y ROM local mediante el relay de pruebas; comprobación de mensajes recibidos y recordatorio Ready; arranque DELUXE y enlace de tres cabinas; retorno al lobby con audio disponible; migración de un guardado TWIN con dificultad personalizada y comparación de EEPROM y memoria de puntuaciones. Los resultados de navegador se guardan en `build/deluxe-lobby-browser.json` y `build/deluxe-migration.json`. Estas pruebas locales no certifican todas las combinaciones de navegador, dispositivo y red.
