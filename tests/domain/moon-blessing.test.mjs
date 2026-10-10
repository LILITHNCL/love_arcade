import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandbox, loadFiles } from '../helpers/vm-sandbox.cjs';

test('Bendición Lunar', async (t) => {
    const fakeNow = 1700000000000;
    const DURATION_MS = 7 * 86400000;
    const files = ['js/core/config.js', 'js/core/state-store.js', 'js/domain/history.js', 'js/domain/moon-blessing.js'];

    await t.test('dado saldo suficiente, cuando se compra, entonces cobra 100 y fija 7 días', () => {
        const sandbox = createSandbox();
        sandbox.setMockNow(fakeNow);
        loadFiles(sandbox.context, files);

        const Store = sandbox.context.window.LoveArcadeStore;
        Store.replaceStore({ coins: 150, buffs: { moonBlessingExpiry: 0 }, history: [] });

        const result = sandbox.context.window.LoveArcadeMoonBlessing.buyMoonBlessing();

        assert.equal(result.success, true);
        const store = Store.getStore();
        assert.equal(store.coins, 50);
        assert.equal(store.buffs.moonBlessingExpiry, fakeNow + DURATION_MS);
        
        const lastTx = store.history[store.history.length - 1];
        assert.equal(lastTx.cantidad, 100);
        assert.equal(lastTx.tipo, 'gasto');
    });

    await t.test('dado saldo exacto 100 y saldo 99, cuando se compra, entonces 100 pasa y 99 falla sin mutar', () => {
        const sandbox = createSandbox();
        sandbox.setMockNow(fakeNow);
        loadFiles(sandbox.context, files);

        const Store = sandbox.context.window.LoveArcadeStore;
        
        Store.replaceStore({ coins: 99, buffs: { moonBlessingExpiry: 0 }, history: [] });
        const resultFails = sandbox.context.window.LoveArcadeMoonBlessing.buyMoonBlessing();
        assert.equal(resultFails.success, false);
        let store = Store.getStore();
        assert.equal(store.coins, 99);
        assert.equal(store.buffs.moonBlessingExpiry, 0);

        Store.replaceStore({ coins: 100, buffs: { moonBlessingExpiry: 0 }, history: [] });
        const resultPasses = sandbox.context.window.LoveArcadeMoonBlessing.buyMoonBlessing();
        assert.equal(resultPasses.success, true);
        store = Store.getStore();
        assert.equal(store.coins, 0);
        assert.equal(store.buffs.moonBlessingExpiry, fakeNow + DURATION_MS);
    });

    await t.test('dado bendición activa, cuando se compra, entonces acumula días sobre la expiración vigente', () => {
        const sandbox = createSandbox();
        sandbox.setMockNow(fakeNow);
        loadFiles(sandbox.context, files);

        const Store = sandbox.context.window.LoveArcadeStore;
        const currentExpiry = fakeNow + 100000;
        Store.replaceStore({ coins: 200, buffs: { moonBlessingExpiry: currentExpiry }, history: [] });

        sandbox.context.window.LoveArcadeMoonBlessing.buyMoonBlessing();
        
        const store = Store.getStore();
        assert.equal(store.coins, 100);
        assert.equal(store.buffs.moonBlessingExpiry, currentExpiry + DURATION_MS);
    });

    await t.test('dado valores inválidos (0, negativos, NaN, Infinity), cuando se extienden días, entonces rechaza', () => {
        const sandbox = createSandbox();
        sandbox.setMockNow(fakeNow);
        loadFiles(sandbox.context, files);

        const Store = sandbox.context.window.LoveArcadeStore;
        Store.replaceStore({ coins: 100, buffs: { moonBlessingExpiry: 0 }, history: [] });
        
        const cases = [0, -5, NaN, Infinity];
        for (const val of cases) {
            const res = sandbox.context.window.LoveArcadeMoonBlessing.extendMoonBlessingDays(val);
            assert.equal(res.success, false, `falló para valor: ${val}`);
        }
        
        const store = Store.getStore();
        assert.equal(store.buffs.moonBlessingExpiry, 0);
    });

    await t.test('dado valor string "5" y decimal "5.5", cuando se extienden días, entonces extrae entero y funciona', () => {
        const sandbox = createSandbox();
        sandbox.setMockNow(fakeNow);
        loadFiles(sandbox.context, files);

        const Store = sandbox.context.window.LoveArcadeStore;
        Store.replaceStore({ coins: 100, buffs: { moonBlessingExpiry: fakeNow + 1000 }, history: [] });
        
        const resStr = sandbox.context.window.LoveArcadeMoonBlessing.extendMoonBlessingDays("5");
        assert.equal(resStr.success, true);
        let store = Store.getStore();
        assert.equal(store.buffs.moonBlessingExpiry, (fakeNow + 1000) + (5 * 86400000));

        const resDec = sandbox.context.window.LoveArcadeMoonBlessing.extendMoonBlessingDays(5.9);
        assert.equal(resDec.success, true);
        store = Store.getStore();
        assert.equal(store.buffs.moonBlessingExpiry, (fakeNow + 1000) + (10 * 86400000)); // It accumulated 5 (first) + 5 (second)
    });
});
