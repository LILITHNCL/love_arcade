(function MAREJIG_generatorModule(windowObject) {
    'use strict';

    var MAREJIG_Shapes = windowObject.MAREJIG_Shapes;
    var MAREJIG_Segments = windowObject.MAREJIG_Segments;
    var MAREJIG_Groups = windowObject.MAREJIG_Groups;
    var MAREJIG_GENERATOR_VERSION = 2;
    var MAREJIG_PIECE_RANGES = Object.freeze({
        easy: Object.freeze([28, 34]),
        standard: Object.freeze([36, 42]),
        hard: Object.freeze([44, 50]),
        test: Object.freeze([28, 50])
    });

    function MAREJIG_hashSeed(input) {
        var text = String(input || 'marejig');
        var hash = 2166136261;
        for (var i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function MAREJIG_createRng(seed) {
        var state = seed >>> 0;
        return function MAREJIG_rng() {
            state += 0x6D2B79F5;
            var t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function MAREJIG_shuffle(items, rng) {
        var output = items.slice();
        for (var i = output.length - 1; i > 0; i -= 1) {
            var j = Math.floor(rng() * (i + 1));
            var tmp = output[i];
            output[i] = output[j];
            output[j] = tmp;
        }
        return output;
    }

    function MAREJIG_buildTargetSizes(targetPieceCount, cellCount, rng) {
        var sizes = [];
        var remainingCells = cellCount;
        var remainingPieces = targetPieceCount;

        while (remainingPieces > 0) {
            var average = remainingCells / remainingPieces;
            var size;
            if (average >= 3.75) {
                size = 4;
            } else if (average <= 2.35) {
                size = 2;
            } else {
                size = rng() < 0.22 ? 4 : 3;
            }
            var minFuture = (remainingPieces - 1) * 2;
            var maxFuture = (remainingPieces - 1) * 5;
            if (remainingCells - size < minFuture) size = Math.max(1, remainingCells - minFuture);
            if (remainingCells - size > maxFuture) size = Math.min(5, remainingCells - maxFuture);
            sizes.push(size);
            remainingCells -= size;
            remainingPieces -= 1;
        }

        return MAREJIG_shuffle(sizes, rng);
    }

    function MAREJIG_buildSerpentinePath(cols, rows, rng) {
        var path = [];
        var vertical = rng() < 0.45;
        var reversePrimary = rng() < 0.5;
        var reverseSecondary = rng() < 0.5;

        if (vertical) {
            for (var columnStep = 0; columnStep < cols; columnStep += 1) {
                var x = reversePrimary ? cols - 1 - columnStep : columnStep;
                var topToBottom = (columnStep % 2 === 0) !== reverseSecondary;
                for (var rowStep = 0; rowStep < rows; rowStep += 1) {
                    var y = topToBottom ? rowStep : rows - 1 - rowStep;
                    path.push({ x: x, y: y });
                }
            }
            return path;
        }

        for (var rowIndex = 0; rowIndex < rows; rowIndex += 1) {
            var yRow = reversePrimary ? rows - 1 - rowIndex : rowIndex;
            var leftToRight = (rowIndex % 2 === 0) !== reverseSecondary;
            for (var colIndex = 0; colIndex < cols; colIndex += 1) {
                var xCol = leftToRight ? colIndex : cols - 1 - colIndex;
                path.push({ x: xCol, y: yRow });
            }
        }
        return path;
    }

    function MAREJIG_makePiece(pieceIndex, absoluteCells) {
        var minX = Math.min.apply(null, absoluteCells.map(function MAREJIG_cellX(cell) { return cell.x; }));
        var minY = Math.min.apply(null, absoluteCells.map(function MAREJIG_cellY(cell) { return cell.y; }));
        var maxX = Math.max.apply(null, absoluteCells.map(function MAREJIG_cellMaxX(cell) { return cell.x; }));
        var maxY = Math.max.apply(null, absoluteCells.map(function MAREJIG_cellMaxY(cell) { return cell.y; }));
        var localCells = absoluteCells.map(function MAREJIG_toLocal(cell) {
            return { x: cell.x - minX, y: cell.y - minY };
        }).sort(function MAREJIG_sortLocal(a, b) {
            return a.y === b.y ? a.x - b.x : a.y - b.y;
        });
        var id = 'p_' + String(pieceIndex).padStart(3, '0');
        var piece = {
            id: id,
            cells: localCells,
            solution: { gridX: minX, gridY: minY },
            bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
            shapeSize: localCells.length,
            shapeSignature: MAREJIG_Shapes.getShapeSignature(localCells),
            neighborIds: [],
            segmentId: null,
            groupId: null,
            revealed: false,
            locked: false
        };
        piece.outline = MAREJIG_Shapes.buildPieceOutline(piece);
        return piece;
    }

    function MAREJIG_buildPiecesFromPath(path, targetSizes) {
        var pieces = {};
        var occupancy = {};
        var cursor = 0;

        targetSizes.forEach(function MAREJIG_createPiece(size, index) {
            var absoluteCells = path.slice(cursor, cursor + size);
            cursor += size;
            var piece = MAREJIG_makePiece(index + 1, absoluteCells);
            pieces[piece.id] = piece;
            absoluteCells.forEach(function MAREJIG_markOccupancy(cell) {
                occupancy[MAREJIG_Shapes.getCellKey(cell.x, cell.y)] = piece.id;
            });
        });

        return { pieces: pieces, occupancy: occupancy };
    }

    function MAREJIG_getAbsoluteCells(piece) {
        return piece.cells.map(function MAREJIG_absoluteCell(cell) {
            return { x: piece.solution.gridX + cell.x, y: piece.solution.gridY + cell.y };
        });
    }


    function MAREJIG_isRectangularPiece(piece) {
        return MAREJIG_Shapes.isRectangularCells(piece.cells);
    }

    function MAREJIG_incrementDistribution(distribution, key) {
        distribution[key] = (distribution[key] || 0) + 1;
    }

    function MAREJIG_buildShapeSignatureDistribution(pieces) {
        var distribution = {};
        Object.keys(pieces).forEach(function MAREJIG_countSignature(pieceId) {
            MAREJIG_incrementDistribution(distribution, pieces[pieceId].shapeSignature);
        });
        return distribution;
    }

    function MAREJIG_buildVarietyMetrics(pieces) {
        var pieceIds = Object.keys(pieces);
        var rectangularCount = 0;
        var monominoCount = 0;
        pieceIds.forEach(function MAREJIG_countVariety(pieceId) {
            var piece = pieces[pieceId];
            piece.isRectangular = MAREJIG_isRectangularPiece(piece);
            if (piece.isRectangular) rectangularCount += 1;
            if (piece.shapeSize === 1) monominoCount += 1;
        });
        var total = Math.max(1, pieceIds.length);
        return {
            rectangularPieceCount: rectangularCount,
            nonRectangularPieceCount: pieceIds.length - rectangularCount,
            rectangularPieceRatio: rectangularCount / total,
            nonRectangularPieceRatio: (pieceIds.length - rectangularCount) / total,
            monominoCount: monominoCount,
            shapeSignatureDistribution: MAREJIG_buildShapeSignatureDistribution(pieces),
            shapeSizeDistribution: MAREJIG_buildSizeDistribution(pieces)
        };
    }

    function MAREJIG_getPieceRange(difficulty) {
        return MAREJIG_PIECE_RANGES[difficulty] || MAREJIG_PIECE_RANGES.standard;
    }

    function MAREJIG_getVarietyThresholds(difficulty) {
        if (difficulty === 'standard' || difficulty === 'test') {
            return { minNonRectangularRatio: 0.55, maxRectangularRatio: 0.40, maxMonominoCount: 2 };
        }
        if (difficulty === 'easy') {
            return { minNonRectangularRatio: 0.50, maxRectangularRatio: 0.50, maxMonominoCount: 2 };
        }
        return { minNonRectangularRatio: 0.16, maxRectangularRatio: 0.84, maxMonominoCount: 2 };
    }

    function MAREJIG_validateVariety(puzzle, difficulty) {
        var thresholds = MAREJIG_getVarietyThresholds(difficulty);
        var metrics = MAREJIG_buildVarietyMetrics(puzzle.pieces);
        var errors = [];
        var warnings = [];
        if (metrics.nonRectangularPieceRatio < thresholds.minNonRectangularRatio) {
            errors.push('Variedad insuficiente: nonRectangularPieceRatio ' + metrics.nonRectangularPieceRatio.toFixed(3));
        }
        if (metrics.rectangularPieceRatio > thresholds.maxRectangularRatio) {
            errors.push('Demasiadas piezas rectangulares: rectangularPieceRatio ' + metrics.rectangularPieceRatio.toFixed(3));
        }
        if (metrics.monominoCount > thresholds.maxMonominoCount) {
            errors.push('Demasiados monominós: ' + metrics.monominoCount);
        }
        return { ok: errors.length === 0, metrics: metrics, errors: errors, warnings: warnings };
    }

    function MAREJIG_lCellsForBlock(blockX, blockY, variant) {
        if (variant % 2 === 0) {
            return [
                [{ x: blockX, y: blockY }, { x: blockX, y: blockY + 1 }, { x: blockX + 1, y: blockY + 1 }],
                [{ x: blockX + 1, y: blockY }, { x: blockX + 2, y: blockY }, { x: blockX + 2, y: blockY + 1 }]
            ];
        }
        return [
            [{ x: blockX, y: blockY }, { x: blockX + 1, y: blockY }, { x: blockX, y: blockY + 1 }],
            [{ x: blockX + 1, y: blockY + 1 }, { x: blockX + 2, y: blockY }, { x: blockX + 2, y: blockY + 1 }]
        ];
    }

    function MAREJIG_dominoCellsForBlock(blockX, blockY, vertical) {
        if (vertical) {
            return [
                [{ x: blockX, y: blockY }, { x: blockX, y: blockY + 1 }],
                [{ x: blockX + 1, y: blockY }, { x: blockX + 1, y: blockY + 1 }],
                [{ x: blockX + 2, y: blockY }, { x: blockX + 2, y: blockY + 1 }]
            ];
        }
        return [
            [{ x: blockX, y: blockY }, { x: blockX + 1, y: blockY }],
            [{ x: blockX + 2, y: blockY }, { x: blockX + 2, y: blockY + 1 }],
            [{ x: blockX, y: blockY + 1 }, { x: blockX + 1, y: blockY + 1 }]
        ];
    }

    function MAREJIG_sixCellBlock(blockX, blockY) {
        return [[
            { x: blockX, y: blockY }, { x: blockX + 1, y: blockY }, { x: blockX + 2, y: blockY },
            { x: blockX, y: blockY + 1 }, { x: blockX + 1, y: blockY + 1 }, { x: blockX + 2, y: blockY + 1 }
        ]];
    }

    function MAREJIG_buildPremiumBlockPieces(cols, rows, targetPieceCount, rng) {
        if (cols !== 12 || rows !== 9 || targetPieceCount < 30 || targetPieceCount > 48) return null;
        var blocks = [];
        for (var y = 0; y < rows; y += 2) {
            if (y + 1 >= rows) break;
            for (var x = 0; x < cols; x += 3) {
                blocks.push({ x: x, y: y });
            }
        }
        // La última fila (y=8) se resuelve como relleno I3 mínimo para mantener cobertura 12×9.
        var rowTail = [0, 3, 6, 9];
        var targetDelta = targetPieceCount - 36; // 16 bloques L + 4 piezas de cola = 36 piezas base.
        var sixCellBlockCount = 0;
        var dominoBlockCount = 0;
        if (targetDelta >= 0) {
            dominoBlockCount = Math.min(blocks.length, targetDelta);
        } else {
            sixCellBlockCount = Math.min(blocks.length, -targetDelta);
        }
        var shuffledBlocks = MAREJIG_shuffle(blocks, rng);
        var dominoBlocks = new Set(shuffledBlocks.slice(0, dominoBlockCount).map(function MAREJIG_blockKey(block) { return MAREJIG_Shapes.getCellKey(block.x, block.y); }));
        var sixCellBlocks = new Set(shuffledBlocks.slice(0, sixCellBlockCount).map(function MAREJIG_blockKey(block) { return MAREJIG_Shapes.getCellKey(block.x, block.y); }));
        var absolutePieces = [];

        blocks.forEach(function MAREJIG_addBlock(block, index) {
            var key = MAREJIG_Shapes.getCellKey(block.x, block.y);
            var cellsList;
            if (dominoBlocks.has(key)) cellsList = MAREJIG_dominoCellsForBlock(block.x, block.y, (index + Math.floor(rng() * 3)) % 2 === 0);
            else if (sixCellBlocks.has(key)) cellsList = MAREJIG_sixCellBlock(block.x, block.y);
            else cellsList = MAREJIG_lCellsForBlock(block.x, block.y, index + Math.floor(rng() * 4));
            absolutePieces = absolutePieces.concat(cellsList);
        });

        rowTail.forEach(function MAREJIG_addTailBlock(x, index) {
            absolutePieces.push([{ x: x, y: rows - 1 }, { x: x + 1, y: rows - 1 }, { x: x + 2, y: rows - 1 }]);
        });

        var pieces = {};
        var occupancy = {};
        MAREJIG_shuffle(absolutePieces, rng).forEach(function MAREJIG_makeBlockPiece(absoluteCells, index) {
            var piece = MAREJIG_makePiece(index + 1, absoluteCells);
            pieces[piece.id] = piece;
            absoluteCells.forEach(function MAREJIG_markBlockOccupancy(cell) {
                occupancy[MAREJIG_Shapes.getCellKey(cell.x, cell.y)] = piece.id;
            });
        });
        return { pieces: pieces, occupancy: occupancy, targetSizes: absolutePieces.map(function MAREJIG_sizeOf(cells) { return cells.length; }) };
    }

    function MAREJIG_buildAdjacency(pieces, occupancy) {
        var edgeMap = Object.create(null);
        var directions = [
            { dx: 1, dy: 0, side: 'right', oppositeSide: 'left' },
            { dx: 0, dy: 1, side: 'bottom', oppositeSide: 'top' }
        ];

        Object.keys(pieces).forEach(function MAREJIG_scanPiece(pieceId) {
            var piece = pieces[pieceId];
            MAREJIG_getAbsoluteCells(piece).forEach(function MAREJIG_scanCell(cell) {
                directions.forEach(function MAREJIG_scanDirection(direction) {
                    var neighborId = occupancy[MAREJIG_Shapes.getCellKey(cell.x + direction.dx, cell.y + direction.dy)];
                    if (!neighborId || neighborId === pieceId) return;
                    var sorted = [pieceId, neighborId].sort();
                    var key = sorted[0] + '|' + sorted[1];
                    if (!edgeMap[key]) {
                        edgeMap[key] = {
                            id: '',
                            a: sorted[0],
                            b: sorted[1],
                            deltaGrid: {
                                x: pieces[sorted[1]].bounds.x - pieces[sorted[0]].bounds.x,
                                y: pieces[sorted[1]].bounds.y - pieces[sorted[0]].bounds.y
                            },
                            sharedSides: []
                        };
                    }
                    edgeMap[key].sharedSides.push({
                        ax: cell.x,
                        ay: cell.y,
                        side: direction.side,
                        bx: cell.x + direction.dx,
                        by: cell.y + direction.dy,
                        oppositeSide: direction.oppositeSide
                    });
                });
            });
        });

        var adjacency = Object.keys(edgeMap).sort().map(function MAREJIG_finalizeEdge(key, index) {
            var edge = edgeMap[key];
            edge.id = 'e_' + String(index + 1).padStart(3, '0');
            edge.sharedSides.sort(function MAREJIG_sortSharedSide(a, b) {
                if (a.ay !== b.ay) return a.ay - b.ay;
                if (a.ax !== b.ax) return a.ax - b.ax;
                return a.side.localeCompare(b.side);
            });
            return edge;
        });

        Object.keys(pieces).forEach(function MAREJIG_resetNeighbors(pieceId) {
            pieces[pieceId].neighborIds = [];
        });
        adjacency.forEach(function MAREJIG_applyNeighbors(edge) {
            pieces[edge.a].neighborIds.push(edge.b);
            pieces[edge.b].neighborIds.push(edge.a);
        });
        Object.keys(pieces).forEach(function MAREJIG_sortPieceNeighbors(pieceId) {
            pieces[pieceId].neighborIds.sort();
        });

        return adjacency;
    }

    function MAREJIG_arePieceCellsConnected(piece) {
        if (!piece.cells.length) return false;
        var cellSet = Object.create(null);
        piece.cells.forEach(function MAREJIG_markCell(cell) {
            cellSet[MAREJIG_Shapes.getCellKey(cell.x, cell.y)] = true;
        });
        var visited = new Set([MAREJIG_Shapes.getCellKey(piece.cells[0].x, piece.cells[0].y)]);
        var queue = [piece.cells[0]];
        var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        while (queue.length) {
            var current = queue.shift();
            dirs.forEach(function MAREJIG_visitCell(dir) {
                var key = MAREJIG_Shapes.getCellKey(current.x + dir[0], current.y + dir[1]);
                if (cellSet[key] && !visited.has(key)) {
                    visited.add(key);
                    queue.push({ x: current.x + dir[0], y: current.y + dir[1] });
                }
            });
        }
        return visited.size === piece.cells.length;
    }

    function MAREJIG_buildSizeDistribution(pieces) {
        var distribution = {};
        Object.keys(pieces).forEach(function MAREJIG_countSize(pieceId) {
            var size = String(pieces[pieceId].shapeSize);
            distribution[size] = (distribution[size] || 0) + 1;
        });
        return distribution;
    }

    function MAREJIG_validatePuzzle(puzzle) {
        var errors = [];
        var warnings = [];
        if (!puzzle || !puzzle.board || !puzzle.pieces) {
            return { ok: false, errors: ['Puzzle ausente'] };
        }

        var board = puzzle.board;
        var cellSeen = Object.create(null);
        var coverageCount = 0;
        var piecesConnectedOk = true;
        var pieceIds = Object.keys(puzzle.pieces);

        pieceIds.forEach(function MAREJIG_validatePiece(pieceId) {
            var piece = puzzle.pieces[pieceId];
            if (!MAREJIG_arePieceCellsConnected(piece)) {
                piecesConnectedOk = false;
                errors.push('Pieza no conectada: ' + pieceId);
            }
            MAREJIG_getAbsoluteCells(piece).forEach(function MAREJIG_validateCell(cell) {
                var key = MAREJIG_Shapes.getCellKey(cell.x, cell.y);
                if (cell.x < 0 || cell.y < 0 || cell.x >= board.cols || cell.y >= board.rows) errors.push('Celda fuera de tablero: ' + key);
                if (cellSeen[key]) errors.push('Solapamiento en celda: ' + key);
                cellSeen[key] = pieceId;
                coverageCount += 1;
            });
            if (!Array.isArray(piece.neighborIds)) errors.push('neighborIds faltante: ' + pieceId);
            if (!piece.segmentId) errors.push('segmentId faltante: ' + pieceId);
            if (!piece.groupId) errors.push('groupId faltante: ' + pieceId);
        });

        var cellCoverageOk = coverageCount === board.cellCount;
        if (!cellCoverageOk) errors.push('Cobertura inválida: ' + coverageCount + '/' + board.cellCount);
        for (var y = 0; y < board.rows; y += 1) {
            for (var x = 0; x < board.cols; x += 1) {
                if (!cellSeen[MAREJIG_Shapes.getCellKey(x, y)]) errors.push('Hueco en celda: ' + x + ',' + y);
            }
        }

        var edgeKeys = Object.create(null);
        var adjacencyOk = true;
        (puzzle.adjacency || []).forEach(function MAREJIG_validateEdge(edge) {
            var key = [edge.a, edge.b].sort().join('|');
            if (edgeKeys[key]) {
                adjacencyOk = false;
                errors.push('Edge duplicado: ' + key);
            }
            edgeKeys[key] = true;
            if (!puzzle.pieces[edge.a] || !puzzle.pieces[edge.b]) {
                adjacencyOk = false;
                errors.push('Edge referencia pieza inexistente: ' + key);
            }
            if (!edge.sharedSides || edge.sharedSides.length === 0) {
                adjacencyOk = false;
                errors.push('Edge sin lados compartidos: ' + key);
            }
        });
        pieceIds.forEach(function MAREJIG_validateNeighbors(pieceId) {
            puzzle.pieces[pieceId].neighborIds.forEach(function MAREJIG_checkNeighbor(neighborId) {
                var key = [pieceId, neighborId].sort().join('|');
                if (!edgeKeys[key]) {
                    adjacencyOk = false;
                    errors.push('neighborId sin edge: ' + key);
                }
            });
        });

        var groupsValidation = puzzle.groups ? MAREJIG_Groups.validateGroups(puzzle.groups, puzzle.pieces) : { ok: false, errors: ['Grupos ausentes'] };
        if (!groupsValidation.ok) errors = errors.concat(groupsValidation.errors);
        var segmentsValidation = puzzle.segments ? MAREJIG_Segments.validateSegments(puzzle.segments, puzzle.pieces, puzzle.adjacency) : { ok: false, errors: ['Segmentos ausentes'] };
        if (!segmentsValidation.ok) errors = errors.concat(segmentsValidation.errors);

        var pieceCount = pieceIds.length;
        var pieceRange = MAREJIG_getPieceRange(puzzle.difficulty);
        var pieceCountOk = pieceCount >= pieceRange[0] && pieceCount <= pieceRange[1];
        if (!pieceCountOk) errors.push('Conteo fuera de rango: ' + pieceCount);

        return {
            ok: errors.length === 0,
            pieceCount: pieceCount,
            cellCoverageOk: cellCoverageOk && errors.filter(function MAREJIG_cellErrors(error) { return error.indexOf('Hueco') === 0 || error.indexOf('Solapamiento') === 0; }).length === 0,
            piecesConnectedOk: piecesConnectedOk,
            adjacencyOk: adjacencyOk,
            groupsOk: groupsValidation.ok,
            segmentsOk: segmentsValidation.ok,
            pieceCountOk: pieceCountOk,
            sizeDistribution: MAREJIG_buildSizeDistribution(puzzle.pieces),
            variety: MAREJIG_buildVarietyMetrics(puzzle.pieces),
            warnings: warnings,
            errors: errors
        };
    }

    function MAREJIG_generate(level, options) {
        var maxAttempts = (options && options.maxAttempts) || 80;
        var cols = level.board.cols;
        var rows = level.board.rows;
        var cellCount = cols * rows;
        var targetPieceCount = level.targetPieceCount || 40;
        var lastPuzzle = null;

        for (var attempt = 0; attempt < maxAttempts; attempt += 1) {
            var seedInput = level.id + ':attempt:' + attempt;
            var seed = MAREJIG_hashSeed(seedInput);
            var rng = MAREJIG_createRng(seed);
            var build = MAREJIG_buildPremiumBlockPieces(cols, rows, targetPieceCount, rng);
            if (!build) {
                var fallbackTargetSizes = MAREJIG_buildTargetSizes(targetPieceCount, cellCount, rng);
                var path = MAREJIG_buildSerpentinePath(cols, rows, rng);
                build = MAREJIG_buildPiecesFromPath(path, fallbackTargetSizes);
                build.targetSizes = fallbackTargetSizes;
            }
            var targetSizes = build.targetSizes || Object.keys(build.pieces).map(function MAREJIG_pieceSize(pieceId) { return build.pieces[pieceId].shapeSize; });
            var pieces = build.pieces;
            var adjacency = MAREJIG_buildAdjacency(pieces, build.occupancy);
            var groups = MAREJIG_Groups.createInitialGroups(pieces);
            var segmentRng = MAREJIG_createRng(MAREJIG_hashSeed(level.id + ':segments:' + attempt));
            var segments = MAREJIG_Segments.buildSegments(pieces, adjacency, level.segmentPlan, segmentRng);
            var puzzle = {
                version: 1,
                levelId: level.id,
                difficulty: level.difficulty || 'standard',
                seed: seed,
                generatorVersion: MAREJIG_GENERATOR_VERSION,
                board: { cols: cols, rows: rows, cellCount: cellCount },
                pieces: pieces,
                groups: groups,
                adjacency: adjacency,
                segments: segments,
                occupancy: build.occupancy,
                debug: {
                    strategy: 'deterministic_serpentine_partition',
                    attempt: attempt,
                    targetSizes: targetSizes.slice()
                }
            };
            puzzle.validation = MAREJIG_validatePuzzle(puzzle);
            var varietyValidation = MAREJIG_validateVariety(puzzle, level.difficulty || 'standard');
            puzzle.validation.variety = varietyValidation.metrics;
            puzzle.debug.varietyErrors = varietyValidation.errors.slice();
            lastPuzzle = puzzle;
            if (puzzle.validation.ok && varietyValidation.ok) return puzzle;
        }

        console.warn('[MAREJIG] No se generó puzzle válido dentro del límite de intentos', level.id);
        return lastPuzzle;
    }

    windowObject.MAREJIG_Generator = Object.freeze({
        generate: MAREJIG_generate,
        hashSeed: MAREJIG_hashSeed,
        validatePuzzle: MAREJIG_validatePuzzle
    });
})(window);
