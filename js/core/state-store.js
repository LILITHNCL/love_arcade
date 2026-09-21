// Este script clásico debe cargarse después de config.js y antes de app.js.
// Centraliza la persistencia del hub sin depender del DOM ni de la UI.
(function initLoveArcadeStore() {
    const CONFIG = window.CONFIG;
    const { THEMES } = window;
    const { LEGACY_THEME_FALLBACK } = window.LoveArcadeConfig;

    const KB = 1024;
    const AVATAR_MAX_LOCAL_KB = 100;
    const AVATAR_CLEANUP_KB = 200;
    const STORE_WARNING_KB = 4000;
    let showStorageToast = () => {};

    function migrate(loadedStore) {
        const defaults = {
            coins: CONFIG.initialCoins,
            progress: { maze: [], wordsearch: [], secretWordsFound: [] },
            inventory: {},
            redeemedHashes: [],
            history: [],
            userAvatar: null,
            theme: 'violet',
            daily: { lastClaim: 0, streak: 0 },
            buffs: { moonBlessingExpiry: 0 },
            nickname: '',
            gender: '@'
        };
        const merged = { ...defaults, ...loadedStore };

        if (merged.theme && !THEMES[merged.theme]) {
            merged.theme = LEGACY_THEME_FALLBACK[merged.theme] || 'violet';
        }
        if (merged.lastDaily && merged.daily.lastClaim === 0) {
            const lastDate = new Date(merged.lastDaily);
            if (!isNaN(lastDate.getTime())) {
                merged.daily = { lastClaim: lastDate.getTime(), streak: 1 };
            }
        }
        delete merged.lastDaily;
        if (!merged.daily || typeof merged.daily !== 'object') merged.daily = defaults.daily;
        if (!merged.buffs || typeof merged.buffs !== 'object') merged.buffs = defaults.buffs;
        if (!Array.isArray(merged.redeemedHashes)) merged.redeemedHashes = [];
        if (!Array.isArray(merged.history)) merged.history = [];
        if (typeof merged.nickname !== 'string') merged.nickname = '';
        if (!['o', 'a', '@'].includes(merged.gender)) merged.gender = '@';
        if (Object.prototype.hasOwnProperty.call(merged, 'redeemedCodes')) delete merged.redeemedCodes;
        if (Object.prototype.hasOwnProperty.call(merged, 'missions')) delete merged.missions;
        if (Object.prototype.hasOwnProperty.call(merged, 'claimed_milestones')) delete merged.claimed_milestones;
        return merged;
    }

    let store = migrate({});
    const listeners = [];
    try {
        const raw = localStorage.getItem(CONFIG.stateKey);
        if (raw) store = migrate(JSON.parse(raw));
    } catch (error) {
        console.error('GameCenter: Error al cargar estado', error);
        store = migrate({});
    }

    function notify(meta = {}) {
        listeners.forEach(listener => listener(store, meta));
    }

    function getStore() {
        return store;
    }

    function replaceStore(next, meta = {}) {
        store = next;
        notify({ source: 'replace', ...meta });
    }

    function subscribe(listener) {
        listeners.push(listener);
        return () => {
            const index = listeners.indexOf(listener);
            if (index !== -1) listeners.splice(index, 1);
        };
    }

    function isBase64Avatar(value) {
        return typeof value === 'string' && value.startsWith('data:image/');
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

    function emergencyCleanup() {
        let changed = false;
        if (isBase64Avatar(store.userAvatar) && store.userAvatar.length > (AVATAR_CLEANUP_KB * KB)) {
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
                showStorageToast(
                    'Tu progreso está cerca del límite de almacenamiento. Exporta tu partida y contacta soporte.',
                    'warning'
                );
            }
            return sizeKB;
        } catch (_) {
            return 0;
        }
    }

    function save(options = {}) {
        const { immediateCloudSync = false } = options;
        let payload = JSON.stringify(store);
        if (payload.length > (STORE_WARNING_KB * KB)) {
            trimGameProgress();
            payload = JSON.stringify(store);
        }
        try {
            localStorage.setItem(CONFIG.stateKey, payload);
        } catch (error) {
            if (error?.name !== 'QuotaExceededError') throw error;
            const changed = emergencyCleanup();
            try {
                payload = JSON.stringify(store);
                localStorage.setItem(CONFIG.stateKey, payload);
                window.GhostAnalytics?.track('storage_cleaned', { reason: 'quota_exceeded', cleaned: changed });
            } catch (retryError) {
                console.error('GameCenter: No se pudo guardar estado tras cleanup', retryError);
                showStorageToast('No se puede guardar el progreso. Exporta tu partida y borra datos del sitio.', 'error');
                if (Array.isArray(store.history) && store.history.length) {
                    store.history = [];
                    try { localStorage.setItem(CONFIG.stateKey, JSON.stringify(store)); } catch (_) {}
                }
                return;
            }
        }
        notify({ source: 'save', immediateCloudSync });
        checkStorageSize(payload.length);
    }

    window.LoveArcadeStore = {
        getStore,
        replaceStore,
        save,
        migrate,
        subscribe,
        setStorageToastHandler: (handler) => { showStorageToast = typeof handler === 'function' ? handler : () => {}; },
        isBase64Avatar,
        constants: { KB, AVATAR_MAX_LOCAL_KB, AVATAR_CLEANUP_KB, STORE_WARNING_KB }
    };
})();
