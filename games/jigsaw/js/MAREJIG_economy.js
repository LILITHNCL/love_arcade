(function MAREJIG_economyModule(windowObject) {
    'use strict';

    var MAREJIG_Config = windowObject.MAREJIG_Config;

    function MAREJIG_reportLevelCompleted(level, metrics) {
        var rewardLevelId = 'level_' + level.id;
        var coins = Math.max(1, Math.floor(level.rewardCoins));
        var result = {
            standalone: true,
            paid: false,
            rewardLevelId: rewardLevelId,
            coins: coins,
            metrics: metrics || null
        };

        if (windowObject.GameCenter && typeof windowObject.GameCenter.completeLevel === 'function') {
            result.standalone = false;
            try {
                result.gameCenterResult = windowObject.GameCenter.completeLevel(MAREJIG_Config.publicGameId, rewardLevelId, coins);
                result.paid = Boolean(result.gameCenterResult && result.gameCenterResult.paid);
            } catch (error) {
                result.error = error.message;
                console.warn('[MAREJIG] Error al reportar recompensa', error.message);
            }
            return result;
        }

        console.warn('[MAREJIG] GameCenter no disponible; recompensa no reportada', rewardLevelId);
        return result;
    }

    windowObject.MAREJIG_Economy = Object.freeze({
        reportLevelCompleted: MAREJIG_reportLevelCompleted
    });
})(window);
