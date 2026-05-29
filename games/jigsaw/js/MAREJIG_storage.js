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

    var MAREJIG_SAVE_VERSION = 1;
    var MAREJIG_allowedKeys = Object.keys(MAREJIG_KEYS).map(function MAREJIG_keyName(name) { return MAREJIG_KEYS[name]; });
    var MAREJIG_lastStatus = { ok: true, label: 'Sin guardar', key: null, error: null };

    function MAREJIG_clone(value) {
        return value === null || value === undefined ? value : JSON.parse(JSON.stringify(value));
    }

    function MAREJIG_isAllowedKey(key) {
        return MAREJIG_allowedKeys.indexOf(key) !== -1;
    }

    function MAREJIG_setStatus(ok, label, key, error) {
        MAREJIG_lastStatus = { ok: Boolean(ok), label: label, key: key || null, error: error || null };
        return ok;
    }

    function MAREJIG_safeGet(key, fallback) {
        if (!MAREJIG_isAllowedKey(key)) return MAREJIG_clone(fallback);
        try {
            if (!windowObject.localStorage) return MAREJIG_clone(fallback);
            var raw = windowObject.localStorage.getItem(key);
            if (!raw) return MAREJIG_clone(fallback);
            var parsed = JSON.parse(raw);
            if (!parsed || (fallback && fallback.version && parsed.version !== fallback.version)) {
                console.warn('[MAREJIG] Storage ignorado por versión inválida', key);
                return MAREJIG_clone(fallback);
            }
            return parsed;
        } catch (error) {
            console.warn('[MAREJIG] No se pudo leer storage seguro', key, error.message);
            return MAREJIG_clone(fallback);
        }
    }

    function MAREJIG_noteSaving(key) {
        return MAREJIG_setStatus(true, 'Guardando…', key, null);
    }

    function MAREJIG_safeSet(key, value) {
        if (!MAREJIG_isAllowedKey(key)) return MAREJIG_setStatus(false, 'Guardado local no disponible', key, 'clave no permitida');
        try {
            if (!windowObject.localStorage) return MAREJIG_setStatus(false, 'Guardado local no disponible', key, 'localStorage ausente');
            windowObject.localStorage.setItem(key, JSON.stringify(value));
            return MAREJIG_setStatus(true, 'Guardado', key, null);
        } catch (error) {
            console.warn('[MAREJIG] No se pudo guardar storage seguro', key, error.message);
            return MAREJIG_setStatus(false, 'Guardado local no disponible', key, error.message);
        }
    }

    function MAREJIG_safeRemove(key) {
        if (!MAREJIG_isAllowedKey(key)) return false;
        try {
            if (!windowObject.localStorage) return false;
            windowObject.localStorage.removeItem(key);
            MAREJIG_setStatus(true, 'Guardado', key, null);
            return true;
        } catch (error) {
            console.warn('[MAREJIG] No se pudo limpiar storage seguro', key, error.message);
            MAREJIG_setStatus(false, 'Guardado local no disponible', key, error.message);
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
        var elapsedMs = Math.max(0, Number(metrics && metrics.elapsedMs) || Number(previous.bestTimeMs) || 0);
        var moves = Math.max(0, Number(metrics && metrics.moves) || Number(previous.fewestMoves) || 0);
        var hintsUsed = Math.max(0, Number(metrics && metrics.hintsUsed) || Number(previous.hintsUsed) || 0);
        var rewardLevelId = (metrics && metrics.rewardLevelId) || 'level_' + level.id;
        var rewardCoins = Math.max(1, Math.floor(Number((metrics && metrics.rewardCoins) || level.rewardCoins) || 1));
        var rewardReported = Boolean(metrics && metrics.rewardReported) || Boolean(previous.rewardReported);

        completed.levels[level.id] = {
            completedAt: previous.completedAt || new Date().toISOString(),
            lastCompletedAt: new Date().toISOString(),
            bestTimeMs: previous.bestTimeMs ? Math.min(previous.bestTimeMs, elapsedMs || previous.bestTimeMs) : elapsedMs,
            fewestMoves: previous.fewestMoves ? Math.min(previous.fewestMoves, moves || previous.fewestMoves) : moves,
            hintsUsed: hintsUsed,
            rewardReported: rewardReported,
            rewardLevelId: rewardLevelId,
            rewardCoins: rewardCoins
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
        progress.levels[levelId] = {
            updatedAt: new Date().toISOString(),
            elapsedMs: Math.max(0, Number(summary && summary.elapsedMs) || 0),
            moves: Math.max(0, Number(summary && summary.moves) || 0),
            hintsUsed: Math.max(0, Number(summary && summary.hintsUsed) || 0),
            currentSegmentIndex: Math.max(0, Number(summary && summary.currentSegmentIndex) || 0),
            completedSegmentCount: Math.max(0, Number(summary && summary.completedSegmentCount) || 0),
            placedPieceCount: Math.max(0, Number(summary && summary.placedPieceCount) || 0),
            totalPieceCount: Math.max(0, Number(summary && summary.totalPieceCount) || 0),
            puzzleSeed: Number(summary && summary.puzzleSeed) || 0,
            generatorVersion: String((summary && summary.generatorVersion) || '')
        };
        return MAREJIG_safeSet(MAREJIG_KEYS.levelProgress, progress);
    }

    function MAREJIG_clearLevelProgress(levelId) {
        var progress = MAREJIG_getProgressStore();
        if (progress.levels && Object.prototype.hasOwnProperty.call(progress.levels, levelId)) {
            delete progress.levels[levelId];
            return MAREJIG_safeSet(MAREJIG_KEYS.levelProgress, progress);
        }
        return true;
    }

    function MAREJIG_validateActiveSave(save) {
        if (!save || typeof save !== 'object') return null;
        if (save.version !== MAREJIG_SAVE_VERSION) return null;
        if (!save.levelId || typeof save.levelId !== 'string') return null;
        if (!Array.isArray(save.pieces) || !Array.isArray(save.groups)) return null;
        if (save.pieces.some(function MAREJIG_badPiece(piece) { return !piece || typeof piece.pieceId !== 'string' || typeof piece.groupId !== 'string'; })) return null;
        if (save.groups.some(function MAREJIG_badGroup(group) { return !group || typeof group.groupId !== 'string' || !Array.isArray(group.pieceIds); })) return null;
        return save;
    }

    function MAREJIG_getActiveSave() {
        var save = MAREJIG_safeGet(MAREJIG_KEYS.activeSave, MAREJIG_DEFAULTS.activeSave);
        var valid = MAREJIG_validateActiveSave(save);
        if (save && !valid) console.warn('[MAREJIG] Active save corrupto o incompatible ignorado');
        return valid;
    }

    function MAREJIG_compactActiveSave(save) {
        return {
            version: MAREJIG_SAVE_VERSION,
            levelId: String(save.levelId),
            puzzleSeed: Number(save.puzzleSeed) || 0,
            generatorVersion: String(save.generatorVersion || ''),
            elapsedMs: Math.max(0, Number(save.elapsedMs) || 0),
            moves: Math.max(0, Number(save.moves) || 0),
            hintsUsed: Math.max(0, Number(save.hintsUsed) || 0),
            currentSegmentIndex: Math.max(0, Number(save.currentSegmentIndex) || 0),
            completedSegmentIds: Array.isArray(save.completedSegmentIds) ? save.completedSegmentIds.slice() : [],
            revealedSegmentIds: Array.isArray(save.revealedSegmentIds) ? save.revealedSegmentIds.slice() : [],
            mainGroupId: save.mainGroupId || null,
            puzzleCompletedLocal: Boolean(save.puzzleCompletedLocal),
            completionStarted: Boolean(save.completionStarted),
            rewardReported: Boolean(save.rewardReported),
            pieces: (save.pieces || []).map(function MAREJIG_compactPiece(piece) {
                return { pieceId: piece.pieceId, groupId: piece.groupId, revealed: Boolean(piece.revealed), locked: Boolean(piece.locked) };
            }),
            groups: (save.groups || []).map(function MAREJIG_compactGroup(group) {
                return {
                    groupId: group.groupId,
                    pieceIds: group.pieceIds.slice(),
                    x: Number(group.x) || 0,
                    y: Number(group.y) || 0,
                    zIndex: Number(group.zIndex) || 0,
                    lockedToBoard: Boolean(group.lockedToBoard),
                    visible: Boolean(group.visible)
                };
            })
        };
    }

    function MAREJIG_saveActiveSave(save) {
        MAREJIG_noteSaving(MAREJIG_KEYS.activeSave);
        var safeSave = MAREJIG_validateActiveSave(MAREJIG_compactActiveSave(save || {}));
        if (!safeSave) return MAREJIG_setStatus(false, 'Sin guardar', MAREJIG_KEYS.activeSave, 'save inválido');
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

    function MAREJIG_getLastSaveStatus() {
        return Object.assign({}, MAREJIG_lastStatus);
    }

    windowObject.MAREJIG_Storage = Object.freeze({
        keys: MAREJIG_KEYS,
        getCompletedLevels: MAREJIG_getCompletedLevels,
        isLevelCompleted: MAREJIG_isLevelCompleted,
        markLevelCompleted: MAREJIG_markLevelCompleted,
        getLevelProgress: MAREJIG_getLevelProgress,
        saveLevelProgress: MAREJIG_saveLevelProgress,
        clearLevelProgress: MAREJIG_clearLevelProgress,
        getActiveSave: MAREJIG_getActiveSave,
        saveActiveSave: MAREJIG_saveActiveSave,
        clearActiveSave: MAREJIG_clearActiveSave,
        getSettings: MAREJIG_getSettings,
        saveSettings: MAREJIG_saveSettings,
        getLastSaveStatus: MAREJIG_getLastSaveStatus,
        noteSaving: MAREJIG_noteSaving
    });
})(window);
