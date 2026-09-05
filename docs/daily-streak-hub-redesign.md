# Daily Streak Hub — Investigación UX/Game Design + Especificación de Implementación
### Love Arcade · Documento maestro para Codex

**Cómo leer este documento:** cada afirmación está etiquetada como uno de estos cuatro tipos, tal como se pidió explícitamente:

- **[HECHO]** — verificado directamente en el código del repositorio que se me proporcionó.
- **[INFERENCIA]** — conclusión razonable derivada de hechos comprobados en el propio repo.
- **[HIPÓTESIS]** — propuesta de diseño que aún debe validarse con datos reales de producto (analítica, testing con usuarios).
- **[EXTERNO]** — conocimiento general de la industria (game UX, psicología de producto). No proviene de una búsqueda web en vivo en esta sesión; es conocimiento de dominio consolidado (Duolingo, Candy Crush, Genshin Impact, Clash Royale, Marvel Snap, etc.), presentado con honestidad epistémica y sin pretender ser una cita verificada.

Ningún archivo, función o API mencionados aquí es inventado: todo el código citado con ruta de archivo proviene literalmente de los documentos entregados (`index.html`, `js/app.js`, `js/spa-router.js`, `js/milestones-config.js`, `styles.css`, `docs/sistema-racha-diaria.md`, `docs/DOCUMENTACION.md`).

---

## PARTE 1 — RESUMEN EJECUTIVO

### Problema actual [HECHO + INFERENCIA]

El `.player-hud` actual (`index.html`, sección `<div class="player-hud">`) mezcla siete responsabilidades distintas en un solo bloque visual:

1. Avatar + anillo decorativo (`.hud-avatar-wrap`, `.hud-avatar-ring`)
2. Saludo genérico + nickname (`Bienvenid<span id="pref-suffix">@</span> de vuelta` + `#display-nickname`)
3. Indicador "En línea" (`.hud-status-dot` + texto `En línea`)
4. Indicador de sincronización cloud (`#cloud-sync-indicator`)
5. Saldo de monedas (`.hud-balance-amount` con `.coin-display`)
6. Botón de bono diario (`#btn-daily`, `#hud-reward-amount`, `#hud-daily-label`)
7. Countdown + barra de racha de 7 segmentos (`#daily-countdown`, `#streak-days`, `#streak-count`)

**[HECHO]** El saldo de monedas ya se muestra, de forma independiente, en la navbar superior (`<header class="navbar">` → `.coin-badge .coin-display`), visible en las tres vistas de la SPA (`js/app.js`, `updateUI()`, selecciona `.navbar .coin-display` como `navbarDisplays`). Por tanto, el saldo dentro del HUD es literalmente el mismo número repetido dos veces en la misma pantalla.

**[HECHO]** El punto+texto "En línea" (`.hud-status`, `.hud-status-dot`) no está enlazado a ninguna señal real de conectividad. Revisé `js/app.js`, `js/spa-router.js`, `js/push-notifications.js` y el `SentinelCloudSync` IIFE completo: no existe ningún `navigator.onLine`, `online`/`offline` listener, ni comprobación de estado de red que escriba en `.hud-status-dot` o `.hud-status`. Solo tiene una animación CSS `blink` decorativa (`styles.css`). **Es un indicador falso**: siempre dice "En línea" incluso sin conexión. Esto es peor que redundante — es información potencialmente engañosa.

**[HECHO]** La racha (el elemento que el negocio quiere que sea protagonista, según `docs/sistema-racha-diaria.md`: *"La racha diaria es un sistema de retención"*) ocupa visualmente la fila más pequeña y menos jerárquica del HUD: `.hud-streak` es una fila de 6px de alto (`.streak-day { height: 6px }`) con un contador de texto de 0.72rem (`.streak-count`). El botón de reclamo (`.hud-daily-btn`) es un cuadrado de 72px sin ninguna narrativa visual de "fuego vivo" ni de progreso.

**[HECHO — bug real]** `showStreakMilestoneModal()` (`js/app.js`) se invoca en `DOMContentLoaded` y recursivamente dentro de su propio botón de reclamo de hito, pero **nunca se llama dentro del handler de clic de `#btn-daily`** tras un `claimDaily()` exitoso. Esto significa que si un usuario alcanza el día 30 (el único hito definido hoy en `js/milestones-config.js`, `streak_30d_lunar_01`) reclamando su bono diario, el modal de celebración de hito **no aparece en ese momento** — solo aparecerá la próxima vez que la página cargue de cero. Es una discontinuidad de reward feedback que rompe exactamente el momento de mayor impacto emocional que este proyecto quiere lograr.

### Oportunidad

Convertir esta zona en un **"Daily Streak Hub"**: un componente donde el fuego + el número de racha son el centro visual absoluto, el resto de información secundaria (avatar, nickname) se reduce a una fila mínima de contexto, y toda la información duplicada o no-funcional (monedas, "En línea") se retira porque ya vive en otro lugar de la interfaz o no aporta nada real.

### Visión propuesta

Un widget de fuego vivo (SVG + CSS, sin dependencias nuevas, sin Canvas, sin librerías) con 4 estados (`locked`, `available`, `claiming`, `claimed`), acompañado por un número de racha tratado como estadística de videojuego (tipografía grande, tabular, con badge de "días"), una micro-barra semanal de progreso debajo, un countdown reformulado como "temporizador de HUD", y una secuencia de reclamo con: burst del fuego → monedas volando hacia el saldo real de la navbar → sonido sintetizado por Web Audio API → vibración táctil (reutilizando la función ya existente `_vibrateLight()`).

### Principios de diseño

1. **Jerarquía brutal**: solo debe haber UN elemento que grite en esta zona — el fuego + el número. Todo lo demás susurra.
2. **Vivo, no animado por animar**: el fuego respira en reposo; solo se vuelve "ruidoso" cuando hay algo que reclamar.
3. **GPU-only, siempre**: solo `transform` y `opacity` para cualquier cosa que se ejecute en bucle infinito; `filter: blur()` solo en elementos estáticos de bajo coste y reducido en `pointer: coarse`.
4. **Cero nuevas dependencias**: SVG inline + CSS + Web Audio API nativa. Coherente con la filosofía "Add a runtime dependency only when..." de `AGENTS.md`.
5. **Nada se rompe**: los IDs (`#btn-daily`, `#hud-reward-amount`, `#hud-daily-label`, `#daily-msg`, `#daily-countdown`, `#countdown-display`, `#streak-days`, `#streak-count`) se preservan exactamente donde el JS existente los busca, para que `updateDailyButton()`, `updateStreakBar()` y `updateCountdownDisplay()` seguir funcionando sin reescritura.

### Experiencia objetivo

- **Con racha disponible:** *"Tengo que tocar esto."* → fuego intenso, número grande vibrante, glow pulsante.
- **Con racha reclamada:** *"Mi racha está viva y seguirá mañana."* → fuego calmado pero nunca apagado.
- **Al reclamar:** *"¡Acabo de conseguir algo de verdad!"* → burst + monedas volando + sonido + haptic + (si aplica) modal de hito inmediato.

---

## PARTE 2 — AUDITORÍA DEL ESTADO ACTUAL

### 2.1 Archivos involucrados [HECHO]

| Archivo | Responsabilidad relevante |
|---|---|
| `index.html` | Markup de `.player-hud`, script inline con `updateStreakBar()`, `updateCountdownDisplay()`, `window.HomeView`, listener de `#btn-daily` (solo refresco visual tras 80ms) |
| `js/app.js` | `GameCenter.claimDaily()`, `canClaimDaily()`, `getStreakInfo()`, `repairDailyStreak()`, `updateDailyButton()`, `updateMoonBlessingUI()`, listener principal de `#btn-daily` (lógica de negocio completa), `showStreakMilestoneModal()`, `showDailyRepairModal()`, `_vibrateLight()`, `_canUseVibration()`, `applyIdentity()` |
| `js/milestones-config.js` | `window.STREAK_MILESTONES` — catálogo de hitos, hoy solo el de 30 días |
| `styles.css` | `.player-hud`, `.hud-*`, `.streak-*`, `.daily-repair-*`, `.streak-milestone-*`, sistema de tokens `--accent*`, easing `cubic-bezier(0.34, 1.56, 0.64, 1)` ya usado en `.identity-chips` |
| `js/spa-router.js` | Llama `window.HomeView.onEnter()/refresh()/onLeave()` en cada navegación a Inicio; pausa/reanuda `AppScheduler` grupo `countdown` |
| `js/lifecycle-scheduler.js` | `window.AppScheduler` — sistema de timers con pausa automática por `visibilitychange`/`pagehide`/vista activa |
| `docs/sistema-racha-diaria.md` | Documentación técnica completa del sistema de racha (reglas de negocio, seguridad horaria, UX actual, riesgos) |

### 2.2 Flujo actual de claim [HECHO]

```
Usuario toca #btn-daily
  → (index.html inline) [sin acción inmediata, solo listener secundario]
  → (js/app.js, DOMContentLoaded) listener principal:
      1. dailyBtn.disabled = true (síncrono, previene doble-tap)
      2. dailyBtn.style.opacity = '0.5'
      3. if (dataset.mode === 'repair') → showDailyRepairModal(); return
      4. result = GameCenter.claimDaily()   [síncrono, sin red]
      5. if (result.repairRequired) → showDailyRepairModal()
         else → _setDailyMessage(result.message, result.success)
      6. updateDailyButton()
  → (index.html inline listener secundario, +80ms)
      updateCountdownDisplay(); updateStreakBar();
```

**[HECHO]** `claimDaily()` es completamente síncrono (no `async`), lee un caché de tiempo de red (`_readTimeCache()`) sin bloquear. Esto es una ventaja crítica para el nuevo diseño: **podemos animar la respuesta de reclamo de forma instantánea sin esperar ningún `await`**, porque el resultado ya está disponible en el mismo tick de ejecución.

**[HECHO]** `GameCenter.getMoonBlessingStatus()` afecta el monto mostrado (`+90` extra) — cualquier composición visual del "monto a reclamar" debe seguir sumando el bonus lunar tal como hace hoy `updateDailyButton()`:
```js
const moonStatus = window.GameCenter.getMoonBlessingStatus();
const total = info.nextReward + (moonStatus.active ? 90 : 0);
rewardEl.textContent = `+${total}`;
```

### 2.3 Datos involucrados [HECHO]

- `store.daily = { lastClaim: number, streak: number }`
- `store.buffs.moonBlessingExpiry: number`
- `store.claimed_milestones: string[]`
- `CONFIG.dailyReward = 20`, `CONFIG.dailyStreakStep = 5`, `CONFIG.dailyStreakCap = 60`
- Tabla de recompensa (documentada en `docs/sistema-racha-diaria.md` §4): día 1→20, día 2→25 … día 9+→60 (tope), +90 si Bendición Lunar activa.

### 2.4 Elementos redundantes o de bajo valor detectados [HECHO / INFERENCIA]

| Elemento | Evidencia | Veredicto |
|---|---|---|
| `.hud-balance` (monedas en HUD) | El mismo valor ya se muestra en `.navbar .coin-badge` en las 3 vistas | **Eliminar del HUD.** Ver Ticket-01 para verificación de dependencias JS antes de borrar. |
| `.hud-status` / `.hud-status-dot` ("En línea") | Sin binding real a estado de red en ningún archivo revisado | **Eliminar.** Es decorativo y potencialmente engañoso. |
| `Bienvenid@ de vuelta` (`.hud-greeting` + `#pref-suffix`) | Es texto administrativo, no aporta jerarquía de juego; el nickname sí importa (personalización) pero el saludo largo compite visualmente con el fuego | **Reducir, no eliminar del todo.** Fusionar en una fila de identidad mínima ("Hola, {nickname}" sin sufijo de género visible, o incluso solo el nombre) — ver razonamiento en 3.4. |
| `#cloud-sync-indicator` | Tiene función real (`la:synced` listener en `SentinelCloudSync`, pulso visual al sincronizar) | **Conservar**, pero reubicar junto al avatar/nickname en la fila de identidad, no como elemento independiente. |

### 2.5 Riesgos identificados antes de tocar el código [HECHO]

1. **Doble listener en `#btn-daily`**: existe uno en `js/app.js` (lógica completa) y otro en `index.html` (solo refresco visual). Si se cambia el `id` del elemento raíz clicable, **ambos** listeners dejan de funcionar. → Los tickets exigen preservar `id="btn-daily"` en el elemento raíz interactivo.
2. **`updateDailyButton()` usa `root.querySelector('#btn-daily')`, `#hud-daily-label`, `#hud-reward-amount`**, y también contempla un modo genérico "botón clásico" (`btn.querySelector('span')`) para otra vista que no existe hoy en el HTML dado — ese branch es código muerto actualmente (no hay ningún otro `#btn-daily` fuera del Home), pero no debe eliminarse sin confirmar que ninguna vista futura lo usa. Se documentará como candidato a limpieza condicional (ver Ticket-12).
3. **`aria-describedby="daily-msg daily-countdown"`** en el botón debe mantenerse o migrar correctamente si el `#daily-msg` cambia de posición.
4. **`window.AppScheduler.registerInterval('countdown', 'home-daily-countdown', updateCountdownDisplay, 250)`** vive en el script inline de `index.html`; el nuevo componente no debe duplicar timers.
5. **`_streakMilestoneModalLocked`** (module-level flag en `js/app.js`) impide reentradas del modal de hito; el fix de Ticket-08 debe respetar ese lock.

---

## PARTE 3 — INVESTIGACIÓN UX / GAME DESIGN [EXTERNO — conocimiento general de dominio]

Cada referencia incluye: qué hace, por qué funciona, qué principio adaptamos, qué NO copiamos.

### 3.1 Duolingo — racha con llama
- **Qué hace:** ícono de llama junto al número de días; la llama cambia de "apagada/gris" a "encendida" según si el usuario practicó hoy; anima un "freeze" (protección de racha) como mecánica de retención.
- **Por qué funciona:** el ícono es reconocible al instante, sin necesitar leer texto; el color comunica el estado sin ambigüedad.
- **Principio adaptado:** icono + número como unidad indisociable, con estado codificado por color/intensidad, no solo por texto.
- **Qué NO copiamos:** Duolingo usa notificaciones de presión ("¡tu racha está en peligro!") que pueden rozar el dark pattern de *loss aversion* agresivo. Nuestro requisito explícito es evitar manipulación oscura — mantenemos el countdown informativo pero no alarmista (sin rojo parpadeante urgente, sin copy de miedo).

### 3.2 Candy Crush / juegos móviles con "daily reward calendar"
- **Qué hace:** un calendario visual de 7 días donde cada día reclamado queda "sellado" con un check dorado, y el día actual pulsa.
- **Por qué funciona:** da sensación de progreso lineal visible, no solo un número abstracto.
- **Principio adaptado:** el proyecto **ya tiene** esto parcialmente (`.streak-days` de 7 segmentos y `renderStreakCalendar()` en `shop-logic.js` para la pestaña Ajustes). Lo aprovechamos como "micro-progreso semanal" bajo el número grande, en vez de inventar un componente nuevo.
- **Qué NO copiamos:** los calendarios de recompensa variable (cofres sorpresa por día) — el proyecto ya tiene una fórmula de recompensa determinista y transparente (`docs/sistema-racha-diaria.md` §4); no se propone introducir aleatoriedad ahí.

### 3.3 Genshin Impact / juegos gacha — "check-in" con animación de moneda
- **Qué hace:** al reclamar, un ícono de recompensa se "abre" con partículas y las monedas vuelan visualmente hacia el contador de moneda en la esquina superior, incrementándose con un pequeño "tic" numérico.
- **Por qué funciona:** conecta espacialmente la fuente de la recompensa con el destino (el saldo), reforzando causa→efecto.
- **Principio adaptado:** el burst de monedas debe volar **hacia arriba, en dirección a la navbar** (donde vive el saldo real), no quedarse flotando en el centro del HUD. Esto también justifica por qué eliminar el saldo duplicado del HUD es positivo: ahora hay un solo destino visual claro para la animación.
- **Qué NO copiamos:** Genshin usa modelos 3D renderizados y partículas de miles — inviable y no deseable en un proyecto vanilla-JS mobile-first con presupuesto de gama baja.

### 3.4 Clash Royale / Marvel Snap — HUD minimalista con identidad secundaria
- **Qué hace:** el nombre de usuario y avatar existen pero son pequeños, en una esquina, nunca compiten con el elemento de progreso central.
- **Por qué funciona:** jerarquía visual clara: una pantalla, un protagonista.
- **Principio adaptado:** confirma la decisión de reducir avatar+nickname+saludo a una fila compacta de 32-40px de alto, no la actual fila de 56px con avatar+ring+dos líneas de texto.
- **Qué NO copiamos:** estos juegos no tienen "saludo" en absoluto. Nuestra recomendación es más conservadora: conservamos el nickname (personalización, ya forma parte de la identidad del producto vía Identity Modal) pero recortamos el saludo largo.

### 3.5 Principios de psicología de producto aplicados [EXTERNO]

| Principio | Aplicación en este diseño | Cómo evitamos dark pattern |
|---|---|---|
| Progreso visible | Barra semanal + número grande + intensidad del fuego escalando con streak | Es descriptivo, no genera urgencia falsa |
| Anticipación | El fuego "available" tiene una pulsación sutil que invita sin ser intrusiva | No hay notificaciones push agresivas nuevas; el sistema de push existente (`js/push-notifications.js`) ya es opt-in |
| Feedback inmediato | `claimDaily()` es síncrono → la animación arranca en el mismo frame del tap | — |
| Recompensa determinista (no variable) | Se mantiene la fórmula actual, visible y predecible | Evita el sesgo de "recompensa variable" propio de mecánicas de azar/dark pattern |
| Ownership / sensación de logro | El número de racha se trata como estadística, con milestone modal reforzando hitos grandes | El hito ya es una recompensa real (monedas + Bendición Lunar), no cosmética vacía |
| Loss aversion (con cuidado) | El countdown informa cuándo se puede reclamar de nuevo; el sistema de "reparación de racha" (`repairDailyStreak`) ya existe como red de seguridad ante un día perdido, no la introducimos nosotros | No se añade copy de miedo ("¡vas a perder tu racha!"); se mantiene el tono neutral ya existente en `_setDailyMessage` |

---

## PARTE 4 — PROPUESTA DE EXPERIENCIA

### 4.1 Layout final

```
┌─────────────────────────────────────────────┐
│  [avatar 32px] Hola, Lilith        [☁ nube]  │  ← fila de identidad (compacta, ~40px)
├─────────────────────────────────────────────┤
│                                               │
│              🔥  (fuego SVG, 120x160)         │
│                                               │
│                  27                          │  ← número gigante, tabular
│                 DÍAS                         │  ← label pequeño, mayúsculas
│                                               │
│         [●●●●●●○]  ← 7 segmentos (ya existe) │
│                                               │
│         Próximo bono en 04:12:33             │  ← countdown (ya existe, restilizado)
│                                               │
│         [ toca el fuego para reclamar +45 ]  │  ← CTA integrado en el propio widget
└─────────────────────────────────────────────┘
```

El bloque completo reemplaza únicamente el contenido interno de `.player-hud`; el contenedor (`.glass-panel`-like, bordes, sombra) se conserva para no romper el resto de la composición de la página (`#games`, etc. debajo).

### 4.2 Elementos que se quedan, se mueven o se van

| Elemento actual | Decisión | Justificación |
|---|---|---|
| Avatar (`.hud-avatar`) | Se queda, tamaño reducido (32-36px) | Sigue siendo objetivo de `applyAvatar()` |
| Anillo de poder (`.hud-avatar-ring`) | Se queda pero a escala reducida | Detalle premium ya construido, barato en GPU (usa `conic-gradient` + `will-change: transform`, ya auditado) |
| "Bienvenid@ de vuelta" | Se elimina el texto largo; se reemplaza por `Hola, {nickname}` sin sufijo de género visible | El sufijo de género (`@`/`o`/`a`) se conserva en el **modelo de datos** (Identity Modal sigue preguntando el género), pero deja de renderizarse en el HUD — no aporta jerarquía y complica el layout compacto |
| `#pref-suffix` | Se elimina del DOM del HUD | `applyIdentity()` ya usa `if (suffixEl) ...`, así que es seguro quitarlo sin tocar JS |
| "En línea" + punto | Se elimina completamente | Sin dependencia real, potencialmente engañoso |
| Saldo de monedas en HUD | Se elimina completamente | Duplicado exacto de la navbar; libera espacio para el fuego |
| `#cloud-sync-indicator` | Se mueve a la fila de identidad, junto al nickname | Conserva su función (`la:synced` listener), solo cambia de posición |
| Botón `#btn-daily` | Se transforma: ya no es un botón cuadrado aislado, es la zona interactiva que envuelve el fuego + número | El `id` se preserva |
| `#hud-reward-amount`, `#hud-daily-label` | Se preservan como nodos (pueden quedar visualmente ocultos o integrados como micro-copy bajo el fuego: "toca para reclamar +45") | `updateDailyButton()` sigue escribiendo en ellos sin cambios de JS |
| `#daily-msg` | Se preserva, se reposiciona debajo del widget | Sigue usando `role="status"` `aria-live="polite"` |
| `#daily-countdown` / `#countdown-display` | Se preservan, restilizados como "HUD timer" (fuente monoespaciada ya definida en `--font-mono`) | Sin cambios de JS |
| `#streak-days` (7 segmentos) + `#streak-count` | Se preservan, se reposicionan debajo del número grande, se restilizan (segmentos más gruesos, con glow en los "active") | `updateStreakBar()` sigue funcionando igual |

### 4.3 Estados del componente

Se maneja con un atributo `data-state` en el contenedor raíz `#streak-flame` (nuevo elemento), sincronizado desde JS cada vez que se llama `updateDailyButton()`/`updateStreakBar()`:

| Estado | Cuándo | Fuego | Número | CTA |
|---|---|---|---|---|
| `locked` | `streak === 0` y nunca se ha reclamado (`lastClaim === 0`) — primera vez | Muy tenue, gris/azulado, sin chispas | Número "0" o ausente, copy "Reclama tu primer día" | Botón habilitado normal |
| `available` | `canClaimDaily() === true` y `dataset.mode !== 'repair'` | Intenso, chispas activas, glow pulsante | Grande, dorado, con leve pulso de escala | "Toca para reclamar +N" |
| `repair` | `dataset.mode === 'repair'` (racha de 2 días de diff, recuperable) | Parpadeo tenue "casi apagándose" (ámbar/rojizo) | Número existente con un ícono de alerta sutil | Abre `showDailyRepairModal()` (sin cambios de esa lógica) |
| `claiming` | Justo tras el tap, mientras se ejecuta el burst (~480ms) | Animación de burst (ver 4.5) | Congelado momentáneamente | Deshabilitado (ya lo hace `dailyBtn.disabled = true`) |
| `claimed` | `canClaimDaily() === false` y no es `repair` | Calmado, menor intensidad, sin chispas | Número visible, tono neutro (blanco/plata, no dorado) | Countdown visible en su lugar |

### 4.4 Motion design — tabla de animaciones

| Animación | Trigger | Duración | Easing | Propiedades | Prioridad | Fallback (reduced-motion) | Coste esperado |
|---|---|---|---|---|---|---|---|
| Balanceo de llama (3 capas) | Permanente en `available`/`claimed` | 1.9s–3.4s por capa, en bucle infinito | `ease-in-out` | `transform: scaleX/scaleY/skewX` | P0 | Animación desactivada, se muestra el fuego estático en su pose neutra | Compositor puro, ~3 elementos, sin repaint |
| Pulso de glow | Permanente en `available` | 2.6s en bucle | `ease-in-out` | `opacity`, `transform: scale` sobre un pseudo-elemento con `filter: blur()` estático | P0 | Desactivada, opacity fija | Bajo — blur no se recalcula porque el elemento no cambia de tamaño real, solo opacity/transform (compositor) |
| Chispas ascendentes | Solo en `available` | 2.8s por chispa, 6 chispas con `animation-delay` escalonado | `ease-in` (aceleran al desaparecer) | `transform: translate`, `opacity` | P1 | Ocultas completamente (`display:none`) | Muy bajo — 6 nodos `<span>` estáticos, sin JS por frame |
| Burst de reclamo | Tap en `#btn-daily` | 480ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` (ya usado en `.identity-chips`) | `transform: scale`, `filter: brightness` | P0 | Se reduce a un cross-fade de opacity de 150ms | Bajo — una sola animación CSS class-toggle |
| Coin burst (6-10 monedas) | Tras `claimDaily()` exitoso | 700ms por moneda | `cubic-bezier(.2,.8,.2,1)` | `transform: translate + rotate`, `opacity` | P1 | Se reduce a 3 monedas sin rotación, o se omite si `prefers-reduced-motion` | Bajo — nodos creados una vez por evento de claim (no por frame), removidos tras `animationend` |
| Incremento del saldo en navbar | Tras claim | ~650ms (`animateValue`, ya existe) | ease-out cúbico (ya implementado) | `textContent` (no anima layout) | P0 | Sin cambio — ya está implementado y es compatible | Ya auditado en el proyecto, sin cambios |
| Pulso del número de racha al incrementarse | Tras claim exitoso | 380ms | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `transform: scale` | P1 | Se omite | Bajo |
| Milestone modal | Tras claim si hay hito pendiente | Ya implementada (`streakMilestonePop`, 500ms) | Ya implementado | Ya implementado | P0 (fix de bug, no animación nueva) | Ya respeta `prefers-reduced-motion` | Sin cambio, solo se corrige el trigger |

### 4.5 Especificación exacta del fuego (SVG + CSS)

Ver el código completo y listo para copiar en el **Ticket-03**. Resumen de arquitectura:

- **3 capas de `<path>` SVG** (`back`, `mid`, `core`) dentro de un único `<svg viewBox="0 0 120 160">`, cada una con su propio `transform-origin` en la base de la llama y su propia animación CSS con duración y delay distintos (evita que las 3 capas se muevan sincronizadas, lo que rompería la sensación orgánica).
- **Glow**: un `div` con `radial-gradient` + `filter: blur()` detrás del SVG, animando solo `opacity` y `transform: scale` (nunca el blur en sí).
- **Chispas**: 6 `<span>` estáticos con `border-radius:50%`, animando `transform: translate + opacity`, con `animation-delay` distinto cada uno para desincronizar.
- **Estados**: se controlan con CSS custom properties (`--flame-glow-opacity`) y selectores `[data-state="..."]` que ajustan `animation-duration`, `filter: saturate/brightness` y `opacity`, sin JavaScript por frame.

### 4.6 Streak number — tratamit visual

- Fuente: `var(--font-display)` (Exo 2), `font-weight: 900`, tamaño `clamp(2.4rem, 12vw, 3.4rem)`.
- `font-variant-numeric: tabular-nums` para que el número no "salte" de ancho al cambiar de dígitos (evita layout shift).
- Color: gradiente de texto (`background-clip: text`) dorado→naranja en estado `available`, plata/blanco en `claimed`, gris en `locked`.
- Label "DÍAS" debajo, `font-size: 0.65rem`, `letter-spacing: 0.12em`, `text-transform: uppercase`, color `--text-low`.
- Al incrementarse tras un claim: pulso de `scale(1) → scale(1.12) → scale(1)` con el easing back-out ya usado en el proyecto.

### 4.7 Coins — feedback

No se reutiliza `canvas-confetti` (ya cargado de forma diferida solo en la vista Tienda vía `_getConfetti()` en `shop-logic.js`). Razón: cargarlo desde Home añadiría una petición de red adicional a un CDN externo (`cdn.jsdelivr.net`) en el flujo más frecuente de toda la app (reclamo diario), y visualmente el confetti de papel no comunica "monedas volando hacia mi saldo". En su lugar: burst bespoke de 6-10 `<span>` de moneda (círculo con gradiente dorado), creados dinámicamente por JS **solo en el momento del claim** (no hay coste en reposo), animados con CSS y removidos del DOM en `animationend`.

### 4.8 Audio — estrategia

**[HIPÓTESIS validada por diseño, no por testing de usuario aún]** Se usa **Web Audio API con síntesis procedural** (osciladores + envolventes de ganancia), no un archivo de audio:

- **Por qué no un asset:** un archivo `.mp3`/`.ogg` añade peso a `sw.js` (`APP_SHELL_FILES`), un ciclo de carga adicional, y el proyecto ya demuestra preferencia por síntesis/generación en tiempo real donde es posible (ver `js/sync-worker.js` con `crypto.subtle`, y los propios juegos con `AudioSynth.js` en `rompecabezas`).
- **Restricción de autoplay:** el `AudioContext` solo se crea/reanuda dentro del propio handler de clic de `#btn-daily`, que es un gesto de usuario genuino — cumple la política de autoplay de todos los navegadores modernos sin necesidad de un "activador" separado.
- **Latencia:** cero — los osciladores se programan en el mismo tick síncrono en que se resuelve `claimDaily()`.
- **Tamaño:** ~25 líneas de JS, cero KB de asset.
- Ver código completo en Ticket-07.

### 4.9 Celebración fullscreen — evaluación explícita

**[HIPÓTESIS descartada como P0/P1, aceptada solo como P2 condicional]** Se evaluó una animación de pantalla completa (por ejemplo, un flash dorado del viewport o partículas cayendo desde arriba). Se descarta como prioridad alta porque:

1. Cualquier efecto que cubra el viewport completo obliga al navegador a considerar repaint de una superficie mucho mayor que el widget local, incluso si solo se anima `opacity` de una capa fija — en gama baja (`Samsung Galaxy J8`, referencia ya usada en la auditoría de rendimiento móvil del proyecto según `docs/DOCUMENTACION.md`) esto es exactamente el tipo de patrón que el propio proyecto ya identificó como costoso (ver histórico de "Mobile Performance Pass" v9.8, que **redujo** efectos fullscreen-adyacentes como `backdrop-filter` en overlays).
2. El impacto emocional adicional de un efecto fullscreen sobre un burst local bien ejecutado es marginal, mientras que el riesgo de jank es alto y afecta la percepción general de fluidez de toda la sesión, no solo del claim.
3. Se propone como **P2 opcional únicamente si el profiling en dispositivo real (Ticket-14) demuestra headroom de rendimiento sobrante** tras implementar todo lo demás: un flash de un único pseudo-elemento fixed con `opacity: 0 → 0.15 → 0` de 250ms total, sin blur, sin partículas adicionales. Ningún ticket obligatorio depende de esto.

---

## PARTE 5 — ARQUITECTURA TÉCNICA DE ANIMACIONES

### 5.1 Comparación de opciones

| Opción | Pros | Contras | Veredicto |
|---|---|---|---|
| **CSS + SVG (elegida)** | Cero JS por frame, corre en el compositor/GPU, coherente con el resto del proyecto (`neonFlowDrift`, `laserScan`, `powerRingRotate` ya usan este patrón), fácil de pausar con `prefers-reduced-motion` y clases | Menos "orgánico" que ruido real (Perlin noise) | ✅ Elegida |
| **Canvas 2D con partículas por frame** | Más control de física orgánica | Requiere `requestAnimationFrame` continuo → coste de CPU en cada frame incluso sin cambios visuales grandes; el proyecto evita explícitamente bucles de `rAF` sin condición de parada (ver `fixing-motion-performance` SKILL, regla "no requestAnimationFrame loops without a stop condition") | ❌ Descartada |
| **Web Animations API (`element.animate()`)** | Buen control programático, interrumpible | No aporta ventaja sobre CSS `@keyframes` para animaciones de bucle infinito sin interacción de arrastre; el proyecto ya usa CSS puro para todo lo decorativo | ❌ Descartada para el loop; **sí se usa** para el burst puntual del claim si se prefiere sobre class-toggle (opcional, ver Ticket-03) |
| **Librería externa (Lottie, GSAP, etc.)** | Animaciones más ricas out-of-the-box | Nueva dependencia, peso de red, mantenimiento, viola la guía de "no añadir dependencias solo por una animación" | ❌ Descartada |

### 5.2 Por qué esta arquitectura encaja con el proyecto existente

El repositorio ya demuestra, de forma consistente, el patrón "animación decorativa = CSS `@keyframes` + `will-change` temporal + respeto a `prefers-reduced-motion` + reducción en `pointer: coarse`" en: `.hud-avatar-ring` (`powerRingRotate`), `.sale-banner__ticket::after` (`laserScan`), `.mockup-layer-art.mockup-bg-offline::before` (`neonFlowDrift`). El fuego sigue exactamente el mismo molde, por lo que no introduce un patrón arquitectónico nuevo que el equipo deba aprender.

---

## PARTE 6 — PERFORMANCE PLAN

### 6.1 Performance budget propuesto [HIPÓTESIS — recomendación razonada, no medida en dispositivo real todavía]

| Recurso | Budget | Justificación |
|---|---|---|
| Nodos DOM nuevos en reposo | ≤ 12 (3 `<path>` SVG + 1 glow + 6 `<span>` de chispas + 1 contenedor) | Evita presión de memoria/layout en gama baja; comparable al coste de `.hud-avatar-ring` ya existente |
| Nodos DOM creados dinámicamente por claim (coin burst) | ≤ 10, destruidos tras `animationend` | Evento poco frecuente (una vez al día por usuario), coste amortizado |
| Propiedades animadas en bucle infinito | Solo `transform` y `opacity` | Regla dura del proyecto (`fixing-motion-performance` SKILL) |
| `filter: blur()` en elementos que se animan | 0 — el blur vive en un elemento cuyo tamaño no cambia, solo su `opacity`/`transform: scale` | Evita recomputar el blur en cada frame |
| FPS objetivo | 60fps en desktop/gama alta, ≥ 50fps sostenidos en gama baja (referencia Galaxy J8 usada en el proyecto) | Igual que el estándar ya aplicado en el resto de la SPA |
| Reducción en `pointer: coarse` | `filter: blur()` del glow baja de 18px a 10px (mismo patrón ya usado: offline fallback baja de 40px→12px, mockup loading de 10px→3px) | Consistencia con el patrón existente en `styles.css` |
| `prefers-reduced-motion` | Todas las animaciones en bucle se desactivan (`animation: none`); solo queda un estado estático coherente por cada `data-state` | Regla dura del proyecto, ya aplicada en decenas de selectores existentes |
| Visibilidad de pestaña | Las animaciones CSS en bucle **no consumen CPU real cuando la pestaña está oculta** (los navegadores ya throttean rAF y, para animaciones CSS puras compositadas, pausan el trabajo de composición); no se requiere JS adicional de pausa — a diferencia de los timers de `AppScheduler`, que si son JS (`setInterval`) sí necesitan pausa explícita y **ya la tienen** | No duplicar lógica de pausa que el navegador ya resuelve para CSS puro |
| Batería | Sin polling, sin timers nuevos de JS; todo el movimiento en reposo es CSS compositado | — |

### 6.2 Estrategia de reducción progresiva

1. **Nivel 0 (todos los dispositivos):** fuego + glow + chispas completos.
2. **Nivel 1 (`pointer: coarse`):** blur del glow reducido (18px→10px), sin cambio de cantidad de elementos.
3. **Nivel 2 (`prefers-reduced-motion: reduce`):** todas las animaciones en bucle se detienen; el estado se sigue comunicando por color/opacity estática, nunca se pierde la información de "disponible vs reclamado".
4. **No existe Nivel 3 de "desactivar el fuego por completo"** — el fuego siempre debe estar presente aunque estático, porque es el elemento de identidad central del hub; solo su movimiento se reduce, nunca su visibilidad.

### 6.3 QA/Profiling recomendado (ver también Ticket-14)

- Chrome DevTools → Performance panel, grabar 10s con el estado `available` activo, confirmar que el "Main" thread permanece prácticamente vacío (todo el trabajo debe aparecer en "Compositor"/GPU track).
- Confirmar en `chrome://gpu` o el panel "Rendering → Paint flashing" que no hay repaints continuos fuera del área del widget.
- Probar con `chrome://settings` → "Reduce motion" del SO, y con DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion".
- Probar con CPU throttling 4x-6x (aproximación a gama baja) que el burst de claim no introduce frames caídos perceptibles.

---

## PARTE 7 — TICKETS PARA CODEX

> Todos los tickets asumen que se trabaja directamente sobre `index.html`, `styles.css`, `js/app.js` (y opcionalmente un nuevo archivo `js/streak-hub.js` si Codex prefiere aislar la lógica nueva — ver Ticket-00). Ningún ticket requiere `npm install` ni tocar `package.json` (no existe ninguno en este proyecto: es vanilla JS sin bundler).

---

### TICKET-00 — Decisión de arquitectura y andamiaje del nuevo módulo

**Tipo:** Arquitectura
**Prioridad:** P0
**Dependencias:** Ninguna
**Confianza:** Alta (basada en patrones ya existentes en el repo)

**Objetivo**
Establecer dónde vive el nuevo código del Daily Streak Hub sin romper el patrón de scripts actual (`js/analytics.js` → `js/supabase-loader.js` → `js/milestones-config.js` → `js/lifecycle-scheduler.js` → `js/app.js` → `js/backup-engine.js` → `js/push-notifications.js` → `js/shop-logic.js` → `js/spa-router.js`).

**Contexto**
Toda la lógica de racha vive hoy dentro de `js/app.js` (un archivo ya muy extenso). Añadir ~200 líneas más de lógica de animación de fuego/coin-burst/audio directamente ahí es viable pero degrada la mantenibilidad.

**Estado actual**
`js/app.js` contiene: config, economía, temas, códigos promo, tiempo de red, worker de sync, migración de estado, animación de contador, historial, avatares, toda la API de `window.GameCenter`, mail helper, funciones internas de UI, reveal UI, init síncrono, listeners de `DOMContentLoaded`, y el IIFE completo de `SentinelCloudSync`.

**Implementación**
1. Crear un nuevo archivo `js/streak-hub.js` que contenga **exclusivamente**:
   - La función de sincronización visual del widget de fuego (lee `GameCenter.getStreakInfo()`, `GameCenter.canClaimDaily()`, `GameCenter.getMoonBlessingStatus()` — todas ya públicas, no requieren cambios de API).
   - El burst de reclamo (coin-burst + audio + haptic).
   - El helper de audio sintetizado (Ticket-07).
2. Añadir `<script src="js/streak-hub.js"></script>` en `index.html` **después** de `js/app.js` y **antes** de `js/spa-router.js` (necesita que `window.GameCenter` y `window.AppScheduler` ya existan, pero debe registrar sus listeners antes de que el router dispare la primera navegación).
3. Actualizar el comentario de bloque en `index.html` que documenta el orden de scripts (el bloque `<!-- SCRIPTS — Orden estricto: ... -->`) añadiendo la línea `7. streak-hub.js → Widget de fuego, animaciones de reclamo, audio sintetizado`.
4. `js/streak-hub.js` debe exponer una única API pública mínima: `window.StreakHub = { refresh(), playClaimSequence(result) }` — nada más. Todo lo demás es privado al IIFE.
5. **No modificar** ninguna función existente dentro de `window.GameCenter` en este ticket. Los tickets siguientes decidirán punto por punto qué llamada nueva se añade desde `js/app.js` hacia `window.StreakHub`.

**Comportamiento esperado**
El archivo se carga, no lanza errores en consola, y expone `window.StreakHub` vacío/funcional (los métodos pueden ser no-ops en este ticket — se implementan en tickets posteriores). Esto permite que los tickets siguientes se implementen y prueben de forma incremental.

**Performance**
Ninguna — este ticket es puramente de andamiaje, sin código ejecutable relevante todavía.

**Documentación**
Añadir la entrada del archivo nuevo a la tabla de "Estructura de Archivos" en `docs/DOCUMENTACION.md` y a `README.md` (sección "Estructura").

**Preservación**
No tocar ningún otro archivo. `js/app.js` permanece sin cambios en este ticket.

**Criterios de aceptación**
- [ ] `js/streak-hub.js` existe y se carga sin error 404 ni error de sintaxis.
- [ ] `window.StreakHub` está definido tras `DOMContentLoaded`.
- [ ] El resto de la app funciona exactamente igual que antes (ningún comportamiento visible cambia todavía).

**Validación**
Abrir la consola del navegador en `index.html`, confirmar `typeof window.StreakHub === 'object'` sin errores previos en consola.

**Riesgos**
Ninguno — ticket aditivo puro.

---

### TICKET-01 — Auditoría de dependencias y eliminación segura de elementos redundantes del HUD

**Tipo:** Refactor / Limpieza
**Prioridad:** P0
**Dependencias:** Ninguna
**Confianza:** Alta (verificado línea por línea contra `js/app.js`)

**Objetivo**
Eliminar del DOM los elementos confirmados como redundantes o no funcionales (`#pref-suffix`+saludo largo, indicador "En línea", saldo de monedas del HUD) **sin romper ninguna función JS que los referencie**, verificando cada `getElementById`/`querySelector` relevante antes de borrar.

**Contexto**
Ver Parte 2.4 y 2.5 de este documento.

**Estado actual**
```html
<!-- index.html, dentro de .hud-info -->
<p class="hud-greeting">
    Bienvenid<span id="pref-suffix">@</span> de vuelta
</p>
<div class="hud-name-row">
    <p class="hud-name" id="display-nickname"></p>
    <span id="cloud-sync-indicator" class="hud-cloud-sync-indicator" ...>...</span>
</div>
<p class="hud-status">
    <span class="hud-status-dot"></span>
    <span>En línea</span>
</p>
```
```html
<!-- .hud-balance-row -->
<div class="hud-balance">
    <span class="hud-balance-label">Monedas</span>
    <div class="hud-balance-amount">
        <svg class="icon" ...><use href="#icon-star"></use></svg>
        <span class="coin-display">0</span>
    </div>
</div>
```

**Evidencia de seguridad de la eliminación**
- `applyIdentity()` en `js/app.js`:
  ```js
  function applyIdentity() {
      const suffixEl   = document.getElementById('pref-suffix');
      const nicknameEl = document.getElementById('display-nickname');
      const profileNameEl = document.getElementById('profile-title');
      if (suffixEl)   suffixEl.textContent   = store.gender   || '@';
      if (nicknameEl) nicknameEl.textContent = store.nickname || '';
      if (profileNameEl) profileNameEl.textContent = store.nickname || 'Love Arcade';
  }
  ```
  Ambos accesos están guardados con `if (el)`. **Confirmado seguro eliminar `#pref-suffix` del DOM.** `#display-nickname` **debe conservarse** (se reubica, no se borra).
- `updateUI()` en `js/app.js`:
  ```js
  const otherDisplays = Array.from(
      displayRoot.querySelectorAll('.coin-display')
  ).filter(el => !el.matches('.navbar .coin-display') && !el.closest('.view-section.hidden'));
  ```
  Esto es un `querySelectorAll` + `filter`, tolerante a cero resultados. **Confirmado seguro eliminar** el `.coin-display` del HUD; `animateValue()` también itera sobre arrays que pueden estar vacíos (`if (!elements || !elements.length) return;`), sin excepción.
- No existe ningún JS (`js/app.js`, `js/spa-router.js`, `js/push-notifications.js`) que lea o escriba `.hud-status` o `.hud-status-dot`. **Confirmado seguro eliminar.**
- `#cloud-sync-indicator` **no se elimina**, solo se reposiciona (ver Ticket-02); su listener vive en el IIFE `SentinelCloudSync`:
  ```js
  const cloudIndicator = document.getElementById('cloud-sync-indicator') || document.getElementById('hud-cloud-sync-indicator');
  if (cloudIndicator) {
      document.addEventListener('la:synced', () => {
          cloudIndicator.classList.add('is-active', 'is-pulse');
          setTimeout(() => cloudIndicator.classList.remove('is-pulse'), 1800);
      });
  }
  ```
  Nótese que ya contempla un fallback a `#hud-cloud-sync-indicator` — si el ID cambia, usar exactamente uno de esos dos IDs para no requerir tocar este bloque.

**Implementación**
1. En `index.html`, eliminar por completo el `<p class="hud-greeting">...</p>` (con su `<span id="pref-suffix">`).
2. Eliminar por completo el `<p class="hud-status">...</p>` (punto + "En línea").
3. Eliminar por completo el bloque `.hud-balance` dentro de `.hud-balance-row` (el `<div class="hud-balance">...</div>` completo, incluyendo su `.coin-display`). **No tocar** `.hud-daily-btn`, que vive en el mismo `.hud-balance-row` — ver Ticket-02 para cómo se reestructura ese contenedor.
4. Conservar `#display-nickname` y `#cloud-sync-indicator`, moviéndolos (no borrándolos) según el nuevo layout del Ticket-02.
5. En `styles.css`, marcar como candidatas a eliminación (pero **no eliminar en este ticket** — se hace en Ticket-12 tras confirmar en QA que nada más las usa): `.hud-greeting`, `.hud-status`, `.hud-status-dot`, `@keyframes blink`, `.hud-balance`, `.hud-balance-label`, `.hud-balance-amount`, `.hud-balance::before`.

**Comportamiento esperado**
Tras este ticket, el HUD se ve visualmente "roto"/incompleto (fila de identidad vacía de contenido decorativo, sin saldo, sin estado online) — esto es intencional y temporal; el Ticket-02 rellena el nuevo layout. No debe haber errores de consola.

**Limpieza / eliminación**
- Marcado (no ejecutado hasta Ticket-12): reglas CSS listadas arriba.
- El campo `store.gender` **se conserva** en el modelo de datos (`migrateState`, Identity Modal) — no se toca `GameCenter.setIdentity()` ni el flujo del modal de bienvenida, que sigue preguntando género para posible uso futuro (p. ej. si se reintroduce un saludo en otra superficie).

**Documentación**
Actualizar `docs/sistema-racha-diaria.md` sección "9. UX en la pantalla de inicio" para reflejar que el saludo y el indicador "En línea" fueron retirados del HUD (y por qué).

**Preservación**
- `applyIdentity()`, `updateUI()`, `SentinelCloudSync` no requieren ningún cambio de código en este ticket — solo el HTML cambia.
- El flujo de Identity Modal (bienvenida, edición de perfil) sigue funcionando exactamente igual.

**Criterios de aceptación**
- [ ] `#pref-suffix`, `.hud-status`, `.hud-balance` ya no existen en el DOM renderizado.
- [ ] `#display-nickname` y `#cloud-sync-indicator` siguen existiendo en el DOM (en su posición temporal, antes de Ticket-02).
- [ ] Cero errores nuevos en consola tras cargar la Home.
- [ ] El saldo sigue siendo visible y correcto en la navbar.

**Validación**
Recargar la app, verificar consola limpia; confirmar visualmente que la navbar sigue mostrando el saldo correctamente tras comprar algo en la Tienda (round-trip de `updateUI()`).

**Riesgos**
Bajo. El único riesgo real sería que algún selector CSS dependiera de la posición relativa de estos elementos (`nth-child`, etc.) — no se encontró ninguno en `styles.css` sobre `.hud-info` o `.hud-balance-row` que dependa de orden de hermanos.

---

### TICKET-02 — Nueva estructura HTML del Daily Streak Hub

**Tipo:** Frontend / Markup
**Prioridad:** P0
**Dependencias:** Ticket-01
**Confianza:** Alta

**Objetivo**
Reemplazar el contenido interno de `.player-hud` por la nueva composición: fila de identidad compacta + widget de fuego + número + micro-progreso semanal + countdown + mensaje.

**Contexto**
Ver Parte 4.1 y 4.2.

**Estado actual**
Estructura completa documentada en `index.html`, bloque `<div class="player-hud">`.

**Implementación**

Reemplazar el contenido interno de `<div class="player-hud">` por:

```html
<div class="player-hud" id="player-hud">

    <!-- Fila de identidad — compacta, secundaria -->
    <div class="hub-identity-row">
        <div class="hud-avatar-wrap hub-identity-row__avatar">
            <div class="hud-avatar" id="hud-avatar-display" style="background-image: url('https://res.cloudinary.com/dyspgn0sw/image/upload/default_avatar.avif');">
                <svg class="icon" width="18" height="18" aria-hidden="true"><use href="#icon-user"></use></svg>
            </div>
            <div class="hud-avatar-ring"></div>
        </div>
        <p class="hub-identity-row__name">
            Hola, <span id="display-nickname"></span>
        </p>
        <span id="cloud-sync-indicator" class="hud-cloud-sync-indicator" aria-live="polite" title="Sincronización en la nube">
            <svg class="icon" width="11" height="11" aria-hidden="true"><use href="#icon-upload-cloud"></use></svg>
            Nube
        </span>
    </div>

    <!-- Daily Streak Hub — el fuego es el protagonista -->
    <button type="button"
            id="btn-daily"
            class="streak-hub-cta"
            aria-describedby="daily-msg daily-countdown streak-hub-copy"
            aria-label="Reclamar bono diario">

        <div class="streak-flame" id="streak-flame" data-state="locked" aria-hidden="true">
            <div class="streak-flame__glow"></div>
            <svg class="streak-flame__svg" viewBox="0 0 120 160" width="120" height="160" aria-hidden="true">
                <defs>
                    <linearGradient id="flameOuter" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%"  stop-color="#ffb238" stop-opacity="0.9"/>
                        <stop offset="60%" stop-color="#ff6a1a" stop-opacity="0.85"/>
                        <stop offset="100%" stop-color="#c81d1d" stop-opacity="0.7"/>
                    </linearGradient>
                    <linearGradient id="flameCore" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%"  stop-color="#fff6c8"/>
                        <stop offset="35%" stop-color="#ffd23f"/>
                        <stop offset="70%" stop-color="#ff7a1a"/>
                        <stop offset="100%" stop-color="#ff3d1a"/>
                    </linearGradient>
                </defs>
                <path class="flame-layer flame-layer--back" fill="url(#flameOuter)"
                      d="M60,150 C20,130 15,90 35,55 C40,45 35,35 30,20 C55,30 70,15 65,0 C95,20 105,55 90,85 C110,75 105,55 100,45 C120,70 115,110 90,135 C100,120 95,105 85,100 C88,125 75,145 60,150 Z"/>
                <path class="flame-layer flame-layer--mid" fill="url(#flameCore)" opacity="0.92"
                      d="M60,148 C32,130 30,100 45,70 C48,62 45,52 40,40 C58,48 68,35 64,22 C86,38 92,62 82,84 C96,78 92,62 88,55 C102,72 100,100 82,120 C88,110 84,98 76,94 C78,114 70,128 60,148 Z"/>
                <path class="flame-layer flame-layer--core" fill="#fff3c4" opacity="0.95"
                      d="M60,145 C46,132 45,112 54,92 C56,86 54,78 51,70 C60,75 66,66 63,58 C74,68 78,84 71,98 C79,94 77,84 74,80 C82,90 81,106 71,120 C74,113 71,106 66,103 C67,116 63,126 60,145 Z"/>
            </svg>
            <div class="streak-flame__sparks">
                <span class="spark spark--1"></span>
                <span class="spark spark--2"></span>
                <span class="spark spark--3"></span>
                <span class="spark spark--4"></span>
                <span class="spark spark--5"></span>
                <span class="spark spark--6"></span>
            </div>
        </div>

        <div class="streak-hub-number" role="img" aria-label="Racha actual">
            <span class="streak-hub-number__value" id="streak-count-big">0</span>
            <span class="streak-hub-number__label" id="hud-daily-label">DÍAS</span>
        </div>

        <p class="streak-hub-copy" id="streak-hub-copy">
            <span id="hud-daily-cta-text">Toca para reclamar</span>
            <span class="streak-hub-copy__amount" id="hud-reward-amount">+20</span>
        </p>

    </button>

    <div class="streak-days" id="streak-days" role="img" aria-label="Racha actual: 0 días de 7 segmentos visibles">
        <div class="streak-day"></div>
        <div class="streak-day"></div>
        <div class="streak-day"></div>
        <div class="streak-day"></div>
        <div class="streak-day"></div>
        <div class="streak-day"></div>
        <div class="streak-day"></div>
    </div>
    <!-- streak-count original se conserva oculto visualmente para no romper updateStreakBar(),
         pero su información ya se comunica mediante streak-count-big -->
    <span class="streak-count visually-hidden" id="streak-count">×0</span>

    <div id="daily-countdown" class="hud-countdown hidden">
        Próximo bono en: <span id="countdown-display">--:--:--</span>
    </div>
    <p id="daily-msg" class="daily-msg" role="status" aria-live="polite"></p>

    <!-- Contenedor del coin burst, ver Ticket-06 -->
    <div class="streak-coin-burst" id="streak-coin-burst" aria-hidden="true"></div>

</div>
```

**Notas de implementación críticas**
1. `#btn-daily` ahora es el elemento raíz interactivo completo (antes era solo el cuadrado amarillo). Esto significa que **toda la superficie del fuego + número + copy es tocable**, lo cual es deseado (mayor área de toque = mejor affordance, cumple mínimo de 44×44px con margen).
2. `updateDailyButton()` en `js/app.js` hace `root.querySelector('#btn-daily')` para leer/escribir `disabled`, `style.opacity`, `style.cursor`, `dataset.mode` — todo esto sigue funcionando igual porque el `id` y el hecho de ser un `<button>` no cambian.
3. `updateDailyButton()` también busca `root.querySelector('#hud-daily-label')` y `root.querySelector('#hud-reward-amount')` — **ambos IDs se preservan exactamente**, solo cambia su rol visual (label pasa a ser "DÍAS" fijo bajo el número grande en vez de "BONO DIARIO"/"REPARAR RACHA" — ver Ticket-05 para el ajuste de copy necesario en JS).
4. `#streak-count` se conserva pero se oculta visualmente con la clase ya existente `.visually-hidden` (definida en `styles.css`), de modo que `updateStreakBar()` (que escribe `countEl.textContent = ...`) sigue funcionando sin cambios, y el valor sigue siendo accesible para lectores de pantalla como respaldo semántico simple, mientras `#streak-count-big` es el elemento visualmente dominante (se sincroniza en Ticket-05).
5. El botón antiguo cuadrado (`.hud-daily-btn`) **se elimina como clase visual** — la nueva clase es `.streak-hub-cta` (ver Ticket-03/04 para su CSS). Verificar que ninguna otra parte del CSS dependa de `.hud-daily-btn` fuera de sus propias reglas (confirmado: no se usa en ningún otro selector compuesto).

**Comportamiento esperado**
El HUD ahora muestra: fila de identidad arriba, el widget de fuego como elemento central dominante, countdown y mensaje debajo. Sin estilos nuevos todavía (vienen en Ticket-03/04), se verá sin animación pero estructuralmente correcto.

**Responsive**
Sin cambios de breakpoint en este ticket — se hereda el comportamiento mobile-first ya existente de `.player-hud`; Ticket-03/04 añaden el CSS del nuevo contenido.

**Accesibilidad**
- El SVG del fuego y sus capas llevan `aria-hidden="true"` (es decorativo; la información real está en el número y el texto).
- El número de racha usa `role="img"` con `aria-label` dinámico (se actualiza en Ticket-05), igual patrón que el ya usado en `#streak-days`.
- `aria-describedby` en el botón ahora incluye `streak-hub-copy` además de `daily-msg` y `daily-countdown`.

**Limpieza / eliminación**
Marcar para Ticket-12: clase `.hud-daily-btn`, `.hud-daily-reward`, `.hud-daily-label` (estilos, no el ID `#hud-daily-label` que se conserva), `.hud-balance-row` (si queda vacío tras esta reestructuración, confirmar y simplificar), `@keyframes dailyBtnPulse`.

**Documentación**
Actualizar `docs/sistema-racha-diaria.md` §9.1 "HUD diario" con la nueva lista de IDs y su rol.

**Preservación**
`updateDailyButton()`, `updateStreakBar()`, `updateCountdownDisplay()`, `window.HomeView`, `AppScheduler` — cero cambios de JS requeridos en este ticket.

**Criterios de aceptación**
- [ ] Todos los IDs listados existen exactamente una vez en el DOM: `btn-daily`, `hud-daily-label`, `hud-reward-amount`, `daily-msg`, `daily-countdown`, `countdown-display`, `streak-days`, `streak-count`, `streak-flame`, `streak-count-big`, `streak-hub-copy`, `streak-coin-burst`.
- [ ] `updateDailyButton()` se ejecuta sin lanzar excepciones (probar manualmente en consola: `updateDailyButton()`).
- [ ] `updateStreakBar()` se ejecuta sin excepciones.
- [ ] `updateCountdownDisplay()` se ejecuta sin excepciones.

**Validación**
En DevTools Console: `document.getElementById('btn-daily').click()` debe seguir disparando el flujo completo de reclamo (mensaje, deshabilitado, etc.), aunque visualmente aún no tenga el nuevo estilo.

**Riesgos**
Medio-bajo: si algún estilo CSS legado apunta a `.hud-balance-row > *` con selectores de hijos directos, podría requerir ajuste — se revisa en Ticket-04 al escribir el CSS nuevo.

---

### TICKET-03 — Implementación del fuego (SVG + CSS), todos los estados visuales

**Tipo:** Frontend / CSS
**Prioridad:** P0
**Dependencias:** Ticket-02
**Confianza:** Alta (código completo provisto, listo para integrar)

**Objetivo**
Implementar la animación de fuego con sus 3 estados (`locked`, `available`, `claimed`) más el estado transitorio `claiming`, cumpliendo el performance budget de la Parte 6.

**Contexto**
Ver Parte 4.5 y Parte 5.

**Implementación — CSS completo a añadir en `styles.css`**

Añadir esta sección completa, idealmente después del bloque `PLAYER HUD` existente:

```css
/* ================================================================
   DAILY STREAK HUB — Fire Widget
   GPU-only: transform + opacity en bucle. filter:blur() estático
   (nunca se recalcula por frame, solo se anima opacity/scale del
   elemento que lo contiene). Sigue el mismo patrón que
   .hud-avatar-ring (powerRingRotate) y .mockup-bg-offline::before
   (neonFlowDrift) ya existentes en este archivo.
   ================================================================ */

.hub-identity-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}
.hub-identity-row__avatar { position: relative; flex-shrink: 0; }
.hub-identity-row .hud-avatar { width: 32px; height: 32px; }
.hub-identity-row .hud-avatar svg { width: 14px; height: 14px; }
.hub-identity-row__name {
    flex: 1;
    min-width: 0;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--text-secondary-aa);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.hub-identity-row__name span { color: var(--text-high); }

.streak-hub-cta {
    all: unset;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 8px 8px 4px;
    cursor: pointer;
    border-radius: var(--radius-lg);
    transition: transform 160ms cubic-bezier(.22,1,.36,1);
}
.streak-hub-cta:hover { transform: translateY(-2px); }
.streak-hub-cta:active { transform: scale(0.98); }
.streak-hub-cta:focus-visible {
    outline: 2px solid transparent;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus-ring-aa) 78%, transparent);
}
.streak-hub-cta:disabled { cursor: not-allowed; }

.streak-flame {
    position: relative;
    width: 108px;
    height: 144px;
    contain: layout paint;
    transform: translateZ(0);
    margin-bottom: 2px;
}

.streak-flame__glow {
    position: absolute;
    inset: -30%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,138,30,0.55) 0%, rgba(255,90,20,0.18) 45%, transparent 72%);
    filter: blur(18px);
    opacity: var(--flame-glow-opacity, 0.15);
    animation: flameGlowPulse 2.6s ease-in-out infinite;
    will-change: opacity, transform;
    pointer-events: none;
}
@keyframes flameGlowPulse {
    0%, 100% { opacity: calc(var(--flame-glow-opacity, 0.15) * 0.8); transform: scale(1); }
    50%      { opacity: var(--flame-glow-opacity, 0.15); transform: scale(1.06); }
}

.streak-flame__svg { position: relative; z-index: 1; display: block; width: 100%; height: 100%; }

.flame-layer {
    transform-origin: 60px 150px;
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
}
.flame-layer--back { animation-name: flameSwayBack; animation-duration: 3.4s; }
.flame-layer--mid  { animation-name: flameSwayMid;  animation-duration: 2.6s; animation-delay: -0.6s; }
.flame-layer--core { animation-name: flameSwayCore; animation-duration: 1.9s; animation-delay: -1.1s; }

@keyframes flameSwayBack {
    0%   { transform: scaleY(1)    scaleX(1)    skewX(0deg); }
    25%  { transform: scaleY(1.04) scaleX(0.98) skewX(-1.5deg); }
    50%  { transform: scaleY(0.97) scaleX(1.02) skewX(1deg); }
    75%  { transform: scaleY(1.03) scaleX(0.99) skewX(-0.8deg); }
    100% { transform: scaleY(1)    scaleX(1)    skewX(0deg); }
}
@keyframes flameSwayMid {
    0%   { transform: scaleY(1)    skewX(0deg); }
    30%  { transform: scaleY(1.06) skewX(2deg); }
    60%  { transform: scaleY(0.95) skewX(-1.5deg); }
    100% { transform: scaleY(1)    skewX(0deg); }
}
@keyframes flameSwayCore {
    0%   { transform: scaleY(1)    scaleX(1); }
    40%  { transform: scaleY(1.08) scaleX(0.94); }
    70%  { transform: scaleY(0.93) scaleX(1.05); }
    100% { transform: scaleY(1)    scaleX(1); }
}

.streak-flame__sparks {
    position: absolute;
    inset: 0;
    pointer-events: none;
}
.spark {
    position: absolute;
    bottom: 36px;
    left: 50%;
    width: 4px; height: 4px;
    border-radius: 50%;
    background: #ffcf5c;
    box-shadow: 0 0 6px 1px rgba(255,180,60,0.8);
    opacity: 0;
    animation: sparkRise 2.8s ease-in infinite;
}
.spark--1 { left: 46%; --spark-drift: 8px;  animation-delay: 0s; }
.spark--2 { left: 58%; --spark-drift: -14px; animation-delay: .5s; }
.spark--3 { left: 40%; --spark-drift: 4px;  animation-delay: 1.1s; }
.spark--4 { left: 63%; --spark-drift: -6px; animation-delay: 1.6s; }
.spark--5 { left: 50%; --spark-drift: 10px; animation-delay: 2.0s; }
.spark--6 { left: 52%; --spark-drift: -10px; animation-delay: .9s; }

@keyframes sparkRise {
    0%   { opacity: 0; transform: translate(0,0) scale(0.6); }
    10%  { opacity: 1; }
    70%  { opacity: 0.6; }
    100% { opacity: 0; transform: translate(var(--spark-drift, 6px), -78px) scale(0.2); }
}

/* ── Estado: locked (nunca reclamado / streak 0) ── */
.streak-flame[data-state="locked"] {
    --flame-glow-opacity: 0.10;
    filter: grayscale(0.55) brightness(0.62);
}
.streak-flame[data-state="locked"] .streak-flame__sparks,
.streak-flame[data-state="claimed"] .streak-flame__sparks {
    display: none;
}

/* ── Estado: available (listo para reclamar) — el más intenso ── */
.streak-flame[data-state="available"] {
    --flame-glow-opacity: 0.55;
}

/* ── Estado: claimed (ya reclamado hoy) — vivo pero calmado ── */
.streak-flame[data-state="claimed"] {
    --flame-glow-opacity: 0.22;
    filter: saturate(0.72) brightness(0.88);
}
.streak-flame[data-state="claimed"] .flame-layer--back { animation-duration: 4.6s; }
.streak-flame[data-state="claimed"] .flame-layer--mid  { animation-duration: 3.6s; }
.streak-flame[data-state="claimed"] .flame-layer--core { animation-duration: 2.8s; }

/* ── Estado: repair (racha en riesgo, recuperable) — ámbar de alerta suave ── */
.streak-flame[data-state="repair"] {
    --flame-glow-opacity: 0.30;
    filter: hue-rotate(-14deg) saturate(0.85);
}
.streak-flame[data-state="repair"] .streak-flame__sparks { display: none; }

/* ── Estado: claiming (burst momentáneo) ── */
.streak-flame[data-state="claiming"] .flame-layer { animation-play-state: paused; }
.streak-flame[data-state="claiming"] .streak-flame__svg {
    animation: flameBurst 480ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes flameBurst {
    0%   { transform: scale(1);    filter: brightness(1); }
    40%  { transform: scale(1.18); filter: brightness(1.55); }
    100% { transform: scale(1.02); filter: brightness(1.05); }
}

/* ── Reducción en dispositivos táctiles (mismo patrón que el resto del proyecto) ── */
@media (pointer: coarse) {
    .streak-flame__glow { filter: blur(10px); }
}

/* ── prefers-reduced-motion ── */
@media (prefers-reduced-motion: reduce) {
    .streak-flame .flame-layer,
    .streak-flame__glow,
    .spark,
    .streak-flame__svg {
        animation: none !important;
    }
    .streak-flame[data-state="available"] .streak-flame__glow { opacity: 0.5; }
    .streak-flame[data-state="claimed"] .streak-flame__glow  { opacity: 0.2; }
}
```

**Comportamiento esperado**
- En `data-state="locked"`: fuego apagado/grisáceo, sin chispas, glow casi imperceptible.
- En `data-state="available"`: fuego vívido, chispas visibles ascendiendo, glow pulsante notorio.
- En `data-state="claimed"`: fuego con movimiento más lento, colores desaturados, sin chispas, pero **nunca `display:none` ni `opacity:0` en su totalidad**.
- En `data-state="repair"`: tono ámbar/rojizo sutil, sin chispas, comunica "necesita atención" sin ser alarmante.
- En `data-state="claiming"`: throb de escala+brillo de 480ms, luego el JS (Ticket-05) restaura el estado final (`claimed`).

**Performance**
Cumple el budget de la Parte 6.1: ≤ 12 nodos en reposo, solo `transform`/`opacity` en bucle, blur estático, reducido en `pointer: coarse`, desactivado en `prefers-reduced-motion`.

**Accesibilidad**
Todo el widget de fuego lleva `aria-hidden="true"` (ya aplicado en Ticket-02) — la información semántica vive en el número y el texto adyacente, no en el SVG.

**Responsive**
El tamaño de `.streak-flame` (108×144px) es fijo en mobile; en desktop puede escalar ligeramente vía `@media (min-width: 768px)` — ver Ticket-04 para el ajuste conjunto con el número.

**Limpieza / eliminación**
Ninguna en este ticket (es puramente aditivo).

**Documentación**
Documentar en `docs/DOCUMENTACION.md` una nueva sección "§2ah — Daily Streak Hub: Fire Widget" describiendo la arquitectura (3 capas SVG, glow, chispas, 5 estados), replicando el razonamiento de la Parte 5 de este documento.

**Preservación**
No se toca ningún selector CSS existente fuera de esta sección nueva.

**Criterios de aceptación**
- [ ] Con `data-state="available"` fijado manualmente en DevTools, se observan 3 capas de llama moviéndose de forma no sincronizada y 6 chispas ascendiendo con timing escalonado.
- [ ] Cambiar el atributo a `claimed`, `locked`, `repair` produce el cambio visual esperado sin recargar la página.
- [ ] Con `prefers-reduced-motion: reduce` emulado en DevTools, ninguna animación en bucle se ejecuta pero el fuego sigue siendo visible con opacidad/color correctos por estado.
- [ ] Performance panel de Chrome no muestra actividad relevante en el hilo "Main" durante 10s con `available` activo (todo compositado).

**Validación**
Grabar un perfil de 10 segundos en Chrome DevTools → Performance con el estado `available`, confirmar ausencia de "Layout"/"Paint" recurrentes fuera del área del glow (que sí puede pintar una vez al cambiar `opacity`, pero de forma compositada, no recalculando el blur).

**Riesgos**
Bajo. El único riesgo es en navegadores muy antiguos sin soporte de `color-mix()`/`filter` avanzado — el proyecto ya usa `color-mix()` extensamente en `styles.css` (tokens `--accent-soft-aa`, etc.), por lo que el baseline de compatibilidad ya asume soporte moderno.

---

### TICKET-04 — Tratamiento visual del número de racha y composición final del widget

**Tipo:** Frontend / CSS
**Prioridad:** P0
**Dependencias:** Ticket-02, Ticket-03
**Confianza:** Alta

**Objetivo**
Dar al número de racha (`#streak-count-big`) el mismo peso visual que el fuego, con tratamiento de "estadística de videojuego", y ajustar la micro-barra de 7 segmentos y el countdown para que convivan armónicamente debajo.

**Contexto**
Ver Parte 4.6.

**Implementación — CSS a añadir**

```css
.streak-hub-number {
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1;
    margin-top: -8px; /* solapa ligeramente con la base del fuego para composición unificada */
}
.streak-hub-number__value {
    font-family: var(--font-display);
    font-weight: 900;
    font-size: clamp(2.2rem, 11vw, 3rem);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    background: linear-gradient(180deg, #fff6c8, #ffb238 55%, #ff6a1a);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    text-shadow: 0 0 26px rgba(255, 138, 30, 0.35);
    transition: transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.streak-hub-number__label {
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-low);
    margin-top: -2px;
}

/* Estado claimed: número en plata, no dorado — comunica "asegurado", no "listo para reclamar" */
.streak-flame[data-state="claimed"] ~ .streak-hub-number .streak-hub-number__value,
#streak-flame[data-state="claimed"] + .streak-hub-number .streak-hub-number__value {
    background: linear-gradient(180deg, #f4f6ff, #c7ceee 60%, #9aa4d6);
    -webkit-background-clip: text;
    background-clip: text;
    text-shadow: 0 0 18px rgba(155, 164, 214, 0.28);
}

/* Estado locked: gris apagado */
#streak-flame[data-state="locked"] + .streak-hub-number .streak-hub-number__value {
    background: none;
    -webkit-text-fill-color: var(--text-mute);
    color: var(--text-mute);
    text-shadow: none;
}

/* Pulso al incrementar (clase añadida temporalmente por JS, ver Ticket-06) */
.streak-hub-number__value.is-bumping {
    animation: streakNumberBump 380ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes streakNumberBump {
    0%   { transform: scale(1); }
    45%  { transform: scale(1.14); }
    100% { transform: scale(1); }
}

.streak-hub-copy {
    margin-top: 6px;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--text-secondary-aa);
    display: flex;
    align-items: center;
    gap: 6px;
}
.streak-hub-copy__amount {
    font-family: var(--font-display);
    font-weight: 900;
    color: var(--gold);
    font-size: 0.88rem;
}

/* Micro-progreso semanal — mismo #streak-days ya existente, restilizado más "premium" */
.streak-days {
    display: flex;
    gap: 5px;
    width: min(260px, 100%);
    margin: 10px auto 0;
}
.streak-day {
    flex: 1;
    height: 8px;
    border-radius: 4px;
    background: var(--solid-surface-deep);
    border: 1px solid var(--border-subtle);
    transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}
.streak-day.active {
    background: linear-gradient(90deg, #ffb238, #ff6a1a);
    border-color: rgba(255, 138, 30, 0.5);
    box-shadow: 0 0 10px rgba(255, 138, 30, 0.45);
}
.streak-day.today {
    animation: streakPulse 1.5s ease-in-out infinite;
}

.hud-countdown {
    margin-top: 8px;
    font-family: var(--font-mono);
    text-align: center;
}
```

**Notas sobre el selector CSS del estado "claimed"/"locked" del número**
Dado que `#streak-flame` y `.streak-hub-number` son **hermanos** dentro del `<button id="btn-daily">` (ver markup del Ticket-02), el selector de hermano adyacente `#streak-flame[data-state="..."] + .streak-hub-number` funciona de forma nativa en CSS sin necesitar JS adicional para colorear el número — **un solo cambio de atributo (`data-state`) en `#streak-flame` controla tanto el fuego como el color del número**. Esto es intencionadamente eficiente: un solo punto de verdad de estado.

**Comportamiento esperado**
El número domina visualmente tanto como el fuego; cambia de color según el estado del fuego automáticamente vía CSS puro; al incrementarse tras un claim (Ticket-06 añade la clase `.is-bumping` vía JS y la remueve en `animationend`), pulsa una vez.

**Responsive**
```css
@media (min-width: 768px) {
    .streak-flame { width: 132px; height: 176px; }
    .streak-hub-number__value { font-size: clamp(2.6rem, 6vw, 3.6rem); }
}
```

**Accesibilidad**
El `role="img"` con `aria-label` en `.streak-hub-number` (ya definido en Ticket-02) debe actualizarse dinámicamente en JS (Ticket-05) a algo como `"Racha actual: 27 días"`.

**Limpieza / eliminación**
Marcar para Ticket-12: `.hud-daily-reward`, `.hud-daily-label` (reglas CSS antiguas de tamaño fijo 72px), `.streak-count` (estilos visuales, no el ID).

**Documentación**
Añadir a la misma sección `§2ah` del Ticket-03 el subapartado "Tratamiento del número".

**Preservación**
`updateStreakBar()` sigue escribiendo en `#streak-count` (oculto) sin cambios; Ticket-05 añade la sincronización hacia `#streak-count-big`.

**Criterios de aceptación**
- [ ] El número y el fuego se perciben como una sola composición, no como dos elementos desconectados.
- [ ] Cambiar `data-state` en `#streak-flame` cambia automáticamente el color del número sin JS adicional.
- [ ] La micro-barra de 7 segmentos se ve proporcional y legible en una pantalla de 360px de ancho.

**Validación**
Probar en viewport de 360×640 (gama baja común) y 768×1024 (tablet) que no hay overflow horizontal ni recortes de texto.

**Riesgos**
Bajo.

---

### TICKET-05 — Sincronización de estado JS: `data-state`, número grande y copy dinámico

**Tipo:** Frontend / JS
**Prioridad:** P0
**Dependencias:** Ticket-00, Ticket-02, Ticket-03, Ticket-04
**Confianza:** Alta

**Objetivo**
Escribir la lógica en `js/streak-hub.js` que traduce el estado real (`GameCenter.getStreakInfo()`, `canClaimDaily()`, `getMoonBlessingStatus()`, y el `dataset.mode` que ya calcula `updateDailyButton()`) al atributo `data-state` de `#streak-flame`, al contenido de `#streak-count-big`, y al copy de `#hud-daily-cta-text`/`#hud-reward-amount`.

**Contexto**
`updateDailyButton()` en `js/app.js` ya calcula todo lo necesario (`can`, `info`, `repairMode`, `enabled`) pero solo lo aplica a `#btn-daily.disabled`, `#hud-daily-label` (hoy con texto "BONO DIARIO"/"REPARAR RACHA" — en el nuevo diseño ese nodo pasa a mostrar fijamente "DÍAS" bajo el número, así que su contenido debe **dejar de ser sobrescrito por `updateDailyButton()`** con esos textos; ver ajuste abajo) y `#hud-reward-amount`.

**Evidencia — función actual completa**
```js
function updateDailyButton(scope) {
    const root = scope || document;
    const btn = root.querySelector('#btn-daily');
    if (!btn) return;
    const can  = window.GameCenter.canClaimDaily();
    const info = window.GameCenter.getStreakInfo();
    const repairMode = Boolean(info.repairAvailable);
    const enabled = repairMode ? Boolean(info.canAffordRepair) : can;
    btn.disabled      = !enabled;
    btn.style.opacity = enabled ? '1' : '0.5';
    btn.style.cursor  = enabled ? 'pointer' : 'not-allowed';
    btn.dataset.mode  = repairMode ? 'repair' : 'claim';
    btn.setAttribute('aria-label', repairMode ? 'Reparar racha diaria' : 'Reclamar bono diario');
    const labelEl = root.querySelector('#hud-daily-label');
    if (labelEl) labelEl.textContent = repairMode ? 'REPARAR RACHA' : 'BONO DIARIO';
    const msg = root.querySelector('#daily-msg');
    if (msg && repairMode && !info.canAffordRepair) { ... }
    const rewardEl = root.querySelector('#hud-reward-amount');
    if (rewardEl) {
        if (repairMode) { rewardEl.textContent = `${info.repairCost} 🪙`; }
        else if (!can) { rewardEl.textContent = `×${info.streak}`; }
        else { const moonStatus = ...; rewardEl.textContent = `+${total}`; }
        return;
    }
    // rama "botón clásico" — no aplica a este HUD
}
```

**Implementación**

**Paso A — Ajuste mínimo en `js/app.js`:** cambiar la línea que sobrescribe `#hud-daily-label` para que ya no escriba "BONO DIARIO"/"REPARAR RACHA" ahí (ese nodo ahora es fijo, dice "DÍAS"), y en su lugar delegar ese texto a un nuevo nodo. Concretamente:

```js
// ANTES:
const labelEl = root.querySelector('#hud-daily-label');
if (labelEl) labelEl.textContent = repairMode ? 'REPARAR RACHA' : 'BONO DIARIO';

// DESPUÉS:
const ctaTextEl = root.querySelector('#hud-daily-cta-text');
if (ctaTextEl) ctaTextEl.textContent = repairMode ? 'Reparar racha' : 'Toca para reclamar';
```

Esto es un cambio de **una línea** dentro de una función existente — no se reescribe `updateDailyButton()`, solo se redirige qué nodo recibe ese texto. `#hud-daily-label` deja de ser tocado por esta función (permanece estático con "DÍAS" desde el HTML del Ticket-02).

**Paso B — Nuevo código en `js/streak-hub.js`:**

```js
(function StreakHubModule() {
    'use strict';

    function _syncFlameState() {
        const flameEl = document.getElementById('streak-flame');
        const bigNumberEl = document.getElementById('streak-count-big');
        const numberWrapEl = bigNumberEl?.closest('.streak-hub-number');
        if (!flameEl) return;

        const info = window.GameCenter?.getStreakInfo?.();
        const can  = window.GameCenter?.canClaimDaily?.();
        if (!info) return;

        let state;
        if (info.repairAvailable) {
            state = 'repair';
        } else if (info.streak === 0 && can) {
            state = 'locked'; // nunca reclamado — primer día disponible, tono neutro
        } else if (can) {
            state = 'available';
        } else {
            state = 'claimed';
        }

        flameEl.dataset.state = state;

        if (bigNumberEl) bigNumberEl.textContent = String(info.streak);
        if (numberWrapEl) {
            numberWrapEl.setAttribute('aria-label', `Racha actual: ${info.streak} día${info.streak !== 1 ? 's' : ''}`);
        }
    }

    function refresh() {
        _syncFlameState();
    }

    window.StreakHub = window.StreakHub || {};
    window.StreakHub.refresh = refresh;

    document.addEventListener('DOMContentLoaded', refresh);
})();
```

**Paso C — Enganchar `refresh()` en los puntos donde ya se refresca el HUD hoy**, para no depender de un timer nuevo:
1. En `index.html`, dentro de `window.HomeView.refresh()`, añadir `window.StreakHub?.refresh?.();` junto a `updateStreakBar()` y `updateCountdownDisplay()`.
2. En `index.html`, dentro del listener secundario de `#btn-daily` (el que ya hace `setTimeout(..., 80)`), añadir también `window.StreakHub?.refresh?.();`.
3. En `js/app.js`, al final del bloque **INIT síncrono** (justo después de `updateDailyButton(); updateMoonBlessingUI();`), **no** es necesario llamar aquí porque `window.StreakHub` puede no estar cargado todavía en ese punto síncrono (se carga después en el orden de scripts) — se confía en que `window.HomeView.refresh()`/`onEnter()` ya se ejecuta al iniciar el router (`navigateTo('home', null, true)` en `spa-router.js`), lo cual ocurre después de que todos los scripts síncronos ya cargaron. Confirmado seguro.

**Comportamiento esperado**
Al cargar la Home, el fuego y el número reflejan correctamente el estado real de la racha sin ningún desfase visual respecto al botón (que sigue siendo controlado por la lógica ya existente de `updateDailyButton()`).

**Estados**
Cubre los 4 estados de negocio reales (`locked`/`available`/`repair`/`claimed`); `claiming` se gestiona por separado en Ticket-06 (es transitorio y no depende de `getStreakInfo()`).

**Performance**
`_syncFlameState()` es una función ligera (unas pocas lecturas de propiedades ya calculadas por `GameCenter`, sin recorrer el DOM más que 2-3 `getElementById`), se ejecuta solo en los puntos de refresco ya existentes (no añade ningún timer nuevo).

**Documentación**
Documentar en `docs/sistema-racha-diaria.md` la nueva función `_syncFlameState()` y el cambio de una línea en `updateDailyButton()`.

**Preservación**
`updateDailyButton()` conserva el 100% de su lógica de negocio (habilitar/deshabilitar, modo repair, cálculo de recompensa); solo cambia **a qué nodo** escribe el label de texto.

**Criterios de aceptación**
- [ ] Con `streak = 0` recién migrado (usuario nuevo), `data-state` es `locked` mientras `canClaimDaily()` es `true`.
- [ ] Tras reclamar el primer día, `data-state` pasa a `claimed` y el número muestra `1`.
- [ ] Con una racha de varios días y `canClaimDaily() === true`, `data-state` es `available`.
- [ ] Con `repairAvailable === true` (simular manualmente en consola ajustando `store.daily.lastClaim`), `data-state` es `repair`.
- [ ] `#hud-daily-cta-text` muestra "Reparar racha" en modo repair y "Toca para reclamar" en modo claim.

**Validación**
En consola: `window.GameCenter.getStreakInfo()` y comparar manualmente contra `document.getElementById('streak-flame').dataset.state`.

**Riesgos**
Bajo-medio: el criterio para diferenciar `locked` (primera vez) de `claimed` normal se basa en `info.streak === 0 && can` — si un usuario reclama y por algún bug la racha vuelve a 0 mientras `can` es `false`, mostraría `claimed` con streak 0, lo cual es visualmente aceptable (no rompe nada, solo no se ve "locked" en ese edge case raro).

---

### TICKET-06 — Interacción de reclamo: burst del fuego, coin-burst, pulso del número

**Tipo:** Frontend / JS + CSS
**Prioridad:** P0
**Dependencias:** Ticket-03, Ticket-04, Ticket-05
**Confianza:** Alta

**Objetivo**
Conectar el resultado de `claimDaily()` con la secuencia visual completa: `claiming` (480ms) → coin burst hacia la navbar → pulso del número → vuelta a `claimed`.

**Contexto**
`claimDaily()` es síncrono; el handler de clic en `js/app.js` ya tiene acceso inmediato a `result` en la misma función. Este ticket añade una llamada a `window.StreakHub.playClaimSequence(result)` justo después de que se resuelve el reclamo, sin alterar el resto de la lógica del handler.

**Implementación**

**Paso A — CSS del coin-burst en `styles.css`:**
```css
.streak-coin-burst {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;
    z-index: 5;
}
.streak-coin-burst .coin {
    position: absolute;
    left: 50%;
    top: 46%;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff3c4, #fbbf24 60%, #b8790a 100%);
    box-shadow: 0 0 4px rgba(251, 191, 36, 0.7);
    opacity: 0;
    transform: translate(-50%, -50%);
    animation: coinFly 700ms cubic-bezier(.2,.8,.2,1) forwards;
}
@keyframes coinFly {
    0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
    15%  { opacity: 1; }
    100% { opacity: 0; transform: translate(calc(-50% + var(--coin-x, 0px)), calc(-50% + var(--coin-y, -160px))) scale(1) rotate(220deg); }
}
@media (prefers-reduced-motion: reduce) {
    .streak-coin-burst .coin { animation-duration: 260ms; }
}
```
`.player-hud` debe tener `position: relative` para que `.streak-coin-burst` (posicionado `absolute; inset:0`) se recorte a su contenedor — **ya lo tiene** (`styles.css`, `.player-hud { position: relative; ... }`, confirmado existente).

**Paso B — JS en `js/streak-hub.js`, añadir a la IIFE existente del Ticket-05:**
```js
function _spawnCoinBurst(count = 8) {
    const container = document.getElementById('streak-coin-burst');
    if (!container) return;
    for (let i = 0; i < count; i += 1) {
        const coin = document.createElement('span');
        coin.className = 'coin';
        const angle = (Math.PI / 3) + (Math.random() * Math.PI / 3); // hacia arriba, con dispersión
        const distance = 100 + Math.random() * 70;
        const x = Math.cos(angle) * distance * (Math.random() < 0.5 ? -1 : 1);
        const y = -Math.abs(Math.sin(angle) * distance) - 60;
        coin.style.setProperty('--coin-x', `${x}px`);
        coin.style.setProperty('--coin-y', `${y}px`);
        coin.style.animationDelay = `${i * 22}ms`;
        coin.addEventListener('animationend', () => coin.remove(), { once: true });
        container.appendChild(coin);
    }
}

function _bumpStreakNumber() {
    const el = document.getElementById('streak-count-big');
    if (!el) return;
    el.classList.remove('is-bumping');
    // Forzar reflow para poder re-disparar la animación si ya estaba aplicada
    void el.offsetWidth;
    el.classList.add('is-bumping');
    el.addEventListener('animationend', () => el.classList.remove('is-bumping'), { once: true });
}

function playClaimSequence(result) {
    const flameEl = document.getElementById('streak-flame');
    if (!flameEl || !result?.success) {
        window.StreakHub.refresh();
        return;
    }

    flameEl.dataset.state = 'claiming';

    setTimeout(() => {
        window.StreakHub.refresh(); // vuelve a 'claimed' vía _syncFlameState()
        _bumpStreakNumber();
        _spawnCoinBurst(8);
        window.StreakHub.playClaimAudio?.();
        if (navigator?.vibrate && (navigator.userActivation?.isActive || navigator.userActivation?.hasBeenActive)) {
            navigator.vibrate([12, 30, 18]);
        }
    }, 480); // sincronizado con la duración de flameBurst (Ticket-03)
}

window.StreakHub.playClaimSequence = playClaimSequence;
```

**Paso C — Enganchar en `js/app.js`, dentro del listener de `#btn-daily` existente**, añadiendo una sola línea tras `updateDailyButton()`:
```js
dailyBtn.addEventListener('click', () => {
    dailyBtn.disabled      = true;
    dailyBtn.style.opacity = '0.5';
    dailyBtn.style.cursor  = 'not-allowed';

    if (dailyBtn.dataset.mode === 'repair') {
        showDailyRepairModal();
        updateDailyButton();
        return;
    }

    const result = window.GameCenter.claimDaily();

    if (result.repairRequired) {
        showDailyRepairModal();
    } else {
        _setDailyMessage(result.message, result.success);
    }

    updateDailyButton();
    window.StreakHub?.playClaimSequence?.(result); // ← única línea añadida
});
```

**Comportamiento esperado**
Tap → fuego hace burst (480ms) → simultáneamente/inmediatamente después: 8 monedas vuelan desde el centro del widget hacia arriba-afuera (dirección general hacia la navbar) y se desvanecen, el número de racha pulsa una vez, se reproduce el sonido (Ticket-07), vibra si el dispositivo lo permite → el fuego se asienta en `claimed`.

**Estados**
`claiming` (480ms) es puramente transitorio, gestionado por este ticket; no requiere cambios en la máquina de estados de `getStreakInfo()`.

**Performance**
8 nodos DOM creados y destruidos una vez por evento de claim (frecuencia: como máximo unas pocas veces al día por usuario) — coste despreciable. `Math.random()` se usa aquí porque es un evento único, no un bucle por frame — aceptable y explícitamente distinto del código de animación en reposo (que es 100% CSS declarativo sin JS por frame).

**Audio**
Ver Ticket-07 (`window.StreakHub.playClaimAudio`).

**Accesibilidad**
El coin burst es puramente decorativo (`aria-hidden="true"` ya en el contenedor desde Ticket-02); la información real de "ganaste N monedas" ya se comunica por `#daily-msg` (`role="status"`, `aria-live="polite"`), que no se toca en este ticket.

**Limpieza / eliminación**
Ninguna.

**Documentación**
Añadir a `docs/DOCUMENTACION.md` §2ah el flujo completo de `playClaimSequence()`.

**Preservación**
El resto del handler de `#btn-daily` en `js/app.js` (modal de reparación, mensaje, `updateDailyButton()`) permanece 100% intacto; solo se añade una llamada al final.

**Criterios de aceptación**
- [ ] Al reclamar exitosamente, se observan monedas volando y el número pulsando.
- [ ] Al reclamar sin éxito (ya reclamado hoy, por ejemplo si se fuerza doble clic — aunque el botón se deshabilita, probar llamando `GameCenter.claimDaily()` manualmente dos veces en consola), `playClaimSequence` no debe generar coin-burst (verificar `result.success` antes de disparar el burst).
- [ ] Tras el burst, ningún nodo `.coin` queda huérfano en el DOM (confirmar en DevTools Elements que `#streak-coin-burst` queda vacío ~1s después del claim).

**Validación**
Simular un claim en consola: `document.getElementById('btn-daily').click()`, observar la secuencia completa, e inspeccionar `#streak-coin-burst` en Elements tras 2 segundos (debe estar vacío).

**Riesgos**
Bajo. Riesgo menor: si el usuario cierra la app/navega fuera durante los 480ms del `setTimeout`, el callback seguirá ejecutándose sobre nodos que podrían ya no estar en un DOM visible — no rompe nada porque todas las funciones usan `getElementById` con guardas `if (!el) return`.

---

### TICKET-07 — Audio sintetizado (Web Audio API) y verificación de haptics

**Tipo:** Frontend / JS
**Prioridad:** P1
**Dependencias:** Ticket-06
**Confianza:** Alta

**Objetivo**
Añadir `window.StreakHub.playClaimAudio()` con un sonido de "chime" generado por síntesis, sin archivo de audio nuevo.

**Contexto**
Ver Parte 4.8. No existe infraestructura de audio de Hub hoy (los `AudioSynth.js`/`Audio.js` existentes pertenecen a minijuegos individuales, aislados por namespace, no al núcleo).

**Implementación — añadir a `js/streak-hub.js`:**
```js
let _streakAudioCtx = null;

function _getStreakAudioCtx() {
    if (_streakAudioCtx) return _streakAudioCtx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
        _streakAudioCtx = new Ctx();
    } catch (_) {
        _streakAudioCtx = null;
    }
    return _streakAudioCtx;
}

/**
 * Reproduce un arpegio corto de 3 notas (síntesis, sin assets) al reclamar
 * el bono diario. Debe llamarse SIEMPRE dentro de un gesto de usuario
 * (el propio click de #btn-daily) para cumplir la política de autoplay.
 */
function playClaimAudio() {
    try {
        const ctx = _getStreakAudioCtx();
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const notes = [660, 880, 1320]; // arpegio ascendente, tono "recompensa"
        notes.forEach((freq, i) => {
            const osc  = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const start = now + i * 0.07;
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.18, start + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(start + 0.4);
        });
    } catch (_) {
        // Nunca romper el flujo de reclamo por un fallo de audio.
    }
}

window.StreakHub.playClaimAudio = playClaimAudio;
```

**Comportamiento esperado**
Al reclamar, se escucha un pequeño arpegio de 3 notas ascendentes (~420ms de duración total), sin ninguna petición de red ni archivo cacheado.

**Audio**
- Cero assets nuevos → **no requiere ninguna entrada nueva en `sw.js` `APP_SHELL_FILES`**.
- Cumple políticas de autoplay porque se invoca síncronamente dentro de la cadena de un evento `click` real del usuario.
- Envuelto en `try/catch` para que cualquier fallo (por ejemplo, `AudioContext` no soportado en un navegador muy antiguo) nunca bloquee el resto del flujo de reclamo.

**Performance**
Tres osciladores muy cortos (400ms), destruidos automáticamente por el propio `AudioContext` tras `osc.stop()`. Coste de CPU despreciable y puntual.

**Preservación**
No se modifica ningún sistema de audio existente de los minijuegos individuales.

**Documentación**
Documentar en `docs/DOCUMENTACION.md` §2ah la decisión de usar síntesis en vez de archivo de audio, con el razonamiento de la Parte 4.8.

**Criterios de aceptación**
- [ ] Al reclamar, se escucha el sonido en Chrome, Firefox y Safari de escritorio.
- [ ] En móvil (Android Chrome / iOS Safari), el sonido se reproduce sin requerir una segunda interacción (verificar que el gesto de tap en `#btn-daily` es suficiente).
- [ ] Si se simula la ausencia de `AudioContext` (renombrar temporalmente `window.AudioContext` en consola), el resto del flujo de reclamo sigue funcionando sin errores.

**Validación**
Probar manualmente en un dispositivo Android real de gama media/baja (o emulado) y confirmar ausencia de warnings de "autoplay blocked" en consola.

**Riesgos**
Bajo. Riesgo P2 futuro (fuera de este ticket): algunos usuarios pueden preferir silenciar el sonido — se recomienda como mejora futura (no bloqueante) añadir una preferencia de "sonido de recompensas" en Ajustes, reutilizando el patrón ya existente de `la_push_prefs_v1` en `js/push-notifications.js` como referencia de cómo el proyecto ya guarda preferencias de usuario en `localStorage`.

---

### TICKET-08 — Fix de bug: disparar el modal de hito inmediatamente tras el claim

**Tipo:** Bugfix
**Prioridad:** P0
**Dependencias:** Ninguna (independiente de todo el resto de tickets, puede implementarse en paralelo)
**Confianza:** Alta (bug confirmado por lectura directa del código)

**Objetivo**
Corregir el hallazgo de la Parte 2 (2.2 nota bug): `showStreakMilestoneModal()` no se llama tras un `claimDaily()` exitoso, por lo que un usuario que alcanza un hito (p. ej. 30 días) no ve la celebración hasta la siguiente carga completa de página.

**Contexto**
```js
// js/app.js — showStreakMilestoneModal() SÍ se llama en:
document.addEventListener('DOMContentLoaded', () => {
    ...
    showStreakMilestoneModal();   // (1) al cargar la página
    ...
});
// ... y recursivamente dentro de su propio botón de reclamo de hito:
claimBtn.onclick = () => {
    ...
    requestAnimationFrame(showStreakMilestoneModal); // (2) hito encadenado
};
// PERO nunca dentro del handler de #btn-daily.
```

**Implementación**
En el listener de `#btn-daily` (`js/app.js`), añadir la llamada **después** de `updateDailyButton()` y de la nueva línea de `playClaimSequence` (Ticket-06), para que la celebración de hito aparezca justo después de que termine el burst del fuego (evita que dos animaciones compitan por atención en el mismo instante):

```js
dailyBtn.addEventListener('click', () => {
    dailyBtn.disabled      = true;
    dailyBtn.style.opacity = '0.5';
    dailyBtn.style.cursor  = 'not-allowed';

    if (dailyBtn.dataset.mode === 'repair') {
        showDailyRepairModal();
        updateDailyButton();
        return;
    }

    const result = window.GameCenter.claimDaily();

    if (result.repairRequired) {
        showDailyRepairModal();
    } else {
        _setDailyMessage(result.message, result.success);
    }

    updateDailyButton();
    window.StreakHub?.playClaimSequence?.(result);

    // [Fix] Mostrar el hito de racha inmediatamente si corresponde, en vez de
    // esperar a la siguiente carga de página. Se retrasa ~600ms para que no
    // compita visualmente con el burst del fuego/coin-burst (Ticket-06/03).
    if (result.success) {
        setTimeout(() => { showStreakMilestoneModal(); }, 600);
    }
});
```

**Comportamiento esperado**
Un usuario que reclama su bono diario y alcanza (o supera) el umbral de un hito no reclamado ve el modal `#streak-milestone-modal` aparecer automáticamente ~600ms después del tap, sin necesidad de recargar la página.

**Estados**
Reutiliza `_streakMilestoneModalLocked` ya existente — sin cambios en esa protección contra reentradas.

**Performance**
Ninguna implicación — es solo reordenar una llamada ya existente.

**Documentación**
Documentar el fix en `docs/sistema-racha-diaria.md` §21 "Riesgos técnicos detectados", marcando este ítem como resuelto, y en `docs/DOCUMENTACION.md` como entrada de changelog nueva.

**Preservación**
`showStreakMilestoneModal()`, `_getPendingStreakMilestone()`, `claimStreakMilestone()` no cambian.

**Criterios de aceptación**
- [ ] Simular en consola: `store.daily.streak = 29; store.claimed_milestones = [];` y luego reclamar el bono diario normalmente (ajustando `store.daily.lastClaim` a ayer para que `diffDays === 1`) → tras el claim, el modal de hito de 30 días debe aparecer sin recargar la página.
- [ ] El modal sigue funcionando igual que antes en el flujo de `DOMContentLoaded` (carga de página con hito ya pendiente).

**Validación**
Prueba manual descrita arriba en consola del navegador.

**Riesgos**
Muy bajo — cambio aditivo de una llamada, con `setTimeout` para evitar colisión visual.

---

### TICKET-09 — Countdown y modal de reparación: integración visual con el nuevo hub

**Tipo:** Frontend / CSS
**Prioridad:** P1
**Dependencias:** Ticket-02, Ticket-04
**Confianza:** Alta

**Objetivo**
Ajustar visualmente `#daily-countdown` para que se sienta como un "temporizador de HUD de videojuego" en vez de una línea de texto plano, y confirmar que `#daily-repair-modal` (ya existente, sin cambios de lógica) se integra bien con el nuevo lenguaje visual del fuego.

**Contexto**
`updateCountdownDisplay()` (script inline de `index.html`) ya escribe `HH:MM:SS` en `#countdown-display`; no requiere ningún cambio de JS.

**Implementación — CSS**
```css
.hud-countdown {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin: 8px auto 0;
    padding: 4px 12px;
    border-radius: 999px;
    background: var(--solid-surface-deep);
    border: 1px solid var(--border-subtle);
    font-size: 0.72rem;
    color: var(--text-low);
}
.hud-countdown::before {
    content: '';
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 6px var(--accent-glow);
}
#countdown-display {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--text-med);
    letter-spacing: 0.03em;
}
```
Nota: `.hud-countdown` ya está centrado por el layout flex-column de `.player-hud`; el nuevo estilo solo lo convierte en un "chip" en vez de una línea de texto plano, sin afectar su lógica de `classList.toggle('hidden', ...)`.

Para `#daily-repair-modal`, `styles.css` ya define `.daily-repair-box` con el mismo lenguaje visual dorado/ámbar (`rgba(255, 223, 122, 0.36)`) — **confirmar que combina bien** con el nuevo tono ámbar del estado `repair` del fuego (Ticket-03: `hue-rotate(-14deg)`); no se requiere cambio de CSS en el modal, solo verificación visual manual.

**Comportamiento esperado**
El countdown se ve como una "pastilla" de HUD con un punto de acento pulsante, coherente con el resto del sistema de diseño "Arcade Solid".

**Responsive**
Sin cambios adicionales — hereda el centrado de `.player-hud`.

**Documentación**
Ninguna nueva, salvo mención en el changelog del Ticket-13.

**Preservación**
`updateCountdownDisplay()` no se toca.

**Criterios de aceptación**
- [ ] El countdown se ve como un chip compacto, no como texto suelto.
- [ ] El modal de reparación de racha sigue abriéndose y cerrándose exactamente igual que antes.

**Validación**
Forzar `dataset.mode = 'repair'` en `#btn-daily` manualmente y confirmar que el modal de reparación (`showDailyRepairModal()`) sigue funcionando sin cambios de comportamiento.

**Riesgos**
Muy bajo, puramente cosmético.

---

### TICKET-10 — Salvaguardas de rendimiento: visibilidad de pestaña y auditoría de `will-change`

**Tipo:** Performance
**Prioridad:** P0
**Dependencias:** Ticket-03
**Confianza:** Alta

**Objetivo**
Confirmar y, si es necesario, reforzar que las animaciones del fuego respetan el ciclo de vida de la pestaña, siguiendo el mismo patrón que `js/lifecycle-scheduler.js` ya aplica a los timers de JS (`AppScheduler`), aunque las animaciones CSS puras no requieren el mismo mecanismo.

**Contexto**
El proyecto ya tiene un patrón robusto de pausa de animaciones decorativas por visibilidad, implementado en `js/app.js`:
```js
const syncHudMotionVisibility = () => {
    document.querySelectorAll('.player-hud').forEach(hud => {
        hud.classList.toggle('motion-paused', document.hidden);
    });
};
syncHudMotionVisibility();
document.addEventListener('visibilitychange', syncHudMotionVisibility);
```
y en `styles.css`:
```css
.player-hud.motion-paused::before,
.player-hud.motion-paused .hud-avatar-ring {
    animation-play-state: paused;
}
```

**Implementación**
Extender la regla CSS ya existente para incluir también el fuego y las chispas, reutilizando la clase `.motion-paused` que **ya se aplica automáticamente** al mismo `.player-hud` sin necesidad de tocar el JS de `syncHudMotionVisibility()` (que ya selecciona `.player-hud` genéricamente):

```css
/* Añadir a la sección ya existente de .motion-paused en styles.css */
.player-hud.motion-paused .flame-layer,
.player-hud.motion-paused .streak-flame__glow,
.player-hud.motion-paused .spark {
    animation-play-state: paused;
}
```

**Comportamiento esperado**
Al cambiar de pestaña (`document.hidden === true`), el fuego se congela en su pose actual en vez de seguir animando en background — coherente con el ahorro de batería ya perseguido por el proyecto para el resto del HUD.

**Performance**
Esto es una salvaguarda adicional: aunque los navegadores modernos ya limitan/pausan trabajo de composición en pestañas ocultas de forma automática para animaciones puramente CSS, replicar el patrón ya usado en `.hud-avatar-ring` mantiene consistencia y una defensa explícita, especialmente en navegadores o WebViews embebidos con políticas de throttling menos agresivas.

**Documentación**
Mencionar en `docs/DOCUMENTACION.md` §2ah que el fuego se integra en el sistema `.motion-paused` ya existente, sin requerir un mecanismo nuevo.

**Preservación**
Cero cambios en `js/app.js` — la clase `.motion-paused` ya se aplica automáticamente a `.player-hud`; solo se añaden las reglas CSS de destino dentro de ese contenedor.

**Criterios de aceptación**
- [ ] Cambiar de pestaña y volver (o usar DevTools → "More tools → Rendering" para simular `visibilitychange`) confirma que el fuego se detiene y se reanuda correctamente.
- [ ] No hay ningún salto visual brusco al reanudar (la animación retoma desde su posición pausada, comportamiento nativo de `animation-play-state`).

**Validación**
En DevTools Console: `document.querySelector('.player-hud').classList.add('motion-paused')` y confirmar visualmente que el fuego se congela; remover la clase y confirmar que continúa.

**Riesgos**
Ninguno — extensión de un patrón ya probado en producción dentro del propio proyecto.

---

### TICKET-11 — Accesibilidad: foco, `aria-live`, contraste y `role="img"`

**Tipo:** Accesibilidad
**Prioridad:** P0
**Dependencias:** Ticket-02, Ticket-04, Ticket-05
**Confianza:** Alta

**Objetivo**
Garantizar que el nuevo Daily Streak Hub sea completamente operable por teclado y comprensible por lectores de pantalla, sin regresiones respecto al HUD anterior.

**Contexto**
El HUD anterior ya tenía buenas bases: `#daily-msg` con `role="status"`/`aria-live="polite"`, `#streak-days` con `role="img"`/`aria-label` dinámico, `aria-describedby` en el botón. El rediseño reestructura el DOM y debe preservar/extender exactamente estos patrones.

**Implementación**
1. Confirmar que `#btn-daily` sigue siendo un `<button type="button">` real (no un `<div>` con `onclick`) — **ya está así en el markup del Ticket-02**. Esto garantiza automáticamente: foco por Tab, activación por Enter/Space, rol semántico correcto, sin necesitar `role="button"` ni `tabindex` manual.
2. `aria-label` del botón (`"Reclamar bono diario"` / `"Reparar racha diaria"`) ya se gestiona por `updateDailyButton()` — sin cambios.
3. Añadir `aria-live="off"` explícito al contenedor `.streak-flame` (ya tiene `aria-hidden="true"` desde Ticket-02, lo cual es suficiente y ya excluye su contenido del árbol de accesibilidad — no se requiere `aria-live` adicional ahí).
4. El `role="img"` de `.streak-hub-number` (Ticket-02) debe recibir su `aria-label` actualizado dinámicamente por `_syncFlameState()` (Ticket-05) — **ya implementado en ese ticket**, confirmar en QA.
5. Verificar contraste de color: el número en estado `available` (gradiente dorado sobre fondo `--solid-surface-float`) y en estado `claimed` (gradiente plata) deben superar 3:1 de contraste como elemento gráfico grande (WCAG 1.4.11 "Non-text Contrast" para componentes de UI, o 1.4.3 si se considera texto grande ≥ 24px, que es el caso aquí dado el `clamp()` usado). Dado que `background-clip: text` con gradiente dificulta medir contraste automáticamente, validar manualmente con una herramienta de contraste tomando el color más oscuro del gradiente contra el fondo.
6. `#daily-msg` conserva `role="status"` `aria-live="polite"` sin cambios — sigue siendo el canal principal de anuncio de resultado del reclamo para lectores de pantalla (el burst de monedas y el fuego son puramente decorativos y no deben duplicar ni sustituir este anuncio).
7. Foco visible: `.streak-hub-cta:focus-visible` ya definido en Ticket-03 con `box-shadow` de anillo de foco usando el token `--focus-ring-aa` ya existente en el proyecto (mismo patrón que el resto de elementos interactivos vía el selector `:where(button, ...)` global de `styles.css`).

**Accesibilidad**
Esta es la sección central del ticket; ver implementación arriba.

**Responsive**
N/A.

**Documentación**
Añadir una checklist de accesibilidad específica del Daily Streak Hub a `docs/DOCUMENTACION.md` §17 (ya existe una sección de accesibilidad para el sistema de racha en `docs/sistema-racha-diaria.md`, actualizarla ahí también).

**Preservación**
Todo el sistema de accesibilidad ya existente (`role="status"`, `aria-live`, `aria-describedby`) se conserva íntegro.

**Criterios de aceptación**
- [ ] Navegando solo con teclado (Tab + Enter), se puede reclamar el bono diario sin usar el mouse.
- [ ] Con un lector de pantalla (VoiceOver/NVDA), al enfocar el botón se anuncia correctamente "Reclamar bono diario" (o "Reparar racha diaria" en modo repair).
- [ ] Tras reclamar, el lector de pantalla anuncia el mensaje de `#daily-msg` (ya funciona hoy, confirmar que sigue funcionando).
- [ ] El anillo de foco es visible con alto contraste al navegar por teclado.

**Validación**
Prueba manual con VoiceOver (macOS/iOS) o NVDA (Windows) navegando la Home completa por teclado.

**Riesgos**
Bajo — el ticket es principalmente de verificación sobre una base ya sólida, más un par de adiciones defensivas.

---

### TICKET-12 — Limpieza de deuda técnica: CSS, JS y clases obsoletas

**Tipo:** Limpieza
**Prioridad:** P1
**Dependencias:** Ticket-01 a Ticket-09 completados y validados en producción durante al menos un ciclo de QA
**Confianza:** Media (depende de confirmar en QA real que nada más referencia estas reglas)

**Objetivo**
Eliminar definitivamente el CSS y JS que quedó huérfano tras el rediseño, evitando que el proyecto acumule reglas muertas.

**Implementación — a eliminar de `styles.css`** (verificar cada una con `grep` antes de borrar, por si algún otro selector la reutiliza):
- `.hud-greeting` (y su regla dentro de `@media (min-width: 768px)` si existiera — no se encontró ninguna).
- `.hud-status`, `.hud-status-dot`, `@keyframes blink`.
- `.hud-balance`, `.hud-balance::before`, `.hud-balance-label`, `.hud-balance-amount`.
- `.hud-daily-btn`, `.hud-daily-btn::before`, `.hud-daily-btn::after`, `.hud-daily-btn:hover`, `.hud-daily-btn:disabled`, `@keyframes dailyBtnPulse`, `.hud-daily-reward`, `.hud-daily-label` (la clase CSS antigua de 0.55rem — **no el ID**, que se conserva).
- Confirmar si `.hud-balance-row` queda completamente vacío de propósito tras retirar `.hud-balance` — si es así, simplificar el HTML retirando ese `<div>` envolvente también (requiere pequeño ajuste adicional de markup, documentarlo en este mismo ticket).

**Implementación — a revisar en `js/app.js`:**
- La rama de "botón clásico" dentro de `updateDailyButton()` (`const span = btn.querySelector('span'); if (span) { ... }`) queda como código muerto **si se confirma que ninguna otra vista futura reutiliza `#btn-daily` con esa estructura antigua**. Dado que hoy solo existe un `#btn-daily` en toda la SPA (en Home), y el nuevo markup del Ticket-02 ya no contiene un `<span>` directo como hijo de `#btn-daily` con ese propósito, esta rama nunca se ejecutará (el `return` anterior dentro del bloque `if (rewardEl)` siempre se alcanza primero, dado que `#hud-reward-amount` seguirá existiendo). **Se recomienda eliminarla**, pero se marca como P1 (no P0) porque no causa ningún daño funcional dejarla — es simplemente código inalcanzable.

**Comportamiento esperado**
Ningún cambio visual ni funcional tras esta limpieza — es puramente eliminación de código muerto ya confirmado sin consumidores.

**Limpieza / eliminación**
Ver listas arriba — es el contenido central de este ticket.

**Documentación**
Actualizar `docs/DOCUMENTACION.md` con una entrada de changelog "Cleanup: HUD legacy classes removed post Daily Streak Hub redesign", listando exactamente las clases retiradas para que quede trazabilidad histórica (siguiendo el patrón ya usado en el resto del changelog del proyecto, p. ej. la entrada v10.1 que documentó la eliminación de los corner accents).

**Preservación**
No eliminar ningún ID (`#btn-daily`, `#hud-daily-label`, `#hud-reward-amount`, etc.) — **solo clases CSS y código JS confirmado inalcanzable**.

**Criterios de aceptación**
- [ ] `grep -rn "hud-daily-btn\|hud-balance\|hud-status\|hud-greeting" --include=*.html --include=*.js --include=*.css .` no devuelve ninguna coincidencia tras la limpieza (excepto en el propio changelog de documentación, que las menciona como históricas).
- [ ] La app sigue funcionando idénticamente tras la limpieza (regresión visual = 0).

**Validación**
Comparar capturas de pantalla antes/después de la limpieza (deben ser pixel-idénticas, ya que es solo remoción de reglas sin selector activo).

**Riesgos**
Medio: si alguna regla marcada para eliminar en realidad sigue teniendo un selector activo no detectado en la auditoría (por ejemplo, un selector compuesto como `.hud-balance-row .hud-daily-btn:hover`), eliminarla causaría una regresión visual silenciosa. **Mitigación:** ejecutar este ticket solo después de que Ticket-01 a Ticket-11 lleven al menos un ciclo de QA en producción sin issues reportados, y hacer `grep` exhaustivo antes de cada borrado.

---

### TICKET-13 — Documentación

**Tipo:** Documentación
**Prioridad:** P1
**Dependencias:** Todos los tickets anteriores
**Confianza:** Alta

**Objetivo**
Dejar el conocimiento arquitectónico del nuevo Daily Streak Hub documentado con el mismo nivel de detalle que el resto de features versionadas del proyecto.

**Implementación**
1. Añadir sección **"§2ah — Daily Streak Hub Redesign (Fire Widget)"** en `docs/DOCUMENTACION.md`, siguiendo el formato exacto de las secciones anteriores (motivación, arquitectura, tabla de estados, decisiones de rendimiento, archivos modificados). Incluir explícitamente:
   - Tabla de estados `locked/available/repair/claiming/claimed` y su mapeo a `data-state`.
   - Justificación de SVG+CSS sobre Canvas/librerías (Parte 5 de este documento).
   - El bugfix del modal de hito (Ticket-08) como entrada de changelog independiente dentro de la misma sección.
   - Referencia cruzada a por qué se retiraron `.hud-greeting`, `.hud-status`, `.hud-balance` del HUD (enlazar al razonamiento de la Parte 2.4).
2. Actualizar `docs/sistema-racha-diaria.md`:
   - §2 "Archivos relacionados": añadir `js/streak-hub.js`.
   - §9 "UX en la pantalla de inicio": reescribir completamente para describir el nuevo HUD (estructura, IDs, estados visuales).
   - §17/§18 "Accesibilidad"/"Motion y rendimiento UX": actualizar con las nuevas animaciones y sus salvaguardas.
   - §21 "Riesgos técnicos detectados": marcar como resuelto el ítem del modal de hito no disparado tras claim (referenciar Ticket-08).
3. Actualizar `README.md` sección "Versión" con una línea nueva describiendo el Daily Streak Hub (siguiendo el formato ya usado: *"v14.2 — Floating Pill Navigation · ..."* → añadir *"v14.3 — Daily Streak Hub · fuego animado SVG/CSS, feedback de reclamo con audio sintetizado y haptics, fix de celebración de hitos"*).
4. Actualizar la tabla de "Estructura de Archivos" en `README.md` para incluir `js/streak-hub.js`.

**Documentación**
Es el objeto completo de este ticket.

**Criterios de aceptación**
- [ ] `docs/DOCUMENTACION.md`, `docs/sistema-racha-diaria.md` y `README.md` reflejan con precisión el estado final del código, sin ninguna referencia a elementos ya eliminados (`.hud-greeting`, `.hud-status`, `.hud-balance`) salvo como entradas históricas de changelog.

**Validación**
Lectura cruzada: cada ID/clase/función mencionada en la documentación nueva debe existir literalmente en el código tras Ticket-01–12.

**Riesgos**
Ninguno — ticket de documentación pura.

---

### TICKET-14 — QA final, profiling en dispositivo real y checklist de validación de producción

**Tipo:** QA
**Prioridad:** P0
**Dependencias:** Todos los tickets anteriores
**Confianza:** Alta

**Objetivo**
Confirmar que la experiencia completa cumple el performance budget (Parte 6) y el criterio de éxito (juice + claridad + performance + accesibilidad) antes de considerarse lista para producción.

**Implementación / Checklist de validación**

**Funcional**
- [ ] Usuario nuevo (streak 0): ve estado `locked`, reclama su primer día, ve `claiming` → `claimed`, streak pasa a 1.
- [ ] Usuario con racha activa: ve `available` cuando corresponde, reclama, ve la secuencia completa (fuego, número, monedas, sonido, haptic si aplica).
- [ ] Usuario con racha de 2 días de diferencia (recuperable): ve estado `repair`, el modal de reparación sigue funcionando exactamente igual que antes.
- [ ] Usuario que alcanza el hito de 30 días vía reclamo diario: ve el modal de celebración de hito inmediatamente (Ticket-08 validado).
- [ ] Bendición Lunar activa: el monto mostrado y reclamado sigue sumando correctamente el bonus de +90 (sin cambios de esa lógica, pero confirmar visualmente en `#hud-reward-amount` y en el resultado del claim).
- [ ] Navegar fuera de Home y volver (`SpaRouter.navigateTo('shop')` y volver a `'home'`): el widget de fuego sigue sincronizado correctamente (`window.HomeView.onEnter()`/`refresh()` dispara `StreakHub.refresh()`).

**Performance**
- [ ] Perfil de Chrome DevTools de 15s con `available` activo: sin actividad relevante en "Main thread", todo compositado.
- [ ] CPU throttling 4x en un equipo de gama media, confirmar ausencia de frames caídos perceptibles durante el burst de reclamo.
- [ ] Prueba en un dispositivo Android real de gama baja/media (o el equivalente disponible) reproduciendo el flujo completo de reclamo.
- [ ] Memoria: confirmar en DevTools → Memory que repetir el reclamo 10 veces seguidas (simulado ajustando `store.daily.lastClaim` manualmente en consola entre cada uno) no genera una fuga de nodos `.coin` acumulados en el DOM.

**Accesibilidad**
- [ ] Checklist completo del Ticket-11 revalidado en el build final.
- [ ] `prefers-reduced-motion` emulado en DevTools: todas las animaciones en bucle se detienen, la información de estado se sigue comunicando por color/texto.

**Responsive**
- [ ] 360×640 (gama baja común), 390×844 (iPhone estándar), 768×1024 (tablet), 1280×800 (desktop): sin overflow horizontal, sin recortes de texto, composición del widget siempre centrada y legible.

**Regresión**
- [ ] Todo el resto de la SPA (Tienda, Perfil, minijuegos) sigue funcionando exactamente igual — el cambio está aislado al Home HUD.
- [ ] `grep` final confirmando que ningún archivo referencia clases ya eliminadas (Ticket-12 validado).

**Riesgos**
Este ticket es el filtro final; cualquier hallazgo aquí debe generar un ticket de hotfix específico antes de cerrar el proyecto como "listo para producción".

---

## ORDEN RECOMENDADO DE IMPLEMENTACIÓN

1. **TICKET-00** — Andamiaje del módulo (`js/streak-hub.js`, orden de scripts).
2. **TICKET-01** — Auditoría y eliminación segura de elementos redundantes del HUD.
3. **TICKET-02** — Nueva estructura HTML del hub.
4. **TICKET-03** — Fuego (SVG + CSS), todos los estados.
5. **TICKET-04** — Número de racha y composición final.
6. **TICKET-05** — Sincronización de estado JS (`data-state`, número, copy).
7. **TICKET-08** — Fix del bug de milestone modal (puede hacerse en paralelo desde el día 1, es independiente).
8. **TICKET-06** — Interacción de reclamo (burst + coin-burst + pulso).
9. **TICKET-07** — Audio sintetizado.
10. **TICKET-09** — Countdown y modal de reparación (integración visual).
11. **TICKET-10** — Salvaguardas de rendimiento (visibilidad de pestaña).
12. **TICKET-11** — Accesibilidad.
13. **TICKET-14** — QA final y profiling (correr en paralelo con desarrollo, cerrar al final).
14. **TICKET-12** — Limpieza de deuda técnica (solo tras validar en producción).
15. **TICKET-13** — Documentación final (se completa progresivamente, se cierra al final).

Este orden prioriza: (a) que la app nunca quede en un estado roto entre tickets, (b) que el fix de bug de milestone (Ticket-08) se libere cuanto antes por ser independiente y de alto impacto, (c) que la limpieza de deuda técnica (Ticket-12) sea explícitamente la última acción de código, después de validar en producción que nada depende de lo que se va a borrar.

---

## CRITERIOS DE ÉXITO GLOBALES (resumen)

| Criterio | Cómo se verifica |
|---|---|
| Game feel | Revisión cualitativa tras Ticket-06/07: ¿se siente como un HUD de videojuego? |
| Juice | El burst de reclamo tiene movimiento, sonido y feedback perceptible sin depender de una sola señal |
| Claridad | El usuario entiende su racha, si puede reclamar, qué gana y qué pasó — sin leer texto largo |
| Performance | Ticket-14, budget de la Parte 6 cumplido |
| Accesibilidad | Ticket-11 y checklist de Ticket-14 |
| Mantenibilidad | Código aislado en `js/streak-hub.js`, cero dependencias nuevas, IDs preservados |
| Cleanup | Ticket-12 completado, `grep` de verificación limpio |
