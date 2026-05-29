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

## Fase 7 — catálogo escalable y hardening de producción

La Fase 7 prepara `marejigweb` para operar con catálogos de 200+ niveles reales sin precargar imágenes full ni renderizar todo el menú de golpe.

### Cómo añadir un nivel real

1. Sube la imagen fuente a Cloudinary como AVIF horizontal 4:3.
2. Usa un `publicId` estable bajo un path como `marejig/levels/<level_id>`.
3. Añade una entrada compacta en `games/jigsaw/js/MAREJIG_levels.js` dentro de `MAREJIG_LEVEL_SPECS`.
4. Ejecuta el validador y el stress test antes de publicar.

Formato exacto del objeto `Level` exportado por el catálogo:

```js
{
  id: 'reef_001',                  // único y estable
  order: 1,                        // único para ordenación
  title: 'Buceo profundo',
  pack: 'Océano',
  difficulty: 'standard',          // easy | standard | hard
  cloudinaryPublicId: 'marejig/levels/reef_001',
  sourceFormat: 'avif',
  aspectRatio: '4:3',
  master: { width: 2400, height: 1800 },
  board: { cols: 16, rows: 12 },
  targetPieceCount: 60,
  segmentPlan: [10, 10, 12, 12, 16],
  rewardCoins: 55
}
```

No añadas campos visuales pesados, imágenes embebidas, base64, blobs, canvases ni bitmaps al catálogo o al storage.

### Requisitos de imagen

- Fuente AVIF.
- Formato horizontal 4:3.
- Tamaño maestro recomendado: `2400×1800`.
- Entrega por Cloudinary mediante `cloudinaryPublicId`.
- El frontend no contiene API keys, API secrets ni tokens privados.

### Cloudinary real

`cloudName` sigue siendo configurable en `games/jigsaw/js/MAREJIG_config.js`, en:

```js
cloudinary: {
  cloudName: 'demo'
}
```

Para producción, reemplaza `demo` por el cloud name real. Las URLs usan `f_auto` y `q_auto` por defecto; `f_avif` solo se fuerza con `forceAvifForTesting` en pruebas explícitas. El helper `window.MAREJIG_Cloudinary.buildAllUrls(level)` permite revisar las variantes `tiny`, `thumbnail`, `thumbnailLarge`, `fullMobile` y `fullPremium`. `validateUrl(url, { offline: true })` o la ausencia de `fetch` omiten la validación de red sin romper tests offline; usa `{ strict: true }` si quieres fallar ante un `HEAD` fallido en CI con red.

### Balance de dificultad y recompensas

Las dificultades válidas son `easy`, `standard` y `hard`. En v1 todas conservan board `16×12` y `targetPieceCount: 60` para mantenerse dentro del rango estable del generador (`56–64` piezas). El balance se aplica con planes de segmentos, duración/límite de pistas y recompensa fija:

- `easy`: segmentos más generosos y recompensas 35–45 monedas.
- `standard`: segmentos estándar y recompensas 50–65 monedas.
- `hard`: segmentos más compactos, pistas menos generosas y recompensas 70–90 monedas. Queda documentado como dificultad metadata-safe; no sube todavía a 70–80 piezas para evitar riesgo en el generador actual.

La recompensa sigue siendo fija por nivel y se reporta una sola vez. Love Arcade es el banco: el juego solo llama `window.GameCenter.completeLevel("jigsaw", "level_" + level.id, coins)` desde `MAREJIG_economy.js`, no modifica saldos globales.

### Política de completados y menú

La pantalla principal muestra únicamente niveles pendientes. Los niveles completados se filtran antes de renderizar cards, por lo que desaparecen del catálogo principal tras la victoria. El menú renderiza un lote inicial (`initialPendingCards`) y después lotes de `batchSize` con el botón `Ver más`; no crea 200 cards de golpe. Las miniaturas se cargan lazy y las imágenes full solo se solicitan después de seleccionar un nivel.

### Validadores y smoke tests

Comandos recomendados antes de merge:

```bash
git diff --check
git diff --cached --check
for file in games/jigsaw/js/*.js; do node --check "$file" || exit 1; done
node games/jigsaw/tools/validate-levels.mjs
node games/jigsaw/test/phase7_unit.mjs
```

`validate-levels.mjs` valida ids, orders, campos críticos, aspecto 4:3, maestro 2400×1800, board 16×12, `segmentPlan`, recompensas, `cloudinaryPublicId`, formato AVIF, dificultad y generación determinística válida. `phase7_unit.mjs` añade fixture de 200 niveles, stress de generación, URL builder Cloudinary, menú por batches, filtrado de completados, economía idempotente y checks de integración Love Arcade.
