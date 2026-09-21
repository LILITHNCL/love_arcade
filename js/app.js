// Configuración estática cargada síncronamente por js/core/config.js antes de app.js.
const CONFIG = window.CONFIG;
const StateStore = window.LoveArcadeStore;
const { KB, AVATAR_CLEANUP_KB } = StateStore.constants;
const Theming = window.LoveArcadeTheming;
const ThemeGrid = window.LoveArcadeThemeGrid;
const HUD = window.LoveArcadeHUD;
const MicroInteractions = window.LoveArcadeMicroInteractions;

// =====================================================
// WEB WORKER — Sincronización en hilo separado
// =====================================================
let _syncWorker = null;

function getSyncWorker() {
    if (_syncWorker) return _syncWorker;
    try {
        _syncWorker = new Worker('js/sync-worker.js');
        _syncWorker.onerror = () => { _syncWorker = null; };
    } catch (e) {
        _syncWorker = null;
    }
    return _syncWorker;
}

/**
 * Envía una tarea al Web Worker de sincronización y devuelve una Promise con el resultado.
 *
 * COMPORTAMIENTO DE FALLBACK: si el worker no está disponible (navegador sin soporte,
 * error de instanciación, o contexto sin origen — e.g. file://), la Promise es rechazada
 * con Error('Worker no disponible'). Los llamadores (exportSave / importSave) tienen
 * bloques try/catch que capturan este rechazo y ejecutan la operación en el hilo
 * principal como fallback. El sistema nunca bloquea la UI incluso sin worker.
 *
 * IDEMPOTENCIA: cada llamada crea un `id` único ({timestamp}-{random}) para correlacionar
 * la respuesta del worker. Múltiples llamadas concurrentes se resuelven de forma
 * independiente gracias a este id.
 *
 * @param {{ action: string, [key: string]: any }} payload
 * @returns {Promise<any>}
 */
function workerTask(payload) {
    return new Promise((resolve, reject) => {
        const worker = getSyncWorker();
        if (!worker) { reject(new Error('Worker no disponible')); return; }
        const id = `${Date.now()}-${Math.random()}`;
        const handler = (e) => {
            if (e.data.id !== id) return;
            worker.removeEventListener('message', handler);
            if (e.data.error) reject(new Error(e.data.error));
            else resolve(e.data.result);
        };
        worker.addEventListener('message', handler);
        worker.postMessage({ ...payload, id });
    });
}
window.workerTask = workerTask;

// =====================================================
// FUNCIONES INTERNAS
// =====================================================

let _pendingSyncRetries = 0;
let _cloudSyncRetryTimer = null;
let _deferredCloudSyncHandle = null;
let _pendingDeferredCloudSync = false;
const MAX_SYNC_RETRIES = 3;
const SYNC_RETRY_DELAY = 500;

/**
 * Ejecuta la sincronización cloud después del frame crítico de interacción.
 * El timeout evita que requestIdleCallback la retrase indefinidamente durante
 * actividad continua, y el fallback mantiene compatibilidad con Safari.
 */
function _scheduleCloudSync(immediateCloudSync) {
    if (immediateCloudSync) _pendingDeferredCloudSync = true;
    if (_deferredCloudSyncHandle !== null) return;

    const run = () => {
        _deferredCloudSyncHandle = null;
        const shouldSyncImmediately = _pendingDeferredCloudSync;
        _pendingDeferredCloudSync = false;
        _syncCloudIfNeeded(shouldSyncImmediately);
    };

    if ('requestIdleCallback' in window) {
        _deferredCloudSyncHandle = requestIdleCallback(run, { timeout: 200 });
    } else {
        _deferredCloudSyncHandle = setTimeout(run, 0);
    }
}

function _scheduleImmediateCloudRetry() {
    if (_pendingSyncRetries >= MAX_SYNC_RETRIES) return;
    if (_cloudSyncRetryTimer) return;
    _pendingSyncRetries += 1;
    _cloudSyncRetryTimer = setTimeout(() => {
        _cloudSyncRetryTimer = null;
        _syncCloudIfNeeded(true);
    }, SYNC_RETRY_DELAY);
}

function _syncCloudIfNeeded(immediate = false) {
    const sentinel = window.Sentinel;
    if (!sentinel?.getStatus) {
        if (immediate) _scheduleImmediateCloudRetry();
        return;
    }
    try {
        const status = sentinel.getStatus();
        if (status?.hasSession) {
            _pendingSyncRetries = 0;
            if (_cloudSyncRetryTimer) {
                clearTimeout(_cloudSyncRetryTimer);
                _cloudSyncRetryTimer = null;
            }
            if (immediate && sentinel.syncNow) sentinel.syncNow();
            return;
        }
        if (immediate) _scheduleImmediateCloudRetry();
    } catch (_) {}
}

document.addEventListener('la:cloud-authenticated', () => {
    if (_pendingSyncRetries > 0) _syncCloudIfNeeded(true);
});

StateStore.subscribe((_state, { source, notifyCloud = true, immediateCloudSync = false } = {}) => {
    if (source === 'save' && notifyCloud) _scheduleCloudSync(immediateCloudSync);
});

// =====================================================
// INIT SÍNCRONO — v9.3 Zero-Flicker Initiative
// ─────────────────────────────────────────────────────────────────────────────
// app.js está posicionado al FINAL de <body>. En ese punto el navegador ya
// ha parseado todo el HTML y los elementos del DOM existen, pero NO ha
// realizado el primer layout/paint todavía (las scripts síncronas bloquean el
// render). Esto nos permite escribir datos reales en el DOM ANTES de que el
// usuario vea cualquier píxel, eliminando los tres tipos de parpadeo:
//
//   1. Theme Flash     → applyTheme() antes del primer paint
//   2. Coin Jitter     → escribe saldo formateado antes del primer paint
//   3. State Sync Gap  → updateDailyButton() y updateMoonBlessingUI() inmediatos
// =====================================================

// 1. TEMA — elimina el "salto violeta" para cualquier usuario con otro tema.
//    El script crítico del <head> ya habrá ajustado los CSS vars; applyTheme()
//    añade la clase theme-{key} al <body> y actualiza los botones de ajustes.
ThemeGrid.renderThemeGrid();
Theming.applyTheme(StateStore.getStore().theme || 'violet');

if (StateStore.isBase64Avatar(StateStore.getStore().userAvatar) && StateStore.getStore().userAvatar.length > (AVATAR_CLEANUP_KB * KB)) {
    StateStore.getStore().userAvatar = null;
    window.GhostAnalytics?.track('storage_cleaned', { reason: 'avatar_too_large' });
    StateStore.save();
}

// 2. SALDO — escribe el valor formateado síncronamente.
//    El .coin-badge tiene opacity:0 por CSS; nunca pintará el "0" del HTML.
HUD.syncInitialCoinDisplay();

// 3. BOTÓN DIARIO Y LUNA — corrige el estado (activo/desactivado, texto de
//    recompensa) antes del primer paint, eliminando el "salto de estado".
HUD.updateDailyButton();
HUD.updateMoonBlessingUI();

// 4. AVATAR — aplica la imagen guardada síncronamente (si existe).
HUD.applyAvatar();

// 5. IDENTIDAD — escribe nickname y sufijo de género en el DOM antes del reveal.
//    Solo actúa si hay nickname guardado; si no, el modal de bienvenida (en el
//    inline script de index.html) se encarga de llamar a revealUI() al confirmar.
HUD.applyIdentity();

// NOTA: revealUI() se llama desde el inline script de index.html, DESPUÉS de
// que updateStreakBar() y updateCountdownDisplay() también hayan corrido.
// Esto garantiza que .player-hud se revela con TODOS sus estados correctos
// (botón, countdown, barras de racha y avatar) en un solo RAF.
//
// ¿Por qué revealUI() NO se llama aquí directamente?
// ──────────────────────────────────────────────────────────────────────────
// app.js no tiene acceso a las funciones updateStreakBar() y
// updateCountdownDisplay(), que viven en el inline script de index.html.
// Si revealUI() se llamara aquí, el HUD se revelaría ANTES de que esas
// funciones hayan ejecutado, causando un salto visual de estado ("jitter"):
//   1. El botón aparece con el texto correcto (updateDailyButton ya corrió)
//   2. Pero las barras de racha aparecen vacías (updateStreakBar no corrió aún)
//   3. El countdown aparece oculto (updateCountdownDisplay no corrió aún)
// Al delegarlo al inline script del <body>, se garantiza el orden correcto:
//   updateStreakBar() → updateCountdownDisplay() → revealUI()
// Todos en el mismo hilo, antes del primer paint.

// =====================================================
// EVENT LISTENERS — DOMContentLoaded
// Los listeners no afectan al primer paint; se registran aquí por claridad.
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    MicroInteractions.initInteractiveMicroFX();
    MicroInteractions.initLoadingStateObserver();

    // Re-sincronizar UI por si algún sub-módulo modificó el DOM
    HUD.updateUI();

    // ── Analítica — open_game ─────────────────────────────────────────────────
    // Delegación global para detectar la apertura de cualquier minijuego.
    // Se escucha el click en cualquier <a> cuya href contenga "games/" para no
    // requerir data-attributes específicos en cada tarjeta de juego del HTML.
    // passive:true garantiza que no bloquea el scroll ni el propio navegador.
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href*="games/"]');
        if (!link) return;
        // Intentar obtener el ID del juego desde data-game-id, data-game-name,
        // o derivarlo del nombre del archivo HTML (último segmento de la URL).
        const gameId = link.dataset.gameId
            || link.dataset.gameName
            || link.getAttribute('href')?.split('/').pop()?.replace(/\.html?$/, '')
            || 'desconocido';
        window.GhostAnalytics?.track('open_game', { juego: gameId });
    }, { passive: true });

    // ── Rehidratación al volver desde juegos externos / bfcache ─────────────
    // pageshow se dispara al regresar con el botón "Atrás" y también cuando la
    // página se restaura desde bfcache. Releer localStorage evita que la UI del
    // hub quede desincronizada tras cambios hechos en pages de juegos.
    const refreshHubStateFromDisk = () => {
        const sentinelRehydrate = window.Sentinel?._rehydrateHubStoreFromDisk;
        if (typeof sentinelRehydrate === 'function') {
            try {
                sentinelRehydrate();
                return;
            } catch (_) {
                // Fallback manual debajo si Sentinel falla.
            }
        }

        try {
            const raw = localStorage.getItem(CONFIG.stateKey);
            if (!raw) return;
            StateStore.replaceStore(StateStore.migrate(JSON.parse(raw)), { notifyUI: false, notifyCloud: false });
            // syncUI resetea _displayedCoins al valor actual del store para
            // evitar animaciones innecesarias en este refresco de retorno.
            window.GameCenter?.syncUI?.();
        } catch (_) {
            // JSON inválido o storage inaccesible → ignorar sin romper la SPA.
        }
    };

    window.addEventListener('pageshow', refreshHubStateFromDisk);
    // Opcional: también al recuperar foco de la ventana (alt-tab / click fuera).
    window.addEventListener('focus', refreshHubStateFromDisk);

    // ── Background time sync (v9.6) ───────────────────────────────────────
    // Se lanza 800 ms después del DOMContentLoaded para no competir con el
    // primer paint. El resultado se almacena en el caché de LoveArcadeTime y será leído
    // por claimDaily() de forma síncrona, sin espera de red en el reclamo.
    window.LoveArcadeTime.scheduleSync(800);

    // Actualizar el caché cuando el usuario vuelve a la pestaña
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            window.LoveArcadeTime.scheduleSync(250);
        }
    });

    // ── Movimiento decorativo del HUD ──────────────────────────────────────
    // Las animaciones del fuego, las chispas y el anillo son decorativas.
    // Pausarlas fuera de la pestaña visible evita trabajo continuo de compositor
    // sin cambiar la UI que recibe el usuario al volver.
    const syncHudMotionVisibility = () => {
        document.querySelectorAll('.player-hud').forEach(hud => {
            hud.classList.toggle('motion-paused', document.hidden);
        });
    };

    syncHudMotionVisibility();
    document.addEventListener('visibilitychange', syncHudMotionVisibility);

    // Refresco periódico cada 30 min por si la app permanece abierta mucho tiempo
    window.AppScheduler?.registerInterval('sync', 'time-cache-sync', () => window.LoveArcadeTime.scheduleSync(), 30 * 60 * 1000)
        || setInterval(() => window.LoveArcadeTime.scheduleSync(), 30 * 60 * 1000);

    // Bono diario — el botón se desactiva SÍNCRONAMENTE antes de cualquier operación
    // asíncrona para prevenir el "double-tap bug" (race condition por clics rápidos).
    const dailyBtn = document.getElementById('btn-daily');
    if (dailyBtn) {
        dailyBtn.addEventListener('click', () => {
            // ── Paso 1: desactivar de inmediato ──
            dailyBtn.disabled      = true;
            dailyBtn.style.opacity = '0.5';
            dailyBtn.style.cursor  = 'not-allowed';

            if (dailyBtn.dataset.mode === 'repair') {
                HUD.showDailyRepairModal();
                HUD.updateDailyButton();
                return;
            }

            // ── Paso 2: ejecutar reclamo (instantáneo — sin red) ──
            const result = window.GameCenter.claimDaily();

            // ── Paso 3: mostrar mensaje y actualizar UI ──
            if (result.repairRequired) {
                HUD.showDailyRepairModal();
            } else {
                HUD.setDailyMessage(result.message, result.success);
            }

            // updateDailyButton() recalcula el estado correcto del botón
            // (puede habilitarlo si el reclamo falló por error recuperable,
            //  o dejarlo desactivado con el contador si fue exitoso).
            HUD.updateDailyButton();
            // El dominio ya no escribe DOM: conservar el refresco que hacía
            // claimDaily() antes de la extracción.
            HUD.updateMoonBlessingUI();
            window.StreakHub?.playClaimSequence?.(result);

        });
    }

    // NOTA: El listener de #btn-moon-blessing fue eliminado en v9.x (SPA Migration).
    // La Bendición Lunar es un elemento de la vista Tienda; su handler vive
    // exclusivamente en shop-logic.js para evitar el doble-registro de eventos.
});
