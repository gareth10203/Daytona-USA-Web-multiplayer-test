# Predicción temporal — experimento 18

Build `daytona-rev-a-central-experimental-18-temporal-prediction`. Base: revisión 17 con Discord corregido, conservada en otra carpeta. Esta revisión reduce el desfase espacial medido; no elimina la incertidumbre de Internet ni hace idénticas las colisiones. Se entrega como experimento, manteniendo la 17 disponible.

## Qué cambia

Cada muestra conserva el instante real de publicación. Los intercambios existentes de ping/pong aportan cuatro marcas de tiempo monotónicas para estimar la diferencia entre relojes, descontar el procesamiento remoto y conservar una incertidumbre explícita. Se utiliza la observación reciente con menor incertidumbre, con envejecimiento. Esto no prueba el retraso exacto de un trayecto asimétrico.

El host añade el tiempo real que ha retenido cada muestra; el receptor añade el tránsito host→cliente. Así se incluye el recorrido cliente→host→otro cliente. El reloj completo de cada bloque vincula la estimación temporal a su muestra. Valores no válidos, relojes sin calibrar o incertidumbre superior a 150 ms en el código nativo usan la alternativa conservadora. No se sustituye el tiempo desconocido por la mitad del RTT mostrado en pantalla. Con mucha latencia puede volver a aumentar el desfase visual sin que esto cierre por sí solo la sesión.

La reserva adaptativa pasa de 4–16 a 1–6 pasos del origen, respondiendo al exceso de variación en las llegadas. Cuando hace falta, la posición horizontal continúa como máximo seis pasos más allá de la última muestra (unos 104 ms a la cadencia arcade). Usa velocidad y dirección recibidas del propio juego; no mantiene esa continuación indefinidamente ni predice una curva futura. La altura permanece vinculada a las muestras y a la proyección original del terreno.

La preparación de la pose descuenta los dos pasos de velocidad horizontal que ya aplica la rutina TGP original. Las correcciones mantienen un error residual que decae durante 8–32 pasos; esto incluye el caso de recibir una nueva estimación de edad para el mismo reloj de origen tras una pausa del receptor. Una posición detenida en el límite de predicción no reinicia esa continuación.

Las muestras siguen completas. Sólo se ajustan los campos de movimiento ya verificados; NPC, banderas, clasificación, vueltas y resultado siguen procediendo de los bytes originales. El formato de red conserva el bloque compacto original más metadatos; los 64 bytes adicionales de edad/incertidumbre se añaden de forma privada al entrar al WASM.

No se reescriben las rutinas físicas: sus contactos usan las poses remotas disponibles, por lo que la predicción puede influir en el contacto percibido. Se conservan el enlace central, el audio, las reglas del resultado, el límite de ocho entregas en vuelo y un estado pendiente, la supervisión de confirmaciones de la 17 y la política de visibilidad. Los recursos tienen una referencia de versión para evitar combinar JS y WASM de revisiones diferentes al actualizar Pages. Todas las cabinas requieren la 18.

## Comparación A/B con dos motores reales

Chrome local, motores WASM auténticos, ROM local, WebGPU Classic, entradas normales de un conductor de laboratorio que lee la carretera original. Normal/Easy/Beginner con sus ocho vueltas originales. RTC fiable y ordenado por TURN/UDP autenticado; el deterioro afecta datagramas por debajo de SCTP. Se comprueba el uso de relay/UDP. No se alteran posiciones, vueltas, clasificación ni reglas para hacer pasar la prueba.

Se compara contra la 17 con el mismo perfil de 60 ms RTT base y 0 % pérdida. Las trayectorias cambian al recibir posiciones distintas: no son repeticiones físicas idénticas. Los instrumentos leen el motor y generan datos voluminosos, por lo que pueden introducir pausas del propio laboratorio. No es una medición de scanout, WAN, Safari/iPhone ni suavidad subjetiva. Las ventanas de unos 50 segundos no completaron la carrera: `NO_FINISH` indica fin del intervalo de observación, sin interrupción de la sesión.

| Medida | Cabina | 17 | 18 final |
|---|---:|---:|---:|
| Desfase estimado respecto a trayectoria del origen, mediana (ms) | 1 | 120.4 | 55.1 |
| Mismo desfase, p95 (ms) | 1 | 438.0 | 295.5 |
| Pasos con retroceso respecto al rumbo, muestra filtrada | 1 | 0 | 0 |
| Desplazamiento por paso / velocidad, p95 | 1 | 1.25 | 1.42 |
| Desfase estimado respecto a trayectoria del origen, mediana (ms) | 2 | 101.5 | 40.0 |
| Mismo desfase, p95 (ms) | 2 | 483.9 | 241.8 |
| Pasos con retroceso respecto al rumbo, muestra filtrada | 2 | 7 | 0 |
| Desplazamiento por paso / velocidad, p95 | 2 | 1.18 | 1.18 |

El retraso se estima buscando la muestra más cercana de la trayectoria del origen; frenadas, curvas y errores de posición limitan su precisión. El desplazamiento/velocidad es descriptivo, no un límite físico: colisiones y correcciones también pueden mover un coche. El p95 de ese cociente aumenta algo en el host mientras se reduce el retraso; no se afirma que todos los aspectos de suavidad mejoren.

También se compara la posición remota final con el coche propio del origen observado en el mismo instante, emparejando relojes de pared de este PC con diferencia máxima de 12 ms:

| Mediana del error horizontal, unidades nativas | Cabina 1 | Cabina 2 |
|---|---:|---:|
| ab17-clean60 | 10.1 | 8.6 |
| ab18-release-clean60 | 5.9 | 3.8 |

Hay adelantamientos, cambios reales de clasificación y muestras de coches cercanos. Siguen apareciendo casos donde las dos vistas no coinciden en quién está delante; la frecuencia entre pruebas no es un porcentaje comparable de colisiones porque difiere la exposición. No se certifica una resolución idéntica de contactos ni de llegadas ajustadas. No se modifica el HUD para disimular la diferencia.

## Variaciones y cortes

Secuencia final: 60 ms limpios, jitter ±25 ms por datagrama, 3 % pérdida con jitter ±20 ms, corte de 1 segundo, recuperación, corte de 3 segundos y recuperación. Cada fase comienza con temporizador independiente de las lecturas de diagnóstico. Se conserva la fase de corte en los resultados, sin descartarla de los percentiles.

| Fase | Error mediano 17, cabinas 1 / 2 | Error mediano 18, cabinas 1 / 2 |
|---|---:|---:|
| clean-60ms | 9.2 / 9.5 | 5.3 / 3.8 |
| jitter | 12.1 / 10.5 | 6.5 / 4.5 |
| loss-3pct | 19.9 / 16.8 | 7.9 / 4.9 |
| cut-1s | 39.4 / 41.3 | 34.4 / 31.2 |
| after-cut-1s | 15.3 / 14.3 | 5.1 / 3.1 |
| cut-3s | 119.6 / 116.8 | 102.3 / 98.6 |
| after-cut-3s | 18.0 / 16.3 | 5.8 / 4.0 |

Los valores son unidades nativas y no metros certificados. Ambas cabinas permanecieron en partida sin errores de página y sin modificar el producto durante cada prueba. La pérdida se aplica a datagramas UDP; WebRTC fiable puede retransmitir y retener entregas. Al faltar datos durante segundos, el coche remoto termina detenido o retrasado y la recuperación puede ser visible. No se afirma que esas recuperaciones sean imperceptibles o siempre mejores que la 17. La protección y el retorno al lobby ante una interrupción prolongada permanecen.

## Regresiones

- 118 pruebas de JavaScript: relojes no solicitados, obsoletos e inválidos, asimetría, dos trayectos, orden de slots y repetición de bloques para todas las cabinas en rejillas de 2–8.
- Nativo: interpolación/predicción con reloj envuelto, origen lento, ráfagas, pérdida sembrada, parada auténtica, continuación limitada, reinicio de identidad, correcciones de edad sin salto y bytes ajenos al movimiento intactos. Integración CommBoard para todos los IDs de 2–8 jugadores y camino original conservado.
- Single player: 20 puntos de comparación con la 17; geometría, audio generado, guardados y vibración coinciden. Lectura directa de WebGPU con tolerancia máxima de 1/255 por canal en Classic, Enhanced, ultraancho y retrato, carrera, timeout, test arcade y recarga.
- 3 motores publicables reales por RTC/UDP: enlace, inicio, tránsito entre clientes, latencias mixtas y jitter/pérdida; colas limitadas y todas las cabinas en partida. La prueba de dos cabinas utiliza el mismo código nativo con instrumentos de sólo lectura; esos exports no se incluyen en el WASM publicable.
- Los 204 archivos y ZIP inventariados de la revisión 17 conservan sus hashes.

## Probar personalmente

Abrir http://localhost:8100 o publicar el contenido del ZIP de la 18 en Pages. Todas las cabinas deben usar la misma URL/revisión. Comparar con la 17 por separado, especialmente conducción paralela, frenadas, adelantamientos y roces con 60–100 ms. Descargar Connections de ambos equipos si hay una discrepancia. Una mejora del error medido no sustituye comprobar la sensación de conducción en equipos y redes diferentes.

Las trazas completas quedan en `build/finish-audit/` y la síntesis en `temporal-ab.json`. Los instrumentos, ROM, objetos de compilación y trazas no se distribuyen en el ZIP. Esta revisión no sustituye automáticamente a la 17 como candidata.
