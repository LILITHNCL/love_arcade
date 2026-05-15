(function PushNotificationsModule() {
  'use strict';

  const STORAGE = {
    prefs: 'la_push_prefs_v1'
  };

  const DEFAULT_PREFS = {
    enabled: false,
    dailyClaim: true,
    moonExpiry: true,
    newShop: true,
    eventUrgent: true
  };

  let swReg = null;
  let vapidPublicKey = '';
  let permissionStatusRef = null;
  let permissionPollTimer = null;
  let lastPermissionSeen = (typeof Notification !== 'undefined' ? Notification.permission : 'default');
  function _$(id) { return document.getElementById(id); }

  /**
   * Carga preferencias de recordatorios con recuperación tolerante a corrupción.
   *
   * Precondiciones: `localStorage` disponible en el contexto actual.
   * Efectos secundarios: lectura de `localStorage`.
   * Coste esperado: O(1) CPU y una lectura síncrona de storage.
   * Diseño (por qué): se fusiona con `DEFAULT_PREFS` para que nuevas flags
   * queden habilitadas con defaults seguros aunque el usuario tenga un schema viejo.
   */
  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE.prefs);
      if (!raw) return { ...DEFAULT_PREFS };
      return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch (_) {
      return { ...DEFAULT_PREFS };
    }
  }

  /**
   * Persiste preferencias asegurando schema completo en cada escritura.
   *
   * Precondiciones: `prefs` es objeto parcial de flags booleanas.
   * Efectos secundarios: escritura síncrona en `localStorage`.
   * Coste esperado: O(k) donde k=campos de preferencias (pequeño y estable).
   * Diseño (por qué): guardar snapshot normalizado simplifica lecturas futuras
   * y evita ramas de migración en cada consumidor.
   */
  function savePrefs(prefs) {
    localStorage.setItem(STORAGE.prefs, JSON.stringify({ ...DEFAULT_PREFS, ...prefs }));
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i += 1) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Obtiene la clave pública VAPID usada para el alta de suscripciones web push.
   *
   * Precondiciones: endpoint `/api/push-public-config` accesible desde mismo origen.
   * Efectos secundarios: red (fetch) y mutación de `vapidPublicKey` en memoria.
   * Coste esperado: 1 request HTTP + parseo JSON.
   * Diseño (por qué): falla cerrada (`vapidPublicKey=''`) para impedir intentos
   * de suscripción inconsistentes cuando el backend no responde.
   */
  async function fetchPushConfig() {
    try {
      const res = await fetch('/api/push-public-config', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      vapidPublicKey = String(data?.vapidPublicKey || '');
      if (!vapidPublicKey) throw new Error('VAPID key missing');
    } catch (_) {
      vapidPublicKey = '';
    }
  }

  function setStatus(text, isError = false) {
    const el = _$('push-status-msg');
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? 'var(--error, #fc8181)' : 'var(--text-low)';
  }

  function isOperaAndroid() {
    const ua = navigator.userAgent || '';
    return /android/i.test(ua) && (/OPR\//i.test(ua) || /Opera/i.test(ua));
  }

  function toggleRecoveryCard(show) {
    const el = _$('push-recovery-card');
    if (!el) return;
    el.classList.toggle('hidden', !show);
  }

  function stopPermissionPolling() {
    if (!permissionPollTimer) return;
    window.clearInterval(permissionPollTimer);
    permissionPollTimer = null;
  }

  async function hasActiveSubscription() {
    try {
      if (!swReg) await registerServiceWorker();
      const sub = await swReg?.pushManager?.getSubscription?.();
      return Boolean(sub);
    } catch (_) {
      return false;
    }
  }

  /**
   * Activa polling temporal de permisos en Opera Android cuando la API estándar
   * de cambios no es fiable en background/return-to-app.
   *
   * Precondiciones: `Notification` disponible y `permission` válido.
   * Efectos secundarios: crea/limpia `setInterval`, potencial refresco de UI y sync remota.
   * Coste esperado: O(1) por tick; intervalo 1500 ms mientras dure el recovery.
   * Diseño (por qué): se prefiere polling acotado sobre listeners permanentes para
   * limitar trabajo continuo y cubrir edge-cases del navegador.
   */
  function startPermissionPollingIfNeeded(permission) {
    const shouldPoll = isOperaAndroid() && permission !== 'granted';
    if (!shouldPoll) {
      stopPermissionPolling();
      return;
    }
    if (permissionPollTimer) return;

    lastPermissionSeen = permission;
    permissionPollTimer = window.setInterval(async () => {
      const current = Notification.permission;
      if (current === lastPermissionSeen) return;
      lastPermissionSeen = current;
      stopPermissionPolling();
      await refreshPushUiState();
      syncReminderStateToSupabase().catch(() => {});
    }, 1500);
  }

  /**
   * Recalcula estado visual y de onboarding push según permiso + suscripción real.
   *
   * Precondiciones: elementos del panel push ya montados en DOM.
   * Efectos secundarios: escrituras DOM, lectura de permisos y posible consulta a SW.
   * Coste esperado: O(1) DOM + hasta 1 consulta async a PushManager.
   * Diseño (por qué): centralizar aquí evita drift entre handlers (focus, pageshow,
   * permissions.onchange) y mantiene una única fuente de verdad de UI.
   */
  async function refreshPushUiState() {
    const permission = Notification.permission;
    lastPermissionSeen = permission;

    renderEnableButtonState();
    const shouldShowRecovery = isOperaAndroid() && permission !== 'granted';
    toggleRecoveryCard(shouldShowRecovery);

    if (permission === 'granted') {
      const isSubscribed = await hasActiveSubscription();
      if (isSubscribed) {
        setStatus('Recordatorios activos.');
      } else {
        setStatus('Permiso activo. Termina la activación para recibir recordatorios.');
      }
    } else if (permission === 'denied') {
      setStatus('Notificaciones bloqueadas. Actívalas en la configuración del navegador para continuar.', true);
    } else {
      setStatus('Activa los recordatorios.');
    }

    startPermissionPollingIfNeeded(permission);
  }

  /**
   * Registra listeners de ciclo de vida para rehidratar UI al volver a la pestaña.
   *
   * Precondiciones: módulo inicializado una sola vez por sesión.
   * Efectos secundarios: alta de listeners globales en `document` y `window`.
   * Coste esperado: O(1) setup; ejecución diferida por eventos del navegador.
   * Diseño (por qué): se evita actualizar en cada frame y se reacciona sólo a
   * hitos de visibilidad/foco, que son los momentos con mayor probabilidad de cambio.
   */
  function bindPermissionLifecycleEvents() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        stopPermissionPolling();
        return;
      }
      refreshPushUiState().catch(() => {});
    });

    window.addEventListener('focus', () => {
      refreshPushUiState().catch(() => {});
    });

    window.addEventListener('pageshow', () => {
      refreshPushUiState().catch(() => {});
    });
  }

  async function bindPermissionWatcher() {
    if (!navigator.permissions?.query) return;
    try {
      permissionStatusRef = await navigator.permissions.query({ name: 'notifications' });
      permissionStatusRef.onchange = () => {
        refreshPushUiState().catch(() => {});
      };
      await refreshPushUiState();
    } catch (_) {
      permissionStatusRef = null;
    }
  }

  function renderEnableButtonState() {
    const btn = _$('btn-push-enable');
    if (!btn) return;
    const iconUse = btn.querySelector('use');
    const label = btn.querySelector('.push-enable-btn__label');
    const isActive = Notification.permission === 'granted';

    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    if (label) label.textContent = isActive ? 'Notificaciones activadas' : 'Recibir novedades';
    if (iconUse) iconUse.setAttribute('href', isActive ? '#icon-check' : '#icon-bell');
  }

  function updateUiSupportState() {
    const supportEl = _$('push-support-state');
    if (!supportEl) return;

    const supported = ('serviceWorker' in navigator) && ('Notification' in window) && ('PushManager' in window);
    supportEl.textContent = supported
      ? 'Recordatorios activos al habilitar permisos.'
      : 'Este navegador no permite recordatorios automáticos.';
    supportEl.style.color = supported ? 'var(--success, #68d391)' : 'var(--error, #fc8181)';

    if (!supported) {
      setStatus('Puedes seguir usando Love Arcade sin notificaciones.');
    }
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    swReg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return swReg;
  }

  async function upsertSubscriptionOnSupabase(subscription, enabled) {
    const sentinel = window.Sentinel;
    const sb = sentinel?.getClient?.();
    const session = sentinel?.getSession?.();
    if (!sb || !session?.user?.id) {
      return { ok: false, reason: 'no-session' };
    }

    const json = subscription ? subscription.toJSON() : null;
    const payload = {
      user_id: session.user.id,
      endpoint: json?.endpoint || null,
      p256dh: json?.keys?.p256dh || null,
      auth: json?.keys?.auth || null,
      user_agent: navigator.userAgent,
      platform: /android/i.test(navigator.userAgent)
        ? 'android'
        : (/iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'other'),
      is_active: Boolean(enabled)
    };

    const { error } = await sb
      .from('push_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' });

    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  }

  function readLocalReminderState() {
    const gc = window.GameCenter;
    const now = Date.now();
    const daily = gc?.canClaimDaily?.() ? 1 : 0;
    const gcState = gc?.getState?.() || {};
    const lastDailyClaimAt = Number(gcState?.daily?.lastClaim || 0) || 0;
    const moon = gc?.getMoonBlessingStatus?.() || { active: false, remainingMs: 0 };
    const moonExpiryTs = moon.active ? now + Number(moon.remainingMs || 0) : 0;
    const nextDailyTs = now + 24 * 60 * 60 * 1000;

    let eventsPayload = null;
    try {
      const raw = localStorage.getItem('love_arcade_events_v1');
      if (raw) eventsPayload = JSON.parse(raw);
    } catch (_) {}

    const activeEvents = eventsPayload?.data?.activeEvents || eventsPayload?.activeEvents || [];
    let nextEventEndTs = 0;
    for (const ev of activeEvents) {
      const endTs = Number(new Date(ev?.endDate || ev?.endsAt || 0).getTime() || 0);
      if (endTs > now && (nextEventEndTs === 0 || endTs < nextEventEndTs)) nextEventEndTs = endTs;
    }

    const shopHash = String(localStorage.getItem('love_arcade_shop_catalog_hash_v1') || '');

    return {
      next_daily_claim_at: nextDailyTs,
      moon_blessing_expires_at: moonExpiryTs || null,
      shop_catalog_hash: shopHash || null,
      active_event_ids: activeEvents.map((x) => String(x?.id || '')).filter(Boolean),
      next_event_end_at: nextEventEndTs || null,
      can_claim_daily: daily === 1,
      daily_last_claim_at: lastDailyClaimAt || null,
      // JS getTimezoneOffset(): minutos para sumar a hora local y obtener UTC.
      // Para reconstruir hora local desde UTC en backend: local = utc - getTimezoneOffset().
      daily_timezone_offset_minutes: Number(new Date().getTimezoneOffset() || 0)
    };
  }

  async function syncReminderStateToSupabase() {
    const sentinel = window.Sentinel;
    const sb = sentinel?.getClient?.();
    const session = sentinel?.getSession?.();
    if (!sb || !session?.user?.id) return { ok: false, reason: 'no-session' };

    const st = readLocalReminderState();
    const payload = {
      user_id: session.user.id,
      daily_enabled: true,
      moon_enabled: true,
      shop_enabled: true,
      events_enabled: true,
      next_daily_claim_at: new Date(st.next_daily_claim_at).toISOString(),
      daily_can_claim: Boolean(st.can_claim_daily),
      daily_last_claim_at: st.daily_last_claim_at ? new Date(st.daily_last_claim_at).toISOString() : null,
      daily_timezone_offset_minutes: Number(st.daily_timezone_offset_minutes || 0),
      moon_blessing_expires_at: st.moon_blessing_expires_at ? new Date(st.moon_blessing_expires_at).toISOString() : null,
      shop_catalog_hash: st.shop_catalog_hash,
      active_event_ids: st.active_event_ids,
      next_event_end_at: st.next_event_end_at ? new Date(st.next_event_end_at).toISOString() : null
    };

    const { error } = await sb.from('user_notification_state').upsert(payload, { onConflict: 'user_id' });
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  }

  async function subscribePush() {
    if (!swReg) await registerServiceWorker();
    if (!swReg) throw new Error('No se pudo registrar service worker.');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      if (permission === 'denied' && isOperaAndroid()) {
        throw new Error('Permiso bloqueado por el navegador.');
      }
      throw new Error('No pudimos activar los recordatorios en este momento.');
    }

    const existing = await swReg.pushManager.getSubscription();
    if (existing) {
      await upsertSubscriptionOnSupabase(existing, true);
      await refreshPushUiState();
      return existing;
    }

    if (!vapidPublicKey) await fetchPushConfig();
    if (!vapidPublicKey) {
      throw new Error('Configuración push no disponible. Intenta más tarde.');
    }

    const sub = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
    });

    await upsertSubscriptionOnSupabase(sub, true);
    await refreshPushUiState();
    return sub;
  }

  async function unsubscribePush() {
    if (!swReg) await registerServiceWorker();
    const sub = await swReg?.pushManager?.getSubscription?.();
    if (!sub) return;
    await upsertSubscriptionOnSupabase(sub, false);
    await sub.unsubscribe();
    await refreshPushUiState();
  }

  async function showLocalNotification(payload) {
    if (!swReg) await registerServiceWorker();
    if (!swReg) return;

    if (Notification.permission !== 'granted') return;
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', payload });
      return;
    }

    await swReg.showNotification(payload.title || 'Love Arcade', {
      body: payload.body || '',
      icon: payload.icon || '/assets/icon/icon-notification.png',
      badge: payload.badge || '/assets/icon/icon-notification.png',
      tag: payload.tag || 'love-arcade-local',
      data: payload
    });
  }

  function bindButtons() {
    _$( 'btn-push-enable')?.addEventListener('click', async () => {
      try {
        toggleRecoveryCard(false);
        setStatus('Preparando recordatorios…');
        await subscribePush();
        await refreshPushUiState();
        const prefs = loadPrefs();
        prefs.enabled = true;
        savePrefs(prefs);
        await syncReminderStateToSupabase();
        setStatus('¡Listo! Ya recibirás avisos importantes de Love Arcade.');
      } catch (err) {
        const blocked = Notification.permission === 'denied';
        toggleRecoveryCard(Boolean(blocked && isOperaAndroid()));
        setStatus(err?.message || 'No pudimos activar los recordatorios.', true);
      }
    });


    _$( 'btn-push-test')?.addEventListener('click', async () => {
      try {
        await showLocalNotification({
          title: 'Recordatorio de prueba',
          body: '¡Todo bien! Tus avisos están funcionando correctamente.',
          tag: 'push-test',
          view: 'home',
          url: '/#view=home'
        });
        setStatus('Prueba enviada correctamente.');
      } catch (err) {
        setStatus(err?.message || 'No pudimos enviar la prueba.', true);
      }
    });
  }

  function bindServiceWorkerDeepLinkBridge() {
    navigator.serviceWorker?.addEventListener?.('message', (event) => {
      const msg = event.data || {};
      if (msg.type === 'LA_PUSH_STATE_UPDATED') {
        refreshPushUiState().catch(() => {});
        return;
      }
      if (msg.type !== 'LA_NOTIFICATION_OPEN') return;
      const url = String(msg.url || '');
      if (url.includes('#view=shop')) window.SpaRouter?.navigateTo?.('shop');
      else if (url.includes('#view=events')) window.SpaRouter?.navigateTo?.('events');
      else window.SpaRouter?.navigateTo?.('home');
    });
  }

  async function init() {
    updateUiSupportState();
    await refreshPushUiState();
    bindButtons();
    bindPermissionLifecycleEvents();

    if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
      return;
    }

    await fetchPushConfig();
    await registerServiceWorker();
    bindServiceWorkerDeepLinkBridge();
    await bindPermissionWatcher();
    await syncReminderStateToSupabase();
    window.setInterval(() => { syncReminderStateToSupabase().catch(() => {}); }, 5 * 60 * 1000);

    await refreshPushUiState();
  }

  document.addEventListener('DOMContentLoaded', () => {
    init().catch((err) => {
      setStatus(`Error inicializando push: ${err?.message || 'desconocido'}`, true);
    });
  });
})();
