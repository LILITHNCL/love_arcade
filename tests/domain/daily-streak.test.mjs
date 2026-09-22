import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');
let currentNow = Date.UTC(2026, 0, 15, 12);

class MockDate extends Date {
    static now() { return currentNow; }
}

const storage = new Map();
const localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
};
const context = vm.createContext({
    window: {}, localStorage, Date: MockDate, console, JSON, Math, Object, Array,
    String, Number, Boolean, RegExp, Error, Infinity, setTimeout, clearTimeout
});
context.window.window = context.window;
for (const file of [
    'js/core/config.js',
    'js/core/state-store.js',
    'js/core/time-sync.js',
    'js/domain/history.js',
    'js/domain/daily-streak.js'
]) vm.runInContext(read(file), context, { filename: file });

const { LoveArcadeStore: Store, LoveArcadeDailyStreak: Daily } = context.window;
const DAY = 86_400_000;
function setTime(timestamp, { desynced = false } = {}) {
    currentNow = timestamp;
    localStorage.setItem('love_arcade_time_cache', JSON.stringify({ drift: 0, desynced, capturedAt: timestamp }));
}
function reset({ coins = 0, lastClaim = 0, streak = 0, moonExpiry = 0 } = {}) {
    Store.replaceStore(Store.migrate({
        coins,
        daily: { lastClaim, streak },
        buffs: { moonBlessingExpiry: moonExpiry }
    }));
}

// Día 0: primer reclamo; día 0 posterior: ya reclamado.
setTime(Date.UTC(2026, 0, 15, 12));
reset();
let result = Daily.claimDaily();
assert.deepEqual({ success: result.success, reward: result.reward, streak: result.streak }, { success: true, reward: 20, streak: 1 });
result = Daily.claimDaily();
assert.equal(result.success, false);
assert.match(result.message, /Ya reclamaste/);

// Día 1 continúa; más de dos días reinicia.
setTime(Date.UTC(2026, 0, 16, 12));
reset({ lastClaim: currentNow - DAY, streak: 2 });
result = Daily.claimDaily();
assert.deepEqual({ reward: result.reward, streak: result.streak }, { reward: 30, streak: 3 });
setTime(Date.UTC(2026, 0, 20, 12));
reset({ coins: 9, lastClaim: currentNow - 3 * DAY, streak: 8 });
result = Daily.claimDaily();
assert.deepEqual({ reward: result.reward, streak: result.streak, coins: Store.getStore().coins }, { reward: 20, streak: 1, coins: 29 });

// El orden de guardas bloquea reloj negativo antes de mutar y el caché desynced.
setTime(Date.UTC(2026, 0, 21, 12));
reset({ coins: 50, lastClaim: currentNow + 1, streak: 4 });
assert.match(Daily.claimDaily().message, /inconsistencia horaria/);
assert.equal(Store.getStore().coins, 50);
setTime(currentNow, { desynced: true });
reset({ coins: 50, lastClaim: currentNow - DAY, streak: 4 });
assert.match(Daily.claimDaily().message, /Reloj desincronizado/);
assert.equal(Daily.canClaimDaily(), false);

// Bendición Lunar añade exactamente 90, sin alterar la regla de racha.
setTime(Date.UTC(2026, 0, 22, 12));
reset({ lastClaim: currentNow - DAY, streak: 1, moonExpiry: currentNow + DAY });
result = Daily.claimDaily();
assert.deepEqual({ base: result.baseReward, bonus: result.moonBonus, reward: result.reward, streak: result.streak }, { base: 25, bonus: 90, reward: 115, streak: 2 });

// Día 2 exige reparación; la reparación conserva la racha y cobra 500, o falla sin saldo.
setTime(Date.UTC(2026, 0, 25, 12));
reset({ coins: 700, lastClaim: currentNow - 2 * DAY, streak: 6 });
result = Daily.claimDaily();
assert.deepEqual({ success: result.success, repairRequired: result.repairRequired, canAffordRepair: result.canAffordRepair }, { success: false, repairRequired: true, canAffordRepair: true });
result = Daily.repairDailyStreak();
assert.deepEqual({ success: result.success, streak: result.streak, coins: Store.getStore().coins }, { success: true, streak: 6, coins: 200 });
reset({ coins: 499, lastClaim: currentNow - 2 * DAY, streak: 6 });
assert.equal(Daily.getStreakInfo().repairAvailable, true);
assert.equal(Daily.getStreakInfo().canAffordRepair, false);
result = Daily.repairDailyStreak();
assert.equal(result.success, false);
assert.equal(Store.getStore().coins, 499);

console.log('Daily streak domain tests passed.');
