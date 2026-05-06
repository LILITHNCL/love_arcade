(function(){
  const caps = {
    webShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
    periodicSync: false,
    persistentStorage: typeof navigator !== 'undefined' && !!navigator.storage?.persist
  };

  async function initPeriodicSync() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      caps.periodicSync = !!reg.periodicSync;
      if (reg.periodicSync) {
        const tags = await reg.periodicSync.getTags();
        if (!tags.includes('la-content-refresh')) {
          await reg.periodicSync.register('la-content-refresh', { minInterval: 24 * 60 * 60 * 1000 });
        }
      }
    } catch (_) {
      window.dispatchEvent(new CustomEvent('la:native-metric', { detail: { type: 'periodic_sync_fail', ts: Date.now() } }));
    }
  }

  async function requestPersistentStorage() {
    if (!caps.persistentStorage) return false;
    try {
      const ok = await navigator.storage.persist();
      window.dispatchEvent(new CustomEvent('la:native-metric', { detail: { type: ok ? 'persist_granted' : 'persist_denied', ts: Date.now() } }));
      return ok;
    } catch (_) { return false; }
  }

  async function share(data) {
    if (caps.webShare) return navigator.share(data).catch(() => false);
    const text = data?.url || data?.text || window.location.href;
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    window.dispatchEvent(new CustomEvent('la:share-fallback', { detail: { ts: Date.now() } }));
    if (typeof window.showToast === 'function') window.showToast('Enlace copiado al portapapeles', 'success');
    return false;
  }

  window.NativeCapabilities = { caps, initPeriodicSync, requestPersistentStorage, share };
  document.addEventListener('DOMContentLoaded', () => {
    initPeriodicSync();
    window.addEventListener('la:onboarding-complete', () => requestPersistentStorage(), { once: true });
    const panel = document.getElementById('native-capabilities-status');
    if (panel) {
      panel.innerHTML = `Share: ${caps.webShare ? 'soportado' : 'fallback'} · PeriodicSync: ${caps.periodicSync ? 'activo' : 'no'} · Persist: ${caps.persistentStorage ? 'soportado' : 'no'}`;
    }
  });
})();
