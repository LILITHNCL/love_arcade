import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');

describe('QA (F2b): Economía - spendCoins y addCoins (TKT-005)', () => {
    let Store, Economy, context;
    
    function setupSandbox() {
        const sandbox = createSandbox();
        context = sandbox.context;
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js', 'js/domain/history.js', 'js/domain/economy.js']);
        Store = context.window.LoveArcadeStore;
        Economy = context.window.LoveArcadeEconomy;
    }

    function reset(coins) {
        setupSandbox();
        Store.replaceStore(Store.migrate({ coins, inventory: {}, history: [] }));
    }
    
    const cloneStore = () => JSON.parse(JSON.stringify(Store.getStore()));

    describe('spendCoins', () => {
        test('dado monto decimal, cuando se procesa, entonces usa Math.floor', () => {
            reset(100);
            const result = Economy.spendCoins(10.9);
            assert.equal(result.success, true);
            assert.equal(result.coins, 90); // 100 - floor(10.9)
            assert.equal(Store.getStore().history[0].cantidad, 10);
        });

        test('dado valores numéricos en string, los convierte correctamente gracias a Math.floor', () => {
            reset(100);
            const result = Economy.spendCoins("10");
            assert.equal(result.success, true);
            assert.equal(result.coins, 90);
        });

        test('dado valores inválidos, cuando se procesa, entonces no muta el saldo ni historial', () => {
            reset(100);
            const invalidValues = [NaN, Infinity, -5, 0, "abc", undefined, null, [], {}];
            
            for (const val of invalidValues) {
                const storeBefore = cloneStore();
                const result = Economy.spendCoins(val);
                assert.deepEqual({ ...result }, { success: false, coins: 100 }, `Fallo con valor: ${val}`);
                assert.deepEqual(cloneStore(), storeBefore, `Mutó con valor: ${val}`);
            }
        });

        test('dado saldo insuficiente, cuando se gasta, entonces NO muta el estado', () => {
            reset(50);
            const storeBefore = cloneStore();
            const result = Economy.spendCoins(100);
            assert.deepEqual({ ...result }, { success: false, reason: 'insufficient', coins: 50 });
            assert.deepEqual(cloneStore(), storeBefore);
        });
    });

    describe('addCoins', () => {
        test('dado monto decimal, cuando se procesa, entonces usa Math.floor', () => {
            reset(100);
            const result = Economy.addCoins(15.7);
            assert.equal(result.success, true);
            assert.equal(result.coins, 115); // 100 + floor(15.7)
            assert.equal(Store.getStore().history[0].cantidad, 15);
        });

        test('dado valores inválidos, cuando se procesa, entonces no muta el saldo ni historial', () => {
            reset(100);
            const invalidValues = [NaN, Infinity, -10, 0, "xyz", undefined, null, [], {}];
            
            for (const val of invalidValues) {
                const storeBefore = cloneStore();
                const result = Economy.addCoins(val);
                assert.deepEqual({ ...result }, { success: false, coins: 100 }, `Fallo con valor: ${val}`);
                assert.deepEqual(cloneStore(), storeBefore, `Mutó con valor: ${val}`);
            }
        });
    });

    test('dado operaciones válidas, cuando ocurren en secuencia, entonces el historial queda coherente', () => {
        reset(100);
        Economy.addCoins(50, 'Bono');
        Economy.spendCoins(20, 'Compra local');
        Economy.addCoins(5, 'Extra');

        const history = Store.getStore().history;
        assert.equal(history.length, 3);
        // Las más antiguas primero (push)
        assert.equal(history[0].tipo, 'ingreso');
        assert.equal(history[0].cantidad, 50);
        assert.equal(history[0].motivo, 'Bono');

        assert.equal(history[1].tipo, 'gasto');
        assert.equal(history[1].cantidad, 20);
        assert.equal(history[1].motivo, 'Compra local');

        assert.equal(history[2].tipo, 'ingreso');
        assert.equal(history[2].cantidad, 5);
        assert.equal(history[2].motivo, 'Extra');
    });
});
