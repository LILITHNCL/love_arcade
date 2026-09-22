import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');
const storage = new Map();
const validHash = '5136694194f15aecc6eae3645b56b6a8273876d6d830709cf7591dd89a05b066';
const context = vm.createContext({
    window: {
        LoveArcadeUtils: {
            sha256: async (code) => code === 'VALIDO' ? validHash : 'not-a-valid-promo-hash'
        }
    },
    localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, String(value))
    },
    console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date,
    setTimeout, clearTimeout
});
context.window.window = context.window;
for (const file of ['js/core/config.js', 'js/core/state-store.js', 'js/domain/history.js', 'js/domain/promo-codes.js']) {
    vm.runInContext(read(file), context, { filename: file });
}

const { LoveArcadeStore: Store, LoveArcadePromoCodes: PromoCodes } = context.window;
function reset() {
    Store.replaceStore(Store.migrate({ coins: 0, redeemedHashes: [], history: [] }));
}

// Código inválido: no altera el estado.
reset();
let result = await PromoCodes.redeemPromoCode('invalido');
assert.deepEqual({ ...result }, { success: false, message: 'Código inválido' });
assert.equal(Store.getStore().coins, 0);
assert.deepEqual([...Store.getStore().redeemedHashes], []);

// Código válido: normaliza el texto, suma el premio y registra una única transacción.
result = await PromoCodes.redeemPromoCode(' valido ');
assert.deepEqual({ ...result }, { success: true, reward: 500, message: '¡+500 Monedas!' });
assert.equal(Store.getStore().coins, 500);
assert.deepEqual([...Store.getStore().redeemedHashes], [validHash]);
assert.deepEqual(
    Store.getStore().history.map(({ tipo, cantidad, motivo }) => ({ tipo, cantidad, motivo })),
    [{ tipo: 'ingreso', cantidad: 500, motivo: 'Código canjeado' }]
);

// El mismo código no puede volver a acreditar monedas ni crear otra transacción.
result = await PromoCodes.redeemPromoCode('VALIDO');
assert.deepEqual({ ...result }, { success: false, message: 'Ya canjeaste este código' });
assert.equal(Store.getStore().coins, 500);
assert.equal(Store.getStore().history.length, 1);

console.log('Promo codes domain tests passed.');
