# Investigación: Sistema de Themes — Love Arcade

## 1. Resumen de la arquitectura actual (Hecho comprobado)

**Definición de Themes** — `js/app.js`, líneas ~cerca de `const THEMES`:
```js
const THEMES = {
    violet:  { accent: '#9b59ff', glow: 'rgba(155, 89, 255, 0.4)',  name: 'Violeta' },
    pink:    { accent: '#ff59b4', glow: 'rgba(255, 89, 180, 0.4)',  name: 'Rosa Neón' },
    cyan:    { accent: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)',   name: 'Cyan Arcade' },
    gold:    { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)',  name: 'Dorado' },
    crimson: { accent: '#e11d48', glow: 'rgba(225, 29, 72, 0.4)',   name: 'Carmesí Arcade' }
};
window.THEMES = THEMES;
```
5 themes. Cada uno solo define `accent` (hex) y `glow` (rgba string), más un `name`.

**Duplicación crítica (Hecho comprobado):** `index.html`, script inline crítico en `<head>` (Zero-Flicker), define un **segundo mapa de themes independiente**:
```js
var T={
  violet: ['#9b59ff','rgba(155,89,255,0.4)'],
  pink:   ['#ff59b4','rgba(255,89,180,0.4)'],
  cyan:   ['#00d4ff','rgba(0,212,255,0.4)'],
  gold:   ['#f59e0b','rgba(245,158,11,0.4)'],
  crimson:['#e11d48','rgba(225,29,72,0.4)']
};
```
Este script lee `localStorage['gamecenter_v6_promos'].theme` y sobreescribe los CSS custom properties **antes del primer paint**, sin depender de `app.js`. Es una fuente de verdad paralela que debe mantenerse sincronizada manualmente con `THEMES` en `app.js` — cualquier cambio de themes que solo toque `app.js` producirá inconsistencia de flicker.

**Selección del Theme** — `index.html`, sección `#profile-personalization` → `.theme-grid` con botones `<button class="theme-btn" data-theme="violet">…</button>` (uno por theme, 5 en total, cada uno con `.theme-swatch` de color hardcodeado inline `style="background:#9b59ff"` — otra duplicación del hex).

**Propagación** — `js/app.js`, listener único registrado en `DOMContentLoaded`:
```js
document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => window.GameCenter.setTheme(btn.dataset.theme));
});
```
`GameCenter.setTheme(key)` → valida `THEMES[key]`, persiste `store.theme = key`, `saveState()`, llama `applyTheme(key)`.

**Aplicación (`applyTheme(key)` en `app.js`)**:
```js
root.style.setProperty('--accent',        t.accent);
root.style.setProperty('--accent-hover',  t.accent + 'cc');
root.style.setProperty('--accent-glow',   t.glow);
root.style.setProperty('--accent-dim',    t.accent + '99');
root.style.setProperty('--accent-soft',   t.glow.replace(/[\d.]+\)$/, '0.12)'));
root.style.setProperty('--accent-border', t.glow.replace(/[\d.]+\)$/, '0.38)'));
document.body.classList.add(`theme-${key}`); // limpia clases previas
document.documentElement.setAttribute('data-theme', key);
// sincroniza .theme-btn--active
```
Los tokens derivados (`--accent-hover`, `--accent-dim`, `--accent-soft`, `--accent-border`) se generan con **concatenación de string / regex sobre el string `glow`**, no con una función de color real. Esto es fragilísimo: asume que `accent` es un hex de 6 dígitos (`+ 'cc'` funciona solo así) y que `glow` termina en `,N)`.

**Tokens CSS (`styles.css` `:root`)**:
```css
--accent:       var(--accent-500);      /* fallback pre-JS */
--accent-dim:   rgba(155, 89, 255, 0.55);
--accent-glow:  var(--accent-glow-aa);
--accent-soft:  var(--accent-soft-aa);
--accent-border: var(--accent-border-aa);
--accent-soft-aa:   color-mix(in srgb, var(--accent) 28%, #0b0d14 72%);
--accent-border-aa: color-mix(in srgb, var(--accent) 62%, #20263a 38%);
--accent-glow-aa:   color-mix(in srgb, var(--accent) 34%, #0a0d18 66%);
--text-on-accent-aa: var(--text-primary-aa);   /* SIEMPRE claro, fijo, no theme-aware */
```
Nótese: existen **dos sistemas de derivación en competencia** — los `-aa` calculados con `color-mix()` en CSS puro (que sí reaccionan a `--accent` dinámicamente) y los que `applyTheme()` fuerza vía JS con concatenación de strings sobre `--accent-dim/-soft/-border/-glow` directamente (que pisan el resultado del `color-mix`). En la práctica, **el JS gana** porque `root.style.setProperty` tiene mayor especificidad que la declaración en `:root{}`.

**Overrides de contraste manuales por theme (Hecho comprobado, styles.css):**
```css
[data-theme="pink"], [data-theme="cyan"] { --text-med: #e2e2f0; --text-low: #b4b4c8; }
[data-theme="gold"] { --text-med: #e5e5e7; --text-low: #b0b0c0; }
```
Esto es una lista de excepciones **hardcodeada por nombre de theme**, no una regla semántica derivada del color. No escala a 25 themes.

**Navbar** (`styles.css .navbar`):
```css
.navbar {
    background: #0d0e15;   /* color sólido fijo, NO deriva de --accent */
    border-bottom: 1px solid var(--border-subtle);
    box-shadow: 0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.6);
}
```
`--bg-main` (fondo de página) = `var(--surface-0)` = `#050508`. La navbar (`#0d0e15`) es ligeramente más clara que el fondo, pero **ninguna de las dos deriva del theme seleccionado** — son valores fijos del sistema "Arcade Solid". No hay relación tonal entre accent y navbar.

**Pill nav** (navegación principal real, reemplaza navbar+bottom-nav como único nav real, según `docs/DOCUMENTACION.md` §2ag): `.pill-nav__track` usa `background: var(--solid-surface-float)` (`#141620`, fijo). El indicador activo `.pill-nav__indicator` sí usa `--accent-soft` / `--accent-border` / `--accent-glow` y el label activo usa `--text-on-accent-aa` (texto claro fijo).

**Botones**: `.btn-primary` sí consume `--accent` / `--accent-dim` / `--text-on-accent-aa` correctamente — es el consumidor mejor alineado al patrón token-based.

**Consumidores de `--accent*` identificados (grep manual sobre styles.css):** `.btn-primary`, `.coin-badge`, `.avatar` border/glow, `.hud-avatar-ring` (conic-gradient), `.hud-balance::before`, `.streak-day.active`, `.pill.active`, `.theme-btn--active`, `.shop-card:hover`, `.search-input:focus`, `.promo-input:focus`, `.identity-chip--active`, `.identity-input:focus`, `.profile-action-card__icon`, `.pill-nav__indicator`, `.sale-banner` (dorado fijo, no accent), `.moon-blessing-badge`/`.moon-btn` (violeta/rosa fijo, no accent — intencional, es un buff "lunar" con identidad propia).

**API pública externa (Hecho comprobado, `docs/love-arcade-minigame-dev-manual.md` §5, §8.3):** `window.THEMES` es un **global reservado y documentado** que los minijuegos externos pueden leer de solo lectura:
```js
const accentColor = window.THEMES[temaActivo]?.accent || '#9b59ff';
```
Esto impone una restricción dura: **la forma `THEMES[key].accent` (string hex) debe seguir existiendo** aunque se enriquezca la estructura, o se rompe el contrato documentado con juegos externos.

**Persistencia:** `store.theme` dentro del objeto guardado en `localStorage['gamecenter_v6_promos']`, vía `migrateState()` default `theme: 'violet'`. Sincronizado a Supabase por Sentinel (`SENTINEL_WATCHED_KEYS` incluye la clave completa del store).

**Tests:** No se encontró ningún archivo de test en el repositorio relacionado con Themes, CSS ni UI (no hay carpeta `tests/` ni referencias en `package.json` — no se localizó `package.json` en los documentos entregados). **Confianza: Alta probabilidad de ausencia total de test runner**, ya que `AGENTS.md` y el resto de la documentación no mencionan ningún framework de testing ni comando `npm test`. No debo inventar comandos: cualquier ticket de validación debe indicar "buscar en package.json / repo si existe script de test antes de ejecutar uno".

**Build/lint:** No se encontró `package.json`, `.eslintrc`, ni bundler — el proyecto es JS vanilla servido estático (`README.md`: "No requiere Node.js, npm ni compilación"). **Confianza: Confirmado** por README explícito. Esto significa que la validación de estos tickets es principalmente manual/visual (no hay `npm run build`/`lint` que ejecutar).

---

## 2. Hallazgos principales

1. **Doble fuente de verdad** (`app.js THEMES` vs `index.html` script inline `T`) — cualquier expansión a 25 themes debe actualizar ambos en sincronía o se rompe el zero-flicker.
2. **Derivación de tokens vía concatenación de strings**, no vía función de color real — no escala de forma segura a 25 colores arbitrarios (algunos de la lista nueva, como `#FFFFFF`, romperán el patrón `t.accent + 'cc'` produciendo `#FFFFFFcc`, que sí es válido CSS pero da un blanco translúcido inconsistente con el resto).
3. **Contraste de texto sobre accent fijo (`--text-on-accent-aa` = claro siempre)** — no soporta el requisito de texto negro sobre el theme `#FFFFFF`. No existe ningún mecanismo de cálculo de luminancia.
4. **Excepciones de contraste hardcodeadas por nombre de theme** (`[data-theme="pink"]`, `[data-theme="cyan"]`, `[data-theme="gold"]`) — con 25 themes esto se vuelve inmantenible; se necesita una regla semántica generada (misma lógica de luminancia que el punto 3, aplicada a `--text-med`/`--text-low` si aplica, o preferiblemente evitar tocar esos tokens y dejar que solo los "on-accent" surfaces cambien).
5. **Navbar y pill-nav no derivan del theme** — background fijo `#0d0e15`/`#141620`. Esto es exactamente el problema descrito por el usuario: la jerarquía fondo→navbar→sección activa existe tonalmente (por ser solid-surface tokens fijos) pero **no tiene identidad de theme**, y el pedido es que la navbar tenga un fondo "más oscuro/profundo derivado del Theme" conservando el acento saturado en la sección activa.
6. **Botones y componentes ya usan el patrón token correcto** (`--accent`, `--accent-dim`, `--text-on-accent-aa`) — la arquitectura de tokens existe y es reutilizable; el trabajo es (a) mejorar cómo se generan esos tokens por theme, (b) resolver el contraste dinámico, (c) extenderlo a navbar.
7. **Contrato público (`window.THEMES[key].accent`)** usado por minijuegos externos — debe preservarse como superficie mínima de compatibilidad.
8. **No existe test automatizado ni build step** — la validación será manual (visual QA en los 25 themes + verificación de que no queden referencias a los 5 themes antiguos).
9. Elementos "de marca" que usan colores fijos ajenos al accent (banner de oferta dorado, badge de Bendición Lunar violeta) **no deben confundirse con bugs**: son decisiones de identidad de producto independientes del Theme del usuario. **Inferencia**: deben preservarse tal cual salvo que se indique lo contrario, ya que no son "consumidores de Theme" sino elementos de marca fija.

---

## 3. Tickets de implementación para Codex

### TICKET-01 — Introducir generación de tokens de color por función (Material 3 "roles") en lugar de concatenación de strings

**Tipo:** Arquitectura / Design System
**Prioridad:** Crítica
**Confianza:** Confirmado

**Objetivo**
Reemplazar la derivación actual de `--accent-hover`, `--accent-dim`, `--accent-soft`, `--accent-border`, `--accent-glow` (concatenación de string sobre `accent`/`glow`) por una función determinista de generación de "color roles" al estilo Material 3 (`primary`, `on-primary`, `primary-container`, `on-primary-container`, etc., adaptados a los nombres ya usados en el proyecto para minimizar renombrados), capaz de operar sobre **cualquier** hex de entrada, incluyendo blanco puro y grises.

**Archivos involucrados**
- `js/app.js` (función `applyTheme(key)`, definición de `THEMES`)
- `index.html` (script crítico inline en `<head>`, mapa `T`)
- `styles.css` (`:root` tokens `--accent*`, `--text-on-accent-aa`, overrides `[data-theme="pink|cyan|gold"]`)

**Estado actual**
`applyTheme()` genera tokens con `t.accent + 'cc'` (hover), `t.accent + '99'` (dim), regex sobre `t.glow` para soft/border. `t.glow` es una string `rgba(r,g,b,0.4)` mantenida a mano en paralelo al hex de `accent` — es un dato redundante y frágil.

**Hallazgo**
Este patrón no es sostenible con 25 colores nuevos que incluyen extremos como `#FFFFFF` (blanco) y grises neutros (`#636366`, `#48484A`), donde la lógica `accent + alpha-suffix` no produce resultados visualmente coherentes con el resto de themes saturados, y no hay forma de derivar "on-accent" (texto encima) automáticamente.

**Evidencia**
- `js/app.js`: bloque `function applyTheme(key) { root.style.setProperty('--accent-hover', t.accent + 'cc'); ... }` (Hecho comprobado, código citado arriba).
- `styles.css`: `--accent-soft-aa: color-mix(in srgb, var(--accent) 28%, #0b0d14 72%);` ya demuestra que el proyecto tiene acceso a `color-mix()` (soportado en el navegador objetivo, confirmado por su uso extendido en el mismo archivo) — es la vía correcta a generalizar.

**Implementación propuesta**
1. Definir en JS (no en CSS, porque se necesita para calcular contraste — ver TICKET-04) una función pura `deriveThemeRoles(hex)` que, dado un color base, devuelva un objeto de roles: `{ accent, accentHover, accentDim, accentSoft, accentBorder, accentGlow, onAccent }`.
2. Usar **manipulación real de color** (HSL o mezcla con negro/blanco vía `color-mix()` generado dinámicamente como valor de string CSS, ej. `color-mix(in srgb, ${hex} 62%, #20263a 38%)`), no concatenación de alpha sobre hex.
3. Eliminar el campo `glow` de la definición de cada theme (pasa a derivarse, no a declararse a mano) — ver TICKET-02 para la nueva estructura de datos.
4. `applyTheme(key)` debe llamar a `deriveThemeRoles()` y hacer `root.style.setProperty()` para cada rol derivado, incluyendo el nuevo `--on-accent` (ver TICKET-04).
5. Reescribir el script crítico inline de `index.html` para usar la misma función `deriveThemeRoles` (duplicada inline por necesidad de zero-flicker, ver TICKET-07) en vez del mapa `T` hardcodeado de pares `[accent, glow]`.

**Limpieza**
- Eliminar todo el código de concatenación de string (`t.accent + 'cc'`, `t.accent + '99'`, `.replace(/[\d.]+\)$/, ...)`).
- Eliminar el campo `glow` de cada entrada de `THEMES` una vez migrado.

**Preservación**
- El resultado final para los themes que se conserven en tono/temperatura debe seguir alimentando los mismos nombres de custom property (`--accent`, `--accent-dim`, `--accent-soft`, `--accent-border`, `--accent-glow`) para no romper los ~15 selectores CSS que ya los consumen (listados en Hallazgos §6).

**Criterios de aceptación**
- Ningún theme (incluidos blanco y grises) produce tokens con alpha mal formado o colores fuera de rango.
- Los selectores CSS existentes que consumen `--accent*` no requieren cambios de nombre.

**Validación**
- Verificación manual: aplicar cada uno de los 25 themes y confirmar visualmente botones, chips activos, glow del avatar.
- No hay test runner conocido (ver Hallazgo §8) — si se descubre uno en `package.json` durante la implementación, ejecutarlo; si no, dejar constancia en el PR de que la validación fue manual.

---

### TICKET-02 — Migración de la lista de Themes: reemplazar los 5 themes actuales por los 25 nuevos

**Tipo:** Theme / Migración
**Prioridad:** Crítica
**Confianza:** Confirmado (lista de colores y ubicación del código) / Alta probabilidad (nombres internos propuestos, son una propuesta razonada, no hallazgo)

**Objetivo**
Reemplazar completamente `THEMES` en `js/app.js` y el mapa `T` en `index.html` por los 25 nuevos colores, con nombres internos (`key`) estables y un `name` legible en español (consistente con el resto de la UI, que está en español: "Violeta", "Rosa Neón", etc.).

**Archivos involucrados**
- `js/app.js` (`const THEMES`)
- `index.html` (`<head>` script crítico `var T`, `.theme-grid` con 5 `.theme-btn`)
- `styles.css` (`[data-theme="pink"|"cyan"|"gold"]` overrides — deben eliminarse o generalizarse, ver TICKET-05)

**Estado actual**
5 themes: `violet, pink, cyan, gold, crimson`.

**Hallazgo**
Deben eliminarse por completo y reemplazarse por 25. Es la migración central del proyecto.

**Evidencia**
Código citado en el Resumen de arquitectura (§1), `Hecho comprobado`.

**Lista final de los 25 Themes propuesta** (nombre interno `key` en `snake_case`/inglés corto para consistencia con convención existente de una sola palabra en minúsculas tipo `violet`, `pink`, `crimson`; `name` en español para UI):

| # | Hex | key (interno) | name (UI) |
|---|---|---|---|
| 1 | `#FF3B30` | `red` | Rojo |
| 2 | `#C0392B` | `brick` | Ladrillo |
| 3 | `#FF375F` | `rose` | Rosa Intenso |
| 4 | `#FF2D92` | `magenta` | Magenta |
| 5 | `#FF9500` | `orange` | Naranja |
| 6 | `#E67E22` | `amber_deep` | Ámbar Profundo |
| 7 | `#FFCC00` | `yellow` | Amarillo |
| 8 | `#F4D03F` | `gold_soft` | Dorado Suave |
| 9 | `#A8E063` | `lime` | Lima |
| 10 | `#30D158` | `green` | Verde |
| 11 | `#2ECC71` | `emerald` | Esmeralda |
| 12 | `#1ABC9C` | `teal` | Verde Azulado |
| 13 | `#006689` | `ocean` | Océano |
| 14 | `#26C6DA` | `cyan` | Cian |
| 15 | `#5AC8FA` | `sky` | Cielo |
| 16 | `#0A84FF` | `blue` | Azul |
| 17 | `#2196F3` | `azure` | Azur |
| 18 | `#5856D6` | `indigo` | Índigo |
| 19 | `#7C3AED` | `violet` | Violeta |
| 20 | `#9B59B6` | `purple` | Púrpura |
| 21 | `#A0522D` | `sienna` | Siena |
| 22 | `#8B6914` | `bronze` | Bronce |
| 23 | `#636366` | `graphite` | Grafito |
| 24 | `#48484A` | `slate` | Pizarra |
| 25 | `#FFFFFF` | `white` | Blanco |

Nota: reutilizo `violet` y `cyan` como keys porque coinciden temáticamente con nombres ya existentes, para reducir la sorpresa en `data-theme="violet"`/`data-theme="cyan"` si algo externo (poco probable, pero el minigame manual referencia `THEMES[temaActivo]`) los usa como ejemplo. Esto es **Hipótesis de conveniencia**, no un requisito técnico — Codex puede usar cualquier slug estable siempre que sea único y en `kebab/snake_case` sin espacios (ver `AGENTS.md`/convención de `data-theme` como atributo HTML).

**Reemplazo de cada Theme antiguo**
No hay mapeo 1:1 "antiguo→nuevo" solicitado por el usuario ("Los Themes antiguos deben eliminarse completamente"), así que no se define migración de color, solo de **selección persistida** (ver abajo).

**Implementación propuesta**
1. Reemplazar `THEMES` en `js/app.js` por las 25 entradas, cada una con solo `{ accent: '#HEX', name: 'Nombre' }` (sin `glow`, generado por TICKET-01).
2. Reemplazar el mapa `T` en `index.html` con la misma lista de 25 (adaptado al formato mínimo que ese script necesite tras TICKET-01/07).
3. En `migrateState()` (`js/app.js`), el default de `theme` es `'violet'`. Como `violet` (`#7C3AED`) sigue existiendo en la nueva lista, el default puede conservarse sin romper stores existentes de usuarios que no personalizaron su theme. **Para usuarios con un theme antiguo persistido que ya NO existe en la nueva lista** (`pink`, `gold`, `crimson`, y el `cyan` viejo con hex distinto al nuevo `cyan`): añadir en `migrateState()` una migración explícita:
   ```js
   const LEGACY_THEME_FALLBACK = { pink: 'magenta', gold: 'yellow', crimson: 'red', cyan: 'cyan' };
   if (merged.theme && !THEMES[merged.theme]) {
       merged.theme = LEGACY_THEME_FALLBACK[merged.theme] || 'violet';
   }
   ```
   Esto evita que `applyTheme(store.theme)` reciba una key inexistente y caiga silenciosamente al fallback interno de `applyTheme` (`THEMES[key] || THEMES.violet`), lo cual funcionaría pero cambiaría el theme del usuario sin trazabilidad. Con el mapeo explícito, al menos se preserva intención de color aproximada. **Esta es la estrategia de migración pedida en la sección 7 del prompt.**
4. Regenerar `.theme-grid` en `index.html` con 25 `.theme-btn`, cada uno `data-theme="{key}"`, sin `style="background:{hex}"` inline (mover a CSS, ver limpieza) o generarlo dinámicamente vía JS al render si el HTML estático de 25 botones resulta impráctico de mantener a mano (**decisión de implementación de Codex**; ambas son válidas, pero generarlos desde `THEMES` en JS evita una tercera fuente de verdad).

**Limpieza**
- Eliminar las 5 entradas antiguas de `THEMES` y de `T`.
- Eliminar los 5 `.theme-btn` antiguos de `index.html`.
- Eliminar `[data-theme="pink"], [data-theme="cyan"], [data-theme="gold"]` de `styles.css` (ver TICKET-05, que reemplaza esta lógica).
- Grep del repo por los strings `'pink'`, `'gold'`, `'crimson'` como valor de theme (no como palabra suelta) para confirmar que no quedan referencias — **Confirmado** que no aparecen en `spa-router.js`, `shop-logic.js` según los archivos revisados; **Alta probabilidad** de que no existan en otros módulos no incluidos en esta investigación (juegos individuales bajo `games/`), ya que el manual de minijuegos solo documenta lectura de `window.THEMES[temaActivo].accent` de forma genérica, sin hardcodear nombres de theme.

**Preservación**
- La forma pública `window.THEMES[key].accent` (string hex) debe seguir existiendo intacta para los minijuegos (contrato documentado en `docs/love-arcade-minigame-dev-manual.md` §8.3).
- `GameCenter.setTheme(key)`, `GameCenter.getTheme()` no cambian de firma.

**Criterios de aceptación**
- `Object.keys(window.THEMES).length === 25`.
- Ningún key antiguo (`pink`, `cyan` viejo, `gold`, `crimson`) sigue presente salvo el mapeo de migración en `migrateState`.
- Un usuario con `store.theme = 'gold'` persistido migra automáticamente a `'yellow'` (o el fallback elegido) sin error en consola.

**Validación**
- Manual: recorrer los 25 botones, confirmar que `applyTheme` no lanza excepción y que `--accent` refleja el hex esperado en DevTools.
- Simular `localStorage` con `theme: 'crimson'` y recargar para validar el fallback de migración.

---

### TICKET-03 — Sincronizar el script crítico de `<head>` con la nueva lista de Themes (Zero-Flicker)

**Tipo:** Arquitectura / CSS
**Prioridad:** Crítica
**Confianza:** Confirmado

**Objetivo**
Garantizar que el script inline en `<head>` de `index.html` (que aplica el theme guardado antes del primer paint) refleje exactamente los mismos 25 themes y la misma lógica de derivación de tokens que `app.js`, para no reintroducir el "salto de color" que la Zero-Flicker Initiative (v9.3, documentado en `docs/DOCUMENTACION.md` §2f) fue diseñada a eliminar.

**Archivos involucrados**
- `index.html` (`<head>` script inline)

**Estado actual**
Mapa `T` hardcodeado con 5 entradas `[accent, glow]`, lógica de override de custom properties duplicada manualmente respecto a `applyTheme()` de `app.js`.

**Hallazgo**
Es una **duplicación de lógica intencional por restricción técnica** (debe ejecutar sin esperar a que `app.js` cargue, al final del body), no un bug — pero cualquier cambio a `THEMES`/`applyTheme` en `app.js` sin replicarlo aquí reintroduce el flicker para todo theme que no sea el default. Con 25 themes el riesgo de desincronización aumenta significativamente frente a 5.

**Evidencia**
Comentario explícito en el propio script: *"Mapa de temas: [accent, glow] — debe coincidir con THEMES en app.js"* (Hecho comprobado, cita literal del código).

**Implementación propuesta**
1. Actualizar `var T` con las 25 entradas (mismo hex que `THEMES`).
2. Si TICKET-01 introduce `deriveThemeRoles()`, replicar una versión mínima **solo de los tokens que el script crítico realmente sobreescribe** (`--accent`, `--accent-hover`, `--accent-glow`, `--accent-dim`, `--accent-soft`, `--accent-border`) para mantener el bloque lo más pequeño posible (el comentario en el HTML ya justifica esto: *"Tamaño: < 0.5 KB — impacto de rendimiento despreciable"*). Si TICKET-04 añade `--on-accent`, replicarlo también aquí porque afecta contenido visible en el primer frame (ej. pill-nav activo).
3. Mantener el guard `if(theme==='violet') return;` como optimización solo si `violet` sigue siendo el default en `:root` sin JS — confirmar que los valores base en `styles.css :root` (`--accent: var(--accent-500)` = `#8b5cf6`, cercano pero no idéntico a `#7C3AED`) siguen siendo razonables como fallback pre-JS, o actualizarlos para que coincidan exactamente con el nuevo `violet` (`#7C3AED`) y evitar un micro-flicker en el theme por defecto.

**Limpieza**
- Eliminar las 5 entradas antiguas del mapa `T`.

**Preservación**
- El comportamiento "solo sobreescribe si theme ≠ default" debe mantenerse por rendimiento, ajustando cuál es el default si cambia.

**Criterios de aceptación**
- Recargar la página con cualquiera de los 25 themes persistidos no produce salto de color visible (verificación manual con throttling de red/CPU en DevTools, comparando el primer frame).

**Validación**
- Manual únicamente (no hay test runner).

---

### TICKET-04 — Contraste dinámico "on-accent": texto/iconos blancos salvo excepción del Theme blanco

**Tipo:** Theme / Design System / Accesibilidad
**Prioridad:** Crítica
**Confianza:** Confirmado (problema) / Alta probabilidad (solución propuesta, requiere validar umbral de contraste con el equipo de diseño)

**Objetivo**
Implementar una regla **centralizada y automática** (no si/else por theme) que determine el color de texto/iconos sobre superficies coloreadas por el accent del Theme: blanco (`#FFFFFF`) para los 24 themes saturados/oscuros, y negro o gris oscuro apropiado para el Theme `#FFFFFF`.

**Archivos involucrados**
- `js/app.js` (`applyTheme()`)
- `styles.css` (`--text-on-accent-aa`, todos los consumidores que asumen texto claro sobre accent: `.btn-primary` `color`, `.pill-nav-item.active` `color`, `.pill.active`, `.theme-btn--active`, etc.)
- `index.html` (script crítico, réplica necesaria — ver TICKET-03)

**Estado actual**
`--text-on-accent-aa: var(--text-primary-aa);` es una constante fija en `:root`, nunca varía por theme. Todos los componentes que ponen texto sobre un fondo `--accent*` asumen implícitamente que siempre es oscuro, porque los 5 themes actuales son todos saturados/oscuro-compatibles con texto claro.

**Hallazgo**
Con el Theme `#FFFFFF` añadido a la lista, cualquier superficie que use `background: var(--accent-soft)`/`--accent` con `color: var(--text-on-accent-aa)` (texto claro fijo) quedará con texto casi invisible sobre fondo blanco. Se requiere un token que **el JS decida dinámicamente por theme**, no una regla CSS estática, porque CSS no puede calcular luminancia de un color arbitrario en runtime sin JS o trucos de `@container`/`color-contrast()` (esta última función CSS no está garantizada disponible en el soporte objetivo del proyecto, que evita dependencias modernas no verificadas — **Hipótesis**: no se confirmó soporte de `color-contrast()` en el navegador objetivo, por lo que se recomienda la vía JS, ya probada y usada en todo el proyecto vía `applyTheme`).

**Evidencia**
`styles.css`: `--text-on-accent-aa: var(--text-primary-aa);` sin ninguna variación condicional real por color (los `[data-theme=...]` existentes tocan `--text-med`/`--text-low`, no `--text-on-accent-aa`) — Hecho comprobado.

**Implementación propuesta**
1. En `deriveThemeRoles(hex)` (TICKET-01), calcular la luminancia relativa del `accent` (fórmula WCAG estándar: convertir a sRGB linear, `L = 0.2126*R + 0.7152*G + 0.0722*B`).
2. Definir un umbral (ej. `L > 0.6` → superficie clara → usar texto oscuro; si no, texto blanco). Ajustar el umbral empíricamente para que solo `#FFFFFF` (y quizás colores muy próximos si se agregaran en el futuro) caigan del lado "oscuro". Con los 25 colores dados, todos excepto `#FFFFFF` son suficientemente saturados/oscuros para requerir texto blanco — **Alta probabilidad** de que el umbral 0.6–0.7 sea seguro, pero debe verificarse visualmente para `#F4D03F` (dorado suave) y `#FFCC00` (amarillo), que son los más claros del set aparte del blanco.
3. Exponer el resultado como nuevo custom property `--on-accent` (ej. `#FFFFFF` o `#121212`/similar gris oscuro ya usado en el proyecto para texto sobre dorado, ver `.hud-daily-reward { color: #120900 }` como precedente de "texto oscuro sobre superficie clara" ya existente en el sistema).
4. Reemplazar los usos de `--text-on-accent-aa` en los selectores que pintan texto **sobre** el accent (no confundir con texto que usa el accent como *color de texto* sobre fondo oscuro, como `.nav-brand span`, que debe seguir usando `--accent` tal cual) por `--on-accent`. Requiere auditoría selector por selector — no renombrar ciegamente todas las apariciones de `--text-on-accent-aa`.
5. Actualizar el script crítico de `<head>` (TICKET-03) para calcular y aplicar `--on-accent` también, ya que el pill-nav activo es visible en el primer frame.

**Limpieza**
- Ninguna eliminación de código muerto per se; `--text-on-accent-aa` puede conservarse como alias de `--on-accent` si algún consumidor externo (juego) lo lee — **Hipótesis, no confirmada**: no se encontró evidencia de que los juegos lean `--text-on-accent-aa`; si se confirma que no, puede eliminarse y renombrarse directamente en vez de mantener alias.

**Preservación**
- Elementos con color de texto/fondo fijo ajenos al theme (banner dorado, badge lunar violeta) **no deben tocarse** — no son superficies "on-accent" del theme del usuario.

**Criterios de aceptación**
- Con Theme `#FFFFFF` activo, todo texto/icono sobre `.btn-primary`, `.pill.active`, `.pill-nav-item.active`, `.theme-btn--active` es legible (contraste ≥ 4.5:1, verificación manual con herramienta de contraste de DevTools).
- Con cualquier otro theme, el texto sobre esas mismas superficies sigue siendo `#FFFFFF` (o el valor exacto históricamente usado, sin regresión visual).

**Validación**
- Manual: usar el inspector de accesibilidad de Chrome DevTools sobre cada botón/chip activo en los 25 themes.

---

### TICKET-05 — Eliminar overrides de contraste hardcodeados por nombre de Theme

**Tipo:** CSS / Design System
**Prioridad:** Alta
**Confianza:** Confirmado

**Objetivo**
Eliminar las reglas `[data-theme="pink"], [data-theme="cyan"] {...}` y `[data-theme="gold"] {...}` (que ya no aplican a los themes eliminados) y sustituir, si sigue siendo necesario tras TICKET-04, por una lógica generada dinámicamente de la misma forma (luminancia → ajuste de `--text-med`/`--text-low` si algún theme claro nuevo lo requiere, ej. `#FFCC00`, `#F4D03F`, `#A8E063`, `#FFFFFF`).

**Archivos involucrados**
- `styles.css` (bloque `/* ── WCAG AA contrast fixes for bright themes ── */`)

**Estado actual**
```css
[data-theme="pink"], [data-theme="cyan"] { --text-med: #e2e2f0; --text-low: #b4b4c8; }
[data-theme="gold"] { --text-med: #e5e5e7; --text-low: #b0b0c0; }
```

**Hallazgo**
Estos tokens (`--text-med`, `--text-low`) son de **texto general de la UI** (no específicamente "on-accent"), y su necesidad de override dependía de que ciertos themes antiguos cambiaran la percepción de contraste en zonas donde el accent se usaba como color de texto plano (ej. `.nav-brand span { color: var(--accent) }`, `.hud-balance-amount` con `--gold` fijo no afectado). Con 25 themes nuevos, particularmente los claros (`#FFCC00`, `#F4D03F`, `#A8E063`, `#FFFFFF`), es plausible que se necesite un ajuste similar, pero **no puede mantenerse como lista manual de 5-8 excepciones** sobre 25 opciones.

**Evidencia**
Bloque citado, `Hecho comprobado`.

**Implementación propuesta**
1. Eliminar el bloque de overrides por nombre.
2. Evaluar (manual, visual) si tras la migración algún theme claro produce baja legibilidad en textos que usan `--accent` directamente como `color` (ej. `.nav-brand span`, títulos con acento). Si es así, generar la corrección en `deriveThemeRoles()` (TICKET-01) como un rol adicional opcional (ej. `--accent-on-dark`, una variante ligeramente oscurecida del accent para uso como texto sobre fondo oscuro, calculada con la misma función de luminancia) en lugar de tocar `--text-med`/`--text-low` globales.
3. Si tras la evaluación no se detectan problemas de legibilidad (Hipótesis: los usos de `--accent` como color de texto son puntuales — `.nav-brand span`, títulos — y ya llevan `text-shadow: 0 0 20px var(--accent-glow)` como refuerzo visual, lo que puede ser suficiente), simplemente eliminar el bloque sin reemplazo.

**Limpieza**
- Eliminar el bloque `[data-theme="pink"], [data-theme="cyan"] {...}` y `[data-theme="gold"] {...}` en su totalidad.

**Preservación**
- `--text-med`/`--text-low` deben seguir teniendo sus valores base (`--text-secondary-aa`, `--text-tertiary-aa`) para todos los themes que no requieran ajuste.

**Criterios de aceptación**
- Ningún selector CSS referencia `data-theme="pink"`, `data-theme="cyan"`, `data-theme="gold"`.
- Verificación visual de legibilidad de texto en los themes claros de la nueva lista.

**Validación**
- Manual (grep de `data-theme="` en `styles.css` para confirmar ausencia de residuos).

---

### TICKET-06 — Navbar/Pill-nav: fondo profundo derivado del Theme + sección activa fiel al accent

**Tipo:** Navbar / Design System
**Prioridad:** Alta
**Confianza:** Confirmado (estado actual) / Alta probabilidad (solución propuesta — la dirección de "derivar de accent" es la interpretación correcta del pedido, el valor exacto de mezcla requiere ajuste visual iterativo)

**Objetivo**
Resolver el problema descrito por el usuario: la navbar (y, dado que es el nav real de la SPA, el **pill-nav**) actualmente usa un color de fondo sólido fijo no relacionado con el Theme. Debe pasar a usar un fondo "más oscuro/profundo derivado del Theme seleccionado" manteniendo la jerarquía `fondo de página → navbar → sección activa`, con la sección/indicador activo usando el accent de forma fiel y saturada (ya ocurre parcialmente vía `--accent-soft`/`--accent-border`, pero puede intensificarse).

**Archivos involucrados**
- `styles.css` (`.navbar`, `.pill-nav__track`, `.pill-nav__indicator`, tokens `--solid-surface-*`)
- `js/app.js` (`applyTheme()`, para setear el nuevo token derivado)

**Estado actual**
```css
.navbar { background: #0d0e15; ... }
.pill-nav__track { background: var(--solid-surface-float); /* #141620 fijo */ ... }
.pill-nav__indicator { background: var(--accent-soft); border: 1px solid var(--accent-border); box-shadow: 0 0 20px var(--accent-glow); }
```
Nota importante: **la navegación real y única de la SPA es la pill-nav** (`docs/DOCUMENTACION.md` §2ag: "La navegación principal se unifica en un único `<nav class="pill-nav">`... Sustituye por completo los enlaces superiores `.nav-links` y la antigua bottom nav"). El elemento `.navbar` (top bar con logo + saldo) **sigue existiendo y visible** (`index.html`, `<header class="navbar glass-panel">`) pero ya no es el mecanismo de navegación entre vistas — es una barra de estado/marca. Ambos elementos son candidatos al mismo tratamiento de "superficie profunda derivada del theme" porque ambos son "chrome" persistente de la app.

**Hallazgo**
Ninguna de las dos superficies (`.navbar`, `.pill-nav__track`) deriva su color de fondo del `--accent` activo. El indicador de sección activa (`.pill-nav__indicator`) **ya usa** `--accent-soft`/`--accent-border`/`--accent-glow`, es decir, ya tiene identidad de theme — el hallazgo del usuario sobre "sección activa" puede referirse a que `--accent-soft` (mezclado al 28% con un fondo oscuro, ver TICKET-01/`color-mix`) resulta **poco saturado** comparado con el accent puro, lo que puede percibirse como "no lo suficientemente fiel". Se propone reforzar la saturación del indicador activo mientras se introduce el fondo profundo derivado en `.navbar`/`.pill-nav__track`.

**Evidencia**
- `.navbar { background: #0d0e15 }` — Hecho comprobado, valor fijo, no `color-mix`/`var(--accent...)`.
- `--accent-soft-aa: color-mix(in srgb, var(--accent) 28%, #0b0d14 72%)` — Hecho comprobado, solo 28% de mezcla, relativamente sutil.

**Implementación propuesta**
1. Añadir a `deriveThemeRoles()` (TICKET-01) un nuevo rol `--surface-nav` (o nombre equivalente): una superficie oscura derivada mezclando el `accent` en baja proporción (ej. `color-mix(in srgb, ${accent} 8%, #050508 92%)` — mucho más sutil que `--accent-soft`, pensado para dar "temperatura" de color al fondo sin competir con el contenido) sobre la base `--surface-0`/`--surface-1` ya existentes en el sistema Solid.
2. Aplicar `--surface-nav` como `background` de `.navbar` y de `.pill-nav__track`, reemplazando los valores fijos `#0d0e15` / `var(--solid-surface-float)`. Esto satisface "fondo de página → navbar → sección activa" con jerarquía tonal: `--surface-0` (página, sin mezcla) → `--surface-nav` (navbar, mezcla ligera de accent) → `--accent`/`--accent-soft` intensificado (sección activa).
3. Reforzar el indicador activo del pill-nav: subir el porcentaje de mezcla de `--accent-soft` específicamente para este uso (ej. crear `--accent-soft-strong` con 40–45% de mezcla en vez del 28% actual) **o** usar `background: var(--accent)` directamente con opacidad reducida vía `color-mix(in srgb, var(--accent) 60%, transparent)`, para lograr el efecto "mucho más fiel y saturada" pedido, sin perder legibilidad del texto activo (que depende de `--on-accent`, TICKET-04, si se decide subir tanto la saturación que el fondo se acerque al accent puro).
4. Verificar que `box-shadow: 0 0 20px var(--accent-glow)` del indicador sigue funcionando con el nuevo `--accent-glow` derivado (TICKET-01) sin regresión.
5. **Comportamiento del Theme blanco (`#FFFFFF`) en la navbar**: con `--surface-nav` derivado mezclando 8% de blanco sobre `--surface-0` oscuro, el resultado seguirá siendo oscuro (mezcla mínima), preservando la superficie "profunda" pedida — el blanco no debe convertir la navbar en una superficie clara, solo debe darle una temperatura neutra/gris muy sutil. Esto debe confirmarse visualmente como parte de la validación, ya que es el caso límite más importante de los 25.

**Limpieza**
- Eliminar el valor fijo `background: #0d0e15` de `.navbar`.
- Evaluar si `--solid-surface-float` sigue siendo necesario en otros consumidores (`.glass-float`, `.player-hud`, `.mockup-container` fallback, etc. — **sí**, tiene múltiples usos no relacionados con nav, confirmado por grep de `var(--solid-surface-float)` en `styles.css`) — **no eliminar ese token global**, solo dejar de usarlo en `.pill-nav__track`.

**Preservación**
- `.glass-panel`, `.glass-float`, `.glass-highlight` y el resto del sistema "Arcade Solid 3.0" (superficies no-nav) permanecen sin cambios — este ticket es exclusivo de navbar/pill-nav.
- El comportamiento de `prefers-reduced-motion` y las reglas de `pointer: coarse` sobre `.pill-nav__indicator` (ninguna encontrada actualmente que dependa del color, solo de animación) no se ven afectadas.

**Criterios de aceptación**
- `.navbar` y `.pill-nav__track` cambian visualmente de tono (sutilmente) al cambiar de Theme, mientras conservan legibilidad y la jerarquía "página < navbar < sección activa" en luminancia percibida.
- El indicador activo del pill-nav es visiblemente más saturado/fiel al accent que antes del cambio.
- Con Theme blanco, la navbar sigue siendo oscura (no se invierte a clara).

**Validación**
- Manual: captura visual comparativa entre 3-4 themes representativos (uno saturado oscuro, uno claro tipo amarillo, uno gris neutro, y blanco) más el theme por defecto.

---

### TICKET-07 — Centralizar la regla "texto/iconos blancos sobre accent, excepto Theme blanco" en todos los componentes consumidores

**Tipo:** Button / UI / CSS
**Prioridad:** Alta
**Confianza:** Alta probabilidad (depende de que TICKET-04 se implemente primero; este ticket es la aplicación extendida a todos los consumidores, no solo los ya usan `--text-on-accent-aa`)

**Objetivo**
Auditar **todos** los componentes que pintan contenido (texto o `.icon` SVG) directamente sobre una superficie de color `--accent`/`--accent-soft`/`--accent-dim`, y asegurar que consuman el nuevo token `--on-accent` (TICKET-04) en vez de un color fijo o `currentColor` heredado incorrectamente, para que la regla sea automática y centralizada, sin condicionales repetidos por componente.

**Archivos involucrados**
- `styles.css` — consumidores identificados: `.btn-primary` (`color: var(--text-on-accent-aa)`), `.pill.active`, `.theme-btn--active`, `.pill-nav-item.active`, `.identity-chip--active` (actualmente usa `color: var(--accent)` como texto sobre fondo `--accent-soft`, **no** sobre accent puro — revisar si aplica), `.shop-tab.active`.

**Estado actual**
La mayoría de estos selectores ya usan `--text-on-accent-aa` (patrón correcto pero con valor fijo, resuelto en TICKET-04). Algunos, como `.identity-chip--active`, usan `color: var(--accent)` sobre un fondo `--accent-soft` (mezcla ~28%) — esto es un patrón distinto ("texto con el color del accent sobre fondo tenue", no "texto claro sobre accent sólido") y **no debe confundirse** con el caso que pide la regla de #FFFFFF/negro del prompt. Es necesario diferenciar ambos patrones antes de aplicar el reemplazo masivo.

**Hallazgo**
Aplicar ciegamente `--on-accent` a todo selector que mencione `--accent*` sería incorrecto: solo aplica a superficies donde el fondo **es** el accent (sólido o con alta opacidad) y el contenido necesita alto contraste de "on-color" (rol M3 `on-primary`); no aplica a texto que usa el accent como color decorativo sobre fondo neutro/oscuro (rol M3 `primary` usado como texto, no como superficie).

**Evidencia**
Comparación de dos patrones reales en `styles.css`:
- Patrón A (superficie): `.btn-primary { background: ...var(--accent)...; color: var(--text-on-accent-aa); }` → sí aplica `--on-accent`.
- Patrón B (texto con color de acento): `.nav-brand span { color: var(--accent); text-shadow: 0 0 20px var(--accent-glow); }` sobre fondo `.navbar` oscuro fijo → **no** aplica `--on-accent`, debe seguir usando `--accent` como color de texto.

**Implementación propuesta**
1. Listar exhaustivamente cada selector de `styles.css` que setea `color` y cuyo `background` (propio o del contenedor `.active`/`:hover` correspondiente) sea un rol `--accent*` de superficie (Patrón A) vs. cuyo `color` sea el accent sobre fondo neutro (Patrón B).
2. Para Patrón A: reemplazar el `color` fijo/`--text-on-accent-aa` por `--on-accent`.
3. Para Patrón B: no tocar.
4. Iconos SVG dentro de elementos Patrón A (`.icon` con `stroke: currentColor`/`fill: currentColor` por defecto, ver `.icon { stroke: currentColor }` en `styles.css`) heredan automáticamente el `color` del padre — confirmar que no hay overrides de `fill`/`stroke` hardcodeados a blanco dentro de esos componentes que ahora serían redundantes o (en el caso del Theme blanco) incorrectos. **Grep dirigido**: buscar `fill:#fff`, `fill: white`, `stroke: white` dentro de bloques `.btn-primary`, `.pill.active`, etc. — no se encontró ninguno explícito en la revisión actual (los iconos dentro de botones activos usan `currentColor` correctamente), por lo que este paso es de verificación, no de cambio esperado.

**Limpieza**
- Ninguna eliminación adicional más allá de los renombres de TICKET-04.

**Preservación**
- Elementos de marca con color fijo no theme-aware (`.sale-banner__badge` con `color: #120900` sobre `background: var(--gold)` fijo; `.hud-daily-btn` con `color: #120900` sobre `background: linear-gradient(#fbbf24,#f59e0b)` fijo) **no se tocan** — son superficies doradas de marca, no superficies "accent del theme del usuario".

**Criterios de aceptación**
- Con los 25 themes, todo botón/chip/indicador "activo" que use el accent como fondo sólido/alta-opacidad tiene texto e iconos legibles automáticamente, sin overrides manuales por theme.
- El Theme blanco produce texto oscuro únicamente en esos componentes de superficie, sin afectar textos que usan el accent como color decorativo.

**Validación**
- Manual, recorriendo cada componente de la lista en al menos 3 themes (uno oscuro saturado, uno claro, blanco).

---

### TICKET-08 — Actualizar swatches de `.theme-btn` y `.theme-grid` para 25 opciones sin duplicar hex en HTML

**Tipo:** UI / CSS
**Prioridad:** Media
**Confianza:** Confirmado (estado actual) / Alta probabilidad (solución)

**Objetivo**
Evitar una tercera fuente de verdad de colores: actualmente cada `.theme-btn` en `index.html` lleva `<span class="theme-swatch" style="background:#9b59ff;">` con el hex **repetido a mano** en el HTML, además de en `THEMES` (JS) y en `T` (script crítico). Con 25 themes, mantener esto sincronizado a mano es alto riesgo de error.

**Archivos involucrados**
- `index.html` (`.theme-grid`, sección `#profile-personalization`)
- `js/app.js` (posible renderizado dinámico del grid)

**Estado actual**
5 botones estáticos en HTML, cada uno con el hex inline en `style` y `data-theme`.

**Hallazgo**
Fuente de verdad triplicada (HTML inline, `THEMES` en JS, `T` en head). Cualquier ajuste de color a futuro requiere tocar 3 lugares.

**Evidencia**
`index.html`: `<button class="theme-btn" data-theme="violet"><span class="theme-swatch" style="background:#9b59ff;"></span>...`. (Hecho comprobado.)

**Implementación propuesta**
1. Renderizar `.theme-grid` dinámicamente desde `window.THEMES` en `js/app.js` (o en un módulo de inicialización de perfil), generando los 25 botones con `data-theme` y `background` del swatch tomado de `THEMES[key].accent`, en vez de HTML estático.
2. Mantener el `id`/estructura contenedora (`<div class="theme-grid" id="...">`) en `index.html` para que el JS inyecte el contenido.
3. Reconectar el listener de clic existente (`document.querySelectorAll('.theme-btn')...`) para que se registre **después** de renderizar los botones dinámicamente (mover dentro del mismo bloque de inicialización, o usar delegación de eventos sobre `.theme-grid` en lugar de listeners individuales — la delegación es más robusta ante re-render).

**Limpieza**
- Eliminar los 5 `<button class="theme-btn">` estáticos de `index.html`.
- Eliminar los `style="background:#hex"` inline.

**Preservación**
- Clase `.theme-btn--active` y su lógica de sincronización visual en `applyTheme()` deben seguir funcionando igual sobre los botones generados dinámicamente (mismo `data-theme` attribute, mismas clases CSS).

**Criterios de aceptación**
- El grid muestra 25 swatches correctos sin hex duplicado a mano en el HTML fuente.
- Cambiar un color en `THEMES` (JS) actualiza automáticamente el swatch sin tocar HTML.

**Validación**
- Manual: inspeccionar el DOM generado y confirmar 25 botones con `data-theme` únicos.

---

### TICKET-09 — Auditoría y limpieza final de referencias residuales a Themes antiguos

**Tipo:** Otro / Limpieza
**Prioridad:** Media
**Confianza:** Alta probabilidad (requiere grep completo del repo, incluyendo `games/`, no cubierto en profundidad por esta investigación)

**Objetivo**
Confirmar que no queda ninguna referencia textual a `violet`(viejo hex)/`pink`/`cyan`(viejo hex)/`gold`/`crimson` como identificadores de theme fuera de la migración de compatibilidad definida en TICKET-02, en todo el repositorio (incluyendo subcarpetas `games/*` no auditadas en detalle en esta investigación).

**Archivos involucrados**
- Todo el repo; específicamente se recomienda grep sobre `games/**/*.js` dado que `window.THEMES` es un contrato leído por minijuegos (documentado, pero el código real de cada juego no fue incluido en esta investigación — **Sospechoso/no confirmado**: no puedo afirmar qué juegos leen `THEMES` ni cómo, solo que el manual lo permite).

**Estado actual**
No determinable sin acceso al código fuente de cada juego bajo `games/`.

**Hallazgo**
Riesgo de regresión no cuantificable sin inspeccionar `games/*`. Se marca explícitamente como **pendiente de validación adicional**, conforme a la instrucción de no convertir hipótesis débiles en instrucciones de implementación firmes.

**Evidencia**
`docs/love-arcade-minigame-dev-manual.md` §8.3 documenta el patrón de lectura pero no lista qué juegos lo usan efectivamente.

**Implementación propuesta**
1. Ejecutar `grep -rn "THEMES\[" games/` y `grep -rn "data-theme" games/` (o equivalente) para identificar consumidores reales.
2. Para cada consumidor encontrado, confirmar que sigue funcionando con la nueva estructura de `THEMES[key] = { accent, name }` (la forma `.accent` se preserva por TICKET-02, así que en principio no requiere cambios en los juegos).
3. Si algún juego hardcodea uno de los 5 hex antiguos como fallback (`|| '#9b59ff'`, patrón mostrado en la documentación como ejemplo recomendado), **no es un bug** — es un fallback local del juego, no necesita actualizarse salvo que el equipo decida alinear visualmente los fallbacks a la nueva paleta (fuera de alcance de esta migración salvo indicación explícita).

**Limpieza**
- Ninguna acción de limpieza garantizada sin la auditoría; este ticket es principalmente de **verificación**.

**Preservación**
- No modificar código de `games/*` salvo que la auditoría confirme una ruptura real.

**Criterios de aceptación**
- Reporte de auditoría entregado confirmando ausencia de rupturas, o lista de archivos que sí requieren seguimiento en un ticket separado.

**Validación**
- Grep manual, sin test runner disponible.

---

## 4. Orden de implementación recomendado

`TICKET-01 → TICKET-02 → TICKET-03 → TICKET-04 → TICKET-05 → TICKET-06 → TICKET-07 → TICKET-08 → TICKET-09`

Justificación: primero la infraestructura de derivación de color (01), luego la migración de datos (02) y su réplica sin flicker (03), luego contraste dinámico (04) como prerrequisito de navbar (06) y de la limpieza de overrides (05), después navbar/pill-nav (06) y su extensión a todos los componentes (07), y por último limpieza de HTML estático (08) y auditoría final (09).

---

## 5. Resumen final de tickets

| Ticket | Prioridad | Confianza | Área | Dependencias | Riesgo |
|---|---|---|---|---|---|
| TICKET-01 | Crítica | Confirmado | Arquitectura/Design System | — | Medio (fórmula de color debe validarse visualmente en todos los themes) |
| TICKET-02 | Crítica | Confirmado | Theme/Migración | TICKET-01 | Alto (afecta persistencia de usuarios existentes; requiere fallback correcto) |
| TICKET-03 | Crítica | Confirmado | Arquitectura/CSS | TICKET-01, TICKET-02 | Medio (duplicación de lógica siempre es riesgo de desincronización futura) |
| TICKET-04 | Crítica | Confirmado (problema) / Alta probabilidad (solución) | Theme/Accesibilidad | TICKET-01 | Alto (contraste incorrecto es un bug visible e inmediato en el Theme blanco) |
| TICKET-05 | Alta | Confirmado | CSS | TICKET-04 | Bajo |
| TICKET-06 | Alta | Confirmado (problema) / Alta probabilidad (solución) | Navbar | TICKET-01 | Medio (ajuste visual iterativo, requiere validación de diseño) |
| TICKET-07 | Alta | Alta probabilidad | Button/UI | TICKET-04 | Medio (riesgo de aplicar la regla a selectores incorrectos — Patrón A vs B) |
| TICKET-08 | Media | Confirmado (problema) / Alta probabilidad (solución) | UI | TICKET-02 | Bajo |
| TICKET-09 | Media | Alta probabilidad | Otro/Limpieza | TICKET-02 | Bajo (pero cobertura incompleta sin acceso a `games/*`) |
