// Este script clásico debe cargarse después de core/time-sync.js, core/state-store.js
// y domain/history.js, y antes de app.js. No depende del DOM ni de módulos de UI.
(function initLoveArcadeDailyStreak() {
    const CONFIG = window.CONFIG;
    const Store = window.LoveArcadeStore;
    const Time = window.LoveArcadeTime;
    const { logTransaction } = window.LoveArcadeHistory;
    const DAILY_REPAIR_COST = 500;

    function _getDailyRepairState() {
        const { time: now, verified, desynced } = Time.read();
        const { lastClaim, streak } = Store.getStore().daily;
        const diffDays = Time.dayDiff(now, lastClaim);
        return {
            now,
            verified,
            desynced,
            diffDays,
            repairAvailable: lastClaim > 0 && streak > 0 && diffDays === 2,
            repairCost: DAILY_REPAIR_COST,
            canAffordRepair: Store.getStore().coins >= DAILY_REPAIR_COST
        };
    }

    /** Reclama el bono diario usando el caché horario síncrono. */
    function claimDaily() {
        const { time: now, verified, desynced } = Time.read();
        const { lastClaim, streak } = Store.getStore().daily;

        // Mantener este orden: salto negativo → desynced → mismo día → reparación → cálculo.
        if (lastClaim > 0 && now < lastClaim) {
            return {
                success: false,
                verified,
                message: 'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.'
            };
        }

        if (desynced) {
            return {
                success: false,
                verified,
                message: 'Reloj desincronizado. Verifica la hora de tu dispositivo e inténtalo de nuevo.'
            };
        }

        const diffDays = Time.dayDiff(now, lastClaim);
        if (diffDays === 0) {
            return {
                success: false,
                verified,
                message: '¡Ya reclamaste tu bono hoy! Vuelve mañana.'
            };
        }

        if (diffDays === 2 && lastClaim > 0 && streak > 0) {
            const canAffordRepair = Store.getStore().coins >= DAILY_REPAIR_COST;
            return {
                success: false,
                repairRequired: true,
                repairCost: DAILY_REPAIR_COST,
                canAffordRepair,
                streak,
                verified,
                message: canAffordRepair
                    ? `Puedes reparar tu racha de ${streak} día${streak !== 1 ? 's' : ''}.`
                    : 'Consigue las monedas que faltan jugando en el Arcade.'
            };
        }

        const newStreak = diffDays === 1 ? streak + 1 : 1;
        const baseReward = Math.min(
            CONFIG.dailyReward + (newStreak - 1) * CONFIG.dailyStreakStep,
            CONFIG.dailyStreakCap
        );
        const moonActive = Store.getStore().buffs.moonBlessingExpiry > now;
        const moonBonus = moonActive ? 90 : 0;
        const totalReward = baseReward + moonBonus;

        Store.getStore().coins += totalReward;
        Store.getStore().daily = { lastClaim: now, streak: newStreak };
        logTransaction(
            'ingreso',
            totalReward,
            `Bono diario · racha ${newStreak}` + (moonBonus ? ' + Bendición Lunar' : '')
        );
        Store.save();

        window.GhostAnalytics?.track('daily_bonus', {
            recompensa: totalReward,
            base: baseReward,
            luna: moonBonus > 0 ? `+${moonBonus}` : 'no',
            racha: newStreak
        });

        return {
            success: true,
            reward: totalReward,
            baseReward,
            moonBonus,
            streak: newStreak,
            verified,
            message: `¡+${totalReward} monedas! Racha: ${newStreak} día${newStreak !== 1 ? 's' : ''}`
        };
    }

    function repairDailyStreak() {
        const state = _getDailyRepairState();
        const { lastClaim, streak } = Store.getStore().daily;

        if (lastClaim > 0 && state.now < lastClaim) {
            return { success: false, verified: state.verified, message: 'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.' };
        }
        if (state.desynced) {
            return { success: false, verified: state.verified, message: 'Reloj desincronizado. Verifica la hora de tu dispositivo e inténtalo de nuevo.' };
        }
        if (!state.repairAvailable) {
            return { success: false, verified: state.verified, message: 'La reparación de racha no está disponible ahora.' };
        }
        if (Store.getStore().coins < DAILY_REPAIR_COST) {
            return { success: false, repairRequired: true, verified: state.verified, message: 'Consigue las monedas que faltan jugando en el Arcade.' };
        }

        Store.getStore().coins -= DAILY_REPAIR_COST;
        Store.getStore().daily = { lastClaim: state.now, streak };
        logTransaction('gasto', DAILY_REPAIR_COST, `Reparación de racha · ${streak} días`);
        Store.save({ immediateCloudSync: true });
        window.GhostAnalytics?.track('daily_streak_repair', { costo: DAILY_REPAIR_COST, racha: streak });
        return { success: true, verified: state.verified, cost: DAILY_REPAIR_COST, streak, message: `Racha de ${streak} día${streak !== 1 ? 's' : ''} rescatada por ${DAILY_REPAIR_COST} monedas.` };
    }

    function canClaimDaily() {
        const { lastClaim } = Store.getStore().daily;
        if (lastClaim === 0) return true;
        const state = _getDailyRepairState();
        if (state.desynced) return false;
        return state.diffDays >= 1;
    }

    function getStreakInfo() {
        const { streak } = Store.getStore().daily;
        const repairState = _getDailyRepairState();
        const nextStreak = repairState.diffDays === 1 ? streak + 1 : 1;
        const nextReward = Math.min(
            CONFIG.dailyReward + (nextStreak - 1) * CONFIG.dailyStreakStep,
            CONFIG.dailyStreakCap
        );
        return {
            streak,
            nextReward,
            canClaim: repairState.diffDays >= 1 && !repairState.desynced,
            repairAvailable: repairState.repairAvailable,
            repairCost: DAILY_REPAIR_COST,
            canAffordRepair: repairState.canAffordRepair
        };
    }

    window.LoveArcadeDailyStreak = {
        claimDaily,
        repairDailyStreak,
        getNextDailyResetTime: (now = Date.now()) => Time.nextResetTime(now),
        canClaimDaily,
        getStreakInfo,
        _getDailyRepairState,
        constants: { DAILY_REPAIR_COST }
    };
})();
