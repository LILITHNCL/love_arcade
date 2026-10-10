import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');

const { context, storage } = createSandbox();
loadFiles(context, ['js/core/config.js', 'js/core/state-store.js', 'js/domain/history.js', 'js/domain/economy.js']);

const { LoveArcadeStore: Store, LoveArcadeEconomy: Economy, ECONOMY } = context.window;
const item = { id: 'wallpaper-1', name: 'Wallpaper de prueba', price: 100 };
function reset(coins) {
    Store.replaceStore(Store.migrate({ coins, inventory: {}, history: [] }));
    ECONOMY.isSaleActive = false;
}

// Saldo insuficiente: no compra, no inventario ni transacción.
reset(99);
assert.deepEqual({ ...Economy.buyItem(item) }, { success: false, reason: 'coins' });
assert.equal(Economy.getBoughtCount(item.id), 0);
assert.equal(Store.getStore().history.length, 0);

// Precio normal: cobra el precio completo y devuelve el cashback configurado.
reset(1_000);
let result = Economy.buyItem(item);
assert.deepEqual({ ...result }, { success: true, finalPrice: 100, cashback: 10 });
assert.equal(Economy.getBalance(), 910);
assert.equal(Economy.getBoughtCount(item.id), 1);
assert.deepEqual(Store.getStore().history.map(({ tipo, cantidad }) => ({ tipo, cantidad })), [
    { tipo: 'gasto', cantidad: 100 },
    { tipo: 'ingreso', cantidad: 10 }
]);
assert.deepEqual({ ...Economy.buyItem(item) }, { success: false, reason: 'owned' });

// Oferta: el descuento se calcula antes del cashback.
reset(1_000);
ECONOMY.isSaleActive = true;
result = Economy.buyItem(item);
assert.deepEqual({ ...result }, { success: true, finalPrice: 80, cashback: 8 });
assert.equal(Economy.getBalance(), 928);

console.log('Economy domain tests passed.');
