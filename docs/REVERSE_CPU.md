# Expert inverso con coches CPU — revisión 28

Documento histórico. La revisión 29 habilita CPU en Advanced y Expert inversos: véase [REVERSE_ADVANCED_CPU.md](REVERSE_ADVANCED_CPU.md).

## Uso

El host selecciona **Direction → Expert reverse** y **CPU cars → On · Arcade grid**. Off conserva la carrera entre jugadores. El ajuste se distribuye a las cabinas y reinicia Ready. Todos deben usar la revisión 28.

La revisión 27 se conserva en `multiplayer-reverse-countdown`, incluido su ZIP. Esta copia incorpora su corrección de la cuenta atrás de Beginner.

## Implementación

No se añade el conductor automático de los tests al producto. Se adapta el controlador CPU original del arcade:

- Al preparar Expert inverso se construye en cada motor una vista privada de cada línea de conducción, a partir de la ROM que aporta el usuario. Se recorre en sentido contrario; conserva posiciones, carriles y perfiles de velocidad reales. Se transforman orientación, inclinación y corrección de giro. Incluye las ocho entradas auxiliares de anticipación que consume el código original.
- La parrilla CPU se coloca detrás de las cabinas humanas, sobre las líneas originales de cada bot. La selección habitual, las físicas, golpes, audio, renderizado y controlador de los bots siguen siendo los del arcade.
- Los cambios de carril buscan la carretera en el sentido inverso. La recuperación tras un golpe convierte el cursor de carretera a la nueva línea. El progreso bruto de vueltas de los NPC disminuye al cruzar meta en reversa; la cuenta positiva de vueltas se conserva para sus consumidores originales.
- El enlace sigue usando sus mensajes y la corrección de progreso original de NPC. No se incorpora un nuevo servidor de físicas ni se cambian los campos de movimiento de los jugadores. El cursor de línea de los NPC se interpreta en el sentido inverso en todas las cabinas; por eso no deben mezclarse versiones.
- La política se limita a Expert inverso enlazado. Beginner y Advanced inversos continúan sin CPU. Single player y las carreras normales conservan su flujo original. El HUD mantiene la clasificación multijugador del arcade entre jugadores humanos.

Las vistas se calculan al comenzar cada carrera, se reconstruyen al repetirla y se eliminan al cargar otra sesión. No se distribuyen tablas de ROM ni exportaciones de lectura de memoria de los tests.

## Comprobaciones

- 139 pruebas unitarias: opción CPU compartida, cambio de Ready, encendido y apagado en Expert, bloqueo en los otros circuitos inversos.
- Dos motores originales con el distribuidor de producción y entrega local: parrilla de 16 coches, dos humanos y 14 CPU; los 14 bots completan una vuelta inversa; un jugador completa las dos vueltas y gana con tiempo restante. El conductor de prueba del segundo jugador no termina una vuelta validada antes del final de esa carrera; no se presenta como prueba de llegada de ambos jugadores.
- Moneda/Start inmediatamente después de terminar: se rearma una segunda parrilla inversa sin recargar ni volver al lobby.
- Dos motores de producción con WebGPU y PeerJS sobre TURN/UDP local: opción compartida, CPU On/Off, carrera con coches CPU visibles en el cliente, regreso a la sala sin errores JavaScript. Modal de escritorio 1366×768 sin scroll y móvil a 390 px sin desbordamiento horizontal.
- Ocho motores originales con entrega local: ocho cabinas humanas y ocho CPU forman la parrilla de 16; con entradas ordinarias de conducción, los ocho bots cruzan meta en reversa y siguen recorriendo el circuito. Se valida la salida y 1.800 pasos posteriores, no una carrera completa de ocho jugadores por internet. La prueba previa con los ocho humanos inmóviles bloqueó algunos bots detrás de esa barrera; se conserva el informe de ese caso.
- Con CPU Off: dos motores arrancan Expert inverso con sólo dos coches; se conserva el arranque sin bots.
- Paridad de single player: hash de todo el MB de memoria de trabajo frente a la revisión 21, desde arranque y selección hasta 1.440 pasos de carrera Expert con los 30 coches originales. Cargar la sesión elimina la política inversa previa.

Los informes locales están en `build/reverse-cpu-engine.json`, `build/reverse-cpu-browser.json`, `build/reverse-cpu-eight.json`, `build/reverse-normal-parity.json` y `build/unit-tests.log`. Cada prueba nativa registra la huella del motor usado. La compilación de observación sólo añade lecturas/trazas; el ZIP utiliza el motor de producción.

## Alcance experimental

Esto es una primera implementación para probar Expert con bots. La carrera completa se prueba con entrega local, no con dos dispositivos por internet. El enlace original aproxima el movimiento de los NPC mediante progreso y velocidades; no garantiza una posición idéntica de cada bot en todas las pantallas. Las colisiones y la variación de red pueden mostrar diferencias. No se declara validada toda la combinación de modos, dificultades y condiciones de red. No se habilitan aún bots en los otros circuitos inversos.
