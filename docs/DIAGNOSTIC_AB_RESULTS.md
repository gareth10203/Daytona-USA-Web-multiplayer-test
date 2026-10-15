# Resultado local A/B — experimento 12

Dos cabinas reales de Chrome en el mismo PC, Classic, audio activo y attract mode. Cuatro arranques nuevos; calentamiento hasta 1400 frames y 45 segundos medidos por tramo. Dos repeticiones por modo, orden A–B–B–A. Se evitó throttling de fondo con los mismos flags en todos los tramos.

El observador es idéntico en A/B, se inyecta sólo en el test y no se distribuye en el juego. Los tiempos de CPU son del callback JavaScript completo, no tiempo de GPU ni de presentación física.

| Tramo | Modo | Cabina | SIM Hz | CPU callback media (ms) | Mayor intervalo callback (ms) | Intervalos >100 ms | Muestras detalladas | Consultas WebRTC | Envíos rendimiento |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | A | host | 57.51 | 4.68 | 44.4 | 0 | 44 | 22 | 0 |
| 1 | A | client | 57.51 | 4.59 | 38.8 | 0 | 44 | 22 | 45 |
| 2 | B | host | 57.51 | 4.38 | 29.8 | 0 | 0 | 0 | 0 |
| 2 | B | client | 57.51 | 4.38 | 29.8 | 0 | 0 | 0 | 0 |
| 3 | B | host | 57.52 | 4.45 | 27.4 | 0 | 0 | 0 | 0 |
| 3 | B | client | 57.52 | 4.43 | 30.8 | 0 | 0 | 0 | 0 |
| 4 | A | host | 57.52 | 4.68 | 31.6 | 0 | 44 | 22 | 0 |
| 4 | A | client | 57.52 | 4.63 | 32.5 | 0 | 44 | 22 | 45 |

## Interpretación

Ambos modos conservaron la cadencia nativa y el enlace. No se reprodujeron las pausas de 100–330 ms comunicadas en el portátil. B produjo cero muestras detalladas, cero consultas getStats y cero lotes de rendimiento en ambos dispositivos. Se conserva el estado ligero de conexión.

La media de CPU del callback fue menor en B en esta ejecución, pero no se ha aislado el coste exacto ni demostrado que la captura cause los tirones. Cambios de frecuencia y trabajo del navegador también pueden influir. No se debe convertir esta diferencia en una promesa de mejora para otros equipos.

Este resultado no descarta una interacción específica del diagnóstico con el Ultra 7 155U, su navegador/controlador o la red WAN. La comparación decisiva debe repetirse allí manteniendo iguales escena, gráficos y rol.

## Verificación adicional

92 pruebas automatizadas aprobadas. Regresión con tres cabinas reales en A aprobada: muestras, descargas y recuperación de reportes. Motor JS/WASM y renderer idénticos a la versión 11; la versión 11 y su ZIP permanecen intactos. Los JSON de validación y los observadores de test se conservan en build/ y tests/, fuera del ZIP público.
