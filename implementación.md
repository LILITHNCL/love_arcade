# 1. Resumen ejecutivo

1. `love_arcade` es una SPA vanilla sin `package.json`, bundler ni framework; el Streak Hub actual está repartido entre `index.html`, `styles.css`, `js/streak-hub.js` y `js/ui/hud-render.js`.
2. La racha de negocio ya tiene una fuente de verdad correcta: `gamecenter_v6_promos.daily.{lastClaim,streak}`, expuesta por `window.GameCenter`; el nuevo visual **no debe persistir estado propio**.
3. La animación antigua es SVG/CSS y debe eliminarse completamente: SVG inline, `flame-layer`, filtros, sparks, `streakPulse`, `streak-coin-burst` y referencias documentales/tests.
4. Se recomienda self-host de `@rive-app/canvas` **2.44.0**, junto con `fire-streak.riv`, para fijar JS/WASM, evitar CDN impredecible y mantener todos los recursos bajo el mismo origen. Rive confirma que `stateMachines` está deprecado y que `stateMachine` es el parámetro vigente desde 2.41.0.
5. Rive será lazy: IntersectionObserver `threshold: 0.25`, `document.visibilitychange`, `ResizeObserver`, DPR máximo 2 y `r.cleanup()` en el límite de ciclo de vida de `HomeView`.
6. El estado visual queda reducido estrictamente a `available` y `claimed`; `repair` no será un tercer estado visual: será `available` solamente cuando la reparación esté realmente disponible y pueda ejecutarse.
7. `0.75x` en State Machine no tiene API pública directa verificable en Rive 2.44.0; el plan usa `advanceAndApply(dt * 0.75)` mediante el driver interno del runtime. Esto queda marcado como **RIESGO NO VERIFICADO** y se prohíbe sustituirlo silenciosamente por 1x.
8. La implementación se divide en 3 tickets sin solapamiento de archivos: ciclo de vida/runtime, integración visual/claim y finalmente eliminación/documentación/verificación.

# 2. Análisis — Fase 2

## 2.1 Estado actual real del repositorio

### Stack y forma de servir la aplicación

La inspección completa del árbol de `main` no encontró:

```text
package.json
package-lock.json
npm-shrinkwrap.json
pnpm-lock.yaml
yarn.lock
vite.config.*
webpack.config.*
rollup.config.*
parcel.*
esbuild.*
```

Por tanto:

```text
HTML + CSS + JavaScript clásico
sin framework
sin bundler
sin pipeline npm
```

La entrada es `index.html`; los scripts se cargan mediante `<script src="...">`. `README.md:26-40` describe explícitamente el stack como HTML/CSS/JavaScript vanilla y documenta `js/ui/` como ubicación de UI.

El bootstrap es deliberadamente síncrono: `js/app.js` ejecuta las actualizaciones iniciales antes del primer paint. El comentario de `index.html:1238-1250` confirma que el inline final se utiliza para el camino Zero-Flicker.

### Fuente de verdad de la racha

La persistencia está en:

```text
localStorage["gamecenter_v6_promos"]
```

y dentro:

```js
{
    daily: {
        lastClaim: number,
        streak: number
    }
}
```

`js/core/config.js` define la clave en la configuración. `js/core/state-store.js:14-23` crea el valor por defecto `{ lastClaim: 0, streak: 0 }`, y `js/core/state-store.js:55-160` carga/guarda ese snapshot.

`js/domain/daily-streak.js:1-157` es la autoridad de negocio:

- `claimDaily()`
- `repairDailyStreak()`
- `canClaimDaily()`
- `getStreakInfo()`

El incremento **no debe duplicarse en el nuevo módulo**. `claimDaily()` ya hace:

```text
diffDays === 1 -> streak + 1
diffDays > 1   -> streak = 1
```

y actualiza el store sólo cuando el reclamo es válido.

`js/domain/game-center.js:78-104` publica esos métodos mediante `window.GameCenter`.

La consecuencia arquitectónica es importante:

> `StreakHub.claim()` debe llamar a `window.GameCenter.claimDaily()`. Nunca debe hacer `streak += 1`, escribir `localStorage`, tocar `LoveArcadeStore.daily` ni inferir `claimed` a partir de un flag propio.

### Restauración cloud

`js/cloud/sentinel.js` vigila `gamecenter_v6_promos`.

El flujo de restauración es:

```text
Supabase user_profiles.game_data
        ↓
_Snapshot
        ↓
localStorage["gamecenter_v6_promos"]
        ↓
LoveArcadeStore.replaceStore()
        ↓
GameCenter.syncUI()
```

Puntos relevantes:

- `_applySnapshot()` — `js/cloud/sentinel.js:233`
- `_rehydrateHubStoreFromDisk()` — `js/cloud/sentinel.js:245`
- `_handleAuthChange()` — `js/cloud/sentinel.js:348`
- `initHubRehydration()` — `js/cloud/sentinel.js:771`

Además, Sentinel dispara `la:cloudsynced`.

Esto obliga a que el nuevo hub sea una representación derivada del estado, no otra fuente de persistencia.

### Idempotencia

Actualmente existen dos capas de protección en la misma pestaña:

1. `js/ui/hud-render.js:188-203` deshabilita el botón antes del `claimDaily()`.
2. `js/domain/daily-streak.js:39-53` rechaza `diffDays === 0`, independientemente de UI.

El nuevo módulo añadirá una tercera protección local:

```text
_claimInFlight === true -> no volver a llamar GameCenter.claimDaily()
```

Esto garantiza que un doble click/Space/Enter rápido no provoque dos llamadas.

**Límite importante:** el sistema existente no implementa una transacción atómica servidor-side para dos pestañas que reclamen simultáneamente. No debe inventarse una falsa garantía distribuida en el módulo visual. La garantía exigida aquí es para interacciones repetidas dentro de la misma página; el dominio existente continúa siendo la autoridad para rechazar un segundo reclamo ya persistido.

### Estado inicial sin parpadeo

Actualmente:

```html
#streak-flame[data-state="locked"]
```

se convierte posteriormente al estado real mediante `StreakHub.refresh()`.

Eso se cambiará a:

```html
data-state="claimed"
```

como fallback inicial estático y calmado.

Después, el inline síncrono de `index.html` ejecutará:

```js
updateStreakBar();
updateCountdownDisplay();
window.StreakHub.init();
```

antes del primer paint.

Por tanto:

```text
HTML inicial = estado calmado seguro
        ↓
Store local ya cargado
        ↓
StreakHub.init()
        ↓
available/claimed real
        ↓
primer frame
```

No se utiliza el estado inicial para decidir lógica de negocio.

Cuando Sentinel restaure datos cloud posteriormente, `StreakHub.refresh()` recalculará el estado sin reproducir una celebración de claim.

---

# 2.2 Dónde está hoy el Streak Hub

## `index.html`

### Estructura visual antigua

`index.html:323-395`.

Actualmente contiene:

```text
#btn-daily
  #streak-flame
    #streak-flame__svg
      #flameOuter
      #flameCore
      .flame-layer--back
      .flame-layer--mid
      .flame-layer--core
    .streak-flame__sparks
      .spark x6
  #streak-count-big
  #streak-hub-copy
  #hud-reward-amount

#streak-days
#streak-count
#daily-countdown
#daily-msg
#streak-coin-burst
```

El SVG inline y sus elementos son la animación antigua y deben desaparecer completamente.

La prueba adjunta confirma que el prototipo Rive usaba un canvas de 160×160 y un botón de reclamo separado.

### Render de racha

`index.html:1164-1180`:

```js
updateStreakBar()
```

mantiene los siete segmentos y el contador textual.

Esta función debe conservarse funcionalmente.

### Countdown

`index.html:1182-1224` mantiene:

```text
updateCountdownDisplay()
```

y el grupo `countdown` del scheduler.

No pertenece a la animación Rive y no debe eliminarse.

### Lifecycle de Home

`index.html:1228-1250`:

```js
window.HomeView = {
    refresh() {
        updateCountdownDisplay();
        updateStreakBar();
        window.StreakHub?.refresh?.();
    },

    onLeave() {
        window.AppScheduler?.pauseGroup?.('countdown');
    },

    onEnter() {
        window.AppScheduler?.resumeGroup?.('countdown');
        updateCountdownDisplay();
    }
};
```

Debe convertirse en el lifecycle del Rive:

```text
onLeave:
    countdown.pause()
    StreakHub.destroy()

onEnter:
    countdown.resume()
    StreakHub.init()
    StreakHub.refresh()
```

Esto es especialmente importante porque `spa-router.js` no elimina físicamente las vistas: las oculta. El límite lógico de vida del Rive, por tanto, es `HomeView.onLeave()`.

`spa-router.js:212-217` confirma que ese callback se invoca cuando se abandona/entra la vista `home`.

### Listener duplicado de refresh

`index.html:1789-1799` registra otro:

```js
dailyBtn.addEventListener('click', () => {
    setTimeout(() => {
        updateCountdownDisplay();
        updateStreakBar();
        window.StreakHub?.refresh?.();
    }, 80);
});
```

Debe eliminarse por completo.

El nuevo `claim()` hará el feedback inmediatamente y `HUD.updateUI()`/`HomeView.refresh()` ya cubren sincronización posterior.

---

# 2.3 Lógica actual de UI

## `js/ui/hud-render.js`

`updateDailyButton()` está en `js/ui/hud-render.js:48-84`.

Es la autoridad para:

```text
disabled
data-mode
aria-label
texto CTA
importe
```

Debe seguir siendo la autoridad del botón.

El click principal está en `js/ui/hud-render.js:177-204`.

Actualmente:

```text
disable button
        ↓
si repair -> modal
si normal -> GameCenter.claimDaily()
        ↓
mensaje
        ↓
updateDailyButton()
        ↓
updateMoonBlessingUI()
        ↓
StreakHub.playClaimSequence()
```

Nuevo flujo:

```text
disable button
        ↓
si repair -> modal
si normal -> StreakHub.claim()
        ↓
StreakHub.claim() -> GameCenter.claimDaily()
        ↓
StreakHub inicia celebración sólo si success
        ↓
HUD actualiza textos/economía
```

Para la confirmación del modal de reparación, `GameCenter.repairDailyStreak()` seguirá siendo llamado desde `hud-render.js`; cuando el resultado sea exitoso deberá ejecutarse la misma celebración Rive.

## `updateUI()`

`js/ui/hud-render.js:102-123`.

Debe terminar con:

```js
window.StreakHub?.refresh?.();
```

porque puede ejecutarse después de:

- `Store.save()`
- cloud rehydration
- cambios de identidad
- cambios económicos
- navegación

Esto evita que el Rive se quede mostrando `available` mientras el store ya está `claimed`, o viceversa.

---

# 2.4 Animación antigua: inventario completo de referencias

La búsqueda del repositorio encontró estos nombres específicos:

```text
streak-hub.js
streak-flame
streak-flame__svg
flame-layer
streak-coin-burst
streakPulse
flameSwayBack
flameSwayMid
flameSwayCore
flameBurst
flameOuter
flameCore
streak.riv
unpkg.com/@rive-app/canvas
```

Referencias relevantes:

| Ruta | Zona | Acción |
|---|---:|---|
| `index.html` | 323-395 | eliminar SVG, sparks y coin-burst; crear shell Rive |
| `index.html` | 1164-1224 | conservar racha/countdown |
| `index.html` | 1228-1250 | adaptar lifecycle |
| `index.html` | 1789-1799 | eliminar listener duplicado |
| `styles.css` | ~900-903 | eliminar `.flame-layer/.spark` del `motion-paused` |
| `styles.css` | 1053-1091 | eliminar `streakPulse` del segmento `.today` |
| `styles.css` | 1122-1310 | reemplazar toda la implementación visual SVG |
| `styles.css` | 1314-1398 | reemplazar estilos visuales/coin burst |
| `styles.css` | 1400-1470 | conservar copy/countdown/segmentos, quitando animación antigua |
| `js/streak-hub.js` | 1-158 | eliminar archivo completo |
| `tests/daily-streak-hub-qa.mjs` | 1-239 | reescribir para el contrato nuevo |
| `sw.js` | 4-94 | añadir nuevo módulo UI al app shell |
| `vercel.json` | 1-90 | headers `.riv`/`.wasm` |
| `README.md` | 26-40 | cambiar ruta del módulo |
| `docs/ARCHITECTURE.md` | sección `js/streak-hub.js` | documentar nueva ubicación |
| `docs/sistema-racha-diaria.md` | 253-341 | eliminar descripción del SVG/coin burst |
| `docs/sistema-racha-diaria.md` | ~370 | corregir documentación desactualizada del reloj |
| `tests/documentation-static-qa.mjs` | 17-80 | añadir búsqueda de residuos antiguos |

No se encontraron archivos `.riv`, `.lottie` o GIF asociados al streak en el árbol actual. Los sprites encontrados pertenecen a los juegos y no deben tocarse.

---

# 2.5 Evidencia del prototipo Rive

El documento adjunto confirma:

- Artboard `streak`
- State Machine `State Machine 1`
- cero inputs
- ViewModel `UserStreakVM`
- propiedad `streak` de tipo `number`
- acceso mediante `r.viewModelInstance.number("streak")`
- requisito `autoBind: true`
- `Pop` como única animación cuyo efecto visual de claim fue comprobado.

El prototipo también confirma el constructor básico:

```js
new rive.Rive({
    src: "/assets/fire-streak.riv",
    canvas,
    autoplay: true,
    artboard: "streak",
    stateMachines: "State Machine 1",
    autoBind: true
});
```

con `resizeDrawingSurfaceToCanvas()` al cargar.

El prototipo utilizaba `r.play("Pop")`, pero no tenía input `claim`/`claimed`; por tanto el estado de negocio debe seguir fuera del `.riv`.

La prueba HTML usó explícitamente:

```js
r.viewModelInstance.number("streak");
```

y `streakProp.value = streak`.

---

# 2.6 Versión y estrategia del runtime Rive

## Versión seleccionada

**`@rive-app/canvas` 2.44.0**

Rive publicó actualizaciones Web hasta `2.44.0` el 1 de octubre de 2026.

Rive también indicó que desde `2.41.0` los parámetros plurales `animations` y `stateMachines` quedaron deprecados en favor de `stateMachine`.

Por ello el código nuevo debe usar:

```js
stateMachine: "State Machine 1"
```

y jamás:

```js
stateMachines: ["State Machine 1"]
```

### Self-host frente a CDN

**Decisión: self-host.**

Estructura obligatoria:

```text
/assets/rive/fire-streak.riv
/assets/rive/runtime/2.44.0/rive.js
/assets/rive/runtime/2.44.0/rive.wasm
/assets/rive/runtime/2.44.0/LICENSE.txt
```

Razones:

1. versionado exacto;
2. JS y WASM inseparables;
3. sin dependencia de un CDN externo durante la reproducción;
4. mismo origen que la SPA;
5. control de cache;
6. permite `enableRiveAssetCDN: false`;
7. evita que `unpkg` resuelva una versión diferente en el futuro.

No se añadirá dependencia a `package.json`, porque el proyecto no utiliza npm para runtime.

---

# 2.7 APIs Rive verificadas en 2.44.0

Se inspeccionó el fuente oficial de `rive-app/rive-wasm`, tag `2.44.0`.

## `cleanup()`

En `rive.ts:3674-3699`, `Rive.cleanup()`:

- marca la instancia destruida;
- llama `stopRendering()`;
- elimina artboard/animaciones/state machines;
- elimina observers;
- elimina listeners;
- libera archivo/renderizador.

Conclusión:

```js
r.cleanup();
```

es la operación correcta de destrucción.

## `resizeDrawingSurfaceToCanvas()`

En `rive.ts:4077-4094`:

```js
r.resizeDrawingSurfaceToCanvas(customDevicePixelRatio);
```

acepta explícitamente un DPR custom.

La implementación ajusta:

```text
canvas.width  = dpr * CSS width
canvas.height = dpr * CSS height
```

y actualiza el layout.

Por tanto el límite obligatorio será:

```js
const dpr = Math.min(window.devicePixelRatio || 1, 2);
r.resizeDrawingSurfaceToCanvas(dpr);
```

### Razón del DPR = 2

El coste de rasterización crece aproximadamente con el área del backing store.

Para el tamaño móvil de 108×144:

```text
DPR 1 = 15,552 píxeles
DPR 2 = 62,208 píxeles
DPR 3 = 139,968 píxeles
```

Pasar de DPR 2 a DPR 3 multiplica el trabajo de píxeles por 2.25.

El límite 2 conserva alta nitidez en pantallas móviles normales sin pagar el coste de DPR 3.

## `drawFrame()`

`rive.ts:3230-3238` expone:

```js
r.drawFrame();
```

para dibujar el frame actual.

Con la State Machine pausada, esto permite al host controlar explícitamente el avance.

## State Machine y velocidad

Aquí está la decisión importante.

La API de alto nivel de `Rive` **no expone una propiedad pública `speed` para una State Machine** en 2.44.0.

El wrapper sí contiene una API:

```js
StateMachine.advanceAndApply(time)
```

y el renderizador interno avanza los state machines con el tiempo recibido.

Por tanto la solución exacta para `0.75x` es:

```js
stateMachine.advanceAndApply(deltaSeconds * 0.75);
```

en lugar de:

```js
stateMachine.advanceAndApply(deltaSeconds);
```

### **RIESGO NO VERIFICADO**

`r.animator` es un campo declarado `private` en el TypeScript de Rive.

El runtime 2.44.0 permite llegar al driver con:

```js
r.animator.stateMachines.find(...)
```

porque `private` aquí es una restricción de TypeScript y no un campo ECMAScript `#private`, pero **no es una API pública garantizada por Rive**.

El plan, por tanto, no debe fingir que esto es una API estable.

### Plan B concreto

El agente implementador debe realizar una aserción en runtime:

```js
const driver = r?.animator?.stateMachines?.find(
    (sm) => sm.name === "State Machine 1"
);

if (
    !driver ||
    typeof driver.advanceAndApply !== "function" ||
    typeof r.drawFrame !== "function"
) {
    throw new Error(
        "Rive 2.44.0: driver de State Machine no disponible"
    );
}
```

Si la aserción falla:

1. no aproximar 0.75x con 1x;
2. no usar frame skipping;
3. no cerrar el ticket;
4. dejar la animación en fallback estático;
5. registrar el fallo como bloqueo técnico.

Esto evita enviar una implementación que aparentemente funciona pero incumple el requisito de velocidad.

## `r.play("Pop")` + State Machine

La arquitectura del Animator de Rive separa las animaciones lineales de las State Machines. `play()` agrega/reproduce la animación nombrada y no pausa automáticamente una State Machine que ya esté ejecutándose.

Por tanto la secuencia correcta es:

```js
r.play("State Machine 1");
r.play("Pop");
```

**No**:

```js
r.pause(["State Machine 1"]);
r.play("Pop");
```

El prototipo confirmó que `Pop` produce el feedback visual útil al reclamar.

La solución concreta será:

```text
available / 1x
       ↓ claim
State Machine continúa
       ↓
r.play("Pop")
       ↓
Pop + State Machine simultáneos
       ↓ 620 ms
r.stop(["Pop"])
       ↓
State Machine pausada
       ↓
driver.advanceAndApply(dt * 0.75)
```

Así `Pop` no queda congelado por haber pausado la State Machine antes de reproducirlo.

---

# 2.8 Arquitectura propuesta

## Nuevo módulo

```text
js/ui/streak-hub.js
```

Se elimina:

```text
js/streak-hub.js
```

El módulo será una IIFE vanilla siguiendo las convenciones actuales del proyecto.

## API pública

```js
window.StreakHub = {
    init(),
    refresh(),
    setState("available" | "claimed"),
    claim(),
    playClaimSequence(result),
    destroy()
};
```

### Responsabilidades

`init()`

- localizar DOM;
- fijar estado visual inmediatamente;
- conectar observers/listeners;
- no descargar Rive hasta que sea visible.

`refresh()`

- consultar `GameCenter`;
- actualizar `available` / `claimed`;
- sincronizar ViewModel `streak`;
- no celebrar.

`setState()`

- cambiar únicamente estado visual;
- controlar loop Rive;
- actualizar CSS.

`claim()`

- proteger contra doble llamada;
- delegar exclusivamente a `GameCenter.claimDaily()`;
- lanzar la secuencia visual si `success`.

`playClaimSequence()`

- `Pop`;
- escala;
- glow;
- partículas;
- transición a `claimed`.

`destroy()`

- cancelar rAF;
- limpiar observers;
- cancelar partículas;
- liberar `Rive`;
- liberar referencias.

---

# 2.9 Máquina de estados

## Estado visual estable

Sólo existen:

```text
available
claimed
```

No deben volver:

```text
locked
repair
claiming
unclaimed
```

`claiming` será únicamente:

```css
.streak-rive-shell.is-claiming
```

como estado transitorio de presentación.

## Mapeo negocio → visual

```text
repairAvailable === true
    && canAffordRepair === true
        => available

repairAvailable === true
    && canAffordRepair === false
        => claimed

repairAvailable === false
    && canClaim === true
        => available

repairAvailable === false
    && canClaim === false
        => claimed
```

La semántica del botón continúa siendo gestionada por `updateDailyButton()`, por lo que `repair` seguirá diciendo:

```text
Reparar racha
```

pero el gráfico nunca tendrá un tercer estado visual.

---

# 2.10 Flujo completo

```text
index.html
   │
   ├── store local ya hidratado
   │
   ├── updateStreakBar()
   ├── updateCountdownDisplay()
   └── StreakHub.init()
             │
             ├── calcular available/claimed
             ├── pintar estado CSS inmediatamente
             └── registrar IntersectionObserver
                         │
                         ├── fuera de viewport → NO cargar Rive
                         │
                         └── >= 25% visible
                                  │
                                  ├── cargar rive.js 2.44.0
                                  ├── RuntimeLoader.setWasmUrl()
                                  ├── crear Rive
                                  ├── bind UserStreakVM.streak
                                  └── iniciar reproducción
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                   available                            claimed
                        │                                   │
                   State Machine 1x            State Machine pausada
                        │                                   │
                 pulse CSS sutil                  driver * 0.75
                        │
                   click claim
                        │
                 StreakHub.claim()
                        │
                 GameCenter.claimDaily()
                        │
             ┌──────────┴──────────┐
             │                     │
          success                failure
             │                     │
       is-claiming             refresh()
             │
       Pop + 620 ms
       particles
       glow burst
             │
       r.stop(["Pop"])
             │
         claimed
             │
       slow driver 0.75x
```

Al abandonar `home`:

```text
HomeView.onLeave()
      ↓
StreakHub.destroy()
      ↓
cancel rAF
disconnect observers
cleanup particles
r.cleanup()
```

---

# 2.11 Código de referencia funcional

El siguiente módulo es la implementación de referencia que el agente debe usar como base, no pseudocódigo.

## `js/ui/streak-hub.js`

```js
(function initLoveArcadeStreakHub() {
    'use strict';

    const RIVE_VERSION = '2.44.0';
    const RIVE_JS = `/assets/rive/runtime/${RIVE_VERSION}/rive.js`;
    const RIVE_WASM = `/assets/rive/runtime/${RIVE_VERSION}/rive.wasm`;
    const RIVE_SRC = '/assets/rive/fire-streak.riv';

    const ARTBOARD = 'streak';
    const STATE_MACHINE = 'State Machine 1';
    const POP_ANIMATION = 'Pop';

    const AVAILABLE_SPEED = 1;
    const CLAIMED_SPEED = 0.75;
    const CLAIM_DURATION_MS = 620;
    const PARTICLE_COUNT = 10;
    const DPR_CAP = 2;
    const IO_THRESHOLD = 0.25;

    const reduceMotionQuery = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    );

    let initialized = false;
    let destroyed = false;
    let inView = false;
    let pageVisible = !document.hidden;
    let state = 'claimed';
    let lastAnnouncedState = null;

    let rive = null;
    let streakProp = null;
    let stateMachineDriver = null;

    let slowRafId = 0;
    let resizeRafId = 0;
    let claimTimerId = 0;

    let runtimePromise = null;
    let mountPromise = null;

    let intersectionObserver = null;
    let resizeObserver = null;

    let claimInFlight = false;

    const activeParticleAnimations = new Set();

    function getElements() {
        return {
            stage: document.getElementById('streak-rive-stage'),
            shell: document.getElementById('streak-rive-shell'),
            canvas: document.getElementById('streak-rive-canvas'),
            fallback: document.getElementById('streak-rive-fallback'),
            particles: document.getElementById('streak-rive-particles'),
            status: document.getElementById('streak-rive-status'),
            number: document.getElementById('streak-count-big'),
            numberWrap: document.querySelector('.streak-hub-number')
        };
    }

    function getVisualState() {
        const info = window.GameCenter?.getStreakInfo?.();
        if (!info) return 'claimed';

        const actionable = info.repairAvailable
            ? Boolean(info.canAffordRepair)
            : Boolean(info.canClaim);

        return actionable ? 'available' : 'claimed';
    }

    function announceState(nextState) {
        const { status } = getElements();
        if (!status) return;
        if (nextState === lastAnnouncedState) return;

        if (lastAnnouncedState !== null) {
            status.textContent = nextState === 'available'
                ? 'La recompensa diaria está disponible para reclamar.'
                : 'La recompensa diaria ya fue reclamada.';

        lastAnnouncedState = nextState;
    }

    function syncStreakValue() {
        if (!rive) return;

        try {
            if (!streakProp) {
                streakProp = rive.viewModelInstance?.number('streak') || null;
            }

            const value = window.GameCenter?.getStreakInfo?.()?.streak;

            if (streakProp && Number.isFinite(value)) {
                streakProp.value = value;
            }
        } catch (error) {
            console.error('[StreakHub] No se pudo sincronizar UserStreakVM:', error);
        }
    }

    function stopSlowLoop() {
        if (slowRafId !== 0) {
            cancelAnimationFrame(slowRafId);
            slowRafId = 0;
        }
    }

    function shouldRenderRive() {
        return Boolean(
            rive &&
            inView &&
            pageVisible &&
            !reduceMotionQuery.matches &&
            !destroyed
        );
    }

    function getSlowDriver() {
        const driver = rive?.animator?.stateMachines?.find(
            (sm) => sm.name === STATE_MACHINE
        );

        if (
            !driver ||
            typeof driver.advanceAndApply !== 'function' ||
            typeof rive?.drawFrame !== 'function'
        ) {
            throw new Error(
                'Rive 2.44.0: driver interno de State Machine no disponible.'
            );
        }

        return driver;
    }

    function startSlowLoop() {
        stopSlowLoop();

        if (!shouldRenderRive()) return;

        stateMachineDriver = stateMachineDriver || getSlowDriver();

        let lastTime = performance.now();

        const tick = (time) => {
            slowRafId = 0;

            if (!shouldRenderRive() || state !== 'claimed') {
                return;
            }

            const elapsed = Math.min(
                Math.max((time - lastTime) / 1000, 0),
                0.05
            );

            lastTime = time;

            stateMachineDriver.advanceAndApply(
                elapsed * CLAIMED_SPEED
            );

            rive.drawFrame();

            slowRafId = requestAnimationFrame(tick);
        };

        slowRafId = requestAnimationFrame(tick);
    }

    function syncPlayback() {
        if (!rive) return;

        if (
            destroyed ||
            !inView ||
            !pageVisible ||
            reduceMotionQuery.matches
        ) {
            stopSlowLoop();

            try {
                rive.pause([STATE_MACHINE]);
                rive.drawFrame();
            } catch (_) {}

            return;
        }

        if (state === 'available') {
            stopSlowLoop();

            try {
                rive.pause([STATE_MACHINE]);
                rive.play(STATE_MACHINE);
            } catch (error) {
                console.error(
                    '[StreakHub] No se pudo iniciar State Machine 1:',
                    error
                );
            }

            return;
        }

        try {
            rive.pause([STATE_MACHINE]);

            stateMachineDriver = getSlowDriver();

            startSlowLoop();
        } catch (error) {
            console.error(
                '[StreakHub] No se pudo activar reproducción 0.75x:',
                error
            );
            stopSlowLoop();
        }
    }

    function resizeDrawingSurface() {
        if (!rive) return;

        const dpr = Math.min(
            window.devicePixelRatio || 1,
            DPR_CAP
        );

        try {
            rive.resizeDrawingSurfaceToCanvas(dpr);
        } catch (error) {
            console.error(
                '[StreakHub] Error redimensionando canvas:',
                error
            );
        }
    }

    function scheduleResize() {
        if (resizeRafId !== 0) return;

        resizeRafId = requestAnimationFrame(() => {
            resizeRafId = 0;

            if (destroyed || !rive) return;

            resizeDrawingSurface();
        });
    }

    function setFallback(error) {
        const { canvas, fallback, status } = getElements();

        console.error('[StreakHub] Falló la carga de Rive:', error);

        stopSlowLoop();

        if (canvas) {
            canvas.hidden = true;
            canvas.setAttribute('aria-hidden', 'true');
        }

        if (fallback) {
            fallback.hidden = false;
        }

        if (status) {
            status.textContent =
                'La animación no está disponible; la interacción de racha continúa.';
        }
    }

    function loadRuntime() {
        if (window.rive?.Rive) {
            try {
                window.rive.RuntimeLoader?.setWasmUrl?.(RIVE_WASM);
            } catch (_) {}
            return Promise.resolve();
        }

        if (runtimePromise) return runtimePromise;

        runtimePromise = new Promise((resolve, reject) => {
            const existing = document.querySelector(
                'script[data-love-arcade-rive-runtime="2.44.0"]'
            );

            if (existing) {
                if (window.rive?.Rive) {
                    resolve();
                    return;
                }

                existing.addEventListener('load', () => resolve(), {
                    once: true
                });

                existing.addEventListener('error', () => {
                    reject(new Error('No se pudo cargar el runtime Rive.'));
                }, {
                    once: true
                });

                return;
            }

            const script = document.createElement('script');

            script.src = RIVE_JS;
            script.async = true;
            script.dataset.loveArcadeRiveRuntime = RIVE_VERSION;

            script.onload = () => {
                if (!window.rive?.Rive) {
                    reject(
                        new Error(
                            'El runtime Rive cargó sin exponer rive.Rive.'
                        )
                    );
                    return;
                }

                try {
                    window.rive.RuntimeLoader?.setWasmUrl?.(RIVE_WASM);
                } catch (error) {
                    reject(error);
                    return;
                }

                resolve();
            };

            script.onerror = () => {
                reject(new Error('No se pudo cargar rive.js.'));
            };

            document.head.appendChild(script);
        }).catch((error) => {
            runtimePromise = null;
            throw error;
        });

        return runtimePromise;
    }

    async function mountRive() {
        if (
            destroyed ||
            !initialized ||
            !inView ||
            !pageVisible ||
            rive ||
            mountPromise
        ) {
            return;
        }

        mountPromise = (async () => {
            await loadRuntime();

            if (
                destroyed ||
                !initialized ||
                !inView ||
                !pageVisible
            ) {
                return;
            }

            const {
                canvas,
                fallback
            } = getElements();

            if (!canvas) {
                throw new Error(
                    'No existe #streak-rive-canvas.'
                );
            }

            canvas.hidden = false;
            canvas.removeAttribute('aria-hidden');

            rive = new window.rive.Rive({
                src: RIVE_SRC,
                canvas,
                autoplay: true,
                artboard: ARTBOARD,
                stateMachine: STATE_MACHINE,
                autoBind: true,
                enableRiveAssetCDN: false,

                onLoad: () => {
                    if (destroyed) {
                        rive?.cleanup?.();
                        rive = null;
                        return;
                    }

                    syncStreakValue();
                    resizeDrawingSurface();

                    if (fallback) {
                        fallback.hidden = true;
                    }

                    syncPlayback();
                },

                onLoadError: (error) => {
                    setFallback(error);
                }
            });
        })()
            .catch(setFallback)
            .finally(() => {
                mountPromise = null;
            });

        await mountPromise;
    }

    function cancelParticles() {
        activeParticleAnimations.forEach(
            ({ animation, element }) => {
                try {
                    animation.cancel();
                } catch (_) {}

                element.remove();
            }
        );

        activeParticleAnimations.clear();
    }

    function spawnParticles() {
        const {
            particles
        } = getElements();

        if (
            !particles ||
            reduceMotionQuery.matches ||
            !inView ||
            !pageVisible
        ) {
            return;
        }

        cancelParticles();

        for (let i = 0; i < PARTICLE_COUNT; i += 1) {
            const particle = document.createElement('span');

            particle.className = 'streak-rive-particle';

            const angle =
                (Math.PI * 2 * i) / PARTICLE_COUNT;

            const distance =
                72 + Math.random() * 40;

            const x =
                Math.cos(angle) * distance;

            const y =
                Math.sin(angle) * distance;

            const animation = particle.animate(
                [
                    {
                        opacity: 1,
                        transform:
                            'translate(-50%, -50%) scale(1)'
                    },
                    {
                        opacity: 0,
                        transform:
                            `translate(calc(-50% + ${x}px), ` +
                            `calc(-50% + ${y}px)) scale(0.15)`
                    }
                ],
                {
                    duration: 560,
                    easing: 'cubic-bezier(.22,1,.36,1)',
                    fill: 'forwards'
                }
            );

            particle.style.willChange = 'transform, opacity';

            particles.appendChild(particle);

            const record = {
                animation,
                element: particle
            };

            activeParticleAnimations.add(record);

            animation.finished
                .catch(() => {})
                .finally(() => {
                    activeParticleAnimations.delete(record);
                    particle.style.willChange = 'auto';
                    particle.remove();
                });
        }
    }

    function finishClaimVisual() {
        if (destroyed) return;

        if (claimTimerId !== 0) {
            clearTimeout(claimTimerId);
            claimTimerId = 0;
        }

        const {
            shell,
            canvas,
            number
        } = getElements();

        try {
            rive?.stop?.([POP_ANIMATION]);
        } catch (_) {}

        shell?.classList.remove('is-claiming');
        canvas?.style.removeProperty('will-change');
        number?.style.removeProperty('will-change');

        cancelParticles();

        setState('claimed');

        claimInFlight = false;
    }

    function playClaimSequence(result) {
        if (!result?.success) {
            claimInFlight = false;
            refresh();
            return;
        }

        const { shell } = getElements();

        if (
            reduceMotionQuery.matches ||
            !rive ||
            destroyed
        ) {
            setState('claimed');
            claimInFlight = false;
            return;
        }

        if (claimTimerId !== 0) {
            clearTimeout(claimTimerId);
        }

        shell?.classList.add('is-claiming');

        stopSlowLoop();

        try {
            rive.play(STATE_MACHINE);
            rive.play(POP_ANIMATION);
        } catch (error) {
            console.error(
                '[StreakHub] No se pudo reproducir Pop:',
                error
            );
        }

        spawnParticles();

        claimTimerId = window.setTimeout(
            finishClaimVisual,
            CLAIM_DURATION_MS
        );
    }

    function setState(nextState) {
        if (
            nextState !== 'available' &&
            nextState !== 'claimed'
        ) {
            throw new TypeError(
                'StreakHub.setState(): estado inválido.'
            );
        }

        state = nextState;

        const { shell } = getElements();

        shell?.setAttribute('data-state', nextState);

        const {
            canvas
        } = getElements();

        if (canvas) {
            canvas.style.opacity =
                nextState === 'available'
                    ? '1'
                    : '0.9';
        }

        announceState(nextState);
        syncPlayback();
    }

    function refresh() {
        if (destroyed) return;

        syncStreakValue();
        setState(getVisualState());
    }

    function claim() {
        if (claimInFlight) {
            return {
                success: false,
                duplicate: true,
                message: 'El reclamo ya está procesándose.'
            };
        }

        claimInFlight = true;

        try {
            const result =
                window.GameCenter?.claimDaily?.();

            if (!result?.success) {
                claimInFlight = false;
                refresh();
                return result || {
                    success: false,
                    message: 'No se pudo procesar el reclamo.'
                };
            }

            playClaimSequence(result);

            return result;
        } catch (error) {
            claimInFlight = false;
            refresh();

            console.error(
                '[StreakHub] Error en claim():',
                error
            );

            return {
                success: false,
                message: 'No se pudo procesar el reclamo.'
            };
        }
    }

    function updateViewportState(nextVisible) {
        inView = nextVisible;

        const {
            shell
        } = getElements();

        shell?.classList.toggle(
            'is-visible',
            inView && pageVisible
        );

        if (inView && pageVisible) {
            mountRive();
        } else {
            stopSlowLoop();

            try {
                rive?.pause?.([STATE_MACHINE]);
            } catch (_) {}
        }

        syncPlayback();
    }

    function onDocumentVisibilityChange() {
        pageVisible = !document.hidden;

        const {
            shell
        } = getElements();

        shell?.classList.toggle(
            'is-visible',
            inView && pageVisible
        );

        if (!pageVisible) {
            stopSlowLoop();

            try {
                rive?.pause?.([STATE_MACHINE]);
            } catch (_) {}
        } else if (inView) {
            mountRive();
        }

        syncPlayback();
    }

    function onReducedMotionChange() {
        if (reduceMotionQuery.matches) {
            cancelParticles();
            stopSlowLoop();

            if (claimTimerId !== 0) {
                clearTimeout(claimTimerId);
                claimTimerId = 0;
            }

            try {
                rive?.stop?.([POP_ANIMATION]);
                rive?.pause?.([STATE_MACHINE]);
            } catch (_) {}

            getElements()
                .shell
                ?.classList.remove('is-claiming');

            claimInFlight = false;

            if (state !== getVisualState()) {
                setState(getVisualState());
            }

            return;
        }

        syncPlayback();
    }

    function initObservers() {
        const {
            stage,
            shell
        } = getElements();

        if (!stage || !shell) return;

        intersectionObserver = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];

                updateViewportState(
                    Boolean(
                        entry?.isIntersecting &&
                        entry.intersectionRatio >= IO_THRESHOLD
                    )
                );
            },
            {
                threshold: [0, IO_THRESHOLD]
            }
        );

        intersectionObserver.observe(stage);

        resizeObserver = new ResizeObserver(() => {
            scheduleResize();
        });

        resizeObserver.observe(shell);
    }

    function destroy() {
        destroyed = true;
        initialized = false;
        claimInFlight = false;

        stopSlowLoop();

        if (resizeRafId !== 0) {
            cancelAnimationFrame(resizeRafId);
            resizeRafId = 0;
        }

        if (claimTimerId !== 0) {
            clearTimeout(claimTimerId);
            claimTimerId = 0;
        }

        intersectionObserver?.disconnect();
        resizeObserver?.disconnect();

        intersectionObserver = null;
        resizeObserver = null;

        cancelParticles();

        try {
            rive?.cleanup?.();
        } catch (error) {
            console.error(
                '[StreakHub] Error durante cleanup():',
                error
            );
        }

        rive = null;
        streakProp = null;
        stateMachineDriver = null;

        getElements()
            .shell
            ?.classList.remove('is-visible', 'is-claiming');
    }

    function init() {
        if (initialized && !destroyed) {
            refresh();
            return;
        }

        destroyed = false;
        initialized = true;
        inView = false;
        pageVisible = !document.hidden;
        lastAnnouncedState = null;

        const {
            shell
        } = getElements();

        if (!shell) return;

        setState(getVisualState());

        initObservers();

        if (inView && pageVisible) {
            mountRive();
        }
    }

    document.addEventListener(
        'visibilitychange',
        onDocumentVisibilityChange
    );

    if (typeof reduceMotionQuery.addEventListener === 'function') {
        reduceMotionQuery.addEventListener(
            'change',
            onReducedMotionChange
        );
    } else if (
        typeof reduceMotionQuery.addListener === 'function'
    ) {
        reduceMotionQuery.addListener(
            onReducedMotionChange
        );
    }

    document.addEventListener(
        'la:cloudsynced',
        () => refresh()
    );

    window.StreakHub = {
        init,
        refresh,
        setState,
        claim,
        playClaimSequence,
        destroy
    };
})();
```

### Nota sobre el código anterior

La única parte deliberadamente dependiente de API interna es:

```js
rive.animator.stateMachines.find(...)
```

y está aislada en `getSlowDriver()`.

No se debe dispersar ese acceso por el código.

---

# 2.12 HTML de referencia

El reemplazo conceptual de `index.html:323-395` debe quedar así:

```html
<button
    type="button"
    id="btn-daily"
    class="streak-hub-cta"
    aria-describedby="daily-msg daily-countdown streak-hub-copy streak-rive-status"
    aria-label="Reclamar bono diario">

    <div
        id="streak-rive-stage"
        class="streak-rive-stage">

        <div
            id="streak-rive-shell"
            class="streak-rive-shell"
            data-state="claimed">

            <canvas
                id="streak-rive-canvas"
                class="streak-rive-canvas"
                role="img"
                aria-label="Ilustración animada de la racha diaria">
            </canvas>

            <span
                id="streak-rive-fallback"
                class="streak-rive-fallback-mark"
                aria-hidden="true"
                hidden>
                🔥
            </span>
        </div>

        <div
            id="streak-rive-particles"
            class="streak-rive-particles"
            aria-hidden="true">
        </div>
    </div>

    <div
        class="streak-hub-number"
        role="img"
        aria-label="Racha actual">

        <span
            class="streak-hub-number__value"
            id="streak-count-big">
            0
        </span>

        <span
            class="streak-hub-number__label"
            id="hud-daily-label">
            DÍAS
        </span>
    </div>

    <p
        class="streak-hub-copy"
        id="streak-hub-copy">

        <span id="hud-daily-cta-text">
            Toca para reclamar
        </span>

        <span
            class="streak-hub-copy__amount"
            id="hud-reward-amount">
            +20
        </span>
    </p>
</button>

<p
    id="streak-rive-status"
    class="visually-hidden"
    role="status"
    aria-live="polite">
</p>

<small class="streak-rive-attribution">
    Animación “Dynamic streak fire” por aristote · CC BY
</small>
```

Se conservan fuera de este bloque:

```text
#streak-days
#streak-count
#daily-countdown
#daily-msg
```

porque pertenecen al sistema funcional de racha y no a la animación antigua.

---

# 2.13 CSS de referencia completo

El siguiente bloque sustituye el CSS específico antiguo del fuego.

```css
/* ================================================================
   DAILY STREAK HUB — RIVE
   Mobile first.
   Animación continua únicamente mediante transform/opacity.
   Nunca animar filter, blur, drop-shadow o box-shadow.
   ================================================================ */

:root {
    --streak-rive-width: 108px;
    --streak-rive-height: 144px;

    --streak-rive-available-opacity: 1;
    --streak-rive-claimed-opacity: 0.90;

    --streak-rive-glow-available-opacity: 0.58;
    --streak-rive-glow-claimed-opacity: 0.28;

    --streak-rive-glow-scale-rest: 0.96;
    --streak-rive-glow-scale-peak: 1.08;

    --streak-rive-ready-duration: 2800ms;
    --streak-rive-claim-duration: 620ms;
    --streak-rive-particle-duration: 560ms;

    --streak-rive-claim-ease: cubic-bezier(.34, 1.56, .64, 1);
    --streak-rive-ready-ease: ease-in-out;
    --streak-rive-particle-ease: cubic-bezier(.22, 1, .36, 1);
}

.streak-rive-stage {
    position: relative;
    width: var(--streak-rive-width);
    height: var(--streak-rive-height);
    margin: 0 auto;
    isolation: isolate;
}

.streak-rive-shell {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: visible;
    contain: layout;
    display: grid;
    place-items: center;
    isolation: isolate;
}

.streak-rive-shell::before {
    content: '';
    position: absolute;
    inset: -18%;
    z-index: 0;
    pointer-events: none;
    border-radius: 50%;
    background:
        radial-gradient(
            circle,
            rgba(255, 221, 119, 0.34) 0%,
            rgba(255, 123, 28, 0.20) 38%,
            rgba(255, 73, 18, 0.00) 72%
        );
    opacity: var(--streak-rive-glow-claimed-opacity);
    transform: scale(var(--streak-rive-glow-scale-rest));
}

.streak-rive-shell[data-state="available"].is-visible::before {
    opacity: var(--streak-rive-glow-available-opacity);
    animation:
        streakRiveReadyGlow
        var(--streak-rive-ready-duration)
        var(--streak-rive-ready-ease)
        infinite;
}

.streak-rive-shell[data-state="claimed"]::before {
    opacity: var(--streak-rive-glow-claimed-opacity);
    transform: scale(1);
    animation: none;
}

.streak-rive-canvas {
    position: relative;
    z-index: 1;
    display: block;
    width: 100%;
    height: 100%;
    opacity: var(--streak-rive-claimed-opacity);
    transform: scale(1);
    transform-origin: center;
}

.streak-rive-shell[data-state="available"] .streak-rive-canvas {
    opacity: var(--streak-rive-available-opacity);
}

.streak-rive-shell[data-state="available"].is-visible
.streak-rive-canvas {
    animation:
        streakRiveReadyPulse
        var(--streak-rive-ready-duration)
        var(--streak-rive-ready-ease)
        infinite;
}

.streak-rive-shell.is-claiming
.streak-rive-canvas {
    will-change: transform, opacity;
    animation:
        streakRiveClaim
        var(--streak-rive-claim-duration)
        var(--streak-rive-claim-ease)
        both;
}

.streak-rive-shell.is-claiming::before {
    will-change: transform, opacity;
    animation:
        streakRiveGlowBurst
        var(--streak-rive-claim-duration)
        var(--streak-rive-claim-ease)
        both;
}

.streak-rive-fallback-mark {
    position: absolute;
    z-index: 1;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 3.4rem;
    line-height: 1;
}

.streak-rive-particles {
    position: absolute;
    inset: -24%;
    z-index: 4;
    pointer-events: none;
    overflow: visible;
}

.streak-rive-particle {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background:
        radial-gradient(
            circle at 35% 35%,
            #ffffff 0%,
            #ffd166 28%,
            #ff7a18 72%,
            transparent 73%
        );
    pointer-events: none;
}

.streak-rive-attribution {
    display: block;
    width: 100%;
    margin-top: 6px;
    text-align: center;
    font-size: 0.62rem;
    line-height: 1.3;
    color: var(--text-low);
}

@keyframes streakRiveReadyPulse {
    0%,
    100% {
        opacity: 1;
        transform: scale(0.98);
    }

    50% {
        opacity: 1;
        transform: scale(1.04);
    }
}

@keyframes streakRiveReadyGlow {
    0%,
    100% {
        opacity: 0.48;
        transform: scale(0.96);
    }

    50% {
        opacity: 0.58;
        transform: scale(1.08);
    }
}

@keyframes streakRiveClaim {
    0% {
        opacity: 1;
        transform: scale(1);
    }

    32% {
        opacity: 1;
        transform: scale(1.14);
    }

    58% {
        opacity: 1;
        transform: scale(1.04);
    }

    100% {
        opacity: 1;
        transform: scale(1);
    }
}

@keyframes streakRiveGlowBurst {
    0% {
        opacity: 0.58;
        transform: scale(0.96);
    }

    35% {
        opacity: 0.90;
        transform: scale(1.15);
    }

    100% {
        opacity: 0.28;
        transform: scale(1);
    }
}

/* El estado claimed nunca pulsa. */
.streak-rive-shell[data-state="claimed"] {
    --streak-rive-rive-opacity: 0.90;
}

/* El gráfico nunca se convierte a escala de grises.
   No usar filter, grayscale, saturate ni brightness. */

.streak-rive-shell[data-state="claimed"] .streak-rive-canvas {
    opacity: 0.90;
    animation: none;
}

.streak-rive-shell[data-state="claimed"]::before {
    opacity: 0.28;
    transform: scale(1);
}

/* Número: conserva colores de marca; únicamente el contenedor de Rive
   cambia su opacidad. */
.streak-hub-number__value {
    transform-origin: center;
}

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
    transition:
        background 0.3s ease,
        border-color 0.3s ease;
}

.streak-day.active {
    background:
        linear-gradient(
            90deg,
            #ffb238,
            #ff6a1a
        );
    border-color: rgba(255, 138, 30, 0.5);
}

/* El día actual ya no usa un loop continuo porque el hub reclamado
   debe quedar tranquilo. */
.streak-day.today {
    background:
        linear-gradient(
            90deg,
            rgba(255, 178, 56, 0.45),
            rgba(255, 106, 26, 0.45)
        );
    border-color: rgba(255, 138, 30, 0.45);
}

/* El CTA conserva las reglas accesibles del proyecto. */
.streak-hub-cta {
    all: unset;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 8px 8px 4px;
    cursor: pointer;
    border-radius: var(--radius-lg);
    transition:
        transform 160ms cubic-bezier(.22, 1, .36, 1);
}

@media (hover: hover) and (pointer: fine) {
    .streak-hub-cta:hover {
        transform: translateY(-2px);
    }
}

.streak-hub-cta:active {
    transform: scale(0.98);
}

.streak-hub-cta:focus-visible {
    outline: 2px solid transparent;
    box-shadow:
        0 0 0 3px
        color-mix(
            in srgb,
            var(--focus-ring-aa) 78%,
            transparent
        );
}

.streak-hub-cta:disabled {
    cursor: not-allowed;
}

.streak-rive-shell.is-claiming {
    will-change: transform;
}

/* Desktop: sólo ampliamos las dimensiones; no se cambia la lógica. */
@media (min-width: 768px) {
    :root {
        --streak-rive-width: 132px;
        --streak-rive-height: 176px;
    }

    .streak-hub-number__value {
        font-size: clamp(2.6rem, 6vw, 3.6rem);
    }
}

/* Reduced motion:
   - no pulse
   - no Pop
   - no particle burst
   - available/claimed siguen diferenciados estáticamente */
@media (prefers-reduced-motion: reduce) {
    .streak-rive-shell[data-state="available"].is-visible::before,
    .streak-rive-shell[data-state="available"].is-visible
    .streak-rive-canvas,
    .streak-rive-shell.is-claiming
    .streak-rive-canvas,
    .streak-rive-shell.is-claiming::before {
        animation: none !important;
    }

    .streak-rive-shell.is-claiming {
        will-change: auto;
    }

    .streak-rive-canvas {
        will-change: auto;
    }
}
```

### Regla obligatoria de CSS

En toda la implementación nueva:

```text
NO:
filter
drop-shadow
blur
box-shadow animado
grayscale
saturate
brightness animado

SÍ:
opacity
transform
```

El glow debe ser el pseudo-elemento/capa hermana, no un filtro aplicado al canvas.

---

# 2.14 Integración exacta con `hud-render.js`

## `updateUI()`

Añadir al final:

```js
window.StreakHub?.refresh?.();
```

## Click normal

Sustituir:

```js
const result = window.GameCenter.claimDaily();
if (result.repairRequired) showDailyRepairModal();
else setDailyMessage(result.message, result.success);
updateDailyButton();
updateMoonBlessingUI();
window.StreakHub?.playClaimSequence?.(result);
```

por:

```js
const result = window.StreakHub?.claim?.() || {
    success: false,
    message: 'El sistema de racha no está disponible.'
};

if (result.repairRequired) {
    showDailyRepairModal();
} else {
    setDailyMessage(result.message, result.success);
}

updateDailyButton();
updateMoonBlessingUI();
```

`StreakHub.claim()` es ahora la única frontera UI → dominio para claim normal.

## Reparación

Después de:

```js
const result = window.GameCenter.repairDailyStreak();
```

mantener:

```js
setDailyMessage(result.message, result.success);
updateUI();
updateDailyButton();
window.updateStreakBar?.();
```

y añadir:

```js
window.StreakHub?.playClaimSequence?.(result);
```

sólo porque esa operación también representa una acción exitosa que debe tener celebración.

---

# 2.15 Lifecycle exacto en `index.html`

Después de:

```js
updateStreakBar();
updateCountdownDisplay();
```

añadir inmediatamente:

```js
window.StreakHub?.init?.();
```

Actualizar:

```js
onLeave() {
    window.AppScheduler?.pauseGroup?.('countdown');
    window.StreakHub?.destroy?.();
},

onEnter() {
    window.AppScheduler?.resumeGroup?.('countdown');
    updateCountdownDisplay();
    window.StreakHub?.init?.();
    window.StreakHub?.refresh?.();
}
```

Con la arquitectura SPA actual:

```text
Home oculto !== Rive activo
```

porque `destroy()` debe liberar el runtime al abandonar la vista.

En una futura refactorización que elimine físicamente el nodo del DOM, el owner de la vista debe llamar `StreakHub.destroy()` antes de eliminarlo. No añadir un MutationObserver global sólo para compensar una futura arquitectura.

---

# 2.16 Service Worker y headers

## `sw.js`

`APP_SHELL_FILES` está en `sw.js:4-94`.

Añadir:

```text
/js/ui/streak-hub.js
```

Eliminar cualquier referencia a:

```text
/js/streak-hub.js
```

si apareciera durante la implementación.

No añadir al precache:

```text
/assets/rive/fire-streak.riv
/assets/rive/runtime/2.44.0/rive.js
/assets/rive/runtime/2.44.0/rive.wasm
```

La razón es deliberada:

```text
primer paint
    ↓
no se necesita Rive todavía
    ↓
no se descarga ni precachea
    ↓
IntersectionObserver detecta visibilidad
    ↓
runtime/.riv se solicitan
```

El handler runtime de `sw.js` ya utiliza cache runtime para recursos same-origin.

## `vercel.json`

Añadir headers:

```json
{
    "source": "/(.*)\\.wasm",
    "headers": [
        {
            "key": "Content-Type",
            "value": "application/wasm"
        },
        {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
        }
    ]
},
{
    "source": "/(.*)\\.riv",
    "headers": [
        {
            "key": "Content-Type",
            "value": "application/octet-stream"
        },
        {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
        }
    ]
}
```

No modificar la política de JS existente: los JS del proyecto mantienen sus headers actuales.

No añadir `<link rel="preload">` para Rive.

No añadir CSP para otro dominio porque todo el runtime y `.riv` serán same-origin y `enableRiveAssetCDN` estará desactivado.

---

# 2.17 Presupuesto de rendimiento

Estos valores son **presupuesto de aceptación**, no mediciones actuales del repositorio.

| Métrica | Presupuesto |
|---|---:|
| `rive.js + rive.wasm` transferidos | ≤ 1.75 MB |
| `fire-streak.riv` transferido | ≤ 250 KB |
| Runtime total visible | ≤ 2.0 MB |
| Long Task atribuible al hub durante claim | 0 > 50 ms |
| p95 `advance + draw` bajo 4× CPU | ≤ 8 ms |
| Frames Rive tras quedar fuera de viewport | 0 |
| Frames Rive con pestaña oculta | 0 |
| Partículas máximas simultáneas | 10 |
| Tiempo de vida de partícula | ≤ 800 ms |
| Layout shift del shell | 0 CLS atribuible |
| DPR máximo | 2 |
| Resize calls | máximo 1 por frame |
| `will-change` permanente | 0 elementos |
| Animaciones continuas con `filter/blur/drop-shadow` | 0 |

## Verificación

Chrome DevTools:

```text
Performance
CPU throttling: 4× slowdown
Device: mobile viewport
Network: Slow 4G
```

Grabar:

1. carga inicial;
2. scroll hasta hub;
3. scroll fuera de viewport;
4. volver;
5. cambiar pestaña;
6. volver;
7. claim;
8. repetir claim;
9. navegar a Shop;
10. volver Home.

### Qué observar

Durante carga inicial:

```text
No rive.js
No rive.wasm
No fire-streak.riv
```

mientras el hub permanezca fuera de viewport.

Al entrar:

```text
rive.js
rive.wasm
fire-streak.riv
```

exactamente una vez.

Al salir:

```text
rAF de Rive = 0
```

y en Performance no deben aparecer avances del hub.

En Layers:

```text
no capa permanente creada por will-change
```

El claim sólo puede promover temporalmente la capa.

---

# 2.18 Accesibilidad

El control sigue siendo:

```html
<button type="button">
```

por lo que conserva:

```text
Tab
Enter
Space
```

El canvas debe tener exactamente:

```html
role="img"
aria-label="Ilustración animada de la racha diaria"
```

La página mantiene:

```html
#daily-msg
    role="status"
    aria-live="polite"
```

y añade:

```html
#streak-rive-status
    role="status"
    aria-live="polite"
```

El nuevo estado live sólo debe anunciar transiciones reales:

```text
available → claimed
claimed → available
```

Nunca anunciar cada `refresh()`.

## Reduced motion

Con:

```css
@media (prefers-reduced-motion: reduce)
```

deben quedar desactivados:

```text
pulse
glow pulse
Pop
particle burst
claim scaling
```

El estado sigue siendo discernible:

```text
available:
    opacity 1
    glow estático .58

claimed:
    opacity .90
    glow estático .28
```

No se usa escala de grises.

---

# 2.19 Fallback

Si falla cualquiera de:

```text
rive.js
rive.wasm
fire-streak.riv
artboard
State Machine
ViewModel
```

el comportamiento será:

```text
canvas hidden
       ↓
fallback 🔥 visible
       ↓
button sigue funcionando
       ↓
GameCenter sigue siendo autoridad
       ↓
aria-live explica degradación
```

No se debe bloquear el reclamo por un fallo meramente visual.

No habrá loop de reintentos de red permanente.

---

# 2.20 Decisiones y riesgos

## Decisiones cerradas

### D1 — runtime self-host

Elegido sobre CDN.

### D2 — Rive 2.44.0

Fijado.

### D3 — `stateMachine`, singular

Obligatorio en código nuevo. Los parámetros plurales están deprecados.

### D4 — dos estados visuales

```text
available
claimed
```

### D5 — estado de negocio fuera de Rive

No existe ni se crea input `claim`.

El documento adjunto confirma que el `.riv` no ofrece ese input.

### D6 — Pop concurrente con State Machine

Se reproduce `Pop` sin pausar primero la State Machine.

### D7 — velocidad claimed

`advanceAndApply(dt * 0.75)` mediante driver aislado.

### D8 — glow

Pseudo-elemento radial externo.

### D9 — partículas

10 máximo.

### D10 — navegación SPA

`HomeView.onLeave()` = `destroy()`.

## Riesgo 1 — API interna de `animator`

**RIESGO NO VERIFICADO**

Es la única desviación respecto a API pública.

Plan: aserción estricta + fail closed; nunca degradar a 1x silenciosamente.

## Riesgo 2 — carga del runtime

La carga es lazy y self-host. Si los artefactos 2.44.0 no son servidos correctamente, el fallback debe mantener el claim funcional.

## Riesgo 3 — estado cloud tardío

Puede haber una corrección posterior a la hidratación cloud porque el diseño actual de Sentinel restaura datos después del bootstrap. El nuevo hub no debe celebrar esa corrección; `refresh()` únicamente sincroniza.

## Riesgo 4 — doble pestaña

El claim domain sigue siendo localStorage-based y no es una transacción distribuida. No añadir falsa garantía visual.

---

# 3. Tickets — Fase 3

# T1 — Integración Rive, runtime y ciclo de vida

## Objetivo

Sustituir `js/streak-hub.js` por `js/ui/streak-hub.js`, incorporar `fire-streak.riv` y runtime Rive 2.44.0 self-hosted, y garantizar carga lazy, pausa, resize, ViewModel, reproducción y cleanup.

## Dependencias

Ninguna.

## Archivos

### Crear

```text
js/ui/streak-hub.js
assets/rive/fire-streak.riv
assets/rive/runtime/2.44.0/rive.js
assets/rive/runtime/2.44.0/rive.wasm
assets/rive/runtime/2.44.0/LICENSE.txt
tests/rive-streak-lifecycle.test.mjs
```

### Modificar

```text
sw.js
vercel.json
```

### Eliminar

```text
js/streak-hub.js
```

### No tocar

```text
index.html
styles.css
js/ui/hud-render.js
README.md
docs/*
tests/daily-streak-hub-qa.mjs
```

## Pasos

1. Copiar los artefactos exactos de `@rive-app/canvas` **2.44.0**. JS y WASM deben provenir de la misma versión.

2. No crear `package.json` ni añadir dependencia npm. El repo no usa bundler.

3. Añadir `fire-streak.riv` exactamente en:

```text
assets/rive/fire-streak.riv
```

4. Añadir el runtime exactamente en:

```text
assets/rive/runtime/2.44.0/rive.js
assets/rive/runtime/2.44.0/rive.wasm
```

5. `rive.js` debe cargarse dinámicamente, no desde `<head>`.

6. Antes de construir `Rive`, configurar:

```js
window.rive.RuntimeLoader.setWasmUrl(
    '/assets/rive/runtime/2.44.0/rive.wasm'
);
```

7. Construir Rive exactamente con:

```js
new window.rive.Rive({
    src: '/assets/rive/fire-streak.riv',
    canvas,
    autoplay: true,
    artboard: 'streak',
    stateMachine: 'State Machine 1',
    autoBind: true,
    enableRiveAssetCDN: false,
    onLoad,
    onLoadError
});
```

8. En `onLoad` obtener:

```js
rive.viewModelInstance.number('streak')
```

y sincronizarlo con:

```js
window.GameCenter.getStreakInfo().streak
```

9. Implementar `IntersectionObserver`:

```js
{
    threshold: [0, 0.25]
}
```

considerando visible sólo cuando:

```text
isIntersecting === true
intersectionRatio >= .25
```

10. No crear `Rive` mientras el componente esté fuera de viewport.

11. Implementar `document.visibilitychange` para:

```text
hidden:
    stop custom rAF
    r.pause(["State Machine 1"])

visible:
    reanudar según estado
```

12. Implementar `ResizeObserver` sobre `#streak-rive-shell`, con scheduling por `requestAnimationFrame`.

13. Toda llamada de resize debe utilizar:

```js
r.resizeDrawingSurfaceToCanvas(
    Math.min(window.devicePixelRatio || 1, 2)
);
```

14. Implementar exactamente:

```text
available:
    State Machine 1 a velocidad normal

claimed:
    State Machine pausada
    driver.advanceAndApply(dt * .75)
    r.drawFrame()
```

15. Encapsular el acceso interno en una única función:

```js
getSlowDriver()
```

16. Si `getSlowDriver()` no encuentra:

```text
r.animator
r.animator.stateMachines
State Machine 1
advanceAndApply
drawFrame
```

lanzar error y mostrar fallback. No utilizar 1x como sustituto.

17. Implementar:

```js
destroy()
```

con:

```text
cancelAnimationFrame
clearTimeout
disconnect observers
cancel particle animations
r.cleanup()
null references
```

18. Eliminar `js/streak-hub.js`.

19. En `sw.js`, añadir:

```text
/js/ui/streak-hub.js
```

al app shell y no añadir `.riv`, runtime JS ni WASM al precache.

20. En `vercel.json`, añadir headers exactos para `.riv` y `.wasm`.

## Fuera de alcance

No modificar:

```text
layout HTML
estilos visuales
click handlers
GameCenter
daily-streak.js
documentación
```

## Criterios de aceptación

- `test -f assets/rive/fire-streak.riv`
- `test -f assets/rive/runtime/2.44.0/rive.js`
- `test -f assets/rive/runtime/2.44.0/rive.wasm`
- `git grep -n 'stateMachines:' js/ui/streak-hub.js` no devuelve resultados.
- `git grep -n 'stateMachine:.*State Machine 1' js/ui/streak-hub.js` devuelve una coincidencia.
- `git grep -ni 'unpkg.com/@rive-app/canvas' .` no devuelve resultados.
- La primera carga fuera de viewport no solicita ningún recurso Rive.
- Entrar al viewport solicita runtime y `.riv` una sola vez.
- Se obtiene `UserStreakVM.streak`.
- DPR nunca supera 2.
- Cambiar tamaño produce `resizeDrawingSurfaceToCanvas()`.
- Ocultar pestaña detiene el loop.
- Sacar componente de viewport detiene el loop.
- `destroy()` llama `r.cleanup()`.
- Si el driver 0.75x no existe, la prueba falla; no hay fallback 1x.
- `node tests/rive-streak-lifecycle.test.mjs` termina con código 0.

## Definición de hecho

Sin errores de consola, runtime versionado, cleanup comprobado, test lifecycle verde, sin código muerto y sin dependencia runtime externa.

---

# T2 — Estados visuales, claim, celebración y accesibilidad

## Objetivo

Integrar el shell Rive al HUD actual, eliminar definitivamente la animación SVG/CSS vieja y conectar el claim idempotente con la celebración Rive de 620 ms.

## Dependencias

```text
T1
```

## Archivos

### Modificar

```text
index.html
styles.css
js/ui/hud-render.js
tests/daily-streak-hub-qa.mjs
```

### No crear

Ningún segundo módulo de racha.

### No tocar

```text
js/domain/daily-streak.js
js/domain/game-center.js
js/core/state-store.js
js/cloud/sentinel.js
sw.js
vercel.json
README.md
docs/*
js/ui/streak-hub.js
```

## Pasos

1. En `index.html:323-395`, eliminar completamente:

```text
#streak-flame
#streak-flame__svg
flameOuter
flameCore
flame-layer
streak-flame__sparks
spark x6
streak-coin-burst
```

2. Sustituirlo por el HTML del shell Rive indicado anteriormente.

3. El `data-state` inicial debe ser:

```html
data-state="claimed"
```

4. Mantener:

```text
#streak-count-big
#hud-daily-label
#streak-hub-copy
#hud-daily-cta-text
#hud-reward-amount
#streak-days
#streak-count
#daily-countdown
#countdown-display
#daily-msg
```

5. Añadir:

```text
#streak-rive-status
#streak-rive-attribution
#streak-rive-particles
```

6. Actualizar la inclusión de script:

```html
<script src="js/ui/streak-hub.js"></script>
```

7. Eliminar:

```html
<script src="js/streak-hub.js"></script>
```

8. Después de:

```js
updateStreakBar();
updateCountdownDisplay();
```

añadir:

```js
window.StreakHub?.init?.();
```

9. Adaptar `HomeView.onLeave()` para llamar:

```js
window.StreakHub?.destroy?.();
```

10. Adaptar `HomeView.onEnter()` para llamar:

```js
window.StreakHub?.init?.();
window.StreakHub?.refresh?.();
```

11. Eliminar `index.html:1789-1799`, el listener extra que refresca 80 ms después del click.

12. En `js/ui/hud-render.js`, `updateUI()` debe llamar:

```js
window.StreakHub?.refresh?.();
```

al finalizar.

13. En el click normal, sustituir la llamada directa:

```js
window.GameCenter.claimDaily()
```

por:

```js
window.StreakHub.claim()
```

14. El handler no debe llamar posteriormente a:

```js
StreakHub.playClaimSequence()
```

para el claim normal. `claim()` ya controla la secuencia.

15. En la confirmación de reparación, sólo si:

```js
result.success === true
```

llamar:

```js
window.StreakHub?.playClaimSequence?.(result);
```

16. En `styles.css`, eliminar completamente todas las reglas antiguas del fuego desde la sección:

```text
DAILY STREAK HUB — Fire Widget
```

hasta el cierre del bloque anterior al supporting HUD.

17. Eliminar `streakPulse` y `@keyframes streakPulse`.

18. Eliminar del selector `.player-hud.motion-paused` todas las referencias a:

```text
.flame-layer
.spark
```

19. No conservar ningún:

```css
filter: grayscale(...)
filter: saturate(...)
filter: brightness(...)
filter: drop-shadow(...)
```

en el selector Rive.

20. Implementar únicamente:

```text
available:
    opacity 1
    glow .58
    pulse 2800ms
    transform máximo 1.04

claimed:
    opacity .90
    glow .28
    sin pulse
```

21. La celebración debe ser:

```text
620ms
scale 1 -> 1.14 -> 1.04 -> 1
glow .58 -> .90 -> .28
Pop
10 partículas máximo
```

22. Las partículas deben ser únicamente WAAPI y eliminarse al terminar.

23. `will-change` debe existir sólo durante la celebración y desaparecer al terminar.

24. `prefers-reduced-motion` debe impedir:

```text
pulse
Pop
partículas
claim scale
glow animation
```

25. Mantener diferencia visual estática entre estados mediante `opacity + glow`, nunca grayscale.

26. La información accessible debe mantenerse:

```text
button nativo
canvas role=img
canvas aria-label
aria-describedby
aria-live=status
```

27. Reescribir `tests/daily-streak-hub-qa.mjs` para validar:
   - sólo `available`/`claimed`;
   - canvas nuevo;
   - no filtros;
   - no `streak-flame`;
   - máximo 10 partículas;
   - claim single-flight;
   - reduced motion;
   - Pop;
   - live status;
   - lifecycle API.

28. Crear una prueba que llame `StreakHub.claim()` dos veces seguidas y compruebe:

```text
GameCenter.claimDaily() === 1 llamada
```

29. Crear prueba donde `GameCenter.claimDaily()` devuelve `success:false` y comprobar que:
   - no aparece celebración;
   - no aparecen partículas;
   - estado se refresca.

30. Crear prueba donde `claimDaily()` devuelve `repairRequired:true` y comprobar que no se ejecuta celebración.

31. Crear prueba donde `repairDailyStreak()` devuelve success y el handler de reparación activa `playClaimSequence`.

## Fuera de alcance

No modificar:

```text
daily-streak.js
state-store.js
Sentinel
reglas de recompensa
corte horario
economía
```

## Criterios de aceptación

- El HTML no contiene `streak-flame`.
- El HTML contiene exactamente un canvas Rive.
- El botón sigue siendo `button type="button"`.
- El canvas tiene `role="img"` y `aria-label`.
- `#streak-rive-status` tiene `role="status"` y `aria-live="polite"`.
- La atribución visible contiene exactamente `aristote` y `CC BY`.
- `available` tiene color completo y pulso.
- `claimed` conserva color, tiene opacity `.90`, glow `.28`, sin pulso.
- No existe grayscale.
- No existe `filter`/`drop-shadow` aplicado al nuevo canvas.
- No existe `streakPulse`.
- No existe `streak-coin-burst`.
- Claim exitoso reproduce `Pop`.
- Pop no pausa la State Machine antes de ejecutarse.
- Pop se detiene al terminar la ventana de 620 ms.
- 10 partículas es el máximo observable.
- Ninguna partícula permanece después de 800 ms.
- `prefers-reduced-motion` no crea partículas ni Pop.
- Dos calls rápidos a `StreakHub.claim()` producen una sola llamada a `GameCenter.claimDaily()`.
- `node tests/daily-streak-hub-qa.mjs` devuelve código 0.
- En Chrome 4× CPU no aparece Long Task >50 ms atribuible a la secuencia del hub.

## Definición de hecho

El antiguo SVG está eliminado, la celebración funciona, los dos estados son visualmente inequívocos, el claim es idempotente dentro de la página, no hay errores de consola y los tests del hub pasan.

---

# T3 — Eliminación de deuda técnica, documentación y auditoría final

## Objetivo

Eliminar cualquier rastro del sistema de animación antiguo, actualizar la documentación normativa y ejecutar la auditoría final de consistencia, rendimiento y accesibilidad.

## Dependencias

```text
T1
T2
```

## Archivos

### Modificar

```text
README.md
docs/ARCHITECTURE.md
docs/sistema-racha-diaria.md
tests/documentation-static-qa.mjs
```

### No tocar

```text
index.html
styles.css
js/ui/hud-render.js
js/ui/streak-hub.js
sw.js
vercel.json
js/domain/*
js/core/*
js/cloud/*
```

## Pasos

1. En `README.md`, cambiar:

```text
js/streak-hub.js
```

por:

```text
js/ui/streak-hub.js
```

2. Documentar el runtime:

```text
Rive Web runtime 2.44.0
self-hosted
lazy-loaded
```

3. En `docs/ARCHITECTURE.md`, actualizar la sección antigua `### js/streak-hub.js` para describir:

```text
js/ui/streak-hub.js
IntersectionObserver
visibilitychange
ResizeObserver
ViewModel
two visual states
cleanup
```

4. En `docs/sistema-racha-diaria.md`, eliminar toda descripción de:

```text
#streak-flame
SVG
flame-layer
CSS sparks
coin burst
grayscale
filter
claiming como estado estable
```

5. Documentar que los únicos estados visuales estables son:

```text
available
claimed
```

6. Documentar:

```text
repairAvailable + affordability
```

como una condición de negocio que se representa visualmente sin crear tercer estado gráfico.

7. Documentar la secuencia Rive:

```text
claim
↓
ViewModel streak
↓
Pop
↓
620ms celebration
↓
claimed
↓
0.75x
```

8. Documentar que `Pop` se reproduce concurrentemente con `State Machine 1`.

9. Documentar la limitación del runtime:

```text
No existe API pública de speed de State Machine en 2.44.0.
```

10. Documentar que el código utiliza un driver interno encapsulado para obtener exactamente `0.75x`.

11. Etiquetar esa dependencia como:

```text
RIESGO NO VERIFICADO
```

y explicar que la implementación falla cerrada si el driver no existe.

12. Corregir en `docs/sistema-racha-diaria.md` la afirmación antigua de que `canClaimDaily()` usa `Date.now()` directamente.

La implementación actual pasa por:

```text
LoveArcadeTime.read()
```

y el mismo cache/semántica de tiempo que el dominio.

13. Documentar la fuente de verdad:

```text
gamecenter_v6_promos.daily.lastClaim
gamecenter_v6_promos.daily.streak
```

14. Documentar restauración cloud mediante Sentinel sin crear otro flag persistente.

15. Documentar atribución:

```text
Dynamic streak fire por aristote · CC BY
```

16. Añadir al `tests/documentation-static-qa.mjs` assertions para asegurar cero referencias antiguas.

17. Ejecutar:

```bash
git diff --check
```

18. Ejecutar:

```bash
node tests/rive-streak-lifecycle.test.mjs
node tests/daily-streak-hub-qa.mjs
node tests/documentation-static-qa.mjs
node tests/service-worker-precache.test.mjs
```

19. Ejecutar la batería exacta del checklist inferior.

20. No cerrar T3 si existe una referencia antigua legítima en Markdown, test, service worker, HTML, CSS o JS.

## Fuera de alcance

No rediseñar:

```text
economía
reglas de racha
Supabase
time-sync
router
resto del HUD
```

## Criterios de aceptación

- Cero referencias antiguas en `git grep`.
- README actualizado.
- ARCHITECTURE actualizado.
- sistema-racha-diaria actualizado.
- Tests documentales verdes.
- Test de lifecycle verde.
- Test del hub verde.
- Test Service Worker verde.
- `git diff --check` sin salida.
- No existe `js/streak-hub.js`.
- No existe `streak.riv`.
- No existe `unpkg.com/@rive-app/canvas`.
- No hay `stateMachines:` en el nuevo código.
- No existe código muerto comentado “por si acaso”.
- No existen TODOs nuevos asociados a la migración.

## Definición de hecho

Repositorio sin residuos de la animación anterior, documentación consistente con la implementación real, todos los tests existentes/nuevos verdes y cero errores de consola en validación manual.

---

# 4. Checklist final de cero deuda técnica

Ejecutar los comandos **desde la raíz del repositorio**.

## 4.1 Referencias directas del sistema antiguo

```bash
git grep -niE 'streak-flame|streak-flame__svg|flame-layer|flameSwayBack|flameSwayMid|flameSwayCore|flameBurst|streakPulse|streak-coin-burst|flameOuter|flameCore|#streak-flame|#streak-coin-burst'
```

**Resultado esperado:** ninguna coincidencia.

## 4.2 Archivo antiguo

```bash
git ls-files | grep -Fx 'js/streak-hub.js'
```

**Resultado esperado:** ninguna salida.

## 4.3 Referencia antigua del módulo

```bash
git grep -niF 'js/streak-hub.js'
```

**Resultado esperado:** ninguna coincidencia.

## 4.4 Archivo `.riv` incorrecto

```bash
git grep -niF 'streak.riv'
```

**Resultado esperado:** ninguna coincidencia.

## 4.5 CDN sin versión

```bash
git grep -niE 'https?://unpkg\.com/@rive-app/canvas'
```

**Resultado esperado:** ninguna coincidencia.

## 4.6 Parámetro Rive deprecado

```bash
git grep -niE 'stateMachines\s*:|animations\s*:'
```

Si existen otros runtimes legítimos en el repositorio, revisar cada coincidencia manualmente.

Para el nuevo hub:

```bash
git grep -niE 'stateMachines\s*:' -- js/ui/streak-hub.js index.html
```

**Resultado esperado:** ninguna salida.

## 4.7 State Machine correcta

```bash
git grep -niF "stateMachine: 'State Machine 1'" -- js/ui/streak-hub.js
```

**Resultado esperado:** exactamente una coincidencia.

## 4.8 Asset nuevo

```bash
git ls-files assets/rive
```

Debe contener como mínimo:

```text
assets/rive/fire-streak.riv
assets/rive/runtime/2.44.0/rive.js
assets/rive/runtime/2.44.0/rive.wasm
assets/rive/runtime/2.44.0/LICENSE.txt
```

## 4.9 Cache del Service Worker

```bash
git grep -niE 'streak-hub\.js|fire-streak\.riv|rive/runtime/2\.44\.0' -- sw.js
```

Debe existir:

```text
/js/ui/streak-hub.js
```

pero **no** debe aparecer `fire-streak.riv` ni el runtime dentro de `APP_SHELL_FILES`.

## 4.10 Headers

```bash
git grep -niE 'application/wasm|application/octet-stream|fire-streak|\.riv|\.wasm' -- vercel.json
```

Debe existir configuración explícita para ambos formatos.

## 4.11 Filtros prohibidos en Rive

```bash
git grep -niE 'streak-rive|streakRive' -- styles.css
```

Después inspeccionar específicamente:

```bash
git grep -niE 'streak-rive[^\\n]*(filter|drop-shadow|blur|box-shadow)' -- styles.css
```

**Resultado esperado:** ninguna coincidencia.

## 4.12 Animaciones antiguas

```bash
git grep -niE '@keyframes\s+(streakPulse|flameSwayBack|flameSwayMid|flameSwayCore|flameBurst)|animation[^;]*streakPulse'
```

**Resultado esperado:** ninguna coincidencia.

## 4.13 Partículas antiguas

```bash
git grep -niE 'streak-coin-burst|className\s*=\s*[\'"]coin[\'"]|class="spark|\.spark--[1-9]'
```

**Resultado esperado:** ninguna coincidencia asociada al hub antiguo.

## 4.14 Grayscale antiguo

```bash
git grep -niE 'streak.*grayscale|grayscale.*streak|streak.*filter|filter.*streak'
```

**Resultado esperado:** ninguna coincidencia asociada al nuevo hub.

## 4.15 Atribución

```bash
git grep -niE 'aristote|Dynamic streak fire|CC BY' -- index.html README.md docs assets
```

Debe existir una atribución visible en `index.html`.

## 4.16 API pública del nuevo módulo

```bash
git grep -niE 'window\.StreakHub\s*=' -- js/ui/streak-hub.js
```

y:

```bash
git grep -niE '\b(init|refresh|setState|claim|playClaimSequence|destroy),?' -- js/ui/streak-hub.js
```

Debe estar presente la API completa:

```text
init
refresh
setState
claim
playClaimSequence
destroy
```

## 4.17 No crear persistencia paralela

```bash
git grep -niE 'localStorage\.(setItem|getItem|removeItem)|LoveArcadeStore\.(save|replaceStore|getStore)' -- js/ui/streak-hub.js
```

**Resultado esperado:** ninguna operación de persistencia del hub.

El módulo sólo debe usar `GameCenter` para negocio.

## 4.18 Tests

```bash
node tests/rive-streak-lifecycle.test.mjs
node tests/daily-streak-hub-qa.mjs
node tests/documentation-static-qa.mjs
node tests/service-worker-precache.test.mjs
```

Todos deben terminar con código 0.

## 4.19 Calidad Git

```bash
git diff --check
```

Debe terminar sin salida.

## 4.20 Inventario de archivos antiguos

```bash
git ls-files | grep -Ei '(^|/)(.*streak.*\.(gif|lottie|riv|svg))$'
```

Debe revisarse manualmente: el único asset de animación streak permitido es:

```text
assets/rive/fire-streak.riv
```

No se deben eliminar SVGs que pertenezcan a otras partes de la aplicación.

## 4.21 Búsqueda amplia de Rive

```bash
git grep -niE 'rive|fire-streak'
```

Las coincidencias restantes deben pertenecer únicamente a:

```text
nuevo runtime
nuevo asset
nueva documentación
nuevo módulo
tests
headers
service worker
```

y ninguna debe apuntar al sistema antiguo.

## 4.22 Verificación manual final

Con Chrome:

```text
Mobile viewport
4× CPU throttling
Slow 4G
prefers-reduced-motion = disabled
```

Verificar:

```text
[ ] available tiene colores completos
[ ] available tiene glow y respiración sutil
[ ] available funciona a 1x
[ ] click incrementa streak una sola vez
[ ] Pop aparece sin congelar State Machine
[ ] celebración dura ~620 ms
[ ] máximo 10 partículas
[ ] claimed queda calmado
[ ] claimed conserva colores
[ ] claimed no pulsa
[ ] claimed reproduce a 0.75x
[ ] reduced-motion elimina Pop/partículas/pulso
[ ] teclado funciona
[ ] lector de pantalla recibe label/estado
[ ] fallback no bloquea claim
[ ] fuera de viewport no hay rAF Rive
[ ] pestaña oculta no hay rAF Rive
[ ] volver a Home rehidrata correctamente
[ ] destroy ejecuta cleanup
[ ] no hay layout jump
[ ] atribución visible
[ ] consola limpia
```

## Resultado esperado final

El repositorio debe quedar con esta arquitectura:

```text
index.html
    ↓
js/ui/hud-render.js
    ↓
js/ui/streak-hub.js
    ↓
@rive-app/canvas 2.44.0 self-hosted
    ↓
assets/rive/fire-streak.riv
```

y la autoridad de negocio permanece:

```text
js/domain/daily-streak.js
    ↓
js/domain/game-center.js
    ↓
LoveArcadeStore
    ↓
localStorage / Sentinel cloud
```

El gráfico nunca se convierte en una fuente de estado.

Eliminados completamente:

```text
SVG de llama
CSS flame layers
CSS sparks
grayscale/filter del hub
streakPulse
coin burst antiguo
js/streak-hub.js
CDN unversionado
referencias documentales antiguas
tests del comportamiento antiguo
```

Con esto, el agente puede implementar los tickets en orden sin depender de decisiones adicionales.