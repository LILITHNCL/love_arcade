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
    } catch (_) {}
  }

  async function requestPersistentStorage() {
    if (!caps.persistentStorage) return false;
    try { return await navigator.storage.persist(); } catch (_) { return false; }
  }

  async function share(data) {
    if (caps.webShare) return navigator.share(data);
    const text = data?.url || data?.text || window.location.href;
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    return false;
  }

  window.NativeCapabilities = { caps, initPeriodicSync, requestPersistentStorage, share };
  document.addEventListener('DOMContentLoaded', () => {
    initPeriodicSync();
    requestPersistentStorage();
  });
})();
