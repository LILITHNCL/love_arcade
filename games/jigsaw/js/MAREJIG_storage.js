(function MAREJIG_storageModule(windowObject) {
    'use strict';

    var MAREJIG_KEYS = Object.freeze({
        completedLevels: 'MAREJIG_completedLevels_v1',
        levelProgress: 'MAREJIG_levelProgress_v1',
        activeSave: 'MAREJIG_activeSave_v1',
        settings: 'MAREJIG_settings_v1'
    });

    var MAREJIG_DEFAULTS = Object.freeze({
        completedLevels: Object.freeze({ version: 1, levels: Object.freeze({}) }),
        levelProgress: Object.freeze({ version: 1, levels: Object.freeze({}) }),
        activeSave: null,
        settings: Object.freeze({ version: 1, reducedMotion: false, haptics: true, sound: true, forceAvifForTesting: false, imageQualityPreference: 'auto' })
    });

    function MAREJIG_clone(value) {
        return value === null ? null : JSON.parse(JSON.stringify(value));
    }

    function MAREJIG_safeGet(key, fallback) {
        try {
            var raw = windowObject.localStorage.getItem(key);
            if (!raw) return MAREJIG_clone(fallback);
            var parsed = JSON.parse(raw);
            if (!parsed || (fallback && fallback.version && parsed.version !== fallback.version)) {
                return MAREJIG_clone(fallback);
            }
            return parsed;
        } catch (error) {
            console.warn('[MAREJIG] No se pudo leer storage seguro', key, error.message);
            return MAREJIG_clone(fallback);
        }
    }

    function MAREJIG_safeSet(key, value) {
        try {
            windowObject.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('[MAREJIG] No se pudo guardar storage seguro', key, error.message);
            return false;
        }
    }

    function MAREJIG_safeRemove(key) {
        try {
            windowObject.localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('[MAREJIG] No se pudo limpiar storage seguro', key, error.message);
            return false;
        }
    }

    function MAREJIG_getCompletedLevels() {
        var completed = MAREJIG_safeGet(MAREJIG_KEYS.completedLevels, MAREJIG_DEFAULTS.completedLevels);
        if (!completed.levels || typeof completed.levels !== 'object') completed.levels = {};
        return completed;
    }

    function MAREJIG_isLevelCompleted(levelId) {
        var completed = MAREJIG_getCompletedLevels();
        return Boolean(completed.levels[levelId]);
    }

    function MAREJIG_markLevelCompleted(level, metrics) {
        var completed = MAREJIG_getCompletedLevels();
        var previous = completed.levels[level.id] || {};
        var elapsedMs = Number(metrics && metrics.elapsedMs) || previous.bestTimeMs || 0;
        var moves = Number(metrics && metrics.moves) || previous.fewestMoves || 0;
        var hintsUsed = Number(metrics && metrics.hintsUsed) || previous.hintsUsed || 0;
        var rewardReported = Boolean(metrics && metrics.rewardReported) || Boolean(previous.rewardReported);

        completed.levels[level.id] = {
            completedAt: previous.completedAt || new Date().toISOString(),
            bestTimeMs: previous.bestTimeMs ? Math.min(previous.bestTimeMs, elapsedMs || previous.bestTimeMs) : elapsedMs,
            fewestMoves: previous.fewestMoves ? Math.min(previous.fewestMoves, moves || previous.fewestMoves) : moves,
            hintsUsed: hintsUsed,
            rewardReported: rewardReported,
            rewardLevelId: 'level_' + level.id,
            rewardCoins: Math.max(1, Math.floor(level.rewardCoins))
        };

        return MAREJIG_safeSet(MAREJIG_KEYS.completedLevels, completed);
    }

    function MAREJIG_getProgressStore() {
        var progress = MAREJIG_safeGet(MAREJIG_KEYS.levelProgress, MAREJIG_DEFAULTS.levelProgress);
        if (!progress.levels || typeof progress.levels !== 'object') progress.levels = {};
        return progress;
    }

    function MAREJIG_getLevelProgress(levelId) {
        var progress = MAREJIG_getProgressStore();
        return progress.levels[levelId] || null;
    }

    function MAREJIG_saveLevelProgress(levelId, summary) {
        var progress = MAREJIG_getProgressStore();
        progress.levels[levelId] = Object.assign({}, summary, { updatedAt: new Date().toISOString() });
        return MAREJIG_safeSet(MAREJIG_KEYS.levelProgress, progress);
    }

    function MAREJIG_getActiveSave() {
        return MAREJIG_safeGet(MAREJIG_KEYS.activeSave, MAREJIG_DEFAULTS.activeSave);
    }

    function MAREJIG_saveActiveSave(save) {
        if (!save || typeof save !== 'object') return false;
        var safeSave = Object.assign({}, save, { version: 1, updatedAt: new Date().toISOString() });
        return MAREJIG_safeSet(MAREJIG_KEYS.activeSave, safeSave);
    }

    function MAREJIG_clearActiveSave() {
        return MAREJIG_safeRemove(MAREJIG_KEYS.activeSave);
    }

    function MAREJIG_getSettings() {
        var settings = MAREJIG_safeGet(MAREJIG_KEYS.settings, MAREJIG_DEFAULTS.settings);
        return Object.assign({}, MAREJIG_DEFAULTS.settings, settings, { version: 1 });
    }

    function MAREJIG_saveSettings(settings) {
        var next = Object.assign({}, MAREJIG_getSettings(), settings || {}, { version: 1 });
        return MAREJIG_safeSet(MAREJIG_KEYS.settings, next);
    }

    windowObject.MAREJIG_Storage = Object.freeze({
        keys: MAREJIG_KEYS,
        getCompletedLevels: MAREJIG_getCompletedLevels,
        isLevelCompleted: MAREJIG_isLevelCompleted,
        markLevelCompleted: MAREJIG_markLevelCompleted,
        getLevelProgress: MAREJIG_getLevelProgress,
        saveLevelProgress: MAREJIG_saveLevelProgress,
        getActiveSave: MAREJIG_getActiveSave,
        saveActiveSave: MAREJIG_saveActiveSave,
        clearActiveSave: MAREJIG_clearActiveSave,
        getSettings: MAREJIG_getSettings,
        saveSettings: MAREJIG_saveSettings
    });
})(window);
