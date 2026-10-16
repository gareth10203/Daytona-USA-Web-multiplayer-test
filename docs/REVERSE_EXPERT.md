# Expert inverso — revisión experimental 22

Versión independiente de `multiplayer-cpu-cars` (revisión 21). La revisión anterior y su ZIP se verifican por SHA-256 antes de empaquetar esta versión.

## Activación

En el lobby, el host elige **Race settings → Direction → Reverse · Expert**. Los invitados reciben el mismo ajuste, Ready se reinicia y CPU cars queda desactivado. La carrera conserva las confirmaciones de circuito y transmisión del arcade, pero la selección se fija en Expert. No hay que girar manualmente el coche al salir. Normal es el valor inicial; single player no incorpora este experimento.

Todos deben usar la revisión 22. No se incluye ROM. Para GitHub Pages se sube el contenido del ZIP.

## Cambios nativos

- La selección original de circuito se fija en la tercera tarjeta visible (Expert, identificador interno 1), mediante su registro y la selección original que publica la votación. No se sustituye la pantalla de selección ni el protocolo de arranque.
- Cada cabina coloca únicamente su propio coche una vez al entrar en la carrera jugable. Usa puntos y tangentes de la carretera real del circuito, filas escalonadas según el identificador de cabina y velocidad inicial cero. El estado viaja por el enlace existente.
- Los índices iniciales de carretera, posición y orientación se mantienen coherentes. El primer cruce corto de meta no cuenta una vuelta: se mantienen las máscaras originales de checkpoints y la validación original de una vuelta completa. No se fabrican tiempos ni pasos por checkpoints.
- Se invierte el signo del progreso únicamente en las lecturas del ordenador de clasificación original (PC 0x127C8, 0x127D4 y 0x1B038). El progreso bruto y el paquete transportado mantienen su formato original. Ganar sigue dependiendo de completar las vueltas que valida el arcade.
- Las lecturas de orientación de aviso de sentido contrario, alineación y recuperación consideran el sentido elegido. Las físicas y los datos geométricos de carretera permanecen originales. El aviso sigue correspondiendo al sentido incorrecto para esta modalidad.
- El bonus original que el arcade asocia a recorrer el circuito al revés conserva su tabla y su dificultad en el consumidor 0x13B48. No se añade un tiempo arbitrario: en Easy el bonus original vale cero; los otros valores de la tabla son 40, 50 y 60 ticks.
- La política se limita a Expert enlazado y a las fases de carrera 20–25; no actúa en attract. Se rearma al acabar y se elimina al cargar otra sesión o desactivar el enlace. El no-CPU original de la revisión 21 sigue aplicándose en cada selección.

Código principal: `native/reverse_expert.h`, los consumidores concretos de `native/m2_board.cpp` y la exportación `daytona_set_reverse_expert` de `native/daytona_web.cpp`. No se distribuye código de juego generado ni observadores de RAM.

## Verificación realizada

1. **137 pruebas unitarias**, cero fallos. Incluyen validación del ajuste, propagación a ocho miembros simulados, bloqueo de CPU cars y reinicio de Ready. Son pruebas del lobby; no equivalen a ocho motores ejecutándose.
2. **Dos motores reales, carrera Normal/Easy**, con entradas ordinarias de moneda, Start, acelerador y dirección de un conductor automático exclusivo del test. Observación de memoria de solo lectura. Ambos recorrieron una vuelta inversa completa; un coche completó las dos vueltas, y el arcade terminó la carrera con tiempo restante. El primer finalista recibió el primer puesto y el otro, el segundo. El conductor de prueba no es una IA que se distribuya al usuario.
3. **Repetición tras la llegada**: moneda/Start en la misma sesión inició otra carrera Expert inversa. Ambas parrillas se colocaron una sola vez, volvieron a cero vueltas y no mostraron sentido contrario estando orientadas correctamente. No hubo recarga ni regreso al lobby.
4. **Dos clientes de la aplicación con WebRTC real**, PeerJS y relay TURN/UDP local: el host activó la opción, el invitado la recibió, ambos motores de producción arrancaron Expert orientados al revés y se pudo volver al lobby y a Normal. Sin errores JavaScript registrados. Esta prueba valida el arranque y el recorrido de la opción por la aplicación; la carrera completa anterior utilizó el distribuidor de producción con entrega local inmediata, sin latencia artificial.
5. **Compatibilidad normal**: comparación de hashes de todo el MB de RAM de trabajo original frente al motor de revisión 21, a pasos fijos y con las mismas entradas. Coincidieron desde el arranque, selección ordinaria de Expert y parrilla original de 30 coches hasta 1.440 ticks de carrera. La recarga de single player limpia la política experimental.
6. **UI**: lobby de escritorio 1366×768 sin scroll del modal (y=49,25; borde inferior=718,75; overflow=0). Revisión móvil a 390 px sin desbordamiento horizontal.

Evidencia local en `build/reverse-expert-engine.json`, `build/reverse-expert-browser.json`, `build/reverse-normal-parity.json` y `build/unit-tests.txt`; capturas de salida, resultados y lobby en el mismo directorio. Los motores de observación residen solo en `build/reverse-audit` y no entran al ZIP.

## Límites del experimento

Solo Expert y jugadores humanos. No se han convertido las trayectorias ni estrategias de los coches CPU. No se habilita Beginner ni Advanced. Se probaron dos motores en ejecución; ocho coches inversos, redes de internet con pérdidas, todos los modos/dificultades y todos los casos de vuelco, salida de pista o rescate requieren más pruebas de juego. Tampoco se ha añadido una nueva tabla de récords separada del comportamiento original del arcade.

Este resultado permite una prueba personal del circuito inverso. No constituye una garantía de clasificación perfecta para cualquier condición de red ni de recuperación correcta en cada tramo.
