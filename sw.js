const APP_URL = '/';
const NOTIFICATION_ICON = '/assets/icon/icon-notification.png';
const STATIC_CACHE = 'love-arcade-static-v2';
const SKIN_CACHE = 'love-arcade-skins-v2';
const SKIN_MANIFEST = '/assets/skins/manifest.json';

async function getSkinAssets() {
  try {
    const res = await fetch(SKIN_MANIFEST, { cache: 'no-store' });
    if (!res.ok) return [];
    const manifest = await res.json();
    const assets = new Set([SKIN_MANIFEST]);
    for (const skin of manifest.skins || []) {
      if (skin.icons?.sprite) assets.add('/' + skin.icons.sprite.replace(/^\//, ''));
      for (const v of Object.values(skin.backgrounds || {})) if (v) assets.add('/' + v.replace(/^\//, ''));
      for (const v of Object.values(skin.gameCards || {})) if (v) assets.add('/' + v.replace(/^\//, ''));
    }
    return [...assets];
  } catch (_) { return [SKIN_MANIFEST]; }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    self.skipWaiting();
    const staticCache = await caches.open(STATIC_CACHE);
    await staticCache.addAll(['/', '/index.html', '/styles.css', '/js/app.js', '/js/skin-manager.js']);
    const skinAssets = await getSkinAssets();
    const skinCache = await caches.open(SKIN_CACHE);
    await Promise.allSettled(skinAssets.map(a => skinCache.add(a)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![STATIC_CACHE, SKIN_CACHE].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function resolveUrlFromPayload(data = {}) {
  const explicit = data?.url || data?.click_action || data?.link;
  if (typeof explicit === 'string' && explicit.trim()) return explicit;
  const view = data?.view;
  if (view === 'shop') return '/#view=shop';
  if (view === 'events') return '/#view=events';
  return APP_URL;
}

function normalizePayload(payload = {}) { /* unchanged */
  const payloadJson = payload.payload_json && typeof payload.payload_json === 'object' ? payload.payload_json : {};
  const url = resolveUrlFromPayload({ ...payloadJson, ...payload });
  return { title: payload.title || 'Love Arcade', body: payload.body || 'Tienes una nueva notificación.', icon: payload.icon || NOTIFICATION_ICON, badge: payload.badge || NOTIFICATION_ICON, tag: payload.tag || 'love-arcade', data: { ...payloadJson, ...payload, url, ts: Date.now() } };
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/assets/skins/')) {
    event.respondWith((async () => {
      const cache = await caches.open(SKIN_CACHE);
      const cached = await cache.match(event.request);
      const networkPromise = fetch(event.request).then(async (res) => {
        if (res.ok) await cache.put(event.request, res.clone());
        return res;
      }).catch(() => null);
      return cached || await networkPromise || fetch(event.request);
    })());
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch (_) { payload = { title: 'Love Arcade', body: event.data?.text?.() || 'Tienes una notificación nueva.' }; }
  const normalized = normalizePayload(payload);
  event.waitUntil(self.registration.showNotification(normalized.title, { body: normalized.body, icon: normalized.icon, badge: normalized.badge, tag: normalized.tag, renotify: true, data: normalized.data }));
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type !== 'SHOW_NOTIFICATION') return;
  const payload = normalizePayload(msg.payload || {});
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, icon: payload.icon, badge: payload.badge, tag: payload.tag, renotify: true, data: payload.data }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || APP_URL;
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = allClients.find((client) => client.url.includes(self.location.origin));
    if (existing) {
      try { await existing.focus(); existing.postMessage({ type: 'LA_NOTIFICATION_OPEN', url: targetUrl }); return; } catch (_) {}
    }
    await self.clients.openWindow(targetUrl);
  })());
});
