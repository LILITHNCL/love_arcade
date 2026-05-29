(function MAREJIG_levelsModule(windowObject) {
    'use strict';

    var MAREJIG_DIFFICULTY_CONFIG = Object.freeze({
        easy: Object.freeze({
            label: 'Fácil',
            targetPieceCount: 30,
            segmentPlan: Object.freeze([6, 6, 8, 10]),
            rewardRange: Object.freeze([35, 45]),
            hintPieceLimit: 4,
            hintDurationMs: 4200
        }),
        standard: Object.freeze({
            label: 'Estándar',
            targetPieceCount: 40,
            segmentPlan: Object.freeze([8, 8, 8, 8, 8]),
            rewardRange: Object.freeze([50, 65]),
            hintPieceLimit: 3,
            hintDurationMs: 3600
        }),
        hard: Object.freeze({
            label: 'Difícil',
            targetPieceCount: 48,
            segmentPlan: Object.freeze([9, 9, 10, 10, 10]),
            rewardRange: Object.freeze([70, 90]),
            hintPieceLimit: 2,
            hintDurationMs: 3000
        })
    });

    var MAREJIG_LEVEL_SPECS = Object.freeze([
        Object.freeze(['raiden_shogun_001', 1, 'Raiden Shogun', 'Personajes', 'standard', 55, 'raiden-af545xdf']),
        Object.freeze(['raiden_shogun_002', 1, 'Raiden Shogun', 'Personajes', 'standard', 55, 'raiden-af545xdf'])
    ]);

    var MAREJIG_ALLOWED_LEVEL_KEYS = Object.freeze([
        'id', 'order', 'title', 'pack', 'difficulty', 'cloudinaryPublicId', 'sourceFormat', 'aspectRatio',
        'master', 'board', 'targetPieceCount', 'segmentPlan', 'rewardCoins'
    ]);

    function MAREJIG_cloneArray(items) {
        return items.slice();
    }

    function MAREJIG_createLevel(spec) {
        var difficulty = spec[4];
        var difficultyConfig = MAREJIG_DIFFICULTY_CONFIG[difficulty] || MAREJIG_DIFFICULTY_CONFIG.standard;
        var id = spec[0];
        var publicId = spec[6] || ('marejig/levels/' + id);

        return Object.freeze({
            id: id,
            order: spec[1],
            title: spec[2],
            pack: spec[3],
            difficulty: difficulty,
            cloudinaryPublicId: publicId,
            sourceFormat: 'avif',
            aspectRatio: '4:3',
            master: Object.freeze({ width: 2400, height: 1800 }),
            board: Object.freeze({ cols: 12, rows: 9 }),
            targetPieceCount: difficultyConfig.targetPieceCount,
            segmentPlan: MAREJIG_cloneArray(difficultyConfig.segmentPlan),
            rewardCoins: spec[5]
        });
    }

    var MAREJIG_LEVELS = MAREJIG_LEVEL_SPECS.map(MAREJIG_createLevel);

    function MAREJIG_isPositiveInteger(value) {
        return Number.isInteger(value) && value > 0;
    }

    function MAREJIG_isRecognizedDifficulty(difficulty) {
        return Object.prototype.hasOwnProperty.call(MAREJIG_DIFFICULTY_CONFIG, difficulty);
    }

    function MAREJIG_validateSegmentPlan(level) {
        if (!Array.isArray(level.segmentPlan) || level.segmentPlan.length < 2) return false;

        var total = level.segmentPlan.reduce(function MAREJIG_sumSegments(sum, count) {
            return sum + count;
        }, 0);

        return total === level.targetPieceCount && level.segmentPlan.every(MAREJIG_isPositiveInteger);
    }

    function MAREJIG_hasOnlyKnownKeys(level) {
        return Object.keys(level).every(function MAREJIG_knownKey(key) {
            return MAREJIG_ALLOWED_LEVEL_KEYS.indexOf(key) !== -1;
        });
    }

    function MAREJIG_validateLevel(level) {
        if (!level || typeof level !== 'object') return false;
        if (!MAREJIG_hasOnlyKnownKeys(level)) return false;
        if (!level.id || typeof level.id !== 'string') return false;
        if (!MAREJIG_isPositiveInteger(level.order)) return false;
        if (!level.title || typeof level.title !== 'string') return false;
        if (!level.pack || typeof level.pack !== 'string') return false;
        if (!MAREJIG_isRecognizedDifficulty(level.difficulty)) return false;
        if (!level.cloudinaryPublicId || typeof level.cloudinaryPublicId !== 'string') return false;
        if (level.sourceFormat !== 'avif') return false;
        if (level.aspectRatio !== '4:3') return false;
        if (!level.master || level.master.width !== 2400 || level.master.height !== 1800) return false;
        if (!level.board || level.board.cols !== 12 || level.board.rows !== 9) return false;
        if (level.difficulty === 'easy' && (level.targetPieceCount < 28 || level.targetPieceCount > 34)) return false;
        if (level.difficulty === 'standard' && (level.targetPieceCount < 36 || level.targetPieceCount > 42)) return false;
        if (level.difficulty === 'hard' && (level.targetPieceCount < 44 || level.targetPieceCount > 50)) return false;
        if (!MAREJIG_validateSegmentPlan(level)) return false;
        if (!MAREJIG_isPositiveInteger(level.rewardCoins)) return false;

        return true;
    }

    function MAREJIG_getOrdered() {
        return MAREJIG_LEVELS.slice().sort(function MAREJIG_sortLevels(a, b) {
            return a.order - b.order;
        });
    }

    function MAREJIG_getById(id) {
        return MAREJIG_LEVELS.find(function MAREJIG_findLevel(level) {
            return level.id === id;
        }) || null;
    }

    function MAREJIG_getPacks() {
        var packs = Object.create(null);

        MAREJIG_LEVELS.forEach(function MAREJIG_indexPack(level) {
            packs[level.pack] = true;
        });

        return Object.keys(packs).sort();
    }

    function MAREJIG_getDifficulties() {
        return Object.keys(MAREJIG_DIFFICULTY_CONFIG);
    }

    function MAREJIG_getDifficultyConfig(difficulty) {
        return MAREJIG_DIFFICULTY_CONFIG[difficulty] || MAREJIG_DIFFICULTY_CONFIG.standard;
    }

    function MAREJIG_validateCatalog() {
        var seenIds = Object.create(null);
        var seenOrders = Object.create(null);
        var errors = [];

        MAREJIG_LEVELS.forEach(function MAREJIG_checkLevel(level) {
            if (!MAREJIG_validateLevel(level)) {
                errors.push('Nivel inválido: ' + (level && level.id ? level.id : 'sin_id'));
            }

            if (level && level.id) {
                if (seenIds[level.id]) errors.push('ID duplicado: ' + level.id);
                seenIds[level.id] = true;
            }

            if (level && level.order) {
                if (seenOrders[level.order]) errors.push('Order duplicado: ' + level.order);
                seenOrders[level.order] = true;
            }
        });

        return { valid: errors.length === 0, errors: errors };
    }

    windowObject.MAREJIG_LevelCatalog = Object.freeze({
        levels: MAREJIG_LEVELS.slice(),
        difficultyConfig: MAREJIG_DIFFICULTY_CONFIG,
        allowedLevelKeys: MAREJIG_ALLOWED_LEVEL_KEYS.slice(),
        getOrdered: MAREJIG_getOrdered,
        getById: MAREJIG_getById,
        getPacks: MAREJIG_getPacks,
        getDifficulties: MAREJIG_getDifficulties,
        getDifficultyConfig: MAREJIG_getDifficultyConfig,
        validateLevel: MAREJIG_validateLevel,
        validateCatalog: MAREJIG_validateCatalog
    });
})(window);
