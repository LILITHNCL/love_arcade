// Este script clásico debe cargarse después de history.js y antes de app.js.
(function initLoveArcadeMoonBlessing() {
    const Store = window.LoveArcadeStore;
    const { logTransaction } = window.LoveArcadeHistory;
    let refreshUI = () => {};

    function formatExpiry(expiry) {
        return new Date(expiry).toLocaleDateString('es-MX', {
            day: '2-digit', month: 'long', year: 'numeric'
        });
    }

    function buyMoonBlessing() {
        const COST = 100;
        const DURATION = 7 * 86_400_000;
        const store = Store.getStore();

        if (store.coins < COST) {
            window.GhostAnalytics?.track('insufficient_funds', {
                wallpaper: 'Bendición Lunar (buff)',
                precio: `${COST} ⭐`,
                saldo: store.coins
            });
            return { success: false, reason: 'coins' };
        }

        const now = Date.now();
        const isActive = store.buffs.moonBlessingExpiry > now;
        store.coins -= COST;
        store.buffs.moonBlessingExpiry = (isActive ? store.buffs.moonBlessingExpiry : now) + DURATION;
        logTransaction('gasto', COST, 'Bendición Lunar activada (7 días)');
        Store.save();
        refreshUI();
        return { success: true, expiresAt: formatExpiry(store.buffs.moonBlessingExpiry) };
    }

    function extendMoonBlessingDays(days, motivo = 'Extensión de Bendición Lunar') {
        const wholeDays = Math.floor(days);
        if (!Number.isFinite(wholeDays) || wholeDays <= 0) return { success: false };

        const store = Store.getStore();
        const now = Date.now();
        const baseTs = store.buffs.moonBlessingExpiry > now ? store.buffs.moonBlessingExpiry : now;
        store.buffs.moonBlessingExpiry = baseTs + (wholeDays * 86_400_000);
        logTransaction('ingreso', 0, `${motivo}: +${wholeDays} día(s)`);
        Store.save({ immediateCloudSync: true });
        return { success: true, expiresAt: formatExpiry(store.buffs.moonBlessingExpiry) };
    }

    function getMoonBlessingStatus() {
        const now = Date.now();
        const expiry = Store.getStore().buffs.moonBlessingExpiry;
        const active = expiry > now;
        return {
            active,
            expiresAt: active ? formatExpiry(expiry) : null,
            remainingMs: active ? expiry - now : 0
        };
    }

    window.LoveArcadeMoonBlessing = {
        buyMoonBlessing,
        extendMoonBlessingDays,
        getMoonBlessingStatus,
        setUIRefreshHandler: (handler) => { refreshUI = typeof handler === 'function' ? handler : () => {}; }
    };
})();
