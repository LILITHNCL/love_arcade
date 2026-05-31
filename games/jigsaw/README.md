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
- boards dependientes de dificultad: `12×9` para easy/standard y `16×12` para hard, siempre 4:3;
- target estándar de 32 piezas, validado dentro del rango 28–34;
- grafo de adyacencia real por lados compartidos;
- `neighborIds`, `segmentId`, `groupId` y contornos serializables por pieza;
- segmentos progresivos con `s_0` revelado inicialmente;
- grupos iniciales de una pieza y helpers puros de merge/validación.

### Fase 3 — renderer y escena visual

- `MAREJIG_scene.js` crea una escena sandbox fullscreen/mobile-first con mundo mayor que el viewport, cámara con pan, dispersión determinística, reflow estable y `hitBounds`;
- `MAREJIG_renderer.js` dibuja en Canvas 2D con DPR capado a `Math.min(devicePixelRatio, 2)`;
- el área lógica de solución conserva como máximo un borde exterior sutil, sin preview, guía translúcida ni cuadrícula;
- solo las piezas del segmento inicial `s_0` aparecen reveladas y dispersas naturalmente alrededor del área lógica de solución;
- cada grupo visible dibuja una sola vez el fragmento correcto de la imagen runtime bajo su clip poliminó exterior, sin seams internos;
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
- Durante partida la UI normal queda reducida a controles flotantes de pausa/opciones y un indicador mínimo de segmento; métricas, estado técnico y detalles quedan ocultos salvo `?debug=1`. La persistencia ligera solo se actualiza en eventos discretos.
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
  board: { cols: 12, rows: 9 },      // hard usa { cols: 16, rows: 12 }
  targetPieceCount: 32,
  segmentPlan: [8, 8, 8, 8],
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

Las dificultades válidas son `easy`, `standard` y `hard`. `easy` y `standard` usan board `12×9`; `hard` usa `16×12` para sostener 60 piezas reales sin piezas ridículamente pequeñas. Los rangos validados son 22–28, 28–34 y 56–64. El balance se aplica con planes de segmentos y recompensa fija:

- `easy`: 24 piezas objetivo, segmentos `[6, 6, 6, 6]` y recompensas 35–45 monedas.
- `standard`: 32 piezas objetivo, segmentos `[8, 8, 8, 8]` y recompensas 50–65 monedas.
- `hard`: 60 piezas objetivo, segmentos `[8, 8, 8, 8, 8, 10, 10]`, máximo 10 piezas nuevas por segmento y recompensas 70–90 monedas.

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

`validate-levels.mjs` valida ids, orders, campos críticos, aspecto 4:3, maestro 2400×1800, board por dificultad (`12×9` o `16×12`), `segmentPlan`, recompensas, `cloudinaryPublicId`, formato AVIF, dificultad y generación determinística válida. `phase7_unit.mjs` añade fixture de 200 niveles, stress de generación, URL builder Cloudinary, menú por batches, filtrado de completados, economía idempotente y checks de integración Love Arcade.

## Fase 8 — release candidate

`games/jigsaw/` queda en estado **release candidate**: gameplay completo, catálogo escalable, validadores automatizados, smoke browser reproducible y checklist manual de producción. Esta fase no añade mecánicas grandes; congela el alcance y se enfoca en QA, estabilidad e integración Love Arcade.

### Arquitectura rápida

- `index.html`: shell Love Arcade, pantallas, HUD, modales y carga de scripts. `../../js/app.js` debe permanecer como último script del `<body>`.
- `js/MAREJIG_levels.js`: catálogo compacto, packs, dificultad, recompensa y metadata Cloudinary.
- `js/MAREJIG_generator.js`, `MAREJIG_shapes.js`, `MAREJIG_segments.js`, `MAREJIG_groups.js`: generación determinística, segmentación y reglas de snap por adjacency.
- `js/MAREJIG_renderer.js`: Canvas 2D con DPR capado y dirty rendering; no hay loop continuo.
- `js/MAREJIG_input.js`: Pointer Events, drag, cancelación y bloqueo durante victoria.
- `js/MAREJIG_storage.js`: única capa de persistencia local del juego, limitada a claves `MAREJIG_` permitidas.
- `js/MAREJIG_economy.js`: único adaptador económico; el juego reporta eventos y Love Arcade conserva el banco.
- `js/MAREJIG_cloudinary.js` y `MAREJIG_imageLoader.js`: delivery responsive, fallback visual y liberación de imagen full al volver al menú.

### Cómo correr local

Desde la raíz del repo, sirve archivos estáticos con cualquier servidor local. Ejemplo sin dependencias persistentes:

```bash
python3 -m http.server 4173
# abrir http://127.0.0.1:4173/games/jigsaw/index.html
```

El juego funciona standalone si `GameCenter` está ausente. En ese modo los niveles se completan localmente, pero no se acreditan monedas.

### Tests Node obligatorios

```bash
git diff --check
git diff --cached --check
for file in games/jigsaw/js/*.js; do node --check "$file" || exit 1; done
node games/jigsaw/tools/validate-levels.mjs
node games/jigsaw/test/phase4_unit.js
node games/jigsaw/test/phase5_unit.js
node games/jigsaw/test/phase6_unit.js
node games/jigsaw/test/phase7_unit.mjs
node games/jigsaw/test/phase8_audit.mjs
node games/jigsaw/test/phase9_sandbox_unit.mjs
node games/jigsaw/test/phase10_gamefeel_unit.mjs
node games/jigsaw/test/phase11_corrective_unit.mjs
```

`phase8_audit.mjs` cubre integración Love Arcade, storage permitido, economía idempotente, checks estructurales de performance, comportamiento de sandbox/segmentos y restricciones críticas de namespace. `phase9_sandbox_unit.mjs` añade cobertura directa de mundo mayor que viewport, cámara acotada, pan por fondo vacío, drag por pieza, dispersión, clamp recuperable, resize estable, renderer sin guía ni seams internos y hard con 60 piezas en segmentos de hasta 10. `phase10_gamefeel_unit.mjs` y `phase11_corrective_unit.mjs` verifican clusters compactos guiados por foco, paredes del mundo, anti-solape cercano, cámara bajo demanda, audio seguro, fullscreen DOM real y overlays sin layout muerto.

### Smoke Playwright reproducible

El smoke browser queda preparado para CI o local. Si Playwright no está instalado, el script lo omite con un mensaje explícito e instrucciones; para CI estricto usa `MAREJIG_REQUIRE_PLAYWRIGHT=1`.

Instalación temporal:

```bash
npm install --no-save playwright
npx playwright install chromium
python3 -m http.server 4173
MAREJIG_REQUIRE_PLAYWRIGHT=1 node games/jigsaw/test/phase7_smoke_playwright.js
```

Flujo cubierto: menú → filtro → seleccionar nivel → completar con helper debug → victoria → volver a niveles → verificar que el nivel completado desaparece.

### Troubleshooting

- **Cloudinary falla o la URL devuelve 404:** el juego muestra fallback visual y sigue siendo jugable. Revisa `cloudName`, `cloudinaryPublicId`, formato AVIF y que la imagen sea 4:3.
- **`localStorage` lleno o bloqueado:** `MAREJIG_storage.js` captura errores, conserva el juego usable y muestra estado de guardado local no disponible.
- **Playwright no instalado:** ejecuta los comandos de instalación temporal anteriores o deja que el smoke se omita explícitamente en entornos no CI.
- **GameCenter ausente:** modo standalone esperado; no hay recompensa real ni reclamación retroactiva automática.
- **Un nivel completado no aparece:** es la política correcta del menú principal; los completados desaparecen de pendientes.

### Checklist manual de release

Ver `games/jigsaw/RELEASE_CHECKLIST.md` para la lista completa de integración, storage, economía, Cloudinary, performance, responsive, accesibilidad y pasos previos a subir un catálogo real de 200+ niveles.
