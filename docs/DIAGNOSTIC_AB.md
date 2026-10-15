# Prueba A/B de captura — experimento 12

Build `daytona-rev-a-central-experimental-12`, copia independiente de la versión 11. Motor JS/WASM, simulación, renderizado, audio e interpolación idénticos a 11. El selector sólo modifica instrumentación opcional.

## Repetir con el equipo que presenta tirones

1. Publicar el contenido del ZIP 12; ambos jugadores deben cargar la versión 12. En local: http://localhost:8093.
2. Antes de arrancar las cabinas: **Settings → Experimental → Multiplayer diagnostics → Capture A/B test**.
3. Primero elegir **A · Full capture**. Usar los mismos gráficos, circuito, modo, equipo anfitrión y condiciones de alimentación. Mantener cerrado Connections y el overlay durante los tramos comparados.
4. Tras unos minutos, volver al lobby y elegir **B · Capture off**. Se guarda sólo en ese dispositivo; no cambia el modo de los demás.
5. Para aislar los tirones de Julian8A, mantener el PC estable en A y cambiar sólo el equipo de Julian8A. Para comprobar toda la sobrecarga de instrumentación, cambiar ambos a B. No mezclar ambas preguntas en una misma comparación.
6. Repetir **A–B–B–A**, idealmente 3–5 minutos por tramo, desde el mismo punto. Anotar si los tirones disminuyen en B y reaparecen al volver a A. No se puede cambiar de modo durante carrera ni preparación.

En B no habrá nuevas muestras detalladas de rendimiento que descargar de ese dispositivo. Connections sigue funcionando y muestra **B · Capture off** en los detalles. Los reportes antiguos de A se conservan con sus fechas y se señalan como capturas anteriores; no son mediciones de B. El JSON identifica el modo local y el comunicado por cada cabina.

## Qué se omite en B

- Lectura/reinicio de los 24 contadores nativos por paso y medición de la duración de cada paso para el historial.
- Acumulación de muestras, clasificación de duraciones y resúmenes detallados cada segundo.
- Preparación/envío de lotes de rendimiento y, si el host está en B, su recepción/validación/almacenamiento.
- Historial de intervalos de paquetes. Se conservan contadores simples de mensajes y bytes.
- Consultas WebRTC `getStats`, incluidas las de Connections. El RTT disponible en B procede del ping de sala.
- Overlay de rendimiento, incluso si un control antiguo intenta habilitarlo.

El WASM no se recompila: los incrementos de contadores incorporados al motor siguen existiendo en ambos modos, pero B no los lee ni reinicia. No es una comparación de esos incrementos nativos ni del coste mínimo de supervisión.

## Qué permanece igual

Estados arcade, empaquetado, ACK de estados, interpolación, velocidad nativa, recuperación de tiempo, renderer, resolución, audio y entradas. Se conservan ping/pong, progreso, estado ligero, detección de pestaña oculta, límites de cola y tiempos de espera. B no hace más tolerante la conexión ni oculta interrupciones reales.

## Prueba local reproducible

- `node --test tests/*.test.js`: A/B y regresiones de lobby, transporte y reportes.
- `tests/performance-browser.cjs`: tres motores reales con A; captura, descargas y recuperación de informes.
- `tests/diagnostic-ab-browser.cjs`: dos motores reales, Classic, audio activo, orden A–B–B–A. Por defecto 45 segundos por tramo, después de preparar de nuevo las cabinas y calentar hasta 1400 frames. `AB_SECONDS` permite 20–180 segundos.
- Un observador idéntico en A/B, inyectado sólo en el test, mide intervalos/duración del callback principal y avance de frames. No se distribuye. CPU del callback no es tiempo GPU ni presentación física. Los intervalos del callback no equivalen al `maxStepGapMs` de los informes 11.
- B debe producir cero muestras detalladas, lotes de rendimiento y consultas WebRTC mientras las cabinas siguen enlazadas.
- Se usan dos contextos en este PC, con flags iguales que evitan throttling por ventanas ocultas. No reproduce el portátil Ultra 7 155U ni una red WAN.

Un resultado local estable no excluye una interacción de la instrumentación con otro dispositivo. La prueba que puede relacionarla con los tirones debe repetirse en el equipo afectado.
