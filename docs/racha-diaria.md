# Daily Streak Hub — Investigación UX/Game Design + Especificación Técnica para Codex

---

## PARTE 1 — RESUMEN EJECUTIVO

**Problema actual (hecho comprobado):** El HUD (`.player-hud` en `index.html`) mezcla identidad (avatar, nickname, saludo, "En línea"), economía (saldo) y progresión (racha) en un solo bloque sin jerarquía clara. La racha es hoy un botón amarillo (`#btn-daily`) de 72×64px con una barra de 7 segmentos (`.streak-days`) casi decorativa. Nada comunica "esto es un sistema vivo que quiero mantener".

**Oportunidad:** El repo ya tiene toda la lógica de negocio necesaria y bien separada (`GameCenter.claimDaily/getStreakInfo/canClaimDaily`, hitos en `milestones-config.js`, motion tokens en `styles.css`). Falta exclusivamente la capa de presentación y de feedback. Es decir: el riesgo de este proyecto es 90% front-end/motion, no lógica de negocio — lo que reduce mucho el riesgo de regresión funcional.

**Visión propuesta:** Extraer la racha del "Player Hub" genérico y convertirla en un componente propio — el **Streak Hub** — con un fuego CSS/SVG vivo de 2 estados (available/claimed), un número de racha tratado como estadística de progreso, y una secuencia de reclamo con 3 fases (available → claiming → claimed) que reutiliza el motion vocabulary que el proyecto ya usa en otras partes (streakMilestonePop, confetti condicional, GPU-only transforms).

**Principios de diseño:** transform/opacity-only motion (regla ya establecida en el repo, ver `fixing-motion-performance` skill y comentarios "GPU-only" en `styles.css`), degradación explícita en `prefers-reduced-motion` y `pointer:coarse` (patrón ya usado extensivamente), cero dependencias nuevas.

---

## PARTE 2 — AUDITORÍA DEL ESTADO ACTUAL

### 2.1 Archivos involucrados (hecho comprobado)

| Archivo | Rol |
|---|---|
| `index.html` | Markup del HUD (`.player-hud`), botón diario, streak bar, countdown |
| `js/app.js` | `GameCenter.claimDaily/canClaimDaily/getStreakInfo/getNextDailyResetTime`, `updateDailyButton()`, `_setDailyMessage()`, `showDailyRepairModal()`, `showStreakMilestoneModal()` |
| `js/milestones-config.js` | `window.STREAK_MILESTONES` — catálogo de hitos (hoy solo 1: día 30) |
| `styles.css` | `.player-hud`, `.hud-daily-btn`, `.streak-day`, `.streak-milestone-*`, tokens de motion (`--motion-*`) |
| `docs/sistema-racha-diaria.md` | Documentación exhaustiva del sistema actual (día calendario flexible 03:00, reparación retroactiva, Bendición Lunar) |

### 2.2 Flujo de claim actual (hecho comprobado, desde `app.js`)

1. Click en `#btn-daily` → `disabled=true` síncrono (previene doble-tap).
2. `dataset.mode` decide rama: `'repair'` → abre `#daily-repair-modal`; si no, `GameCenter.claimDaily()`.
3. `claimDaily()` es **totalmente síncrono** (usa `_readTimeCache()`, no hace fetch) — esto es clave: **la interacción puede ser instantánea sin esperar red**, ideal para feedback inmediato.
4. Devuelve `{success, reward, baseReward, moonBonus, streak, verified, message}`.
5. `_setDailyMessage()` pinta `#daily-msg` (texto, sin animación de impacto).
6. `updateDailyButton()` recalcula estado.
7. Un listener inline en `index.html` hace `setTimeout(..., 80)` y llama `updateCountdownDisplay()` + `updateStreakBar()`.
8. Si tras esto hay un hito pendiente (`_getPendingStreakMilestone()`), se muestra `#streak-milestone-modal` (con `streakMilestonePop` keyframe, vibración `navigator.vibrate(12)` vía `_vibrateLight()`).

**Dato importante:** ya existe soporte de vibración háptica condicionada (`_canUseVibration()` chequea `navigator.userActivation`), y ya existe un patrón de "modal de recompensa" con animación pop + rewards list (`streak-milestone-*`). Esto es reutilizable para el nuevo "claim moment".

### 2.3 Economía de la racha (hecho comprobado)

- `CONFIG.dailyReward=20`, `dailyStreakStep=5`, `dailyStreakCap=60`.
- Bendición Lunar añade +90 fijo si activa.
- Reparación retroactiva por 500 monedas si `diffDays===2`.
- Hitos: array `STREAK_MILESTONES` (actualmente 1 solo, día 30, +3250 monedas +21 días de Bendición Lunar). **Diseñado para escalar** ("Añadir nuevos objetos al array").

### 2.4 Elementos candidatos a redundancia — análisis con evidencia

**"Bienvenid@ de vuelta" (`.hud-greeting` + `#pref-suffix`):**
Hecho: `applyIdentity()` solo escribe `gender` y `nickname` en el DOM; no hay otra lógica. Es puramente decorativo, sin dependencias funcionales fuera de sí mismo. **Inferencia:** puede eliminarse del HUD sin romper nada; el nickname (`#display-nickname`) en cambio sí es útil (aparece también en `#profile-title`, dos consumidores). **Recomendación:** eliminar el saludo del Hub top-of-fold; conservar el nickname pero reubicarlo (ver Parte 4).

**"En línea" (`.hud-status` + `.hud-status-dot`):**
Hecho: es 100% estático, sin binding a `navigator.onLine` ni a `Sentinel` — siempre dice "En línea" (ver `blink` keyframe, sin condicional JS). **Inferencia:** es un vestigio decorativo sin valor informativo real (no refleja sesión cloud, que ya tiene su propio indicador `.hud-cloud-sync-indicator` con lógica real vinculada a `la:synced`). **Recomendación: eliminar.** El indicador de sync cloud real ya cubre esa necesidad de "estado de conexión" con datos verídicos.

**Monedas dentro del Hub (`.hud-balance`):**
Hecho: `updateUI()` actualiza `.coin-display` tanto en `.navbar` como fuera de ella; hay múltiples consumidores del selector genérico `.coin-display`. Eliminar el `.hud-balance` específicamente **no rompe** `updateUI()` (itera sobre `querySelectorAll('.coin-display')`, no depende de IDs fijos). **Inferencia:** es información duplicada del navbar (`.coin-badge`), a 56px de distancia vertical. **Recomendación:** eliminar del Hub, pero el ticket debe verificar que ningún selector JS asume su existencia (evidencia: no hay `getElementById('hud-balance...')`, solo clase genérica → seguro eliminar).

### 2.5 Riesgos identificados

- `updateDailyButton()` escribe en `#hud-reward-amount` y `#hud-daily-label`, ambos dentro del botón actual. Si se rediseña el botón hay que preservar estos IDs o refactorizar la función junto con el HTML (documentar contrato).
- `_setDailyMessage` y `#daily-msg` tienen `aria-live="polite"` — debe preservarse para accesibilidad.
- El listener inline en `index.html` (`dailyBtn.addEventListener('click', ...)`) coexiste con el de `app.js`. Cualquier refactor de estructura del botón debe mantener ambos, o consolidarlos explícitamente (recomiendo consolidar, documentado en tickets).

---

## PARTE 3 — INVESTIGACIÓN UX / GAME DESIGN

*Nota de honestidad epistémica: lo siguiente es investigación externa / conocimiento general de patrones de la industria, no verificación de código específico de esos productos — se marca como tal.*

**Duolingo streak flame (investigación externa):** un icono de fuego con el número superpuesto/adyacente es hoy el estándar de facto para "racha". Funciona porque asocia una metáfora física (algo que se apaga si no se cuida) con pérdida potencial → loss aversion. *Qué NO copiar:* Duolingo usa notificaciones agresivas de "tu racha se va a apagar"; evitar tono de urgencia manipuladora, coherente con la petición explícita de "no dark patterns".

**Diseño de recompensa "loot" en juegos móviles (Genshin Impact daily check-in, Clash Royale chest):** el patrón común es: (1) el objeto de recompensa "vibra"/brilla antes de tocarlo (anticipación), (2) al tocar hay una micro-pausa (~80-150ms) antes de la explosión de partículas (deliberate delay aumenta percepción de peso/valor), (3) el número de recompensa aparece con un "count-up" nunca instantáneo. *Transferible:* el proyecto ya tiene `animateValue()` con ease-out cúbico para el contador de monedas — es exactamente ese patrón, ya implementado, solo falta conectarlo al claim.

**Habit loop (Nir Eyal, "Hooked" — marco conceptual conocido):** trigger → action → variable reward → investment. Aquí el trigger ya existe (botón visible + countdown), la acción ya es mínima (un tap), la "investment" es la racha acumulada. Lo que falta es que la "reward" se *sienta* variable/creciente incluso siendo determinista — esto se logra con presentación (el mismo +25 monedas se siente distinto si aparece con juice vs. como texto plano).

**Principio de "perceived responsiveness" (game feel, general):** dado que `claimDaily()` es síncrono, el juego puede permitirse una animación de claim *más larga* (300-500ms) sin sensación de lag, porque no hay espera de red real — la latencia percibida puede ser 100% diseñada, no impuesta por el backend.

**Recomendación de evitar dark patterns:** no implementar contadores de urgencia falsos, no penalizar visualmente al usuario "por no haber entrado ayer" más allá de mostrar honestamente el estado (esto ya es reforzado por el sistema de "reparación de racha" existente, que es pro-usuario).

---

## PARTE 4 — PROPUESTA DE EXPERIENCIA

### 4.1 Layout

```
┌─────────────────────────────────────┐
│  [avatar pequeño]  Nickname          │  ← identidad mínima, una línea
│  [cloud sync indicator si aplica]    │
├─────────────────────────────────────┤
│                                       │
│        🔥  (fuego CSS/SVG)           │
│        27 días                       │  ← número protagonista
│        "Racha activa"                │
│                                       │
│     [ CTA: Reclamar +25 monedas ]    │  ← solo visible si available
├─────────────────────────────────────┤
│  ░░░░░░░░░●○○  próximo hito: día 30  │  ← barra de progreso a milestone
└─────────────────────────────────────┘
```

Monedas y "en línea" se eliminan de este bloque (ya viven en navbar / indicador cloud real).

### 4.2 Estados

| Estado | Fuego | CTA | Copy |
|---|---|---|---|
| `available` | intensidad alta, partículas, pulso | botón visible, prominente | "Reclama tu racha" |
| `claiming` | flash breve + expansión | disabled, spinner mínimo | (transitorio, <400ms) |
| `claimed` | intensidad baja, calma | oculto/reemplazado por countdown | "Racha asegurada — vuelve en HH:MM:SS" |
| `repair` | fuego "parpadeante"/ámbar | botón "Reparar racha (500 🪙)" | reutiliza `showDailyRepairModal` existente |
| `milestone` | fuego + halo dorado momentáneo | — | reutiliza `#streak-milestone-modal` existente |

### 4.3 Motion design

**Fuego — loop base (idle, ambos sub-estados):**
- Técnica: CSS con 2-3 `::before/::after` + `filter: blur()` leve + `clip-path`/`border-radius` orgánico animado vía `@keyframes` sobre `transform` (scaleY, translateY) — nunca animar `width/height/top`.
- Duración de loop: 2.4–3.2s, `ease-in-out`, con 2 capas desfasadas en tiempo (`animation-delay`) para evitar sincronía robótica.
- Partículas (estado `available` únicamente): 3–6 `span` absolutos con `translate3d + opacity`, generados una vez en DOM (no recreados por frame), animación CSS con `animation-iteration-count: infinite` y `animation-delay` escalonado.
- `will-change: transform` solo mientras el componente está en viewport (IntersectionObserver, patrón ya usado en `shop-logic.js` `_preloadObserver`).

**Claim transition (available→claiming→claimed):**
1. `claiming` (0–120ms): scale 1→1.08 del contenedor fuego, `filter: brightness(1.3)`.
2. Flash (120–220ms): opacity pulse de un halo `::after` (radial-gradient), sin nuevos elementos DOM.
3. Coin feedback (220–500ms): reusar `animateValue` ya existente para el número de recompensa dentro del propio componente (no solo en navbar), con 3–5 "chips" de moneda que hacen `translate + fade` hacia el badge de saldo del navbar (feedback de "esto se fue a tu saldo").
4. `claimed` establecido a los ~500ms: transición cross-fade (opacity únicamente) del fuego a intensidad baja.

Coste: todo transform/opacity/filter sobre <10 elementos, cero reflow. Duración total ~500-600ms — coherente con "regla de los 300ms" del proyecto pero justificado por ser un momento de recompensa deliberado (no una interacción repetitiva).

**Streak number:** tipografía `--font-display`, tamaño ~2.2–2.8rem con `text-shadow`/glow sutil coherente con `.hud-balance-amount` existente. Al incrementar tras claim, usar `animateValue`-style count-up (reutilizar la función existente, no reinventar).

### 4.4 Audio

**Recomendación:** síntesis procedural vía Web Audio API (un par de osciladores + envolvente, ~20-40 líneas de JS, cero asset, cero latencia de descarga, sin problemas de autoplay porque se dispara en gesto de usuario — el propio click). Evita el riesgo de "asset de audio no cargó a tiempo" y no añade peso a `sw.js`/precache. Se implementa detrás de una preferencia (silenciable) y respeta que el usuario haya interactuado (ya lo hace, es un click).

**Alternativa descartada:** archivo de audio pregrabado — descartado porque añade un asset a mantener, a precachear en `sw.js`, y no aporta ventaja sobre síntesis simple para un "ding" de recompensa.

### 4.5 Fullscreen celebration

**No recomendado como P0/P1.** Puede justificarse únicamente para el hito de racha (evento raro, no diario) reutilizando el confetti ya existente en el proyecto (`shop-logic.js` `fireConfetti`, que ya tiene guards de `document.hidden`, dispositivo modesto, vista activa). Para el claim diario (evento frecuente, ~1/día), un efecto fullscreen sería fatiga visual, no "juice" — se descarta explícitamente.

---

## PARTE 5 — ARQUITECTURA TÉCNICA

**Elección: CSS puro + un pequeño helper JS para orquestar clases de estado**, sin Canvas ni SVG animado complejo, sin librerías nuevas.

Justificación:
- El repo ya tiene una convención fuerte "GPU-only, transform/opacity" en `styles.css` y en las skills del proyecto (`fixing-motion-performance`).
- El número de partículas necesario (3-6) es trivial para CSS puro; Canvas añadiría complejidad de rendering loop sin beneficio medible a esa escala.
- Web Audio API para el sonido (sin asset).
- JS solo gestiona: toggling de clases de estado (`data-streak-state="available|claiming|claimed"`), el count-up de recompensa (reusar `animateValue`), y el trigger de audio — todo consistente con patrones ya existentes en `app.js`.

---

## PARTE 6 — PERFORMANCE PLAN

- **Partículas:** máx. 6 elementos DOM estáticos reciclados (nunca `createElement` por frame).
- **Propiedades animadas permitidas:** `transform`, `opacity`, `filter` (blur/brightness) — nada de `width/height/top/left/margin/box-shadow` animado.
- **FPS objetivo:** 60fps en desktop/gama media; degradar a menos partículas y sin `filter:blur` en `pointer:coarse` de gama baja (mismo patrón que `mockup-bg-loading` en `pointer:coarse`, que ya reduce blur de 10px→3px).
- **`prefers-reduced-motion`:** el loop del fuego se detiene (`animation-play-state:paused`), pero el estado (available/claimed) se sigue comunicando por color/opacidad estática — igual que ya hace el proyecto con `.streak-day.today`.
- **Visibility:** pausar animaciones cuando `document.hidden` (patrón ya usado en `player-hud.motion-paused` vía `syncHudMotionVisibility`) y reutilizar ese mismo mecanismo para el nuevo componente.
- **Batería/gama baja:** heurística ya existente en el repo (`_isModestDevice()` en `shop-logic.js`, basada en `navigator.hardwareConcurrency`) puede reutilizarse para decidir número de partículas.

---

## PARTE 7 — TICKETS PARA CODEX

### TICKET-01 — Auditoría de dependencias del HUD antes de refactor
Tipo: Investigación | Prioridad: P0 | Dependencias: ninguna | Confianza: alta

**Objetivo:** Confirmar con grep exhaustivo que `.hud-greeting`, `.hud-status`, `.hud-balance` no tienen consumidores JS ocultos antes de eliminarlos.
**Evidencia:** `index.html` (markup), `app.js` (`updateUI`, `applyIdentity`).
**Implementación:** `grep -rn "hud-greeting\|hud-status\|hud-balance\|pref-suffix" .` en el repo; documentar resultado.
**Criterios de aceptación:** lista de archivos que referencian cada selector, con confirmación de que ninguno es crítico fuera del propio HUD.

### TICKET-02 — Nuevo markup del Streak Hub
Tipo: Frontend | Prioridad: P0 | Dependencias: TICKET-01 | Confianza: media

**Objetivo:** Reemplazar el bloque `.player-hud` actual por el nuevo layout (identidad mínima + fuego + número + CTA + progreso a hito).
**Estado actual:** `.player-hud` con `.hud-top`, `.hud-balance-row`, `.hud-streak`.
**Implementación:** Nuevo componente `.streak-hub` con `data-streak-state`. Preservar IDs consumidos por JS: `#btn-daily`, `#hud-reward-amount`, `#hud-daily-label`, `#daily-msg`, `#daily-countdown`, `#countdown-display`, `#streak-days`, `#streak-count` — o refactorizar sus consumidores en el mismo ticket si se renombran (documentar el contrato nuevo).
**Limpieza:** eliminar `.hud-greeting`, `#pref-suffix`, `.hud-status`, `.hud-status-dot`, `.hud-balance*` del HTML y su CSS asociado si quedan huérfanos.
**Preservación:** `aria-live="polite"` en mensajes, `aria-label` en botón diario.
**Validación:** revisar que `updateDailyButton()`, `updateStreakBar()`, `updateCountdownDisplay()` sigan funcionando sin cambios o con cambios documentados.

### TICKET-03 — Fuego CSS vivo (idle states)
Tipo: Motion | Prioridad: P0 | Dependencias: TICKET-02

**Objetivo:** Implementar animación de fuego en CSS puro con 2 estados de intensidad.
**Implementación:** capas `::before/::after` + `transform`-only keyframes, partículas como spans estáticos.
**Performance:** máx 6 partículas, `will-change` gestionado por IntersectionObserver, pausa en `document.hidden` y `prefers-reduced-motion`.
**Accesibilidad:** estado comunicado también por color/texto, no solo animación.

### TICKET-04 — Secuencia de claim (available→claiming→claimed)
Tipo: Motion + JS | Prioridad: P0 | Dependencias: TICKET-03

**Objetivo:** Orquestar transición de estados en el click handler existente de `#btn-daily` en `app.js`.
**Implementación:** clases de estado + reutilizar `animateValue` para el count-up local del número de recompensa.
**Preservación:** no romper el flujo síncrono existente de `claimDaily()`, `showDailyRepairModal()`, `showStreakMilestoneModal()`.

### TICKET-05 — Feedback de monedas hacia navbar
Tipo: Motion | Prioridad: P1 | Dependencias: TICKET-04

**Objetivo:** Chips visuales que viajan del Streak Hub al `.coin-badge` del navbar tras claim.
**Performance:** máx 5 elementos, transform/opacity only, cleanup con `animationend`.

### TICKET-06 — Sonido de claim (Web Audio API)
Tipo: Audio | Prioridad: P1 | Dependencias: TICKET-04

**Objetivo:** Sonido procedural breve al reclamar, silenciable, sin asset.
**Implementación:** oscilador(es) + envolvente en `AudioContext`, creado lazy en el primer click (evita restricciones de autoplay).

### TICKET-07 — Progreso visual hacia el próximo hito
Tipo: Frontend | Prioridad: P1 | Dependencias: TICKET-02

**Objetivo:** Barra/indicador que muestre racha actual vs. próximo hito de `STREAK_MILESTONES`.
**Evidencia:** `_getPendingStreakMilestone()` en `app.js`.

### TICKET-08 — Limpieza de CSS/HTML obsoleto
Tipo: Cleanup | Prioridad: P0 | Dependencias: TICKET-02

**Objetivo:** Eliminar clases y reglas CSS de `.hud-greeting`, `.hud-status*`, `.hud-balance*`, `.streak-day` legado si se reemplaza por nuevo indicador de progreso.
**Documentación:** actualizar `docs/sistema-racha-diaria.md` sección 9 (UX en pantalla de inicio) reflejando el nuevo componente.

### TICKET-09 — QA de rendimiento y reduced-motion
Tipo: QA | Prioridad: P0 | Dependencias: TICKET-03, TICKET-04

**Objetivo:** Verificar 60fps en gama media, comportamiento correcto en `prefers-reduced-motion` y `pointer:coarse`.
**Validación:** DevTools Performance panel, throttling CPU 4x.

---

## Orden recomendado de implementación

1. TICKET-01 (auditoría)
2. TICKET-02 (layout/markup)
3. TICKET-08 (cleanup, en paralelo a 02)
4. TICKET-03 (fuego idle)
5. TICKET-04 (claim sequence)
6. TICKET-07 (progreso a hito)
7. TICKET-05 (coin feedback)
8. TICKET-06 (audio)
9. TICKET-09 (QA/performance/accesibilidad)

Celebración fullscreen: descartada como P2, no recomendada salvo reutilizar el confetti ya existente exclusivamente para hitos (evento raro), nunca para el claim diario.
