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
        V5: Object.freeze([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 }]),
        W5: Object.freeze([{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 2 }]),
        Y5: Object.freeze([{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 2 }, { x: 1, y: 3 }])
    });

    var MAREJIG_SHAPE_WEIGHTS = Object.freeze({
        standard: Object.freeze([
            { signature: 'L3', weight: 34 },
            { signature: 'L4', weight: 18 },
            { signature: 'T4', weight: 18 },
            { signature: 'S4', weight: 14 },
            { signature: 'Z4', weight: 14 },
            { signature: 'P5', weight: 10 },
            { signature: 'U5', weight: 10 },
            { signature: 'V5', weight: 10 },
            { signature: 'W5', weight: 10 },
            { signature: 'Y5', weight: 10 },
            { signature: 'I2', weight: 5 },
            { signature: 'I3', weight: 2 },
            { signature: 'I4', weight: 1 },
            { signature: 'O4', weight: 1 },
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


    function MAREJIG_isRectangularCells(cells) {
        if (!cells || !cells.length) return false;
        var normalized = MAREJIG_normalizeCells(cells);
        var maxX = Math.max.apply(null, normalized.map(function MAREJIG_cellMaxX(cell) { return cell.x; }));
        var maxY = Math.max.apply(null, normalized.map(function MAREJIG_cellMaxY(cell) { return cell.y; }));
        var expectedArea = (maxX + 1) * (maxY + 1);
        if (expectedArea !== normalized.length) return false;
        var seen = Object.create(null);
        normalized.forEach(function MAREJIG_markRectCell(cell) {
            seen[MAREJIG_getCellKey(cell.x, cell.y)] = true;
        });
        for (var y = 0; y <= maxY; y += 1) {
            for (var x = 0; x <= maxX; x += 1) {
                if (!seen[MAREJIG_getCellKey(x, y)]) return false;
            }
        }
        return true;
    }

    function MAREJIG_buildCellsOutline(cells) {
        var cellSet = Object.create(null);
        var normalizedCells = (cells || []).map(function MAREJIG_outlineCell(cell) {
            return { x: Number(cell.x) || 0, y: Number(cell.y) || 0 };
        });
        var segments = [];

        normalizedCells.forEach(function MAREJIG_markCell(cell) {
            cellSet[MAREJIG_getCellKey(cell.x, cell.y)] = true;
        });

        normalizedCells.forEach(function MAREJIG_addEdges(cell) {
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

        segments.sort(function MAREJIG_sortOutline(a, b) {
            if (a.y1 !== b.y1) return a.y1 - b.y1;
            if (a.x1 !== b.x1) return a.x1 - b.x1;
            return a.side.localeCompare(b.side);
        });
        return { segments: segments };
    }

    function MAREJIG_buildPieceOutline(piece) {
        var absoluteCells = piece.cells.map(function MAREJIG_absoluteCell(cell) {
            return { x: piece.solution.gridX + cell.x, y: piece.solution.gridY + cell.y };
        });
        return MAREJIG_buildCellsOutline(absoluteCells);
    }

    windowObject.MAREJIG_Shapes = Object.freeze({
        getWeightedShapePool: MAREJIG_getWeightedShapePool,
        normalizeCells: MAREJIG_normalizeCells,
        rotateCells: MAREJIG_rotateCells,
        reflectCells: MAREJIG_reflectCells,
        getShapeSignature: MAREJIG_getShapeSignature,
        getCellKey: MAREJIG_getCellKey,
        isRectangularCells: MAREJIG_isRectangularCells,
        buildCellsOutline: MAREJIG_buildCellsOutline,
        buildPieceOutline: MAREJIG_buildPieceOutline
    });
})(window);
