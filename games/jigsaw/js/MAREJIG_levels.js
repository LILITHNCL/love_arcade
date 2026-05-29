(function MAREJIG_levelsModule(windowObject) {
    'use strict';

    var MAREJIG_DIFFICULTY_CONFIG = Object.freeze({
        easy: Object.freeze({
            label: 'Fácil',
            targetPieceCount: 60,
            segmentPlan: Object.freeze([8, 8, 10, 10, 24]),
            rewardRange: Object.freeze([35, 45]),
            hintPieceLimit: 4,
            hintDurationMs: 4200
        }),
        standard: Object.freeze({
            label: 'Estándar',
            targetPieceCount: 60,
            segmentPlan: Object.freeze([10, 10, 12, 12, 16]),
            rewardRange: Object.freeze([50, 65]),
            hintPieceLimit: 3,
            hintDurationMs: 3600
        }),
        hard: Object.freeze({
            label: 'Difícil',
            targetPieceCount: 60,
            segmentPlan: Object.freeze([12, 12, 12, 12, 12]),
            rewardRange: Object.freeze([70, 90]),
            hintPieceLimit: 2,
            hintDurationMs: 3000,
            note: 'Metadata preparada para v1; el generador se mantiene en 56–64 piezas para evitar riesgo.'
        })
    });

    var MAREJIG_LEVEL_SPECS = Object.freeze([
        Object.freeze(['reef_001', 1, 'Buceo profundo', 'Océano', 'standard', 55]),
        Object.freeze(['forest_001', 2, 'Luz del bosque', 'Bosque', 'standard', 55]),
        Object.freeze(['aurora_001', 3, 'Aurora ártica', 'Espacio', 'standard', 60]),
        Object.freeze(['market_001', 4, 'Mercado nocturno', 'Ciudad', 'standard', 58]),
        Object.freeze(['temple_001', 5, 'Templo solar', 'Fantasía', 'standard', 62]),
        Object.freeze(['tidepool_002', 6, 'Pozas de marea', 'Océano', 'easy', 40]),
        Object.freeze(['kelp_003', 7, 'Bosque de kelp', 'Océano', 'hard', 78]),
        Object.freeze(['mangrove_004', 8, 'Manglar dorado', 'Océano', 'standard', 56]),
        Object.freeze(['moss_002', 9, 'Musgo luminoso', 'Bosque', 'easy', 38]),
        Object.freeze(['canopy_003', 10, 'Copa esmeralda', 'Bosque', 'standard', 57]),
        Object.freeze(['owl_004', 11, 'Sendero del búho', 'Bosque', 'hard', 82]),
        Object.freeze(['tram_002', 12, 'Tranvía lluvioso', 'Ciudad', 'easy', 42]),
        Object.freeze(['rooftops_003', 13, 'Azoteas violeta', 'Ciudad', 'standard', 60]),
        Object.freeze(['station_004', 14, 'Estación central', 'Ciudad', 'hard', 84]),
        Object.freeze(['dragon_002', 15, 'Dragón de cristal', 'Fantasía', 'hard', 88]),
        Object.freeze(['castle_003', 16, 'Castillo flotante', 'Fantasía', 'standard', 64]),
        Object.freeze(['garden_004', 17, 'Jardín feérico', 'Fantasía', 'easy', 44]),
        Object.freeze(['nebula_002', 18, 'Nebulosa coral', 'Espacio', 'standard', 63]),
        Object.freeze(['orbital_003', 19, 'Invernadero orbital', 'Espacio', 'hard', 86]),
        Object.freeze(['moon_004', 20, 'Bahía lunar', 'Espacio', 'easy', 43]),
        Object.freeze(['macaron_001', 21, 'Torre de macarons', 'Postres', 'easy', 39]),
        Object.freeze(['cocoa_002', 22, 'Cascada de cacao', 'Postres', 'standard', 52]),
        Object.freeze(['cat_001', 23, 'Siesta gatuna', 'Mascotas', 'easy', 41]),
        Object.freeze(['puppy_002', 24, 'Perrito aventurero', 'Mascotas', 'standard', 54]),
        Object.freeze(['mural_001', 25, 'Mural cinético', 'Arte', 'standard', 59]),
        Object.freeze(['gallery_002', 26, 'Galería de noche', 'Arte', 'hard', 80])
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
        return Object.freeze({
            id: id,
            order: spec[1],
            title: spec[2],
            pack: spec[3],
            difficulty: difficulty,
            cloudinaryPublicId: 'marejig/levels/' + id,
            sourceFormat: 'avif',
            aspectRatio: '4:3',
            master: Object.freeze({ width: 2400, height: 1800 }),
            board: Object.freeze({ cols: 16, rows: 12 }),
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
        if (!level.board || level.board.cols !== 16 || level.board.rows !== 12) return false;
        if (level.targetPieceCount !== 60) return false;
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
        MAREJIG_LEVELS.forEach(function MAREJIG_indexPack(level) { packs[level.pack] = true; });
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
