// Runtime del bridge para /games. Se evalúa después de sus dependencias clásicas.
(function exposeLoveArcadeGameContract() {
    const Store = window.LoveArcadeStore;
    const { logTransaction, getHistory } = window.LoveArcadeHistory;
    const Economy = window.LoveArcadeEconomy;
    const Identity = window.LoveArcadeIdentity;

    /**
     * Registra una recompensa global exactamente una vez por gameId + levelId.
     * El store compartido se persiste en el mismo origen; el hub lo rehidrata al volver.
     */
    function completeLevel(gameId, levelId, rewardAmount) {
        const store = Store.getStore();
        if (!store.progress[gameId]) store.progress[gameId] = [];
        if (store.progress[gameId].includes(levelId)) return { paid: false, coins: store.coins };
        store.progress[gameId].push(levelId);
        store.coins += rewardAmount;
        logTransaction('ingreso', rewardAmount, `Nivel ${levelId} completado · ${gameId}`);
        Store.save({ immediateCloudSync: true });
        return { paid: true, coins: store.coins };
    }

    // Esta es una superficie intencionadamente pequeña: sólo compatibilidad de juegos,
    // no bootstrap, DOM, UI ni sincronización cloud del hub.
    window.GameCenter = {
        completeLevel,
        getBalance: Economy.getBalance,
        getHistory,
        addCoins: Economy.addCoins,
        spendCoins: Economy.spendCoins,
        buyItem: Economy.buyItem,
        getIdentity: Identity.getIdentity,
        hasIdentity: Identity.hasIdentity
    };
})();
