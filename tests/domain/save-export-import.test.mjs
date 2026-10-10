import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandbox, loadFiles } from '../helpers/vm-sandbox.cjs';

test('Game Center - Export/Import Save', async (t) => {
    function setup() {
        const sandbox = createSandbox();
        sandbox.context.workerTask = () => Promise.reject(new Error('Worker mock'));
        sandbox.context.btoa = globalThis.btoa || ((str) => Buffer.from(str, 'binary').toString('base64'));
        sandbox.context.atob = globalThis.atob || ((str) => Buffer.from(str, 'base64').toString('binary'));

        loadFiles(sandbox.context, [
            'js/core/config.js',
            'js/core/utils.js',
            'js/core/state-store.js',
            'js/domain/history.js',
            'js/domain/economy.js', 'js/domain/promo-codes.js', 'js/domain/moon-blessing.js', 'js/domain/identity.js', 'js/domain/avatar.js', 'js/domain/daily-streak.js', 'js/domain/theming.js',
            'js/domain/game-center.js'
        ]);

        const { GameCenter, LoveArcadeStore: Store } = sandbox.context.window;
        const initialState = Store.migrate({ coins: 150, history: [] });
        Store.replaceStore(initialState);
        return { GameCenter, Store };
    }

    await t.test('dado estado válido, cuando se exporta e importa, entonces conserva el estado', async () => {
        const { GameCenter, Store } = setup();
        Store.getStore().coins = 987;
        const exported = await GameCenter.exportSave();
        assert.ok(typeof exported === 'string' && exported.length > 10);
        
        Store.getStore().coins = 0;
        const res = await GameCenter.importSave(exported);
        assert.equal(res.success, true, res.message);
        assert.equal(Store.getStore().coins, 987);
    });

    await t.test('dado corrupción accidental (base64 truncado, JSON roto, un carácter alterado), cuando se importa, entonces rechaza sin mutar P0', async () => {
        const { GameCenter, Store } = setup();
        Store.getStore().coins = 500;
        const originalStateJSON = JSON.stringify(Store.getStore());
        
        const exported = await GameCenter.exportSave();
        
        const truncado = exported.slice(0, -5);
        const resTrunc = await GameCenter.importSave(truncado);
        assert.equal(resTrunc.success, false);
        assert.equal(JSON.stringify(Store.getStore()), originalStateJSON);

        const alterado = exported.substring(0, 10) + (exported[10] === 'A' ? 'B' : 'A') + exported.substring(11);
        const resAlt = await GameCenter.importSave(alterado);
        assert.equal(resAlt.success, false);
        assert.equal(JSON.stringify(Store.getStore()), originalStateJSON);

        const jsonRoto = Buffer.from('{"data": {', 'utf-8').toString('base64');
        const resRoto = await GameCenter.importSave(jsonRoto);
        assert.equal(resRoto.success, false);
        assert.equal(JSON.stringify(Store.getStore()), originalStateJSON);
    });

    await t.test('dado payload modificado con checksum falso, cuando se importa, entonces rechaza sin mutar', async () => {
        const { GameCenter, Store } = setup();
        Store.getStore().coins = 500;
        const originalStateJSON = JSON.stringify(Store.getStore());

        const maliciousPayload = {
            data: { coins: 9999, progress: {}, buffs: {} },
            checksum: 'fake_hash'
        };
        const malBase64 = Buffer.from(JSON.stringify(maliciousPayload), 'utf-8').toString('base64');
        
        const res = await GameCenter.importSave(malBase64);
        assert.equal(res.success, false);
        assert.equal(JSON.stringify(Store.getStore()), originalStateJSON);
    });

    await t.test('dado payload sin checksum (rama legacy), cuando se importa, entonces se acepta (R3)', async (t) => {
        const { GameCenter, Store } = setup();
        const legacyPayload = { coins: 9999, progress: {}, buffs: {} };
        const legacyBase64 = Buffer.from(JSON.stringify(legacyPayload), 'utf-8').toString('base64');
        
        const res = await GameCenter.importSave(legacyBase64);
        
        // BUG R3: Confirma si importa cualquier JSON con coins numérico
        // Se anota con todo para reportar como BUG-F2d-01
        t.todo('BUG-F2d-01: payload legacy sin checksum es importado permitiendo inyección');
        assert.equal(res.success, true, res.message);
        assert.equal(Store.getStore().coins, 9999);
    });

    await t.test('dado payload JSON válido sin monedas, cuando se importa, entonces rechaza (validación P0)', async () => {
        const { GameCenter } = setup();
        const sinCoinsLegacy = Buffer.from('{"progress": {}}', 'utf-8').toString('base64');
        const res = await GameCenter.importSave(sinCoinsLegacy);
        assert.equal(res.success, false);
    });
});
