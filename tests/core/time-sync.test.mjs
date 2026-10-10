import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');

describe('TKT-007: Día lógico', () => {
    let context, storage, setMockNow;
    
    beforeEach(() => {
        const sandbox = createSandbox();
        context = sandbox.context;
        storage = sandbox.storage;
        setMockNow = sandbox.setMockNow;
        loadFiles(context, ['js/core/time-sync.js']);
    });

    test('dado un reclamo a las 02:59, cuando se consulta a las 03:00 del mismo día natural, entonces cuenta como un día de diferencia', () => {
        const claimTime = new Date(2026, 0, 15, 2, 59, 59).getTime(); // 02:59:59
        const checkTime = new Date(2026, 0, 15, 3, 0, 0).getTime();   // 03:00:00
        const diff = context.window.LoveArcadeTime.dayDiff(checkTime, claimTime);
        assert.equal(diff, 1);
    });

    test('dado un reclamo, cuando se consulta a medianoche, entonces sigue siendo el mismo día lógico (diff = 0)', () => {
        const claimTime = new Date(2026, 0, 15, 20, 0, 0).getTime(); // 20:00:00
        const checkTime = new Date(2026, 0, 16, 0, 0, 0).getTime();  // Medianoche
        const diff = context.window.LoveArcadeTime.dayDiff(checkTime, claimTime);
        assert.equal(diff, 0);
    });
    
    test('dado un reclamo el último día del mes, cuando se consulta al mes siguiente a las 03:00, entonces la diferencia es 1', () => {
        const claimTime = new Date(2026, 0, 31, 15, 0, 0).getTime(); // Ene 31
        const checkTime = new Date(2026, 1, 1, 3, 0, 0).getTime();   // Feb 1 03:00
        const diff = context.window.LoveArcadeTime.dayDiff(checkTime, claimTime);
        assert.equal(diff, 1);
    });

    test('dado un reclamo el último día del año, cuando se consulta al año siguiente a las 03:00, entonces la diferencia es 1', () => {
        const claimTime = new Date(2026, 11, 31, 15, 0, 0).getTime(); // Dic 31
        const checkTime = new Date(2027, 0, 1, 3, 0, 0).getTime();    // Ene 1 03:00
        const diff = context.window.LoveArcadeTime.dayDiff(checkTime, claimTime);
        assert.equal(diff, 1);
    });

    test('dado un reclamo el 28 de febrero en año bisiesto, cuando se consulta el 29 de febrero a las 03:00, entonces la diferencia es 1', () => {
        const claimTime = new Date(2024, 1, 28, 15, 0, 0).getTime(); // Feb 28 2024
        const checkTime = new Date(2024, 1, 29, 3, 0, 0).getTime();  // Feb 29 2024 03:00
        const diff = context.window.LoveArcadeTime.dayDiff(checkTime, claimTime);
        assert.equal(diff, 1);
    });

    test('dado un tiempo actual, cuando se consulta nextResetTime, entonces devuelve el próximo 03:00', () => {
        const now1 = new Date(2026, 0, 15, 2, 59, 59).getTime();
        const expectedReset1 = new Date(2026, 0, 15, 3, 0, 0).getTime();
        assert.equal(context.window.LoveArcadeTime.nextResetTime(now1), expectedReset1);

        const now2 = new Date(2026, 0, 15, 3, 0, 0).getTime();
        const expectedReset2 = new Date(2026, 0, 16, 3, 0, 0).getTime();
        assert.equal(context.window.LoveArcadeTime.nextResetTime(now2), expectedReset2);
        
        const now3 = new Date(2026, 0, 15, 23, 0, 0).getTime();
        const expectedReset3 = new Date(2026, 0, 16, 3, 0, 0).getTime();
        assert.equal(context.window.LoveArcadeTime.nextResetTime(now3), expectedReset3);
    });
});

describe('TKT-008: Caché de tiempo', () => {
    let context, storage, setMockNow;
    
    beforeEach(() => {
        const sandbox = createSandbox();
        context = sandbox.context;
        storage = sandbox.storage;
        setMockNow = sandbox.setMockNow;
        loadFiles(context, ['js/core/time-sync.js']);
    });

    test('dado ningún caché guardado, cuando se lee el tiempo, entonces verified es false y retorna Date.now()', () => {
        const now = new Date(2026, 0, 15, 12, 0, 0).getTime();
        setMockNow(now);
        const result = context.window.LoveArcadeTime.read();
        assert.equal(result.verified, false);
        assert.equal(result.time, now);
        assert.equal(result.desynced, false);
    });

    test('dado un caché de 4h y 1ms (caducado), cuando se lee el tiempo, entonces verified es false', () => {
        const capturedAt = new Date(2026, 0, 15, 12, 0, 0).getTime();
        const now = capturedAt + (4 * 60 * 60 * 1000) + 1;
        storage.set('love_arcade_time_cache', JSON.stringify({ drift: 5000, desynced: false, capturedAt }));
        setMockNow(now);

        const result = context.window.LoveArcadeTime.read();
        assert.equal(result.verified, false);
        assert.equal(result.time, now + 5000);
    });
    
    test('dado un caché de 3h 59m (válido), cuando se lee el tiempo, entonces verified es true', () => {
        const capturedAt = new Date(2026, 0, 15, 12, 0, 0).getTime();
        const now = capturedAt + (3 * 60 * 60 * 1000) + (59 * 60 * 1000);
        storage.set('love_arcade_time_cache', JSON.stringify({ drift: 5000, desynced: false, capturedAt }));
        setMockNow(now);

        const result = context.window.LoveArcadeTime.read();
        assert.equal(result.verified, true);
        assert.equal(result.time, now + 5000);
    });

    test('dado un caché válido pero desynced, cuando se lee el tiempo, entonces desynced es true', () => {
        const capturedAt = new Date(2026, 0, 15, 12, 0, 0).getTime();
        const now = capturedAt + 1000;
        storage.set('love_arcade_time_cache', JSON.stringify({ drift: 1000000, desynced: true, capturedAt }));
        setMockNow(now);

        const result = context.window.LoveArcadeTime.read();
        assert.equal(result.verified, true);
        assert.equal(result.desynced, true);
        assert.equal(result.time, now + 1000000);
    });

    test('dado un JSON corrupto en caché, cuando se lee el tiempo, entonces se maneja graciosamente con verified false', () => {
        const now = new Date(2026, 0, 15, 12, 0, 0).getTime();
        storage.set('love_arcade_time_cache', '{ invalid json');
        setMockNow(now);

        const result = context.window.LoveArcadeTime.read();
        assert.equal(result.verified, false);
        assert.equal(result.time, now);
    });

    test('dado un JSON con tipos inválidos en caché, cuando se lee el tiempo, entonces se maneja sin romper', () => {
        const now = new Date(2026, 0, 15, 12, 0, 0).getTime();
        storage.set('love_arcade_time_cache', JSON.stringify({ drift: "bad", desynced: 123, capturedAt: "what" }));
        setMockNow(now);

        const result = context.window.LoveArcadeTime.read();
        assert.equal(result.verified, false);
        assert.equal(result.desynced, true); // Boolean(123) is true
    });
});
