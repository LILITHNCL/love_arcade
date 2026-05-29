(function MAREJIG_groupsModule(windowObject) {
    'use strict';

    function MAREJIG_createInitialGroups(pieces) {
        var groups = {};
        Object.keys(pieces).forEach(function MAREJIG_createGroup(pieceId) {
            var groupId = 'g_' + pieceId.slice(2);
            pieces[pieceId].groupId = groupId;
            groups[groupId] = {
                id: groupId,
                pieceIds: [pieceId],
                anchorPieceId: pieceId,
                x: 0,
                y: 0,
                zIndex: 0,
                bounds: { x: 0, y: 0, width: 0, height: 0 },
                hitBounds: { x: 0, y: 0, width: 0, height: 0 },
                lockedToBoard: false,
                visible: true
            };
        });
        return groups;
    }

    function MAREJIG_getGroupByPieceId(groups, pieces, pieceId) {
        var piece = pieces[pieceId];
        if (!piece) return null;
        return groups[piece.groupId] || null;
    }

    function MAREJIG_getGroupPieceIds(groups, groupId) {
        return groups[groupId] ? groups[groupId].pieceIds.slice() : [];
    }

    function MAREJIG_getMaxZ(groups) {
        return Object.keys(groups || {}).reduce(function MAREJIG_maxZ(max, groupId) {
            return Math.max(max, Number(groups[groupId].zIndex) || 0);
        }, 0);
    }

    function MAREJIG_bringGroupToFront(scene, groupId) {
        var group = scene && scene.groups ? scene.groups[groupId] : null;
        if (!group) return null;
        group.zIndex = MAREJIG_getMaxZ(scene.groups) + 1;
        if (scene.ui) scene.ui.selectedGroupId = groupId;
        return group;
    }

    function MAREJIG_getPieceWorldRect(scene, pieceId, groupOverride) {
        var puzzlePiece = scene && scene.puzzle && scene.puzzle.pieces ? scene.puzzle.pieces[pieceId] : null;
        var scenePiece = scene && scene.pieces ? scene.pieces[pieceId] : null;
        if (!puzzlePiece || !scenePiece) return null;
        var group = groupOverride || scene.groups[scenePiece.groupId];
        if (!group) return null;
        var anchorPiece = scene.puzzle.pieces[group.anchorPieceId || group.pieceIds[0]] || puzzlePiece;
        var scale = scene.staging.pieceScale || scene.board.cellSize || 1;
        var x = group.x + (puzzlePiece.solution.gridX - anchorPiece.solution.gridX) * scale;
        var y = group.y + (puzzlePiece.solution.gridY - anchorPiece.solution.gridY) * scale;
        return {
            x: x,
            y: y,
            width: puzzlePiece.bounds.w * scale,
            height: puzzlePiece.bounds.h * scale,
            scale: scale
        };
    }

    function MAREJIG_recalculateGroupBounds(scene, groupId) {
        var group = scene && scene.groups ? scene.groups[groupId] : null;
        if (!group) return null;
        var minX = Infinity;
        var minY = Infinity;
        var maxX = -Infinity;
        var maxY = -Infinity;
        var inflate = Math.max(12, (scene.board.cellSize || scene.staging.pieceScale || 24) * 0.28);

        group.pieceIds.forEach(function MAREJIG_measurePiece(pieceId) {
            var scenePiece = scene.pieces[pieceId];
            if (!scenePiece || !scenePiece.visible) return;
            var rect = MAREJIG_getPieceWorldRect(scene, pieceId, group);
            if (!rect) return;
            scenePiece.hitBounds = {
                x: rect.x - inflate,
                y: rect.y - inflate,
                width: rect.width + inflate * 2,
                height: rect.height + inflate * 2
            };
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
        });

        if (minX === Infinity) {
            group.bounds = { x: group.x, y: group.y, width: 0, height: 0 };
            group.hitBounds = { x: group.x, y: group.y, width: 0, height: 0 };
            return group.bounds;
        }

        group.bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        group.hitBounds = {
            x: minX - inflate,
            y: minY - inflate,
            width: maxX - minX + inflate * 2,
            height: maxY - minY + inflate * 2
        };
        return group.bounds;
    }

    function MAREJIG_recalculateAllGroupBounds(scene) {
        Object.keys((scene && scene.groups) || {}).forEach(function MAREJIG_recalcGroup(groupId) {
            MAREJIG_recalculateGroupBounds(scene, groupId);
        });
        return scene;
    }

    function MAREJIG_pointInRect(point, rect) {
        return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
    }

    function MAREJIG_hitTestPieceByCells(scene, pieceId, point) {
        var puzzlePiece = scene.puzzle.pieces[pieceId];
        var scenePiece = scene.pieces[pieceId];
        var group = scene.groups[scenePiece.groupId];
        var rect = MAREJIG_getPieceWorldRect(scene, pieceId, group);
        if (!rect) return false;
        if (!MAREJIG_pointInRect(point, scenePiece.hitBounds || rect)) return false;
        var scale = rect.scale;
        return puzzlePiece.cells.some(function MAREJIG_cellContains(cell) {
            var cellX = rect.x + cell.x * scale;
            var cellY = rect.y + cell.y * scale;
            return point.x >= cellX && point.x <= cellX + scale && point.y >= cellY && point.y <= cellY + scale;
        });
    }

    function MAREJIG_hitTest(scene, point, options) {
        if (!scene || !point) return null;
        MAREJIG_recalculateAllGroupBounds(scene);
        var includeLocked = Boolean(options && options.includeLocked);
        var groups = Object.keys(scene.groups).map(function MAREJIG_getGroup(groupId) {
            return scene.groups[groupId];
        }).filter(function MAREJIG_canHitGroup(group) {
            return group.visible && (includeLocked || !group.lockedToBoard) && MAREJIG_pointInRect(point, group.hitBounds || group.bounds || { x: 0, y: 0, width: 0, height: 0 });
        }).sort(function MAREJIG_sortTopFirst(a, b) {
            return (b.zIndex || 0) - (a.zIndex || 0);
        });

        for (var i = 0; i < groups.length; i += 1) {
            var group = groups[i];
            var pieceIds = group.pieceIds.slice().sort(function MAREJIG_sortPieceHit(a, b) {
                return String(b).localeCompare(String(a));
            });
            for (var p = 0; p < pieceIds.length; p += 1) {
                var pieceId = pieceIds[p];
                if (!scene.pieces[pieceId] || !scene.pieces[pieceId].visible) continue;
                if (MAREJIG_hitTestPieceByCells(scene, pieceId, point)) {
                    return { groupId: group.id, pieceId: pieceId, group: group };
                }
            }
            if (MAREJIG_pointInRect(point, group.hitBounds || group.bounds)) {
                return { groupId: group.id, pieceId: group.pieceIds[0], group: group };
            }
        }
        return null;
    }

    function MAREJIG_getAdjacencyEdges(scene, pieceId) {
        var adjacency = scene && scene.puzzle ? scene.puzzle.adjacency || [] : [];
        return adjacency.filter(function MAREJIG_edgeTouches(edge) {
            return edge.a === pieceId || edge.b === pieceId;
        });
    }

    function MAREJIG_getSnapThreshold(scene, options) {
        var isTouch = Boolean(options && options.isTouch);
        var base = scene && scene.board ? scene.board.cellSize || scene.staging.pieceScale || 24 : 24;
        var threshold = isTouch ? Math.max(18, base * 0.38) : Math.max(12, base * 0.28);
        var zoom = scene && scene.camera ? scene.camera.zoom || 1 : 1;
        return threshold / Math.max(0.4, zoom);
    }

    function MAREJIG_findSnapCandidate(scene, activeGroupId, options) {
        var activeGroup = scene && scene.groups ? scene.groups[activeGroupId] : null;
        if (!activeGroup || !activeGroup.visible) return null;
        var threshold = Number(options && options.threshold) || MAREJIG_getSnapThreshold(scene, options);
        var scale = scene.staging.pieceScale || scene.board.cellSize || 1;
        var best = null;

        activeGroup.pieceIds.forEach(function MAREJIG_checkActivePiece(pieceId) {
            var scenePiece = scene.pieces[pieceId];
            var puzzlePiece = scene.puzzle.pieces[pieceId];
            if (!scenePiece || !scenePiece.visible || !puzzlePiece) return;
            MAREJIG_getAdjacencyEdges(scene, pieceId).forEach(function MAREJIG_checkEdge(edge) {
                var neighborId = edge.a === pieceId ? edge.b : edge.a;
                var neighborScenePiece = scene.pieces[neighborId];
                var neighborPuzzlePiece = scene.puzzle.pieces[neighborId];
                if (!neighborScenePiece || !neighborScenePiece.visible || !neighborPuzzlePiece) return;
                if (neighborScenePiece.groupId === activeGroupId) return;
                var neighborGroup = scene.groups[neighborScenePiece.groupId];
                if (!neighborGroup || !neighborGroup.visible) return;
                var neighborSegment = scene.puzzle.segments.items[neighborPuzzlePiece.segmentId];
                if (!neighborSegment || !neighborSegment.revealed) return;

                var activeRect = MAREJIG_getPieceWorldRect(scene, pieceId, activeGroup);
                var neighborRect = MAREJIG_getPieceWorldRect(scene, neighborId, neighborGroup);
                if (!activeRect || !neighborRect) return;
                var expectedDx = (puzzlePiece.solution.gridX - neighborPuzzlePiece.solution.gridX) * scale;
                var expectedDy = (puzzlePiece.solution.gridY - neighborPuzzlePiece.solution.gridY) * scale;
                var dx = neighborRect.x + expectedDx - activeRect.x;
                var dy = neighborRect.y + expectedDy - activeRect.y;
                var error = Math.sqrt(dx * dx + dy * dy);
                if (error <= threshold && (!best || error < best.error)) {
                    best = {
                        sourceGroupId: activeGroupId,
                        targetGroupId: neighborGroup.id,
                        sourcePieceId: pieceId,
                        targetPieceId: neighborId,
                        edgeId: edge.id || null,
                        dx: dx,
                        dy: dy,
                        error: error,
                        threshold: threshold
                    };
                }
            });
        });

        return best;
    }

    function MAREJIG_mergeGroups(groups, pieces, sourceGroupId, targetGroupId) {
        var source = groups[sourceGroupId];
        var target = groups[targetGroupId];
        if (!source || !target || sourceGroupId === targetGroupId) return groups;

        source.pieceIds.forEach(function MAREJIG_movePiece(pieceId) {
            if (target.pieceIds.indexOf(pieceId) === -1) target.pieceIds.push(pieceId);
            if (pieces[pieceId]) pieces[pieceId].groupId = targetGroupId;
        });
        target.pieceIds.sort();
        target.anchorPieceId = target.anchorPieceId || target.pieceIds[0];
        target.zIndex = Math.max(Number(target.zIndex) || 0, Number(source.zIndex) || 0);
        delete groups[sourceGroupId];
        return groups;
    }

    function MAREJIG_mergeSceneGroups(scene, sourceGroupId, targetGroupId, snapTransform) {
        var source = scene && scene.groups ? scene.groups[sourceGroupId] : null;
        var target = scene && scene.groups ? scene.groups[targetGroupId] : null;
        if (!source || !target || sourceGroupId === targetGroupId) return null;
        source.x += snapTransform && Number(snapTransform.dx) || 0;
        source.y += snapTransform && Number(snapTransform.dy) || 0;
        MAREJIG_mergeGroups(scene.groups, scene.pieces, sourceGroupId, targetGroupId);
        MAREJIG_mergeGroups(scene.puzzle.groups, scene.puzzle.pieces, sourceGroupId, targetGroupId);
        var merged = scene.groups[targetGroupId];
        if (merged) {
            merged.visible = true;
            merged.zIndex = MAREJIG_getMaxZ(scene.groups) + 1;
            MAREJIG_recalculateGroupBounds(scene, targetGroupId);
        }
        return merged;
    }

    function MAREJIG_applySnap(scene, activeGroupId, candidate) {
        if (!candidate || candidate.sourceGroupId !== activeGroupId) return null;
        var source = scene.groups[activeGroupId];
        if (!source || !scene.groups[candidate.targetGroupId] || activeGroupId === candidate.targetGroupId) return null;
        source.x += candidate.dx;
        source.y += candidate.dy;
        var merged = MAREJIG_mergeSceneGroups(scene, activeGroupId, candidate.targetGroupId, { dx: 0, dy: 0 });
        if (scene.ui) {
            scene.ui.selectedGroupId = merged ? merged.id : candidate.targetGroupId;
            scene.ui.snapFeedback = {
                groupId: scene.ui.selectedGroupId,
                startedAt: Date.now(),
                durationMs: 260,
                edgeId: candidate.edgeId,
                error: candidate.error
            };
            scene.ui.lastSnapCandidate = candidate;
            scene.ui.dirty = true;
        }
        return merged;
    }

    function MAREJIG_validateGroups(groups, pieces) {
        var seen = Object.create(null);
        var errors = [];

        Object.keys(groups).forEach(function MAREJIG_checkGroup(groupId) {
            var group = groups[groupId];
            if (!group.pieceIds || group.pieceIds.length === 0) errors.push('Grupo vacío: ' + groupId);
            group.pieceIds.forEach(function MAREJIG_checkGroupPiece(pieceId) {
                if (!pieces[pieceId]) errors.push('Grupo referencia pieza inexistente: ' + groupId + '/' + pieceId);
                if (seen[pieceId]) errors.push('Pieza en múltiples grupos: ' + pieceId);
                seen[pieceId] = groupId;
                if (pieces[pieceId] && pieces[pieceId].groupId !== groupId) {
                    errors.push('groupId inconsistente en pieza: ' + pieceId);
                }
            });
        });

        Object.keys(pieces).forEach(function MAREJIG_checkPiece(pieceId) {
            if (!seen[pieceId]) errors.push('Pieza sin grupo: ' + pieceId);
        });

        return { ok: errors.length === 0, errors: errors };
    }

    windowObject.MAREJIG_Groups = Object.freeze({
        createInitialGroups: MAREJIG_createInitialGroups,
        getGroupByPieceId: MAREJIG_getGroupByPieceId,
        mergeGroups: MAREJIG_mergeGroups,
        getGroupPieceIds: MAREJIG_getGroupPieceIds,
        getPieceWorldRect: MAREJIG_getPieceWorldRect,
        recalculateGroupBounds: MAREJIG_recalculateGroupBounds,
        recalculateAllGroupBounds: MAREJIG_recalculateAllGroupBounds,
        bringGroupToFront: MAREJIG_bringGroupToFront,
        hitTest: MAREJIG_hitTest,
        findSnapCandidate: MAREJIG_findSnapCandidate,
        applySnap: MAREJIG_applySnap,
        mergeSceneGroups: MAREJIG_mergeSceneGroups,
        validateGroups: MAREJIG_validateGroups
    });
})(window);
