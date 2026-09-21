// Este script clásico debe cargarse después de los módulos de dominio y antes de app.js.
(function initLoveArcadeGameCenter() {
    const Store = window.LoveArcadeStore;
    const { logTransaction, getHistory } = window.LoveArcadeHistory;
    const Economy = window.LoveArcadeEconomy;
    const PromoCodes = window.LoveArcadePromoCodes;
    const MoonBlessing = window.LoveArcadeMoonBlessing;
    const Identity = window.LoveArcadeIdentity;
    const Avatar = window.LoveArcadeAvatar;
    const DailyStreak = window.LoveArcadeDailyStreak;
    const Theming = window.LoveArcadeTheming;
    const { sha256 } = window.LoveArcadeUtils;
    const SYNC_SALT = 'love_arcade_v75_integrity_2026';
    let syncUI = () => {};

    function completeLevel(gameId, levelId, rewardAmount) {
        if (!Store.getStore().progress[gameId]) Store.getStore().progress[gameId] = [];
        if (Store.getStore().progress[gameId].includes(levelId)) return { paid: false, coins: Store.getStore().coins };
        Store.getStore().progress[gameId].push(levelId);
        Store.getStore().coins += rewardAmount;
        logTransaction('ingreso', rewardAmount, `Nivel ${levelId} completado · ${gameId}`);
        Store.save({ immediateCloudSync: true });
        return { paid: true, coins: Store.getStore().coins };
    }

    async function exportSave() {
        try {
            return await window.workerTask({ action: 'export', store: Store.getStore(), salt: SYNC_SALT });
        } catch (_) {}
        const json = JSON.stringify(Store.getStore());
        const checksum = await sha256(json + SYNC_SALT);
        const payload = JSON.stringify({ data: Store.getStore(), checksum });
        try {
            const bytes = new TextEncoder().encode(payload);
            const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
            return btoa(binary);
        } catch { return null; }
    }

    async function importSave(code) {
        try {
            let data;
            try {
                const result = await window.workerTask({ action: 'import', code, salt: SYNC_SALT });
                if (!result.valid) return { success: false, message: 'El código fue modificado manualmente. Importación rechazada por integridad.' };
                data = result.data;
            } catch (_) {
                const raw = atob(code.trim());
                const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
                const payload = JSON.parse(new TextDecoder().decode(bytes));
                if (payload.checksum && payload.data) {
                    const expected = await sha256(JSON.stringify(payload.data) + SYNC_SALT);
                    if (payload.checksum !== expected) return { success: false, message: 'El código fue modificado manualmente. Importación rechazada.' };
                    data = payload.data;
                } else data = payload;
            }
            if (typeof data.coins !== 'number') throw new Error('invalid');
            Store.replaceStore(Store.migrate(data), { notifyUI: false, notifyCloud: false });
            Store.save();
            return { success: true };
        } catch {
            return { success: false, message: 'Código inválido o corrupto.' };
        }
    }

    window.GameCenter = {
        completeLevel,
        buyItem: Economy.buyItem,
        spendCoins: Economy.spendCoins,
        getBoughtCount: Economy.getBoughtCount,
        getBalance: Economy.getBalance,
        getInventory: Economy.getInventory,
        addCoins: Economy.addCoins,
        getRedeemedCount: Economy.getRedeemedCount,
        getDownloadUrl: Economy.getDownloadUrl,
        getHistory,
        redeemPromoCode: PromoCodes.redeemPromoCode,
        claimDaily: DailyStreak.claimDaily,
        repairDailyStreak: DailyStreak.repairDailyStreak,
        getNextDailyResetTime: DailyStreak.getNextDailyResetTime,
        canClaimDaily: DailyStreak.canClaimDaily,
        getStreakInfo: DailyStreak.getStreakInfo,
        buyMoonBlessing: MoonBlessing.buyMoonBlessing,
        extendMoonBlessingDays: MoonBlessing.extendMoonBlessingDays,
        getMoonBlessingStatus: MoonBlessing.getMoonBlessingStatus,
        exportSave,
        importSave,
        setAvatar: Avatar.setAvatar,
        setAvatarPath: Avatar.setAvatarPath,
        getAvatar: Avatar.getAvatar,
        setTheme: Theming.setTheme,
        getTheme: Theming.getTheme,
        setIdentity: Identity.setIdentity,
        getIdentity: Identity.getIdentity,
        hasIdentity: Identity.hasIdentity,
        getState: () => ({
            coins: Store.getStore().coins,
            streak: Store.getStore().daily?.streak || 0,
            theme: Store.getStore().theme || 'violet',
            moonBlessingExpiry: Store.getStore().buffs?.moonBlessingExpiry || 0,
            nickname: Store.getStore().nickname || '',
            gender: Store.getStore().gender || '@'
        }),
        syncUI: (scope) => syncUI(scope)
    };

    window.LoveArcadeGameCenter = {
        setUIRefreshHandler: (handler) => { syncUI = typeof handler === 'function' ? handler : () => {}; }
    };
})();
