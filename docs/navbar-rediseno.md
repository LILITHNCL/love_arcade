# Investigación previa — Sistema de navegación actual de Love Arcade

Antes de proponer nada, esto es lo que confirmé leyendo el código real del proyecto (sin framework, SPA vanilla JS, sin bundler, sin test runner detectado).

## 1. Arquitectura de navegación actual (CONFIRMADO)

- **Dos superficies de navegación coexisten hoy**: `.navbar` (fija arriba, con `.nav-links` visibles solo en desktop vía `@media (min-width:768px)`) y `.bottom-nav` (fija abajo, visible solo en mobile, `display:none` en desktop).
- **Fuente de verdad del estado activo**: vive en `js/spa-router.js`, variable de cierre `currentView` dentro de la IIFE, sincronizada con `history.pushState/replaceState({viewId, anchor})`. No hay duplicación de estado en otros módulos — `GameCenter` no conoce la vista activa.
- **API pública del router**: `window.SpaRouter = { navigateTo(viewId, anchor, replace), getCurrentView() }`. Esta API debe conservarse intacta.
- **Sincronización visual del estado activo**: función privada `_syncNavHighlight(viewId)` en `spa-router.js`, que hace `classList.toggle('active', ...)` sobre `.nav-link[data-view]` y `.b-nav-item[data-view]`, excluyendo los que tengan `data-anchor` (deep-links como "Juegos" dentro de Inicio).
- **Vistas/rutas existentes**: `VIEWS = ['home', 'shop', 'profile']`. Tres secciones exactamente. Los `data-view` en el HTML actual: Inicio, Tienda, Perfil.
- **Registro de listeners**: `_bindNavItem(el)` añade un único `click` listener por elemento con `[data-view]`, en `DOMContentLoaded`. No hay recreación de listeners en cada navegación (correcto, sin memory leak).
- **Markup actual del bottom-nav** (`index.html`):
```html
<nav class="bottom-nav" aria-label="Navegación rápida móvil">
  <a href="#" class="b-nav-item active" data-view="home">
    <svg class="icon" width="20" height="20"><use href="#icon-home"></use></svg>
    <span>Inicio</span>
  </a>
  ...
</nav>
```
Hoy **todos** los ítems muestran icono + texto siempre (no hay lógica icon-only para inactivos).

## 2. Sistema de iconos (CONFIRMADO)

- SVG Sprite estático inyectado una sola vez en `index.html` body (`<symbol id="icon-NAME">`), sin dependencia externa (Lucide fue eliminado en v9.6). Uso: `<svg class="icon" width="N" height="N"><use href="#icon-NAME"></use></svg>`.
- Existe helper `_icon(name, size, opts)` en `shop-logic.js` para generar el mismo markup en template strings dinámicos — reutilizable si la nueva navbar genera el pill dinámicamente por JS.
- Iconos ya disponibles para las 3 secciones: `#icon-home`, `#icon-shopping-bag`, `#icon-user`.

## 3. Sistema de Themes (CONFIRMADO)

- 5 temas en `THEMES` (`js/app.js`): `violet, pink, cyan, gold, crimson`, cada uno `{ accent, glow, name }`.
- `applyTheme(key)` hace tres cosas de forma síncrona: (a) escribe 6 custom properties en `:root` — `--accent`, `--accent-hover`, `--accent-glow`, `--accent-dim`, `--accent-soft`, `--accent-border`; (b) alterna clase `theme-{key}` en `<body>`; (c) `data-theme` en `<html>`.
- Existe un **script crítico inline en `<head>`** que replica ese cálculo de forma síncrona antes del primer paint (Zero-Flicker Initiative, v9.3) para evitar el flash del tema por defecto. **Cualquier color nuevo que la navbar necesite y que dependa del tema debe pasar también por este script crítico**, o aparecerá un flash en la carga.
- Sistema de superficies "Arcade Solid 3.0": `--solid-surface-base/float/hi/deep` y `--border-subtle/mid/bright`, con filosofía **90% sólido / 10% glass**. El `backdrop-filter` está **explícitamente prohibido** fuera de una lista corta de excepciones (toast, modal-overlay a 4px, identity-modal a 4px, coin-badge). Ya existe además un bloque completo `@media (pointer:coarse)` (v9.8) que **desactiva backdrop-filter en móvil** en overlays existentes por motivos de rendimiento medido (doble rasterizado del viewport).
- `--accent-soft`, `--accent-glow`, `--accent-border` ya son tokens derivados del acento vía `color-mix()` en muchos componentes (`.pill.active`, `.shop-tab.active`, etc.) — son el patrón correcto a reutilizar para el pill activo de la nueva navbar, en vez de hardcodear colores.

## 4. Motion / rendimiento (CONFIRMADO)

- Filosofía GPU-only ya está codificada como regla de proyecto: `.view-section` solo anima `opacity`+`transform`; `will-change` se activa/libera dinámicamente, nunca permanente salvo mientras dura la interacción; existe comentario explícito contra animar `box-shadow`/`height`/`width`/`margin`.
- `@media (prefers-reduced-motion: reduce)` global ya desactiva animaciones, con excepciones puntuales para transiciones de opacity de 150ms en elementos de reveal (`.coin-badge`, `.player-hud`, `.toast`).
- Ya existe un sistema de micro-interacciones (`initInteractiveMicroFX()` en `app.js`): ripple táctil vía `::after` + CSS var `--tap-x/--tap-y`, clase `.interactive-ripple`, `.is-pressing` con `transform: scale(0.97)`, y **vibración háptica ya implementada** (`navigator.vibrate(8)` en Android, condicionada por `_canUseVibration()` que respeta `navigator.userActivation`). Los `.b-nav-item` actuales, al ser `<a href="#">`, **ya heredan este sistema** porque `interactiveSelector` incluye `a[href]`.
- El repo trae skills locales (`.agents/skills/`) — `baseline-ui`, `fixing-motion-performance`, `fixing-accessibility`, `emil-design-eng` — con reglas concretas (duración máx. interacción 100–200ms, `ease-out` en entrada, nunca animar layout, `translateY(100%)` para paneles, springs solo para gestos, etc.). Son la referencia técnica a seguir en los tickets de animación.

## 5. Accesibilidad actual (CONFIRMADO)

- Regla global de touch target `min-width/min-height: 44px` vía `:where(...)` — **pero `.b-nav-item` NO está en esa lista**. En la práctica el alto de 62px y el ancho `flex:1` en pantallas normales ya superan 44px, pero es una omisión de la regla explícita que debe corregirse en la nueva implementación.
- `window.ModalA11y` (focus trap, `inert` en hermanos, Escape) ya existe y se usa en todos los modales — no aplica directamente a la navbar pero es el patrón de foco del proyecto a respetar si el pill nav abriera algo tipo sheet.
- No hay `aria-current` en los links de navegación actuales, solo `.active` visual. Falta semántica accesible de "página actual".

## 6. Código muerto detectado (CONFIRMADO)

```css
.b-nav-item i { transition: 0.2s; }
.b-nav-item.active i {
    transform: translateY(-2px);
    filter: drop-shadow(0 0 6px var(--accent-glow));
}
```
Esto es un **resto de la era Lucide** (`<i data-lucide="...">`), eliminada en v9.6 en favor del SVG Sprite (`<svg class="icon">`). El selector `i` nunca coincide con nada desde entonces. Es CSS 100% muerto.

## 7. Restricciones de infraestructura (CONFIRMADO)

- No hay bundler, no hay framework, no hay test runner en el repo (no aparece `package.json`, ni carpeta `tests/`, ni configuración de CI en los documentos disponibles). Los "criterios de lint/typecheck/build" de la plantilla de tickets no aplican tal cual — se sustituyen por revisión manual + Service Worker cache-busting (`sw.js` tiene `CACHE_VERSION` que debe incrementarse si cambian rutas de assets).
- `sw.js` precachea `index.html` y `styles.css` explícitamente en `APP_SHELL_FILES` — cualquier cambio de estos archivos requiere bump de `CACHE_VERSION` en `sw.js` o los usuarios recurrentes verán la navbar vieja cacheada.

---

# TICKETS

### TICKET-01 — Reemplazo del markup: Floating Pill Bottom Nav
**Tipo:** UI / Navegación · **Prioridad:** Crítica · **Confianza:** Confirmado

**Objetivo:** Sustituir `<nav class="bottom-nav">` por una nueva `<nav class="pill-nav">` flotante, con ítem activo mostrando icono+label dentro de una píldora, e ítems inactivos mostrando solo icono.

**Archivos:**
- `index.html` — reemplazar bloque `<nav class="bottom-nav">` completo. Conservar `data-view="home|shop|profile"` en cada ítem (contrato con `spa-router.js`).
- `styles.css` — eliminar reglas `.bottom-nav`, `.b-nav-item*` (incluido el CSS muerto de `i`, ver hallazgo #7) y añadir `.pill-nav*`.
- `js/spa-router.js` — **sin cambios funcionales**; `_bindNavItem` y `_syncNavHighlight` ya operan por selector `[data-view]` genérico, por lo que deben seguir funcionando si el nuevo markup conserva `data-view` en el elemento raíz clicable. Verificar que `_syncNavHighlight` siga aplicando `.active` sobre el nuevo selector de clase (renombrar el selector interno de `.b-nav-item` a `.pill-nav-item`).

**Diseño propuesto:**
```html
<nav class="pill-nav" aria-label="Navegación principal">
  <div class="pill-nav__track">
    <a href="#" class="pill-nav-item" data-view="home" aria-current="page">
      <span class="pill-nav-item__icon"><svg class="icon" ...><use href="#icon-home"/></svg></span>
      <span class="pill-nav-item__label">Inicio</span>
    </a>
    <a href="#" class="pill-nav-item" data-view="shop">...</a>
    <a href="#" class="pill-nav-item" data-view="profile">...</a>
  </div>
</nav>
```
El label existe siempre en el DOM (para accesibilidad y para animar su aparición/desaparición vía CSS, no vía innerHTML — ver TICKET-02). Se oculta visualmente en los ítems inactivos con `clip-path`/`max-width` animado, no con `display:none` (que rompería la transición y el foco por teclado).

**Responsive:** mobile-first, `position: fixed; bottom: calc(env(safe-area-inset-bottom) + Npx)`. En tablet crece el `max-width` del track y el spacing interno. En desktop se evalúa junto con TICKET-11 (decisión sobre `.nav-links` del navbar superior).

**Cleanup obligatorio:** eliminar `.bottom-nav`, `.b-nav-item`, `.b-nav-item i`, `.b-nav-item.active i`, y el padding-bottom del `body` que compensaba `--bottom-nav-height` (recalcular, ver TICKET-06).

**Riesgos:** romper `_syncNavHighlight` si se cambia el nombre de clase sin actualizar el selector en `spa-router.js`. Mitigación: actualizar el selector en el mismo commit, no dejar el viejo como fallback.

**Verificación antes de modificar:** confirmar en `spa-router.js` que `navLinks`/`bottomNavItems` se recalculan una sola vez en `DOMContentLoaded` (`Array.from(document.querySelectorAll(...))`) — si el nuevo nav se monta después de ese punto, hay que mover la selección o usar delegación de eventos.

**Criterios de aceptación:** las 3 rutas navegan igual que antes; `SpaRouter.getCurrentView()` sigue siendo la única fuente de verdad; no quedan referencias a `.bottom-nav`/`.b-nav-item` en CSS ni HTML; `sw.js` `CACHE_VERSION` incrementado.

---

### TICKET-02 — Píldora activa: animación deslizante + reveal del label
**Tipo:** Animación · **Prioridad:** Crítica · **Confianza:** Alta probabilidad (diseño a validar, mecánica confirmable en código)

**Objetivo:** Que al cambiar de sección la píldora se desplace/transforme con sensación física, el label de la nueva sección aparezca, y el anterior desaparezca, todo en <200ms usando solo `transform`+`opacity`(+`clip-path` si es necesario), sin tocar layout.

**Estrategia recomendada (evaluada contra el stack real, no genérica):**
Dado que el proyecto **no** usa ninguna librería de animación (no hay Framer Motion, GSAP, Motion One en ningún import del repo), y la regla de `AGENTS.md` es "no añadir dependencias runtime solo para satisfacer una recomendación de skill", la solución debe ser **CSS puro + un único elemento indicador**, no una librería nueva:
- Un solo `<div class="pill-nav__indicator">` posicionado con `transform: translateX()` calculado por JS mínimo (offset del ítem activo), en vez de 3 píldoras individuales — minimiza DOM y evita animar `width`/`left`.
- El label del ítem activo anima con `clip-path: inset(0 100% 0 0)` → `inset(0 0 0 0)` (patrón ya documentado y usado en el proyecto vía `emil-design-eng`/`clip-path` para reveals, ver §"clip-path for Animation" en la skill local) — evita animar `width`/`max-width`, que dispararía layout.
- Icono: pequeño `scale` (0.9→1) + `opacity` en la transición de aparición, coherente con la regla del proyecto "nunca desde `scale(0)`".
- Easing: `cubic-bezier` custom tipo "back-out suave" — el proyecto **ya tiene precedente exacto**: `modalPopIn` usa `cubic-bezier(0.34, 1.56, 0.64, 1)` para su "rebote leve". Reutilizar la misma curva mantiene coherencia de producto en vez de inventar una nueva.
- Duración: ≤200ms para el indicador (regla de `baseline-ui`: "NEVER exceed 200ms for interaction feedback"), con el reveal del label pudiendo extenderse ligeramente (~220–250ms) igual que `.modal-box` (250ms) para el toque de rebote.

**Reacción de elementos cercanos:** opcional y muy acotada — p. ej. un `transform: scale(0.96)` de 80ms en el icono saliente. Debe implementarse solo si no añade una segunda capa de complejidad de estado; si genera riesgo de animaciones desincronizadas en cambios rápidos, omitirlo (criterio de aceptación explícito abajo).

**Cambios rápidos de sección (A→B→C→A):** la animación debe usar `transition` (no `@keyframes`) precisamente porque el proyecto ya documenta esta regla ("usar transitions en vez de keyframes para UI interrumpible/re-disparada rápido", ver Sonner Principles en `emil-design-eng`). Con `transition`, el navegador retarget automáticamente sin acumular timers.

**Reduced motion:** bajo `prefers-reduced-motion: reduce`, eliminar el `translateX` con rebote (transición instantánea o `opacity` únicamente), igual que ya hace el bloque global existente en `styles.css` para otros componentes (mismo patrón, extenderlo).

**Riesgos:** calcular el offset del indicador requiere leer `offsetLeft`/`getBoundingClientRect()` del ítem activo — es una lectura de layout que debe hacerse **una vez por navegación**, no en cada frame, y preferentemente debounced con `resize` (cambios de orientación/viewport).

**Criterios de aceptación:** la transición dura ≤250ms; solo anima `transform`/`opacity`/`clip-path`; no hay layout thrashing (ninguna lectura de `getBoundingClientRect` dentro de un bucle de animación); funciona correctamente en A→B→C→A sin píldoras duplicadas ni estados intermedios; `prefers-reduced-motion` la reduce a un cambio casi instantáneo.

---

### TICKET-03 — Integración de color con el sistema de Themes
**Tipo:** Theming · **Prioridad:** Crítica · **Confianza:** Confirmado

**Objetivo:** Que el pill nav use exclusivamente tokens existentes, sin hardcodear ningún color.

**Tokens a reutilizar (ya definidos, confirmados en `styles.css`):**
- Fondo del track: `var(--solid-surface-float)` (mismo que usa `.game-card`, `.player-hud`) — **no** `.navbar`'s `#0d0e15` hardcodeado, para mantener consistencia con el resto de superficies "float".
- Píldora activa: `var(--accent-soft)` como fondo + `var(--accent-border)` como borde + `box-shadow` con `var(--accent-glow)` — patrón idéntico al ya usado en `.pill.active` y `.shop-tab.active`.
- Texto del label activo: `var(--text-on-accent-aa)` o `var(--text-high)` según contraste medido por tema (ver Riesgos).
- Icono inactivo: `var(--text-low)` (mismo token que `.b-nav-item` usa hoy vía `color: var(--text-mute)`).

**Riesgo de contraste:** el proyecto ya tiene overrides específicos por tema (`[data-theme="pink"], [data-theme="cyan"] { --text-med: #e2e2f0; --text-low: #b4b4c8; }`) porque esos acentos claros fallan AA con los valores por defecto. La nueva píldora activa **debe probarse contra los 5 temas**, no solo Violeta — en particular Gold y Pink, que son los acentos más claros del set.

**Script crítico del `<head>`:** si el color del pill nav depende de variables que el script crítico inline no está seteando hoy (revisar: hoy solo setea `--accent`, `--accent-hover`, `--accent-glow`, `--accent-dim`, `--accent-soft`, `--accent-border` — que son exactamente las que se necesitan), **no hace falta tocar el script crítico**, siempre que la nueva navbar use solo esas 6 variables. Si se necesitara un token nuevo derivado, debe añadirse también ahí para evitar flash de color al cargar.

**Riesgos:** introducir cualquier color no derivado de esas 6 variables reintroduce el riesgo de flash pre-paint que la Zero-Flicker Initiative (v9.3) eliminó explícitamente.

**Criterios de aceptación:** cero valores hex/rgb hardcodeados en las reglas nuevas de `.pill-nav*`; los 5 temas pasan verificación visual de contraste AA en label activo e íconos inactivos; cambiar de tema en caliente (click en `.theme-btn`) actualiza el pill nav sin recargar.

---

### TICKET-04 — Accesibilidad: semántica, foco, labels, `aria-current`, reduced motion
**Tipo:** Accesibilidad · **Prioridad:** Crítica · **Confianza:** Confirmado

**Objetivo:** Navegación completamente operable por teclado y comprensible por lectores de pantalla, incluso con los labels visualmente ocultos en ítems inactivos.

**Semántica HTML:** mantener `<a href="#">` con `data-view` (patrón actual, ya intercepta `click` con `preventDefault()` en `_bindNavItem`) — no usar `<div role="button">` cuando `<a>` nativo ya resuelve foco/Enter/Space gratis. Envolver en `<nav aria-label="Navegación principal">` (ya existe).

**Estado activo accesible:** añadir `aria-current="page"` al `<a>` de la sección activa, actualizado por `_syncNavHighlight` junto con `.active` — ARIA mínimo y justificado (sin esto un lector de pantalla no puede distinguir la sección actual solo por el DOM, ya que visualmente ítem activo=icono+texto pero eso no es una señal ARIA).

**Labels ocultos visualmente ≠ ausentes del DOM:** el `<span class="pill-nav-item__label">` debe **permanecer en el DOM y legible por AT en todo momento**, incluso en ítems inactivos — la ocultación es puramente visual (`clip-path`, no `display:none` ni `visibility:hidden`, que sí lo sacarían del árbol de accesibilidad). Esto además es lo que permite animar el reveal (ver TICKET-02) sin duplicar markup.

**Touch targets:** añadir `.pill-nav-item` a la lista `:where(...)` de `min-width/min-height: 44px` en `styles.css` (hoy `.b-nav-item` no está en esa lista — hallazgo de código muerto/omisión, ver investigación §5).

**Reduced motion:** extender el bloque `@media (prefers-reduced-motion: reduce)` ya existente en `styles.css` para incluir las nuevas reglas de `.pill-nav__indicator` y `.pill-nav-item__label`.

**Riesgos:** si el indicador deslizante se implementa como capa `position:absolute` separada del `<a>`, verificar que no intercepte clics (`pointer-events:none` en el indicador) ni rompa el orden de tabulación.

**Criterios de aceptación:** navegable 100% por teclado (Tab entre 3 ítems, Enter activa); `aria-current="page"` presente y correcto en todo momento; contraste AA verificado; labels detectables por lector de pantalla en los 3 ítems sin importar el estado visual; `prefers-reduced-motion` respetado.

---

### TICKET-05 — Comportamiento responsive (mobile → tablet → desktop)
**Tipo:** Responsive · **Prioridad:** Alta · **Confianza:** Alta probabilidad

**Mobile pequeño (<380px):** el proyecto ya tiene un breakpoint específico (`@media (max-width: 379px)` que hoy oculta el icono del logo del navbar). Verificar que 3 ítems + 1 label expandido no generen overflow horizontal en ese ancho — probable que el track deba tener `max-width` fluido con `min()`.

**Mobile normal / tablet (hasta 767px):** comportamiento base descrito en TICKET-01/02.

**Desktop (≥768px):** aquí es donde se necesita una decisión de producto explícita, ver TICKET-11 — el proyecto hoy usa `.nav-links` (texto plano en la navbar superior) en desktop y oculta el bottom-nav por completo (`display:none`). Si el pill nav debe reemplazar **también** la navegación de desktop (tal como pide el prompt: "reemplazo completo"), hace falta decidir si el floating pill baja también en desktop o si se conserva el patrón superior con la misma lógica de píldora activa aplicada horizontalmente arriba. **No se debe asumir** — esto es una decisión de UX, no solo técnica.

**Criterios de aceptación:** sin overflow horizontal en ningún breakpoint probado; el pill nav es utilizable con mouse en desktop sin verse "para dedo"; transición fluida al redimensionar (sin salto brusco de layout al cruzar el breakpoint).

---

### TICKET-06 — Safe areas y viewport dinámico
**Tipo:** Responsive · **Prioridad:** Alta · **Confianza:** Confirmado (mecanismo ya existe, hay que trasladarlo)

**Objetivo:** que el pill nav respete `env(safe-area-inset-bottom)` igual que el `.bottom-nav` actual (`padding-bottom: env(safe-area-inset-bottom)`), pero considerando que ahora es flotante con margen, no pegado al borde.

**Cambio de estrategia necesario:** hoy `body { padding-bottom: var(--bottom-nav-height) }` reserva espacio fijo. Con un nav flotante con margen inferior variable (`bottom: calc(env(safe-area-inset-bottom) + Npx)`), el `padding-bottom` del `body` debe recalcularse para seguir evitando que el contenido final quede tapado por la píldora — probablemente `var(--bottom-nav-height) + Npx` de margen extra.

**Viewport dinámico:** el proyecto usa unidades `dvh` en al menos un componente (`.identity-modal-box { max-height: 90dvh }`), evidencia de que el equipo ya conoce y usa `dvh` para evitar el problema clásico de `100vh` + teclado virtual en iOS. Si el pill nav usa alguna unidad de viewport, debe usar `dvh`/`svh`, no `vh`.

**Criterios de aceptación:** en dispositivos con home indicator (iPhone) la píldora no queda pegada al borde ni tapada; el contenido de la última sección de cada vista nunca queda oculto detrás del nav flotante; sin salto de layout al aparecer/ocultar el teclado virtual.

---

### TICKET-07 — Haptic feedback en cambio de sección
**Tipo:** Enhancement · **Prioridad:** Media · **Confianza:** Confirmado (mecanismo base ya existe)

**Objetivo:** reutilizar, no reinventar, el sistema háptico ya presente.

**Evidencia:** `initInteractiveMicroFX()` en `js/app.js` ya ejecuta `navigator.vibrate(8)` en `pointerdown` sobre Android para cualquier elemento `interactive-ripple`, condicionado por `_canUseVibration()` (respeta `navigator.userActivation`). Los `<a>` del nav actual (y del nuevo) ya matchean `a[href]` en el `interactiveSelector`, así que **ya reciben esta vibración de 8ms hoy sin código adicional**.

**Decisión pendiente:** ¿se quiere un patrón háptico *distinto* específicamente al confirmar el cambio de sección (no solo al tocar), por ejemplo un pulso más corto en el momento en que la píldora termina de asentarse? Si es así, hace falta exponer `_canUseVibration()` fuera de la función interna (hoy vive en scope de módulo, no en `window`) o replicar la misma comprobación de forma local en el nuevo código de la navbar.

**Riesgos:** duplicar la llamada a `navigator.vibrate()` (una por el sistema de ripple genérico + otra específica del nav) generaría una doble vibración perceptible y molesta — si se añade un segundo trigger, el primero debe excluirse explícitamente para `.pill-nav-item` (p. ej. quitando `.pill-nav-item` del `interactiveSelector` genérico si se implementa su propio háptico).

**Criterios de aceptación:** vibración única por cambio de sección (no doble); solo en dispositivos/navegadores compatibles, sin errores en consola si `navigator.vibrate` no existe (iOS Safari no la soporta — debe fallar silenciosamente, cosa que `_canUseVibration()` ya garantiza).

---

### TICKET-08 — Cleanup: código muerto de la era Lucide y del bottom-nav anterior
**Tipo:** Cleanup · **Prioridad:** Alta · **Confianza:** Confirmado

**Qué eliminar exactamente (evidencia en `styles.css`):**
```css
.b-nav-item i { transition: 0.2s; }
.b-nav-item.active i { transform: translateY(-2px); filter: drop-shadow(...); }
```
(selector `i` nunca coincide desde la migración a SVG Sprite en v9.6 — ver investigación §7).

Además, tras TICKET-01: toda regla `.bottom-nav`, `.b-nav-item`, `.b-nav-item.active`, `.b-nav-item:active`, `.b-nav-item.is-pressing` en `styles.css`; el bloque `@media (min-width:768px) { .bottom-nav { display:none } }`; y el markup completo en `index.html`.

**Verificar antes de eliminar:** buscar cualquier otra referencia a `.bottom-nav`/`.b-nav-item` fuera de `styles.css`/`index.html`/`spa-router.js` — no se encontró ninguna en `app.js`, `shop-logic.js` ni en los minijuegos (`games/*`), por lo que el radio de impacto está confirmado como acotado a esos 3 archivos.

**Criterios de aceptación:** `grep -r "b-nav-item\|bottom-nav" .` (o equivalente) no devuelve resultados fuera de comentarios históricos en `DOCUMENTACION.md` (que se conservan como registro histórico, no se reescribe el changelog pasado).

---

### TICKET-09 — Presupuesto de rendimiento: sin `backdrop-filter`, disciplina de capas GPU
**Tipo:** Rendimiento · **Prioridad:** Crítica · **Confianza:** Confirmado (política de proyecto ya establecida y medida)

**Objetivo:** que la nueva navbar no reintroduzca el problema que el proyecto ya resolvió explícitamente en v9.8 (Mobile Performance Pass).

**Evidencia del precedente:** v9.8 documenta con detalle por qué se **eliminó** `backdrop-filter` de overlays móviles: "cada cambio de `backdrop-filter` captura y desenfoca toda la escena detrás — coste medido de 40-120ms/frame en gama baja". Y explícitamente: `@media (pointer:coarse) { .modal-overlay { backdrop-filter:none !important } ... }`.

**Regla para el pill nav:** si el diseño visual quiere sensación "flotante/glass", usar **fondo sólido con sombra** (`var(--solid-surface-float)` + `box-shadow`), el mismo patrón que ya usa `.player-hud`/`.game-card`, **no** blur. Si en desktop (`pointer:fine`) se justifica un `backdrop-filter` sutil como mejora progresiva, debe ir dentro de `@media (hover:hover) and (pointer:fine)` — patrón que el proyecto ya usa para el glassmorphism opcional del mockup de preview (`@supports (backdrop-filter...) { @media (pointer:fine) {...} }`).

**Capas de composición:** el indicador deslizante (TICKET-02) es el único candidato razonable a `will-change: transform`, y **solo durante la transición**, liberándolo al terminar — mismo patrón que `.modal-box` (`will-change` declarado en CSS, liberado automáticamente al pasar a `display:none`) o que `.shop-card:hover` (`will-change` solo en `:hover`, nunca permanente).

**Riesgos:** un `position:fixed` con sombra grande + blur permanente sobre contenido con scroll (la navbar está siempre visible durante scroll del catálogo/tienda) es exactamente el escenario que v9.8 identificó como más costoso.

**Criterios de aceptación:** cero `backdrop-filter` en la ruta crítica de `pointer:coarse`; ninguna propiedad animada fuera de `transform`/`opacity`/`clip-path`; `will-change` nunca declarado de forma permanente en reposo.

---

### TICKET-10 — Documentación
**Tipo:** Documentación · **Prioridad:** Media · **Confianza:** Confirmado

**Dónde:** el proyecto centraliza documentación técnica en `docs/DOCUMENTACION.md` con un patrón de secciones versionadas (`## 2X. Novedades en vX.Y — ...`) — seguir exactamente ese formato para no romper la convención existente (índice + changelog + detalle técnico + resumen de archivos modificados, como en todas las entradas anteriores).

**Contenido mínimo:** arquitectura del componente, contrato con `spa-router.js` (qué NO debe tocarse: `data-view`, `getCurrentView()`, `navigateTo()`), tokens de Theme usados, comportamiento responsive, política de reduced motion, política de `backdrop-filter`, cómo añadir una 4ª sección en el futuro (qué archivos tocar: `index.html` markup + icono nuevo en el sprite + `VIEWS` array en `spa-router.js` + vista correspondiente).

**Criterios de aceptación:** sección nueva en `DOCUMENTACION.md` siguiendo el formato existente; `README.md` "Versión" actualizado si corresponde al ciclo de release del proyecto (patrón visto en entregas anteriores).

---

### TICKET-11 — [INVESTIGACIÓN REQUERIDA] Decisión de UX: ¿el pill nav reemplaza también la navegación de desktop?
**Tipo:** Arquitectura · **Prioridad:** Media · **Confianza:** Sospechoso — falta decisión de producto, no de código

No se puede convertir en un ticket de implementación definitivo porque falta una decisión explícita: hoy desktop usa `.nav-links` (texto plano arriba) y el prompt pide "reemplazo completo" de la navegación, priorizando mobile pero "desktop también debe quedar correctamente resuelto". Hay dos caminos igualmente válidos técnicamente:
1. El floating pill baja también en desktop, sustituyendo `.nav-links` por completo (una sola implementación, un solo componente para las 3 plataformas).
2. Desktop conserva una navbar superior pero adopta la misma mecánica de píldora activa deslizante (mismo lenguaje visual, distinta posición).

**Qué falta para decidir:** ninguna evidencia de código indica preferencia; es puramente de diseño de producto. Recomiendo resolver esto **antes** de cerrar TICKET-05, porque cambia el alcance de cuánto CSS de `.navbar`/`.nav-links` queda obsoleto.

---

## Resumen de priorización

| Ticket | Prioridad | Confianza | Área | Plataforma | Beneficio | Riesgo |
|---|---|---|---|---|---|---|
| 01 | Crítica | Confirmado | Navegación/UI | Mobile→Desktop | Base de todo el resto | Medio (romper `_syncNavHighlight`) |
| 03 | Crítica | Confirmado | Theming | Todas | Integración visual coherente | Bajo |
| 04 | Crítica | Confirmado | Accesibilidad | Todas | Cumplimiento WCAG | Bajo |
| 09 | Crítica | Confirmado | Rendimiento | Mobile gama baja | Evita regresión ya resuelta antes | Medio |
| 02 | Crítica | Alta probabilidad | Animación | Todas | El "juice" pedido | Medio (interrupciones) |
| 05 | Alta | Alta probabilidad | Responsive | Todas | Sin overflow / UX pobre | Medio |
| 06 | Alta | Confirmado | Responsive | Mobile con notch | Evita nav tapada/mal posicionada | Bajo |
| 08 | Alta | Confirmado | Cleanup | — | Cero deuda técnica | Bajo |
| 07 | Media | Confirmado | Enhancement | Mobile Android | Feedback premium | Bajo (doble vibración si mal integrado) |
| 10 | Media | Confirmado | Documentación | — | Mantenibilidad futura | Ninguno |
| 11 | Media | Sospechoso | Arquitectura | Desktop | Define alcance real | N/A (decisión, no código) |

---

## Arquitectura final propuesta

- **Un único componente** `<nav class="pill-nav">` (mobile/tablet, y desktop si TICKET-11 se resuelve en esa dirección), montado una vez en `index.html`, sin JS de framework — solo el mínimo JS necesario para calcular el offset del indicador deslizante.
- **Fuente de verdad del estado activo:** se mantiene 100% en `spa-router.js` (`currentView` + History API). El pill nav es una vista derivada de ese estado vía `_syncNavHighlight`, nunca un estado paralelo.
- **Theming:** cero colores propios; consume las 6 CSS custom properties existentes derivadas de `THEMES` en `app.js`, ya sincronizadas por el script crítico del `<head>` para evitar flash.
- **Responsive:** mobile-first con `position:fixed` + `env(safe-area-inset-bottom)`; el `body` recalcula su `padding-bottom` para el nuevo alto flotante; breakpoints en línea con los ya existentes (768px, 1024px).
- **Animación:** un solo elemento indicador con `transform: translateX()` + `clip-path` para el reveal del label, `transition` (no `@keyframes`) para soportar interrupciones, curva `cubic-bezier(0.34, 1.56, 0.64, 1)` ya usada en el proyecto para coherencia de producto, duración ≤250ms.
- **Accesibilidad:** `<a>` nativos, `aria-current="page"`, labels siempre presentes en el DOM (ocultos solo visualmente), 44px de touch target garantizado por la regla `:where()` global, respeto de `prefers-reduced-motion` extendiendo el bloque global ya existente.
- **Haptic feedback:** reutiliza `_canUseVibration()`/`navigator.vibrate(8)` ya implementado en `initInteractiveMicroFX()`; sin duplicar sistemas.
- **Rendimiento:** cero `backdrop-filter` en mobile (política ya establecida por el proyecto en v9.8), `will-change` solo temporal en el indicador durante la transición, ninguna medición de layout dentro de bucles de animación.
- **Cleanup:** desaparece por completo `.bottom-nav`/`.b-nav-item` (incluido el CSS muerto heredado de Lucide), sin capas de compatibilidad ni doble navegación coexistiendo.

## Hallazgos que requieren investigación adicional

1. **Desktop (TICKET-11):** decisión de producto pendiente, no resoluble desde el código.
2. **Cache-busting real:** confirmar el flujo exacto de despliegue (¿Vercel invalida `sw.js` automáticamente en cada deploy, o depende del bump manual de `CACHE_VERSION`? El código sugiere lo segundo, pero no hay evidencia del pipeline de CI/CD en los documentos disponibles).
3. **Presupuesto exacto de contraste por tema:** no hay una herramienta de verificación automatizada de contraste en el repo; la validación tendría que ser manual con los 5 temas antes de cerrar TICKET-03/04.
