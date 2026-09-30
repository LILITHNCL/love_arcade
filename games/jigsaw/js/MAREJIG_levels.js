(function MAREJIG_levelsModule(windowObject) {
    'use strict';

    var MAREJIG_DIFFICULTY_CONFIG = Object.freeze({
        easy: Object.freeze({
            label: 'Fácil',
            board: Object.freeze({ cols: 12, rows: 9 }),
            targetPieceCount: 24,
            segmentPlan: Object.freeze([6, 6, 6, 6]),
            rewardCoins: 200,
        }),
        standard: Object.freeze({
            label: 'Normal',
            board: Object.freeze({ cols: 12, rows: 9 }),
            targetPieceCount: 32,
            segmentPlan: Object.freeze([8, 8, 8, 8]),
            rewardCoins: 125,
        }),
        hard: Object.freeze({
            label: 'Difícil',
            board: Object.freeze({ cols: 16, rows: 12 }),
            targetPieceCount: 60,
            segmentPlan: Object.freeze([8, 8, 8, 8, 8, 10, 10]),
            rewardCoins: 200,
        })
    });

    var MAREJIG_LEVEL_SPECS = Object.freeze([
        Object.freeze(['nivel_001', 1, 'A medio decir', 'Producción', 'easy', 'nivel001']),
        Object.freeze(['nivel_002', 2, 'El pez no parpadea', 'Producción', 'easy', 'nivel002']),
        Object.freeze(['nivel_003', 3, 'Orejitas', 'Producción', 'easy', 'nivel003']),
        Object.freeze(['nivel_004', 4, 'Casi humano', 'Producción', 'easy', 'nivel004']),
        Object.freeze(['nivel_005', 5, 'Travesura bajo faroles rojos', 'Producción', 'easy', 'nivel005']),
        Object.freeze(['nivel_006', 6, 'Guiño dorado', 'Producción', 'easy', 'nivel006']),
        Object.freeze(['nivel_007', 7, 'Brisa escarlata', 'Producción', 'easy', 'nivel007']),
        Object.freeze(['nivel_008', 8, 'Devoradora de Mochi', 'Producción', 'easy', 'nivel008']),
        Object.freeze(['nivel_009', 9, 'No era por aquí', 'Producción', 'easy', 'nivel009']),
        Object.freeze(['nivel_010', 10, 'Todavía no', 'Producción', 'easy', 'nivel010']),
        Object.freeze(['nivel_011', 11, 'La noche en que no llovió', 'Producción', 'easy', 'nivel011']),
        Object.freeze(['nivel_012', 12, 'Caos irresistible', 'Producción', 'easy', 'nivel012']),
        Object.freeze(['nivel_013', 13, 'Paz nostálgica', 'Producción', 'easy', 'nivel013']),
        Object.freeze(['nivel_014', 14, 'Hacia la luz', 'Producción', 'easy', 'nivel014']),
        Object.freeze(['nivel_015', 15, 'Nuevo mundo', 'Producción', 'easy', 'nivel015']),
        Object.freeze(['nivel_016', 16, 'Wubba Lubba', 'Producción', 'easy', 'nivel016']),
        Object.freeze(['nivel_017', 17, 'Sin saberlo', 'Producción', 'easy', 'nivel017']),
        Object.freeze(['nivel_018', 18, 'Plus Ultra', 'Producción', 'easy', 'nivel018']),
        Object.freeze(['nivel_019', 19, 'Florecer juntos', 'Producción', 'easy', 'nivel019']),
        Object.freeze(['nivel_020', 20, 'Cinco noches', 'Producción', 'easy', 'nivel020']),
        Object.freeze(['nivel_021', 21, 'Realidad pérdida', 'Producción', 'easy', 'nivel021']),
        Object.freeze(['nivel_022', 22, 'Sin perdón', 'Producción', 'easy', 'nivel022']),
        Object.freeze(['nivel_023', 23, 'Deseo dorado', 'Producción', 'easy', 'nivel023']),
        Object.freeze(['nivel_024', 24, 'Estrella escondida', 'Producción', 'easy', 'nivel024']),
        Object.freeze(['nivel_025', 25, 'Regalo', 'Producción', 'easy', 'nivel025'])
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
        var publicId = spec[5] || ('marejig/levels/' + id);

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
            board: Object.freeze({ cols: difficultyConfig.board.cols, rows: difficultyConfig.board.rows }),
            targetPieceCount: difficultyConfig.targetPieceCount,
            segmentPlan: MAREJIG_cloneArray(difficultyConfig.segmentPlan),
            rewardCoins: difficultyConfig.rewardCoins
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
        if (!level.board || !MAREJIG_isPositiveInteger(level.board.cols) || !MAREJIG_isPositiveInteger(level.board.rows)) return false;
        var expectedDifficulty = MAREJIG_getDifficultyConfig(level.difficulty);
        if (level.board.cols !== expectedDifficulty.board.cols || level.board.rows !== expectedDifficulty.board.rows) return false;
        if (level.board.cols / level.board.rows !== 4 / 3) return false;
        if (level.difficulty === 'easy' && (level.targetPieceCount < 22 || level.targetPieceCount > 28)) return false;
        if (level.difficulty === 'standard' && (level.targetPieceCount < 28 || level.targetPieceCount > 34)) return false;
        if (level.difficulty === 'hard' && (level.targetPieceCount < 56 || level.targetPieceCount > 64)) return false;
        if (!MAREJIG_validateSegmentPlan(level)) return false;
        if (!MAREJIG_isPositiveInteger(level.rewardCoins)) return false;
        if (level.rewardCoins !== expectedDifficulty.rewardCoins) return false;

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
