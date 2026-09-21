// Este script clásico debe cargarse antes de js/app.js; no depende de store ni del DOM.
(function initLoveArcadeTime() {
    // =====================================================
    // TIEMPO DE RED — Fuente de verdad externa para el bono diario
    // =====================================================

    /** Máxima discrepancia tolerable entre reloj local y de red: 5 minutos. */
    const CLOCK_SKEW_LIMIT = 5 * 60 * 1000;

    /** Timeout de cada petición a una API de tiempo (ms). */
    const TIME_API_TIMEOUT = 4000;

    /**
     * Clave de localStorage para el caché de tiempo de red.
     * Separada del store principal para no contaminar checksums de sincronización.
     */
    const TIME_CACHE_KEY = 'love_arcade_time_cache';
    const DAILY_DAY_OFFSET_MS = 3 * 60 * 60 * 1000;
    /**
     * TTL del caché de tiempo (ms). Mientras el caché sea más reciente que este
     * valor, claimDaily() lo usa directamente sin ninguna petición de red.
     * 4 horas es suficiente: el usuario abre la app, el sync corre en background,
     * y el caché queda listo para el reclamo de ese día y el siguiente.
     */
    const TIME_CACHE_TTL = 4 * 60 * 60 * 1000;

    // ── Lectura / escritura del caché ─────────────────────────────────────────

    /**
     * Escribe el resultado de una sincronización en el caché local.
     * @param {{ drift: number, desynced: boolean }} data
     */
    function _writeTimeCache(data) {
        try {
            localStorage.setItem(TIME_CACHE_KEY, JSON.stringify({
                drift:       data.drift,
                desynced:    data.desynced,
                capturedAt:  Date.now()
            }));
        } catch (_) {}
    }

    /**
     * Lee el caché y devuelve una estimación del tiempo de red actual.
     * No hace ninguna petición de red — es puramente síncrono.
     *
     * @returns {{
     *   time:       number,   — estimación del timestamp de red en ms
     *   verified:   boolean,  — true si el caché existe y no ha expirado
     *   desynced:   boolean,  — true si se detectó manipulación de reloj en el último sync
     *   cacheAge:   number    — antigüedad del caché en ms (0 si no existe)
     * }}
     */
    function _getDailyDayStart(ts) {
        const shifted = ts - DAILY_DAY_OFFSET_MS;
        return new Date(shifted).setHours(0, 0, 0, 0);
    }

    function _getDailyDiffDays(now, lastClaim) {
        if (!lastClaim) return 1;
        return Math.round((_getDailyDayStart(now) - _getDailyDayStart(lastClaim)) / 86_400_000);
    }

    function _getNextDailyResetTime(now = Date.now()) {
        const shifted = new Date(now - DAILY_DAY_OFFSET_MS);
        shifted.setHours(24, 0, 0, 0);
        return shifted.getTime() + DAILY_DAY_OFFSET_MS;
    }

    function _readTimeCache() {
        try {
            const raw = localStorage.getItem(TIME_CACHE_KEY);
            if (!raw) return { time: Date.now(), verified: false, desynced: false, cacheAge: Infinity };

            const { drift, desynced, capturedAt } = JSON.parse(raw);
            const cacheAge = Date.now() - capturedAt;
            const verified = cacheAge <= TIME_CACHE_TTL;

            return {
                time:     Date.now() + (drift || 0),
                verified,
                desynced: Boolean(desynced),
                cacheAge
            };
        } catch (_) {
            return { time: Date.now(), verified: false, desynced: false, cacheAge: Infinity };
        }
    }

    // ── Sincronización en segundo plano ──────────────────────────────────────

    /**
     * Lee el encabezado HTTP Date del propio origen (Vercel) para tener una
     * referencia de tiempo sin depender de CORS de terceros.
     *
     * @returns {Promise<number>} Timestamp en ms.
     */
    async function _fetchServerDateHeader() {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), TIME_API_TIMEOUT);
        try {
            const res = await fetch('/', {
                method: 'HEAD',
                cache: 'no-store',
                signal: ctrl.signal
            });
            const dateHeader = res.headers.get('date');
            if (!dateHeader) throw new Error('Date header ausente');
            const ts = new Date(dateHeader).getTime();
            if (!Number.isFinite(ts)) throw new Error('Date header inválido');
            return ts;
        } finally {
            clearTimeout(tid);
        }
    }

    let _timeSyncInFlight = false;
    let _lastTimeSyncAt   = 0;
    const TIME_SYNC_MIN_INTERVAL = 30_000;

    function _scheduleTimeSync(delay = 0) {
        setTimeout(() => {
            if (_timeSyncInFlight) return;
            if ((Date.now() - _lastTimeSyncAt) < TIME_SYNC_MIN_INTERVAL) return;
            _timeSyncInFlight = true;
            _syncTimeBackground()
                .finally(() => {
                    _timeSyncInFlight = false;
                    _lastTimeSyncAt = Date.now();
                });
        }, delay);
    }

    /**
     * Sincroniza el caché de tiempo en segundo plano usando el encabezado HTTP
     * Date del propio origen y persiste el resultado SIN bloquear la UI.
     *
     * No retorna ningún valor útil — su único efecto es actualizar el caché.
     * Se llama automáticamente al cargar la página, al volver a la pestaña
     * y cada 30 min mientras la app está abierta.
     */
    async function _syncTimeBackground() {
        try {
            const networkTime = await _fetchServerDateHeader();

            const drift    = networkTime - Date.now();
            const desynced = Math.abs(drift) > CLOCK_SKEW_LIMIT;
            _writeTimeCache({ drift, desynced });
        } catch (_) {
            // Todas las fuentes fallaron (sin conexión) — no tocar el caché existente.
            // claimDaily() seguirá usando el último caché válido o el reloj local.
        }
    }

    window.LoveArcadeTime = {
        read: _readTimeCache,
        scheduleSync: _scheduleTimeSync,
        dayDiff: _getDailyDiffDays,
        dayStart: _getDailyDayStart,
        nextResetTime: _getNextDailyResetTime
    };
})();
