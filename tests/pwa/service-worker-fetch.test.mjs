import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const swSource = fs.readFileSync(path.join(projectRoot, 'sw.js'), 'utf8');

/**
 * Crea un entorno sandbox VM con simulación completa de Service Worker:
 * self, caches en memoria, fetch configurable, y registro de eventos Extendable/Fetch.
 */
function createSwEnvironment() {
    const cacheMap = new Map();
    const listeners = new Map();
    let clientsClaimCalled = false;
    let skipWaitingCalled = false;
    let fetchHandler = async () => new Response('Default Network OK', { status: 200 });

    function normalizeKey(req) {
        if (typeof req === 'string') return new URL(req, 'https://love-arcade.test').href;
        if (req && typeof req.url === 'string') return new URL(req.url, 'https://love-arcade.test').href;
        return String(req);
    }

    let addAllCalls = [];

    class FakeCache {
        constructor(name) {
            this.name = name;
            this.entries = new Map();
        }

        async put(req, res) {
            this.entries.set(normalizeKey(req), res.clone());
        }

        async match(req) {
            const found = this.entries.get(normalizeKey(req));
            return found ? found.clone() : undefined;
        }

        async addAll(items) {
            addAllCalls.push([...items]);
            for (const item of items) {
                await this.put(item, new Response('Precached resource', { status: 200 }));
            }
        }

        async delete(req) {
            return this.entries.delete(normalizeKey(req));
        }

        async keys() {
            return Array.from(this.entries.keys());
        }
    }

    const caches = {
        async open(name) {
            if (!cacheMap.has(name)) {
                cacheMap.set(name, new FakeCache(name));
            }
            return cacheMap.get(name);
        },
        async match(req) {
            for (const cache of cacheMap.values()) {
                const found = await cache.match(req);
                if (found) return found;
            }
            return undefined;
        },
        async keys() {
            return Array.from(cacheMap.keys());
        },
        async delete(name) {
            return cacheMap.delete(name);
        }
    };

    const self = {
        location: { origin: 'https://love-arcade.test' },
        addEventListener(type, fn) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(fn);
        },
        async skipWaiting() {
            skipWaitingCalled = true;
        },
        clients: {
            async claim() {
                clientsClaimCalled = true;
            }
        }
    };

    let fetchCallLog = [];
    const context = vm.createContext({
        self,
        caches,
        fetch: async (input, init) => {
            fetchCallLog.push({ input, init });
            return fetchHandler(input, init);
        },
        Request,
        Response,
        URL,
        Promise,
        console,
        Array, Map, Set, String, Number, Boolean, RegExp, Error, JSON
    });

    vm.runInContext(swSource, context, { filename: 'sw.js' });

    async function triggerInstall() {
        let promise = null;
        const event = {
            waitUntil(p) { promise = p; }
        };
        for (const fn of listeners.get('install') || []) {
            fn(event);
        }
        await promise;
    }

    async function triggerActivate() {
        let promise = null;
        const event = {
            waitUntil(p) { promise = p; }
        };
        for (const fn of listeners.get('activate') || []) {
            fn(event);
        }
        await promise;
    }

    async function triggerFetch(urlOrRequest, init) {
        const request = (typeof urlOrRequest === 'string')
            ? new Request(urlOrRequest, init)
            : urlOrRequest;

        let promise = null;
        let responded = false;
        const event = {
            request,
            respondWith(p) {
                responded = true;
                promise = Promise.resolve(p);
            }
        };

        for (const fn of listeners.get('fetch') || []) {
            fn(event);
        }

        if (!responded) {
            return { intercepted: false, response: null };
        }

        const response = await promise;
        return { intercepted: true, response };
    }

    return {
        context,
        cacheMap,
        caches,
        self,
        getFetchCallLog: () => fetchCallLog,
        clearFetchCallLog: () => { fetchCallLog = []; },
        setFetchHandler: (fn) => { fetchHandler = fn; },
        getAddAllCalls: () => addAllCalls,
        triggerInstall,
        triggerActivate,
        triggerFetch,
        wasClientsClaimCalled: () => clientsClaimCalled,
        wasSkipWaitingCalled: () => skipWaitingCalled
    };
}

describe('QA (F3b): Service Worker - Estrategias de fetch y ciclo de vida (TKT-018)', () => {
    it('Peticiones no-GET (POST, PUT, DELETE) no son interceptadas (no invocan respondWith)', async () => {
        const env = createSwEnvironment();

        for (const method of ['POST', 'PUT', 'DELETE']) {
            const result = await env.triggerFetch('https://love-arcade.test/api/report', { method });
            assert.equal(
                result.intercepted,
                false,
                `Petición con método ${method} debe delegarse transparentemente sin llamar a respondWith`
            );
        }
    });

    it('Peticiones de orígenes terceros distintos a Cloudinary no son interceptadas', async () => {
        const env = createSwEnvironment();
        const result = await env.triggerFetch('https://fonts.googleapis.com/css2?family=Exo+2');
        assert.equal(
            result.intercepted,
            false,
            'Peticiones a orígenes cruzados no soportados deben delegarse directamente a la red'
        );
    });

    it('Cloudinary online · network-first devuelve respuesta de la red y almacena copia en caché', async () => {
        const env = createSwEnvironment();
        await env.triggerInstall();

        const imageBytes = 'fake-cloudinary-image-data';
        env.setFetchHandler(async () => new Response(imageBytes, {
            status: 200,
            headers: { 'Content-Type': 'image/webp' }
        }));

        const targetUrl = 'https://res.cloudinary.com/dyspgn0sw/image/upload/sample.webp';
        const result = await env.triggerFetch(targetUrl);

        assert.equal(result.intercepted, true);
        assert.equal(result.response.status, 200);
        const bodyText = await result.response.text();
        assert.equal(bodyText, imageBytes);

        // Verificar que se guardó en la caché activa
        const cached = await env.caches.match(targetUrl);
        assert.ok(cached, 'La imagen de Cloudinary debe ser persistida en caché tras descarga exitosa');
        assert.equal(await cached.text(), imageBytes);
    });

    it('Cloudinary offline · recupera de caché si la imagen fue almacenada previamente', async () => {
        const env = createSwEnvironment();
        await env.triggerInstall();

        const targetUrl = 'https://res.cloudinary.com/dyspgn0sw/image/upload/avatar.webp';
        const cachedContent = 'cached-avatar-bytes';

        // Guardar previamente en caché activa
        const activeKeys = await env.caches.keys();
        const activeCache = await env.caches.open(activeKeys[0]);
        await activeCache.put(targetUrl, new Response(cachedContent, { status: 200 }));

        // Simular fallo de red (offline)
        env.setFetchHandler(async () => {
            throw new Error('Failed to fetch: Network offline');
        });

        const result = await env.triggerFetch(targetUrl);
        assert.equal(result.intercepted, true);
        assert.equal(result.response.status, 200);
        assert.equal(await result.response.text(), cachedContent);
    });

    it('Cloudinary offline · devuelve icono fallback (/assets/icon/icon-192-any.png) cuando no hay copia en caché', async () => {
        const env = createSwEnvironment();
        await env.triggerInstall();

        // Asegurar que el icono fallback está en caché
        const activeKeys = await env.caches.keys();
        const activeCache = await env.caches.open(activeKeys[0]);
        const fallbackIconBytes = 'fallback-icon-192-bytes';
        await activeCache.put('/assets/icon/icon-192-any.png', new Response(fallbackIconBytes, { status: 200 }));

        // Simular desconexión de red para imagen no cacheada
        env.setFetchHandler(async () => {
            throw new Error('Network offline');
        });

        const result = await env.triggerFetch('https://res.cloudinary.com/dyspgn0sw/image/upload/nonexistent.png');
        assert.equal(result.intercepted, true);
        assert.equal(result.response.status, 200);
        assert.equal(await result.response.text(), fallbackIconBytes);
    });

    it('Mismo origen · cache-first devuelve directamente recurso en caché sin invocar a fetch (hit)', async () => {
        const env = createSwEnvironment();
        await env.triggerInstall();

        const targetUrl = 'https://love-arcade.test/styles.css';
        const cachedCss = '/* cached css styles */';

        const activeKeys = await env.caches.keys();
        const activeCache = await env.caches.open(activeKeys[0]);
        await activeCache.put(targetUrl, new Response(cachedCss, { status: 200 }));

        env.clearFetchCallLog();
        const result = await env.triggerFetch(targetUrl);

        assert.equal(result.intercepted, true);
        assert.equal(result.response.status, 200);
        assert.equal(await result.response.text(), cachedCss);
        assert.equal(
            env.getFetchCallLog().length,
            0,
            'En caso de acierto de caché (hit) no debe consultarse la red'
        );
    });

    it('Mismo origen · cache-first consulta red ante fallo (miss), lo guarda en caché y devuelve la respuesta', async () => {
        const env = createSwEnvironment();
        await env.triggerInstall();

        const targetUrl = 'https://love-arcade.test/new-feature.js';
        const networkJs = 'console.log("new feature script");';

        env.setFetchHandler(async () => new Response(networkJs, { status: 200 }));
        env.clearFetchCallLog();

        const result = await env.triggerFetch(targetUrl);

        assert.equal(result.intercepted, true);
        assert.equal(result.response.status, 200);
        assert.equal(await result.response.text(), networkJs);
        assert.equal(env.getFetchCallLog().length, 1, 'Debe consultar la red ante un miss de caché');

        // Verificar que fue guardado en caché
        const cached = await env.caches.match(targetUrl);
        assert.ok(cached, 'El recurso obtenido de la red debe quedar almacenado en la caché');
        assert.equal(await cached.text(), networkJs);
    });

    it('R8 · el Service Worker no debe almacenar respuestas no-OK (500) perpetuando el error tras recuperarse el servidor', {
        todo: 'BUG-F3b-01: decisión de producto pendiente - el SW cachea respuestas !response.ok y /api/* en CACHE_NAME perpetuando el fallo tras recuperarse la red'
    }, async () => {
        const env = createSwEnvironment();
        const targetUrl = 'https://love-arcade.test/styles.css';

        // 1. El servidor falla temporalmente con HTTP 500
        env.setFetchHandler(async () => new Response('Internal Server Error', {
            status: 500,
            statusText: 'Internal Server Error'
        }));

        const firstResult = await env.triggerFetch(targetUrl);
        assert.equal(firstResult.response.status, 500);

        // 2. El servidor se recupera y responde HTTP 200 OK
        env.setFetchHandler(async () => new Response('/* Healthy Styles */', { status: 200 }));

        const secondResult = await env.triggerFetch(targetUrl);

        // Comportamiento DESEADO: al recuperarse el servidor, debe obtener el 200 y no servir el 500 cacheado
        assert.equal(
            secondResult.response.status,
            200,
            'Una petición no debe devolver un error 500 previamente cacheado cuando el servidor ya responde 200'
        );
    });

    it('dado el precache, cuando se resuelve cada ruta, entonces existe en disco', async () => {
        const env = createSwEnvironment();
        await env.triggerInstall();
        const calls = env.getAddAllCalls();
        assert.ok(calls.length > 0, 'cache.addAll debe ser invocado durante install');
        const precacheList = calls[0];
        const missingRoutes = precacheList.filter((route) => {
            const relativePath = route === '/' ? 'index.html' : (route.startsWith('/') ? route.slice(1) : route);
            const diskPath = path.join(projectRoot, relativePath);
            return !fs.existsSync(diskPath);
        });
        assert.deepEqual(missingRoutes, []);
    });

    it('Activate · purga cachés obsoletas y retiene la caché activa sin depender de versiones literales', async () => {
        const env = createSwEnvironment();
        await env.triggerInstall();

        // Identificar dinámicamente la caché activa generada durante install
        const keysBefore = await env.caches.keys();
        assert.equal(keysBefore.length, 1, 'Debe haber exactamente una caché activa creada durante install');
        const activeCacheName = keysBefore[0];

        // Crear una caché antigua/legada
        const legacyCacheName = 'love-arcade-v1.0.0-legacy';
        await env.caches.open(legacyCacheName);
        const keysWithLegacy = await env.caches.keys();
        assert.ok(keysWithLegacy.includes(legacyCacheName));
        assert.ok(keysWithLegacy.includes(activeCacheName));

        // Disparar activate
        await env.triggerActivate();

        // Verificar que la caché antigua fue purgada y la activa permanece intacta
        const keysAfter = await env.caches.keys();
        assert.equal(
            keysAfter.includes(legacyCacheName),
            false,
            'La caché legada debe haber sido eliminada por el evento activate'
        );
        assert.ok(
            keysAfter.includes(activeCacheName),
            'La caché activa debe ser preservada intacta'
        );
        assert.equal(
            env.wasClientsClaimCalled(),
            true,
            'El evento activate debe invocar self.clients.claim()'
        );
    });
});
