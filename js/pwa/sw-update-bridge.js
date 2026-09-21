// Este script clásico registra el aviso de actualización del Service Worker.
(function setupServiceWorkerUpdateBridge() {
    if (!('serviceWorker' in navigator)) return;

    function showUpdateBanner(registration) {
        if (document.getElementById('sw-update-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'sw-update-banner';
        banner.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;padding:12px 14px;border-radius:10px;background:#111;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px;';
        banner.innerHTML = '<span>Nueva versión disponible.</span><button id="sw-update-btn" style="background:#6d28d9;color:#fff;border:0;padding:8px 12px;border-radius:8px;cursor:pointer;">Actualizar</button>';
        document.body.appendChild(banner);
        banner.querySelector('#sw-update-btn')?.addEventListener('click', () => {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        });
    }

    navigator.serviceWorker.getRegistration('/').then((registration) => {
        if (!registration) return;
        if (registration.waiting) showUpdateBanner(registration);
        registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    showUpdateBanner(registration);
                }
            });
        });
    }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
})();
