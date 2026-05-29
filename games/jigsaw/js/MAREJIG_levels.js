(function MAREJIG_levelsModule(windowObject) {
    'use strict';

    var MAREJIG_EXPECTED_SEGMENT_PLAN = [10, 10, 12, 12, 16];
    var MAREJIG_LEVELS = [
        {
            id: 'reef_001',
            order: 1,
            title: 'Buceo profundo',
            pack: 'Océano',
            difficulty: 'standard',
            cloudinaryPublicId: 'marejig/levels/reef_001',
            sourceFormat: 'avif',
            aspectRatio: '4:3',
            master: { width: 2400, height: 1800 },
            board: { cols: 16, rows: 12 },
            targetPieceCount: 60,
            segmentPlan: MAREJIG_EXPECTED_SEGMENT_PLAN.slice(),
            rewardCoins: 55
        },
        {
            id: 'forest_001',
            order: 2,
            title: 'Luz del bosque',
            pack: 'Bosque',
            difficulty: 'standard',
            cloudinaryPublicId: 'marejig/levels/forest_001',
            sourceFormat: 'avif',
            aspectRatio: '4:3',
            master: { width: 2400, height: 1800 },
            board: { cols: 16, rows: 12 },
            targetPieceCount: 60,
            segmentPlan: MAREJIG_EXPECTED_SEGMENT_PLAN.slice(),
            rewardCoins: 55
        },
        {
            id: 'aurora_001',
            order: 3,
            title: 'Aurora ártica',
            pack: 'Cielos',
            difficulty: 'standard',
            cloudinaryPublicId: 'marejig/levels/aurora_001',
            sourceFormat: 'avif',
            aspectRatio: '4:3',
            master: { width: 2400, height: 1800 },
            board: { cols: 16, rows: 12 },
            targetPieceCount: 60,
            segmentPlan: MAREJIG_EXPECTED_SEGMENT_PLAN.slice(),
            rewardCoins: 60
        },
        {
            id: 'market_001',
            order: 4,
            title: 'Mercado nocturno',
            pack: 'Ciudad',
            difficulty: 'standard',
            cloudinaryPublicId: 'marejig/levels/market_001',
            sourceFormat: 'avif',
            aspectRatio: '4:3',
            master: { width: 2400, height: 1800 },
            board: { cols: 16, rows: 12 },
            targetPieceCount: 60,
            segmentPlan: MAREJIG_EXPECTED_SEGMENT_PLAN.slice(),
            rewardCoins: 58
        },
        {
            id: 'temple_001',
            order: 5,
            title: 'Templo solar',
            pack: 'Ruinas',
            difficulty: 'standard',
            cloudinaryPublicId: 'marejig/levels/temple_001',
            sourceFormat: 'avif',
            aspectRatio: '4:3',
            master: { width: 2400, height: 1800 },
            board: { cols: 16, rows: 12 },
            targetPieceCount: 60,
            segmentPlan: MAREJIG_EXPECTED_SEGMENT_PLAN.slice(),
            rewardCoins: 62
        }
    ];

    function MAREJIG_isPositiveInteger(value) {
        return Number.isInteger(value) && value > 0;
    }

    function MAREJIG_validateLevel(level) {
        if (!level || typeof level !== 'object') return false;
        if (!level.id || typeof level.id !== 'string') return false;
        if (!MAREJIG_isPositiveInteger(level.order)) return false;
        if (!level.title || typeof level.title !== 'string') return false;
        if (!level.pack || typeof level.pack !== 'string') return false;
        if (level.difficulty !== 'standard') return false;
        if (!level.cloudinaryPublicId || typeof level.cloudinaryPublicId !== 'string') return false;
        if (level.sourceFormat !== 'avif') return false;
        if (level.aspectRatio !== '4:3') return false;
        if (!level.master || level.master.width !== 2400 || level.master.height !== 1800) return false;
        if (!level.board || level.board.cols !== 16 || level.board.rows !== 12) return false;
        if (level.targetPieceCount !== 60) return false;
        if (!Array.isArray(level.segmentPlan) || level.segmentPlan.join(',') !== MAREJIG_EXPECTED_SEGMENT_PLAN.join(',')) return false;
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

    function MAREJIG_validateCatalog() {
        var seen = Object.create(null);
        var errors = [];

        MAREJIG_LEVELS.forEach(function MAREJIG_checkLevel(level) {
            if (!MAREJIG_validateLevel(level)) {
                errors.push('Nivel inválido: ' + (level && level.id ? level.id : 'sin_id'));
            }
            if (level && level.id) {
                if (seen[level.id]) errors.push('ID duplicado: ' + level.id);
                seen[level.id] = true;
            }
        });

        return { valid: errors.length === 0, errors: errors };
    }

    windowObject.MAREJIG_LevelCatalog = Object.freeze({
        levels: MAREJIG_LEVELS.slice(),
        getOrdered: MAREJIG_getOrdered,
        getById: MAREJIG_getById,
        validateLevel: MAREJIG_validateLevel,
        validateCatalog: MAREJIG_validateCatalog
    });
})(window);
