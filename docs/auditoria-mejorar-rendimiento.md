# Auditoría de Rendimiento Frontend — Love Arcade
### Enfoque: fluidez en hardware modesto (referencia: Samsung Galaxy J8) · Flujo prioritario: Inicio → Tienda y acciones dentro de Tienda

**Rol:** Staff/Principal Engineer de rendimiento frontend — auditoría de solo lectura, sin cambios de código.
**Alcance:** Investigación exhaustiva del código disponible (`index.html`, `js/app.js`, `js/shop-logic.js`, `js/spa-router.js`, `js/lifecycle-scheduler.js`, `styles.css`, `sw.js`, `js/analytics.js`, `js/push-notifications.js`, `js/backup-engine.js`) y producción de tickets ejecutables para Codex.

---

## 0. Arquitectura general (contexto para todos los tickets)

- **Stack:** JavaScript vanilla ES2020+, sin framework, sin bundler ni build step visible (los `<script>` se cargan directos en `index.html`).
- **Routing:** `js/spa-router.js` — SPA custom. Las vistas (`#view-home`, `#view-shop`, `#view-profile`) **nunca se desmontan del DOM**: `_applyView()` alterna la clase `.hidden` (`display:none !important`, confirmado en `styles.css`). Esto significa que no existe coste de "montaje/desmontaje" de componentes en el sentido de un framework, pero sí implica que **todos los listeners, observers y timers de todas las vistas permanecen vivos simultáneamente**, sin importar cuál esté visible.
- **Estado:** Un único objeto `store` en memoria (`js/app.js`), persistido en `localStorage['gamecenter_v6_promos']` vía `saveState()`. No hay store reactivo — cada mutación dispara manualmente `updateUI()` y consultas `querySelectorAll` sobre el documento completo.
- **Catálogo de Tienda:** `data/shop.json` (~144 ítems) + `data/shop-gifts.json`, cargados una sola vez en memoria (`allItems`) al `DOMContentLoaded` de `shop-logic.js`, con renderizado incremental por lotes de 18 tarjetas usando `IntersectionObserver`.
- **Sincronización cloud:** IIFE `SentinelCloudSync` en `js/app.js` — parchea `localStorage.setItem`/`removeItem` globalmente y arranca su propio bootstrap async en cuanto el script se ejecuta.

---

## 1. Reconstrucción del flujo Inicio → Tienda

Esto es lo que ocurre, en orden, al tocar el link "Tienda" (`data-view="shop"`) estando en Inicio:

1. `spa-router.js → _bindNavItem()`: el click handler llama `setTimeout(() => navigateTo('shop'), 0)` (para no bloquear el hilo del evento de click).
2. `navigateTo()` → `history.pushState(...)` + `_applyView('shop')`.
3. `_applyView('shop')`:
   - `window.scrollTo({top:0})` síncrono.
   - `VIEWS.forEach` → toggla `.hidden` en `#view-home` (se oculta) y `#view-shop` (se muestra). Ningún nodo se crea ni se destruye.
   - `AppScheduler.setActiveView('shop')` → pausa el grupo `countdown` (timers de Inicio).
   - `_syncNavHighlight('shop')`.
   - **`requestAnimationFrame`**: `GameCenter.syncUI()` → `updateUI()` (ver Ticket 05/09) + scroll a ancla si aplica.
   - **`setTimeout(0)`**: cola de lifecycle — `HomeView.onLeave()` (pausa `countdown` **otra vez**, redundante pero barato) y `ShopView.onEnter()`, envuelto en `performance.mark/measure` y ejecutado vía `_drainLifecycleQueue` (rAF + `requestIdleCallback`).
4. `ShopView.onEnter()` (`shop-logic.js`):
   - `initEconomyInfo()` — ver Ticket 10 (dead code).
   - `renderMoonBlessingStatus()`.
   - Sincroniza saldo en navbar/HUD con dos `querySelectorAll` globales.
   - **`_computeCatalogSignature()`** — ver Ticket 02, se ejecuta siempre, incluso cuando nada cambió.
   - Según si la firma coincide: `_refreshBoughtBadges()` (rápido) o `filterItems()` completo (reconstruye el grid).

**Conclusión de la reconstrucción:** como las vistas nunca se desmontan, el coste real de la transición no está en "crear la pantalla de Tienda" sino en (a) trabajo redundante que se repite en cada entrada a la vista, y (b) el hecho de que **toda la infraestructura de ambas vistas está activa en todo momento** (timers, observers, animaciones CSS con `will-change` permanente). Los tickets siguientes atacan ambos frentes.

---

## TICKET-01 — `will-change` permanente en contenedores de vista completos (`.view-section`)

**Tipo:** Animación / Renderizado
**Prioridad:** Alta
**Nivel de confianza:** Confirmado
**Impacto esperado:** Menor presión de memoria GPU sostenida; menos capas de composición permanentes en dispositivos con GPU/RAM limitada.

### Objetivo
Que la promoción a capa de compositor (`will-change`) sobre `#view-home` y `#view-shop` sea **temporal** (solo durante la transición de 250ms), no permanente durante toda la sesión.

### Flujo afectado
Inicio ↔ Tienda ↔ Perfil (global, pero crítico porque son los contenedores raíz de las dos vistas más usadas).

### Archivos involucrados
- `styles.css` — regla `.view-section` (contiene `will-change: opacity, transform;` y el comentario `/* NOTA will-change: se declara aquí de forma permanente porque las dos vistas SPA... están SIEMPRE presentes en el DOM. */`).
- `index.html` — `#view-home`, `#view-shop`, `#view-profile` llevan la clase `view-section`.
- `js/spa-router.js` — `_applyView()`, punto donde se togglea `.hidden` y podría añadirse/retirarse `will-change` dinámicamente.

### Contexto del código
`.view-section` es la clase que activa la transición "anti-golpe" (`opacity` + `translateY`, 250ms). El propio comentario en `styles.css` documenta la decisión consciente de dejar `will-change` fijo porque las vistas "siempre están en el DOM". Esto contradice el patrón que el propio proyecto usa en **otros** componentes: el modal de preview retiró explícitamente su `will-change` estático en la v9.6 "Phase 3" (comentario: *"will-change ya no se gestiona aquí. Está declarado en CSS sobre .modal-box y se libera automáticamente cuando el overlay recibe display:none"*), y el banner de oferta desactiva su `will-change` en `pointer:coarse` (v9.8) precisamente por el coste en gama baja.

### Hallazgo
`will-change` fuerza al navegador a mantener una capa de composición GPU dedicada para el elemento **de forma indefinida**, no solo mientras se anima. `#view-home` y `#view-shop` son contenedores casi del tamaño completo del viewport. Mientras cualquiera de las dos está visible (que es siempre, porque una u otra lo está en todo momento salvo Perfil), su capa GPU permanece promovida sin necesidad, incluso en reposo total (usuario simplemente leyendo la Tienda, sin animar nada). En un SoC de gama baja como el del Galaxy J8 (GPU Mali-T720/T830 con VRAM compartida muy limitada), mantener una capa full-viewport permanentemente reduce la memoria de composición disponible para el resto de la UI (tarjetas, modales, animaciones puntuales) y puede forzar al compositor a hacer más trabajo de gestión de capas del que sería necesario.

### Evidencia
- **Hecho comprobado:** `styles.css`, regla `.view-section`, contiene `will-change: opacity, transform;` sin condición ni JS que la retire.
- **Hecho comprobado:** el propio código documenta en comentario la justificación actual (vistas siempre en DOM) — es una decisión de diseño explícita, no un descuido.
- **Hecho comprobado:** el mismo archivo demuestra que el proyecto YA aplica el patrón contrario (will-change dinámico) en `.modal-box` y en `.sale-banner__ticket::after` bajo `pointer:coarse`.
- **Inferencia:** el impacto cuantitativo (MB de VRAM, FPS) no puede medirse desde el código; requiere profiling en el dispositivo real (Chrome DevTools → Layers panel, o `chrome://gpu` en el propio Android).

### Hipótesis de causa raíz
Decisión de diseño tomada para evitar el coste de "promotion jank" al inicio de cada transición, pero sin considerar el coste de mantenerlo permanente en dispositivos con poca memoria de composición.

### Oportunidad de optimización
Aplicar `will-change` **dinámicamente**, replicando el patrón que ya usa `.modal-box`:
1. Justo antes de togglear `.hidden` en `_applyView()`, añadir una clase (p. ej. `.is-transitioning`) que active `will-change: opacity, transform` solo en la vista que entra.
2. Escuchar `transitionend` en la vista (o usar un `setTimeout` igual a la duración de la transición, 250ms, como ya hace el proyecto en otros temporizadores) para retirar esa clase / `will-change` una vez terminada la animación de entrada.
3. La vista que se oculta no necesita `will-change` en absoluto porque pasa a `display:none` de inmediato.

### Preservación funcional
- La transición visual (opacity 0→1, translateY 10px→0, 250ms, ease-out) debe verse **exactamente igual**.
- El comportamiento de scroll-reset y el resto de `_applyView()` no debe alterarse.
- No debe afectar `#view-profile` si esa vista no participa del mismo patrón de transición (verificar si también usa `.view-section`).

### Preservación visual
Ningún cambio visual. `will-change` es una pista de rendimiento invisible para el usuario; su ausencia fuera de la ventana de animación no debe producir ningún salto ni pop-in perceptible porque el navegador sigue pudiendo promover la capa a tiempo cuando se le pide justo antes de animar (con el margen de un frame, que ya es la práctica estándar y la que usa `.modal-box`).

### Riesgos
- Si `will-change` se retira **demasiado pronto** (antes de que la transición realmente termine), podría producirse un frame de "promotion jank" visible. Mitigar dejando el retiro atado a un evento `transitionend` real o un timeout con margen (p. ej. 280ms en vez de 250ms).
- Si el usuario navega muy rápido entre vistas (doble tap), hay que asegurar que no queden múltiples timers de retiro solapados dejando `will-change` mal gestionado — usar un solo timer cancelable por vista.

### Verificación obligatoria para Codex
1. Confirmar en `styles.css` que `.view-section` es la única regla con `will-change` permanente de este tipo (buscar todas las ocurrencias de `will-change` en el archivo y clasificar cuáles son estáticas vs. dinámicas).
2. Revisar `js/spa-router.js → _applyView()` para confirmar el punto exacto donde se togglea `.hidden` y dónde insertar la lógica de `will-change` dinámico sin romper el orden de fases (scroll reset → toggle hidden → rAF → lifecycle queue).
3. Verificar si `#view-profile` usa la misma clase `.view-section` y si participa en `_applyView()` de la misma forma (el código de `VIEWS` incluye `'profile'`).
4. Comprobar que no existe ya un mecanismo equivalente en `js/spa-router.js` que se esté pasando por alto.

### Plan de implementación para Codex
1. Añadir una clase auxiliar, p. ej. `.view-transitioning`, en `styles.css`, con la declaración `will-change: opacity, transform;` (idéntica a la actual de `.view-section`).
2. Quitar `will-change` de la regla base `.view-section`.
3. En `js/spa-router.js → _applyView()`, antes de hacer el toggle de `.hidden`, añadir `.view-transitioning` a la vista destino (`viewEls[viewId]`).
4. Tras la transición (usar el mismo timeout de 250ms/280ms que ya gestiona el `setTimeout(0)` de la cola de lifecycle, o un listener `transitionend` en la vista), remover `.view-transitioning`.
5. Asegurar que un timer previo se cancela si el usuario navega de nuevo antes de que termine (guardar el handle en una variable de módulo del router y hacer `clearTimeout` al inicio de cada `_applyView()`).
6. No tocar `contain: layout` — se mantiene igual.
7. Verificar visualmente en Chrome DevTools (mobile emulation + Layers panel) que la capa se crea al iniciar la transición y se destruye ~250-280ms después.

### Archivos que NO deben modificarse
`js/app.js`, `js/shop-logic.js` no participan de esta lógica y no deben tocarse.

### Criterios de aceptación
- La transición visual Inicio↔Tienda es indistinguible de la actual.
- `will-change` en `#view-home`/`#view-shop` deja de estar presente cuando la vista lleva más de ~300ms visible en reposo (verificable en DevTools → Elements → Computed, o Layers panel).
- No aparecen nuevas capas huérfanas ni fugas de listeners/timers al navegar repetidamente.

### Validación
- Inspección manual en Chrome DevTools (Layers panel) antes/después.
- Navegación repetida Inicio→Tienda→Inicio 20+ veces sin degradación visible ni acumulación de timers (revisar en el panel de Performance que no crece la lista de "Recalculate Style/Composite Layers" de forma anómala).

### Resultado esperado
Las capas de composición de las vistas dejan de persistir en reposo; el navegador libera memoria GPU entre transiciones sin ningún cambio perceptible para el usuario.

### Notas para Codex
No confundir esta clase con `.is-ready` (que usa `.player-hud`, `.hud-avatar-wrap`, `.coin-badge` para el Zero-Flicker Initiative) — son mecanismos distintos y no deben mezclarse.

---

## TICKET-02 — `_computeCatalogSignature()` se recalcula en cada entrada a Tienda, incluso sin cambios

**Tipo:** JavaScript / Renderizado
**Prioridad:** Alta
**Nivel de confianza:** Confirmado
**Impacto esperado:** Menos trabajo de CPU síncrono exactamente en el momento de la transición Inicio→Tienda (que es el flujo explícitamente prioritario).

### Objetivo
Evitar recomputar la firma del catálogo (`filter` + `map` + `join` sobre hasta ~90 ítems no-regalo) en cada `ShopView.onEnter()` cuando no ha habido ninguna mutación de inventario ni cambio de filtro/búsqueda desde la última vez.

### Flujo afectado
Inicio → Tienda (se ejecuta en cada entrada a la vista, sin excepción).

### Archivos involucrados
- `js/shop-logic.js` — función `_computeCatalogSignature()` y su uso en `window.ShopView.onEnter()`.

### Contexto del código
`ShopView.onEnter()` llama siempre a `_computeCatalogSignature()` para decidir si basta con `_refreshBoughtBadges()` (barato) o si hace falta `filterItems()` completo (reconstruye el grid). La firma se calcula así para el filtro por defecto `'NoObtenidos'`:

```js
const inventoryPart = activeFilter === 'NoObtenidos'
    ? allItems
        .filter(item => !_isGiftItem(item))
        .map(item => `${item.id}:${GameCenter.getBoughtCount(item.id) > 0 ? 1 : 0}`)
        .join(',')
    : '';
```

Esto crea **dos arrays intermedios** (`filter` y `map`) y una **string de concatenación** sobre el catálogo completo (decenas de ítems), en cada navegación a Tienda, aunque el usuario simplemente vaya y vuelva sin comprar nada.

### Hallazgo
El propósito de la firma es exactamente evitar trabajo redundante (`_refreshBoughtBadges()` es más barato que `filterItems()`), pero el **cálculo de la firma en sí** ya es trabajo no trivial que se repite siempre, incluso en el caso más común (usuario navega sin comprar). Es un patrón de "optimización que paga un coste fijo en cada llamada para ahorrar un coste variable mayor solo quando aplica" — razonable en general, pero el coste fijo puede reducirse a casi cero llevando un **dirty flag** en vez de recomputar y comparar strings.

### Evidencia
- **Hecho comprobado:** código de `_computeCatalogSignature()` y su invocación incondicional dentro de `ShopView.onEnter()` en `js/shop-logic.js`.
- **Hecho comprobado:** `GameCenter.getBoughtCount(item.id)` se invoca una vez por ítem no-regalo dentro del `.map()` — cada llamada hace `store.inventory[itemId] || 0`, acceso a objeto, barato individualmente pero multiplicado por el tamaño del catálogo.
- **Inferencia:** en un catálogo de ~90 ítems no-regalo, el coste absoluto de un `filter+map+join` es pequeño en términos absolutos de JS moderno, pero en un CPU de gama muy baja (Galaxy J8, Cortex-A53 a baja frecuencia) y ejecutándose **exactamente durante la ventana de transición animada** (compitiendo por el mismo hilo principal que está renderizando la animación CSS de entrada), incluso unos pocos milisegundos de bloqueo síncrono del hilo principal pueden traducirse en frames perdidos durante la animación de 250ms. Esto requiere profiling para confirmar magnitud exacta.

### Hipótesis de causa raíz
No existe un "dirty flag" explícito que indique si el inventario cambió desde la última vez que se calculó la firma; en su lugar se recalcula todo y se compara por igualdad de string.

### Oportunidad de optimización
Sustituir el patrón "recalcular y comparar" por un **dirty flag incremental**:
1. Mantener una variable de módulo `_inventoryDirty = true` inicializada en `true`.
2. Marcarla `true` únicamente en los puntos donde el inventario realmente cambia: tras una compra exitosa (`initiatePurchase` → dentro del `if (result.success)`), tras reclamar un regalo (`_handleGiftAction`), y tras cualquier otro punto que mute `store.inventory`.
3. En `ShopView.onEnter()`, si `_inventoryDirty === false` **y** el filtro/búsqueda activos no cambiaron desde el último render, saltar directo a `_refreshBoughtBadges()` sin tocar `_computeCatalogSignature()` en absoluto.
4. Si `_inventoryDirty === true`, ejecutar el flujo actual (firma + decisión) y resetear el flag a `false` al finalizar.
Esto reduce el caso común (sin cambios) a una simple comparación de booleano + strings de filtro/búsqueda (ya guardados), eliminando el `filter+map+join` en la inmensa mayoría de las navegaciones.

### Preservación funcional
- El comportamiento de refresco de badges "Obtenido" tras comprar debe seguir siendo correcto e inmediato.
- El fallback de `filterItems()` completo debe seguir ejecutándose siempre que cambien filtro, búsqueda o inventario.
- `getBoughtCount` sigue siendo la fuente de verdad; el dirty flag es solo una señal de "puede haber cambiado", no reemplaza ninguna lectura de estado.

### Preservación visual
Ninguna. Es un cambio puramente interno de scheduling, sin alterar el HTML generado ni el grid resultante.

### Riesgos
- Si se olvida marcar `_inventoryDirty = true` en algún punto que mute el inventario (por ejemplo, una futura función de regalo o promo que también otorgue ítems), el grid podría mostrar temporalmente un badge desactualizado hasta el siguiente cambio de filtro. Mitigar centralizando la marca del flag en el único punto de mutación real (`GameCenter.buyItem`) mediante un evento, en vez de esparcir `_inventoryDirty = true` por múltiples callers.
- Si se implementa mal la invalidación por cambio de filtro/búsqueda, podría quedarse "pegado" un render viejo al cambiar de pill. Mitigar: los handlers de filtro/búsqueda ya llaman `scheduleFilterItems()` directamente (no pasan por `onEnter`), así que este ticket no interfiere con ese camino.

### Verificación obligatoria para Codex
1. Listar TODOS los puntos del código donde se muta `store.inventory` (buscar `store.inventory[` en `js/app.js`) para asegurar que el flag se marca en cada uno, incluyendo `buyItem()`.
2. Revisar `_handleGiftAction()` en `js/shop-logic.js`, que llama `window.GameCenter.buyItem(item)` para regalos — confirmar que pasa por el mismo camino y por tanto el flag se marca correctamente si se centraliza en `buyItem`.
3. Confirmar que `activeFilter` y `searchQuery` ya se comparan en algún punto accesible para no reconstruir la lógica de comparación desde cero.
4. Revisar si existe algún otro caller de `ShopView.onEnter()` fuera de `spa-router.js` que dependa del comportamiento actual.

### Plan de implementación para Codex
1. Declarar `let _inventoryDirty = true;` junto a las demás variables de módulo al inicio de `js/shop-logic.js`.
2. Dentro de `GameCenter.buyItem()` en `js/app.js`, tras `store.inventory[itemData.id] = bought + 1;`, no es necesario tocar `app.js` si se prefiere mantener la marca del lado de `shop-logic.js`: en su lugar, marcar el flag `_inventoryDirty = true` dentro de `initiatePurchase()` justo después de `if (result.success) { ... }` en `js/shop-logic.js`, y también dentro de `_handleGiftAction()` tras una compra de regalo exitosa.
3. Modificar `ShopView.onEnter()` para que la decisión sea: `const signature = _inventoryDirty ? _computeCatalogSignature() : _lastCatalogSignature;` seguido de la misma lógica de comparación que ya existe, y al final del bloque, `_inventoryDirty = false;`.
4. Mantener intacta la variable `_lastCatalogSignature` y su semántica actual para el resto de callers (`filterItems()`, `loadCatalog()`).
5. Ejecutar pruebas manuales: comprar un ítem → volver a Inicio → volver a Tienda → confirmar que el badge "Obtenido" aparece correctamente. Navegar Inicio↔Tienda repetidamente sin comprar → confirmar que no se reconstruye el grid.

### Archivos que NO deben modificarse
No se identifican restricciones adicionales; Codex debe limitar los cambios al alcance necesario para este ticket dentro de `js/shop-logic.js`.

### Criterios de aceptación
- El grid de Tienda sigue reflejando correctamente el estado de compra tras cada transacción.
- `_computeCatalogSignature()` deja de ejecutarse en navegaciones Inicio→Tienda donde no hubo compras ni cambios de filtro/búsqueda desde la última vez.
- No se introduce ninguna regresión visual ni funcional en el filtrado o búsqueda.

### Validación
- Revisión manual con `console.time`/`console.timeEnd` alrededor de `_computeCatalogSignature()` antes/después del cambio para confirmar que deja de invocarse en el caso común (no se dispone de suite de tests automatizada visible en el repositorio para este módulo).
- Prueba funcional manual del flujo compra → navegación → verificación de badge.

### Resultado esperado
En la navegación más común (Inicio→Tienda sin compras recientes), el hilo principal deja de ejecutar el `filter+map+join` sobre el catálogo completo, reduciendo el trabajo síncrono exactamente durante la ventana de la transición animada.

### Notas para Codex
No eliminar `_computeCatalogSignature()` como función — sigue siendo necesaria para el caso "dirty". Este ticket es sobre evitar invocarla innecesariamente, no sobre eliminar el mecanismo de firma.

---

## TICKET-03 — El `IntersectionObserver` de precarga de imágenes se destruye y reconstruye por completo en cada lote de scroll de la Tienda

**Tipo:** JavaScript / Renderizado / Red
**Prioridad:** Crítica
**Nivel de confianza:** Confirmado
**Impacto esperado:** Elimina trabajo de CPU repetido y redundante exactamente durante el scroll dentro de Tienda — el escenario que el propio reporte de usuario describe como "pesado y con lag".

### Objetivo
Que la precarga de imágenes hi-res del catálogo observe **solo las tarjetas nuevas** de cada lote incremental, sin desconectar y reconstruir el observer sobre todas las tarjetas ya renderizadas previamente.

### Flujo afectado
Tienda (scroll dentro del catálogo).

### Archivos involucrados
- `js/shop-logic.js` — funciones `_appendShopBatch()`, `_initPreloadObserver()`, y el `IntersectionObserver` `_shopLazyObserver` dentro de `renderShop()`.

### Contexto del código
`renderShop(items)` monta el catálogo en lotes de 18 tarjetas (`_shopRenderState.batchSize = 18`) usando un `IntersectionObserver` (`_shopLazyObserver`) sobre un nodo "sentinel" al final del grid. Cada vez que el sentinel entra en el viewport (el usuario hace scroll cerca del final de las tarjetas cargadas), se llama `_appendShopBatch(container)`, que:
1. Añade el siguiente lote de hasta 18 tarjetas al DOM.
2. **Llama `_initPreloadObserver(container, _shopRenderState.items.slice(0, end))`** — es decir, con el array de **todos los ítems renderizados hasta ahora**, no solo los nuevos.

`_initPreloadObserver()` a su vez:
```js
if (_preloadObserver) {
    _preloadObserver.disconnect();
    _preloadObserver = null;
}
_preloadQueue.length = 0;
// ... cancela el requestIdleCallback pendiente ...
// ... construye itemMap de TODOS los items pasados ...
_preloadObserver = new IntersectionObserver(...);
container.querySelectorAll('.shop-card').forEach(card => {
    if (card.querySelector('.shop-preview-btn')) {
        _preloadObserver.observe(card);
    }
});
```

### Hallazgo
Cada vez que el usuario hace scroll lo suficiente como para disparar un nuevo lote (aprox. cada 18 tarjetas), el sistema:
- Desconecta el `IntersectionObserver` de precarga existente (perdiendo cualquier trabajo de observación en curso sobre tarjetas ya vistas pero no procesadas).
- Vacía la cola de precarga pendiente (`_preloadQueue.length = 0`) y cancela el `requestIdleCallback`/`setTimeout` en vuelo.
- Reconstruye el `Map` de ítems desde cero con **todo** el conjunto acumulado (no solo el lote nuevo).
- Vuelve a consultar `container.querySelectorAll('.shop-card')` — **todas** las tarjetas del grid, no solo las 18 nuevas — y vuelve a registrar `observe()` sobre cada una que tenga botón de preview.

Aunque el callback del observer internamente comprueba `cardEl.dataset.preloaded` y hace `unobserve()` de las ya procesadas, el **coste de reconstrucción en sí** (disconnect + nuevo objeto `IntersectionObserver` + iteración completa del DOM del grid + `observe()` de N tarjetas) se repite en cada lote. En un catálogo de ~90+ ítems no-regalo, hacia el final del scroll esto significa reconstruir el observer sobre 70-90 tarjetas repetidamente, exactamente mientras el usuario está en medio de un gesto de scroll — el momento donde el hilo principal es más sensible a bloqueos (jank de scroll es directamente perceptible como "se traba").

### Evidencia
- **Hecho comprobado:** código de `_appendShopBatch()` en `js/shop-logic.js`, línea de llamada `_initPreloadObserver(container, _shopRenderState.items.slice(0, end))` dentro del mismo bloque que añade el lote.
- **Hecho comprobado:** cuerpo de `_initPreloadObserver()` — disconnect incondicional + `container.querySelectorAll('.shop-card')` sin acotar a las tarjetas nuevas.
- **Hecho comprobado:** el propio JSDoc de la función documenta la intención ("Idempotente: si `_preloadObserver` ya existe la desconecta... necesario tras `renderShop()`") — es decir, el diseño fue pensado para el caso de **re-render completo** del catálogo (cambio de filtro), pero se está reutilizando también para el **append incremental por scroll**, que es un caso completamente distinto y no necesita destrucción total.
- **Inferencia:** el coste exacto en frames perdidos por lote requiere profiling en el dispositivo (Performance panel de Chrome DevTools con CPU throttling 4x-6x, que es la forma estándar de aproximar un Galaxy J8 desde un escritorio).

### Hipótesis de causa raíz
La función `_initPreloadObserver()` fue diseñada originalmente para el caso de "el DOM del grid cambió por completo" (nuevo filtro/búsqueda) y se reutilizó sin modificación para el caso de "se añadieron tarjetas nuevas al final", que es un subconjunto mucho más barato de resolver.

### Oportunidad de optimización
Separar los dos casos de uso:
1. **Reconstrucción completa** (cuando cambia filtro/búsqueda y el grid se vacía con `renderShop()`): mantener `_initPreloadObserver()` tal cual, invocada una sola vez al inicio.
2. **Append incremental** (dentro de `_appendShopBatch()`): en lugar de llamar a `_initPreloadObserver()`, añadir una función nueva y más barata, p. ej. `_observeNewShopCards(newCardsFragmentOrList)`, que simplemente llame `_preloadObserver.observe(card)` sobre **únicamente las tarjetas del lote recién insertado**, sin desconectar nada ni tocar la cola existente. Si `_preloadObserver` no existe todavía (primer lote), sí debe crearse una vez.

### Preservación funcional
- La precarga de imágenes hi-res debe seguir funcionando exactamente igual para el usuario final: las tarjetas que se acercan al viewport siguen precargando su imagen antes de que el usuario abra el preview.
- El guard de `_isDataSaverActive()` / `_isLowBandwidth()` y el scheduler de lotes (`_schedulePreloadItem`, `_flushPreloadQueue`) deben seguir aplicándose igual, ahora sobre un `_preloadObserver` que persiste entre lotes en vez de recrearse.
- El caso de cambio de filtro (`renderShop()` completo) debe seguir limpiando todo correctamente, sin fugas del observer anterior.

### Preservación visual
Ninguna — es un cambio puramente de gestión interna de observers, invisible para el usuario salvo por la mejora esperada de fluidez de scroll.

### Riesgos
- Si no se limpia correctamente el observer al cambiar de filtro (caso 1), podría quedar observando tarjetas que ya no existen en el DOM (nodos huérfanos referenciados) — mitigar asegurando que `renderShop()` sigue llamando a la ruta de reconstrucción completa, no a la incremental.
- Si se observa dos veces la misma tarjeta por error de lógica (p. ej. si un lote se procesa más de una vez), el callback ya tiene protección vía `cardEl.dataset.preloaded`, pero conviene revisar que `observe()` no se llame duplicado sobre el mismo nodo.

### Verificación obligatoria para Codex
1. Leer el flujo completo de `renderShop()` en `js/shop-logic.js` para confirmar los dos puntos de entrada: (a) llamada inicial tras `filterItems()`/`loadCatalog()`, que vacía `container.innerHTML` y llama `_appendShopBatch()` la primera vez, y (b) llamadas subsecuentes desde el callback de `_shopLazyObserver` bajo scroll.
2. Confirmar que `_shopRenderState.cursor` y `_shopRenderState.items` reflejan correctamente qué tarjetas son "nuevas" en cada llamada a `_appendShopBatch()` (el rango `[start, end)` ya calculado en la función es la fuente correcta del lote nuevo).
3. Verificar que `_preloadQueue`, `_preloadFlushId` y `_isDataSaverActive()`/`_isLowBandwidth()` siguen siendo variables/funciones de módulo accesibles sin cambios desde la nueva función incremental.
4. Confirmar que `_teardownShopLazyRender()` (llamado al cambiar de tab o filtro) no depende de que `_initPreloadObserver()` se llame en cada batch — revisar su cuerpo para asegurar independencia.

### Plan de implementación para Codex
1. En `js/shop-logic.js`, extraer de `_initPreloadObserver()` la parte de creación del `IntersectionObserver` (la callback function) para poder reutilizarla sin reconstruir el objeto.
2. Crear una nueva función `_observeNewShopCards(cardEls)` que:
   - Si `_preloadObserver` es `null`, lo crea (usando la misma lógica de callback actual, sin el guard de Data Saver que ya se evaluó en la creación inicial — o revalidándolo, a discreción, pero sin volver a iterar tarjetas ya observadas).
   - Si ya existe, simplemente itera `cardEls` (las tarjetas del `DocumentFragment`/lote recién insertado, no `container.querySelectorAll` completo) y llama `_preloadObserver.observe(card)` para las que tengan `.shop-preview-btn` y no tengan ya `dataset.preloaded`.
3. Modificar `_appendShopBatch()` para que, tras insertar el `frag` en el DOM, en vez de llamar `_initPreloadObserver(container, _shopRenderState.items.slice(0, end))`, capture las tarjetas recién creadas (se puede recolectar en un array durante el propio bucle `for` que construye `frag`, antes de insertarlo) y llame `_observeNewShopCards(nuevasTarjetas)`.
4. Mantener sin cambios la llamada a `_initPreloadObserver()` en el punto de reconstrucción completa (inicio de `renderShop()`), para que el caso de cambio de filtro siga limpiando todo correctamente.
5. Respetar el guard de `_isDataSaverActive()`: si estaba activo en el momento de la reconstrucción inicial, la función incremental no debe crear ni usar el observer en absoluto (mismo comportamiento actual, solo evitando el trabajo redundante).
6. Probar manualmente: cargar Tienda con filtro "Todos" (catálogo grande), hacer scroll continuo hasta el final, y verificar en el panel de Performance de Chrome DevTools que ya no aparecen picos repetidos de "Layout"/"Recalculate Style" asociados a la reconstrucción del observer en cada lote.

### Archivos que NO deben modificarse
No se identifican restricciones adicionales; Codex debe limitar los cambios a `js/shop-logic.js` dentro del alcance de precarga/renderizado incremental del catálogo.

### Criterios de aceptación
- Las imágenes hi-res se siguen precargando correctamente al acercarse el usuario a cada tarjeta durante el scroll.
- El cambio de filtro/búsqueda sigue reconstruyendo el observer desde cero sin fugas.
- El número de veces que se invoca `new IntersectionObserver(...)` para precarga se reduce a como mucho una vez por sesión de vista de catálogo con el mismo filtro (no una vez por lote de scroll).
- No hay regresión en el comportamiento de Data Saver / conexión lenta.

### Validación
- Chrome DevTools Performance panel con CPU throttling (4x–6x) durante un scroll continuo por el catálogo completo, comparando el número y duración de tareas largas ("Long Tasks") antes/después.
- Prueba funcional: abrir preview de una tarjeta recién precargada tras scroll y confirmar que la imagen hi-res aparece instantánea (sin flash de carga), igual que antes del cambio.

### Resultado esperado
El scroll dentro del catálogo de Tienda deja de disparar reconstrucciones completas del sistema de precarga en cada lote, reduciendo directamente el trabajo síncrono del hilo principal durante el gesto de scroll — el escenario explícitamente señalado como "pesado y con lag".

### Notas para Codex
Este es el ticket con mayor relación directa con la queja de scroll pesado en Tienda reportada por el usuario. No reducir la calidad de la precarga (rootMargin, threshold, batching por conexión) — el objetivo es eliminar la reconstrucción redundante, no cambiar la estrategia de precarga en sí.

---

## TICKET-04 — Serialización completa del store (`JSON.stringify`) + escritura síncrona en `localStorage` en cada acción de compra

**Tipo:** JavaScript / Estado
**Prioridad:** Crítica
**Nivel de confianza:** Confirmado (la ejecución del patrón está confirmada; la magnitud exacta del coste requiere profiling)
**Impacto esperado:** Menos bloqueo síncrono del hilo principal exactamente en el momento de tocar "Comprar" — el otro escenario explícitamente señalado como pesado ("acciones dentro de la sección compra").

### Objetivo
Reducir el trabajo síncrono que se ejecuta en la misma tarea de JS que atiende el click de compra, de forma que el feedback visual (actualización de saldo, badge "Obtenido", confetti) se sienta inmediato incluso en CPUs lentas.

### Flujo afectado
Tienda — compra de ítems, canje de código promocional, y en general cualquier acción que llame a `saveState()`.

### Archivos involucrados
- `js/app.js` — `saveState()`, `GameCenter.buyItem()`, `updateUI()`, `checkStorageSize()`, IIFE `SentinelCloudSync` (`_buildSnapshot()`, `_sentinelSync()`).
- `js/shop-logic.js` — `initiatePurchase()` (llamador directo del click de "Canjear").

### Contexto del código
El flujo de un click de compra es: `shop-logic.js: _bindShopContainerDelegation` (click en `.shop-buy-btn`) → `initiatePurchase(item, btn)` → modal de confirmación (async, espera input del usuario) → al confirmar → `GameCenter.buyItem(item)` (síncrono) → dentro de `buyItem`, `saveState({ immediateCloudSync: true })` (síncrono) → dentro de `saveState`:
```js
let payload = JSON.stringify(store);
// ... localStorage.setItem(CONFIG.stateKey, payload) — I/O síncrono ...
updateUI();                       // querySelectorAll + posible animación
_syncCloudIfNeeded(immediateCloudSync); // si hay sesión: sentinel.syncNow() → _sentinelSync() → OTRO _buildSnapshot() + otro JSON.parse/stringify
checkStorageSize(payload.length);
```
Y de vuelta en `initiatePurchase()`, tras el `result.success`, se llama `fireConfetti()` (ver Ticket 07) de forma inmediata, todo en la misma cadena síncrona iniciada por el click.

`store` es un objeto que acumula, con el uso normal de la app: `inventory` (un `{itemId: count}` que crece con cada ítem comprado, potencialmente 100+ claves para un usuario veterano), `progress` (array de niveles completados por juego), `history` (hasta 50 entradas), `redeemedHashes`, `claimed_milestones`, etc. `JSON.stringify(store)` se ejecuta **completo**, sobre **todo el objeto**, en cada mutación — no hay serialización incremental ni diffing.

Si el usuario tiene sesión cloud activa (Sentinel), el mismo click además dispara `_syncCloudIfNeeded(true)` → `sentinel.syncNow()` → `_sentinelSync()`, que hace su **propio** `_buildSnapshot()`: itera `SENTINEL_WATCHED_KEYS` (~19 claves), hace `localStorage.getItem` por cada una, y para la clave principal del hub hace un `JSON.parse` + eliminación del campo `userAvatar` + `JSON.stringify` de nuevo — trabajo de serialización **adicional** encima del ya hecho en `saveState()`, en el mismo tick síncrono (aunque el `upsert` a Supabase en sí es asíncrono/red, la construcción del snapshot que lo precede es síncrona).

### Hallazgo
Un solo tap en "Canjear" en la Tienda desencadena, de forma síncrona y en cascada: (1) mutación de estado, (2) `JSON.stringify` completo del store, (3) escritura de `localStorage` (que en algunos navegadores/WebViews Android puede ser una operación bloqueante notablemente más lenta que en desktop), (4) `updateUI()` con múltiples `querySelectorAll` globales y posible animación por `requestAnimationFrame`, (5) si hay sesión cloud, un **segundo** ciclo de serialización para el snapshot de Sentinel, y (6) el disparo de una animación de canvas (confetti, Ticket 07). Todo esto ocurre en el "camino crítico" percibido por el usuario entre el tap y el feedback visual de "compra completada".

### Evidencia
- **Hecho comprobado:** cuerpo de `saveState()` en `js/app.js` — `JSON.stringify(store)` síncrono, `localStorage.setItem` síncrono, `updateUI()` síncrono, `_syncCloudIfNeeded()` invocado en la misma función.
- **Hecho comprobado:** `GameCenter.buyItem()` llama `saveState({ immediateCloudSync: true })`.
- **Hecho comprobado:** `_sentinelSync()` (dentro de la IIFE `SentinelCloudSync`) llama `_buildSnapshot()`, que hace `JSON.parse`/`JSON.stringify` adicional sobre la clave del hub cuando existe `userAvatar`.
- **Hecho comprobado:** `initiatePurchase()` en `shop-logic.js` llama `fireConfetti()` inmediatamente después de `GameCenter.buyItem(item)` exitoso, en la misma función async del click handler.
- **Inferencia:** el tamaño real de `store` para un usuario típico (y por tanto el coste real de `JSON.stringify`) no puede determinarse sin datos de producción; requiere medición con `console.time` alrededor de `JSON.stringify(store)` en un dispositivo real, o telemetría de tamaño (el propio proyecto ya tiene `checkStorageSize()` y el evento `storage_warning` en Ghost Analytics, lo cual confirma que el equipo ya es consciente de que el store puede crecer significativamente).

### Hipótesis de causa raíz
El modelo de persistencia fue diseñado con `localStorage` + serialización completa como única estrategia, sin diferenciar entre "escritura crítica que debe completarse ya" (saldo de monedas) y "trabajo que puede diferirse un frame" (sincronización cloud, actualización de contadores no visibles en la vista actual).

### Oportunidad de optimización
No se propone cambiar el modelo de persistencia (localStorage sigue siendo apropiado para esta arquitectura sin backend). Se proponen tres mejoras incrementales, todas de bajo riesgo:

1. **Diferir el `updateUI()` un frame:** en vez de llamar `updateUI()` de forma síncrona dentro de `saveState()`, encolarlo con `requestAnimationFrame` cuando la llamada NO requiere feedback inmediato garantizado en el mismo tick (el guardado en `localStorage` ya persistió el dato; la UI puede reflejarlo en el frame siguiente sin que el usuario note diferencia, ya que de todos modos el navegador no pinta hasta el próximo frame).
2. **Diferir la sincronización cloud (`_syncCloudIfNeeded`) fuera del camino crítico del click:** actualmente `immediateCloudSync: true` ya provoca sync inmediato para operaciones de monedas; se propone que ese sync (incluida su propia serialización) se programe con `requestIdleCallback` (con fallback a `setTimeout(fn, 0)`) en lugar de ejecutarse en la misma tarea síncrona que originó la compra, preservando el comportamiento de "sync casi inmediato" (sigue ocurriendo en el mismo ciclo de eventos, solo después de que el navegador haya tenido oportunidad de pintar el frame de feedback visual al usuario).
3. **Evitar el segundo `JSON.stringify` redundante en `_buildSnapshot()`** cuando sea razonablemente posible: actualmente se vuelve a serializar toda la clave del hub solo para eliminar `userAvatar`. Se puede optimizar comprobando primero, con una lectura barata (`raw.includes('"userAvatar"')` sobre el string ya obtenido de `localStorage.getItem`, antes de hacer el `JSON.parse`), si realmente hace falta el ciclo `parse→delete→stringify`, evitándolo cuando `userAvatar` sea `null` (el caso más común, ya que la mayoría de las cuentan no suben avatar Base64 al string local — muchas usan avatar cloud vía URL, que sí se conserva).

### Preservación funcional
- El saldo de monedas y el inventario deben seguir persistiéndose de forma fiable e inmediata en `localStorage` (esto NO se difiere; solo se difiere la actualización visual del DOM y la sincronización cloud).
- La sincronización con Supabase debe seguir ocurriendo con la misma prioridad relativa (alta prioridad / debounce corto) que tiene actualmente para claves críticas — solo cambia el "cuándo" dentro del mismo ciclo de evento, no el "si" ni el "con qué prioridad relativa entre claves".
- El comportamiento de `emergencyCleanup()` ante `QuotaExceededError` no debe alterarse.
- La detección de `storage_warning`/`storage_cleaned` debe seguir funcionando igual.

### Preservación visual
Ninguna alteración visual: el usuario debe seguir viendo el mismo toast, el mismo confetti, el mismo cambio de saldo y el mismo badge "Obtenido" — solo se reordena en qué frame exacto ocurre parte del trabajo interno, de forma imperceptible (diferir por un `requestAnimationFrame` es, como máximo, ~16ms, muy por debajo del umbral de percepción humana).

### Riesgos
- Si el usuario cierra la pestaña o navega fuera inmediatamente después de comprar, un `updateUI()` diferido por rAF podría no llegar a ejecutarse en un caso extremadamente raro (aunque el guardado en `localStorage` ya habría ocurrido de forma síncrona, por lo que no hay pérdida de datos, solo un posible frame donde el HUD muestre el valor viejo hasta la próxima interacción). Mitigar asegurando que `updateUI()` también se ejecuta en los hooks existentes de `visibilitychange`/`pageshow` que ya tiene el proyecto.
- Diferir `_syncCloudIfNeeded` con `requestIdleCallback` podría retrasar el sync si el hilo principal está muy ocupado (justamente el escenario de gama baja); usar un `timeout` en las opciones de `requestIdleCallback` (p. ej. 200ms, siguiendo el mismo patrón que ya usa el proyecto en `_schedulePreloadFlush`) para garantizar que no se retrase indefinidamente.
- Cambiar el orden interno de `_buildSnapshot()` para evitar el `JSON.parse` innecesario debe preservar exactamente el mismo resultado final (snapshot sin `userAvatar`) — cualquier error aquí podría filtrar un avatar Base64 grande al payload de Supabase, lo cual sería una regresión de comportamiento real, no solo de rendimiento. Este sub-cambio requiere test explícito.

### Verificación obligatoria para Codex
1. Localizar TODAS las llamadas a `saveState()` en `js/app.js` (buscar `saveState(`) y clasificar cuáles pasan `immediateCloudSync: true` vs. `false`/omitido, para entender qué operaciones son consideradas "críticas" actualmente por el propio equipo.
2. Revisar el cuerpo completo de `_syncCloudIfNeeded()` y `_scheduleImmediateCloudRetry()` para entender la lógica de reintento existente antes de insertar un diferimiento adicional — no debe interferir con `_pendingSyncRetries`/`MAX_SYNC_RETRIES`.
3. Revisar `window.addEventListener('pagehide', ...)`, `beforeunload` y `visibilitychange` dentro de la IIFE `SentinelCloudSync` — estos ya fuerzan un sync inmediato al salir de la pestaña si `_hasUnsyncedChanges` es `true`, lo cual es la red de seguridad que hace seguro diferir el sync normal.
4. Confirmar en `_buildSnapshot()` el formato exacto en el que se guarda la clave del hub (`CONFIG.stateKey` / `'gamecenter_v6_promos'`) para diseñar correctamente el check barato de `userAvatar` antes del parse.

### Plan de implementación para Codex
1. En `js/app.js → saveState()`, extraer la llamada a `updateUI()` fuera del cuerpo síncrono y envolverla en `requestAnimationFrame(() => updateUI())`, salvo que ya exista una animación de contador en curso que dependa de sincronía estricta — revisar `animateValue`/`_displayedCoins` para confirmar que no se rompe su lógica de "delta" al diferir un frame (no debería, ya que compara contra `store.coins`, que ya está actualizado de forma síncrona en memoria antes de esta llamada).
2. En la misma función, envolver la llamada a `_syncCloudIfNeeded(immediateCloudSync)` en `requestIdleCallback(() => _syncCloudIfNeeded(immediateCloudSync), { timeout: 200 })` con fallback a `setTimeout(..., 0)` si `requestIdleCallback` no existe (seguir el patrón ya usado en `_schedulePreloadFlush` de `shop-logic.js` como referencia de estilo).
3. En `_buildSnapshot()` (dentro de la IIFE `SentinelCloudSync`), antes de hacer `JSON.parse(val)` para la clave del hub, comprobar con `val.indexOf('"userAvatar"') !== -1` (o similar chequeo de substring) si vale la pena entrar al bloque de parse/delete/stringify; si el string no contiene esa clave o la contiene como `null`, usar `val` directamente sin re-serializar.
4. NO modificar la lógica de debounce por prioridad (`HIGH_PRIORITY_DEBOUNCE_MS`, `PASSIVE_PRIORITY_DEBOUNCE_MS`) — este ticket es ortogonal a esa lógica.
5. Probar manualmente: comprar un ítem con sesión cloud activa y sin ella, confirmar que el saldo se actualiza visualmente sin demora perceptible, que el badge "Obtenido" aparece correctamente, y que (con sesión activa) el registro en Supabase sigue completándose poco después.
6. Revisar que no queda código muerto: si se introduce una nueva función auxiliar para el check de `userAvatar`, debe reemplazar completamente el bloque `try { JSON.parse... } catch` actual, no coexistir con él.

### Archivos que NO deben modificarse
`js/shop-logic.js` no requiere cambios para este ticket salvo verificación de que el flujo de `initiatePurchase()` sigue funcionando igual; no debe tocarse su lógica de UI/confetti (eso corresponde al Ticket 07).

### Criterios de aceptación
- El saldo mostrado tras una compra sigue siendo correcto y se refleja visualmente sin demora perceptible para el usuario.
- La persistencia en `localStorage` sigue siendo síncrona e inmediata (no se difiere el `setItem` en sí, solo el trabajo de UI/cloud posterior).
- La sincronización cloud sigue completándose de forma confiable, incluyendo en los casos de salida abrupta de la pestaña (cubierto por los listeners existentes de `pagehide`/`beforeunload`).
- No se introduce ningún avatar Base64 filtrado accidentalmente al payload de Supabase.

### Validación
- Medición manual con `performance.now()` alrededor de la cadena `buyItem → saveState` antes/después del cambio, en Chrome DevTools con CPU throttling.
- Prueba funcional de compra con y sin sesión cloud.
- Prueba de cierre de pestaña inmediatamente tras una compra, confirmando que el sync cloud igualmente se completa (verificar en Supabase o vía `window.Sentinel.getStatus()`).

### Resultado esperado
El tap de "Canjear"/"Comprar" sigue teniendo el mismo resultado funcional y visual, pero el trabajo no esencial para el frame inmediato (actualización de UI no crítica, sincronización cloud, serialización redundante) se reparte en frames/ticks posteriores en vez de bloquear todo junto en la misma tarea síncrona del click.

### Notas para Codex
Este ticket NO propone cambiar `localStorage` por IndexedDB ni ningún otro mecanismo de almacenamiento — eso sería un cambio arquitectónico de mucho mayor riesgo y está fuera de alcance. El objetivo es exclusivamente reordenar/diferir trabajo no crítico dentro del ciclo de eventos existente.

---

## TICKET-05 — La animación del contador de monedas escribe en el DOM de vistas ocultas en cada frame

**Tipo:** Renderizado / JavaScript
**Prioridad:** Media
**Nivel de confianza:** Confirmado
**Impacto esperado:** Menos escrituras DOM innecesarias durante la animación de saldo (hasta ~650ms, ~60 escrituras) en cada compra o transacción de monedas.

### Objetivo
Que `animateValue()` solo actualice `textContent` de los elementos `.coin-display` que pertenecen a la vista actualmente visible, no también los de vistas ocultas (`display:none`).

### Flujo afectado
Tienda (compra, canje de código) y, en general, cualquier transacción de monedas mientras el usuario está en cualquier vista.

### Archivos involucrados
- `js/app.js` — `updateUI()`, `animateValue()`.

### Contexto del código
`updateUI()` selecciona:
```js
const navbarDisplays = Array.from(document.querySelectorAll('.navbar .coin-display'));
const otherDisplays  = Array.from(document.querySelectorAll('.coin-display:not(.navbar .coin-display)'));
```
Como `#view-home`, `#view-shop` y `#view-profile` **coexisten siempre en el DOM** (Ticket 00/arquitectura), `otherDisplays` incluye el `.coin-display` del HUD de Inicio (`.hud-balance-amount .coin-display`) **incluso cuando el usuario está en Tienda y `#view-home` tiene `display:none`**. Cuando hay delta de saldo, `animateValue()` ejecuta un bucle de `requestAnimationFrame` durante ~650ms escribiendo `el.textContent` en **todos** los elementos de `otherDisplays` en cada frame (~39 frames a 60fps), incluidos los que están dentro de un contenedor oculto.

### Hallazgo
Escribir `textContent` en un nodo dentro de `display:none` no dispara layout/paint (el navegador lo sabe y omite el trabajo de renderizado), pero sí implica: (a) el coste de JS de iterar el array y hacer la asignación en cada uno de los ~39 frames, y (b) mantener una referencia/array más grande de lo necesario, incluyendo query matching contra el selector `:not()` sobre el documento completo. Es trabajo puramente desperdiciado — el usuario nunca ve ese nodo hasta que vuelva a Inicio, momento en el que `syncUI()` ya se encarga de refrescarlo desde cero de todos modos (`_displayedCoins = store.coins; updateUI();` en cada `_applyView`).

### Evidencia
- **Hecho comprobado:** selector `'.coin-display:not(.navbar .coin-display)'` no filtra por visibilidad/vista activa.
- **Hecho comprobado:** `index.html` confirma que `.hud-balance-amount .coin-display` (Inicio) y `#view-shop`/`#view-profile` equivalentes coexisten simultáneamente en el DOM.
- **Hecho comprobado:** `GameCenter.syncUI()` ya resetea `_displayedCoins` y vuelve a llamar `updateUI()` en cada cambio de vista (`spa-router.js`), lo que confirma que el valor se re-sincroniza igualmente al volver a Inicio, sin depender de que la animación haya corrido mientras estaba oculto.
- **Inferencia:** el coste exacto en tiempo de CPU de estas escrituras redundantes es pequeño en términos absolutos por frame, pero se repite en cada transacción de monedas.

### Hipótesis de causa raíz
El selector de `updateUI()` fue escrito para cubrir "todos los lugares donde se muestra el saldo" sin distinguir cuáles están actualmente visibles, probablemente porque en el momento de su diseño no se consideró el coste acumulado en vistas ocultas.

### Oportunidad de optimización
Filtrar `otherDisplays` para excluir los nodos que estén dentro de un `.view-section.hidden` (o, más simple y barato, filtrar por `offsetParent !== null` como proxy rápido de "visible", que es una comprobación nativa del navegador sin necesidad de recorrer el DOM buscando el ancestro oculto — aunque `offsetParent` fuerza un cálculo de layout, por lo que es preferible comprobar directamente si el contenedor de vista relevante tiene la clase `.hidden`).

### Preservación funcional
- El valor final tras la animación debe seguir siendo exactamente correcto en TODAS las vistas — este cambio no debe hacer que Inicio muestre un saldo desactualizado al volver a él. Esto ya está garantizado porque `syncUI()` re-sincroniza sin animación (delta 0 tras el reset) cada vez que se entra a una vista.
- La vista de Perfil, si también muestra saldo en algún lugar, debe seguir el mismo tratamiento.

### Preservación visual
Ninguna — el usuario nunca ve el contenido de una vista oculta, por definición.

### Riesgos
- Si la comprobación de "vista visible" se implementa mal (p. ej., comprobando la clase `.hidden` en el elemento equivocado), podría dejar de animar el contador en la vista que SÍ está activa. Mitigar con una prueba explícita en cada una de las tres vistas.
- Bajo riesgo general dado que es un cambio acotado y de bajo impacto funcional.

### Verificación obligatoria para Codex
1. Confirmar en `index.html` cuáles son todos los elementos `.coin-display` existentes y a qué contenedor de vista (`#view-home`, `#view-shop`, `#view-profile`, `.navbar`) pertenece cada uno.
2. Revisar `spa-router.js` para confirmar que la clase que indica "vista oculta" es siempre `.hidden` en el contenedor raíz de cada vista (`#view-home`, `#view-shop`, `#view-profith`), y no en un ancestro intermedio distinto.
3. Confirmar que `_displayedCoins` y el reset en `syncUI()` siguen garantizando corrección del valor al cambiar de vista, para no depender de que la animación haya corrido en segundo plano.

### Plan de implementación para Codex
1. En `js/app.js → updateUI()`, al construir `otherDisplays`, filtrar usando `.closest('.view-section')` y comprobando que ese ancestro no tenga la clase `.hidden` (o, alternativamente, comprobar `el.closest('.hidden') === null`, más simple y genérico).
2. Aplicar el mismo filtro también a `navbarDisplays` si corresponde (la navbar siempre es visible en todas las vistas, así que probablemente no requiera cambio, pero confirmarlo).
3. Verificar que `animateValue()` en sí no necesita cambios — el filtrado ocurre antes, en la construcción de la lista de elementos que se le pasa.
4. Probar: comprar un ítem en Tienda, observar la animación del contador en el HUD de Tienda; navegar a Inicio y confirmar que el HUD de Inicio muestra el valor final correcto sin ningún salto raro.

### Archivos que NO deben modificarse
No se identifican restricciones adicionales.

### Criterios de aceptación
- El contador de monedas anima correctamente en la vista activa tras cualquier transacción.
- Al navegar a una vista distinta después de una transacción, el saldo mostrado es siempre el correcto y actualizado (sin animación residual ni valores obsoletos).
- Se reduce el número de nodos DOM tocados por frame durante la animación cuando el usuario está en una sola vista.

### Validación
- Prueba manual: comprar en Tienda, verificar animación; canjear código en Tienda, verificar animación; reclamar bono diario en Inicio, verificar animación; en cada caso, navegar a la otra vista y confirmar consistencia del valor mostrado.

### Resultado esperado
La animación de saldo deja de tocar nodos DOM de vistas no visibles, sin cambiar en absoluto el resultado final percibido por el usuario en ninguna vista.

### Notas para Codex
Cambio pequeño y de bajo riesgo; puede implementarse y validarse de forma independiente al resto de tickets.

---

## TICKET-06 — Animaciones decorativas continuas con `will-change` permanente en el HUD de Inicio

**Tipo:** Animación
**Prioridad:** Media
**Nivel de confianza:** Alta probabilidad (el código está confirmado; el impacto relativo en el dispositivo objetivo requiere validación)
**Impacto esperado:** Menor trabajo continuo de compositor mientras el usuario permanece en Inicio, liberando margen de CPU/GPU justo antes de que el usuario probablemente navegue a Tienda.

### Objetivo
Reducir el coste de mantener animaciones CSS decorativas corriendo indefinidamente (18s de bucle) con capas de composición promovidas de forma permanente mientras el HUD de Inicio está visible.

### Flujo afectado
Inicio (y, por extensión, el margen de recursos disponible justo antes de una transición a Tienda).

### Archivos involucrados
- `styles.css` — reglas `.player-hud::before` (`hudAmbientSweep`, 18s, `will-change: transform, opacity`, activado por `.player-hud.is-ready`) y `.hud-avatar-ring` (`powerRingRotate`, 3s, `will-change: transform`, activado también por `.is-ready`).

### Contexto del código
Ambas animaciones están diseñadas como detalles decorativos "always-on" mientras el HUD está listo (`.is-ready`, aplicado por `revealUI()` en `app.js` tras el init síncrono, y que permanece aplicado durante toda la sesión en Inicio). `prefers-reduced-motion` ya las desactiva, pero por defecto están siempre activas para el resto de usuarios.

### Hallazgo
`.player-hud::before` cubre aproximadamente el tamaño completo del HUD (un elemento grande en la parte superior de Inicio) y anima `transform`/`opacity` en bucle infinito con `will-change` fijo. Es compositor-only (correcto, no fuerza layout/paint por sí sola), pero mantiene una capa GPU adicional viva de forma indefinida mientras el usuario esté en Inicio — que es precisamente el punto de partida de la transición prioritaria a Tienda. En un dispositivo con memoria de composición muy limitada, sumar esta capa a las ya comentadas en el Ticket 01 (contenedor de vista completo) incrementa la presión total sobre el compositor justo antes de que ocurra la transición que se quiere optimizar.

### Evidencia
- **Hecho comprobado:** definiciones CSS de `.player-hud::before`, `@keyframes hudAmbientSweep`, `.hud-avatar-ring`, `@keyframes powerRingRotate` en `styles.css`.
- **Hecho comprobado:** ambas animaciones se desactivan solo bajo `prefers-reduced-motion: reduce` (no hay pausa por `document.hidden`/tab en background, aunque los navegadores modernos suelen limitar el refresco de animaciones CSS en pestañas en segundo plano por su cuenta — este es un mecanismo del navegador, no del código, y no puede confirmarse su comportamiento exacto sin pruebas).
- **Inferencia:** el impacto relativo de estas dos animaciones frente al resto de la carga de la página no puede cuantificarse sin profiling; se marca como Alta Probabilidad, no Confirmado, porque son animaciones pequeñas/medianas ya diseñadas siguiendo buenas prácticas (compositor-only), y el verdadero problema puede ser más la acumulación de capas (Ticket 01) que estas animaciones en sí mismas.

### Hipótesis de causa raíz
Decisión de diseño estética (parte de la identidad visual "Arcade Solid") sin una revisión posterior específica de su coste acumulado en gama baja, similar al caso del Ticket 01.

### Oportunidad de optimización
**No se recomienda eliminar estas animaciones** (afectarían la identidad visual, prohibido por las reglas de esta auditoría). En su lugar:
1. Confirmar mediante profiling en un dispositivo real de gama baja (o emulación con throttling agresivo) si estas animaciones realmente contribuyen de forma medible al jank general en Inicio antes de tocar nada — este ticket se marca explícitamente como necesitado de validación adicional antes de implementación.
2. Si se confirma impacto: considerar pausar la animación (`animation-play-state: paused`) cuando el HUD lleve un tiempo fuera del viewport (si en el futuro Inicio tuviera scroll y el HUD pudiera salir de vista) o cuando `document.visibilityState !== 'visible'`, usando el listener de `visibilitychange` que el proyecto ya usa extensivamente en otros módulos (`analytics.js`, `push-notifications.js`), añadiendo/quitando una clase que fije `animation-play-state: paused`.

### Preservación funcional
Ninguna funcionalidad de negocio implicada; es puramente decorativo.

### Preservación visual
**Excepción explícita a señalar:** si se decide pausar la animación en background de pestaña, el usuario no lo notará (la pestaña no es visible). Si en el futuro se considerara pausar tras cierto tiempo de inactividad en primer plano, eso SÍ sería un cambio visual perceptible y debe evitarse — este ticket NO propone eso.

### Riesgos
- Bajo, dado que es un cambio opcional y reversible (clase CSS adicional).
- Riesgo de sobre-ingeniería si se implementa sin confirmar primero que aporta beneficio medible — por eso se marca prioridad Media y se pide validación previa.

### Verificación obligatoria para Codex
1. **No implementar cambios de código todavía.** Antes de cualquier cambio, ejecutar profiling con Chrome DevTools (Performance panel, CPU throttling 4x-6x) sobre la vista de Inicio en reposo durante 10-15 segundos, y registrar si `hudAmbientSweep`/`powerRingRotate` aparecen como consumidores relevantes de tiempo de compositor.
2. Si el profiling confirma impacto medible, proceder con el plan de implementación de abajo; si no, dejar este ticket en estado "no implementado, sin evidencia suficiente" y documentarlo.

### Plan de implementación para Codex (condicionado a validación previa)
1. Añadir un listener `visibilitychange` en el módulo apropiado (o reutilizar uno existente) que añada la clase `.motion-paused` a `.player-hud` cuando `document.hidden === true`, y la retire cuando vuelva a `false`.
2. En `styles.css`, añadir `.player-hud.motion-paused::before, .player-hud.motion-paused .hud-avatar-ring { animation-play-state: paused; }`.
3. No modificar la lógica de `prefers-reduced-motion` existente, que debe seguir teniendo prioridad.
4. Verificar que la animación se reanuda correctamente al volver a la pestaña, sin saltos visuales bruscos.

### Archivos que NO deben modificarse
Ninguna restricción adicional más allá de no tocar la lógica de `prefers-reduced-motion` ya existente.

### Criterios de aceptación
- Sin cambio visual perceptible mientras la pestaña está en primer plano.
- Si se implementa el pausado en background, las animaciones se detienen mientras la pestaña no es visible y se reanudan correctamente al volver.

### Validación
- Profiling antes/después en Chrome DevTools.
- Prueba manual de cambio de pestaña/vuelta.

### Resultado esperado
Si el profiling confirma impacto: menor consumo de recursos de compositor mientras la app está en segundo plano, sin ningún cambio visible para el usuario activo.

### Notas para Codex
Este ticket es explícitamente **condicional**: no proceder con la implementación sin antes confirmar mediante herramientas de profiling que existe un impacto real. Se incluye en la auditoría por su alta probabilidad estructural, no como instrucción incondicional.

---

## TICKET-07 — `canvas-confetti` se dispara de forma incondicional en cada compra y canje exitoso

**Tipo:** Animación / JavaScript
**Prioridad:** Alta
**Nivel de confianza:** Alta probabilidad
**Impacto esperado:** Menos trabajo de animación por canvas (simulación de partículas vía `requestAnimationFrame`) exactamente en el momento posterior a una compra — otro punto directamente señalado como "pesado" en Tienda.

### Objetivo
Que el efecto de confeti seguido siga apareciendo tras una compra/canje exitoso, pero sin competir por el hilo principal en el mismo instante en que se están actualizando saldo, badges e inventario.

### Flujo afectado
Tienda (compra exitosa, canje de código promocional exitoso).

### Archivos involucrados
- `js/shop-logic.js` — `fireConfetti()`, `_getConfetti()`, y sus llamadas dentro de `initiatePurchase()` y `handleRedeem()`.

### Contexto del código
Tras una compra exitosa, `initiatePurchase()` llama `fireConfetti()` de inmediato (justo después de actualizar displays de saldo). `fireConfetti()` comprueba `document.hidden` y la vista activa, y si procede, carga (o reutiliza) la librería `canvas-confetti` vía CDN y dispara dos ráfagas de 55 partículas cada una (110 partículas totales) con ángulos y colores. `handleRedeem()` hace lo mismo con 80 partículas en una sola ráfaga tras un canje de código exitoso.

### Hallazgo
`canvas-confetti` anima cada partícula con física (gravedad, rotación, desvanecimiento) usando su propio bucle de `requestAnimationFrame` sobre un `<canvas>` a pantalla completa, típicamente durante 2-3 segundos. Esto ocurre **inmediatamente después** de la cascada de trabajo síncrono descrita en el Ticket 04 (serialización + escritura + actualización de UI), por lo que el usuario experimenta el "coste total" de la compra como una sola unidad percibida: el momento en que más carga de CPU/GPU se concentra en la app es exactamente el momento en que el usuario espera la respuesta más inmediata (feedback de compra exitosa). En un GPU de gama baja, la superposición de una animación de partículas de canvas a pantalla completa con el trabajo de layout/paint de las tarjetas y badges actualizados es un candidato razonable a jank visible, aunque no puede cuantificarse sin profiling específico del dispositivo.

### Evidencia
- **Hecho comprobado:** código de `fireConfetti()` y sus dos llamadas (`confettiFn({particleCount:55, ...})` × 2) en `initiatePurchase()`.
- **Hecho comprobado:** `handleRedeem()` llama `confettiFn({particleCount:80, spread:100, ...})`.
- **Hecho comprobado:** ambas llamadas ocurren de forma incondicional en el camino de éxito, sin ningún control de frecuencia o gama de dispositivo.
- **Inferencia:** el coste relativo de canvas-confetti en un Galaxy J8 concreto no está medido; es una inferencia razonable basada en que es una animación de canvas con física por partícula, una categoría de trabajo conocida por ser sensible a la potencia de GPU/CPU disponible.

### Hipótesis de causa raíz
El efecto de confeti fue añadido como mejora de UX/deleite sin una consideración específica de coste en gama baja, y se dispara siempre en el mismo tick que el resto del trabajo de actualización de estado tras la compra.

### Oportunidad de optimización
No eliminar el confeti (es una decisión de producto/deleite explícita y visible; eliminarlo sin autorización violaría la regla de preservación visual/funcional de esta auditoría). En su lugar:
1. **Diferir el disparo del confeti un frame** respecto al resto de la actualización de UI (`requestAnimationFrame`), de forma que el navegador primero pinte el resultado "serio" de la compra (saldo, badge) y solo después arranque la animación decorativa, evitando que ambas cosas compitan en la misma tarea.
2. **Reducir el número de partículas específicamente en dispositivos de gama baja**, usando una heurística ya barata de obtener sin necesidad de "device detection" frágil: `navigator.hardwareConcurrency` (si está disponible y es bajo, p. ej. ≤4) o la señal de `navigator.connection.saveData`/`effectiveType` que el propio proyecto ya usa en otros lugares (`_isLowBandwidth()`, `_isDataSaverActive()` en `shop-logic.js`) como proxy razonable de "dispositivo/conexión modesta". Esto es una reducción de **cantidad** de partículas, no una eliminación del efecto — el usuario sigue viendo confeti, solo con menos partículas simultáneas.

### Preservación funcional
El efecto de confeti debe seguir apareciendo en cada compra/canje exitoso; solo cambia el momento exacto (diferido un frame) y, opcionalmente, la cantidad de partículas en dispositivos detectados como modestos.

### Preservación visual
**Excepción explícita a señalar:** la propuesta de reducir el número de partículas en dispositivos de gama baja es un cambio visual sutil (menos partículas visibles simultáneamente) — se declara explícitamente aquí como excepción a la regla de preservación visual estricta, justificado porque el efecto en sí (confeti apareciendo tras la compra) se mantiene intacto y reconocible, y la alternativa (mantener el mismo volumen de partículas en un dispositivo que no puede animarlas con fluidez) resulta en una experiencia visualmente peor (partículas saltando frames) que una versión más ligera pero fluida. Si el equipo prefiere no aceptar esta excepción, la parte 1 (diferir un frame) puede implementarse de forma aislada sin tocar el número de partículas.

### Riesgos
- Diferir el disparo un frame es de bajo riesgo (imperceptible).
- Reducir partículas por heurística de dispositivo podría no detectar correctamente todos los dispositivos de gama baja (heurística imperfecta por naturaleza) — mitigar dejando el conteo reducido solo como "menos", nunca "cero", y asegurando que el criterio de detección no cambie el comportamiento en dispositivos de gama media/alta.

### Verificación obligatoria para Codex
1. Confirmar el cuerpo actual de `_getConfetti()` y `fireConfetti()` en `js/shop-logic.js`, incluyendo el guard existente de `document.hidden` y vista activa, para no duplicar lógica.
2. Revisar si el proyecto ya usa `navigator.hardwareConcurrency` o `navigator.connection` en algún otro punto (confirmado: sí, en `_isDataSaverActive()`/`_isLowBandwidth()`) para mantener consistencia de estilo/naming.
3. Confirmar las dos llamadas exactas a `confettiFn(...)` en `initiatePurchase()` y la llamada en `handleRedeem()` para aplicar el mismo tratamiento a ambas sin duplicar código (considerar centralizar en `fireConfetti()` un parámetro opcional de intensidad, ya que `handleRedeem()` llama `confettiFn` directamente en vez de a través de `fireConfetti()` — revisar por qué y si conviene unificar).

### Plan de implementación para Codex
1. En `initiatePurchase()`, envolver la llamada a `fireConfetti()` en `requestAnimationFrame(() => fireConfetti())`.
2. En `handleRedeem()`, aplicar el mismo diferimiento a su llamada de confeti (actualmente inline vía `_getConfetti()` + `confettiFn(...)`, no vía `fireConfetti()` — evaluar si conviene que `handleRedeem()` también use `fireConfetti()` con un parámetro de partículas distinto, para no duplicar la lógica de guards de `document.hidden`/vista activa entre ambos sitios).
3. Añadir un helper barato, p. ej. `_isModestDevice()`, que devuelva `true` si `navigator.hardwareConcurrency` existe y es `<= 4`, o si `_isLowBandwidth()`/`_isDataSaverActive()` (ya existentes) devuelven `true`.
4. En `fireConfetti()`, ajustar `particleCount` (p. ej. de 55 a un valor menor como 30, y de 80 a 45) cuando `_isModestDevice()` sea `true`, manteniendo el resto de parámetros (ángulo, spread, colores) intactos.
5. Confirmar que no queda código duplicado entre el disparo de confeti de `initiatePurchase()` y `handleRedeem()` tras la unificación — si se centraliza en `fireConfetti()`, eliminar el bloque de disparo directo de `confettiFn` en `handleRedeem()` que quede obsoleto.
6. Probar visualmente en desktop y, si es posible, en un dispositivo Android de gama media/baja disponible, que el efecto se sigue viendo como una celebración clara tras la compra.

### Archivos que NO deben modificarse
No se identifican restricciones adicionales.

### Criterios de aceptación
- El confeti sigue apareciendo tras cada compra y canje exitoso.
- No aparece código duplicado de disparo de confeti entre `initiatePurchase()` y `handleRedeem()`.
- En dispositivos de gama baja/conexión lenta (según la heurística implementada), el número de partículas se reduce sin eliminar el efecto.
- El disparo del confeti ya no ocurre en la misma tarea síncrona que la actualización de saldo/badges.

### Validación
- Prueba visual manual en varios navegadores/dispositivos disponibles.
- Revisión de que `_isModestDevice()` no afecta el comportamiento en un dispositivo de escritorio normal (debe seguir viendo el conteo completo de partículas).

### Resultado esperado
El feedback "serio" de la compra (saldo, badge) se pinta primero; el efecto decorativo de confeti se dispara inmediatamente después sin competir por el mismo frame, y se adapta en intensidad a la capacidad del dispositivo sin desaparecer.

### Notas para Codex
La reducción de partículas es la única parte de este ticket con una excepción visual explícita — si existe cualquier objeción de producto a ese cambio, implementar únicamente el diferimiento por `requestAnimationFrame` (parte 1), que no tiene ningún impacto visual.

---

## TICKET-08 — El bootstrap de Sentinel Cloud Sync (carga del SDK de Supabase + fetch de configuración) arranca de forma incondicional en cada carga de página, incluyendo la primera visita a Inicio

**Tipo:** Red / JavaScript / Arquitectura
**Prioridad:** Media
**Nivel de confianza:** Alta probabilidad
**Impacto esperado:** Menos contención de red/CPU durante la carga inicial de Inicio, liberando el hilo principal antes para que la primera transición a Tienda no compita con trabajo de inicialización en curso.

### Objetivo
Que la inicialización de Sentinel (carga del SDK externo de Supabase, fetch de `/api/client-config`, creación del cliente, `getSession()`) no compita por red/CPU con el renderizado crítico inicial de la página, sin cambiar el resultado final (login restaurado, sincronización activa).

### Flujo afectado
Inicio (carga inicial de página) — impacto indirecto sobre la fluidez de cualquier interacción temprana, incluyendo una eventual navegación rápida a Tienda.

### Archivos involucrados
- `js/app.js` — IIFE `SentinelCloudSync`, función `_bootSentinel()`.
- `js/supabase-loader.js` — carga del SDK de Supabase desde CDN (`initSupabaseSdkLoader`).
- `index.html` — orden de `<script>`: `analytics.js`, `supabase-loader.js`, `milestones-config.js`, `lifecycle-scheduler.js`, `app.js`, ...

### Contexto del código
`js/supabase-loader.js` empieza a cargar el SDK de Supabase (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/...` con fallback a `unpkg.com`) tan pronto se ejecuta el script, de forma completamente independiente de si el usuario navegará alguna vez a la sección de sincronización cloud. `app.js`, al final de su propio archivo, ejecuta `_bootSentinel()` inmediatamente (no en `DOMContentLoaded`, sino como parte de la ejecución síncrona del script), que espera (`await`) a que el SDK esté disponible, y luego hace `fetch('/api/client-config')`, crea el cliente Supabase, y llama `getSession()` — todo esto mientras la página todavía se está construyendo (el script `app.js` corre antes de `shop-logic.js` y `spa-router.js`, y su ejecución síncrona incluye el bloque "INIT SÍNCRONO — v9.3 Zero-Flicker Initiative" que es crítico para el primer pintado sin parpadeo).

### Hallazgo
Aunque `_bootSentinel()` en sí es `async` y no bloquea directamente el hilo principal durante sus `await`, sí consume: (a) una conexión de red hacia un CDN externo para el SDK, compitiendo por ancho de banda con los assets críticos de la página (fuentes, primeras imágenes de portada con `fetchpriority="high"`), y (b) tiempo de CPU en el parseo/ejecución del SDK de Supabase (una librería no trivial) tan pronto llega, en un momento donde el hilo principal probablemente todavía está ocupado con el resto del trabajo síncrono de `app.js`/`shop-logic.js`. Para un usuario que nunca usa la sincronización cloud (modo invitado ya no existe según v14.x, pero incluso con Gatekeeper, el fetch de configuración y la carga del SDK ocurren antes de cualquier interacción de login), este es trabajo de red/CPU que se realiza siempre, de forma no diferida, compitiendo con el camino crítico de la primera pantalla.

### Evidencia
- **Hecho comprobado:** `js/supabase-loader.js` inicia la carga del `<script>` del SDK de forma inmediata al ejecutarse el módulo (IIFE autoejecutada).
- **Hecho comprobado:** `_bootSentinel()` se invoca al final de `js/app.js`, fuera de cualquier `DOMContentLoaded` o `requestIdleCallback`, como parte del flujo normal de carga del script.
- **Hecho comprobado:** el propio `index.html` documenta el orden de carga y el propósito ("supabase-loader.js expone bootstrap compartido para garantizar `createClient` antes de `_sentinelInit()`"), confirmando que es una dependencia intencional pero temprana.
- **Hecho comprobado:** el Gatekeeper (`cloud-gatekeeper-modal`) se abre automáticamente si no hay sesión ni identidad local (`DOMContentLoaded` handler dentro de la IIFE), lo cual confirma que **todo usuario nuevo** pasa por este flujo de red al cargar la página por primera vez, no solo quienes ya tienen sesión.
- **Inferencia:** el impacto real en tiempo hasta interactividad no puede medirse sin herramientas de red/profiling (Lighthouse, WebPageTest, o el propio panel de Network de DevTools con throttling 3G/4G, que es razonable usar como proxy de la conexión típica de un usuario de Galaxy J8).

### Hipótesis de causa raíz
El diseño prioriza la disponibilidad temprana de la sesión cloud (para poder restaurar el estado del usuario cuanto antes) sobre el coste de red/CPU que eso implica durante la carga inicial, sin una estrategia de diferimiento basada en idle time.

### Oportunidad de optimización
1. Diferir el inicio de `_bootSentinel()` (no su lógica interna, solo el momento de arranque) usando `requestIdleCallback` con un `timeout` razonable (p. ej. 1500-2000ms) en vez de ejecutarlo inmediatamente al final de la carga síncrona de `app.js`. Esto le da prioridad al primer pintado y a la posible primera interacción del usuario (incluida una navegación rápida a Tienda) sobre el trabajo de red de Sentinel, sin eliminar la funcionalidad — Sentinel simplemente arranca unos cientos de milisegundos más tarde, lo cual es imperceptible para el flujo de login (que de todas formas requiere interacción explícita del usuario vía el modal Gatekeeper, dándole tiempo de sobra).
2. Aplicar el mismo diferimiento a `js/supabase-loader.js`, o at least usar `<link rel="preload">`/`fetchpriority="low"` en la etiqueta `<script>` que carga el SDK externo, para que el navegador la priorice por debajo de los assets visuales críticos ya marcados con `fetchpriority="high"` en `index.html`.

### Preservación funcional
- El login/registro cloud, la restauración de sesión y la sincronización deben seguir funcionando exactamente igual, solo arrancando un poco más tarde en el ciclo de carga.
- El Gatekeeper debe seguir abriéndose correctamente para usuarios sin identidad ni sesión — si se difiere demasiado el boot de Sentinel, verificar que el Gatekeeper no dependa de que `_sbClient` ya exista para decidir si abrirse (revisar la condición actual: se abre basándose en `hasLocalIdentity`/`_sbSession`, no directamente en si Sentinel ya inicializó, así que debería ser seguro).
- El comportamiento de fallback quando el SDK no carga (mensajes de warning en consola, modo degradado) debe preservarse intacto.

### Preservación visual
Ninguna — el Gatekeeper y el resto de la UI no dependen visualmente de la velocidad de Sentinel; en el peor caso, si el usuario abre el modal de login antes de que Sentinel termine de inicializar, el propio código ya maneja ese caso (mensajes de error controlados como "Servicio no disponible. Recarga la página." en el submit handler).

### Riesgos
- Si se difiere demasiado (timeout muy alto), un usuario que abre el Gatekeeper e intenta iniciar sesión muy rápido tras la carga podría encontrar `_sbClient` todavía `null`, mostrando el mensaje de error genérico existente en vez de completar el login. Mitigar con un timeout de `requestIdleCallback` conservador (1500-2000ms es razonable dado que abrir el modal y escribir credenciales toma más tiempo que eso en la práctica) y, opcionalmente, iniciando el boot inmediatamente si el usuario interactúa con el botón de login antes de que el idle callback dispare (des-diferir on-demand).
- Cambiar la prioridad de red del script del SDK podría, en teoría, retrasar la disponibilidad de Sentinel más de lo esperado en conexiones muy lentas — mitigar manteniendo el mecanismo de fallback CDN ya existente sin cambios.

### Verificación obligatoria para Codex
1. Revisar la condición exacta que abre el Gatekeeper al final de la IIFE `SentinelCloudSync` (`if (!hasLocalIdentity && !_sbSession) { openGate(...) }`) para confirmar que no depende de que `_bootSentinel()` ya haya terminado.
2. Revisar el handler `submit` de `loginForm` para confirmar que ya maneja el caso `!_sbClient` con un mensaje de error controlado, sin excepciones no capturadas.
3. Confirmar en `js/supabase-loader.js` que el mecanismo de fallback (CDN primario → secundario) sigue intacto si se le añade `fetchpriority`/diferimiento.
4. Revisar si `js/push-notifications.js` u otros módulos dependen de que `window.Sentinel` esté disponible de forma temprana (búsqueda de `window.Sentinel` en el resto del código) para no romper una dependencia oculta.

### Plan de implementación para Codex
1. En `js/app.js`, localizar la línea `_bootSentinel().catch(err => {...});` al final de la IIFE `SentinelCloudSync`, y envolver esa invocación en `requestIdleCallback(() => { _bootSentinel().catch(...) }, { timeout: 1800 })` con fallback a `setTimeout(..., 1800)` si `requestIdleCallback` no existe en el navegador.
2. Añadir un mecanismo de "des-diferido on-demand": en el listener del botón `#btn-cloud-open-gatekeeper` (o en el `submit` de `loginForm`), si `_sbClient` es todavía `null`, forzar la ejecución inmediata de `_bootSentinel()` (cancelando el idle callback pendiente si aplica) en vez de esperar al timeout, para que un usuario que interactúa muy rápido no se quede esperando innecesariamente.
3. En `index.html`, evaluar añadir `fetchpriority="low"` a la línea donde `supabase-loader.js` inyecta el `<script>` del SDK (dentro de `loadFrom()` en `js/supabase-loader.js`, donde se crea el elemento `script`), sin cambiar las URLs ni el mecanismo de fallback.
4. Probar: cargar la app desde cero (cache limpia), confirmar que el primer pintado de Inicio no se retrasa; abrir el Gatekeeper e iniciar sesión con una cuenta de prueba, confirmar que funciona igual que antes, incluso probando abrir el modal inmediatamente tras la carga (caso límite).
5. Confirmar que no queda código muerto: si se añade la lógica de "des-diferido on-demand", debe ser la única vía de forzar el boot, sin duplicar la llamada a `_bootSentinel()` en múltiples sitios sin control de idempotencia (la función ya es segura de llamar una vez, pero debe protegerse contra doble invocación si el idle callback y el forzado manual coinciden).

### Archivos que NO deben modificarse
`api/client-config.js` no requiere cambios — este ticket es sobre el timing del lado del cliente, no sobre el endpoint en sí.

### Criterios de aceptación
- El primer pintado de Inicio (Zero-Flicker Initiative) no se ve alterado ni retrasado por este cambio.
- El login/registro cloud sigue funcionando correctamente en todos los casos, incluido el caso límite de interacción inmediata tras la carga.
- La restauración de sesión existente (usuario que ya tenía sesión guardada) sigue completándose correctamente, solo con un pequeño diferimiento inicial imperceptible para el flujo normal de uso.

### Validación
- Comparación de Network waterfall (Chrome DevTools) antes/después, confirmando que el fetch de `/api/client-config` y la carga del SDK de Supabase ya no compiten en el mismo bloque de tiempo que los assets marcados `fetchpriority="high"`.
- Prueba funcional completa del flujo de login, incluyendo el caso de interacción inmediata.

### Resultado esperado
La carga inicial de Inicio prioriza el contenido visible sobre la inicialización de infraestructura cloud, sin cambiar ningún resultado funcional del sistema de sincronización.

### Notas para Codex
Prestar especial atención a no romper el mecanismo de `onAuthStateChange` — debe seguir registrándose correctamente sin importar cuándo se ejecute `_sentinelInit()`, ya que Supabase notifica el estado de sesión de forma asíncrona independientemente del momento de creación del cliente.

---

## TICKET-09 — `updateUI()` ejecuta múltiples `querySelectorAll` globales en cada `syncUI()`, incluso cuando el saldo no cambió

**Tipo:** JavaScript / Renderizado
**Prioridad:** Baja-Media
**Nivel de confianza:** Confirmado
**Impacto esperado:** Menos trabajo de consulta DOM en cada transición de vista (se ejecuta en TODAS las navegaciones, no solo Inicio→Tienda).

### Objetivo
Evitar repetir consultas `querySelectorAll` costosas de mantener sincronizadas (`.coin-display`, `.moon-blessing-badge`, avatar) cuando el estado subyacente no cambió desde la última sincronización.

### Flujo afectado
Toda navegación entre vistas (`spa-router.js` llama `GameCenter.syncUI()` en cada `_applyView()`), con foco especial en Inicio→Tienda por ser el flujo prioritario.

### Archivos involucrados
- `js/app.js` — `GameCenter.syncUI()`, `updateUI()`, `applyAvatar()`, `updateDailyButton()`, `updateMoonBlessingUI()`.
- `js/spa-router.js` — punto de llamada dentro del `requestAnimationFrame` de `_applyView()`.

### Contexto del código
`syncUI()` se invoca **sin condición** en cada cambio de vista:
```js
syncUI: () => {
    _displayedCoins = store.coins;
    updateUI();
}
```
`updateUI()` ejecuta, siempre: dos `querySelectorAll` para coin-displays, `applyAvatar()` (un `querySelectorAll` con selector combinado de 4 partes), `updateDailyButton()` (varios `getElementById`), `updateMoonBlessingUI()` (`querySelectorAll('.moon-blessing-badge')` + más `getElementById`). Ninguna de estas operaciones comprueba si el dato relevante (saldo, avatar, estado de racha, bendición lunar) cambió realmente desde la última sincronización — se asume que sí y se recalcula/reescribe todo.

### Hallazgo
Navegar Inicio→Tienda→Inicio sin ninguna interacción intermedia (el caso más común de "solo estoy mirando") dispara igualmente el conjunto completo de consultas DOM y comparaciones en cada uno de los tres pasos, sin ningún beneficio real ya que nada cambió. Es trabajo de sincronización defensiva que tiene sentido como estrategia (garantizar consistencia siempre), pero cuyo coste podría reducirse comprobando primero un flag simple de "algo cambió desde la última sincronización".

### Evidencia
- **Hecho comprobado:** `syncUI()` no tiene ninguna condición de salida temprana; llama `updateUI()` siempre.
- **Hecho comprobado:** `js/spa-router.js → _applyView()` llama `window.GameCenter?.syncUI?.()` de forma incondicional en cada transición de vista, dentro del `requestAnimationFrame`.
- **Inferencia:** el coste absoluto de estas consultas es probablemente pequeño (el documento no es enorme), pero se suma al resto de trabajo identificado en los Tickets 01-03 que ya compite por el mismo frame durante la transición.

### Hipótesis de causa raíz
Diseño defensivo intencional para garantizar que el HUD nunca muestre datos obsoletos tras cualquier tipo de navegación, sin optimización posterior de "solo si cambió".

### Oportunidad de optimización
Introducir una comparación barata al inicio de `updateUI()`/`syncUI()`: si `store.coins === _displayedCoins` (ya verdadero tras el reset) **y** un nuevo flag `_uiDirty` es `false`, limitar el trabajo a lo estrictamente necesario para la vista que se está mostrando (en vez de recorrer document completo). Alternativa más simple y de menor riesgo: mantener el comportamiento actual pero acotar las consultas `querySelectorAll` al contenedor de la vista que se está mostrando (`viewEls[viewId]`) en lugar de `document` completo, ya que los elementos de vistas ocultas no necesitan sincronizarse hasta que se muestren de nuevo (de forma similar al Ticket 05, pero aplicado también a avatar y badges de luna, no solo al contador de monedas).

### Preservación funcional
El HUD debe seguir mostrando siempre datos correctos y actualizados en la vista visible. Este ticket no debe introducir ningún caso donde una vista muestre datos obsoletos al hacerse visible.

### Preservación visual
Ninguna.

### Riesgos
- Acotar las consultas a la vista visible requiere pasar el contexto de "vista actual" a `updateUI()`, lo cual no forma parte de su firma actual (`updateUI()` no recibe argumentos) — cambiarla implica tocar todos sus call-sites. Riesgo de introducir una regresión si algún caller depende del comportamiento "actualiza documento completo" (por ejemplo, tras cambiar de tema, donde probablemente sí conviene actualizar todo). Mitigar manteniendo `updateUI()` sin argumentos (comportamiento actual, documento completo) para todos los callers existentes salvo el de `syncUI()`, que podría tener una variante acotada específica para el caso de cambio de vista.

### Verificación obligatoria para Codex
1. Listar TODOS los call-sites de `updateUI()` en `js/app.js` (buscar `updateUI(`) para identificar cuáles dependen de actualización de documento completo (p. ej. tras `applyTheme()`, tras `saveState()`) y cuál es específico de `syncUI()`.
2. Confirmar que `viewEls`/el contenedor de la vista activa es accesible desde `spa-router.js` en el momento de llamar `syncUI()`, o si conviene que `syncUI()` reciba el `viewId` como parámetro opcional.

### Plan de implementación para Codex
1. Mantener `updateUI()` sin cambios de comportamiento para sus llamadas existentes desde `saveState()` y otros puntos.
2. Añadir una variante, p. ej. `updateUI({ scope })`, donde `scope` es opcional; si se provee un elemento contenedor, las consultas `querySelectorAll` se ejecutan sobre ese contenedor en vez de `document`. Si `scope` es `undefined`, comportamiento actual (documento completo) — así se preserva 100% la compatibilidad con todos los callers existentes.
3. En `js/spa-router.js`, modificar la llamada dentro de `_applyView()` para pasar el contenedor de la vista destino: `window.GameCenter?.syncUI?.(viewEls[viewId])`, y en `GameCenter.syncUI(scope)`, pasar ese `scope` a `updateUI({ scope })`.
4. Confirmar que `applyAvatar()`, `updateDailyButton()`, `updateMoonBlessingUI()` — si se decide acotarlas también — reciben el mismo `scope` de forma consistente, o dejarlas sin cambios en una primera iteración si el riesgo de tocar más funciones no se justifica frente al beneficio (decisión a discreción de Codex, documentando la elección).

### Archivos que NO deben modificarse
No se identifican restricciones adicionales.

### Criterios de aceptación
- Todas las vistas siguen mostrando datos correctos tras cualquier navegación.
- El cambio de tema, avatar, identidad, etc., sigue reflejándose correctamente en todas las vistas relevantes (no solo la activa), ya que esos callers no deben verse afectados por el nuevo parámetro opcional.
- Se reduce el alcance de las consultas DOM ejecutadas específicamente durante `syncUI()` en cada transición de vista.

### Validación
- Prueba manual exhaustiva: cambiar tema desde Perfil y confirmar que se refleja en Inicio y Tienda; cambiar avatar y confirmar lo mismo; navegar entre las tres vistas repetidamente y confirmar consistencia de saldo/racha/luna en cada una.

### Resultado esperado
Las transiciones de vista realizan menos trabajo de consulta DOM sin sacrificar la corrección de ningún dato mostrado en ninguna vista.

### Notas para Codex
Este ticket tiene menor prioridad que los Tickets 01-04 porque su impacto individual es probablemente menor; considerarlo solo tras completar los de mayor prioridad, o implementarlo en conjunto con el Ticket 05 dado que tocan la misma función (`updateUI()`).

---

## TICKET-10 — Código muerto: `initEconomyInfo()` referencia elementos DOM que ya no existen en el HTML actual

**Tipo:** Refactorización (limpieza de código muerto)
**Prioridad:** Baja
**Nivel de confianza:** Confirmado
**Impacto esperado:** Ninguno medible en rendimiento (la función ya hace early-return); el valor es eliminar deuda técnica y una llamada de función innecesaria en el camino de `ShopView.onEnter()`.

### Objetivo
Eliminar la función `initEconomyInfo()` y su invocación si los elementos que referencia (`#eco-sale-status`, `#eco-cashback`) ya no forman parte del árbol actual de `index.html`, o corregir la función para apuntar a los elementos correctos si el HUD de economía fue reubicado.

### Flujo afectado
Tienda (se invoca en cada `ShopView.onEnter()` y en el `DOMContentLoaded` inicial).

### Archivos involucrados
- `js/shop-logic.js` — función `initEconomyInfo()`.
- `index.html` — se debe confirmar la ausencia (o presencia en otro lugar) de `#eco-sale-status` y `#eco-cashback`.

### Contexto del código
```js
function initEconomyInfo() {
    const eco    = window.ECONOMY;
    const saleEl = document.getElementById('eco-sale-status');
    const cbEl   = document.getElementById('eco-cashback');
    if (!saleEl || !cbEl) return;
    // ...
}
```
La función ya tiene una guarda defensiva (`if (!saleEl || !cbEl) return;`), por lo que no genera errores. Sin embargo, en el `index.html` provisto, no se observa ningún elemento con `id="eco-sale-status"` ni `id="eco-cashback"` en la sección de Tienda actual (el panel de "Ajustes"/economía documentado en versiones anteriores del proyecto parece haber sido reemplazado por la reestructuración a `#view-profile` en versiones más recientes, y esos IDs específicos no aparecen en el HTML actual).

### Hallazgo
Es una llamada de función que se ejecuta en cada entrada a Tienda y en la carga inicial sin ningún efecto — trabajo estrictamente desperdiciado, aunque de coste marginal (dos `getElementById` y un return). Se documenta aquí principalmente como **deuda técnica confirmada** que conviene resolver junto con el resto de cambios en `shop-logic.js` (Tickets 02/03), ya que Codex va a estar trabajando en ese mismo archivo.

### Evidencia
- **Hecho comprobado:** cuerpo de `initEconomyInfo()` en `js/shop-logic.js`, con guarda de early-return explícita para `#eco-sale-status`/`#eco-cashback`.
- **Hecho comprobado:** búsqueda de esos dos IDs en el `index.html` provisto no arroja coincidencias.
- **Inferencia:** es posible que estos elementos existan en una parte del HTML no incluida en este contexto de auditoría, o que hayan sido removidos intencionalmente en una refactorización de UI sin limpiar el JS correspondiente — requiere confirmación directa en el repositorio real antes de eliminar.

### Hipótesis de causa raíz
Reestructuración de la UI de Tienda/Perfil en una versión posterior que eliminó el panel de economía sin retirar la función JS que lo alimentaba.

### Oportunidad de optimización
Limpieza de código muerto: si se confirma que los elementos no existen en ningún punto del HTML actual, eliminar la función `initEconomyInfo()` y su(s) llamada(s) por completo. Si existieran en otro lugar no visible en esta auditoría, corregir los selectores para que apunten a los IDs correctos.

### Preservación funcional
Si los elementos verdaderamente no existen en ningún flujo actual, eliminar la función no cambia ningún comportamiento observable (ya era un no-op). Si existieran, la función debe seguir mostrando el estado de oferta/cashback correctamente tras la corrección.

### Preservación visual
Ninguna, dado que la función actualmente no pinta nada (guarda de early-return).

### Riesgos
- Riesgo bajo. El único riesgo real es eliminar la función si en realidad SÍ existe un elemento con esos IDs en alguna parte del HTML no visible en este contexto (por ejemplo, generado dinámicamente por otro módulo) — de ahí la verificación obligatoria explícita antes de tocar nada.

### Verificación obligatoria para Codex
1. Buscar en el repositorio completo (no solo en el fragmento de `index.html` de esta auditoría) todas las ocurrencias de `eco-sale-status` y `eco-cashback`, tanto en archivos `.html` como generadas dinámicamente en cualquier `.js` (`innerHTML`, `createElement` + `id =`).
2. Si no se encuentra ninguna coincidencia en todo el repositorio, proceder a eliminar.
3. Si se encuentra en otro archivo HTML no incluido en este contexto (por ejemplo, una plantilla parcial), corregir en vez de eliminar.

### Plan de implementación para Codex
1. Tras confirmar la verificación anterior, si se decide eliminar: quitar la función `initEconomyInfo()` completa de `js/shop-logic.js`.
2. Eliminar su(s) invocación(es): dentro de `ShopView.onEnter()` y dentro del bloque `DOMContentLoaded` de `shop-logic.js` (buscar `initEconomyInfo(`).
3. Confirmar que ninguna otra parte del código depende de que `initEconomyInfo` exista en `window` o sea llamada externamente (no parece estar expuesta globalmente, pero confirmar).
4. Si en cambio se decide corregir los selectores, actualizar `getElementById('eco-sale-status')`/`getElementById('eco-cashback')` a los IDs reales, y verificar visualmente que el panel de economía (si existe en Perfil/Ajustes) muestra correctamente el estado de oferta y cashback.

### Archivos que NO deben modificarse
No se identifican restricciones adicionales.

### Criterios de aceptación
- No quedan referencias a `initEconomyInfo` en el código si se elimina, ni IDs huérfanos sin uso si se corrige.
- El comportamiento visible de la Tienda no cambia en ningún caso (la función ya era un no-op).

### Validación
- Búsqueda global (`grep`/búsqueda en el editor) de `initEconomyInfo` y de los dos IDs mencionados tras el cambio, confirmando cero referencias huérfanas.

### Resultado esperado
Una llamada de función innecesaria menos en el camino de `ShopView.onEnter()`, y el código queda libre de esta pieza de deuda técnica confirmada.

### Notas para Codex
Ticket de bajo impacto en rendimiento pero incluido explícitamente porque las instrucciones de esta auditoría requieren señalar y limpiar código muerto detectado durante la investigación, especialmente cuando se va a tocar el mismo archivo por otros tickets (02, 03).

---

## RESUMEN DE PRIORIZACIÓN

| Ticket | Prioridad | Confianza | Área | Flujo afectado | Beneficio esperado | Riesgo |
|---|---|---|---|---|---|---|
| TICKET-03 | Crítica | Confirmado | JS / Renderizado / Red | Tienda (scroll) | Elimina reconstrucción redundante del observer de precarga en cada lote de scroll | Bajo |
| TICKET-04 | Crítica | Confirmado (magnitud requiere profiling) | JS / Estado | Tienda (compra) | Reduce trabajo síncrono en la cadena crítica del click de compra | Bajo-Medio |
| TICKET-01 | Alta | Confirmado | Animación / Renderizado | Inicio ↔ Tienda (global) | Libera memoria de composición GPU permanente | Bajo |
| TICKET-02 | Alta | Confirmado | JS / Renderizado | Inicio → Tienda | Elimina cálculo redundante de firma de catálogo en cada entrada a Tienda | Bajo |
| TICKET-07 | Alta | Alta probabilidad | Animación / JS | Tienda (compra/canje) | Desacopla animación decorativa del feedback crítico de compra | Bajo (excepción visual menor, opcional) |
| TICKET-05 | Media | Confirmado | Renderizado / JS | Inicio ↔ Tienda / compras | Elimina escrituras DOM en vistas ocultas durante animación de saldo | Bajo |
| TICKET-06 | Media | Alta probabilidad (condicional a validación) | Animación | Inicio | Reduce carga de compositor en segundo plano | Bajo |
| TICKET-08 | Media | Alta probabilidad | Red / JS / Arquitectura | Inicio (carga inicial) | Prioriza el primer pintado sobre inicialización de infraestructura cloud | Medio |
| TICKET-09 | Baja-Media | Confirmado | JS / Renderizado | Toda navegación | Reduce alcance de consultas DOM en cada transición | Medio (cambio de firma de función) |
| TICKET-10 | Baja | Confirmado | Refactorización (dead code) | Tienda | Limpieza de deuda técnica, impacto de rendimiento despreciable | Bajo |

---

## HALLAZGOS QUE REQUIEREN INVESTIGACIÓN ADICIONAL (no convertidos en ticket)

### A. Timing de `loadCatalog()` — fetch del catálogo completo durante la carga inicial de Inicio
**Qué se sospecha:** `js/shop-logic.js` ejecuta `loadCatalog()` (fetch de `data/shop.json` + `data/shop-gifts.json`, ~144 ítems) de forma incondicional en el `DOMContentLoaded` del módulo, independientemente de si el usuario visitará Tienda en esa sesión. Esto es una decisión de diseño deliberada y documentada (precarga para que la transición a Tienda sea instantánea), por lo que **no se recomienda cambiarla sin medir primero**, ya que podría perjudicar exactamente el flujo prioritario (Inicio→Tienda) si se difiere de forma agresiva.
**Qué evidencia existe:** código confirmado de `loadCatalog()` y su invocación en `DOMContentLoaded`.
**Qué información falta:** tiempo real de red/parseo de `shop.json` en condiciones de conexión típicas de un usuario de Galaxy J8 (probablemente 3G/4G variable), y si ese fetch efectivamente compite de forma medible con el primer pintado de Inicio.
**Cómo debería investigarse:** Network waterfall en Chrome DevTools con throttling "Slow 4G", midiendo si el fetch de `shop.json` retrasa la finalización de tareas marcadas como críticas para Inicio (fuentes, primera imagen de portada).
**Por qué no se implementa todavía:** cualquier cambio (diferir con `requestIdleCallback`, por ejemplo) introduce el riesgo de que la primera visita a Tienda ya no tenga el catálogo listo, reintroduciendo una espera de red exactamente en el flujo que se quiere optimizar. Se necesita medición antes de decidir.

### B. Tamaño real del objeto `store` en usuarios de producción
**Qué se sospecha:** el coste de `JSON.stringify(store)` (Ticket 04) depende directamente del tamaño acumulado del objeto (inventario, progreso por juego, historial). El propio proyecto ya tiene telemetría parcial de esto (`storage_warning` cuando supera 4000 KB), lo que sugiere que en la práctica algunos usuarios sí acumulan estados grandes.
**Qué evidencia existe:** el mecanismo de `checkStorageSize()`/`emergencyCleanup()` existente confirma que el equipo ya observó crecimiento problemático del store en el pasado.
**Qué información falta:** distribución real de tamaños de `store` entre usuarios activos (percentil 50/90/99), que determinaría si el Ticket 04 tiene impacto marginal o sustancial.
**Cómo debería investigarse:** revisar los eventos `storage_warning` ya capturados en el canal de Telegram (Ghost Analytics) para tener una idea aproximada de la frecuencia con la que se dispara ese umbral en producción.
**Por qué no se implementa todavía:** el Ticket 04 ya se recomienda igualmente por ser de bajo riesgo y beneficio garantizado (aunque sea pequeño), pero el equipo debería usar esos datos ya existentes para calibrar si merece prioridad aún mayor.

### C. Coste real de `canvas-confetti` en el Galaxy J8 específico
**Qué se sospecha:** ver Ticket 07 — es una animación de canvas con física de partículas, categoría conocida por ser sensible a GPU/CPU.
**Qué evidencia existe:** solo la naturaleza de la librería y el patrón de invocación en el código; no hay medición.
**Qué información falta:** perfil de rendimiento real en el dispositivo de referencia (o uno comparable) mientras se dispara el efecto.
**Cómo debería investigarse:** grabar un trace de Performance en Chrome DevTools conectado remotamente a un Android de gama baja (via `chrome://inspect`) durante una compra real, o al menos con CPU throttling agresivo en desktop como aproximación.
**Por qué no se implementa todavía:** el Ticket 07 ya incluye una propuesta de mitigación de bajo riesgo (diferir un frame) que puede implementarse sin esta validación previa; la parte de reducción de partículas sí se beneficiaría de esta medición antes de decidir el umbral exacto de "dispositivo modesto".

### D. Cantidad real de listeners/observers acumulados tras sesiones largas
**Qué se sospecha:** dado que ninguna vista se desmonta nunca (arquitectura confirmada en la sección 0), y que módulos como `push-notifications.js`, `analytics.js` y el propio `SentinelCloudSync` registran listeners globales (`visibilitychange`, `pageshow`, `focus`, `storage`) desde el arranque, una sesión muy larga en la misma pestaña (varias horas de uso continuo, navegando repetidamente entre vistas) podría, en teoría, acumular trabajo redundante — aunque no se ha encontrado evidencia de que se dupliquen listeners en cada navegación (los `addEventListener` de nivel de documento parecen registrarse una sola vez en `DOMContentLoaded`, no en cada `_applyView()`).
**Qué evidencia existe:** ninguna que confirme una fuga real; es una sospecha estructural basada en el patrón arquitectónico general.
**Qué información falta:** un perfil de memoria (Chrome DevTools → Memory → Heap snapshot) tomado al inicio de una sesión y comparado con uno tomado tras 30-60 minutos de uso activo con navegación repetida, buscando crecimiento anómalo de listeners o closures retenidos.
**Cómo debería investigarse:** heap snapshots comparativos como se describe arriba.
**Por qué no se implementa todavía:** no hay evidencia de código que apunte a un punto de fuga específico; convertir esto en un ticket ejecutable sin esa evidencia violaría la regla de "no inventar hallazgos".

---

## Nota final sobre metodología

Todos los hallazgos "Confirmado" están respaldados por lectura directa del código fuente incluido en este contexto de auditoría. Ningún tiempo, porcentaje, FPS o consumo de memoria mencionado en este documento es una medición real — son, en todos los casos, inferencias razonadas a partir de la estructura del código, marcadas explícitamente como tales. Antes de implementar cualquier ticket, especialmente los marcados "Alta probabilidad", se recomienda que Codex (o el equipo) confirme el impacto con las herramientas de profiling indicadas en cada sección de "Validación", idealmente en el propio Galaxy J8 o un dispositivo Android de especificaciones comparables conectado vía `chrome://inspect`.
