import test from 'node:test';
import assert from 'node:assert/strict';
import { createSandbox, loadFiles } from '../helpers/vm-sandbox.cjs';

test('Promo Codes', async (t) => {
    // Usamos el código promocional SOFIA (500 monedas)
    // Hash: 582969a27a84f2b65970db6cb1907706e6518405ced1876352f6627d794b430e
    const validCode = 'SOFIA';
    const validHash = '582969a27a84f2b65970db6cb1907706e6518405ced1876352f6627d794b430e';

    function setup() {
        const sandbox = createSandbox();
        loadFiles(sandbox.context, ['js/core/config.js', 'js/core/utils.js', 'js/core/state-store.js', 'js/domain/history.js', 'js/domain/promo-codes.js']);
        const { LoveArcadeStore: Store, LoveArcadePromoCodes: PromoCodes } = sandbox.context.window;
        Store.replaceStore(Store.migrate({ coins: 0, redeemedHashes: [], history: [] }));
        return { Store, PromoCodes };
    }

    await t.test('dado un código inválido, cuando se canjea, entonces rechaza sin mutar el estado', async () => {
        const { Store, PromoCodes } = setup();
        const result = await PromoCodes.redeemPromoCode('invalido');
        assert.deepEqual({ ...result }, { success: false, message: 'Código inválido' });
        assert.equal(Store.getStore().coins, 0);
        assert.deepEqual([...Store.getStore().redeemedHashes], []);
        assert.equal(Store.getStore().history.length, 0);
    });

    await t.test('dado un código válido, cuando se canjea, entonces suma monedas y normaliza', async () => {
        const { Store, PromoCodes } = setup();
        // Normalización: espacios y minúsculas
        const result = await PromoCodes.redeemPromoCode(' sOfiA ');
        assert.deepEqual({ ...result }, { success: true, reward: 500, message: '¡+500 Monedas!' });
        assert.equal(Store.getStore().coins, 500);
        assert.deepEqual([...Store.getStore().redeemedHashes], [validHash]);
        assert.deepEqual(
            Store.getStore().history.map(({ tipo, cantidad, motivo }) => ({ tipo, cantidad, motivo })),
            [{ tipo: 'ingreso', cantidad: 500, motivo: 'Código canjeado' }]
        );
    });

    await t.test('dado un código ya canjeado, cuando se intenta de nuevo (incluso con otros casos/espacios), entonces rechaza', async () => {
        const { Store, PromoCodes } = setup();
        await PromoCodes.redeemPromoCode(validCode);
        
        const result = await PromoCodes.redeemPromoCode(' sOfIa '); // Variación de mayúsculas/minúsculas y espacios
        assert.deepEqual({ ...result }, { success: false, message: 'Ya canjeaste este código' });
        assert.equal(Store.getStore().coins, 500); // Sigue siendo 500
        assert.equal(Store.getStore().history.length, 1);
    });

    await t.test('dado un código válido solo con espacios alrededor, cuando se canjea, entonces acepta (trim)', async () => {
        const { Store, PromoCodes } = setup();
        const result = await PromoCodes.redeemPromoCode(`   ${validCode}  `);
        assert.equal(result.success, true);
        assert.equal(Store.getStore().coins, 500);
    });

    await t.test('dado un código válido solo en minúsculas, cuando se canjea, entonces acepta (mayúsculas)', async () => {
        const { Store, PromoCodes } = setup();
        const result = await PromoCodes.redeemPromoCode(validCode.toLowerCase());
        assert.equal(result.success, true);
        assert.equal(Store.getStore().coins, 500);
    });

    function assertIntacto(Store) {
        const store = Store.getStore();
        assert.equal(store.coins, 0);
        assert.deepEqual([...store.redeemedHashes], []);
        assert.equal(store.history.length, 0);
    }

    await t.test('dado cadena vacía o solo espacios, cuando se canjea, entonces devuelve success:false sin mutar', async () => {
        for (const input of ['', '   ']) {
            const { Store, PromoCodes } = setup();
            const result = await PromoCodes.redeemPromoCode(input);
            assert.deepEqual({ ...result }, { success: false, message: 'Código inválido' });
            assertIntacto(Store);
        }
    });

    await t.test('dado null, undefined o número, cuando se canjea, entonces debería devolver success:false sin mutar', { todo: 'BUG-F2d-02: redeemPromoCode lanza TypeError con entradas no-string en vez de devolver success:false' }, async () => {
        for (const input of [null, undefined, 1234]) {
            const { Store, PromoCodes } = setup();
            const res = await PromoCodes.redeemPromoCode(input);
            assert.equal(res?.success, false, `debe devolver success: false para ${String(input)}`);
            assertIntacto(Store);
        }
    });
});
