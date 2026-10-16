# Controles y sonido local — revisión 20

Esta revisión parte de la 19 y conserva su motor, enlace central, predicción temporal y perfil DELUXE. La numeración de cabinas sigue siendo automática. Los documentos de las revisiones anteriores describen sus respectivos estados históricos.

## Sonido

Se añade una confirmación musical cuando tú o alguien de la sala pasa de no preparado a Ready. Suena al recibir el estado confirmado, una vez por transición. No se avisa por la lista inicial, cambios a no preparado ni por restaurar el historial al reconectar. Las confirmaciones simultáneas de una misma actualización se agrupan en un aviso.

Sound contiene Game volume e Interface volume. El segundo se aplica sólo a este navegador y controla chat, solicitudes de ingreso, confirmaciones Ready y el recordatorio de la última persona pendiente. Ambos volúmenes tienen 100% como valor inicial. Usa una ganancia independiente: poner el juego a 0 no silencia la UI y poner la UI a 0 no silencia el juego. El botón global de silencio sigue silenciando ambos. Un botón permite escuchar el nivel de la UI. El recordatorio sigue siendo inmediato y cada 3 segundos.

## Teclado

La nueva categoría Keyboard contiene el indicador de dirección, sensibilidad y 16 asignaciones. Selecciona una acción y pulsa una tecla. Si ya estaba asignada, las dos acciones intercambian teclas. Esc cancela la captura sin salir de ajustes; Tab conserva la navegación y cancela la captura. Esc, F2/F3 y combinaciones del navegador quedan reservados. Las asignaciones usan códigos físicos y se guardan en `daytona-keyboard-bindings-v1`. La guía inferior muestra las teclas actuales.

La dirección deja de saltar directamente al máximo. Con sensibilidad 100%, mantener una flecha desde el centro alcanza el tope en aproximadamente 320 ms; al soltar, vuelve del tope al centro en unos 200 ms. La sensibilidad se ajusta entre 25% y 175%; cambia la velocidad de giro y retorno conservando el recorrido completo. El avance utiliza la duración de los pasos reales de simulación, por lo que la frecuencia de pantalla no cambia el manejo. El indicador usa el mismo cálculo, con estado independiente para no enviar pulsaciones de prueba a la partida. Abrir menús, perder el foco o cambiar de sesión limpia las teclas y la dirección residual.

## Controles táctiles

En móvil, Touch controls ocupa el lugar de Keyboard. Incluye vista previa y tamaño de botones entre 85% y 140%, junto con ancho de dirección entre 100% y 165%. La dirección empieza un 15% más ancha que antes. El ancho efectivo se limita al espacio disponible para no invadir los pedales. El indicador del pad adapta su recorrido a su ancho real. Los botones mantienen objetivos táctiles de al menos 44 px. Pedales, marchas y botones superiores se ajustan; se conserva la captura independiente de punteros para poder acelerar y girar a la vez.

Los ajustes de sensibilidad, tamaño, ancho y volumen se guardan en el perfil local existente. Cambiar de categoría conserva el tamaño del diálogo; el diseño táctil se adapta a orientación horizontal y vertical. Las opciones no cambian la configuración de otros jugadores.

## Validación

`npm test`: 135 pruebas de JavaScript. `tests/input-settings-browser.cjs`: dimensiones estables en desktop, captura y persistencia, indicador, dirección gradual en el motor real, ganancia independiente, ajustes móviles en ambas orientaciones y dos contactos táctiles simultáneos con dirección y gas. `tests/deluxe-lobby-browser.cjs`: tres cabinas reales, confirmaciones propias y remotas, recordatorio inmediato y a los 3 segundos, carrera y regreso al lobby. `tests/lobby-audio-render.cjs`: renderizado de los cuatro motivos con Web Audio real, señales finitas, sin saturación y sin voces persistentes. Los comprobantes y capturas se guardan en `build/`; no se publican con el juego.

El navegador móvil de pruebas es Chrome con dispositivo táctil emulado; esto no sustituye una comprobación manual en Safari/iPhone físico. Los archivos nativos y el WASM publicable son idénticos a los de la revisión 19.


## Actualización: protección de gestos móviles

La superficie del juego cancela los eventos táctiles del navegador en captura, con listeners no pasivos, además de los gestos WebKit, selección, arrastre y menú contextual. La cancelación se mantiene al abrir el menú y levantar el mismo dedo: ya no depende de que la simulación continúe ejecutándose. El control real sigue usando Pointer Events y captura independiente de cada dedo.

Los botones táctiles de menú, sonido y servicio se activan en pointerdown; se ignora el click de compatibilidad posterior para evitar una segunda activación. Mouse, teclado y tecnologías de asistencia conservan su ruta de click. La selección que afecte al juego se limpia, mientras que el texto de los menús sigue siendo seleccionable.

En móvil, el viewport limita la escala, la superficie del juego usa touch-action none y el launcher permite desplazamiento sin zoom. También se interceptan los gestos WebKit y los toques múltiples que iniciarían un pellizco en el launcher. Los campos de texto y selectores tienen al menos 16 px para evitar el zoom automático por foco en iOS.

`tests/touch-guard-browser.cjs` comprueba con contactos del navegador: dos dedos de conducción, ocho toques rápidos, una pulsación de un segundo, pellizco, activación única de sonido/servicio, apertura del menú y selección. Chrome móvil emulado mantiene visualViewport.scale en 1 y no deja selección ni pedales pulsados. No se ha certificado todavía en un iPhone/Safari físico. El ZIP actualizado es `daytona_multiplayer_20_touch_guard_github_pages.zip`; el ZIP anterior se conserva.


## Actualización: zona muerta y avisos en segundo plano

Control > Steering & feedback incorpora Stick dead zone entre 0% y 30%, en pasos de 1%. El valor inicial es 8%, idéntico al comportamiento anterior. La señal se vuelve a escalar tras descontar la zona muerta, conservando el giro completo en ambos extremos. Indicador y motor reciben el mismo ajuste. Se guarda localmente junto a la sensibilidad. La curva por defecto conserva los resultados anteriores.

Game volume e Interface volume parten de 100% en un perfil nuevo; los valores personalizados existentes se conservan. Los avisos Ready ya no se omiten por estar la página oculta. Si el AudioContext ya autorizado mediante Crear/Entrar/Ready quedó suspendido, se intenta reanudarlo antes de reproducir el aviso. Se respetan siempre el silencio y el volumen de UI. No se crea audio nuevo en segundo plano ni se fuerzan permisos de reproducción.

`tests/steering.test.js` comprueba equivalencia del ajuste inicial, simetría, rango completo, límites y persistencia. `tests/deadzone-background-browser.cjs` comprueba el indicador y el motor con mando virtual, valores de sonido iniciales, persistencia y avisos de dos miembros conectados con el estado de pestaña oculta/sin foco emulado explícitamente y su audio previamente suspendido. Las pruebas unitarias comprueban que la lógica del recordatorio no omite páginas ocultas. El entorno automatizado no reproduce fielmente el estado document.hidden de una pestaña normal; esa limitación no se presenta como una prueba de pestaña realmente oculta. Un navegador o sistema operativo que congele completamente una página o bloquee audio en segundo plano puede impedir que se ejecute el aviso, especialmente en móvil.

Paquete actualizado: `daytona_multiplayer_20_deadzone_background_github_pages.zip`. Los ZIP anteriores se conservan.
