/**
 * Game Center Core v11.0 — Meta-Gameplay & Event Engine
 * Compatible con gamecenter_v6_promos — migración silenciosa incluida.
 * Compatible con Ghost Analytics v11.0 — Doble Candado (Anti-Bot + Human Gate).
 *
 * NOVEDADES v11.0 (Meta-Gameplay & Event Engine):
 *  - addCoins(amount): nuevo método público de GameCenter que permite a
 *    event-logic.js depositar monedas sin pasar por completeLevel().
 *    Usado por la Cacería de Tesoros y el Gachapón Relámpago.
 *  - Evento personalizado 'la:levelcomplete': completeLevel() despacha este
 *    CustomEvent en document tras cada pago exitoso para módulos desacoplados.
 *
 * NOVEDADES v9.9.2 (Hardening & Error Detection):
 *  - Eliminado track('redeem_code') de redeemPromoCode(): la fuente única de
 *    disparo es handleRedeem() en shop-logic.js, al final de la cadena de éxito
 *    de UI. Elimina el doble reporte que saturaba el canal de Discord.
 *  - buyItem(): nueva rama de tracking insufficient_funds cuando reason === 'coins'.
 *    Registra wallpaper, precio final y saldo actual para detectar si los precios
 *    son demasiado elevados o el HUD de saldo no es claro para el usuario.
 *  - buyMoonBlessing(): ídem para insufficient_funds; registra el costo del buff
 *    y el saldo disponible.
 *  - claimDaily(): nuevo track('daily_bonus') en la rama de éxito. Registra
 *    recompensa total, racha y si la Bendición Lunar contribuyó. Solo disparado
 *    en éxito para no saturar el canal con intentos fallidos del botón.
 *  - GameCenter.getRedeemedCount(): nuevo método expuesto que devuelve el número
 *    de códigos ya canjeados, usado por el user_snapshot de shop-logic.js.
 *
 * NOVEDADES v9.9 (Ghost Analytics):
 *  - Integración con el módulo analytics.js (debe cargarse ANTES en el HTML).
 *  - Evento open_game: delegación global en DOMContentLoaded sobre cualquier
 *    <a href*="games/"> para registrar qué minijuego fue abierto.
 *  - Evento redeem_code: llamada a GhostAnalytics.track() dentro de
 *    redeemPromoCode() cuando el canje es exitoso. El código original nunca
 *    se envía; se trunca con *** para proteger el texto plano.
 *  - Los eventos detected_error se capturan automáticamente en analytics.js
 *    mediante window.addEventListener('error') y 'unhandledrejection'.
 *  - Todas las llamadas usan optional chaining (?.) para ser no-operativas
 *    si analytics.js no está cargado (degradación elegante).
 *
 * COMPATIBILIDAD CON analytics.js v11.0 (Doble Candado):
 *  - Todas las llamadas a GhostAnalytics.track() en este módulo son seguras
 *    con el nuevo sistema de "Doble Candado":
 *    · Son disparadas por acciones de usuario reales (click en btn-daily,
 *      btn-moon-blessing, links de juegos, compras). Ninguna se dispara en
 *      onload o DOMContentLoaded de forma automática.
 *    · El campo 'usuario' (nickname) NO debe incluirse en las llamadas de
 *      este módulo — analytics.js v11.0 lo inyecta automáticamente en track()
 *      tras leerlo de localStorage['gamecenter_v6_promos'].
 *    · Si el Human Gate está cerrado o el nickname no está disponible en el
 *      momento del disparo, analytics.js encola el evento y lo envía cuando
 *      las condiciones se cumplan. Ningún evento se pierde.
 *  - No se requieren cambios funcionales en app.js para la compatibilidad
 *    con analytics.js v11.0; la integración es transparente gracias al
 *    optional chaining (?.) y a la inyección automática del nickname.
 *
 * NOVEDADES v9.4 (Identity Update):
 *  - store.nickname (string, max 15 chars): nombre personalizado del usuario.
 *  - store.gender ('o'|'a'|'@'): sufijo del saludo ("Bienvenid@").
 *  - migrateState(): incluye validación silenciosa de ambos campos nuevos.
 *  - applyIdentity(): escribe nickname y sufijo en el DOM de forma síncrona
 *    antes de revealUI(), manteniendo la Zero-Flicker Initiative.
 *  - GameCenter.setIdentity(nickname, gender): guarda y aplica identidad.
 *  - GameCenter.getIdentity(): lectura segura de nickname y gender.
 *  - GameCenter.hasIdentity(): comprueba si el nickname está configurado.
 *  - Flujo de bienvenida: si nickname está vacío al cargar, el inline script
 *    de index.html muestra el Identity Modal y llama a revealUI() al confirmar.
 *    El .player-hud permanece en opacity:0 durante ese tiempo.
 *
 * NOVEDADES v9.3 (Zero-Flicker Initiative):
 *  - Script crítico inline en <head> de index.html: lee el tema del
 *    localStorage y sobreescribe los CSS custom properties en :root ANTES
 *    del primer paint, eliminando el "salto violeta" al 100%.
 *  - INIT síncrono: applyTheme(), init de saldo, updateDailyButton(),
 *    updateMoonBlessingUI() y applyAvatar() se ejecutan síncronamente al
 *    final de <body> (fuera de DOMContentLoaded). Dado que app.js está al
 *    final del body, el DOM ya existe pero el navegador aún no ha pintado,
 *    por lo que todos los valores correctos se escriben antes del primer frame.
 *  - revealUI(): añade .is-ready y .coin-badge--visible en el siguiente RAF,
 *    garantizando que los contenedores de datos críticos sólo se revelan
 *    después de que sus valores reales han sido escritos.
 *  - styles.css: .player-hud y .hud-avatar-wrap comienzan con opacity:0 y
 *    transicionan a 1 cuando reciben .is-ready.
 *
 * NOVEDADES v9.2 (Font FOIT/FOUT, Coin Init & Treasury Grid):
 *  - Init silencioso del saldo: escribe el valor formateado síncronamente.
 *  - .coin-badge--visible: fade-in de 150ms tras la sincronización inicial.
 *
 * NOVEDADES v9.1 (History API, Retry UI & Theme Fix):
 *  - applyTheme(): clase theme-{key} en <body> + data-theme en <html>.
 *
 * NOVEDADES v9.0 (SPA Migration):
 *  - Arquitectura SPA unificada. shop.html eliminado.
 *  - getState(), syncUI() expuestos para módulos externos.
 *
 * NOVEDADES v8.1 (Daily Claim Security):
 *  - _syncTimeBackground() / _readTimeCache(): verificación de tiempo desacoplada del reclamo (v9.6).
 */

// =====================================================
// CONFIGURACIÓN GLOBAL
// =====================================================
const CONFIG = {
    stateKey:      'gamecenter_v6_promos', // ← NO modificar jamás
    initialCoins:  0,
    dailyReward:   20,     // Monedas base del día 1 (se escala con racha)
    dailyStreakCap: 60,    // Máximo de monedas por bono diario
    dailyStreakStep: 5,    // Incremento por día de racha
    wallpapersPath: 'https://res.cloudinary.com/dyspgn0sw/image/upload/'
};
// Exponer globalmente para que shop-logic.js pueda acceder a CONFIG.wallpapersPath
// sin depender del scope de cierre del bundle (resuelve fragilidad en módulos ES).
window.CONFIG = CONFIG;

// Salt para checksums de sincronización — mantener secreto
const SYNC_SALT = 'love_arcade_v75_integrity_2026';

// =====================================================
// ECONOMÍA — Editar aquí para eventos especiales
// =====================================================
const ECONOMY = {
    isSaleActive:   true,
    saleMultiplier: 0.70,
    saleLabel:      '30% OFF',
    cashbackRate:   0.1
};
window.ECONOMY = ECONOMY;

// =====================================================
// TEMAS
// =====================================================
const THEMES = {
    violet:  { accent: '#9b59ff', glow: 'rgba(155, 89, 255, 0.4)',  name: 'Violeta' },
    pink:    { accent: '#ff59b4', glow: 'rgba(255, 89, 180, 0.4)',  name: 'Rosa Neón' },
    cyan:    { accent: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)',   name: 'Cyan Arcade' },
    gold:    { accent: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)',  name: 'Dorado' },
    crimson: { accent: '#e11d48', glow: 'rgba(225, 29, 72, 0.4)',   name: 'Carmesí Arcade' }
};
window.THEMES = THEMES;

// =====================================================
// CÓDIGOS PROMOCIONALES — SHA-256 (no texto plano)
// Generados con: echo -n "CODIGO" | sha256sum
// Para agregar nuevos códigos ver DOCUMENTACION.md §10
// =====================================================
const PROMO_CODES_HASHED = {
'4564f1daae1dd157925088fce37fefc9869dabbbd7f860069dcf593d4d620a4b': 2500,   // PVZGW2500
'5136694194f15aecc6eae3645b56b6a8273876d6d830709cf7591dd89a05b066': 500,    // PVZGW500
'fe499ddb40f6bf77d1b7b18efe6c365848b46a9522e8c37155bcf306fad2e0ee': 1000,   // BOCCHICAT1000
'aec9091f68e1f1324e1ed9b8ccb6ce86a137a9b2c3440ea5d2fa83bb2fb70523': 1000,   // 09112024  
'a6670a5454af70c97e1fc2fc457af9521383055a257ba58ac549c5ccc7766a85': 200,    // VERSION9
'02d936b1e7ecebb010709ccc9b82509f092b98a89731dcf474829451dd627ee9': 13000,  // PAGO_QA
'fc4cbe30d1379fac9ba1cf923cc7e076f3d90a69a321fce8d683e1380077a7d8': 1200,   // FIX_REWARD_120426
'5c9808d0e5afe7cd0e5e19c64f438ebed38258f78d96f1a378a23726ba6ecbfc': 1000,   // SOLECITO
'ec029eed55db3414455e78c607816941e092595f65d3cdb9dbe63a81cdcd1b2c': 1000,   // LUNITA
'f28aab1b9b359e780d112664e9ff6dfd8cff51087b5f192d62635cc7f5b5342c': 6000,   // HACO260526
'2bf4c2eb61f4e85707f9e605286940f92a89d689dd9a17b777bfd674ecb46caf': 2000,   // HLSEPENM
'85b7e539867d4e35ff3ce361ffa570fb48e09eb49abdfe1b83887a96c8384260': 2800    // MIKU9X0L
};

// =====================================================
// UTILIDADES
// =====================================================

/**
 * Calcula el SHA-256 de un texto y devuelve el hash en hexadecimal.
 * Usa la API nativa crypto.subtle — disponible en todos los navegadores modernos.
 * @param {string} text
 * @returns {Promise<string>}
 */
async function sha256(text) {
    const buffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(text)
    );
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Crea una versión con debounce de una función.
 * Útil para controlar la frecuencia de operaciones costosas (buscador, resize).
 * @param {Function} fn    Función a debounce-ar.
 * @param {number}   delay Espera en ms antes de ejecutar (por defecto 300ms).
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
window.debounce = debounce; // Disponible globalmente para shop-logic.js

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
const DAILY_REPAIR_COST = 500;

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

function _getCurrentDailyTime() {
    return _readTimeCache();
}

function _getDailyRepairState() {
    const { time: now, verified, desynced } = _getCurrentDailyTime();
    const { lastClaim, streak } = store.daily;
    const diffDays = _getDailyDiffDays(now, lastClaim);
    return {
        now,
        verified,
        desynced,
        diffDays,
        repairAvailable: lastClaim > 0 && streak > 0 && diffDays === 2,
        repairCost: DAILY_REPAIR_COST,
        canAffordRepair: store.coins >= DAILY_REPAIR_COST
    };
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
// MIGRACIÓN SILENCIOSA
// Garantiza retrocompatibilidad con stores de versiones anteriores.
// Nunca sobrescribe datos existentes; solo rellena campos faltantes.
// =====================================================
/**
 * Normaliza estado persistido y aplica migraciones backward-compatible.
 *
 * Precondiciones: `loadedStore` puede venir incompleto o con schema legado.
 * Efectos secundarios: ninguno fuera del objeto retornado (función pura).
 * Coste esperado: O(p) sobre cantidad de propiedades/colecciones migradas.
 * Diseño (por qué): centralizar migración en un único punto reduce riesgo de
 * corrupción al agregar features y evita condicionales de versión dispersos.
 */
function migrateState(loadedStore) {
    const defaults = {
        coins:          CONFIG.initialCoins,
        progress:       { maze: [], wordsearch: [], secretWordsFound: [] },
        inventory:      {},
        redeemedHashes: [],   // v7.5: hashes SHA-256 de códigos canjeados
        history:        [],
        userAvatar:     null,
        theme:          'violet',
        daily:          { lastClaim: 0, streak: 0 },
        buffs:          { moonBlessingExpiry: 0 },
        claimed_milestones: [],
        // v9.4 — Identity
        nickname:       '',    // Máx. 15 chars. Vacío = primer acceso → flujo de bienvenida.
        gender:         '@',   // 'o' | 'a' | '@' — controla el sufijo del saludo.
    };

    const merged = { ...defaults, ...loadedStore };

    // Migración: lastDaily (string fecha) → daily.lastClaim (timestamp)
    if (merged.lastDaily && merged.daily.lastClaim === 0) {
        const lastDate = new Date(merged.lastDaily);
        if (!isNaN(lastDate.getTime())) {
            merged.daily = { lastClaim: lastDate.getTime(), streak: 1 };
        }
    }
    delete merged.lastDaily; // Eliminar campo legado

    // Asegurar sub-objetos faltantes
    if (!merged.daily   || typeof merged.daily !== 'object')  merged.daily = defaults.daily;
    if (!merged.buffs   || typeof merged.buffs !== 'object')  merged.buffs = defaults.buffs;
    if (!Array.isArray(merged.claimed_milestones))            merged.claimed_milestones = [];
    if (!Array.isArray(merged.redeemedHashes))  merged.redeemedHashes = [];
    if (!Array.isArray(merged.history))         merged.history = [];

    // v9.4 — Validación de identidad (migración silenciosa)
    if (typeof merged.nickname !== 'string')           merged.nickname = '';
    if (!['o', 'a', '@'].includes(merged.gender))      merged.gender   = '@';

    // v14.1 — Limpieza de legado: eliminar lista en texto plano ya obsoleta.
    if (Object.prototype.hasOwnProperty.call(merged, 'redeemedCodes')) {
        delete merged.redeemedCodes;
    }
    // v14.6 — Limpieza de legado: Misiones del Día ya no forma parte del store.
    if (Object.prototype.hasOwnProperty.call(merged, 'missions')) {
        delete merged.missions;
    }

    return merged;
}


// =====================================================
// STORE — Carga y fusión con migración automática
// =====================================================
let store = migrateState({});

try {
    const raw = localStorage.getItem(CONFIG.stateKey);
    if (raw) store = migrateState(JSON.parse(raw));
} catch (e) {
    console.error('GameCenter: Error al cargar estado', e);
    store = migrateState({});
}

// =====================================================
// ANIMACIÓN DE CONTADOR (requestAnimationFrame)
// =====================================================

/**
 * Anima el contador de monedas de `start` a `end` en `duration` ms usando
 * una curva ease-out cúbica, y escribe el valor en cada elemento del array.
 *
 * CONTRATO IMPORTANTE: esta función modifica `_displayedCoins` como efecto
 * secundario al terminar la animación. Cualquier llamada a `syncUI()` antes
 * de que termine la animación debe primero resetear `_displayedCoins` al
 * valor actual del store para que `animateValue` arranque desde el valor
 * correcto. Ver `GameCenter.syncUI()`.
 *
 * @param {HTMLElement[]} elements  Nodos cuyo `textContent` se actualiza en cada frame.
 * @param {number}        start     Valor inicial de la animación.
 * @param {number}        end       Valor final de la animación.
 * @param {number}        [duration=650] Duración en milisegundos.
 */
let _displayedCoins = store.coins;

function animateValue(elements, start, end, duration = 650) {
    if (!elements || !elements.length) return;
    if (start === end) { elements.forEach(el => el.textContent = end); return; }
    const range = end - start;
    const t0 = performance.now();
    const step = (now) => {
        const p     = Math.min((now - t0) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3); // ease-out cúbico
        elements.forEach(el => el.textContent = Math.round(start + range * eased));
        if (p < 1) requestAnimationFrame(step);
        else _displayedCoins = end;
    };
    requestAnimationFrame(step);
}

// =====================================================
// HISTORIAL DE TRANSACCIONES
// =====================================================
/**
 * Registra una transacción en store.history con formato estructurado.
 * @param {'ingreso'|'gasto'} tipo
 * @param {number}             cantidad
 * @param {string}             motivo
 */
function logTransaction(tipo, cantidad, motivo) {
    if (!Array.isArray(store.history)) store.history = [];
    store.history.push({ tipo, cantidad, motivo, fecha: Date.now() });
    // Limitar a las últimas 50 entradas para no inflar el localStorage
    if (store.history.length > 50) {
        store.history = store.history.slice(-50);
    }
}

const KB = 1024;
const AVATAR_MAX_LOCAL_KB = 100;
const AVATAR_CLEANUP_KB = 200;
const STORE_WARNING_KB = 4000;

function _isBase64Avatar(value) {
    return typeof value === 'string' && value.startsWith('data:image/');
}

function _trackAvatarStorageFallback(reason, meta = {}) {
    window.GhostAnalytics?.track(reason, {
        component: 'avatar_upload',
        ...meta
    });
}

function _dataUrlToBlob(dataUrl) {
    const [meta, base64] = String(dataUrl).split(',');
    if (!meta || !base64) throw new Error('Formato de imagen inválido.');
    const match = /data:(.*?);base64/.exec(meta);
    const mime = match?.[1] || 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

function _blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.readAsDataURL(blob);
    });
}

function compressImage(blob, maxWidth = 200, maxHeight = 200, quality = 0.7) {
    return new Promise((resolve, reject) => {
        try {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
                const width = Math.max(1, Math.round(img.width * scale));
                const height = Math.max(1, Math.round(img.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    URL.revokeObjectURL(url);
                    reject(new Error('No se pudo comprimir la imagen.'));
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((compressed) => {
                    URL.revokeObjectURL(url);
                    if (!compressed) {
                        reject(new Error('No se pudo comprimir la imagen.'));
                        return;
                    }
                    resolve(compressed);
                }, 'image/jpeg', quality);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('No se pudo procesar la imagen.'));
            };
            img.src = url;
        } catch (err) {
            reject(err);
        }
    });
}

function trimGameProgress() {
    if (!store.progress || typeof store.progress !== 'object') return false;
    let changed = false;
    Object.keys(store.progress).forEach((gameId) => {
        if (!Array.isArray(store.progress[gameId])) return;
        if (store.progress[gameId].length > 50) {
            store.progress[gameId] = store.progress[gameId].slice(-50);
            changed = true;
        }
    });
    return changed;
}

function _showStorageToast(message, type = 'warning') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
        toast.classList.remove('toast--visible');
        setTimeout(() => toast.remove(), 400);
    }, 5200);
}

function initInteractiveMicroFX() {
    const interactiveSelector = 'button, [role="button"], a[href], summary, .game-card, .shop-card, .gift-card, .avatar-container';
    const coarsePointerMql = window.matchMedia('(pointer: coarse)');
    const reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
    let coarsePointer = coarsePointerMql.matches;
    let reducedMotion = reducedMotionMql.matches;
    const _bindMediaChange = (mql, handler) => {
        if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler);
        else if (typeof mql.addListener === 'function') mql.addListener(handler);
    };
    _bindMediaChange(coarsePointerMql, (e) => { coarsePointer = e.matches; });
    _bindMediaChange(reducedMotionMql, (e) => { reducedMotion = e.matches; });
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    let activePressEl = null;

    document.querySelectorAll(interactiveSelector).forEach((el) => {
        el.classList.add('interactive-ripple');
    });

    const releasePress = () => {
        if (!activePressEl) return;
        activePressEl.classList.remove('is-pressing');
        activePressEl = null;
    };

    document.addEventListener('pointerdown', (event) => {
        const el = event.target.closest(interactiveSelector);
        if (!el) return;
        releasePress();
        activePressEl = el;
        if (!el.classList.contains('interactive-ripple')) {
            el.classList.add('interactive-ripple');
        }
        el.classList.add('ripple-active');
        el.classList.add('is-pressing');
        if (!reducedMotion && !coarsePointer) {
            const rect = el.getBoundingClientRect();
            el.style.setProperty('--tap-x', `${event.clientX - rect.left}px`);
            el.style.setProperty('--tap-y', `${event.clientY - rect.top}px`);
            el.classList.remove('is-rippling');
            requestAnimationFrame(() => el.classList.add('is-rippling'));
            setTimeout(() => {
                el.classList.remove('is-rippling');
                el.classList.remove('ripple-active');
            }, 430);
        } else {
            setTimeout(() => el.classList.remove('ripple-active'), 90);
        }
        if (isAndroid && _canUseVibration()) {
            navigator.vibrate(8);
        }
    }, { passive: true });

    document.addEventListener('pointerup', () => {
        releasePress();
    }, { passive: true });
    document.addEventListener('pointercancel', () => {
        releasePress();
    }, { passive: true });
    document.addEventListener('scroll', () => {
        releasePress();
    }, { passive: true });
}

function initLoadingStateObserver() {
    const loadingSelector = 'button[data-loading], [role="button"][data-loading]';
    const syncButtonState = (button) => {
        const isLoading = button.getAttribute('data-loading') === 'true';
        if (isLoading) {
            if (!button.dataset.lockedInlineSize) {
                button.dataset.lockedInlineSize = `${Math.ceil(button.getBoundingClientRect().width)}px`;
            }
            button.style.width = button.dataset.lockedInlineSize;
            button.setAttribute('aria-busy', 'true');
            button.disabled = true;
            return;
        }
        button.style.removeProperty('width');
        button.removeAttribute('aria-busy');
        button.disabled = false;
        delete button.dataset.lockedInlineSize;
    };

    document.querySelectorAll(loadingSelector).forEach(syncButtonState);

    const observer = new MutationObserver((records) => {
        records.forEach((record) => {
            if (!(record.target instanceof HTMLElement)) return;
            if (!record.target.matches(loadingSelector)) return;
            syncButtonState(record.target);
        });
    });

    observer.observe(document.body, {
        attributes: true,
        subtree: true,
        attributeFilter: ['data-loading']
    });
}

function emergencyCleanup() {
    let changed = false;

    if (_isBase64Avatar(store.userAvatar) && store.userAvatar.length > (AVATAR_CLEANUP_KB * KB)) {
        store.userAvatar = null;
        changed = true;
    }

    if (Array.isArray(store.history) && store.history.length > 30) {
        store.history = store.history.slice(-30);
        changed = true;
    }

    if (Object.prototype.hasOwnProperty.call(store, 'redeemedCodes')) {
        delete store.redeemedCodes;
        changed = true;
    }

    if (trimGameProgress()) changed = true;

    const serialized = JSON.stringify(store);
    if (serialized.length > (4 * 1024 * 1024) && Array.isArray(store.history) && store.history.length) {
        store.history = [];
        changed = true;
    }

    return changed;
}

function checkStorageSize(precomputedLength) {
    try {
        const sizeKB = (precomputedLength ?? JSON.stringify(store).length) / KB;
        if (sizeKB > STORE_WARNING_KB) {
            window.GhostAnalytics?.track('storage_warning', { size_kb: Math.round(sizeKB) });
            _showStorageToast(
                'Tu progreso está cerca del límite de almacenamiento. Exporta tu partida y contacta soporte.',
                'warning'
            );
            return sizeKB;
        }
        return sizeKB;
    } catch (_) {
        return 0;
    }
}

async function _saveAvatarLocally(dataUrl) {
    const sourceBlob = _dataUrlToBlob(dataUrl);
    const compressed = await compressImage(sourceBlob, 200, 200, 0.7);
    const finalDataUrl = await _blobToDataUrl(compressed);
    const sizeKB = finalDataUrl.length / KB;
    if (sizeKB > AVATAR_MAX_LOCAL_KB) {
        throw new Error('Imagen demasiado grande. Usa una foto de menos de 100 KB.');
    }
    store.userAvatar = finalDataUrl;
    saveState({ immediateCloudSync: true });
    applyAvatar();
}

async function _uploadAvatarBlobToCloud(sourceBlob, { userId, sbClient, bucket = 'avatars' }) {
    const path = `${userId}/profile.jpg`;
    const compressed = await compressImage(sourceBlob, 200, 200, 0.7);
    const { error: uploadError } = await sbClient
        .storage
        .from(bucket)
        .upload(path, compressed, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'image/jpeg'
        });
    if (uploadError) throw uploadError;

    const { data } = sbClient.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error('No se pudo generar URL pública del avatar.');

    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
    store.userAvatar = publicUrl;
    saveState({ immediateCloudSync: true });
    applyAvatar();
    return { path, publicUrl: data.publicUrl, cacheBustedUrl: publicUrl };
}

// =====================================================
// API PÚBLICA — window.GameCenter
// =====================================================
window.GameCenter = {

    // ── JUEGOS ──────────────────────────────────────────────────────────────

    /**
     * Registra un nivel completado y otorga la recompensa indicada.
     * Es idempotente: si el levelId ya fue registrado, no vuelve a pagar.
     */
    completeLevel: (gameId, levelId, rewardAmount) => {
        if (!store.progress[gameId]) store.progress[gameId] = [];
        if (store.progress[gameId].includes(levelId)) {
            return { paid: false, coins: store.coins };
        }
        store.progress[gameId].push(levelId);

        store.coins += rewardAmount;
        logTransaction('ingreso', rewardAmount, `Nivel ${levelId} completado · ${gameId}`);
        saveState({ immediateCloudSync: true });

        // Flag de sesión volátil para desbloqueos "Regalos" en tienda.
        window.__laSessionGameCompleted = true;
        try { sessionStorage.setItem('la_session_game_completed', '1'); } catch (_) { /* noop */ }

        // [v11.0] Notificar a módulos desacoplados tras el pago exitoso.
        document.dispatchEvent(new CustomEvent('la:levelcomplete', {
            detail: { gameId, levelId, reward: rewardAmount }
        }));

        return { paid: true, coins: store.coins };
    },

    // ── TIENDA ───────────────────────────────────────────────────────────────

    buyItem: (itemData) => {
        const bought = store.inventory[itemData.id] || 0;
        if (bought > 0) return { success: false, reason: 'owned' };

        const finalPrice = ECONOMY.isSaleActive
            ? Math.floor(itemData.price * ECONOMY.saleMultiplier)
            : itemData.price;

        if (store.coins < finalPrice) {
            // [v9.9.2] Fricción de usuario: intento de compra sin saldo suficiente.
            // Ayuda a detectar precios demasiado elevados o HUD de saldo poco claro.
            window.GhostAnalytics?.track('insufficient_funds', {
                wallpaper: itemData.name,
                precio:    `${finalPrice} ⭐`,
                saldo:     store.coins
            });
            return { success: false, reason: 'coins' };
        }

        const cashback = Math.floor(finalPrice * ECONOMY.cashbackRate);

        store.coins -= finalPrice;
        store.coins += cashback;
        store.inventory[itemData.id] = bought + 1;

        logTransaction('gasto',   finalPrice, `Compra: ${itemData.name}`);
        if (cashback > 0) {
            logTransaction('ingreso', cashback, `Cashback: ${itemData.name}`);
        }

        saveState({ immediateCloudSync: true });
        return { success: true, finalPrice, cashback };
    },

    /**
     * Deduce monedas del saldo directamente.
     * Usado por el Gachapón Relámpago (event-logic.js) para cobrar el costo
     * de giro sin pasar por buyItem(), que requiere un catálogo de ítem.
     * No registra en store.progress ni invalida idempotencia de completeLevel().
     * @param {number} amount  Cantidad entera positiva a deducir.
     * @param {string} [motivo]  Descripción para el historial.
     * @returns {{ success: boolean, coins: number }}
     */
    spendCoins: (amount, motivo = 'Gasto directo') => {
        const n = Math.floor(amount);
        if (!Number.isFinite(n) || n <= 0) return { success: false, coins: store.coins };
        if (store.coins < n) return { success: false, reason: 'insufficient', coins: store.coins };
        store.coins -= n;
        logTransaction('gasto', n, motivo);
        saveState({ immediateCloudSync: true });
        return { success: true, coins: store.coins };
    },

    getBoughtCount: (id) => store.inventory[id] || 0,
    getBalance:     ()   => store.coins,
    getInventory:   ()   => ({ ...store.inventory }),

    // ── v11.0 — ECONOMÍA DIRECTA ──────────────────────────────────────────────

    /**
     * Deposita monedas directamente en el saldo sin pasar por completeLevel().
     * Usado por la Cacería de Tesoros y el Gachapón Relámpago (event-logic.js).
     * No despacha 'la:levelcomplete'.
     * @param {number} amount  Cantidad entera positiva de monedas a añadir.
     * @param {string} [motivo] Descripción para el historial de transacciones.
     * @returns {{ success: boolean, coins: number }}
     */
    addCoins: (amount, motivo = 'Depósito directo') => {
        const n = Math.floor(amount);
        if (!Number.isFinite(n) || n <= 0) return { success: false, coins: store.coins };
        store.coins += n;
        logTransaction('ingreso', n, motivo);
        saveState({ immediateCloudSync: true });
        return { success: true, coins: store.coins };
    },

    /**
     * Devuelve el número de códigos promocionales ya canjeados.
     * Usado por el user_snapshot de shop-logic.js para enriquecer la
     * instantánea de sesión sin exponer el array completo de hashes.
     * @returns {number}
     */
    getRedeemedCount: () => (store.redeemedHashes || []).length,

    getDownloadUrl: (itemId, fileName) => {
        if (!fileName) return null;
        if ((store.inventory[itemId] || 0) === 0) return null;
        // Strip file extension — Cloudinary download URL uses the base public ID
        // without extension or transformation parameters so the original master
        // file is served (no crop, no resize, no format override).
        const base = fileName.replace(/\.[^.]+$/, '');
        return CONFIG.wallpapersPath + base;
    },


    // ── HISTORIAL ────────────────────────────────────────────────────────────

    /**
     * Devuelve el historial de transacciones en orden cronológico inverso
     * (la más reciente primero).
     */
    getHistory: () => [...(store.history || [])].reverse(),

    // ── CÓDIGOS PROMO (async — SHA-256) ──────────────────────────────────────

    /**
     * Canjea un código promocional.
     * El código se hashea en el cliente antes de compararlo; el texto plano
     * nunca se almacena ni se compara directamente, protegiendo los códigos
     * de una lectura trivial en DevTools.
     * @returns {Promise<{success: boolean, reward?: number, message: string}>}
     */
    redeemPromoCode: async (inputCode) => {
        const code = inputCode.trim().toUpperCase();
        const hash = await sha256(code);

        const reward = PROMO_CODES_HASHED[hash];
        if (!reward) return { success: false, message: 'Código inválido' };

        if (store.redeemedHashes.includes(hash)) {
            return { success: false, message: 'Ya canjeaste este código' };
        }

        store.coins += reward;
        store.redeemedHashes.push(hash);
        logTransaction('ingreso', reward, `Código canjeado`);
        saveState();

        // [v9.9.2] track('redeem_code') fue movido a handleRedeem() en shop-logic.js
        // para que el disparo ocurra UNA SOLA VEZ, al final de la cadena de éxito
        // de UI. No se trackea aquí para evitar el doble reporte.

        return { success: true, reward, message: `¡+${reward} Monedas!` };
    },

    // ── BONO DIARIO CON RACHA ────────────────────────────────────────────────

    /**
     * Reclama el bono diario. Función async — consulta una API de tiempo externa
     * como fuente de verdad antes de evaluar el reclamo.
     *
     * Lógica de días calendario (v8.1+):
     *   diff_días == 0 → ya reclamado hoy.
     *   diff_días == 1 → racha continúa (streak + 1).
     *   diff_días  > 1 → racha se reinicia (streak = 1).
     *
     * Seguridad (v9.6 — Background Sync):
     *   El tiempo de red se verifica en segundo plano (_syncTimeBackground),
     *   no en el momento del reclamo. claimDaily() lee el caché sincrónico
     *   (_readTimeCache) y no hace ninguna petición de red, garantizando
     *   respuesta instantánea en todos los casos.
     *
     *   - currentTime < lastClaimTime → salto negativo; bloquear sin tocar racha.
     *   - caché desynced: true → reloj adelantado detectado en el último sync; bloquear.
     *   - caché expirado o inexistente → permitir (primera visita o sin conexión reciente).
     *
     * @returns {{ success: boolean, reward?: number, baseReward?: number,
     *             moonBonus?: number, streak?: number, verified: boolean, message: string }}
     */
    claimDaily: () => {
        const { time: now, verified, desynced } = _readTimeCache();
        const { lastClaim, streak } = store.daily;

        // ── 1. Salto negativo (manipulación de reloj detectada por el caché) ──
        if (lastClaim > 0 && now < lastClaim) {
            return {
                success:  false,
                verified,
                message:  'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.'
            };
        }

        // ── 2. Reloj adelantado detectado en el último sync en background ──
        if (desynced) {
            return {
                success:  false,
                verified,
                message:  'Reloj desincronizado. Verifica la hora de tu dispositivo e inténtalo de nuevo.'
            };
        }

        // ── 3. Cálculo de días calendario (normalizar a medianoche) ──
        const diffDays = _getDailyDiffDays(now, lastClaim);

        if (diffDays === 0) {
            return {
                success:  false,
                verified,
                message:  '¡Ya reclamaste tu bono hoy! Vuelve mañana.'
            };
        }

        if (diffDays === 2 && lastClaim > 0 && streak > 0) {
            return {
                success: false,
                repairRequired: true,
                repairCost: DAILY_REPAIR_COST,
                canAffordRepair: store.coins >= DAILY_REPAIR_COST,
                streak,
                verified,
                message: store.coins >= DAILY_REPAIR_COST
                    ? `Puedes reparar tu racha de ${streak} día${streak !== 1 ? 's' : ''}.`
                    : 'Consigue las monedas que faltan jugando en el Arcade.'
            };
        }

        // ── 4. Calcular nueva racha ──
        const newStreak = diffDays === 1 ? streak + 1 : 1;

        const baseReward = Math.min(
            CONFIG.dailyReward + (newStreak - 1) * CONFIG.dailyStreakStep,
            CONFIG.dailyStreakCap
        );

        // ── 5. Bendición Lunar ──────────────────────────────────────────────
        // Se concede siempre que el buff esté activo. El único escenario donde
        // podría abusarse (offline + reloj adelantado) queda cubierto por la
        // detección de desynced en el sync anterior. Sin conexión genuina el
        // usuario tampoco puede comprar la Bendición Lunar, por lo que el
        // riesgo neto es despreciable.
        const moonActive  = store.buffs.moonBlessingExpiry > now;
        const moonBonus   = moonActive ? 90 : 0;
        const totalReward = baseReward + moonBonus;

        // ── 6. Aplicar y persistir ──
        store.coins += totalReward;
        store.daily  = { lastClaim: now, streak: newStreak };

        logTransaction(
            'ingreso',
            totalReward,
            `Bono diario · racha ${newStreak}` + (moonBonus ? ' + Bendición Lunar' : '')
        );

        saveState();
        updateMoonBlessingUI();

        // [v9.9.2] Analítica — daily_bonus: solo en éxito para no saturar el canal.
        // Registra cuánto ganó el usuario y si la Bendición Lunar contribuyó,
        // lo que permite detectar días de mayor actividad y valor del buff.
        window.GhostAnalytics?.track('daily_bonus', {
            recompensa:   totalReward,
            base:         baseReward,
            luna:         moonBonus > 0 ? `+${moonBonus}` : 'no',
            racha:        newStreak
        });

        return {
            success:    true,
            reward:     totalReward,
            baseReward,
            moonBonus,
            streak:     newStreak,
            verified,
            message:    `¡+${totalReward} monedas! Racha: ${newStreak} día${newStreak !== 1 ? 's' : ''}`
        };
    },

    repairDailyStreak: () => {
        const state = _getDailyRepairState();
        const { lastClaim, streak } = store.daily;

        if (lastClaim > 0 && state.now < lastClaim) {
            return { success: false, verified: state.verified, message: 'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.' };
        }
        if (state.desynced) {
            return { success: false, verified: state.verified, message: 'Reloj desincronizado. Verifica la hora de tu dispositivo e inténtalo de nuevo.' };
        }
        if (!state.repairAvailable) {
            return { success: false, verified: state.verified, message: 'La reparación de racha no está disponible ahora.' };
        }
        if (store.coins < DAILY_REPAIR_COST) {
            return { success: false, repairRequired: true, verified: state.verified, message: 'Consigue las monedas que faltan jugando en el Arcade.' };
        }

        store.coins -= DAILY_REPAIR_COST;
        store.daily = { lastClaim: state.now, streak };
        logTransaction('gasto', DAILY_REPAIR_COST, `Reparación de racha · ${streak} días`);
        saveState({ immediateCloudSync: true });
        window.GhostAnalytics?.track('daily_streak_repair', { costo: DAILY_REPAIR_COST, racha: streak });
        return { success: true, verified: state.verified, cost: DAILY_REPAIR_COST, streak, message: `Racha de ${streak} día${streak !== 1 ? 's' : ''} rescatada por ${DAILY_REPAIR_COST} monedas.` };
    },

    /**
     * Comprueba si el usuario puede reclamar el bono diario.
     * Usa el reloj local para la UI (sin coste de red); la validación real
     * con tiempo de red ocurre dentro de claimDaily().
     * Lógica: el bono está disponible si hoy (medianoche) > último reclamo (medianoche).
     *
     * @returns {boolean}
     */
    getNextDailyResetTime: (now = Date.now()) => _getNextDailyResetTime(now),

    canClaimDaily: () => {
        const { lastClaim } = store.daily;
        if (lastClaim === 0) return true;
        const state = _getDailyRepairState();
        if (state.desynced) return false;
        const diffDays = state.diffDays;
        return diffDays >= 1;
    },

    /**
     * Devuelve información sobre el estado de la racha actual.
     * Usa días calendario (medianoche) para consistencia con claimDaily().
     */
    getStreakInfo: () => {
        const { lastClaim, streak } = store.daily;
        const repairState = _getDailyRepairState();
        const diffDays = repairState.diffDays;

        const nextStreak = diffDays === 1 ? streak + 1 : 1;

        const nextReward = Math.min(
            CONFIG.dailyReward + (nextStreak - 1) * CONFIG.dailyStreakStep,
            CONFIG.dailyStreakCap
        );
        return {
            streak,
            nextReward,
            canClaim:     diffDays >= 1 && !repairState.desynced,
            repairAvailable: repairState.repairAvailable,
            repairCost: DAILY_REPAIR_COST,
            canAffordRepair: repairState.canAffordRepair
        };
    },

    // ── BENDICIÓN LUNAR ──────────────────────────────────────────────────────

    /**
     * Activa (o extiende) la Bendición Lunar. Costo: 100 monedas.
     * Efecto: +90 monedas extra por cada reclamo diario.
     * Vigencia: 7 días. Si ya está activa, extiende desde el vencimiento actual.
     */
    buyMoonBlessing: () => {
        const COST = 100;
        const DURATION = 7 * 86_400_000; // 7 días en ms

        if (store.coins < COST) {
            // [v9.9.2] Fricción de usuario: saldo insuficiente para activar el buff.
            window.GhostAnalytics?.track('insufficient_funds', {
                wallpaper: 'Bendición Lunar (buff)',
                precio:    `${COST} ⭐`,
                saldo:     store.coins
            });
            return { success: false, reason: 'coins' };
        }

        const now = Date.now();
        const isActive = store.buffs.moonBlessingExpiry > now;
        store.coins -= COST;
        store.buffs.moonBlessingExpiry = (isActive
            ? store.buffs.moonBlessingExpiry
            : now
        ) + DURATION;

        logTransaction('gasto', COST, 'Bendición Lunar activada (7 días)');
        saveState();
        updateMoonBlessingUI();

        const expiresAt = new Date(store.buffs.moonBlessingExpiry).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric'
        });

        return { success: true, expiresAt };
    },

    /**
     * Extiende la Bendición Lunar una cantidad de días, sin costo.
     * Si no está activa, inicia desde "ahora".
     * @param {number} days
     * @param {string} motivo
     * @returns {{ success: boolean, expiresAt?: string }}
     */
    extendMoonBlessingDays: (days, motivo = 'Extensión de Bendición Lunar') => {
        const wholeDays = Math.floor(days);
        if (!Number.isFinite(wholeDays) || wholeDays <= 0) {
            return { success: false };
        }
        const now = Date.now();
        const baseTs = store.buffs.moonBlessingExpiry > now
            ? store.buffs.moonBlessingExpiry
            : now;
        store.buffs.moonBlessingExpiry = baseTs + (wholeDays * 86_400_000);
        logTransaction('ingreso', 0, `${motivo}: +${wholeDays} día(s)`);
        saveState({ immediateCloudSync: true });
        return {
            success: true,
            expiresAt: new Date(store.buffs.moonBlessingExpiry).toLocaleDateString('es-MX', {
                day: '2-digit', month: 'long', year: 'numeric'
            })
        };
    },

    /**
     * Devuelve los IDs de hitos de racha ya reclamados.
     * @returns {string[]}
     */
    getClaimedMilestones: () => [...(store.claimed_milestones || [])],

    /**
     * Reclama un hito de racha una sola vez por ID.
     * Aplica las recompensas de forma síncrona en memoria antes de cerrar modal.
     * @param {{ id: string, rewards: Array<{type:string, amount:number}> }} milestone
     * @returns {{ success: boolean, reason?: string }}
     */
    claimStreakMilestone: (milestone) => {
        if (!milestone?.id || !Array.isArray(milestone.rewards)) {
            return { success: false, reason: 'invalid_milestone' };
        }

        if (!Array.isArray(store.claimed_milestones)) {
            store.claimed_milestones = [];
        }
        if (store.claimed_milestones.includes(milestone.id)) {
            return { success: false, reason: 'already_claimed' };
        }

        let coinReward = 0;
        let moonDays = 0;
        milestone.rewards.forEach((reward) => {
            const amount = Math.floor(reward?.amount || 0);
            if (amount <= 0) return;
            if (reward.type === 'coins') {
                coinReward += amount;
            } else if (reward.type === 'moon_blessing_days') {
                moonDays += amount;
            }
        });

        if (coinReward > 0) {
            window.GameCenter.addCoins(coinReward, `Hito de racha: ${milestone.id}`);
        }
        if (moonDays > 0) {
            window.GameCenter.extendMoonBlessingDays(moonDays, `Hito de racha: ${milestone.id}`);
        }

        store.claimed_milestones.push(milestone.id);
        saveState({ immediateCloudSync: true });

        window.GhostAnalytics?.track('streak_milestone_claimed', {
            milestone_id: milestone.id,
            threshold: milestone.threshold || 0,
            coins: coinReward,
            moon_days: moonDays
        });
        return { success: true };
    },

    getMoonBlessingStatus: () => {
        const now    = Date.now();
        const expiry = store.buffs.moonBlessingExpiry;
        const active = expiry > now;
        return {
            active,
            expiresAt: active
                ? new Date(expiry).toLocaleDateString('es-MX', {
                      day: '2-digit', month: 'long', year: 'numeric'
                  })
                : null,
            remainingMs: active ? expiry - now : 0
        };
    },

    // ── SINCRONIZACIÓN (async — Worker + Checksum) ───────────────────────────

    /**
     * Genera un código de exportación con checksum de integridad.
     * La operación pesada se delega al Web Worker cuando está disponible.
     */
    exportSave: async () => {
        try {
            const result = await workerTask({ action: 'export', store, salt: SYNC_SALT });
            return result;
        } catch (_) {
            // Fallback síncrono si el worker no está disponible
        }
        // Fallback: operación en hilo principal
        // TextEncoder convierte el payload UTF-8 a bytes, luego btoa codifica en Base64.
        // Reemplaza el patrón obsoleto btoa(unescape(encodeURIComponent())) que usa
        // funciones deprecadas en motores modernos.
        const json     = JSON.stringify(store);
        const checksum = await sha256(json + SYNC_SALT);
        const payload  = JSON.stringify({ data: store, checksum });
        try {
            const bytes  = new TextEncoder().encode(payload);
            const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
            return btoa(binary);
        } catch { return null; }
    },

    /**
     * Importa un código de partida validando su checksum antes de aplicarlo.
     * Si el checksum no coincide, la importación es rechazada para prevenir
     * manipulación manual del saldo.
     */
    importSave: async (code) => {
        try {
            let data;
            try {
                const result = await workerTask({ action: 'import', code, salt: SYNC_SALT });
                if (!result.valid) {
                    return {
                        success: false,
                        message: 'El código fue modificado manualmente. Importación rechazada por integridad.'
                    };
                }
                data = result.data;
            } catch (_) {
                // Fallback sin worker — operación en hilo principal con TextDecoder
                // (reemplaza escape()/unescape() que están deprecados en todos los motores modernos)
                const raw     = atob(code.trim());
                const bytes   = Uint8Array.from(raw, c => c.charCodeAt(0));
                const json    = new TextDecoder().decode(bytes);
                const payload = JSON.parse(json);
                if (payload.checksum && payload.data) {
                    const expected = await sha256(JSON.stringify(payload.data) + SYNC_SALT);
                    if (payload.checksum !== expected) {
                        return {
                            success: false,
                            message: 'El código fue modificado manualmente. Importación rechazada.'
                        };
                    }
                    data = payload.data;
                } else {
                    // Formato legado v7.2
                    data = payload;
                }
            }

            if (typeof data.coins !== 'number') throw new Error('invalid');
            store = migrateState(data);
            saveState();
            return { success: true };
        } catch {
            return { success: false, message: 'Código inválido o corrupto.' };
        }
    },

    // ── AVATAR ───────────────────────────────────────────────────────────────

    setAvatar: async (dataUrl) => {
        const session = window.Sentinel?.getSession?.();
        const sbClient = window.Sentinel?.getClient?.();
        const userId = session?.user?.id;
        const bucket = 'avatars';

        if (session && sbClient && userId) {
            const path = `${userId}/profile.jpg`;
            try {
                const { data: authData, error: authError } = await sbClient.auth.getSession();
                if (authError) throw authError;
                const freshSession = authData?.session;
                if (!freshSession?.access_token) {
                    _trackAvatarStorageFallback('storage_no_session', { user_id: userId, bucket, path });
                    console.error('[GameCenter] Avatar cloud upload cancelado por sesión ausente/expirada:', {
                        hasSession: false,
                        userId,
                        path,
                        bucket,
                        message: 'Missing access token',
                        statusCode: null
                    });
                    await _saveAvatarLocally(dataUrl);
                    return { success: true, remote: false, reason: 'storage_no_session' };
                }

                const sourceBlob = _dataUrlToBlob(dataUrl);
                const { publicUrl } = await _uploadAvatarBlobToCloud(sourceBlob, { userId, sbClient, bucket });
                return { success: true, remote: true, url: publicUrl };
            } catch (err) {
                const statusCode = err?.statusCode || err?.status || null;
                const message = err?.message || String(err);
                const fallbackReason = Number(statusCode) === 403
                    ? 'storage_forbidden_rls'
                    : 'storage_network';
                _trackAvatarStorageFallback(fallbackReason, { user_id: userId, bucket, path, status_code: statusCode });
                console.error('[GameCenter] Error detallado al subir avatar a Supabase Storage:', {
                    hasSession: Boolean(session),
                    userId,
                    path,
                    bucket,
                    message,
                    name: err?.name || 'StorageError',
                    statusCode,
                    details: err?.details || null,
                    hint: err?.hint || null
                });
                console.warn('[GameCenter] Avatar cloud upload falló, usando fallback local:', message);
            }
        }

        await _saveAvatarLocally(dataUrl);
        return { success: true, remote: false };
    },

    /**
     * Guarda un avatar predefinido. Con sesión activa lo sube a Supabase
     * Storage igual que una foto personalizada, para que Sentinel persista
     * una URL remota en user_profiles.avatar_url y el avatar viaje entre
     * dispositivos. Sin sesión mantiene el fallback local empaquetado.
     * @param {string} assetPath Ruta local aprobada bajo assets/avatar/.
     */
    setAvatarPath: async (assetPath) => {
        const normalized = String(assetPath || '').trim().replace(/^\/+/, '');
        if (!/^assets\/avatar\/[\w./-]+\.(?:avif|webp|png|jpg|jpeg|svg)$/i.test(normalized)) {
            throw new Error('Avatar local no permitido.');
        }

        const session = window.Sentinel?.getSession?.();
        const sbClient = window.Sentinel?.getClient?.();
        const userId = session?.user?.id;
        const bucket = 'avatars';

        if (session && sbClient && userId) {
            const path = `${userId}/profile.jpg`;
            try {
                const { data: authData, error: authError } = await sbClient.auth.getSession();
                if (authError) throw authError;
                const freshSession = authData?.session;
                if (!freshSession?.access_token) {
                    _trackAvatarStorageFallback('storage_no_session', { user_id: userId, bucket, path, preset: true });
                    throw new Error('Missing access token');
                }

                const response = await fetch(normalized, { cache: 'no-cache' });
                if (!response.ok) throw new Error(`No se pudo cargar el avatar predefinido (${response.status}).`);
                const sourceBlob = await response.blob();
                const { publicUrl } = await _uploadAvatarBlobToCloud(sourceBlob, { userId, sbClient, bucket });
                return { success: true, remote: true, preset: true, url: publicUrl };
            } catch (err) {
                const statusCode = err?.statusCode || err?.status || null;
                const fallbackReason = Number(statusCode) === 403
                    ? 'storage_forbidden_rls'
                    : 'storage_network';
                _trackAvatarStorageFallback(fallbackReason, { user_id: userId, bucket, path, preset: true, status_code: statusCode });
                console.warn('[GameCenter] Avatar predefinido no pudo subirse a Supabase; usando fallback local:', err?.message || String(err));
            }
        }

        store.userAvatar = normalized;
        saveState({ immediateCloudSync: true });
        applyAvatar();
        return { success: true, remote: false, preset: true, url: normalized };
    },
    getAvatar: ()        => store.userAvatar,

    // ── TEMA ─────────────────────────────────────────────────────────────────

    setTheme: (key) => {
        if (!THEMES[key]) return;
        store.theme = key;
        saveState();
        applyTheme(key);
    },
    getTheme: () => store.theme || 'violet',

    // ── IDENTIDAD — v9.4 ─────────────────────────────────────────────────────

    /**
     * Guarda el nickname y género elegidos por el usuario y actualiza el DOM.
     * @param {string} nickname  Nombre a mostrar (max 15 chars, se recorta).
     * @param {'o'|'a'|'@'} gender  Sufijo del saludo.
     */
    setIdentity: (nickname, gender) => {
        const VALID_GENDERS = ['o', 'a', '@'];
        store.nickname = String(nickname).trim().slice(0, 15);
        store.gender   = VALID_GENDERS.includes(gender) ? gender : '@';
        saveState();
        applyIdentity();
    },

    /** @returns {{ nickname: string, gender: 'o'|'a'|'@' }} */
    getIdentity: () => ({
        nickname: store.nickname || '',
        gender:   store.gender   || '@'
    }),

    /** @returns {boolean} true si el usuario ya eligió un nickname. */
    hasIdentity: () => Boolean(store.nickname?.trim()),

    // ── SPA / MÓDULOS EXTERNOS ────────────────────────────────────────────────

    /**
     * Devuelve una lectura segura (sin referencia) del estado público del store.
     * Usado por shop-logic.js (renderStreakCalendar) y spa-router.js.
     * No expone el objeto store completo para evitar mutaciones externas.
     * @returns {{ coins: number, streak: number, theme: string, moonBlessingExpiry: number, nickname: string, gender: string }}
     */
    getState: () => ({
        coins:               store.coins,
        streak:              store.daily?.streak || 0,
        theme:               store.theme || 'violet',
        moonBlessingExpiry:  store.buffs?.moonBlessingExpiry || 0,
        nickname:            store.nickname || '',
        gender:              store.gender   || '@'
    }),

    /**
     * Sincroniza el chrome compartido y, opcionalmente, una vista SPA concreta.
     * Llamado por spa-router.js al navegar para evitar consultar los nodos de
     * vistas ocultas. Sin `scope` conserva la sincronización global.
     *
     * @param {HTMLElement} [scope] Contenedor de la vista actualmente visible.
     */
    syncUI: (scope) => {
        _displayedCoins = store.coins;
        updateUI({ scope });
    }
};

// =====================================================
// MAIL HELPER — Utilidades mailto: (sin backend)
// =====================================================

/** Clave de localStorage exclusiva para el último correo utilizado.
 *  Separada del store del juego para no contaminar exportaciones/checksums. */
const MAIL_RECIPIENT_KEY = 'love_arcade_last_recipient';

/** Umbral de caracteres a partir del cual el mailto: puede truncarse
 *  en algunos clientes de correo (RFC 2368 / límite práctico). */
const MAILTO_MAX_LENGTH = 1800;

/**
 * Regex de validación de correo electrónico (sintáctica básica, FR3).
 * No pretende cubrir toda la RFC 5322; cubre el 99 % de los casos reales.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida si la cadena tiene forma de correo electrónico válido.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
    return EMAIL_REGEX.test(email.trim());
}

/**
 * Persiste el último correo utilizado en localStorage (FR6 / guardado explícito
 * tras acción del usuario de confirmar el envío).
 * @param {string} email
 */
function saveLastMailRecipient(email) {
    try { localStorage.setItem(MAIL_RECIPIENT_KEY, email.trim()); }
    catch (_) { /* localStorage lleno — ignorar silenciosamente */ }
}

/**
 * Recupera el último correo guardado para pre-rellenar el campo (FR spec).
 * @returns {string}  Correo guardado, o cadena vacía si no hay ninguno.
 */
function getLastMailRecipient() {
    try { return localStorage.getItem(MAIL_RECIPIENT_KEY) || ''; }
    catch (_) { return ''; }
}

/**
 * Construye un URI mailto: con los campos To, Subject y Body codificados.
 * Todos los valores se pasan por encodeURIComponent para evitar inyecciones (FR4).
 *
 * @param {{ name: string, tags?: string[] }} item    Metadatos del wallpaper.
 * @param {string} absoluteUrl  URL absoluta de descarga (construida en la UI).
 * @param {string} email        Correo destino ya validado.
 * @returns {{ uri: string, tooLong: boolean }}
 */
function buildMailtoLink(item, absoluteUrl, email) {
    const tags = Array.isArray(item.tags) ? item.tags : [];
    const tipo = tags.includes('Sticker')
        ? 'Sticker'
        : tags.includes('Mobile')
            ? 'Wallpaper Mobile'
            : 'Wallpaper PC';

    const subject = encodeURIComponent(`Tu ${tipo} de Love Arcade: ${item.name}`);

    const bodyRaw =
        `¡Hola!\n\n` +
        `Aquí está tu wallpaper de Love Arcade: "${item.name}".\n\n` +
        `Enlace de descarga:\n${absoluteUrl}\n\n` +
        `Instrucciones:\n` +
        `Abre este enlace en tu PC o dispositivo para descargar el archivo.\n` +
        `Si el enlace no funciona directamente, cópialo y pégalo en tu navegador.\n\n` +
        `— Love Arcade`;

    const body = encodeURIComponent(bodyRaw);
    const uri  = `mailto:${encodeURIComponent(email.trim())}?subject=${subject}&body=${body}`;

    return { uri, tooLong: uri.length > MAILTO_MAX_LENGTH };
}

/**
 * Intenta copiar un texto al portapapeles.
 * Usa la Clipboard API moderna con fallback a execCommand.
 * @param {string} text
 * @returns {Promise<boolean>}  true si tuvo éxito.
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (_) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            Object.assign(ta.style, { position: 'fixed', opacity: '0', top: '0', left: '0' });
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch (_2) {
            return false;
        }
    }
}

/** API pública del módulo de correo. */
window.MailHelper = {
    isValidEmail,
    saveLastMailRecipient,
    getLastMailRecipient,
    buildMailtoLink,
    copyToClipboard
};

// =====================================================
// FUNCIONES INTERNAS
// =====================================================

let _pendingSyncRetries = 0;
let _cloudSyncRetryTimer = null;
let _deferredUIFrame = null;
let _deferredCloudSyncHandle = null;
let _pendingDeferredCloudSync = false;
const MAX_SYNC_RETRIES = 3;
const SYNC_RETRY_DELAY = 500;

/**
 * Deja que el navegador pinte el feedback de una mutación antes de recorrer
 * el DOM completo. Varias escrituras dentro del mismo frame se coalescen para
 * que updateUI() siempre lea el estado más reciente una sola vez.
 */
function _scheduleUIUpdate() {
    if (_deferredUIFrame !== null) return;
    _deferredUIFrame = requestAnimationFrame(() => {
        _deferredUIFrame = null;
        updateUI();
    });
}

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

function saveState(options = {}) {
    const { immediateCloudSync = false } = options;
    let payload = JSON.stringify(store);
    if (payload.length > (STORE_WARNING_KB * KB)) {
        trimGameProgress();
        payload = JSON.stringify(store);
    }

    try {
        localStorage.setItem(CONFIG.stateKey, payload);
    } catch (e) {
        if (e?.name === 'QuotaExceededError') {
            const changed = emergencyCleanup();
            try {
                payload = JSON.stringify(store);
                localStorage.setItem(CONFIG.stateKey, payload);
                window.GhostAnalytics?.track('storage_cleaned', {
                    reason: 'quota_exceeded',
                    cleaned: changed
                });
            } catch (retryError) {
                console.error('GameCenter: No se pudo guardar estado tras cleanup', retryError);
                _showStorageToast(
                    'No se puede guardar el progreso. Exporta tu partida y borra datos del sitio.',
                    'error'
                );
                if (Array.isArray(store.history) && store.history.length) {
                    store.history = [];
                    try {
                        localStorage.setItem(CONFIG.stateKey, JSON.stringify(store));
                    } catch (_) {}
                }
                return;
            }
        } else {
            throw e;
        }
    }

    _scheduleUIUpdate();
    _scheduleCloudSync(immediateCloudSync);
    checkStorageSize(payload.length);
}

/**
 * Formatea un número de monedas para la Navbar.
 * < 10 000 → número completo (ej: 9 500 → "9500")
 * ≥ 10 000 → formato "k" con un decimal si aplica (ej: 25 500 → "25.5k", 20 000 → "20k")
 * El Player Hub siempre recibe el número exacto; esta función es solo para .navbar .coin-display.
 * @param {number} n
 * @returns {string}
 */
function formatCoinsNavbar(n) {
    if (n < 10_000) return String(n);
    const k = n / 1000;
    // Usar un decimal solo si el resultado no es entero
    return (Number.isInteger(k) ? k : Math.floor(k * 10) / 10) + 'k';
}

/**
 * Actualiza toda la UI o solo el chrome compartido y una vista concreta.
 *
 * @param {{ scope?: HTMLElement }} [options]
 */
function updateUI({ scope } = {}) {
    // La navbar está fuera de las vistas SPA y siempre es visible. El resto se
    // limita a `scope` durante una navegación para no recorrer vistas ocultas.
    const navbarDisplays = Array.from(
        document.querySelectorAll('.navbar .coin-display')
    );
    const displayRoot = scope || document;
    // Las vistas SPA permanecen montadas, pero solo una está visible. Excluir
    // contadores de una .view-section oculta evita escribir en ellos en cada
    // frame de animateValue(); syncUI() los actualiza al entrar en su vista.
    const otherDisplays = Array.from(
        displayRoot.querySelectorAll('.coin-display')
    ).filter(el => !el.matches('.navbar .coin-display') && !el.closest('.view-section.hidden'));

    if (_displayedCoins === store.coins) {
        // Sin delta: escribir valores formateados directamente, sin animación.
        // Evita sobrescribir el valor formateado que ya pintó el init silencioso.
        navbarDisplays.forEach(el => {
            el.textContent = formatCoinsNavbar(store.coins);
            // El tooltip muestra el valor exacto cuando la navbar usa formato abreviado
            // (ej: "25.5k"). El usuario puede ver el número preciso sin ir al HUD.
            el.closest('.coin-badge')?.setAttribute('title', `${store.coins} monedas`);
        });
        otherDisplays.forEach(el  => { el.textContent = store.coins; });
    } else {
        // Con delta: animar con número exacto y formatear navbar al terminar
        animateValue([...navbarDisplays, ...otherDisplays], _displayedCoins, store.coins);

        // Sobrescribir la navbar con el valor formateado al terminar la animación
        // (animateValue dura ~650 ms; con 700 ms de margen evitamos parpadeos)
        if (navbarDisplays.length) {
            setTimeout(() => {
                navbarDisplays.forEach(el => {
                    el.textContent = formatCoinsNavbar(store.coins);
                });
            }, 700);
        }
    }

    applyAvatar(scope);
    updateDailyButton(scope);
    updateMoonBlessingUI(scope);
}

/** Exponer formatCoinsNavbar para uso en shop.html si fuera necesario. */
window.formatCoinsNavbar = formatCoinsNavbar;

function applyAvatar(scope) {
    if (!store.userAvatar) return;
    // La navbar es chrome compartido; los demás avatares se limitan a la vista
    // entrante cuando syncUI() proporciona un scope.
    const avatarSelector = '#user-avatar-display, #hud-avatar-display, #profile-avatar-display, .hud-avatar';
    const avatars = scope
        ? new Set([
            document.getElementById('user-avatar-display'),
            ...scope.querySelectorAll('#hud-avatar-display, #profile-avatar-display, .hud-avatar')
        ])
        : document.querySelectorAll(avatarSelector);

    avatars.forEach(el => {
        if (!el) return;
        el.style.backgroundImage = `url('${store.userAvatar}')`;
        const icon = el.querySelector('i, svg');
        if (icon) icon.style.display = 'none';
    });
}

/**
 * Escribe el nickname y el sufijo de género en el DOM del HUD de forma síncrona.
 * Llamada antes de revealUI() para que el usuario nunca vea el estado por defecto.
 * Si el store no tiene nickname, no modifica el DOM (el modal se encargará).
 */
function applyIdentity() {
    const suffixEl   = document.getElementById('pref-suffix');
    const nicknameEl = document.getElementById('display-nickname');
    const profileNameEl = document.getElementById('profile-title');
    if (suffixEl)   suffixEl.textContent   = store.gender   || '@';
    if (nicknameEl) nicknameEl.textContent = store.nickname || '';
    if (profileNameEl) profileNameEl.textContent = store.nickname || 'Love Arcade';
}

function applyTheme(key) {
    const t    = THEMES[key] || THEMES.violet;
    const root = document.documentElement;

    // ── CSS custom properties (retrocompatibilidad con juegos) ────────────────
    root.style.setProperty('--accent',       t.accent);
    root.style.setProperty('--accent-hover', t.accent + 'cc');
    root.style.setProperty('--accent-glow',  t.glow);
    root.style.setProperty('--accent-dim',    t.accent + '99');
    root.style.setProperty('--accent-soft',   t.glow.replace(/[\d.]+\)$/, '0.12)'));
    root.style.setProperty('--accent-border', t.glow.replace(/[\d.]+\)$/, '0.38)'));

    // ── Clase en <body>: eliminar todas las anteriores y añadir la nueva ──────
    // Este es el mecanismo principal para que CSS pueda usar
    // body.theme-violet .selector { ... } sin variables dinámicas.
    const bodyClasses = document.body.classList;
    const nextThemeClass = `theme-${key}`;
    const prevThemeClass = document.body.dataset.activeThemeClass;
    if (!prevThemeClass) {
        Array.from(bodyClasses).forEach((className) => {
            if (className.startsWith('theme-') && className !== nextThemeClass) {
                bodyClasses.remove(className);
            }
        });
    } else if (prevThemeClass !== nextThemeClass) {
        bodyClasses.remove(prevThemeClass);
    }
    if (!bodyClasses.contains(nextThemeClass)) {
        bodyClasses.add(nextThemeClass);
    }
    document.body.dataset.activeThemeClass = nextThemeClass;

    // ── data-theme en <html> (retrocompatibilidad con atributo CSS selector) ──
    document.documentElement.setAttribute('data-theme', key);

    // ── Actualizar estado visual de los botones de tema ───────────────────────
    const themeButtons = document.querySelectorAll('.theme-btn');
    const activeButton = document.querySelector(`.theme-btn[data-theme="${key}"]`);
    themeButtons.forEach(btn => {
        const isActive = btn.dataset.theme === key;
        if (!isActive && btn.classList.contains('theme-btn--active')) {
            btn.classList.remove('theme-btn--active');
            btn.setAttribute('aria-pressed', 'false');
        }
    });
    if (activeButton) {
        activeButton.classList.add('theme-btn--active');
        activeButton.setAttribute('aria-pressed', 'true');
    }
}

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
    if (msg && repairMode && !info.canAffordRepair) {
        msg.textContent = 'Consigue las monedas que faltan jugando en el Arcade.';
        msg.style.color = '#facc15';
        msg.style.opacity = '1';
    }

    // HUD button: tiene elementos hijos específicos (#hud-reward-amount)
    const rewardEl = root.querySelector('#hud-reward-amount');
    if (rewardEl) {
        // Solo actualizar la cifra; la etiqueta "BONO DIARIO" se queda fija
        if (repairMode) {
            rewardEl.textContent = `${info.repairCost} 🪙`;
        } else if (!can) {
            rewardEl.textContent = `×${info.streak}`;
        } else {
            const moonStatus = window.GameCenter.getMoonBlessingStatus();
            const total = info.nextReward + (moonStatus.active ? 90 : 0);
            rewardEl.textContent = `+${total}`;
        }
        return; // HUD manejado: salir para no tocar el span genérico
    }

    // Botón clásico (por si se usa en otra vista)
    const span = btn.querySelector('span');
    if (span) {
        if (!can) {
            span.textContent = `Vuelve mañana · Racha: ${info.streak}`;
        } else {
            const moonStatus = window.GameCenter.getMoonBlessingStatus();
            const moonNote   = moonStatus.active ? ' +Luna' : '';
            span.textContent = `Bono Diario (+${info.nextReward}${moonNote})`;
        }
    }
}

function updateMoonBlessingUI(scope) {
    const status   = window.GameCenter.getMoonBlessingStatus();
    // La insignia de la navbar es compartida; las demás se actualizan solo en
    // la vista visible cuando la sincronización viene del router.
    const moonBadges = scope
        ? new Set([
            ...document.querySelectorAll('.navbar .moon-blessing-badge'),
            ...scope.querySelectorAll('.moon-blessing-badge')
        ])
        : document.querySelectorAll('.moon-blessing-badge');

    moonBadges.forEach(badge => {
        badge.classList.toggle('hidden', !status.active);
        if (status.active) {
            badge.title = `Bendición Lunar activa hasta ${status.expiresAt}`;
        }
    });

    // Botón de compra en tienda
    const root = scope || document;
    const moonBtn = root.querySelector('#btn-moon-blessing');
    if (moonBtn) {
        const statusEl = root.querySelector('#moon-blessing-status');
        if (status.active) {
            moonBtn.textContent = 'Extender Bendición (+7 días)';
            if (statusEl) statusEl.textContent = `Activa hasta ${status.expiresAt}`;
        } else {
            moonBtn.textContent = 'Activar Bendición Lunar (100 monedas)';
            if (statusEl) statusEl.textContent = 'Inactiva';
        }
    }
}

let _streakMilestoneModalLocked = false;

function _canUseVibration() {
    if (!navigator?.vibrate) return false;
    const userActivation = navigator.userActivation;
    if (!userActivation) return true;
    return Boolean(userActivation.isActive || userActivation.hasBeenActive);
}

function _vibrateLight() {
    if (_canUseVibration()) navigator.vibrate(12);
}

function _getPendingStreakMilestone() {
    const milestones = Array.isArray(window.STREAK_MILESTONES)
        ? window.STREAK_MILESTONES
        : [];
    if (!milestones.length) return null;

    const streak = Number(store?.daily?.streak || 0);
    const claimedSet = new Set(store.claimed_milestones || []);

    return milestones
        .slice()
        .sort((a, b) => Number(a.threshold || 0) - Number(b.threshold || 0))
        .find((milestone) =>
            streak >= Number(milestone.threshold || 0) && !claimedSet.has(milestone.id)
        ) || null;
}

function _renderStreakMilestoneRewards(rewards = []) {
    return rewards.map((reward) => {
        const amount = Math.floor(reward.amount || 0);
        if (reward.type === 'moon_blessing_days') {
            return `
                <li class="streak-milestone-reward streak-milestone-reward--moon">
                    <span class="streak-milestone-reward-icon" aria-hidden="true">
                        <svg class="icon" width="18" height="18"><use href="#icon-moon"></use></svg>
                    </span>
                    <span class="streak-milestone-reward-label">+${amount} días · Bendición Lunar</span>
                    <span class="streak-milestone-reward-fx" aria-hidden="true"></span>
                </li>
            `;
        }
        return `
            <li class="streak-milestone-reward">
                <span class="streak-milestone-reward-icon" aria-hidden="true">
                    <svg class="icon" width="18" height="18"><use href="#icon-star"></use></svg>
                </span>
                <span class="streak-milestone-reward-label">+${amount} monedas</span>
                <span class="streak-milestone-reward-fx" aria-hidden="true"></span>
            </li>
        `;
    }).join('');
}


function _setDailyMessage(message, success = false) {
    const msg = document.getElementById('daily-msg');
    if (!msg) return;
    msg.textContent   = message;
    msg.style.color   = success ? '#4ade80' : '#facc15';
    msg.style.opacity = '1';
    setTimeout(() => { msg.style.opacity = '0'; }, 3500);
}

function showDailyRepairModal() {
    const modal = document.getElementById('daily-repair-modal');
    const messageEl = document.getElementById('daily-repair-message');
    const confirmBtn = document.getElementById('btn-daily-repair-confirm');
    const cancelBtn = document.getElementById('btn-daily-repair-cancel');
    const info = window.GameCenter.getStreakInfo();
    if (!modal || !messageEl || !confirmBtn || !cancelBtn || !info.repairAvailable) return;

    messageEl.textContent = `¿Quieres usar ${info.repairCost} monedas para rescatar tu racha de ${info.streak} día${info.streak !== 1 ? 's' : ''}? 🪙✨`;
    modal.classList.remove('hidden');
    modal.classList.add('daily-repair-overlay--visible');
    confirmBtn.disabled = !info.canAffordRepair;
    confirmBtn.focus();

    const close = () => {
        modal.classList.add('hidden');
        modal.classList.remove('daily-repair-overlay--visible');
        document.getElementById('btn-daily')?.focus();
    };
    cancelBtn.onclick = close;
    confirmBtn.onclick = () => {
        confirmBtn.disabled = true;
        const result = window.GameCenter.repairDailyStreak();
        close();
        _setDailyMessage(result.message, result.success);
        updateUI();
        updateDailyButton();
        window.updateStreakBar?.();
    };
}

function showStreakMilestoneModal() {
    if (_streakMilestoneModalLocked) return;

    const modal = document.getElementById('streak-milestone-modal');
    const titleEl = document.getElementById('streak-milestone-title');
    const messageEl = document.getElementById('streak-milestone-message');
    const rewardsEl = document.getElementById('streak-milestone-rewards');
    const claimBtn = document.getElementById('btn-streak-milestone-claim');
    if (!modal || !titleEl || !messageEl || !rewardsEl || !claimBtn) return;

    const pending = _getPendingStreakMilestone();
    if (!pending) return;

    _streakMilestoneModalLocked = true;
    titleEl.textContent = pending.title || 'Hito desbloqueado';
    messageEl.textContent = pending.message || 'Gracias por tu constancia.';
    rewardsEl.innerHTML = _renderStreakMilestoneRewards(pending.rewards || []);
    modal.classList.remove('hidden');
    modal.classList.add('streak-milestone-overlay--visible');
    _vibrateLight();

    claimBtn.onclick = () => {
        _vibrateLight();
        claimBtn.disabled = true;
        const result = window.GameCenter.claimStreakMilestone(pending);
        if (!result.success) {
            claimBtn.disabled = false;
            return;
        }

        updateDailyButton();
        updateMoonBlessingUI();
        modal.classList.add('hidden');
        modal.classList.remove('streak-milestone-overlay--visible');
        _streakMilestoneModalLocked = false;

        // Si hay hitos encadenados (60/90/120), mostrar el siguiente.
        requestAnimationFrame(showStreakMilestoneModal);
    };
}

// =====================================================
// REVEAL UI — v9.3 Zero-Flicker
// =====================================================
/**
 * Revela bloques críticos de UI en el primer frame seguro tras hidratación.
 *
 * Precondiciones: saldo/avatar/hud ya escritos con valores reales.
 * Efectos secundarios: escrituras DOM de clases CSS; dispara transiciones visuales.
 * Coste esperado: O(n) sobre nodos HUD (pequeño y acotado).
 * Diseño (por qué): usar `requestAnimationFrame` separa "hidratar datos" de
 * "mostrar UI", evitando flicker del estado placeholder y layout-shift temprano.
 */
function revealUI() {
    requestAnimationFrame(() => {
        // coin-badge: usa su propia clase para compatibilidad con v9.2
        document.querySelectorAll('.coin-badge').forEach(el => {
            el.classList.add('coin-badge--visible');
        });
        // hud-avatar-wrap: se revela solo cuando el avatar (o el placeholder)
        // ya está correctamente pintado
        document.querySelectorAll('.hud-avatar-wrap').forEach(el => {
            el.classList.add('is-ready');
        });
        // player-hud: se revela completo una vez que botón diario, countdown
        // y barras de racha están en su estado correcto en el DOM oculto.
        // Esto evita:
        //  - El fade del botón disabled (transition:all disparada por CSS)
        //  - El layout-shift del countdown (display:none → block mueve .hud-streak)
        document.querySelectorAll('.player-hud').forEach(el => {
            el.classList.add('is-ready');
        });
    });
}
// Expuesta globalmente para que el inline script de index.html pueda llamarla
// DESPUÉS de que updateStreakBar() y updateCountdownDisplay() hayan corrido.
window.revealUI = revealUI;

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
applyTheme(store.theme || 'violet');

if (_isBase64Avatar(store.userAvatar) && store.userAvatar.length > (AVATAR_CLEANUP_KB * KB)) {
    store.userAvatar = null;
    window.GhostAnalytics?.track('storage_cleaned', { reason: 'avatar_too_large' });
    saveState();
}

// 2. SALDO — escribe el valor formateado síncronamente.
//    El .coin-badge tiene opacity:0 por CSS; nunca pintará el "0" del HTML.
_displayedCoins = store.coins;
document.querySelectorAll('.navbar .coin-display').forEach(el => {
    el.textContent = formatCoinsNavbar(store.coins);
});
document.querySelectorAll('.coin-display:not(.navbar .coin-display)').forEach(el => {
    el.textContent = store.coins;
});

// 3. BOTÓN DIARIO Y LUNA — corrige el estado (activo/desactivado, texto de
//    recompensa) antes del primer paint, eliminando el "salto de estado".
updateDailyButton();
updateMoonBlessingUI();

// 4. AVATAR — aplica la imagen guardada síncronamente (si existe).
applyAvatar();

// 5. IDENTIDAD — escribe nickname y sufijo de género en el DOM antes del reveal.
//    Solo actúa si hay nickname guardado; si no, el modal de bienvenida (en el
//    inline script de index.html) se encarga de llamar a revealUI() al confirmar.
applyIdentity();

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
    initInteractiveMicroFX();
    initLoadingStateObserver();

    // Re-sincronizar UI por si algún sub-módulo modificó el DOM
    updateUI();
    showStreakMilestoneModal();

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
            store = migrateState(JSON.parse(raw));
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
    // primer paint. El resultado se almacena en TIME_CACHE_KEY y será leído
    // por claimDaily() de forma síncrona, sin espera de red en el reclamo.
    _scheduleTimeSync(800);

    // Actualizar el caché cuando el usuario vuelve a la pestaña
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            _scheduleTimeSync(250);
        }
    });

    // ── Movimiento decorativo del HUD ──────────────────────────────────────
    // Las dos animaciones son solo decorativas. Pausarlas fuera de la pestaña
    // visible evita mantener trabajo continuo de compositor sin cambiar la UI
    // que recibe el usuario al volver.
    const syncHudMotionVisibility = () => {
        document.querySelectorAll('.player-hud').forEach(hud => {
            hud.classList.toggle('motion-paused', document.hidden);
        });
    };

    syncHudMotionVisibility();
    document.addEventListener('visibilitychange', syncHudMotionVisibility);

    // Refresco periódico cada 30 min por si la app permanece abierta mucho tiempo
    window.AppScheduler?.registerInterval('sync', 'time-cache-sync', () => _scheduleTimeSync(), 30 * 60 * 1000)
        || setInterval(() => _scheduleTimeSync(), 30 * 60 * 1000);

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
                showDailyRepairModal();
                updateDailyButton();
                return;
            }

            // ── Paso 2: ejecutar reclamo (instantáneo — sin red) ──
            const result = window.GameCenter.claimDaily();

            // ── Paso 3: mostrar mensaje y actualizar UI ──
            if (result.repairRequired) {
                showDailyRepairModal();
            } else {
                _setDailyMessage(result.message, result.success);
            }

            // updateDailyButton() recalcula el estado correcto del botón
            // (puede habilitarlo si el reclamo falló por error recuperable,
            //  o dejarlo desactivado con el contador si fue exitoso).
            updateDailyButton();
        });
    }

    // ── Selector de temas — fuente de verdad única (migrado desde shop-logic.js) ──
    // El tema es configuración global (afecta a toda la app, no solo a la Tienda).
    // shop-logic.js eliminó su propio listener durante la migración SPA; este es
    // el único registro. setTheme() actualiza el store, los CSS vars, la clase
    // theme-{key} en <body> y el estado visual de todos los .theme-btn.
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.GameCenter) window.GameCenter.setTheme(btn.dataset.theme);
        });
    });

    // NOTA: El listener de #btn-moon-blessing fue eliminado en v9.x (SPA Migration).
    // La Bendición Lunar es un elemento de la vista Tienda; su handler vive
    // exclusivamente en shop-logic.js para evitar el doble-registro de eventos.
});
// =====================================================
// ☁️  SENTINEL CLOUD SYNC — v14.0
// ─────────────────────────────────────────────────────────────────────────────
// Arquitectura: Patrón "Sentinel" (Observador)
//
// El Sentinel actúa como una capa de persistencia en la nube que espeja el
// localStorage sin modificar el código de los juegos. Todos los minijuegos
// corren bajo el mismo origen (subcarpetas), por lo que comparten acceso al
// mismo localStorage. El Sentinel observa cambios en las claves críticas,
// los empaqueta en un objeto JSONB y los sube a Supabase con debounce.
//
// Flujo principal:
//  1. init: obtiene credenciales de /api/client-config → crea cliente Supabase
//  2. onAuthStateChange: detecta sesión activa (Email/Password)
//     → al SIGNED_IN: descarga perfil de la nube y aplica Last Write Wins
//  3. StorageInterceptor: intercepta localStorage.setItem para claves vigiladas
//     → dispara _sentinelScheduleSync() con debounce de 3 s
//  4. _sentinelSync(): sube snapshot de todas las claves vigiladas a Supabase
//
// Resolución de conflictos — Last Write Wins (timestamp):
//  · Al iniciar sesión se compara updated_at de la BD con la marca local.
//  · Si la nube es más reciente, se sobreescribe el localStorage local.
//  · Si el local es más reciente (o igual), la nube se actualiza al subir.
//
// Claves vigiladas (SENTINEL_WATCHED_KEYS):
//  Hub:            gamecenter_v6_promos
//  Word Hunt:      la_ws_completedLevels, la_ws_state
//  Rompecabezas:   puz_arcade_progress, puz_arcade_unlocked
//  2048 Lumina:    LUMINA_bestScore, LUMINA_gameState
//  Space Shooter:  la_shooter_highscore, la_shooter_settings
//  Ollin Smash:    OS_highscore
//  Jungle Dash:    JD_highscore, JD_muted
//  Dodger:         dodger_highscore, dodger_skin, dodger_muted
//  Marejig:        MAREJIG_completedLevels_v1, MAREJIG_levelProgress_v1,
//                  MAREJIG_activeSave_v1, MAREJIG_settings_v1
//
// Supabase SQL (ejecutar una sola vez en el editor de Supabase):
// ─────────────────────────────────────────────────────────────────────────────
//  create table user_profiles (
//    id          uuid references auth.users primary key,
//    game_data   jsonb not null default '{}',
//    updated_at  timestamptz not null default now()
//  );
//  alter table user_profiles enable row level security;
//  create policy "own_select" on user_profiles for select  using (auth.uid()=id);
//  create policy "own_insert" on user_profiles for insert  with check (auth.uid()=id);
//  create policy "own_update" on user_profiles for update  using (auth.uid()=id);
// =====================================================

(function SentinelCloudSync() {
    'use strict';

    // ── Claves a observar y sincronizar ──────────────────────────────────────
    const SENTINEL_WATCHED_KEYS = new Set([
        'gamecenter_v6_promos',    // Hub principal — monedas, inventario, racha
        'la_ws_completedLevels',   // Word Hunt — niveles completados
        'la_ws_state',             // Word Hunt — estado de sesión
        'puz_arcade_progress',     // Rompecabezas — progreso
        'puz_arcade_unlocked',     // Rompecabezas — niveles desbloqueados
        'LUMINA_bestScore',        // 2048 Lumina — mejor puntuación
        'LUMINA_gameState',        // 2048 Lumina — estado de partida
        'la_shooter_highscore',    // Space Shooter — récord
        'la_shooter_settings',     // Space Shooter — configuración
        'OS_highscore',            // Ollin Smash — récord
        'JD_highscore',            // Jungle Dash — récord
        'JD_muted',                // Jungle Dash — silencio
        'dodger_highscore',        // Dodger — récord
        'dodger_skin',             // Dodger — skin activa
        'dodger_muted',            // Dodger — silencio
        'MAREJIG_completedLevels_v1', // Marejig — niveles completados y métricas finales
        'MAREJIG_levelProgress_v1',   // Marejig — resumen ligero por nivel pendiente
        'MAREJIG_activeSave_v1',      // Marejig — partida activa compacta
        'MAREJIG_settings_v1',        // Marejig — preferencias locales
    ]);

    // Clave del registro de marca de tiempo local (para Last Write Wins)
    const SENTINEL_TS_KEY = 'love_arcade_sentinel_ts';

    // Tabla de Supabase
    const SUPABASE_TABLE = 'user_profiles';

    // Estado interno del Sentinel
    let _sbClient   = null;   // Cliente Supabase inicializado
    let _sbSession  = null;   // Sesión de usuario activa
    let _syncTimer  = null;   // Timer de debounce
    let _scheduledSyncPriority = null; // 'high' | 'passive' | null
    let _isSyncing  = false;  // Mutex de subida activa
    let _isRestoringSession = false; // Evita sobrescrituras durante hidratación inicial
    let _hasUnsyncedChanges = false; // Dirty flag local (incluye cambios cross-tab)
    const HIGH_PRIORITY_DEBOUNCE_MS = 1_000;
    const PASSIVE_PRIORITY_DEBOUNCE_MS = 60_000;

    const HIGH_PRIORITY_KEYS = new Set([
        CONFIG.stateKey,              // gamecenter_v6_promos
        'gamecenter_v6_promos',
        'love_arcade_inventory',
        'LUMINA_bestScore',
        'love_arcade_settings',
        'MAREJIG_completedLevels_v1',
    ]);

    const PASSIVE_PRIORITY_KEYS = new Set([
        'LUMINA_gameState',
        'MAREJIG_levelProgress_v1',
        'MAREJIG_activeSave_v1',
        'MAREJIG_settings_v1',
        SENTINEL_TS_KEY,
    ]);

    function _getCloudAvatarUrl() {
        try {
            const avatar = window.GameCenter?.getAvatar?.();
            if (typeof avatar !== 'string') return null;
            if (_isBase64Avatar(avatar)) return null;
            return /^https?:\/\//i.test(avatar) ? avatar : null;
        } catch (_) {
            return null;
        }
    }

    // ── Utilidades de UI ─────────────────────────────────────────────────────

    function _setStatusBadge(state) {
        const dot  = document.getElementById('cloud-status-dot');
        const text = document.getElementById('cloud-status-text');
        const badge = document.getElementById('cloud-status-badge');
        if (!dot || !text) return;

        const STATES = {
            inactive:  { color: 'var(--text-low)',  label: 'Inactivo' },
            connected: { color: '#63b3ed',           label: 'Conectado' },
            syncing:   { color: '#f6ad55',           label: 'Sincronizando…' },
            synced:    { color: '#68d391',           label: 'Sincronizado' },
            error:     { color: '#fc8181',           label: 'Error' },
        };
        const s = STATES[state] || STATES.inactive;
        dot.style.background = s.color;
        text.textContent     = s.label;
        if (badge) badge.style.color = s.color;
    }

    function _setLoginMsg(msg, isError = false) {
        const el = document.getElementById('cloud-login-msg');
        if (!el) return;
        el.textContent  = msg;
        el.style.color  = isError ? 'var(--error, #fc8181)' : '#68d391';
    }

    function _setSyncMsg(msg, isError = false) {
        const el = document.getElementById('cloud-sync-msg');
        if (!el) return;
        el.textContent = msg;
        el.style.color = isError ? 'var(--error, #fc8181)' : '#68d391';
    }

    function _setLastSyncLabel(isoStr) {
        const el = document.getElementById('cloud-last-sync');
        if (!el) return;
        if (!isoStr) {
            el.textContent = 'Última sincronización: —-';
            return;
        }
        const d = new Date(isoStr);
        el.textContent = `Última sincronización: ${d.toLocaleString('es-MX', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        })}`;
    }

    function _setAccountStateLabel(isOnline) {
        const el = document.getElementById('cloud-account-state');
        if (!el) return;
        el.textContent = isOnline ? 'Estado: En línea' : 'Estado: Sin sesión';
        el.style.color = isOnline ? '#68d391' : 'var(--text-low)';
    }

    function _setSessionEmail(email) {
        const el = document.getElementById('cloud-session-email');
        if (el) el.textContent = email || '';
    }

    // ── Snapshot — lectura/escritura del estado vigilado ─────────────────────

    /**
     * Lee todas las claves vigiladas del localStorage y las empaqueta
     * en un objeto plano { key: value_string }.
     * El valor se almacena como string (igual que localStorage).
     */
    function _buildSnapshot() {
        const snap = {};
        SENTINEL_WATCHED_KEYS.forEach(key => {
            const val = localStorage.getItem(key);
            if (val === null) return;

            // Evitar subir userAvatar dentro de game_data:
            // el avatar cloud vive en user_profiles.avatar_url y el binario en Storage.
            if ((key === CONFIG.stateKey || key === 'gamecenter_v6_promos') && typeof val === 'string') {
                // El estado no suele incluir un avatar Base64. En esos casos se
                // conserva el payload ya serializado y se evita parsearlo y
                // serializarlo de nuevo durante cada sincronización.
                const hasUserAvatar = val.indexOf('"userAvatar"') !== -1;
                const hasNullUserAvatar = /"userAvatar"\s*:\s*null(?:\s*[,}])/.test(val);
                if (!hasUserAvatar || hasNullUserAvatar) {
                    snap[key] = val;
                    return;
                }
                try {
                    const parsed = JSON.parse(val);
                    if (parsed && typeof parsed === 'object' && Object.prototype.hasOwnProperty.call(parsed, 'userAvatar')) {
                        const sanitized = { ...parsed };
                        delete sanitized.userAvatar;
                        snap[key] = JSON.stringify(sanitized);
                        return;
                    }
                } catch (_) {
                    // Si no es JSON válido, se conserva el valor tal cual.
                }
            }
            snap[key] = val;
        });
        return snap;
    }

    /**
     * Escribe un snapshot (recibido de la nube) en el localStorage local.
     * Solo toca las claves que están en SENTINEL_WATCHED_KEYS y que
     * están presentes en el snapshot. No borra claves ausentes.
     *
     * IMPORTANTE: usa el setItem ORIGINAL (pre-interceptor) para no
     * disparar el debounce mientras aplicamos datos de la nube.
     */
    function _applySnapshot(snap) {
        if (!snap || typeof snap !== 'object') return;
        SENTINEL_WATCHED_KEYS.forEach(key => {
            if (Object.prototype.hasOwnProperty.call(snap, key) && snap[key] !== null) {
                _originalSetItem(key, snap[key]);
            }
        });
        _rehydrateHubStoreFromDisk();
        // Emitir evento para que los módulos sepan que el store fue reemplazado
        document.dispatchEvent(new CustomEvent('la:cloudsynced', { detail: { source: 'cloud' } }));
    }

    function _rehydrateHubStoreFromDisk() {
        try {
            const raw = localStorage.getItem(CONFIG.stateKey);
            if (raw) {
                store = migrateState(JSON.parse(raw));
                window.GameCenter?.syncUI?.();
            }
        } catch (_) {}
    }

    // ── Sincronización hacia la nube ──────────────────────────────────────────

    /**
     * Sincroniza el snapshot local hacia Supabase cuando existe sesión activa.
     * Flujo: snapshot local -> upsert en user_profiles -> marca de tiempo local -> refresco UI.
     * @returns {Promise<void>}
     */
    async function _sentinelSync() {
        if (!_sbClient || !_sbSession || _isRestoringSession) return;
        if (_isSyncing) return; // Evitar doble subida simultánea
        _isSyncing = true;
        _setStatusBadge('syncing');

        try {
            const snap       = _buildSnapshot();
            const now        = new Date().toISOString();
            const userId     = _sbSession.user.id;
            const nickname   = window.GameCenter?.getIdentity?.()?.nickname || '';
            const avatar_url = _getCloudAvatarUrl();

            const { error } = await _sbClient
                .from(SUPABASE_TABLE)
                .upsert(
                    { id: userId, game_data: snap, nickname, avatar_url, updated_at: now },
                    { onConflict: 'id' }
                );

            if (error) throw error;

            // Guardar marca de tiempo local
            _originalSetItem(SENTINEL_TS_KEY, now);
            _setStatusBadge('synced');
            _setSyncMsg('¡Progreso guardado en la nube! ✓');
            _setLastSyncLabel(now);
            _hasUnsyncedChanges = false;
            document.dispatchEvent(new CustomEvent('la:synced', {
                detail: { at: now, source: 'sentinel-upsert' }
            }));

            // Limpiar mensaje tras 4 s
            setTimeout(() => _setSyncMsg(''), 4_000);
        } catch (err) {
            console.error('[Sentinel] Error al sincronizar:', err);
            _setStatusBadge('error');
            _setSyncMsg('Error al sincronizar. Reintentando…', true);
            // Reintentar en 30 s
            setTimeout(() => _sentinelScheduleSync(0), 30_000);
        } finally {
            _isSyncing = false;
        }
    }

    /**
     * Programa una sincronización con debounce.
     * Cada llamada reinicia el timer; la subida ocurre sólo cuando el
     * usuario lleva `delay` ms sin escribir en localStorage.
     * @param {number} [delay=HIGH_PRIORITY_DEBOUNCE_MS]
     */
    function _sentinelScheduleSync(delay = HIGH_PRIORITY_DEBOUNCE_MS) {
        if (!_sbSession || _isRestoringSession) return;
        clearTimeout(_syncTimer);
        if (document.hidden) {
            _sentinelSync();
            return;
        }
        _scheduledSyncPriority = delay <= HIGH_PRIORITY_DEBOUNCE_MS ? 'high' : 'passive';
        _syncTimer = setTimeout(() => {
            _syncTimer = null;
            _scheduledSyncPriority = null;
            _sentinelSync();
        }, delay);
    }

    function _resolveSyncPriority(key) {
        if (HIGH_PRIORITY_KEYS.has(key)) return 'high';
        if (PASSIVE_PRIORITY_KEYS.has(key)) return 'passive';
        return 'passive'; // resto de claves vigiladas
    }

    function _sentinelScheduleSyncForKey(key) {
        if (!_sbSession) return;
        const priority = _resolveSyncPriority(key);
        if (priority === 'high') {
            _sentinelScheduleSync(HIGH_PRIORITY_DEBOUNCE_MS);
            return;
        }
        // Prioridad pasiva: sólo programar si no hay sync pendiente.
        if (_syncTimer) return;
        _sentinelScheduleSync(PASSIVE_PRIORITY_DEBOUNCE_MS);
    }

    // ── Carga/merge desde la nube — Sentinel v14.0 ──────────────────────────

    async function _handleAuthChange(event, session) {
        if (!_sbClient) return;

        if (!session) {
            _sbSession = null;
            _setStatusBadge('inactive');
            _setSessionEmail('');
            clearTimeout(_syncTimer);
            return;
        }

        _sbSession = session;
        _isRestoringSession = true;
        _setSessionEmail(session.user?.email || '');
        _setStatusBadge('connected');

        try {
            const userId = session.user.id;
            const { data, error } = await _sbClient
                .from(SUPABASE_TABLE)
                .select('game_data, updated_at, nickname, avatar_url')
                .eq('id', userId)
                .maybeSingle();
            if (error) throw error;

            if (data?.nickname && !window.GameCenter?.hasIdentity?.()) {
                window.GameCenter?.setIdentity?.(data.nickname, '@');
            }
            if (data?.avatar_url && typeof data.avatar_url === 'string') {
                const avatar = data.avatar_url.trim();
                if (avatar) {
                    store.userAvatar = avatar;
                    saveState();
                }
            }

            const effectiveData = data?.game_data || {};

            const localRawTs = localStorage.getItem(SENTINEL_TS_KEY);
            const _safeTs = (iso) => {
                const t = iso ? new Date(iso).getTime() : 0;
                return Number.isFinite(t) ? t : 0;
            };
            const localTime = _safeTs(localRawTs);
            const cloudTime = _safeTs(data?.updated_at);
            const localSnapshot = _buildSnapshot();
            const hasLocalSnapshot = Object.keys(localSnapshot).length > 0;
            const hasCloudSnapshot = effectiveData && Object.keys(effectiveData).length > 0;
            const snapshotsDiffer = hasLocalSnapshot && hasCloudSnapshot
                && JSON.stringify(localSnapshot) !== JSON.stringify(effectiveData);

            if (hasCloudSnapshot && cloudTime > localTime) {
                _applySnapshot(effectiveData);
                _originalSetItem(SENTINEL_TS_KEY, data.updated_at);
                _setLastSyncLabel(data.updated_at);
                _setSyncMsg('Progreso cloud restaurado (más reciente) ✓');
                setTimeout(() => _setSyncMsg(''), 4_000);
            } else if (hasLocalSnapshot && (!hasCloudSnapshot || localTime > cloudTime || (localTime === cloudTime && snapshotsDiffer))) {
                await _sentinelSync();
            } else if (hasCloudSnapshot) {
                _setLastSyncLabel(data?.updated_at || localRawTs);
            }

            _setAccountStateLabel(true);
            _setStatusBadge('synced');
            document.dispatchEvent(new CustomEvent('la:cloud-authenticated'));
        } catch (err) {
            console.error('[Sentinel] Error al procesar auth change:', err);
            _setStatusBadge('error');
            _setSyncMsg('No se pudo sincronizar al iniciar sesión.', true);
        } finally {
            _isRestoringSession = false;
            if (_sbSession && _hasUnsyncedChanges) {
                _sentinelScheduleSync(PASSIVE_PRIORITY_DEBOUNCE_MS);
            }
        }
    }

    // ── StorageInterceptor ────────────────────────────────────────────────────

    // Referencias a los métodos ORIGINALES antes de ser interceptados.
    // _originalSetItem se usa en _applySnapshot() para evitar re-disparar el debounce.
    const _originalSetItem = localStorage.setItem.bind(localStorage);
    const _originalRemoveItem = localStorage.removeItem.bind(localStorage);

    function _markWatchedKeyDirty(key, prevValue = null, nextValue = null) {
        if (!SENTINEL_WATCHED_KEYS.has(key) || !_sbSession || _isRestoringSession) return;
        _hasUnsyncedChanges = true;
        _originalSetItem(SENTINEL_TS_KEY, new Date().toISOString());
        _sentinelScheduleSyncForKey(key);
    }

    /**
     * Intercepta localStorage.setItem.
     * Si la clave pertenece a SENTINEL_WATCHED_KEYS y hay sesión activa,
     * programa una sincronización con debounce.
     * El valor se escribe normalmente en localStorage independientemente.
     */
    localStorage.setItem = function interceptedSetItem(key, value) {
        const prevValue = localStorage.getItem(key);
        _originalSetItem(key, value);
        _markWatchedKeyDirty(key, prevValue, value);
    };

    /**
     * Intercepta localStorage.removeItem para que los borrados de claves
     * vigiladas también lleguen a la nube. Esto es especialmente importante
     * para guardados transitorios como MAREJIG_activeSave_v1, que se elimina
     * al completar, reiniciar o reemplazar una partida.
     */
    localStorage.removeItem = function interceptedRemoveItem(key) {
        const prevValue = localStorage.getItem(key);
        _originalRemoveItem(key);
        _markWatchedKeyDirty(key, prevValue, null);
    };

    // ── Cross-tab bridge: detectar writes desde otras pestañas ───────────────
    // El evento 'storage' NO se dispara en la pestaña que ejecuta setItem,
    // sólo en el resto de pestañas del mismo origen (ej: Hub abierto + juego).
    window.addEventListener('storage', (event) => {
        if (!event?.key) return;
        if (event.key === CONFIG.stateKey) {
            _rehydrateHubStoreFromDisk();
        }
        if (!SENTINEL_WATCHED_KEYS.has(event.key)) return;
        _rehydrateHubStoreFromDisk();
        _originalSetItem(SENTINEL_TS_KEY, new Date().toISOString());
        _hasUnsyncedChanges = true;
        if (!_sbSession || _isRestoringSession) return; // Invitado o sesión no restaurada → ignorar sync cloud
        console.log(`[Sentinel] Cambio detectado en pestaña externa (${event.key}). Sincronizando...`);
        _sentinelScheduleSyncForKey(event.key);
    });

    // ── Autenticación — onAuthStateChange ────────────────────────────────────

    function _handleSignOut() {
        _sbSession = null;
        _isRestoringSession = false;
        _hasUnsyncedChanges = false;
        _setStatusBadge('inactive');
        _setSessionEmail('');
        _setAccountStateLabel(false);
        clearTimeout(_syncTimer);
        document.dispatchEvent(new CustomEvent('la:cloud-signedout'));
    }

    // ── Inicialización ────────────────────────────────────────────────────────

    async function _sentinelInit() {
        // 1. Obtener credenciales desde el proxy seguro
        let supabaseUrl, supabaseKey;
        try {
            const res = await fetch('/api/client-config', { cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const cfg = await res.json();
            supabaseUrl = cfg.supabaseUrl;
            supabaseKey = cfg.supabaseKey;
        } catch (err) {
            console.warn('[Sentinel] No se pudieron obtener credenciales de nube:', err.message);
            return; // Degradación elegante — funciona sin nube
        }

        if (!supabaseUrl || !supabaseKey) {
            console.warn('[Sentinel] Variables de entorno de Supabase no configuradas en Vercel.');
            return;
        }

        // 2. Crear cliente Supabase
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            console.warn(
                '[Sentinel] SDK de Supabase no disponible (SDK no cargada / bloqueada). ' +
                'Sentinel continuará en estado degradado (solo almacenamiento local).'
            );
            return;
        }
        try {
            _sbClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        } catch (err) {
            console.error('[Sentinel] Error creando cliente Supabase:', err);
            return;
        }

        // 3. Escuchar cambios de sesión
        _sbClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT') {
                _handleSignOut();
                return;
            }
            _handleAuthChange(event, session);
        });

        // 4. Recuperar sesión existente (para recargas de página)
        const { data: { session } } = await _sbClient.auth.getSession();
        if (session && !_sbSession) _handleAuthChange('INITIAL_SESSION', session);
    }

    // ── Listeners de UI ──────────────────────────────────────────────────────

    document.addEventListener('DOMContentLoaded', () => {
        const gateModal = document.getElementById('cloud-gatekeeper-modal');
        const gateBox = gateModal?.querySelector('.cloud-gatekeeper-modal-box');
        const gateMsgEl = document.getElementById('cloud-gatekeeper-msg');
        const gatePanels = Array.from(document.querySelectorAll('[data-gate-panel]'));
        const loginForm = document.getElementById('cloud-login-form');
        let gateLocked = false;

        const bindPasswordToggle = () => {
            document.querySelectorAll('[data-password-toggle]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const input = document.getElementById(btn.dataset.passwordToggle || '');
                    if (!input) return;
                    input.type = input.type === 'password' ? 'text' : 'password';
                });
            });
        };
        bindPasswordToggle();

        const simplifyGateError = (rawMsg = '') => {
            const msg = String(rawMsg || '').toLowerCase();
            if (!msg) return 'No se pudo completar la acción. Inténtalo de nuevo.';
            if (msg.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
            if (msg.includes('email not confirmed')) return 'Revisa tu correo y confirma tu cuenta para continuar.';
            if (msg.includes('network') || msg.includes('fetch')) return 'Sin conexión. Revisa internet e inténtalo de nuevo.';
            if (msg.includes('rate limit') || msg.includes('too many requests')) return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
            return 'No se pudo completar la acción. Inténtalo de nuevo.';
        };

        const setGateMsg = (msg, isError = false) => {
            if (!gateMsgEl) return;
            const cleanMsg = isError ? simplifyGateError(msg) : String(msg || '');
            gateMsgEl.textContent = cleanMsg;
            gateMsgEl.style.color = isError ? 'var(--error, #fc8181)' : '#68d391';
        };

        const setFormEnabled = (formEl, enabled) => {
            if (!formEl) return;
            formEl.querySelectorAll('input, button, select, textarea').forEach((control) => {
                control.disabled = !enabled;
            });
        };

        const resetGateFeedback = () => {
            setGateMsg('');
        };

        /**
         * Controla el panel de login del Gatekeeper.
         * @param {'login'} mode - Modo activo del modal.
         * @returns {void}
         */
        const renderGateMode = (mode) => {
            const selectedMode = mode || 'login';
            resetGateFeedback();
            gatePanels.forEach(panel => {
                const active = panel.dataset.gatePanel === selectedMode;
                panel.classList.toggle('is-active', active);
                panel.setAttribute('aria-hidden', String(!active));
                setFormEnabled(panel, active);
            });
        };

        const openGate = ({ mode = 'login', locked = false } = {}) => {
            gateLocked = locked;
            gateModal?.classList.remove('hidden');
            window.ModalA11y?.open?.(gateModal, document.activeElement);
            gateBox?.classList.toggle('is-locked', gateLocked);
            renderGateMode(mode);
        };

        const btnOpenGate = document.getElementById('btn-cloud-open-gatekeeper');
        btnOpenGate?.addEventListener('click', () => {
            _startSentinelBoot();
            openGate({ mode: 'login' });
        });

        const closeGate = () => {
            if (gateLocked) return;
            gateModal?.classList.add('hidden');
            window.ModalA11y?.close?.(gateModal);
            renderGateMode('login');
        };
        document.getElementById('cloud-gatekeeper-close')?.addEventListener('click', closeGate);
        gateModal?.addEventListener('click', (e) => {
            if (e.target === gateModal && !gateLocked) closeGate();
        });

        loginForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!_sbClient) {
                setGateMsg('Preparando servicio…');
                await _startSentinelBoot();
                if (!_sbClient) return setGateMsg('Servicio no disponible. Recarga la página.', true);
            }

            const email = document.getElementById('cloud-login-email')?.value?.trim();
            const password = document.getElementById('cloud-login-password')?.value || '';
            if (!email || !password) return setGateMsg('Completa correo y contraseña.', true);

            setGateMsg('Iniciando sesión…');
            try {
                const { error } = await _sbClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                setGateMsg('¡Listo! Iniciaste sesión.');
                _setLoginMsg(`Sesión iniciada para ${email}.`);
                closeGate();
            } catch (err) {
                setGateMsg(err?.message, true);
            }
        });

        const cloudIndicator = document.getElementById('cloud-sync-indicator')
            || document.getElementById('hud-cloud-sync-indicator');
        if (cloudIndicator) {
            document.addEventListener('la:synced', () => {
                cloudIndicator.classList.add('is-active', 'is-pulse');
                setTimeout(() => cloudIndicator.classList.remove('is-pulse'), 1800);
            });
        }

        window.addEventListener('pagehide', () => {
            if (!_sbSession || !_hasUnsyncedChanges) return;
            clearTimeout(_syncTimer);
            _sentinelSync();
        });

        window.addEventListener('beforeunload', () => {
            if (!_sbSession || !_hasUnsyncedChanges) return;
            clearTimeout(_syncTimer);
            _sentinelSync();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden || !_sbSession || !_hasUnsyncedChanges) return;
            clearTimeout(_syncTimer);
            _sentinelSync();
        });

        document.addEventListener('la:cloud-authenticated', () => {
            gateLocked = false;
            gateBox?.classList.remove('is-locked');
            closeGate();
        });

        _setLastSyncLabel(localStorage.getItem(SENTINEL_TS_KEY));
        _setAccountStateLabel(Boolean(_sbSession));

        const hasLocalIdentity = window.GameCenter?.hasIdentity?.();
        if (!hasLocalIdentity && !_sbSession) {
            openGate({ locked: true, mode: 'login' });
        }
    });

    // ── Arranque ─────────────────────────────────────────────────────────────
    // Espera explícitamente a que el loader de Supabase confirme createClient
    // antes de invocar _sentinelInit(), evitando un init prematuro en degradado.
    async function _bootSentinel() {
        if (!window.supabase?.createClient && typeof window.__loadSupabaseSdk === 'function') {
            try {
                await window.__loadSupabaseSdk();
            } catch (err) {
                console.warn('[Sentinel] Loader Supabase devolvió error durante bootstrap:', err);
            }
        }

        if (!window.supabase?.createClient) {
            console.warn(
                '[Sentinel] Supabase SDK no está disponible tras bootstrap (CDN primario + fallback). ' +
                'Se omite _sentinelInit() y Sentinel queda en modo degradado.'
            );
            return;
        }

        await _sentinelInit();
    }

    // El SDK y la restauración de sesión no forman parte del primer paint. Se
    // difieren hasta idle, pero una interacción con el Gatekeeper los inicia
    // enseguida para que el login temprano no espere al timeout.
    const SENTINEL_BOOT_IDLE_TIMEOUT_MS = 1800;
    let _sentinelBootPromise = null;
    let _sentinelBootIdleHandle = null;
    let _sentinelBootIdleUsesRequestIdleCallback = false;

    function _startSentinelBoot() {
        if (_sentinelBootIdleHandle !== null) {
            if (_sentinelBootIdleUsesRequestIdleCallback) {
                window.cancelIdleCallback?.(_sentinelBootIdleHandle);
            } else {
                clearTimeout(_sentinelBootIdleHandle);
            }
            _sentinelBootIdleHandle = null;
            _sentinelBootIdleUsesRequestIdleCallback = false;
        }

        if (_sentinelBootPromise) return _sentinelBootPromise;

        _sentinelBootPromise = _bootSentinel().catch(err => {
            console.error('[Sentinel] Error en inicialización:', err);
        });
        return _sentinelBootPromise;
    }

    function _scheduleSentinelBoot() {
        const runBoot = () => {
            _sentinelBootIdleHandle = null;
            _sentinelBootIdleUsesRequestIdleCallback = false;
            _startSentinelBoot();
        };

        if ('requestIdleCallback' in window) {
            _sentinelBootIdleUsesRequestIdleCallback = true;
            _sentinelBootIdleHandle = window.requestIdleCallback(runBoot, {
                timeout: SENTINEL_BOOT_IDLE_TIMEOUT_MS
            });
            return;
        }

        _sentinelBootIdleHandle = setTimeout(runBoot, SENTINEL_BOOT_IDLE_TIMEOUT_MS);
    }

    _scheduleSentinelBoot();

    // Exponer API mínima para diagnóstico en DevTools
    // Nota: para subir avatares desde el frontend debe existir el bucket público `avatars`
    // con políticas RLS apropiadas configuradas manualmente en Supabase.
    window.Sentinel = {
        syncNow:    () => _sentinelSync(),
        getSession: () => _sbSession,
        getClient:  () => _sbClient,
        getStatus:  () => ({ hasClient: !!_sbClient, hasSession: !!_sbSession }),
        _rehydrateHubStoreFromDisk: () => _rehydrateHubStoreFromDisk(),
    };

})(); // fin IIFE SentinelCloudSync


(function setupServiceWorkerUpdateBridge() {
    if (!('serviceWorker' in navigator)) return;

    function showUpdateBanner(registration) {
        if (document.getElementById('sw-update-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'sw-update-banner';
        banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;padding:12px 14px;border-radius:10px;background:#111;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px;';
        banner.innerHTML = '<span>Nueva versión disponible.</span><button id="sw-update-btn" style="background:#6d28d9;color:#fff;border:0;padding:8px 12px;border-radius:8px;cursor:pointer;">Actualizar</button>';
        document.body.appendChild(banner);
        banner.querySelector('#sw-update-btn')?.addEventListener('click', () => {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        });
    }

    navigator.serviceWorker.getRegistration('/').then((registration) => {
        if (!registration) return;
        if (registration.waiting) showUpdateBanner(registration);
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateBanner(registration);
                }
            });
        });
    }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
})();
