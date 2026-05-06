const APP_URL = '/';
const NOTIFICATION_ICON = '/assets/icon/icon-notification.png';
const CACHE_VERSION = 'v1';
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`;
const RUNTIME_STATIC_CACHE = `runtime-static-${CACHE_VERSION}`;
const CLOUDINARY_CACHE = `cloudinary-media-${CACHE_VERSION}`;
const APP_SHELL_ASSETS = ['/', '/index.html', '/styles.css', '/js/app.js', '/manifest.webmanifest', '/assets/icon/icon.png', '/assets/icon/icon-notification.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    await cache.addAll(APP_SHELL_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => {
      if ([APP_SHELL_CACHE, RUNTIME_STATIC_CACHE, CLOUDINARY_CACHE].includes(key)) return Promise.resolve();
      return caches.delete(key);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin && req.destination === 'document') {
    event.respondWith((async () => {
      try {
        const net = await fetch(req);
        const cache = await caches.open(APP_SHELL_CACHE);
        cache.put(req, net.clone());
        return net;
      } catch (_) {
        return (await caches.match(req)) || (await caches.match('/index.html'));
      }
    })());
    return;
  }

  const isCloudinary = url.hostname === 'res.cloudinary.com' && url.pathname.includes('/image/upload/');
  if (isCloudinary) {
    event.respondWith((async () => {
      const cache = await caches.open(CLOUDINARY_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const net = await fetch(req, { mode: 'cors' });
      cache.put(req, net.clone());
      return net;
    })());
    return;
  }

  const isRuntimeStatic = ['style', 'script'].includes(req.destination);
  if (isRuntimeStatic) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_STATIC_CACHE);
      const cached = await cache.match(req);
      const netPromise = fetch(req).then((res) => {
        cache.put(req, res.clone());
        return res;
      }).catch(() => null);
      return cached || (await netPromise) || fetch(req);
    })());
  }
});

function resolveUrlFromPayload(data = {}) {
  const explicit = data?.url || data?.click_action || data?.link;
  if (typeof explicit === 'string' && explicit.trim()) return explicit;
  const view = data?.view;
  if (view === 'shop') return '/#view=shop';
  if (view === 'events') return '/#view=events';
  return APP_URL;
}

function normalizePayload(payload = {}) {
  const payloadJson = payload.payload_json && typeof payload.payload_json === 'object'
    ? payload.payload_json
    : {};

  const url = resolveUrlFromPayload({ ...payloadJson, ...payload });

  return {
    title: payload.title || 'Love Arcade',
    body: payload.body || 'Tienes una nueva notificación.',
    icon: payload.icon || NOTIFICATION_ICON,
    badge: payload.badge || NOTIFICATION_ICON,
    tag: payload.tag || `love-arcade-${Date.now()}`,
    data: {
      ...payloadJson,
      ...payload,
      url,
      ts: Date.now()
    }
  };
}

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { title: 'Love Arcade', body: event.data?.text?.() || 'Tienes una notificación nueva.' };
  }

  const normalized = normalizePayload(payload);
  event.waitUntil(
    self.registration.showNotification(normalized.title, {
      body: normalized.body,
      icon: normalized.icon,
      badge: normalized.badge,
      tag: normalized.tag,
      renotify: false,
      data: normalized.data
    })
  );
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type !== 'SHOW_NOTIFICATION') return;
  const payload = normalizePayload(msg.payload || {});
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      renotify: false,
      data: payload.data
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || APP_URL;

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = allClients.find((client) => client.url.includes(self.location.origin));

    if (existing) {
      try {
        await existing.focus();
        existing.postMessage({ type: 'LA_NOTIFICATION_OPEN', url: targetUrl });
        return;
      } catch (_) {
        // fallback create new window
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
