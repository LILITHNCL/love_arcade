# marejigweb — Fases 1, 2 y 3

Scaffold y motor geométrico inicial para el juego `marejigweb`, alojado en `games/jigsaw/` y registrado ante Love Arcade con `gameId` público `jigsaw`.

## Alcance implementado

### Fase 1 — scaffold de producción

- app shell premium mobile-first;
- pantalla principal de niveles pendientes;
- catálogo inicial de 5 niveles;
- adaptador Cloudinary sin secretos;
- carga lazy de thumbnails;
- carga de imagen full solo al seleccionar nivel;
- storage seguro bajo claves `MAREJIG_`;
- adaptador económico preparado para `window.GameCenter.completeLevel("jigsaw", levelId, coins)`;
- contenedor futuro del juego con `<canvas id="marejig-canvas">`.

### Fase 2 — motor geométrico

- biblioteca de formas poliminó ortogonales en `MAREJIG_shapes.js`;
- generador determinístico por `level.id` en `MAREJIG_generator.js`;
- board estándar `16×12` con cobertura exacta de 192 celdas;
- target estándar de 60 piezas, validado dentro del rango 56–64;
- grafo de adyacencia real por lados compartidos;
- `neighborIds`, `segmentId`, `groupId` y contornos serializables por pieza;
- segmentos progresivos con `s_0` revelado inicialmente;
- grupos iniciales de una pieza y helpers puros de merge/validación.

### Fase 3 — renderer y escena visual

- `MAREJIG_scene.js` crea una escena preparada para input futuro, con board 4:3, staging, grupos visibles y `hitBounds`;
- `MAREJIG_renderer.js` dibuja en Canvas 2D con DPR capado a `Math.min(devicePixelRatio, 2)`;
- el tablero muestra una silueta premium tenue de la imagen completa;
- solo las piezas del segmento inicial `s_0` aparecen reveladas en la bandeja visual;
- cada pieza visible dibuja el fragmento correcto de la imagen runtime dentro de su máscara poliminó;
- si Cloudinary falla, el renderer usa un patrón premium de fallback sin romper el flujo;
- el render funciona por dirty frames con `requestAnimationFrame`, no con loop continuo.

No incluye todavía drag, snap interactivo, fusión durante input ni gameplay final.

## Restricciones de integración

- No se sobrescriben `window.GameCenter`, `window.ECONOMY`, `window.THEMES`, `CONFIG`, `ECONOMY` ni `THEMES`.
- No se leen ni escriben claves globales de `localStorage` de Love Arcade.
- Todas las claves de storage propias usan prefijo `MAREJIG_`.
- Los selectores CSS propios usan prefijo `.marejig-*`.
- El juego funciona standalone si `window.GameCenter` no existe.
- `../../js/app.js` se carga al final del `<body>` después de los scripts propios.

## Cloudinary

`MAREJIG_config.js` usa `cloudName: "demo"` como placeholder público de desarrollo. Para producción, reemplazarlo por el Cloudinary cloud name real. No se deben colocar API keys, API secrets ni tokens privados en frontend.

Los public IDs de ejemplo siguen el patrón:

```text
marejig/levels/<level_id>
```

Si esas URLs no existen, el scaffold muestra un fallback visual y continúa funcionando sin errores fatales.

## Generador

La salida principal está disponible desde:

```js
window.MAREJIG_Generator.generate(level)
```

El generador no lee píxeles de la imagen. Solo usa metadata del nivel (`id`, board, dificultad, target y segment plan). La estrategia actual usa una partición serpentina determinística para garantizar cobertura completa, conteo estable y piezas conectadas; el modelo queda preparado para que el renderer construya `Path2D` desde los contornos serializables.


## Renderer

La escena visual se crea con:

```js
const scene = window.MAREJIG_Scene.createScene(level, puzzle, imageResult);
window.MAREJIG_Renderer.setScene(scene);
```

El renderer usa una única imagen decodificada por nivel activo y cachea únicamente paths/métricas. No crea canvases grandes por pieza ni persiste datos visuales en `localStorage`.

## Fase 4 — gameplay interactivo

- Se añadió `MAREJIG_Input` con Pointer Events para seleccionar, traer al frente y arrastrar grupos visibles sin iniciar un render loop continuo.
- `MAREJIG_Groups` ahora contiene hit testing, bounds inflados para móvil, búsqueda de snap basada exclusivamente en adjacency real y fusión de grupos de escena/puzzle.
- `MAREJIG_Segments` controla la progresión: `s_0` define el grupo principal al completarse, los segmentos posteriores se revelan de uno en uno y el último solo marca `puzzleCompletedLocal`.
- El HUD muestra estado/movimientos, segmento activo, conectadas del segmento, visibles y total de piezas. La persistencia ligera solo se actualiza en eventos discretos.
- Esta fase no reporta economía, no llama `GameCenter.completeLevel` y no marca niveles como completados finales.

## Fase 5 — loop completo, persistencia y economía

- Persistencia robusta en `MAREJIG_activeSave_v1` con un snapshot compacto de grupos, piezas, segmentos y métricas; no se guardan imágenes, canvases, blobs ni datos base64.
- `MAREJIG_levelProgress_v1` conserva solo un resumen por nivel para el menú de pendientes; `MAREJIG_completedLevels_v1` guarda métricas finales y mantiene `completedAt` original, añadiendo `lastCompletedAt` en repeticiones para auditoría local.
- El menú oculta niveles ya completados, muestra “Continuar” si existe una partida activa válida y renderiza niveles por lotes para evitar pintar todo el catálogo de golpe.
- La reanudación regenera el puzzle determinístico desde `level.id`, reconstruye la escena y aplica posiciones/grupos/segmentos guardados desde el active save.
- El timer acumula `elapsedMs`, se pausa al ocultar la pestaña, al salir al menú o cuando la pantalla de victoria está abierta, y actualiza solo el HUD con un intervalo ligero.
- Al completar el último segmento, el input se bloquea, el tiempo queda congelado, se muestra modal accesible de victoria, se limpia el progreso parcial y el nivel desaparece de pendientes.
- La economía usa únicamente `window.GameCenter.completeLevel("jigsaw", "level_" + level.id, coins)` desde `MAREJIG_Economy.reportLevelCompleted`; en modo standalone el nivel se marca localmente como completado sin acreditar monedas ni reclamar después automáticamente.
- Las recompensas son idempotentes localmente: `completionStarted` evita repetir el flujo visual y `rewardReported` evita una segunda llamada local a GameCenter. Repetir un nivel desde la victoria no vuelve a pagar.
