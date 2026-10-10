import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { createSandbox, loadFiles } from '../helpers/vm-sandbox.cjs';

const FILES = [
    'js/core/config.js',
    'js/core/state-store.js'
];

describe('QA (F2a): Store - Carga y Migración (TKT-001)', () => {
    it('dado un JSON corrupto, cuando carga, entonces usa defaults sin lanzar excepción', () => {
        const { context, storage } = createSandbox();
        // Configuramos localStorage antes de cargar state-store
        loadFiles(context, ['js/core/config.js']);
        storage.set(context.window.CONFIG.stateKey, '{ "corrupted": json...');
        
        // Cargar store atrapará el error de parseo y usará el default migrado
        loadFiles(context, ['js/core/state-store.js']);
        
        const store = context.window.LoveArcadeStore.getStore();
        assert.ok(store);
        assert.equal(store.coins, context.window.CONFIG.initialCoins);
        assert.equal(store.theme, 'violet');
    });

    it('dado un JSON válido pero primitivo (null o "string"), cuando carga, entonces usa defaults sin lanzar excepción', () => {
        const { context, storage } = createSandbox();
        loadFiles(context, ['js/core/config.js']);
        storage.set(context.window.CONFIG.stateKey, '"soy un string"');
        
        loadFiles(context, ['js/core/state-store.js']);
        
        const store = context.window.LoveArcadeStore.getStore();
        assert.ok(store);
        assert.equal(store.coins, context.window.CONFIG.initialCoins);
        assert.equal(store.theme, 'violet');
    });

    it('dado un JSON vacío o sin nuevos campos, cuando se migra, entonces añade la estructura completa', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js']);
        loadFiles(context, ['js/core/state-store.js']); // Inicia con defaults
        
        const migrado = context.window.LoveArcadeStore.migrate({});
        assert.deepEqual(migrado.daily, { lastClaim: 0, streak: 0 });
        assert.deepEqual(migrado.buffs, { moonBlessingExpiry: 0 });
        assert.equal(migrado.nickname, '');
        assert.equal(migrado.gender, '@');
        assert.deepEqual(migrado.history, []);
        assert.deepEqual(migrado.redeemedHashes, []);
    });

    it('dado un legacy lastDaily, cuando se migra, entonces lo convierte y lo elimina', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        
        const now = Date.now();
        const migrado = context.window.LoveArcadeStore.migrate({ lastDaily: now });
        
        assert.equal(migrado.lastDaily, undefined);
        assert.deepEqual(migrado.daily, { lastClaim: now, streak: 1 });
    });

    it('dado un tema legacy, cuando se migra, entonces usa fallback', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        
        const migradoPink = context.window.LoveArcadeStore.migrate({ theme: 'pink' });
        assert.equal(migradoPink.theme, 'magenta');
        
        const migradoInexistente = context.window.LoveArcadeStore.migrate({ theme: 'inexistente' });
        assert.equal(migradoInexistente.theme, 'violet');
    });

    it('dado un save válido, cuando se migra dos veces, entonces el resultado es idéntico', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        
        const migrado1 = context.window.LoveArcadeStore.migrate({ coins: 100, nickname: 'Hero' });
        const migrado2 = context.window.LoveArcadeStore.migrate(migrado1);
        
        assert.deepEqual(migrado1, migrado2);
    });

    it('dado campos retirados, cuando se migra, entonces se eliminan', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        
        const migrado = context.window.LoveArcadeStore.migrate({
            redeemedCodes: ['A'], missions: {}, claimed_milestones: []
        });
        
        assert.equal(migrado.redeemedCodes, undefined);
        assert.equal(migrado.missions, undefined);
        assert.equal(migrado.claimed_milestones, undefined);
    });

    it('dado casos límite con tipos inválidos, cuando se migra, entonces los sanea', () => {
        const { context } = createSandbox();
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js']);
        
        const migrado = context.window.LoveArcadeStore.migrate({
            gender: 'x', // inválido -> '@'
            nickname: 123, // inválido -> ''
            history: 'not-array', // inválido -> []
            redeemedHashes: null, // inválido -> []
            daily: 'not-object', // inválido -> defaults.daily
            buffs: null // inválido -> defaults.buffs
        });
        
        assert.equal(migrado.gender, '@');
        assert.equal(migrado.nickname, '');
        assert.deepEqual(migrado.history, []);
        assert.deepEqual(migrado.redeemedHashes, []);
        assert.deepEqual(migrado.daily, { lastClaim: 0, streak: 0 });
        assert.deepEqual(migrado.buffs, { moonBlessingExpiry: 0 });
    });
});

describe('QA (F2a): Store - Save y Cuota (TKT-002)', () => {
    it('dado una llamada a save, cuando lanza QuotaExceeded, entonces recorta y reintenta', () => {
        const { context, setQuotaExceeded, storage } = createSandbox();
        loadFiles(context, FILES);
        const storeObj = context.window.LoveArcadeStore;
        
        const base64Avatar = 'data:image/png;base64,' + 'A'.repeat(250 * 1024); // > 200KB
        storeObj.replaceStore({ ...storeObj.getStore(), userAvatar: base64Avatar, history: Array(40).fill({ tipo: 'ingreso' }) });
        
        setQuotaExceeded(true);
        // Deshabilitar la cuota excedida en el reintento
        const originalSetItem = context.localStorage.setItem;
        let attempts = 0;
        context.localStorage.setItem = (key, val) => {
            attempts++;
            if (attempts === 1) {
                const err = new Error('QuotaExceededError');
                err.name = 'QuotaExceededError';
                throw err;
            }
            // reintento ok
            storage.set(key, val);
        };

        storeObj.save();
        
        assert.equal(attempts, 2, 'Debe intentar guardar dos veces');
        const finalStore = storeObj.getStore();
        // El avatar debe haber sido borrado por emergencyCleanup
        assert.equal(finalStore.userAvatar, null);
        // History se recorta a 30
        assert.equal(finalStore.history.length, 30);
    });

    it('dado un doble fallo de cuota, cuando ocurre, entonces no debe vaciar el historial en memoria', { todo: 'BUG-F2a-01: Pérdida silenciosa de historial en doble fallo de cuota' }, () => {
        const { context, setQuotaExceeded } = createSandbox();
        loadFiles(context, FILES);
        const storeObj = context.window.LoveArcadeStore;
        
        storeObj.replaceStore({ ...storeObj.getStore(), history: [{ tipo: 'gasto' }] });
        
        setQuotaExceeded(true);
        // Este throw siempre ocurrirá en el proxy/mock actual para ambos intentos
        
        storeObj.save(); // save no lanza error si el reintento falla, hace catch.
        
        const finalStore = storeObj.getStore();
        
        // El comportamiento correcto debería ser NO vaciar en memoria si no pudo guardarlo
        assert.deepEqual(finalStore.history, [{ tipo: 'gasto' }], 'El historial NO debe vaciarse en memoria si falla el guardado');
    });

    it('dado progreso de >50, cuando el save supera el warning size, entonces recorta el progreso', () => {
        const { context } = createSandbox();
        loadFiles(context, FILES);
        const storeObj = context.window.LoveArcadeStore;
        
        const bigProgress = Array(60).fill('level');
        const bigHistory = Array(100).fill({ tipo: 'A'.repeat(50 * 1024) }); // Forzar > 4000KB
        
        storeObj.replaceStore({ ...storeObj.getStore(), progress: { maze: bigProgress }, history: bigHistory });
        
        storeObj.save();
        
        const finalStore = storeObj.getStore();
        assert.equal(finalStore.progress.maze.length, 50, 'El progreso debe recortarse a 50 al superar límite');
    });

    it('dado un save exitoso, cuando se carga, entonces conserva estado idéntico', () => {
        const { context, storage } = createSandbox();
        loadFiles(context, FILES);
        const storeObj = context.window.LoveArcadeStore;
        
        storeObj.replaceStore({ ...storeObj.getStore(), coins: 1500, nickname: 'Alice' });
        storeObj.save();
        
        // Simular reload en otro sandbox
        const sandbox2 = createSandbox();
        // Copiar storage
        sandbox2.storage.set(context.window.CONFIG.stateKey, storage.get(context.window.CONFIG.stateKey));
        loadFiles(sandbox2.context, FILES);
        
        const store2 = sandbox2.context.window.LoveArcadeStore.getStore();
        assert.equal(store2.coins, 1500);
        assert.equal(store2.nickname, 'Alice');
    });
});
