const APP_URL = '/';
const NOTIFICATION_ICON = '/assets/icon/icon-notification.png';
const SW_VERSION = 'pwa-v2';

const CACHES = {
  APP_SHELL: `app-shell-${SW_VERSION}`,
  RUNTIME_STATIC: `runtime-static-${SW_VERSION}`,
  CLOUDINARY_MEDIA: `cloudinary-media-${SW_VERSION}`,
  DOCUMENTS: `documents-${SW_VERSION}`,
  META: `cache-meta-${SW_VERSION}`
};

const LIMITS = {
  [CACHES.RUNTIME_STATIC]: { maxEntries: 80, maxAgeMs: 7 * 24 * 60 * 60 * 1000 },
  [CACHES.CLOUDINARY_MEDIA]: { maxEntries: 140, maxAgeMs: 14 * 24 * 60 * 60 * 1000 },
  [CACHES.DOCUMENTS]: { maxEntries: 40, maxAgeMs: 3 * 24 * 60 * 60 * 1000 }
};

const APP_SHELL_ASSETS = ['/', '/index.html', '/styles.css', '/js/app.js', '/js/native-capabilities.js', '/manifest.webmanifest', '/assets/icon/icon.png', '/assets/icon/icon-notification.png'];

const OFFLINE_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sin conexión</title><style>body{font-family:system-ui;background:#07070d;color:#f0f0f8;display:grid;place-items:center;min-height:100vh;padding:24px}main{max-width:420px;text-align:center}h1{font-size:1.25rem}p{opacity:.85}</style></head><body><main><h1>Sin conexión</h1><p>No se pudo cargar este recurso. Revisa tu conexión e inténtalo de nuevo.</p></main></body></html>`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(CACHES.APP_SHELL);
    await shell.addAll(APP_SHELL_ASSETS);
    const docs = await caches.open(CACHES.DOCUMENTS);
    await docs.put('/offline.html', new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));
    await self.skipWaiting();
    await emitMetric('sw_install', { version: SW_VERSION });
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => Object.values(CACHES).includes(key) ? Promise.resolve() : caches.delete(key)));
    await self.clients.claim();
    await emitMetric('sw_activate', { version: SW_VERSION });
  })());
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'LA_WARM_CLOUDINARY' && Array.isArray(msg.urls)) {
    event.waitUntil(warmCloudinary(msg.urls));
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin && req.destination === 'document') {
    event.respondWith(handleDocument(req));
    return;
  }

  const isCloudinary = url.hostname === 'res.cloudinary.com' && url.pathname.includes('/image/upload/');
  if (isCloudinary) {
    event.respondWith(cacheFirst(req, CACHES.CLOUDINARY_MEDIA, { cors: true }));
    event.waitUntil(cleanupCache(CACHES.CLOUDINARY_MEDIA));
    return;
  }

  if (['style', 'script'].includes(req.destination)) {
    event.respondWith(staleWhileRevalidate(req, CACHES.RUNTIME_STATIC));
    event.waitUntil(cleanupCache(CACHES.RUNTIME_STATIC));
    return;
  }
});

async function handleDocument(req) {
  try {
    const net = await fetch(req);
    await putWithMeta(CACHES.DOCUMENTS, req, net.clone());
    return net;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) {
      emitMetric('offline_fallback_document_cache_hit', { url: req.url });
      return cached;
    }
    emitMetric('offline_fallback_document_miss', { url: req.url });
    return (await caches.match('/offline.html')) || new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(req, cacheName, options = {}) {
  const cached = await caches.open(cacheName).then((c) => c.match(req));
  if (cached && !(await isExpired(cacheName, req.url))) {
    emitMetric('cache_hit', { cache: cacheName, url: req.url });
    return cached;
  }
  try {
    const net = await fetch(req, options.cors ? { mode: 'cors' } : undefined);
    await putWithMeta(cacheName, req, net.clone());
    emitMetric('cache_miss_fill', { cache: cacheName, url: req.url });
    return net;
  } catch (err) {
    if (cached) return cached;
    emitMetric('cache_miss_error', { cache: cacheName, url: req.url, error: String(err?.message || err) });
    return new Response('Resource unavailable offline', { status: 503, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const networkPromise = fetch(req).then(async (res) => {
    await putWithMeta(cacheName, req, res.clone());
    return res;
  }).catch(async (err) => {
    emitMetric('runtime_fetch_error', { cache: cacheName, url: req.url, error: String(err?.message || err) });
    return null;
  });
  return cached || (await networkPromise) || new Response('Resource unavailable offline', { status: 503, statusText: 'Offline' });
}

async function putWithMeta(cacheName, req, res) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(req, res);
    const meta = await caches.open(CACHES.META);
    await meta.put(new Request(`https://meta.local/${cacheName}/${encodeURIComponent(req.url)}`), new Response(JSON.stringify({ ts: Date.now() })));
  } catch (err) {
    const msg = String(err?.message || err || '');
    const isQuota = /quota|storage|exceeded/i.test(msg);
    await emitMetric(isQuota ? 'cache_quota_exceeded' : 'cache_put_error', { cache: cacheName, url: req.url, error: msg });
    if (isQuota) {
      await cleanupCache(cacheName, { aggressive: true });
    }
  }
}

async function isExpired(cacheName, url) {
  const rule = LIMITS[cacheName];
  if (!rule?.maxAgeMs) return false;
  const meta = await caches.open(CACHES.META);
  const res = await meta.match(`https://meta.local/${cacheName}/${encodeURIComponent(url)}`);
  if (!res) return false;
  const data = await res.json().catch(() => null);
  if (!data?.ts) return false;
  return (Date.now() - data.ts) > rule.maxAgeMs;
}

async function cleanupCache(cacheName, options = {}) {
  const rule = LIMITS[cacheName];
  if (!rule) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const meta = await caches.open(CACHES.META);

  const enriched = [];
  for (const req of keys) {
    const m = await meta.match(`https://meta.local/${cacheName}/${encodeURIComponent(req.url)}`);
    const ts = m ? ((await m.json().catch(() => ({ ts: 0 }))).ts || 0) : 0;
    if (rule.maxAgeMs && Date.now() - ts > rule.maxAgeMs) {
      await cache.delete(req);
      await meta.delete(`https://meta.local/${cacheName}/${encodeURIComponent(req.url)}`);
      continue;
    }
    enriched.push({ req, ts });
  }

  const maxEntries = options.aggressive ? Math.max(10, Math.floor(rule.maxEntries * 0.75)) : rule.maxEntries;
  if (enriched.length > maxEntries) {
    enriched.sort((a, b) => a.ts - b.ts);
    const toDelete = enriched.slice(0, enriched.length - maxEntries);
    await Promise.all(toDelete.map(async ({ req }) => {
      await cache.delete(req);
      await meta.delete(`https://meta.local/${cacheName}/${encodeURIComponent(req.url)}`);
    }));
  }
}

async function warmCloudinary(urls = []) {
  const cache = await caches.open(CACHES.CLOUDINARY_MEDIA);
  await Promise.all(urls.map(async (url) => {
    try {
      const req = new Request(url, { mode: 'cors' });
      const hit = await cache.match(req);
      if (hit) return;
      const res = await fetch(req);
      await putWithMeta(CACHES.CLOUDINARY_MEDIA, req, res.clone());
    } catch (_) {}
  }));
  await cleanupCache(CACHES.CLOUDINARY_MEDIA);
}

async function emitMetric(type, detail = {}) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  clients.forEach((c) => c.postMessage({ type: 'LA_SW_METRIC', metricType: type, detail: { ...detail, ts: Date.now() } }));
}
