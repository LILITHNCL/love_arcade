import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');
const storage = new Map();
const context = vm.createContext({
    window: { LoveArcadeUtils: { sha256: async () => 'checksum' }, workerTask: async () => { throw new Error('offline'); } },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, Date,
    Uint8Array, TextEncoder, TextDecoder, btoa, atob, setTimeout, clearTimeout
});
context.window.window = context.window;
for (const file of [
    'js/core/config.js', 'js/core/state-store.js', 'js/core/time-sync.js',
    'js/domain/history.js', 'js/domain/economy.js', 'js/domain/promo-codes.js',
    'js/domain/moon-blessing.js', 'js/domain/identity.js', 'js/domain/daily-streak.js',
    'js/domain/avatar.js', 'js/domain/theming.js', 'js/domain/game-center.js'
]) vm.runInContext(read(file), context, { filename: file });

const expectedKeys = [
    'completeLevel', 'buyItem', 'spendCoins', 'getBoughtCount', 'getBalance', 'getInventory', 'addCoins',
    'getRedeemedCount', 'getDownloadUrl', 'getHistory', 'redeemPromoCode', 'claimDaily', 'repairDailyStreak',
    'getNextDailyResetTime', 'canClaimDaily', 'getStreakInfo', 'buyMoonBlessing', 'extendMoonBlessingDays',
    'getMoonBlessingStatus', 'exportSave', 'importSave', 'setAvatar', 'setAvatarPath', 'getAvatar', 'setTheme',
    'getTheme', 'setIdentity', 'getIdentity', 'hasIdentity', 'getState', 'syncUI'
].sort();
const gameCenter = context.window.GameCenter;
assert.deepEqual(Object.keys(gameCenter).sort(), expectedKeys, 'GameCenter must preserve its public method surface.');
for (const key of expectedKeys) assert.equal(typeof gameCenter[key], 'function', `${key} must remain callable.`);

const state = gameCenter.getState();
assert.deepEqual({ ...state }, { coins: 0, streak: 0, theme: 'violet', moonBlessingExpiry: 0, nickname: '', gender: '@' });
let receivedScope = null;
context.window.LoveArcadeGameCenter.setUIRefreshHandler((scope) => { receivedScope = scope; });
const scope = { id: 'profile-view' };
gameCenter.syncUI(scope);
assert.equal(receivedScope, scope, 'syncUI must forward its SPA scope through the UI bridge.');

console.log('GameCenter public API tests passed.');
