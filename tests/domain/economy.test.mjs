import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');
const storage = new Map();
const context = vm.createContext({
    window: {},
    localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value))
    },
    console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date,
    setTimeout, clearTimeout
});
context.window.window = context.window;
for (const file of ['js/core/config.js', 'js/core/state-store.js', 'js/domain/history.js', 'js/domain/economy.js']) {
    vm.runInContext(read(file), context, { filename: file });
}

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
