# Coordinación de Beginner inverso — revisión 27

Esta corrección se limita a Beginner inverso. La revisión 26 y su ZIP quedan conservados por hashes. No se atribuye el defecto al funcionamiento normal del arcade: se reprodujo con la adaptación inversa de la revisión 26.

## Problema observado

Un ensayo determinista con dos motores originales, retardo variable de 0–6 ticks por trayecto y pérdida del 3 % en cada dirección separó los avisos de ambas cabinas unos 30–34 ticks (aproximadamente medio segundo). Cada cabina utilizaba una combinación distinta de su coche local y el progreso recibido de los demás para resolver los umbrales. Además, la confirmación de salida de otro coche podía entregar el control antes de que su rutina local emitiera GO.

Los avisos numéricos y sus comandos de sonido se observan directamente en las rutinas originales de dibujo y sonido; no se infieren de la tasa de FPS ni del texto del HUD. El informe anterior está en `build/countdown-baseline-jitter.json`.

## Corrección

Todas las cabinas utilizan el coche delantero de la parrilla real, ID de carrera = participantes menos uno. Es independiente de qué cabina creó la sala y funciona también si el host sigue en attract. Su propietario utiliza su estado local; las demás leen su progreso auténtico del último paquete de la comboard, offset `0xA0`, y su callback original. No se escribe información adicional en los paquetes ni cambia el transporte.

La referencia recibida debe corresponder al circuito y fase correctos y haber mostrado el callback de salida lanzada en esa carrera antes de aceptar un callback jugable como salida. Se detecta el paso real por meta o la unión de sectores. La política se reinicia entre carreras.

Cada umbral cruzado ejecuta la rutina original de su número y sonido. Entre umbrales se conserva el número que corresponde al contador actual; una actualización de posición no puede volver a dibujar un número anterior. GO utiliza la misma referencia y la entrega de control requiere haber ejecutado el GO nativo de esa cabina. No se cambian el reloj de carrera, las vueltas ni la conducción automática. El argumento temporal de la cuenta se copia a su registro local y el registro global original se restaura inmediatamente; así no se propaga el progreso de presentación a otras rutinas del juego.

El breve parpadeo inicial del GO original se conserva. Los comandos de sonido y la salida de audio real son cosas distintas: el navegador y el dispositivo conservan su latencia de audio. Esta corrección no garantiza latencia audiovisual cero ni simultaneidad física perfecta entre equipos por internet.

## Verificación

Resultados de la compilación final (cada columna corresponde a 3, 2, 1 y GO):

| Perfil del relay | Diferencia entre cabinas, ticks | Diferencia aproximada |
| --- | --- | --- |
| Sin retardo añadido | 2 / 2 / 2 / 2 | 35 ms |
| Retardo fijo, dos ticks por trayecto | 4 / 4 / 4 / 4 | 70 ms |
| Retardo variable de 0–6 ticks por trayecto y pérdida del 3 % | 5 / 3 / 5 / 3 | 52–87 ms |

En ese último perfil, la versión anterior separaba los avisos 30–34 ticks (522–591 ms). El perfil fijo se llama `60ms` en el laboratorio; su cuantización a dos pasos por trayecto equivale aproximadamente a 70 ms de ida y vuelta. Se informa el retardo real cuantizado para evitar confundir el nombre del perfil con su medición.

Los tres ensayos verifican los cuatro sonidos exactamente una vez, los números en orden, los comandos de número y sonido dentro del mismo paso de simulación y la entrega de control posterior al GO. El primer dibujo de GO mantiene los tres ticks de introducción de su parpadeo original. Los informes completos y hashes están en `build/countdown-results.json` y `build/countdown-{clean,60ms,jitter}.json`.

Los ensayos de red comprueban 3/2/1/GO una sola vez y en orden, coincidencia de comandos nativos de números/sonidos, parpadeo original de GO y que el control nunca llegue antes de ese GO. Se ejecutan con red limpia, retardo fijo y retardo variable con pérdida. El desfase residual se mide en ticks, sin esconderlo ni pausar globalmente la simulación.

También se revisan la salida con ocho motores locales, la carrera completa de ocho vueltas y repetición inmediata, una cabina corriendo mientras el host sigue en attract, circulación incorrecta, paridad de RAM original en single player y el arranque del motor de producción en dos navegadores mediante TURN/UDP local. El paquete exige informes PASS y compara los hashes de los motores probados.

Los observadores de auditoría quedan fuera del ZIP; la compilación de producción conserva los flags de la revisión 26. Las comprobaciones de Expert y Advanced de esa revisión se conservan como evidencia histórica; la nueva política sólo se consulta para el circuito interno 0 en sentido inverso.

La validación gráfica detectó un desbordamiento de polígonos en una iteración intermedia que dejaba ese registro global alterado. Se conservó la prueba A/B con el motor 26 y se añadió la restauración antes de validar el paquete final.
