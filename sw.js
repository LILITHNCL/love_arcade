const APP_URL = '/';
const NOTIFICATION_ICON = '/assets/icon/icon-notification.png';

const CACHE_VERSION = 'v2.04.04.81';
const CACHE_NAME = `love-arcade-${CACHE_VERSION}`;

const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/js/shop-logic.js',
  '/js/spa-router.js',
  '/js/milestones-config.js',
  '/js/app.js',
  '/js/sync-worker.js',
  '/js/analytics.js',
  '/js/supabase-loader.js',
  '/js/push-notifications.js',
  '/js/backup-engine.js',
  '/data/shop-gifts.json',
  '/data/shop.json',
  '/assets/icon/icon-512-any.png',
  '/assets/icon/icon-512-maskable.png',
  '/assets/icon/icon-notification.png',
  '/assets/icon/favicon.ico',
  '/assets/icon/icon-192-any.png',
  '/assets/icon/apple-touch-icon.png',
  '/assets/icon/icon-192-maskable.png',
  '/assets/avatar/avatar-manifest.json',
  '/assets/avatar/clasicos/isla-corazon-46d17a82.jpg',
  '/assets/avatar/clasicos/bocchi-81f12dff.jpg',
  '/assets/avatar/clasicos/505-a7bdbed3.jpg',
  '/assets/images/games/cover/2048-cover-512.avif',
  '/assets/images/games/cover/2048-cover-640.avif',
  '/assets/images/games/cover/2048-cover-768.avif',
  '/assets/images/games/cover/2048-cover-1024.avif',
  '/assets/images/games/cover/marejig-cover-512.avif',
  '/assets/images/games/cover/marejig-cover-640.avif',
  '/assets/images/games/cover/marejig-cover-768.avif',
  '/assets/images/games/cover/marejig-cover-1024.avif',
  '/assets/images/games/cover/ollin-smash-cover-512.avif',
  '/assets/images/games/cover/ollin-smash-cover-640.avif',
  '/assets/images/games/cover/ollin-smash-cover-768.avif',
  '/assets/images/games/cover/ollin-smash-cover-1024.avif',
  '/assets/images/games/cover/rompecabezas-cover-512.avif',
  '/assets/images/games/cover/rompecabezas-cover-640.avif',
  '/assets/images/games/cover/rompecabezas-cover-768.avif',
  '/assets/images/games/cover/rompecabezas-cover-1024.avif',
  '/assets/images/games/cover/space-shooter-cover-512.avif',
  '/assets/images/games/cover/space-shooter-cover-640.avif',
  '/assets/images/games/cover/space-shooter-cover-768.avif',
  '/assets/images/games/cover/space-shooter-cover-1024.avif',
  '/assets/images/games/cover/word-hunt-cover-512.avif',
  '/assets/images/games/cover/word-hunt-cover-640.avif',
  '/assets/images/games/cover/word-hunt-cover-768.avif',
  '/assets/images/games/cover/word-hunt-cover-1024.avif',
  '/assets/images/games/cover/dodger-cover-art-512.avif',
  '/assets/images/games/cover/dodger-cover-art-640.avif',
  '/assets/images/games/cover/dodger-cover-art-768.avif',
  '/assets/images/games/cover/dodger-cover-art-1024.avif',
  '/assets/images/games/cover/jungle-dash-cover-art-512.avif',
  '/assets/images/games/cover/jungle-dash-cover-art-640.avif',
  '/assets/images/games/cover/jungle-dash-cover-art-768.avif',
  '/assets/images/games/cover/jungle-dash-cover-art-1024.avif'
];

const GAMES_FILES = [
  '/games/jungle-dash/index.html', '/games/jungle-dash/js/JD_Core.js', '/games/jungle-dash/js/JD_Physics.js', '/games/jungle-dash/js/JD_Renderer.js', '/games/jungle-dash/js/JD_Audio.js', '/games/jungle-dash/js/JD_Entities.js', '/games/jungle-dash/assets/audio/JD_bgm_jungle.mp3', '/games/jungle-dash/assets/sprites/JD_bg_layer0.webp', '/games/jungle-dash/assets/sprites/JD_obs_log.png', '/games/jungle-dash/assets/sprites/JD_jaguar_run.webp', '/games/jungle-dash/assets/sprites/JD_obs_plant.png', '/games/jungle-dash/assets/sprites/JD_bg_layer1.webp', '/games/jungle-dash/assets/sprites/JD_bg_layer2.webp', '/games/jungle-dash/assets/sprites/JD_jaguar_jump.webp', '/games/jungle-dash/assets/sprites/JD_item_supercoin.webp', '/games/jungle-dash/assets/sprites/JD_bg_layer3.webp',
  '/games/jigsaw/index.html', '/games/jigsaw/css/marejig.css', '/games/jigsaw/js/MAREJIG_config.js', '/games/jigsaw/js/MAREJIG_levels.js', '/games/jigsaw/js/MAREJIG_cloudinary.js', '/games/jigsaw/js/MAREJIG_imageLoader.js', '/games/jigsaw/js/MAREJIG_storage.js', '/games/jigsaw/js/MAREJIG_state.js', '/games/jigsaw/js/MAREJIG_shapes.js', '/games/jigsaw/js/MAREJIG_groups.js', '/games/jigsaw/js/MAREJIG_segments.js', '/games/jigsaw/js/MAREJIG_generator.js', '/games/jigsaw/js/MAREJIG_scene.js', '/games/jigsaw/js/MAREJIG_renderer.js', '/games/jigsaw/js/MAREJIG_input.js', '/games/jigsaw/js/MAREJIG_economy.js', '/games/jigsaw/js/MAREJIG_audio.js', '/games/jigsaw/js/MAREJIG_menu.js', '/games/jigsaw/js/MAREJIG_main.js',
  '/games/2048/index.html', '/games/2048/lumina_bridge.js', '/games/2048/lumina_input.js', '/games/2048/lumina_render.js', '/games/2048/lumina_core.js', '/games/2048/lumina_audio.js',
  '/games/ollin-smash/index.html', '/games/ollin-smash/css/styles.css', '/games/ollin-smash/js/state.js', '/games/ollin-smash/js/core/particles.js', '/games/ollin-smash/js/core/physics.js', '/games/ollin-smash/js/audio/audio-engine.js', '/games/ollin-smash/js/config.js', '/games/ollin-smash/js/main.js', '/games/ollin-smash/js/ui/interface.js', '/games/ollin-smash/js/components/ball.js', '/games/ollin-smash/js/components/bricks.js', '/games/ollin-smash/js/components/powerups.js', '/games/ollin-smash/js/components/paddle.js',
  '/games/rompecabezas/index.html', '/games/rompecabezas/src/core/PuzzleEngine.js', '/games/rompecabezas/src/core/LevelManager.js', '/games/rompecabezas/src/style.css', '/games/rompecabezas/src/systems/Storage.js', '/games/rompecabezas/src/systems/Economy.js', '/games/rompecabezas/src/systems/AudioSynth.js', '/games/rompecabezas/src/main.js', '/games/rompecabezas/src/ui/UIController.js',
  '/games/Dodger/index.html', '/games/Dodger/assets/audio/sfx_shield.mp3', '/games/Dodger/assets/audio/sfx_levelup.mp3', '/games/Dodger/assets/audio/sfx_coin.mp3', '/games/Dodger/assets/audio/sfx_explosion.mp3', '/games/Dodger/assets/audio/sfx_start.mp3', '/games/Dodger/assets/sprites/orb.png', '/games/Dodger/assets/sprites/pw_magnet.png', '/games/Dodger/assets/sprites/pw_shield.png', '/games/Dodger/assets/sprites/ship_default.png', '/games/Dodger/assets/sprites/ship_neon.png', '/games/Dodger/assets/sprites/ship_gold.png', '/games/Dodger/assets/sprites/asteroid.png', '/games/Dodger/assets/sprites/pw_time.png', '/games/Dodger/assets/sprites/ship_void.png', '/games/Dodger/src/core/Audio.js', '/games/Dodger/src/core/ResourceManager.js', '/games/Dodger/src/core/Game.js', '/games/Dodger/src/core/Theme.js', '/games/Dodger/src/core/SkinManager.js', '/games/Dodger/src/core/Input.js', '/games/Dodger/src/entities/Starfield.js', '/games/Dodger/src/entities/PowerUp.js', '/games/Dodger/src/entities/Player.js', '/games/Dodger/src/entities/Spawner.js', '/games/Dodger/src/systems/Economy.js', '/games/Dodger/src/main.js',
  '/games/word-hunt/index.html', '/games/word-hunt/config_levels.js', '/games/word-hunt/game.js', '/games/word-hunt/styles.css',
  '/games/Shooter/index.html', '/games/Shooter/css/la-shooter-main.css', '/games/Shooter/calculadora-recompensas.html', '/games/Shooter/manifest.json', '/games/Shooter/js/core/la-core-input.mjs', '/games/Shooter/js/core/la-core-loop.mjs', '/games/Shooter/js/core/la-core-renderer.mjs', '/games/Shooter/js/core/la-core-pool.mjs', '/games/Shooter/js/entities/la-enemy-factory.mjs', '/games/Shooter/js/entities/la-player.mjs', '/games/Shooter/js/config/la-config.json', '/games/Shooter/js/modes/la-mode-infinite.mjs', '/games/Shooter/js/systems/la-sound.mjs', '/games/Shooter/js/systems/la-ui.mjs', '/games/Shooter/js/systems/la-asset-loader.mjs', '/games/Shooter/js/main.mjs', '/games/Shooter/assets/backgrounds/nebula.webp', '/games/Shooter/assets/backgrounds/space.webp', '/games/Shooter/assets/backgrounds/stars.webp', '/games/Shooter/assets/sprites/bosses/boss2.png', '/games/Shooter/assets/sprites/bosses/boss3.png', '/games/Shooter/assets/sprites/bosses/boss1.png', '/games/Shooter/assets/sprites/items/health.png', '/games/Shooter/assets/sprites/bullets/scout.png', '/games/Shooter/assets/sprites/bullets/shooter.png', '/games/Shooter/assets/sprites/bullets/tank.png', '/games/Shooter/assets/sprites/bullets/player.png', '/games/Shooter/assets/sprites/bullets/elite.png', '/games/Shooter/assets/sprites/bullets/boss.png', '/games/Shooter/assets/sprites/player/default.png', '/games/Shooter/assets/sprites/enemies/scout.png', '/games/Shooter/assets/sprites/enemies/shooter.png', '/games/Shooter/assets/sprites/enemies/tank.png', '/games/Shooter/assets/sprites/enemies/elite.png'
];

function normalizePayload(payload = {}) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const nestedData = safePayload.data && typeof safePayload.data === 'object' ? safePayload.data : {};
  const mergedData = { ...nestedData };

  if (typeof safePayload.url === 'string' && safePayload.url.trim()) {
    mergedData.url = safePayload.url;
  }

  const resolvedUrl = typeof mergedData.url === 'string' && mergedData.url.trim() ? mergedData.url : APP_URL;
  const type = typeof mergedData.type === 'string' ? mergedData.type : '';
  const slot = typeof mergedData.slot === 'string' ? mergedData.slot : '';
  const shopVersion = mergedData.shop_version != null ? String(mergedData.shop_version) : '';
  const semTagByType = {
    local_daily: slot ? `local-daily-${slot}` : 'local-daily',
    local_moon: 'local-moon',
    local_shop: shopVersion ? `local-shop-v${shopVersion}` : 'local-shop'
  };
  const resolvedTag = semTagByType[type] || (typeof safePayload.tag === 'string' && safePayload.tag.trim() ? safePayload.tag : 'love-arcade');

  return {
    title: typeof safePayload.title === 'string' && safePayload.title.trim() ? safePayload.title : 'Love Arcade',
    body: typeof safePayload.body === 'string' ? safePayload.body : '',
    icon: typeof safePayload.icon === 'string' && safePayload.icon.trim() ? safePayload.icon : NOTIFICATION_ICON,
    badge: typeof safePayload.badge === 'string' && safePayload.badge.trim() ? safePayload.badge : NOTIFICATION_ICON,
    tag: resolvedTag,
    renotify: type === 'local_daily',
    data: { ...mergedData, url: resolvedUrl, type }
  };
}

async function safeReadPushData(event) {
  if (!event?.data) return {};
  try {
    const parsed = event.data.json();
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (jsonErr) {
    try {
      const raw = event.data.text();
      if (!raw || !raw.trim()) return {};
      const parsedText = JSON.parse(raw);
      if (parsedText && typeof parsedText === 'object') return parsedText;
    } catch (textErr) {
      console.warn('[SW] Push payload corrupto, usando fallback vacío.', {
        jsonError: jsonErr?.message || String(jsonErr),
        textError: textErr?.message || String(textErr)
      });
      return { data: { parse_error: true } };
    }
  }
  return {};
}

async function showNormalizedNotification(rawPayload) {
  const payload = normalizePayload(rawPayload || {});
  if (payload.tag && payload.data?.type) {
    const prior = await self.registration.getNotifications({ tag: payload.tag });
    prior.forEach((n) => n.close());
  }

  await self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    renotify: Boolean(payload.renotify),
    data: payload.data
  });
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL_FILES);
    await cache.addAll(GAMES_FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    try {
      const rawPayload = await safeReadPushData(event);
      await showNormalizedNotification(rawPayload);
    } catch (err) {
      console.warn('[SW] Error manejando evento push, usando fallback.', err);
      await showNormalizedNotification({});
    }
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isCloudinary = url.hostname === 'res.cloudinary.com';

  if (isCloudinary) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone());
        return response;
      } catch (_) {
        return (await caches.match(event.request)) || (await caches.match('/assets/icon/icon-192-any.png'));
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(event.request, response.clone());
    return response;
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  const msg = event.data || {};
  if (msg.type !== 'SHOW_NOTIFICATION') return;
  event.waitUntil(showNormalizedNotification(msg.payload || {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const requestedUrl = String(event.notification?.data?.url || APP_URL);

  event.waitUntil((async () => {
    const absoluteUrl = new URL(requestedUrl, self.location.origin).toString();
    try {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appRoot = new URL(APP_URL, self.location.origin);
      const preferred = allClients.find((client) => {
        try {
          const clientUrl = new URL(client.url);
          const sameRoute = clientUrl.pathname === appRoot.pathname;
          const hasViewHash = clientUrl.hash.includes('#view=');
          return sameRoute && hasViewHash;
        } catch (_) {
          return false;
        }
      });

      if (preferred) {
        await preferred.focus();
        preferred.postMessage({ type: 'LA_NOTIFICATION_OPEN', url: absoluteUrl });
        return;
      }
    } catch (err) {
      console.warn('[SW] Error enfocando cliente existente. Se abrirá nueva ventana.', err);
    }

    await self.clients.openWindow(absoluteUrl);
  })());
});
