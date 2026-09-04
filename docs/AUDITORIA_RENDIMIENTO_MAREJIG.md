# Auditoría de rendimiento — Marejig

**Fecha:** 2026-09-03  
**Alcance:** `games/jigsaw/` (Marejig). Auditoría de código y validación disponible en este entorno. No se modificó código de juego, reglas, assets ni configuración.

## Resumen ejecutivo

Marejig es un juego JavaScript sin framework que renderiza una escena mediante **Canvas 2D**. El movimiento ya está coalescido a un `requestAnimationFrame` y no existe un render loop permanente: son buenas decisiones que deben preservarse. Sin embargo, cada frame de arrastre vuelve a medir el grupo arrastrado (dos veces), redibuja el canvas completo y reconstruye trazados Canvas para todos los grupos visibles. Además, al entrar a un nivel se bloquea la carga de la imagen jugable detrás de una miniatura grande que no se pinta ni se reutiliza.

Se proponen **tres tickets**, ordenados por trabajo en el camino crítico y evidencia estática. No se encontraron datos de frame time, long tasks, layout/paint, GC, memoria, requests ni tamaño transferido medidos en navegador: **No medido — requiere profiling o validación adicional**. Playwright/Chromium no está instalado en este entorno y las conexiones HTTP a Cloudinary fueron rechazadas por el proxy (403), por lo que no se fabrican métricas de red ni de dispositivo.

## Metodología y límites de evidencia

### Hecho comprobado

- Se inspeccionaron los archivos de `games/jigsaw/`, sus pruebas y el orden de scripts de `games/jigsaw/index.html`.
- Se ejecutaron los chequeos de sintaxis y las pruebas unitarias que no dependen de un catálogo histórico de 11 niveles. Sus resultados están en la sección **Validación ejecutada**.
- El smoke browser declara explícitamente que se omite cuando `playwright` no está instalado. En este entorno el módulo no está disponible.
- Los intentos de obtener cabeceras de las URLs de Cloudinary no llegaron al origen: el proxy devolvió `403 CONNECT tunnel failed`. No se infiere tamaño, formato final ni tiempo de descarga a partir de ese resultado.

### No medido — requiere profiling o validación adicional

- Frame time, FPS, porcentaje de frames perdidos, long tasks, scripting, rasterización, paint, layout, memoria, allocations/GC y latencia input-to-photon.
- Conteo real de requests, bytes transferidos, cache hit rate, tiempo de descarga/decode AVIF y memoria del bitmap en producción.
- Rendimiento en un Samsung Galaxy J8 u otro dispositivo concreto. No se asumieron especificaciones ni se atribuye el problema a ese dispositivo.

## Descubrimiento del sistema

| Área | Hallazgo comprobado |
| --- | --- |
| Stack | HTML, CSS y JavaScript clásico en módulos IIFE globales `window.MAREJIG_*`; no hay `package.json` ni bundler detectado en la raíz. |
| Entry point | `games/jigsaw/index.html` carga los scripts propios en orden y luego `../../js/app.js`. `MAREJIG_main.js` inicializa en `DOMContentLoaded`. |
| Navegación/inicialización | `MAREJIG_Main` monta el menú pendiente; `MAREJIG_Menu` crea cards en lotes y usa `IntersectionObserver` para miniaturas/paginación. Seleccionar una card llama a `MAREJIG_Main.startLevel`. |
| Tablero y piezas | `MAREJIG_Generator.generate` crea piezas poliminó, adyacencias, grupos y segmentos deterministas. `MAREJIG_Scene.createScene` crea estado de escena/cámara. La representación es Canvas 2D, no DOM/SVG/WebGL. |
| Input y movimiento | `MAREJIG_Input` instala Pointer Events sobre el canvas. `pointermove` guarda el último punto y ejecuta como máximo una actualización por RAF; ésta desplaza grupo o cámara y marca el renderer como dirty. |
| Encaje | Sólo en `pointerup`: `MAREJIG_Groups.findSnapCandidate` examina los lados de adyacencia de las piezas del grupo arrastrado y `applySnap` fusiona grupos. |
| Estado/persistencia | `MAREJIG_State` contiene el estado activo. `MAREJIG_Storage` serializa snapshots a `localStorage` en eventos discretos (inicio/reanudación, completar segmento, ocultar/salir, completar), no en cada `pointermove`. |
| Render y animación | `MAREJIG_Renderer` hace dirty rendering con RAF; redibuja background, piezas y feedback. Cámara, contacto incorrecto y showcase final usan RAF acotado. El DPR está limitado a 2. |
| Victoria | `MAREJIG_Segments.advanceIfSegmentComplete` notifica final; `MAREJIG_completePuzzle` bloquea input, guarda, ejecuta el showcase y después reporta economía/persistencia/muestra modal. |
| Assets/red | El catálogo declara master AVIF 2400×1800. Cloudinary construye `fullMobile` 1600×1200 y `fullPremium` 2048×1536 con `f_auto`; el perfil se decide por viewport/DPR/conexión. El menú usa 480×360/640×480 y un placeholder 32×24. |
| Build | No se detectó configuración de build ni manifest de dependencias para `games/jigsaw`; los scripts se entregan como archivos separados. |
| Tests/herramientas | Hay validador Node, unit tests y smoke Playwright opcional. El README documenta los comandos disponibles. |

## Baseline disponible

| Métrica | Resultado |
| --- | --- |
| Sintaxis JavaScript | Correcta para todos los `games/jigsaw/js/*.js`. |
| Pruebas unitarias de gameplay/UI ejecutadas | Correctas: fases 4–16 (excepto comandos que fallan por la expectativa histórica de 11 niveles), más completion showcase. |
| Frame time / FPS / long tasks / paint / layout | No medido — no hubo navegador con profiler disponible. |
| Memoria / allocations / GC | No medido — requiere heap/allocation profiler durante arrastre. |
| Red / bytes / decode AVIF | No medido — proxy impidió llegar a Cloudinary. |
| Smoke Playwright | Ejecutado y omitido explícitamente: `playwright` no está instalado. El propio script permite esta omisión fuera de CI. |

## Hallazgos implementables

## TICKET-1 — Evitar el recálculo doble de bounds en cada frame de arrastre

**Tipo:** Input / JavaScript  
**Prioridad:** Alta  
**Confianza:** Confirmado  
**Flujo afectado:** Movimiento

### Problema

En cada RAF que aplica movimiento de una pieza, `MAREJIG_Input.applyPendingMove` modifica `group.x/y` y llama a `MAREJIG_Scene.clampGroupToWorld`. Esta función llama a `MAREJIG_Groups.recalculateGroupBounds` antes de calcular el clamp y nuevamente después de modificar la posición. El cálculo recorre cada pieza del grupo y crea un objeto `hitBounds` por pieza, además de nuevos objetos para bounds del grupo.

### Evidencia

**Hecho comprobado**

- `MAREJIG_Input.applyPendingMove` es el callback RAF programado por `pointermove`; para `dragging` actualiza el grupo y llama a `clampGroupToWorld`.
- `MAREJIG_Scene.clampGroupToWorld` recalcula bounds dos veces por invocación.
- `MAREJIG_Groups.recalculateGroupBounds` recorre `group.pieceIds`, calcula rects y asigna objetos `scenePiece.hitBounds`, `group.bounds` y `group.hitBounds`.
- Tras aplicar ese trabajo, el mismo callback sólo llama a `renderer.markDirty`; no hace snap, guardado ni resolución de colisiones durante movimiento continuo.

**Inferencia**

- El trabajo y las allocations de bounds crecen con el número de piezas del grupo fusionado. En el catálogo actual existe dificultad hard con 60 piezas objetivo, por lo que no es una micro-optimización puramente teórica.

**Hipótesis**

- En perfiles de hardware modesto, estas asignaciones repetidas pueden contribuir a GC o a perder presupuesto de frame. Debe confirmarse con allocation sampling antes/después.

### Causa raíz

El límite del mundo se calcula a partir de bounds derivados de la geometría relativa inmutable del grupo, pero el código vuelve a materializar todos los bounds tras cada traslación absoluta. El segundo cálculo sólo actualiza coordenadas trasladadas; no cambia ancho, alto ni estructura del grupo.

### Oportunidad de optimización

Hacer incremental el movimiento: mantener bounds locales/medidas del grupo actualizadas únicamente al crear, fusionar, revelar, restaurar o cambiar su composición. En arrastre, trasladar `group.bounds` y `group.hitBounds` por el delta final de clamp, sin regenerar `hitBounds` de todas las piezas. Si la semántica actual exige `scenePiece.hitBounds`, actualizarla de forma diferida o sólo donde haya consumidores reales.

### Archivos involucrados

- `games/jigsaw/js/MAREJIG_input.js` — `MAREJIG_applyPendingMove`.
- `games/jigsaw/js/MAREJIG_scene.js` — `MAREJIG_clampGroupToWorld`.
- `games/jigsaw/js/MAREJIG_groups.js` — `MAREJIG_recalculateGroupBounds`, `MAREJIG_getPieceWorldRect`.

### Cambios propuestos

1. Definir una representación de bounds que se pueda trasladar con el grupo sin volver a recorrer sus piezas.
2. Sustituir el doble recálculo del camino de drag por: mover → determinar y aplicar delta de clamp con los bounds vigentes → trasladar los bounds vigentes por ese delta.
3. Conservar el recálculo completo para cambios estructurales (merge, layout/reflow, restore/reveal) y como ruta de corrección si se invalida la geometría.
4. Añadir una prueba unitaria que verifique límites del mundo y hit testing después de varios movimientos y un merge.

### Limpieza

Eliminar cualquier recalculado de bounds que quede exclusivamente como compensación de la traslación por frame; no eliminar la invalidación/recomputación necesaria en merge, resize, restore o reveal.

### Riesgos

- Bounds desincronizados pueden permitir piezas fuera del mundo, romper hit testing o alterar el snap tras un drag largo.
- Grupos fusionados y piezas poliminó no rectangulares deben mantener el mismo rectángulo y padding táctil actuales.
- Resize, restauración de save y reveal de segmentos deben invalidar la caché correctamente.

### Verificación

- Ejecutar los comandos Node ya documentados en `games/jigsaw/README.md` para sintaxis y suites relevantes.
- Añadir/ejecutar prueba para drag, clamp a los cuatro bordes, hit testing, merge y reanudación.
- Con DevTools Performance y Allocation sampling: grabar el mismo arrastre de un grupo pequeño y uno fusionado antes/después; comparar tiempo de scripting y allocations por frame, sin fijar un umbral inventado.
- Validar manualmente pointer/touch, pan, snap, segmentos, victoria y recuperación de piezas.

### Criterios de aceptación

- Misma funcionalidad, reglas, snap, clamp, persistencia y resultado visual.
- Durante un drag no se recorre dos veces el conjunto completo de piezas del grupo sólo para reflejar una traslación.
- Tests existentes, lint/typecheck/build si están configurados, pasan.
- No quedan helpers/campos de caché muertos ni se añaden dependencias.
- Cambio limitado a movimiento/bounds y cubierto por regresión.

## TICKET-2 — Cachear geometría Canvas por grupo para no reconstruir paths en cada repaint

**Tipo:** Renderizado / JavaScript  
**Prioridad:** Alta  
**Confianza:** Alta probabilidad  
**Flujo afectado:** Movimiento

### Problema

Cada dirty frame borra y redibuja todo el canvas. Para cada grupo visible, el renderer construye de nuevo el path de celdas para `clip()` y recorre los segmentos del contorno para cada stroke (sombra y borde). Durante movimiento, el renderer está marcado dirty por cada RAF y dibuja todos los grupos visibles, aunque la topología de grupos no cambia mientras se arrastra.

### Evidencia

**Hecho comprobado**

- `MAREJIG_Renderer.markDirty` coalescea renders a RAF, y `MAREJIG_render` hace `clearRect`, dibuja background y llama a `MAREJIG_drawVisibleGroups`.
- `MAREJIG_drawVisibleGroups` crea un array de todos los grupos, filtra visibles, lo ordena por z-index y dibuja cada uno para cada frame dirty.
- `MAREJIG_traceGroupCells` ejecuta `beginPath` y un `rect` por celda en cada llamada de `MAREJIG_fillGroup`.
- `MAREJIG_strokeOuterOutline` itera `outline.segments` y emite `moveTo/lineTo`; `MAREJIG_drawGroup` la invoca dos veces por grupo.
- `MAREJIG_Groups` ya invalida `groupOutlinePath`/`groupOutlinePathKey` en merge, pero el renderer no crea ni consume actualmente un `Path2D` cacheado.

**Inferencia**

- La reconstrucción se repite por frame para geometría local que no cambia durante drag/pan/cámara. Este trabajo aumenta con piezas visibles y con el tamaño de los grupos; el segmento hard puede revelar hasta 10 piezas y el puzzle completo contiene 60.

**Hipótesis**

- El coste dominante puede ser rasterización/shadows/drawImage y no creación de paths. El profiler debe separar scripting de rendering antes de adoptar una estrategia más amplia como dirty rectangles o capas offscreen.

### Causa raíz

La caché actual conserva la lista serializable de segmentos del contorno, pero no una representación Canvas reutilizable. La traslación se aplica con `context.translate`, por lo que el path local se puede reutilizar hasta que cambie la composición o escala del grupo.

### Oportunidad de optimización

Construir y cachear `Path2D` locales para el clip de celdas y el contorno exterior por grupo y escala. Reutilizarlos en fill/stroke con el mismo `translate` actual; invalidarlos en merge, restore, reveal o cambio de escala/layout. Mantener el repaint completo inicialmente: el ticket reduce trabajo JavaScript/command recording sin cambiar el orden visual ni la calidad de los assets.

### Archivos involucrados

- `games/jigsaw/js/MAREJIG_renderer.js` — `MAREJIG_traceGroupCells`, `MAREJIG_strokeOuterOutline`, `MAREJIG_fillGroup`, `MAREJIG_drawVisibleGroups`.
- `games/jigsaw/js/MAREJIG_groups.js` — `MAREJIG_getGroupOutline`, `MAREJIG_invalidateGroupOutline`, merge.
- `games/jigsaw/js/MAREJIG_scene.js` — layout/reflow, restore y revelado que cambian estado de grupos.

### Cambios propuestos

1. Implementar un builder de `Path2D` local por grupo para celdas y contorno, indexado por id de grupo, composición y `pieceScale`.
2. Usar esos paths para `clip(path)` y `stroke(path)`; preservar offsets `.25`, line widths, shadows, orden z e imagen dibujada actuales.
3. Reutilizar la infraestructura de invalidación existente y garantizar invalidación explícita después de merge, restore/reflow y cambio de `pieceScale`.
4. Considerar cachear la lista ordenada de grupos visibles sólo si el perfil demuestra que su creación/ordenamiento es material; no convertirlo en requisito sin medición.
5. Añadir tests estructurales/funcionales para invalidación de path tras merge y resize.

### Limpieza

Eliminar `groupOutlinePath`/`groupOutlinePathKey` inertes o reemplazarlos por una caché real coherente. No retener paths de grupos eliminados tras un merge.

### Riesgos

- Caché con escala equivocada puede producir seams, clips incorrectos, contornos desplazados o hit areas visualmente divergentes.
- La disponibilidad de `Path2D` debe tener fallback equivalente para navegadores que no lo soporten.
- No debe modificar z-order, sombras, feedback de selección, fallback gráfico ni reduced motion.

### Verificación

- Ejecutar las suites y smoke browser documentados en `games/jigsaw/README.md`.
- Validar visualmente piezas individuales, grupos fusionados, todos los segmentos y el fallback sin imagen.
- Con DevTools Performance, grabar drag/pan con perfiles estándar y hard antes/después; comparar tiempo de scripting, comandos Canvas, paint/raster y frames perdidos. Tomar heap/allocation sample para descartar retención de paths eliminados.
- Comparar capturas antes/después a DPR 1 y DPR 2, incluida orientación/responsive.

### Criterios de aceptación

- Misma apariencia, clipping, bordes, sombras, animaciones, input, encaje y victoria.
- En frames de movimiento sin mutación estructural no se reconstruyen los paths de células/contorno para cada grupo visible.
- Fallback conserva el resultado actual y las cachés de grupos eliminados se liberan.
- Tests/checks configurados pasan; sin dependencias adicionales, código muerto ni cambios fuera del ticket.

## TICKET-3 — No bloquear la imagen jugable detrás de una preview grande no consumida

**Tipo:** Assets / Red / Entrada  
**Prioridad:** Media  
**Confianza:** Confirmado  
**Flujo afectado:** Entrada

### Problema

Al iniciar nivel, `loadPlayableImage` descarga y decodifica primero una imagen `thumbnailLarge` (640×480) y sólo en su siguiente `then` inicia la descarga de la imagen full. El valor `preview` resultante se guarda en `imageResult`, pero no se dibuja ni se utiliza por ningún módulo. Independientemente, la pantalla de preparación ya carga y muestra su propia imagen tiny (32×24).

### Evidencia

**Hecho comprobado**

- `MAREJIG_Main.startLevel` muestra la pantalla de preparación y llama a `MAREJIG_setPreparingPreview`, que carga el preset `tiny`.
- `MAREJIG_ImageLoader.loadPlayableImage` carga `thumbnailLarge`, espera su `onload`/`decode`, y después carga `fullMobile` o `fullPremium`.
- La búsqueda de `preview` fuera de `MAREJIG_imageLoader.js` sólo encuentra el elemento de preparación y `MAREJIG_setPreparingPreview`; ningún renderer consume `imageResult.preview`.
- Las transformaciones declaradas son 32×24 (tiny), 640×480 (thumbnailLarge), 1600×1200 (fullMobile) y 2048×1536 (fullPremium).

**Inferencia**

- En una caché fría, la cadena serial añade al camino crítico una solicitud y decode cuyo resultado no participa en el frame de juego. En caché caliente el navegador podría mitigar el coste, pero eso no elimina la dependencia secuencial del código.

**Hipótesis**

- La miniatura grande pudo ser concebida como warm-up o fallback visual. No hay evidencia de que genere una mejora neta; debe validarse con waterfall y cache states antes de mantenerla de forma opcional.

### Causa raíz

El loader conserva un paso de preview para una UI de preparación que ahora muestra una URL tiny diferente. La preview grande se queda retenida en `imageResult` sin consumidor, y su `Promise` precede al recurso requerido para crear la escena.

### Oportunidad de optimización

Iniciar directamente la carga/decode de la imagen full requerida, conservando la preview tiny ya visible. Si producto requiere una preview de alta calidad, iniciarla en paralelo sin retrasar la full y consumirla realmente; elegir entre ambas variantes sólo después de medir waterfall, bytes y decode.

### Archivos involucrados

- `games/jigsaw/js/MAREJIG_main.js` — `MAREJIG_setPreparingPreview`, `MAREJIG_startLevel`.
- `games/jigsaw/js/MAREJIG_imageLoader.js` — `MAREJIG_loadPlayableImage`.
- `games/jigsaw/js/MAREJIG_cloudinary.js` — presets y selección de perfil.

### Cambios propuestos

1. Eliminar de la ruta secuencial la carga/decode de `thumbnailLarge` si no se va a renderizar.
2. Quitar el campo `preview` de los resultados/cachés si ningún consumidor queda tras el cambio.
3. Mantener el placeholder tiny y el fallback visual actuales; la full sigue usando los mismos perfiles/tamaño/calidad de Cloudinary.
4. Si se decide conservar preview por UX, hacerlo en paralelo y establecer una condición explícita para no bloquear `createScene`/entrada al juego.
5. Añadir pruebas que comprueben el orden de carga y que el fallback full continúa entrando al juego.

### Limpieza

Eliminar la promesa/catch/log de thumbnail de carga y propiedades `preview` obsoletas, o convertirlas en una ruta paralela con consumidor real. No eliminar las miniaturas del menú ni la imagen tiny de preparación.

### Riesgos

- Debe conservarse feedback de progreso comprensible y la pantalla de preparación mínima.
- La imagen full debe seguir usando CORS/`decode()`/`createImageBitmap` y el fallback si Cloudinary falla.
- No cambiar resolución, calidad de asset, perfil `fullMobile`/`fullPremium` ni políticas de cache sin validación de producto.

### Verificación

- Usar Network/Performance de navegador con cache deshabilitada y cache cálida: registrar orden, cantidad de requests, tiempo de entrada a canvas y decode de ambos perfiles. No usar la miniatura eliminada como sustituto de la full.
- Validar Cloudinary real en una red accesible, y el fallback cuando la full falla.
- Ejecutar los comandos del README para sintaxis, unit tests y smoke Playwright; revisar menú, preparación, entrada, regreso al menú/release del bitmap y replay.

### Criterios de aceptación

- La entrada al tablero no espera una preview grande que no se pinta ni utiliza.
- Misma imagen full, calidad, reglas, controles, fallback, progreso y apariencia de preparación.
- Se liberan campos/cachés/código obsoleto y no se agregan dependencias.
- Tests/checks configurados pasan y el cambio queda acotado a la carga de nivel.

## Investigación adicional

### Render completo Canvas por frame

- **Sospecha:** `clearRect` + background + todos los grupos visibles por cada RAF puede ser costoso en hardware modesto, incluso después de cachear paths.
- **Evidencia:** el renderer no usa dirty rectangles/capas y `drawVisibleGroups` recorre todos los grupos visibles en cada dirty frame. Sí coalescea a RAF y no hay loop continuo fuera de interacción/animaciones.
- **Falta comprobar:** si el cuello está en scripting, rasterización de sombras, `drawImage`, composición o si el coste real cabe en el presupuesto de frame.
- **Qué medir/cómo:** Chrome DevTools Performance con screenshots y rendering stats, en drag de grupo pequeño y grupo grande, con cache fría/caliente y DPR 1/2. Registrar Main, Raster, GPU/paint, frames y long tasks. Repetir en al menos un dispositivo de capacidad modesta y uno moderno, identificados por datos reales, no por nombre asumido.
- **Por qué no es ticket aún:** una capa/offscreen/dirty rectangles añade complejidad y puede crear artefactos por solapamiento, sombras y z-order. Sólo debe implementarse si el profile muestra beneficio tras TICKET-1 y TICKET-2.

### Algoritmos de snap, hit test y solapamiento al soltar

- **Sospecha:** `findSnapCandidate` hace `adjacency.filter` por pieza activa, y las rutinas de contacto/solapamiento crean arrays, filtran/ordenan grupos y pueden volver a medir bounds al soltar.
- **Evidencia:** esos recorridos existen en `MAREJIG_groups.js` y `MAREJIG_scene.js`; snap y resolución se invocan en `pointerup`, no en `pointermove`. El input test existente confirma que move no llama a snap/save/overlap.
- **Falta comprobar:** duración de `pointerup` y su impacto observable con grupos grandes; no hay trace ni métricas disponibles.
- **Qué medir/cómo:** Performance profile con user timing temporal o profiler sampling alrededor de pointerup, con el número máximo de grupos visibles y grupos fusionados; medir JS self/total time y allocations.
- **Por qué no es ticket aún:** no se ha demostrado que afecte a movimiento continuo ni que la escala actual (máximo 60 piezas) produzca una pausa relevante.

### Memoria de `Image` + `ImageBitmap` y caché de miniaturas

- **Sospecha:** con `createImageBitmap`, el resultado conserva tanto `image` como `drawable` hasta salir del nivel. La miniatura cacheada no se limpia al volver al menú.
- **Evidencia:** `loadPlayableImage` retorna ambos; `releaseFullImage` cierra `drawable` cuando tiene `close()`, borra el cache full, pero no nulifica la referencia `image` presente en el resultado. `MAREJIG_thumbnailCache` es un `Map` sin evicción durante la sesión.
- **Falta comprobar:** memoria real de los recursos, si el navegador comparte backing store y si el catálogo completo se llega a recorrer en la misma sesión.
- **Qué medir/cómo:** Heap snapshots/Memory panel tras entrar/salir repetidamente de niveles y después de recorrer el menú; comparar retained objects e imágenes/bitmaps. Medir específicamente tras `releaseFullImage` y GC forzado sólo en herramientas de desarrollo.
- **Por qué no es ticket aún:** no se puede afirmar fuga; existe una liberación explícita del bitmap full y el cache de thumbnails puede ser una decisión de UX válida.

### Generación y construcción de escena durante entrada

- **Sospecha:** `MAREJIG_Generator.generate` puede realizar hasta 80 intentos, validando puzzle/variedad en cada uno; todo corre de forma síncrona después de cargar la imagen.
- **Evidencia:** el límite y el loop están en `MAREJIG_generator.js`; con retorno válido normalmente sale antes, pero no se midió el número real de intentos ni duración para niveles del catálogo.
- **Falta comprobar:** intentos/duración reales en easy, standard y hard, y si bloquean la interacción o retrasan la entrada una vez la imagen está lista.
- **Qué medir/cómo:** Performance marks alrededor de generate/createScene/layout en un build de profiling o DevTools CPU profile, sin cambiar la lógica de producción; registrar intentos desde `puzzle.debug.attempt`.
- **Por qué no es ticket aún:** el generador no se ejecuta durante drag y no hay evidencia de duración relevante.

## Priorización final

| Ticket | Prioridad | Confianza | Área | Flujo | Impacto esperado | Riesgo |
| --- | --- | --- | --- | --- | --- | --- |
| TICKET-1 | Alta | Confirmado | Input / JavaScript | Movimiento | Reduce recorridos y objetos por RAF del drag; crece con grupo fusionado | Medio: bounds/hit testing |
| TICKET-2 | Alta | Alta probabilidad | Renderizado / JavaScript | Movimiento | Reduce reconstrucción de paths/comandos Canvas para geometría estable | Medio: clips, escala, invalidación |
| TICKET-3 | Media | Confirmado | Assets / Red | Entrada | Elimina dependencia secuencial de request/decode no consumido | Bajo–medio: progreso/fallback |

## Flujo crítico real

**Entrada al tablero**  
`MAREJIG_Menu.selectLevel` → `MAREJIG_Main.startLevel` → pantalla preparing/tiny preview → `MAREJIG_ImageLoader.loadPlayableImage` → `MAREJIG_Generator.generate` → `MAREJIG_Scene.createScene` → `MAREJIG_Renderer.setScene/render` → `MAREJIG_Input.attach`.

**Interacción**  
Canvas Pointer Events en `MAREJIG_Input`: `pointerdown` convierte screen→world con `MAREJIG_Scene.screenToWorld`, hace `MAREJIG_Groups.hitTest` y selecciona drag o pan.

**Movimiento**  
`pointermove` guarda `pendingScreen` → `requestAnimationFrame(MAREJIG_applyPendingMove)` → actualiza grupo/cámara, hace clamp y `MAREJIG_Renderer.markDirty` → `MAREJIG_Renderer.render` redibuja Canvas 2D.

**Encaje**  
En `pointerup`: recalcula bounds → `MAREJIG_Groups.findSnapCandidate` sobre adyacencia real → `MAREJIG_Groups.applySnap`/merge; si no hay candidato, comprueba contacto/solapamiento en `MAREJIG_Scene`.

**Actualización**  
Callback `onMoveEnd` en `MAREJIG_Main.startLevel` → `MAREJIG_Segments.advanceIfSegmentComplete`; cuando corresponde revela segmento, guarda snapshot y marca render/cámara.

**Victoria**  
`advanceIfSegmentComplete` devuelve `puzzleComplete` → `MAREJIG_Main.completePuzzle` bloquea input, guarda y arranca `MAREJIG_Scene.startCompletionShowcase`/`MAREJIG_Renderer.animateCompletionShowcase` → `MAREJIG_finishPuzzleCompletion` reporta economía, actualiza storage/menú y muestra modal.

## Validación ejecutada

- `for file in games/jigsaw/js/*.js; do node --check "$file"; done` — correcto.
- `node games/jigsaw/test/phase4_unit.js` a `node games/jigsaw/test/phase16_active_save_modal_unit.mjs` (las fases disponibles indicadas en la salida) y `node games/jigsaw/test/completion_showcase_unit.mjs` — correctos, salvo los checks de catálogo histórico detallados abajo.
- `node games/jigsaw/tools/validate-levels.mjs` — falla porque espera exactamente 11 niveles y el catálogo actual contiene 25.
- `node games/jigsaw/test/reward_balance_unit.mjs` — falla por la misma expectativa de exactamente 11 niveles.
- `node games/jigsaw/test/phase7_smoke_playwright.js` — ejecutado y omitido explícitamente porque Playwright no está instalado; no se usó como evidencia de rendimiento.

Estas dos fallas de validación de catálogo se registran como estado preexistente de pruebas; no son un hallazgo de rendimiento ni motivan cambios dentro de esta auditoría.
