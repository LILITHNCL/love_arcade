import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSandbox, loadFiles, read } = require('../helpers/vm-sandbox.cjs');

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { context, storage, document } = createSandbox();

loadFiles(context, ['js/game-bridge.js']);
assert.equal(document.writes.length, 1, 'The bridge must synchronously request its classic dependencies.');
for (const source of ['/js/core/config.js', '/js/core/state-store.js', '/js/domain/history.js', '/js/domain/economy.js', '/js/domain/identity.js', '/js/game-bridge-runtime.js']) {
    assert.match(document.writes[0], new RegExp(source.replace(/[./]/g, '\\$&')));
}

loadFiles(context, [
    'js/core/config.js', 'js/core/state-store.js', 'js/domain/history.js',
    'js/domain/economy.js', 'js/domain/identity.js', 'js/game-bridge-runtime.js'
]);

const { GameCenter } = context.window;
for (const method of ['completeLevel', 'getBalance', 'getHistory', 'addCoins', 'spendCoins', 'buyItem', 'getIdentity', 'hasIdentity']) {
    assert.equal(typeof GameCenter[method], 'function', `${method} must be available to games.`);
}
assert.equal(GameCenter.getBalance(), 0);
assert.deepEqual({ ...GameCenter.completeLevel('test-game', 'level-1', 25) }, { paid: true, coins: 25 });
assert.equal(GameCenter.getBalance(), 25);
assert.deepEqual({ ...GameCenter.completeLevel('test-game', 'level-1', 25) }, { paid: false, coins: 25 });
assert.equal(JSON.parse(storage.get('gamecenter_v6_promos')).coins, 25, 'Rewards must persist in the hub state key.');
assert.equal(typeof context.window.CONFIG, 'object');
assert.equal(typeof context.window.ECONOMY, 'object');
assert.equal(typeof context.window.THEMES, 'object');

const gameScriptSources = (file) => [...read(file).matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/g)].map((match) => match[1]);
const gameEntrypoints = {
    'games/2048/index.html': 'lumina_bridge.js',
    'games/word-hunt/index.html': 'config_levels.js',
    'games/jungle-dash/index.html': 'js/JD_Core.js',
    'games/jigsaw/index.html': './js/MAREJIG_economy.js',
    'games/Dodger/index.html': 'src/main.js',
    'games/Shooter/index.html': 'js/main.mjs',
    'games/ollin-smash/index.html': './js/main.js',
    'games/rompecabezas/index.html': './src/main.js'
};
const gameIndexFiles = fs.readdirSync(path.join(projectRoot, 'games'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(projectRoot, 'games', entry.name, 'index.html')))
    .map((entry) => `games/${entry.name}/index.html`)
    .sort();
assert.deepEqual(Object.keys(gameEntrypoints).sort(), gameIndexFiles, 'Every game document must declare its bridge ordering contract.');
for (const file of gameIndexFiles) {
    const entrypoint = gameEntrypoints[file];
    const scripts = gameScriptSources(file);
    const bridgeIndex = scripts.indexOf('../../js/game-bridge.js');
    assert.notEqual(bridgeIndex, -1, `${file} must load the game bridge.`);
    assert.equal(scripts.includes('../../js/app.js'), false, `${file} must not load the hub UI bootstrap.`);
    assert.ok(bridgeIndex < scripts.indexOf(entrypoint), `${file} must load the bridge before ${entrypoint}.`);
}

const serviceWorker = read('sw.js');
assert.match(serviceWorker, /const CACHE_VERSION = 'v\d+(\.\d+)+';/, 'The bridge deployment must invalidate the prior cache.');
for (const source of ['/js/app.js', '/js/game-bridge.js', '/js/game-bridge-runtime.js']) {
    assert.match(serviceWorker, new RegExp(`'${source.replace(/[./]/g, '\\$&')}'`), `${source} must be precached.`);
}
for (const file of gameIndexFiles) {
    assert.match(serviceWorker, new RegExp(`'/${file.replace(/[./]/g, '\\$&')}'`), `${file} must remain precached.`);
}


const precacheLists = vm.runInNewContext(`
${serviceWorker.match(/const APP_SHELL_FILES = \[[\s\S]*?\n\];/)[0]}
${serviceWorker.match(/const GAMES_FILES = \[[\s\S]*?\n\];/)[0]}
({ appShell: APP_SHELL_FILES, games: GAMES_FILES });
`);
const precacheFiles = [...precacheLists.appShell, ...precacheLists.games];
assert.equal(new Set(precacheFiles).size, precacheFiles.length, 'Precache resources must be unique across all lists passed to Cache.addAll().');
assert.match(serviceWorker, /const PRECACHE_FILES = \[\.\.\.APP_SHELL_FILES, \.\.\.GAMES_FILES\];/, 'The complete precache manifest must be installed atomically.');
assert.match(serviceWorker, /await cache\.addAll\(PRECACHE_FILES\);/, 'The install handler must cache the complete manifest.');
assert.equal(gameScriptSources('index.html').filter((source) => source === 'js/pwa/sw-update-bridge.js').length, 1, 'The update bridge must be loaded exactly once.');

console.log('Game bridge integration tests passed.');
