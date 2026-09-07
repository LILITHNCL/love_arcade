# Daily Streak Hub — Informe técnico/UX y Root Cause Analysis

## 1. Resumen ejecutivo

**Problema:** el fuego, el número de racha y el texto de reclamo se ven apagados/sin urgencia, incluso cuando el bono sí está disponible.

**Causa raíz (dos bugs independientes que se combinan):**

- **BUG A — Estado mal clasificado en `streak-hub.js`:** cuando la racha vale `0` y SÍ se puede reclamar, el código la marca como `'locked'` en vez de `'available'`, aplicando `grayscale(0.55) brightness(0.62)` al fuego y color `--text-mute` al número — el mismo tratamiento visual que un fuego realmente bloqueado.
- **BUG B — Doble sistema de opacidad, uno de ellos sin relación con el estado real "disponible":** `app.js::updateDailyButton()` aplica **una opacidad inline (`btn.style.opacity = '0.5'`)** sobre **todo** el botón `#btn-daily` (fuego + número + texto "Toca para reclamar") cada vez que `canClaimDaily()` es `false` — es decir, la mayor parte del tiempo que un usuario abre la app (ya reclamó hoy). Esa opacidad de 0.5 se **suma** encima del propio atenuado que ya aplica el CSS de `data-state="claimed"`, y además es el **único** mecanismo que atenúa el texto del CTA, que no tiene ninguna regla CSS ligada a `data-state`.

**Impacto:** el widget nunca comunica con claridad "disponible ahora"; en el estado más común (ya reclamado) se ve doblemente apagado, y en el caso de racha 0 disponible se ve directamente como bloqueado.

**Solución recomendada:** eliminar el control de opacidad JS del botón completo (dejar que sólo el CSS por `data-state` gobierne la intensidad visual de fuego/número, y dar al CTA su propia regla por estado), y corregir la rama `streak === 0 && can` para que mapee a `'available'`.

**Prioridad:** P0 ambos — son la causa directa del bug reportado.

---

## 2. Auditoría técnica

### Componentes/archivos involucrados
- `streak-hub.js` → `_syncFlameState()` (deriva `data-state` desde `GameCenter`), `playClaimSequence()`.
- `app.js` → `GameCenter.canClaimDaily()`, `GameCenter.getStreakInfo()`, `_getDailyRepairState()`, `updateDailyButton()`, listener de click de `#btn-daily`, `revealUI()`.
- `styles.css` → bloque `DAILY STREAK HUB — Fire Widget` (líneas ~1188–1536), reglas `.streak-flame[data-state=...]`, `.streak-hub-number__value`, `.streak-hub-cta:disabled`.
- `index.html` → markup de `#btn-daily`/`#streak-flame`/`.streak-hub-number`/`.streak-hub-copy`, script inline de arranque síncrono.

### Flujo de estado real (fuente de verdad)
`store.daily = { lastClaim, streak }` →
- `canClaimDaily()`: `true` si `lastClaim === 0`, o si `diffDays >= 1` y no hay desync de reloj.
- `getStreakInfo()`: devuelve `{ streak, nextReward, canClaim, repairAvailable, ... }`, donde `streak` es el valor **ya acumulado** (no incrementado hasta reclamar).
- `_getDailyRepairState().repairAvailable`: `lastClaim > 0 && streak > 0 && diffDays === 2`.

### Dos consumidores independientes de este estado (evidencia del conflicto)

| Consumidor | Qué controla | Cómo decide |
|---|---|---|
| `streak-hub.js::_syncFlameState()` | `data-state` en `#streak-flame` → dispara CSS de fuego + número | `repairAvailable` → `'repair'`; `streak===0 && can` → `'locked'`; `can` → `'available'`; si no → `'claimed'` |
| `app.js::updateDailyButton()` | `btn.style.opacity` inline en **todo** `#btn-daily` (fuego + número + texto CTA) | `enabled = repairMode ? canAffordRepair : can` → `opacity = enabled ? '1' : '0.5'` |

Estos dos sistemas nunca se leen entre sí ni se coordinan. El CSS de `data-state="claimed"` ya está diseñado para verse "vivo pero calmado" (comentario textual en `styles.css` línea 1340: *"Estado: claimed (ya reclamado hoy) — vivo pero calmado"*), pero `updateDailyButton()` le resta encima un 50% de opacidad plano sin saberlo.

### Causas descartadas (comprobado que NO son la causa)
- No hay overlay, pseudo-elemento ni z-index compitiendo sobre `.streak-flame`/`.streak-hub-number` (`::before`/`::after` sólo existen en `.player-hud`, para textura de fondo, y no cubren el CTA).
- `.streak-hub-cta:disabled { cursor: not-allowed; }` no afecta opacidad — no es de ahí.
- No existe ningún `button:disabled`/`*:disabled` genérico en la hoja de estilos.
- La estructura `#streak-flame + .streak-hub-number` (hermanos adyacentes) es correcta; el selector `#streak-flame[data-state="claimed"] + .streak-hub-number ...` sí aplica al elemento correcto.
- `.player-hud { opacity:0 } / .is-ready { opacity:1 }` es un mecanismo anti-flicker de carga que sí se resuelve de forma síncrona vía `revealUI()`, llamado en el orden correcto (`updateStreakBar()` → `updateCountdownDisplay()` → `revealUI()`). Comprobado en `app.js` con `INFERENCIA` de baja probabilidad como causa persistente, ya que el propio flujo está documentado y diseñado para evitar justamente ese problema.

---

## 3. Root Cause Analysis

1. **¿Qué determina que la racha esté disponible?** `GameCenter.canClaimDaily()` (HECHO).
2. **¿Qué determina la apariencia?** Dos cosas simultáneas y desacopladas (HECHO):
   - `data-state` en `#streak-flame`, calculado por `streak-hub.js`.
   - `btn.style.opacity` inline en `#btn-daily`, calculado por `app.js::updateDailyButton()`.
3. **¿Dónde se rompe la correspondencia entre estado funcional y estado visual?**
   - Caso racha = 0 y disponible: `streak-hub.js` clasifica como `'locked'` (HECHO — bug de lógica, línea `info.streak === 0 && can`). El CSS de `'locked'` fue diseñado para "nunca reclamado", pero se dispara también cuando SÍ es reclamable.
   - Caso general (cualquier racha, ya reclamada hoy — el estado en que un usuario ve el HUD la mayor parte del tiempo): `updateDailyButton()` pone `opacity:0.5` sobre el botón completo, apilándose sobre el propio atenuado ya calculado por el CSS de `data-state="claimed"` (HECHO, por inspección directa de ambas reglas actuando sobre el mismo elemento).
   - El texto del CTA (`streak-hub-copy` / `hud-daily-cta-text`) no tiene **ninguna** regla propia por estado en `styles.css` (HECHO, confirmado por grep): su única señal visual de "disponible vs. no disponible" es esa opacidad inline de `updateDailyButton()`. Por eso "las indicaciones para reclamar tienen poca presencia visual": literalmente dependen de un booleano binario 1/0.5 sin ningún refuerzo de color, peso o animación.
4. **¿Por qué persiste tras reload/navegación?** Porque no es un estado transitorio: `updateDailyButton()` se ejecuta de forma síncrona en cada carga (línea 2389 de `app.js`) y recalcula `opacity` a partir del mismo `canClaimDaily()`, que la mayor parte de una sesión de usuario será `false` (ya reclamado hoy) → siempre volverá a aplicar 0.5. No es un glitch de un solo frame (HECHO).
5. **¿Por qué afecta a rachas cortas y largas por igual?** Porque `updateDailyButton()` no lee `streak` en absoluto para decidir la opacidad — sólo lee `enabled` (derivado de `canClaimDaily`/reparación). El valor de racha es irrelevante para este bug (HECHO); por eso el atenuado ocurre igual en 0, 1, 4 o 112 días.

**Nota sobre el caso "disponible pero se ve apagado" (HIPÓTESIS, requiere validación):** con el código estático no puedo reproducir en vivo el escenario exacto de QA que originó el reporte. La hipótesis más consistente con la evidencia es que la mayoría de las observaciones de "se ve apagado incluso disponible" corresponden en realidad al estado `'claimed'` doblemente atenuado (bug B) — que es visualmente muy parecido al deseado para `'available'` una vez que la opacidad inline al 0.5 reduce también el brillo del fuego dorado — y que además, al no haber ninguna transición de color/peso en el texto CTA, un usuario no distingue con confianza cuál de los dos estados está viendo. Recomiendo validar en vivo (colocar `store.daily = {lastClaim:0, streak:N}` en distintas combinaciones) al implementar la corrección, como parte del QA del ticket.

---

## 4. Recomendación UX

| Estado | Fuego | Número | CTA / texto |
|---|---|---|---|
| `available` | Máxima intensidad (glow actual, sin filtro) | Gradiente dorado completo, con leve pulso/glow adicional para reforzar urgencia | Texto con color de acento/dorado, peso alto, posible micro-animación sutil (p. ej. `streakPulse` ya existente) |
| `claimed` | Vivo pero calmado (CSS actual, **sin** opacidad extra) | Gradiente plateado calmado (ya existe) | Texto neutro tipo "Racha asegurada hoy", **sin** opacidad reducida — se diferencia por color/copy, no por transparencia |
| `locked` (primera vez, streak=0, **no** disponible aún — sólo si esto existe como estado real distinto de "streak 0 disponible") | Atenuado (CSS actual) | Atenuado | Copy explicando cuándo se desbloquea |
| `claiming` | Burst existente (`flameBurst`) | Bump existente | — |
| `repair` | Ámbar de alerta (ya existe) | — | Copy de reparación (ya existe) |

Jerarquía visual objetivo: **fuego > número > CTA > resto del Player Hub**, y la diferencia entre `available` y `claimed` debe leerse por **color/copy**, no por transparencia — la opacidad reduce simultáneamente legibilidad y sensación de "vivo", que es justo lo que el diseño de `claimed` quiere evitar según su propio comentario en el CSS.

---

## 5. Recomendación técnica

**Imprescindible para corregir el bug (P0):**
- Eliminar por completo el control de `btn.style.opacity` en `updateDailyButton()` (y en el listener de click de `#btn-daily`, línea ~2515 de `app.js`) como mecanismo de expresión visual de "disponible/no disponible". El único propósito legítimo que le queda a ese código es el anti-double-tap síncrono al hacer click — eso puede resolverse con `disabled = true` solamente (ya lo hace), sin tocar `opacity`.
- Corregir `streak-hub.js`: la rama `info.streak === 0 && can` debe mapear a `'available'`, no a `'locked'`. Si de verdad se quiere un estado visual distinto para "primera racha nunca establecida", debe definirse como un data-state propio (`data-state="first-claim"` o similar) con su propia paleta viva — nunca reutilizar el filtro de `'locked'`, que está pensado para "no disponible".
- Dar a `.streak-hub-copy` / `#hud-daily-cta-text` reglas CSS explícitas por `data-state` (heredando el patrón ya usado en `.streak-hub-number__value`), para que deje de depender de la opacidad inline eliminada.

**Mejoras UX recomendadas (P1):**
- Reforzar visualmente `available` más allá de "no tiene filtro": un leve glow pulsante o escala periódica en el fuego (ya existe `streakPulse`, reutilizable) para comunicar urgencia sin animar constantemente el layout.
- Cambiar el copy de `claimed` a algo afirmativo ("Racha asegurada hoy") en vez de dejar sólo "Toca para reclamar" fijo — hoy el texto no cambia entre estados salvo en modo reparación.

**Opcionales (P2):**
-微-transición de color en el número al cambiar de estado (adicional al bump ya existente en el claim).
- Revisar si el `text-shadow`/glow del número en `available` puede intensificarse ligeramente para mayor contraste en pantallas de bajo brillo.

---

## 6. Tickets para Codex

### TICKET-01 — Eliminar la opacidad inline duplicada del botón de racha
**Tipo:** Bugfix
**Prioridad:** P0
**Dependencias:** ninguna
**Confianza:** Alta

**Objetivo**
Que `#btn-daily` deje de recibir una opacidad inline vía JS que compite con el sistema de `data-state` de `streak-hub.js`.

**Contexto**
`updateDailyButton()` en `app.js` y el listener de click de `#btn-daily` fijan `btn.style.opacity = '0.5'` cada vez que el bono no está disponible (la mayoría del tiempo de uso real). Esto se apila sobre el propio atenuado ya calculado por el CSS de `data-state="claimed"`/`"locked"`, produciendo un doble oscurecido no intencional, y es el único mecanismo que atenúa el texto del CTA (que no tiene reglas propias).

**Estado actual**
- `app.js` línea ~2111: `btn.style.opacity = enabled ? '1' : '0.5';`
- `app.js` línea ~2515 (listener de click, paso "desactivar de inmediato"): `dailyBtn.style.opacity = '0.5';`

**Evidencia**
`updateDailyButton()` (app.js, función completa citada en la auditoría técnica); `.streak-flame[data-state="claimed"]`/`"locked"` en `styles.css` (líneas 1322–1349), que ya reducen brillo/saturación por sí solos.

**Implementación**
- Eliminar ambas asignaciones de `btn.style.opacity`.
- Conservar `btn.disabled = !enabled;` en ambos sitios (necesario para bloquear clicks y para el anti-double-tap síncrono).
- Conservar `btn.style.cursor` si se desea (no es visualmente problemático), o migrarlo a la clase `:disabled` ya existente en CSS (`.streak-hub-cta:disabled { cursor: not-allowed; }`), eliminando también esa línea inline por consistencia.

**Comportamiento esperado**
El brillo/intensidad del botón depende únicamente del `data-state` de `#streak-flame` (Ticket-02) y de las nuevas reglas del CTA (Ticket-03). El botón sigue quedando no clickeable cuando corresponde, pero sin oscurecerse doblemente.

**Estados**
Afecta a todos los estados por igual (elimina un multiplicador global).

**Performance**
Ninguna implicación — es una eliminación de código, no una animación nueva.

**Cleanup**
Eliminar las dos líneas `btn.style.opacity = ...`. Verificar que ningún otro punto del código (buscar `style.opacity` sobre `#btn-daily`/`dailyBtn`) reintroduzca el patrón.

**Preservación**
No debe romperse el anti-double-tap: `disabled = true` debe seguir aplicándose de forma síncrona en el click antes de `claimDaily()`.

**Criterios de aceptación**
- `#btn-daily` nunca tiene `style.opacity` fijado por JS en ningún estado.
- El botón sigue sin ser clickeable cuando `enabled === false`.

**Validación / QA**
Simular `store.daily` con racha 0/1/112, disponible y ya reclamada; confirmar en devtools que `#btn-daily` no tiene atributo `style` con `opacity`.

**Riesgos**
Bajo. Único riesgo es que algún test o snapshot dependa del valor de opacidad inline (revisar `daily-streak-hub-qa.mjs` / `player-hud-static-qa.mjs` antes de mergear).

---

### TICKET-02 — Corregir la clasificación de estado "racha 0 disponible"
**Tipo:** Bugfix
**Prioridad:** P0
**Dependencias:** Ticket-01 (para que el efecto visual sea evaluable sin el ruido de la opacidad duplicada)
**Confianza:** Alta

**Objetivo**
Que una racha en 0 que SÍ puede reclamarse se muestre como `available`, no como `locked`.

**Contexto**
`_syncFlameState()` en `streak-hub.js` marca `state = 'locked'` cuando `info.streak === 0 && can`, aplicando el mismo filtro de "bloqueado" (`grayscale(0.55) brightness(0.62)`) que usaría un estado realmente no disponible.

**Estado actual**
```js
} else if (info.streak === 0 && can) {
  state = 'locked';
} else if (can) {
  state = 'available';
}
```

**Evidencia**
`streak-hub.js`, función `_syncFlameState()`; `styles.css` líneas 1322–1331 (`data-state="locked"`).

**Implementación**
- Fusionar la condición: cualquier `can === true` (independiente de `streak`) debe mapear a `'available'`, salvo `repairAvailable`.
- Si el negocio requiere una experiencia visual distinta para "primera vez que se establece una racha" (streak=0, disponible), no reutilizar `'locked'`: introducir un `data-state` nuevo con su propia regla CSS visualmente viva (ver Ticket-04), no el filtro de apagado.
- `'locked'` como estado real (streak=0 y NO disponible) sólo puede ocurrir si existe alguna razón de negocio para bloquear el primer reclamo — confirmar con producto si ese caso existe en la app actual; si no existe ningún camino donde `streak===0 && !can`, considerar si `'locked'` sigue siendo necesario como estado (ver Cleanup).

**Comportamiento esperado**
Con `streak=0` y `canClaimDaily()=true`, el fuego se renderiza con la paleta de `available` (o la nueva paleta dedicada), nunca con `grayscale`/`brightness(0.62)`.

**Estados**
`locked`, `available`, `claimed`, `claiming`, `repair` — sin cambios en sus nombres, sólo en la condición que dispara `locked` vs `available`.

**Cleanup**
Si tras confirmar con producto no existe ningún escenario real de `streak===0 && !can`, evaluar eliminar el estado `'locked'` y su CSS asociado (líneas 1322–1331) por código muerto; si sí existe, dejarlo pero ya no debe dispararse para racha disponible.

**Preservación**
No debe alterarse la lógica de `repairAvailable` (se evalúa primero y no se toca).

**Criterios de aceptación**
- `streak=0, can=true` → `data-state="available"`.
- `streak=0, can=false` (si el caso existe) → sigue en `'locked'`.

**Validación / QA**
Forzar `store.daily = {lastClaim:0, streak:0}` y comprobar visualmente que el fuego se ve intenso, no apagado.

**Riesgos**
Bajo-medio: depende de si algún otro componente (calendario semanal, milestones) asume que `streak===0` siempre implica visual "locked". Revisar `.streak-day`/`streak-calendar` por si acoplan a esa suposición.

---

### TICKET-03 — Estilos por estado para el texto del CTA
**Tipo:** UX / Bugfix
**Prioridad:** P0 (depende de Ticket-01 para tener sentido; sin él el CTA queda sin ninguna señal de estado)
**Dependencias:** Ticket-01
**Confianza:** Alta

**Objetivo**
Que `.streak-hub-copy` / `#hud-daily-cta-text` tengan una jerarquía visual propia por `data-state`, ya que hasta ahora dependían exclusivamente de la opacidad inline eliminada en Ticket-01.

**Contexto**
`grep` confirma que no existe ninguna regla `.streak-hub-copy[...]` ni selector derivado de `data-state` para el CTA en `styles.css`.

**Evidencia**
Bloque `.streak-hub-copy` / `.streak-hub-copy__amount` (styles.css, líneas 1466–1480); patrón ya usado en `.streak-hub-number__value` con selector `#streak-flame[data-state="..."] + .streak-hub-number ...` como referencia de implementación.

**Implementación**
- Usar el mismo patrón de selector hermano (`#streak-flame[data-state="..."] ~ .streak-hub-copy` o adaptar el markup si el `<p class="streak-hub-copy">` no es hermano directo — confirmar en `index.html`, línea ~376, que sí lo es dentro del mismo `<button>`).
- `available`: color de acento/dorado, peso alto (ya lo tiene por defecto, reforzar contraste).
- `claimed`: color neutro calmado (no gris apagado) + copy alternativo ("Racha asegurada hoy") gestionado desde `updateDailyButton()`/`_syncFlameState()`.
- `repair`: mantener el copy de reparación ya existente (`updateDailyButton()` ya lo gestiona).

**Comportamiento esperado**
El texto del CTA cambia de color/peso/copy según el estado real, sin depender de opacidad.

**Accesibilidad**
Mantener contraste AA mínimo en todos los estados (verificar contra fondo `--solid-surface-float`).

**Cleanup**
Ninguno adicional a lo ya cubierto en Ticket-01.

**Criterios de aceptación**
- En `claimed`, el texto es legible y visualmente distinto (no simplemente "más tenue") del texto en `available`.

**Validación / QA**
Revisión visual en ambos estados + contraste con herramienta de accesibilidad (axe/Lighthouse).

**Riesgos**
Bajo.

---

### TICKET-04 (opcional, P1) — Reforzar la lectura de "disponible ahora"
**Tipo:** UX
**Prioridad:** P1
**Dependencias:** Ticket-01, Ticket-02
**Confianza:** Media

**Objetivo**
Aumentar la sensación de urgencia/recompensa del estado `available` más allá de "sin filtro aplicado".

**Contexto**
El estado `available` hoy es simplemente la ausencia de filtro — no tiene ningún refuerzo activo (glow pulsante, animación) que lo distinga proactivamente de un estado neutro.

**Implementación**
Reutilizar el keyframe `streakPulse` ya existente (usado en `.streak-day.today`) aplicado al glow del fuego en `data-state="available"`, respetando `prefers-reduced-motion` (ya hay un media query global que apaga animaciones del fuego, verificar que cubra esta nueva regla).

**Performance**
Sólo animar `box-shadow`/`filter` de un elemento (no toda la escena); pausar con `.player-hud.motion-paused` (patrón ya existente) y `prefers-reduced-motion`.

**Criterios de aceptación**
No debe animar cuando `prefers-reduced-motion: reduce` ni cuando la pestaña está oculta.

**Riesgos**
Bajo — es aditivo y opcional.

---

## Orden recomendado de implementación

1. **Ticket-01** (elimina el ruido de la opacidad duplicada — sin esto, cualquier verificación visual de los demás tickets es engañosa).
2. **Ticket-02** (corrige la clasificación de estado para racha 0 disponible).
3. **Ticket-03** (da al CTA su propia señal visual por estado, ahora que ya no depende de la opacidad eliminada).
4. **Ticket-04** (mejora opcional de refuerzo visual, no bloqueante).
5. QA final cruzando los tres estados (`available`/`claimed`/`repair`) × valores de racha representativos (0, 1, 4, 112) × reload y navegación entre vistas.
