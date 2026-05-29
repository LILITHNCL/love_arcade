(function MAREJIG_shapesModule(windowObject) {
    'use strict';

    var MAREJIG_BASE_SHAPES = Object.freeze({
        O1: Object.freeze([{ x: 0, y: 0 }]),
        I2: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }]),
        I3: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]),
        L3: Object.freeze([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
        I4: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]),
        O4: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
        T4: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }]),
        L4: Object.freeze([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]),
        S4: Object.freeze([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }]),
        Z4: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
        P5: Object.freeze([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0, y: 2 }]),
        U5: Object.freeze([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]),
        V5: Object.freeze([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }])
    });

    var MAREJIG_SHAPE_WEIGHTS = Object.freeze({
        standard: Object.freeze([
            { signature: 'I2', weight: 15 },
            { signature: 'I3', weight: 24 },
            { signature: 'L3', weight: 18 },
            { signature: 'I4', weight: 10 },
            { signature: 'O4', weight: 8 },
            { signature: 'T4', weight: 8 },
            { signature: 'L4', weight: 8 },
            { signature: 'S4', weight: 4 },
            { signature: 'Z4', weight: 4 },
            { signature: 'P5', weight: 1 },
            { signature: 'U5', weight: 1 },
            { signature: 'V5', weight: 1 },
            { signature: 'O1', weight: 1 }
        ])
    });

    function MAREJIG_getCellKey(x, y) {
        return String(x) + ',' + String(y);
    }

    function MAREJIG_normalizeCells(cells) {
        var minX = Math.min.apply(null, cells.map(function MAREJIG_cellX(cell) { return cell.x; }));
        var minY = Math.min.apply(null, cells.map(function MAREJIG_cellY(cell) { return cell.y; }));
        return cells.map(function MAREJIG_shiftCell(cell) {
            return { x: cell.x - minX, y: cell.y - minY };
        }).sort(function MAREJIG_sortCells(a, b) {
            return a.y === b.y ? a.x - b.x : a.y - b.y;
        });
    }

    function MAREJIG_rotateCells(cells) {
        return MAREJIG_normalizeCells(cells.map(function MAREJIG_rotateCell(cell) {
            return { x: -cell.y, y: cell.x };
        }));
    }

    function MAREJIG_reflectCells(cells) {
        return MAREJIG_normalizeCells(cells.map(function MAREJIG_reflectCell(cell) {
            return { x: -cell.x, y: cell.y };
        }));
    }

    function MAREJIG_getNormalizedKey(cells) {
        return MAREJIG_normalizeCells(cells).map(function MAREJIG_keyCell(cell) {
            return MAREJIG_getCellKey(cell.x, cell.y);
        }).join('|');
    }

    function MAREJIG_getShapeSignature(cells) {
        var normalizedKey = MAREJIG_getNormalizedKey(cells);
        var names = Object.keys(MAREJIG_BASE_SHAPES);
        for (var i = 0; i < names.length; i += 1) {
            var variants = MAREJIG_getVariants(MAREJIG_BASE_SHAPES[names[i]]);
            for (var j = 0; j < variants.length; j += 1) {
                if (MAREJIG_getNormalizedKey(variants[j]) === normalizedKey) return names[i];
            }
        }
        return 'N' + cells.length + ':' + normalizedKey;
    }

    function MAREJIG_getVariants(cells) {
        var variants = [];
        var seen = Object.create(null);
        var current = MAREJIG_normalizeCells(cells);

        for (var reflectIndex = 0; reflectIndex < 2; reflectIndex += 1) {
            var variant = reflectIndex === 0 ? current : MAREJIG_reflectCells(current);
            for (var rotation = 0; rotation < 4; rotation += 1) {
                var normalized = MAREJIG_normalizeCells(variant);
                var key = MAREJIG_getNormalizedKey(normalized);
                if (!seen[key]) {
                    seen[key] = true;
                    variants.push(normalized);
                }
                variant = MAREJIG_rotateCells(variant);
            }
        }

        return variants;
    }

    function MAREJIG_getWeightedShapePool(difficulty) {
        var weights = MAREJIG_SHAPE_WEIGHTS[difficulty] || MAREJIG_SHAPE_WEIGHTS.standard;
        var pool = [];
        weights.forEach(function MAREJIG_addWeightedShape(entry) {
            var base = MAREJIG_BASE_SHAPES[entry.signature];
            if (!base) return;
            var variants = MAREJIG_getVariants(base);
            variants.forEach(function MAREJIG_addVariant(variant) {
                pool.push({
                    signature: entry.signature,
                    size: variant.length,
                    weight: entry.weight,
                    cells: variant
                });
            });
        });
        return pool;
    }

    function MAREJIG_buildPieceOutline(piece) {
        var cellSet = Object.create(null);
        var absoluteCells = piece.cells.map(function MAREJIG_absoluteCell(cell) {
            return { x: piece.solution.gridX + cell.x, y: piece.solution.gridY + cell.y };
        });
        var segments = [];

        absoluteCells.forEach(function MAREJIG_markCell(cell) {
            cellSet[MAREJIG_getCellKey(cell.x, cell.y)] = true;
        });

        absoluteCells.forEach(function MAREJIG_addEdges(cell) {
            if (!cellSet[MAREJIG_getCellKey(cell.x, cell.y - 1)]) {
                segments.push({ x1: cell.x, y1: cell.y, x2: cell.x + 1, y2: cell.y, side: 'top' });
            }
            if (!cellSet[MAREJIG_getCellKey(cell.x + 1, cell.y)]) {
                segments.push({ x1: cell.x + 1, y1: cell.y, x2: cell.x + 1, y2: cell.y + 1, side: 'right' });
            }
            if (!cellSet[MAREJIG_getCellKey(cell.x, cell.y + 1)]) {
                segments.push({ x1: cell.x + 1, y1: cell.y + 1, x2: cell.x, y2: cell.y + 1, side: 'bottom' });
            }
            if (!cellSet[MAREJIG_getCellKey(cell.x - 1, cell.y)]) {
                segments.push({ x1: cell.x, y1: cell.y + 1, x2: cell.x, y2: cell.y, side: 'left' });
            }
        });

        return { segments: segments };
    }

    windowObject.MAREJIG_Shapes = Object.freeze({
        getWeightedShapePool: MAREJIG_getWeightedShapePool,
        normalizeCells: MAREJIG_normalizeCells,
        rotateCells: MAREJIG_rotateCells,
        reflectCells: MAREJIG_reflectCells,
        getShapeSignature: MAREJIG_getShapeSignature,
        getCellKey: MAREJIG_getCellKey,
        buildPieceOutline: MAREJIG_buildPieceOutline
    });
})(window);
