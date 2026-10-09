import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');

const { context, storage } = createSandbox();
context.window.LoveArcadeUtils = { sha256: async () => 'checksum' };
context.window.workerTask = async () => { throw new Error('offline'); };
context.Uint8Array = Uint8Array;
context.TextEncoder = TextEncoder;
context.TextDecoder = TextDecoder;
context.btoa = btoa;
context.atob = atob;

loadFiles(context, [
    'js/core/config.js', 'js/core/state-store.js', 'js/core/time-sync.js',
    'js/domain/history.js', 'js/domain/economy.js', 'js/domain/promo-codes.js',
    'js/domain/moon-blessing.js', 'js/domain/identity.js', 'js/domain/daily-streak.js',
    'js/domain/avatar.js', 'js/domain/theming.js', 'js/domain/game-center.js'
]);

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
