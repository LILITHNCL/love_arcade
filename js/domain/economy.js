// Este script clásico debe cargarse después de history.js y antes de app.js.
(function initLoveArcadeEconomy() {
    const Store = window.LoveArcadeStore;
    const ECONOMY = window.ECONOMY;
    const { logTransaction } = window.LoveArcadeHistory;

    function buyItem(itemData) {
        const store = Store.getStore();
        const bought = store.inventory[itemData.id] || 0;
        if (bought > 0) return { success: false, reason: 'owned' };

        const finalPrice = ECONOMY.isSaleActive
            ? Math.floor(itemData.price * ECONOMY.saleMultiplier)
            : itemData.price;

        if (store.coins < finalPrice) {
            window.GhostAnalytics?.track('insufficient_funds', {
                wallpaper: itemData.name,
                precio: `${finalPrice} ⭐`,
                saldo: store.coins
            });
            return { success: false, reason: 'coins' };
        }

        const cashback = Math.floor(finalPrice * ECONOMY.cashbackRate);
        store.coins -= finalPrice;
        store.coins += cashback;
        store.inventory[itemData.id] = bought + 1;
        logTransaction('gasto', finalPrice, `Compra: ${itemData.name}`);
        if (cashback > 0) logTransaction('ingreso', cashback, `Cashback: ${itemData.name}`);

        Store.save({ immediateCloudSync: true });
        return { success: true, finalPrice, cashback };
    }

    function spendCoins(amount, motivo = 'Gasto directo') {
        const store = Store.getStore();
        const n = Math.floor(amount);
        if (!Number.isFinite(n) || n <= 0) return { success: false, coins: store.coins };
        if (store.coins < n) return { success: false, reason: 'insufficient', coins: store.coins };
        store.coins -= n;
        logTransaction('gasto', n, motivo);
        Store.save({ immediateCloudSync: true });
        return { success: true, coins: store.coins };
    }

    function addCoins(amount, motivo = 'Depósito directo') {
        const store = Store.getStore();
        const n = Math.floor(amount);
        if (!Number.isFinite(n) || n <= 0) return { success: false, coins: store.coins };
        store.coins += n;
        logTransaction('ingreso', n, motivo);
        Store.save({ immediateCloudSync: true });
        return { success: true, coins: store.coins };
    }

    function getBoughtCount(id) {
        return Store.getStore().inventory[id] || 0;
    }

    function getBalance() {
        return Store.getStore().coins;
    }

    function getInventory() {
        return { ...Store.getStore().inventory };
    }

    function getRedeemedCount() {
        return (Store.getStore().redeemedHashes || []).length;
    }

    function getDownloadUrl(itemId, sourceUrl) {
        if (!sourceUrl || getBoughtCount(itemId) === 0) return null;
        const uploadMarker = '/image/upload/';
        if (sourceUrl.includes(uploadMarker)) {
            if (sourceUrl.includes(`${uploadMarker}fl_attachment/`)) return sourceUrl;
            return sourceUrl.replace(uploadMarker, `${uploadMarker}fl_attachment/`);
        }
        return sourceUrl;
    }

    window.LoveArcadeEconomy = {
        buyItem,
        spendCoins,
        addCoins,
        getBalance,
        getInventory,
        getBoughtCount,
        getDownloadUrl,
        getRedeemedCount
    };
})();
