(function MAREJIG_economyModule(windowObject) {
    'use strict';

    function MAREJIG_reportLevelCompleted(level, metrics) {
        var rewardLevelId = 'level_' + level.id;
        const coins = Math.max(1, Math.floor(level.rewardCoins));

        if (metrics && metrics.rewardReported) {
            return { ok: true, mode: 'already-reported', coins: coins, rewardLevelId: rewardLevelId };
        }

        if (!windowObject.GameCenter || typeof windowObject.GameCenter.completeLevel !== 'function') {
            return { ok: true, mode: 'standalone', coins: coins, rewardLevelId: rewardLevelId };
        }

        try {
            windowObject.GameCenter.completeLevel('jigsaw', rewardLevelId, coins);
            return { ok: true, mode: 'gamecenter', coins: coins, rewardLevelId: rewardLevelId };
        } catch (error) {
            console.warn('[MAREJIG] Error al reportar recompensa', error.message);
            return { ok: false, error: error.message, coins: coins, rewardLevelId: rewardLevelId };
        }
    }

    windowObject.MAREJIG_Economy = Object.freeze({
        reportLevelCompleted: MAREJIG_reportLevelCompleted
    });
})(window);
