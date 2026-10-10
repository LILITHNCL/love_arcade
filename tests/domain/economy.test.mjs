import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');

describe('QA (F2b): Economía - buyItem (TKT-004)', () => {
    let Store, Economy, ECONOMY, context;
    
    function setupSandbox() {
        const sandbox = createSandbox();
        context = sandbox.context;
        loadFiles(context, ['js/core/config.js', 'js/core/state-store.js', 'js/domain/history.js', 'js/domain/economy.js']);
        Store = context.window.LoveArcadeStore;
        Economy = context.window.LoveArcadeEconomy;
        ECONOMY = context.window.ECONOMY;
        ECONOMY.isSaleActive = false;
    }

    function reset(coins) {
        setupSandbox();
        Store.replaceStore(Store.migrate({ coins, inventory: {}, history: [] }));
    }
    
    const cloneStore = () => structuredClone(Store.getStore());

    test('dado saldo justo, cuando se compra, entonces saldo llega a cero y se registra el cashback', () => {
        reset(100);
        const item = { id: 'item-1', name: 'Item', price: 100 };
        const result = Economy.buyItem(item);
        
        assert.equal(result.success, true);
        assert.equal(result.finalPrice, 100);
        assert.equal(Economy.getBalance(), 10); 
        assert.equal(Economy.getBoughtCount(item.id), 1);
        
        const history = Store.getStore().history;
        assert.equal(history.length, 2);
        const types = history.map(h => h.tipo).sort();
        assert.deepEqual(types, ['gasto', 'ingreso']);
    });

    test('dado ya poseído, cuando se compra, entonces no cobra dos veces', () => {
        reset(500);
        const item = { id: 'item-1', name: 'Item', price: 100 };
        Economy.buyItem(item);
        
        const storeBefore = cloneStore();
        const result = Economy.buyItem(item);
        
        assert.deepEqual({ ...result }, { success: false, reason: 'owned' });
        // Comprobar sin prototipos porque estructuredClone/VM pueden diverger en strict mode
        assert.deepEqual(JSON.parse(JSON.stringify(Store.getStore())), JSON.parse(JSON.stringify(storeBefore)), 'El store no debe mutar');
    });

    test('dado oferta activa, cuando se compra, entonces usa redondeo hacia abajo para el precio y cashback', () => {
        reset(500);
        const item = { id: 'item-1', name: 'Item', price: 99 };
        ECONOMY.isSaleActive = true;
        const result = Economy.buyItem(item);
        
        assert.equal(result.success, true);
        assert.equal(result.finalPrice, 79);
        assert.equal(result.cashback, 7);
        assert.equal(Economy.getBalance(), 500 - 79 + 7);
    });

    test('dado cashback 0, cuando se compra, entonces no añade transacción de ingreso', () => {
        reset(500);
        const item = { id: 'item-1', name: 'Item', price: 9 };
        const result = Economy.buyItem(item);
        
        assert.equal(result.success, true);
        assert.equal(result.cashback, 0);
        assert.equal(Store.getStore().history.length, 1);
        assert.equal(Store.getStore().history[0].tipo, 'gasto');
    });

    test('dado precio 0, cuando se compra, entonces lo permite sin cobrar ni cashback', () => {
        reset(500);
        const item = { id: 'item-1', name: 'Item', price: 0 };
        const result = Economy.buyItem(item);
        
        assert.equal(result.success, true);
        assert.equal(result.finalPrice, 0);
        assert.equal(result.cashback, 0);
        assert.equal(Economy.getBalance(), 500);
    });

    test('dado saldo insuficiente, cuando se compra, entonces no muta nada', () => {
        reset(99);
        const item = { id: 'item-1', name: 'Item', price: 100 };
        const storeBefore = cloneStore();
        
        const result = Economy.buyItem(item);
        
        assert.deepEqual({ ...result }, { success: false, reason: 'coins' });
        assert.deepEqual(JSON.parse(JSON.stringify(Store.getStore())), JSON.parse(JSON.stringify(storeBefore)), 'El store no debe mutar en absoluto');
    });

    test('dado llamador alterado (R12), cuando pasa precio menor al catálogo, entonces confía en el parámetro', { todo: 'BUG-F2b-01: buyItem confía ciegamente en el precio pasado como argumento (riesgo de alteración en cliente)' }, () => {
        reset(100);
        // El catálogo original diría 5000, pero el atacante/bridge pasa 1
        const fakeItem = { id: 'item-premium', name: 'Item', price: 1 };
        
        const result = Economy.buyItem(fakeItem);
        
        // Assertions for expected correct behavior would fail here since it currently accepts it
        // The bug is that it accepts it, we expect it to reject if we wanted it fixed.
        // We assert what a FIX would do (reject or use real price), so it fails now.
        assert.equal(result.success, false, 'No debería confiar en el price del parámetro, debería leer un catálogo seguro');
    });
});

