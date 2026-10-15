import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');

describe('QA (F5): Persistencia al límite — Cuota multiravegador (TKT-021)', () => {
    it('dado un error QuotaExceededError en setItem, cuando se guarda, entonces ejecuta emergencyCleanup eliminando el avatar pesado', () => {
        const { context, storage } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const base64Avatar = 'data:image/png;base64,' + 'A'.repeat(250 * 1024);
        storeObj.replaceStore({ ...storeObj.getStore(), userAvatar: base64Avatar });

        let attempts = 0;
        context.localStorage.setItem = (key, val) => {
            attempts++;
            if (attempts === 1) {
                const err = new Error('QuotaExceededError');
                err.name = 'QuotaExceededError';
                err.code = 22;
                throw err;
            }
            storage.set(key, val);
        };

        storeObj.save();
        assert.equal(storeObj.getStore().userAvatar, null);
    });

    it('dado un error QuotaExceededError en setItem, cuando se reintenta exitosamente, entonces recorta el historial a 30 entradas', () => {
        const { context, storage } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        storeObj.replaceStore({ ...storeObj.getStore(), history: Array(45).fill({ tipo: 'ingreso' }) });

        let attempts = 0;
        context.localStorage.setItem = (key, val) => {
            attempts++;
            if (attempts === 1) {
                const err = new Error('QuotaExceededError');
                err.name = 'QuotaExceededError';
                err.code = 22;
                throw err;
            }
            storage.set(key, val);
        };

        storeObj.save();
        assert.equal(storeObj.getStore().history.length, 30);
    });

    it('dado un doble fallo de QuotaExceededError, cuando se guarda, entonces notifica error mediante showStorageToast', () => {
        const { context, setQuotaExceeded } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;

        let toastType = null;
        storeObj.setStorageToastHandler((_msg, type) => {
            toastType = type;
        });

        setQuotaExceeded(true);
        storeObj.save();

        assert.equal(toastType, 'error');
    });

    it('dado un error NS_ERROR_DOM_QUOTA_REACHED en setItem, cuando se guarda, entonces debería ejecutar emergencyCleanup y reintentar sin relanzar', { todo: 'BUG-F5-01: Store.save solo captura QuotaExceededError e ignora NS_ERROR_DOM_QUOTA_REACHED (Firefox)' }, () => {
        const { context, storage } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const base64Avatar = 'data:image/png;base64,' + 'A'.repeat(250 * 1024);
        storeObj.replaceStore({ ...storeObj.getStore(), userAvatar: base64Avatar });

        let attempts = 0;
        context.localStorage.setItem = (key, val) => {
            attempts++;
            if (attempts === 1) {
                const err = new Error('The quota has been exceeded');
                err.name = 'NS_ERROR_DOM_QUOTA_REACHED';
                err.code = 1014;
                throw err;
            }
            storage.set(key, val);
        };

        assert.doesNotThrow(() => {
            storeObj.save();
        });
    });

    it('dado un error con code 1014 en setItem, cuando se guarda, entonces debería ejecutar emergencyCleanup y reintentar sin relanzar', { todo: 'BUG-F5-01: Store.save solo captura QuotaExceededError e ignora excepciones de cuota con code 1014' }, () => {
        const { context, storage } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const base64Avatar = 'data:image/png;base64,' + 'A'.repeat(250 * 1024);
        storeObj.replaceStore({ ...storeObj.getStore(), userAvatar: base64Avatar });

        let attempts = 0;
        context.localStorage.setItem = (key, val) => {
            attempts++;
            if (attempts === 1) {
                const err = new Error('DOMException quota exceeded');
                err.name = 'DOMException';
                err.code = 1014;
                throw err;
            }
            storage.set(key, val);
        };

        assert.doesNotThrow(() => {
            storeObj.save();
        });
    });
});

describe('QA (F5): Persistencia al límite — Saneamiento de raíz en migración (TKT-021)', () => {
    it('dado una raíz null, cuando se ejecuta migrate, entonces retorna defaults sin claves extra ni excepciones', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const defaults = storeObj.migrate({});
        const result = storeObj.migrate(null);
        assert.deepEqual(result, defaults);
    });

    it('dado una raíz numérica, cuando se ejecuta migrate, entonces retorna defaults sin claves extra ni excepciones', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const defaults = storeObj.migrate({});
        const result = storeObj.migrate(42);
        assert.deepEqual(result, defaults);
    });

    it('dado una raíz booleana, cuando se ejecuta migrate, entonces retorna defaults sin claves extra ni excepciones', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const defaults = storeObj.migrate({});
        const result = storeObj.migrate(false);
        assert.deepEqual(result, defaults);
    });

    it('dado una raíz tipo array, cuando se ejecuta migrate, entonces debería retornar defaults sin propagar claves numéricas espurias', { todo: 'BUG-F5-02: migrate propaga índices numéricos cuando la raíz es un Array' }, () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const result = storeObj.migrate(['progreso_invalido', 123]);
        assert.equal(Object.prototype.hasOwnProperty.call(result, '0'), false);
    });

    it('dado una raíz tipo string, cuando se ejecuta migrate, entonces debería retornar defaults sin propagar claves numéricas espurias', { todo: 'BUG-F5-02: migrate propaga índices numéricos cuando la raíz es un String' }, () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const result = storeObj.migrate('guardado_corrupto');
        assert.equal(Object.prototype.hasOwnProperty.call(result, '0'), false);
    });
});

describe('QA (F5): Persistencia al límite — Store de ~4 MB y podado preventivo (TKT-021)', () => {
    it('dado un store de ~4 MB que supera STORE_WARNING_KB, cuando se guarda, entonces recorta el progreso a un máximo de 50 entradas por juego', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const bigProgress = Array(70).fill('level_1');
        const bigHistory = [{ tipo: 'a'.repeat(4000 * 1024) }];
        storeObj.replaceStore({ ...storeObj.getStore(), progress: { maze: bigProgress }, history: bigHistory });
        storeObj.save();
        assert.equal(storeObj.getStore().progress.maze.length, 50);
    });

    it('dado un store de ~4 MB que supera STORE_WARNING_KB tras el guardado, cuando checkStorageSize evalúa el tamaño, entonces emite showStorageToast con tipo warning', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        let toastType = null;
        storeObj.setStorageToastHandler((_msg, type) => { toastType = type; });
        const bigHistory = [{ tipo: 'a'.repeat(4050 * 1024) }];
        storeObj.replaceStore({ ...storeObj.getStore(), history: bigHistory });
        storeObj.save();
        assert.equal(toastType, 'warning');
    });

    it('dado un store de ~4 MB que supera STORE_WARNING_KB tras el guardado, cuando checkStorageSize evalúa el tamaño, entonces registra el evento storage_warning en GhostAnalytics', () => {
        const { context } = createSandbox();
        let trackedEvent = null;
        context.window.GhostAnalytics = {
            track: (eventName) => { trackedEvent = eventName; }
        };
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const bigHistory = [{ tipo: 'a'.repeat(4050 * 1024) }];
        storeObj.replaceStore({ ...storeObj.getStore(), history: bigHistory });
        storeObj.save();
        assert.equal(trackedEvent, 'storage_warning');
    });

    it('dado un store de ~4 MB serializado, cuando se guarda y se recupera del almacenamiento, entonces completa el ciclo de ida y vuelta conservando los datos íntegros', () => {
        const { context, storage } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const bigString = 'x'.repeat(3800 * 1024);
        storeObj.replaceStore({ ...storeObj.getStore(), nickname: 'JugadorResiliente', inventory: { bigData: bigString } });
        storeObj.save();

        const raw = storage.get(context.window.CONFIG.stateKey);
        const reloaded = JSON.parse(raw);
        assert.equal(reloaded.nickname, 'JugadorResiliente');
    });

    it('dado un store que supera los 4 MB durante emergencyCleanup, cuando se ejecuta el saneamiento de emergencia, entonces vacía el historial por completo', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        const storeObj = context.window.LoveArcadeStore;
        const bigHistory = [
            { tipo: 'a'.repeat(4100 * 1024) },
            { tipo: 'gasto_antiguo' }
        ];
        storeObj.replaceStore({ ...storeObj.getStore(), history: bigHistory });

        let attempts = 0;
        context.localStorage.setItem = () => {
            attempts++;
            if (attempts === 1) {
                const err = new Error('QuotaExceededError');
                err.name = 'QuotaExceededError';
                throw err;
            }
        };

        storeObj.save();
        assert.equal(storeObj.getStore().history.length, 0);
    });
});

describe('QA (F5): Persistencia al límite — Transacción en buyItem ante fallo de cuota (TKT-021)', () => {
    it('dado un fallo de cuota irrecuperable en Store.save al comprar un ítem, cuando se procesa buyItem, entonces debería mantener la coherencia revirtiendo la deducción de monedas en memoria', { todo: 'BUG-F5-03: buyItem no revierte la deducción de monedas en memoria si Store.save falla por cuota (incoherencia transaccional)' }, () => {
        const { context, setQuotaExceeded } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js', 'js/domain/history.js', 'js/domain/economy.js']);
        const storeObj = context.window.LoveArcadeStore;
        const economy = context.window.LoveArcadeEconomy;
        storeObj.replaceStore(storeObj.migrate({ coins: 1000, inventory: {}, history: [] }));

        setQuotaExceeded(true);
        economy.buyItem({ id: 'wallpaper_1', name: 'Wallpaper Galaxia', price: 200 });

        assert.equal(storeObj.getStore().coins, 1000);
    });

    it('dado un fallo de cuota irrecuperable en Store.save al comprar un ítem, cuando se procesa buyItem, entonces debería devolver success false por fallo de persistencia', { todo: 'BUG-F5-03: buyItem reporta success true aunque Store.save falle por cuota' }, () => {
        const { context, setQuotaExceeded } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js', 'js/domain/history.js', 'js/domain/economy.js']);
        const storeObj = context.window.LoveArcadeStore;
        const economy = context.window.LoveArcadeEconomy;
        storeObj.replaceStore(storeObj.migrate({ coins: 1000, inventory: {}, history: [] }));

        setQuotaExceeded(true);
        const result = economy.buyItem({ id: 'wallpaper_1', name: 'Wallpaper Galaxia', price: 200 });

        assert.equal(result.success, false);
    });
});

describe('QA (F5): Persistencia al límite — Resiliencia de _writeTimeCache ante cuota (TKT-021)', () => {
    it('dado localStorage agotado por cuota, cuando _writeTimeCache intenta persistir, entonces captura la excepción silenciosamente sin lanzar error', () => {
        const { context, setQuotaExceeded } = createSandbox();
        loadFiles(context, ['js/core/time-sync.js'], { exposeTimeSyncInternals: true });
        const timeObj = context.window.LoveArcadeTime;
        setQuotaExceeded(true);

        assert.doesNotThrow(() => {
            timeObj._writeTimeCache({ drift: 0, desynced: false });
        });
    });

    it('dado localStorage agotado por cuota donde falló _writeTimeCache, cuando _readTimeCache lee el almacenamiento, entonces reporta verified false de forma segura', () => {
        const { context, setQuotaExceeded } = createSandbox();
        loadFiles(context, ['js/core/time-sync.js'], { exposeTimeSyncInternals: true });
        const timeObj = context.window.LoveArcadeTime;
        setQuotaExceeded(true);

        timeObj._writeTimeCache({ drift: 0, desynced: false });
        const res = timeObj.read();

        assert.equal(res.verified, false);
    });

    it('dado un caché válido previo y un fallo de cuota en _writeTimeCache, cuando se lee el caché, entonces preserva el caché previo sin corromperlo', () => {
        const { context, storage, setQuotaExceeded, setMockNow } = createSandbox();
        setMockNow(1700000000000);
        loadFiles(context, ['js/core/time-sync.js'], { exposeTimeSyncInternals: true });
        const timeObj = context.window.LoveArcadeTime;

        const previousCache = { drift: 1234, desynced: false, capturedAt: 1700000000000 };
        storage.set('love_arcade_time_cache', JSON.stringify(previousCache));

        setQuotaExceeded(true);
        timeObj._writeTimeCache({ drift: 999999, desynced: true });
        const res = timeObj.read();

        assert.equal(res.time, 1700000000000 + 1234);
    });
});
