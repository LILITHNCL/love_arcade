import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');

describe('TKT-009: Racha y reparación', () => {
    let context, storage, setMockNow;
    let Store, Daily;
    const DAY = 86_400_000;
    
    beforeEach(() => {
        const sandbox = createSandbox();
        context = sandbox.context;
        storage = sandbox.storage;
        setMockNow = sandbox.setMockNow;
        
        loadFiles(context, [
            'js/core/config.js',
            'js/core/state-store.js',
            'js/core/time-sync.js',
            'js/domain/history.js',
            'js/domain/daily-streak.js'
        ]);
        
        Store = context.window.LoveArcadeStore;
        Daily = context.window.LoveArcadeDailyStreak;
    });

    function setTime(timestamp, { desynced = false } = {}) {
        setMockNow(timestamp);
        storage.set('love_arcade_time_cache', JSON.stringify({ drift: 0, desynced, capturedAt: timestamp }));
    }
    
    function reset({ coins = 0, lastClaim = 0, streak = 0, moonExpiry = 0 } = {}) {
        Store.replaceStore(Store.migrate({
            coins,
            daily: { lastClaim, streak },
            buffs: { moonBlessingExpiry: moonExpiry }
        }));
    }

    test('dado el primer reclamo, cuando se pide el bono, entonces la racha es 1 y recompensa 20', () => {
        setTime(Date.UTC(2026, 0, 15, 12));
        reset();
        const result = Daily.claimDaily();
        assert.deepEqual({ success: result.success, reward: result.reward, streak: result.streak }, { success: true, reward: 20, streak: 1 });
        const history = Store.getStore().history;
        assert.equal(history.length, 1);
        assert.equal(history[0].tipo, 'ingreso');
        assert.equal(history[0].cantidad, 20);
    });

    test('dado un reclamo previo hoy, cuando se pide el bono de nuevo el mismo día lógico, entonces es rechazado', () => {
        setTime(Date.UTC(2026, 0, 15, 12));
        reset();
        Daily.claimDaily(); // primer reclamo
        const result = Daily.claimDaily();
        assert.equal(result.success, false);
        assert.equal(Store.getStore().coins, 0); // No muta
        assert.equal(Store.getStore().history.length, 1); // Solo el historial del primer reclamo
    });

    test('dado un reclamo continuo, cuando escala la racha, entonces la recompensa es 20 + 5*(n-1) con tope de 60', () => {
        const now = Date.UTC(2026, 0, 16, 12);
        setTime(now);
        // racha 2 (viene de 1)
        reset({ lastClaim: now - DAY, streak: 1 });
        let result = Daily.claimDaily();
        assert.deepEqual({ reward: result.reward, streak: result.streak }, { reward: 25, streak: 2 }); // 20 + 5
        
        // racha 3
        setTime(now + DAY);
        reset({ lastClaim: now, streak: 2 });
        result = Daily.claimDaily();
        assert.deepEqual({ reward: result.reward, streak: result.streak }, { reward: 30, streak: 3 });

        // tope de 60
        setTime(now + 10 * DAY);
        reset({ lastClaim: now + 9 * DAY, streak: 10 });
        result = Daily.claimDaily();
        assert.equal(result.reward, 60); // 20 + 5*10 = 70 -> tope 60
        assert.equal(result.streak, 11);
    });

    test('dado más de 2 días sin reclamar, cuando se reclama, entonces la racha se reinicia a 1', () => {
        const now = Date.UTC(2026, 0, 20, 12);
        setTime(now);
        reset({ coins: 9, lastClaim: now - 3 * DAY, streak: 8 });
        const result = Daily.claimDaily();
        assert.deepEqual({ reward: result.reward, streak: result.streak, coins: Store.getStore().coins }, { reward: 20, streak: 1, coins: 29 });
    });

    test('dado un reloj negativo, cuando se reclama o repara, entonces se bloquea y no muta', () => {
        const now = Date.UTC(2026, 0, 21, 12);
        setTime(now);
        reset({ coins: 50, lastClaim: now + 1, streak: 4 });
        assert.equal(Daily.claimDaily().success, false);
        assert.equal(Daily.repairDailyStreak().success, false);
        assert.equal(Store.getStore().coins, 50);
        assert.equal((Store.getStore().history || []).length, 0); // Historial intacto
    });

    test('dado un reloj desincronizado (desynced), cuando se reclama o repara, entonces se bloquea', () => {
        const now = Date.UTC(2026, 0, 21, 12);
        setTime(now, { desynced: true });
        reset({ coins: 50, lastClaim: now - DAY, streak: 4 });
        assert.equal(Daily.claimDaily().success, false);
        assert.equal(Daily.repairDailyStreak().success, false);
        assert.equal(Daily.canClaimDaily(), false);
        assert.equal((Store.getStore().history || []).length, 0); // Historial intacto
    });

    test('dado un bono con bendición lunar, cuando se reclama, entonces suma 90 extra incluso en el borde de expiración', () => {
        const now = Date.UTC(2026, 0, 22, 12);
        setTime(now);
        // Expiración 1ms después del now -> borde
        reset({ lastClaim: now - DAY, streak: 1, moonExpiry: now + 1 });
        let result = Daily.claimDaily();
        assert.deepEqual({ base: result.baseReward, bonus: result.moonBonus, reward: result.reward, streak: result.streak }, { base: 25, bonus: 90, reward: 115, streak: 2 });
        
        // Expiración en el mismo milisegundo exacto -> ya expiró
        setTime(now + 2 * DAY);
        reset({ lastClaim: now + DAY, streak: 2, moonExpiry: now + 2 * DAY });
        result = Daily.claimDaily();
        assert.equal(result.moonBonus, 0);
    });

    test('dado un diffDays de 2 y saldo >= 500, cuando se intenta reparar, entonces se cobra 500, se mantiene la racha y se registra en el historial', () => {
        const now = Date.UTC(2026, 0, 25, 12);
        setTime(now);
        reset({ coins: 500, lastClaim: now - 2 * DAY, streak: 6 });
        
        let claimResult = Daily.claimDaily();
        assert.deepEqual({ success: claimResult.success, repairRequired: claimResult.repairRequired, canAffordRepair: claimResult.canAffordRepair }, { success: false, repairRequired: true, canAffordRepair: true });
        
        const repairResult = Daily.repairDailyStreak();
        assert.deepEqual({ success: repairResult.success, streak: repairResult.streak, coins: Store.getStore().coins }, { success: true, streak: 6, coins: 0 });

        // Verificar historial
        const history = Store.getStore().history;
        assert.equal(history.length, 1);
        assert.equal(history[0].tipo, 'gasto');
        assert.equal(history[0].cantidad, 500);
        assert.equal(history[0].motivo, 'Reparación de racha · 6 días');
    });

    test('dado un diffDays de 2 y saldo < 500, cuando se intenta reparar, entonces falla y no muta saldo', () => {
        const now = Date.UTC(2026, 0, 25, 12);
        setTime(now);
        reset({ coins: 499, lastClaim: now - 2 * DAY, streak: 6 });
        
        assert.equal(Daily.getStreakInfo().repairAvailable, true);
        assert.equal(Daily.getStreakInfo().canAffordRepair, false);
        
        const repairResult = Daily.repairDailyStreak();
        assert.equal(repairResult.success, false);
        assert.equal(Store.getStore().coins, 499);
    });

    test('dado un diffDays > 2, cuando se intenta reparar, entonces no está disponible', () => {
        const now = Date.UTC(2026, 0, 25, 12);
        setTime(now);
        reset({ coins: 1000, lastClaim: now - 3 * DAY, streak: 6 });
        
        assert.equal(Daily.getStreakInfo().repairAvailable, false);
        const repairResult = Daily.repairDailyStreak();
        assert.equal(repairResult.success, false);
    });
    test('dado un caché no verificado, cuando se reclama racha, entonces NO debería permitir el reclamo basándose en Date.now()', { todo: 'BUG-F2c-01: Sin caché verificada se permite el reclamo usando Date.now local, permitiendo manipulación del reloj.' }, () => {
        const now = Date.UTC(2026, 0, 26, 12);
        setMockNow(now);
        storage.delete('love_arcade_time_cache');
        reset({ coins: 0, lastClaim: now - DAY, streak: 1 });
        
        const result = Daily.claimDaily();
        // Debería rechazar el reclamo porque la hora no está verificada por red
        assert.equal(result.success, false);
    });
});
