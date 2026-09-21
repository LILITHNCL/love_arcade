// Bootstrap clásico y bloqueante: se carga al final de <body>, después de core/domain/ui/cloud/pwa.
// Mantiene el camino síncrono pre-paint; no convertir a module/defer.
(function bootstrapLoveArcade() {
    const Store = window.LoveArcadeStore;
    const { KB, AVATAR_CLEANUP_KB } = Store.constants;
    const Theming = window.LoveArcadeTheming;
    const ThemeGrid = window.LoveArcadeThemeGrid;
    const HUD = window.LoveArcadeHUD;

    // INIT SÍNCRONO — Zero-Flicker Initiative.
    // Orden inviolable: tema → saldo → diario/luna → avatar → identidad.
    ThemeGrid.renderThemeGrid();
    Theming.applyTheme(Store.getStore().theme || 'violet');

    if (Store.isBase64Avatar(Store.getStore().userAvatar) && Store.getStore().userAvatar.length > (AVATAR_CLEANUP_KB * KB)) {
        Store.getStore().userAvatar = null;
        window.GhostAnalytics?.track('storage_cleaned', { reason: 'avatar_too_large' });
        Store.save();
    }

    HUD.syncInitialCoinDisplay();
    HUD.updateDailyButton();
    HUD.updateMoonBlessingUI();
    HUD.applyAvatar();
    HUD.applyIdentity();

    // revealUI() continúa llamándose desde el script inline de index.html, después de
    // updateStreakBar() y updateCountdownDisplay(), en el mismo hilo pre-paint.
    document.addEventListener('DOMContentLoaded', () => {
        window.LoveArcadeMicroInteractions.initInteractiveMicroFX();
        window.LoveArcadeMicroInteractions.initLoadingStateObserver();
        HUD.updateUI();
        window.GhostAnalytics?.initGameOpenTracking?.();
        window.LoveArcadeSentinel.initHubRehydration();
        window.LoveArcadeTime.initBackgroundSync();
        HUD.initInteractionControllers();
    });
})();
