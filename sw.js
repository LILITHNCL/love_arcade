const APP_URL = '/';
const NOTIFICATION_ICON = '/assets/icon/icon-notification.png';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
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
