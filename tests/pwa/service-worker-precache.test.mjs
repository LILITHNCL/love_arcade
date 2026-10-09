import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const serviceWorker = fs.readFileSync(path.join(projectRoot, 'sw.js'), 'utf8');
const listeners = new Map();
const precacheCalls = [];
let skipWaitingCalls = 0;

const context = vm.createContext({
    URL,
    Promise,
    console,
    caches: {
        open: async () => ({
            addAll: async (resources) => {
                precacheCalls.push([...resources]);
                assert.equal(new Set(resources).size, resources.length, 'Cache.addAll() must never receive duplicate requests.');
            }
        })
    },
    self: {
        location: { origin: 'https://love-arcade.test' },
        addEventListener: (type, listener) => listeners.set(type, listener),
        skipWaiting: async () => { skipWaitingCalls += 1; },
        clients: { claim: async () => {} }
    }
});

vm.runInContext(serviceWorker, context, { filename: 'sw.js' });
const install = listeners.get('install');
assert.equal(typeof install, 'function', 'The Service Worker must register an install handler.');

let installPromise;
install({ waitUntil: (promise) => { installPromise = promise; } });
assert.equal(typeof installPromise?.then, 'function', 'Installation work must be retained with event.waitUntil().');
await installPromise;

assert.equal(precacheCalls.length, 1, 'The complete precache manifest must be installed in one atomic Cache.addAll() call.');
assert.ok(precacheCalls[0].includes('/js/pwa/sw-update-bridge.js'), 'The Service Worker update bridge must remain precached.');
assert.equal(skipWaitingCalls, 1, 'The waiting worker must activate only after precaching succeeds.');

console.log('Service Worker precache tests passed.');
