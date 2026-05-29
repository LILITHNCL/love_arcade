(function MAREJIG_hintsModule(windowObject) {
    'use strict';

    var MAREJIG_Segments = windowObject.MAREJIG_Segments;

    function MAREJIG_groupHasActivePiece(scene, group, activeSegmentId) {
        return Boolean(group && group.visible && group.pieceIds.some(function MAREJIG_activePiece(pieceId) {
            var piece = scene.pieces[pieceId];
            var puzzlePiece = scene.puzzle.pieces[pieceId];
            return piece && piece.visible && puzzlePiece && puzzlePiece.segmentId === activeSegmentId;
        }));
    }

    function MAREJIG_getVisiblePieceIdsInGroup(scene, group, activeSegmentId) {
        return (group ? group.pieceIds : []).filter(function MAREJIG_visibleGroupPiece(pieceId) {
            var piece = scene.pieces[pieceId];
            var puzzlePiece = scene.puzzle.pieces[pieceId];
            return piece && piece.visible && puzzlePiece && puzzlePiece.segmentId === activeSegmentId;
        });
    }

    function MAREJIG_hasUsefulVisibleNeighbor(scene, pieceId, groupId) {
        var adjacency = scene.puzzle.adjacency || [];
        for (var index = 0; index < adjacency.length; index += 1) {
            var edge = adjacency[index];
            if (edge.a !== pieceId && edge.b !== pieceId) continue;
            var neighborId = edge.a === pieceId ? edge.b : edge.a;
            var neighbor = scene.pieces[neighborId];
            var neighborPuzzlePiece = scene.puzzle.pieces[neighborId];
            if (!neighbor || !neighbor.visible || !neighborPuzzlePiece) continue;
            if (neighbor.groupId === groupId) continue;
            var neighborSegment = scene.puzzle.segments.items[neighborPuzzlePiece.segmentId];
            if (neighborSegment && neighborSegment.revealed) return true;
        }
        return false;
    }

    function MAREJIG_chooseHintTarget(scene) {
        if (!scene || !scene.progress || scene.progress.gamePhase !== 'playing') {
            return { ok: false, reason: 'Las pistas no están disponibles ahora.' };
        }
        var stats = MAREJIG_Segments.getSegmentStats(scene);
        var activeSegmentId = stats.activeSegmentId;
        var activeSegment = activeSegmentId ? scene.puzzle.segments.items[activeSegmentId] : null;
        if (!activeSegment || activeSegment.completed || MAREJIG_Segments.isActiveSegmentComplete(scene)) {
            return { ok: false, reason: 'No hay pista disponible en este segmento.' };
        }

        var selectedGroup = scene.ui && scene.ui.selectedGroupId ? scene.groups[scene.ui.selectedGroupId] : null;
        if (MAREJIG_groupHasActivePiece(scene, selectedGroup, activeSegmentId)) {
            return { ok: true, groupId: selectedGroup.id, pieceIds: MAREJIG_getVisiblePieceIdsInGroup(scene, selectedGroup, activeSegmentId), selected: true };
        }

        var best = null;
        activeSegment.pieceIds.some(function MAREJIG_findUsefulPiece(pieceId) {
            var piece = scene.pieces[pieceId];
            if (!piece || !piece.visible) return false;
            var group = scene.groups[piece.groupId];
            if (!group || !group.visible) return false;
            var useful = MAREJIG_hasUsefulVisibleNeighbor(scene, pieceId, group.id);
            best = { ok: true, groupId: group.id, pieceIds: [pieceId], selected: false, useful: useful };
            return useful;
        });
        return best || { ok: false, reason: 'No hay piezas visibles útiles para pista.' };
    }

    function MAREJIG_showHint(scene, options) {
        var target = MAREJIG_chooseHintTarget(scene);
        if (!target.ok) return target;
        scene.progress.hintsUsed = Math.max(0, Number(scene.progress.hintsUsed) || 0) + 1;
        scene.ui.hint = {
            groupId: target.groupId,
            pieceIds: target.pieceIds.slice(0, Math.max(1, Math.min(3, target.pieceIds.length))),
            startedAt: Date.now(),
            durationMs: options && options.reducedMotion ? 2400 : 3600
        };
        scene.ui.message = 'Pista mostrada';
        scene.ui.messageStartedAt = Date.now();
        scene.ui.dirty = true;
        return Object.assign({ hintsUsed: scene.progress.hintsUsed }, target);
    }

    function MAREJIG_clearHint(scene) {
        if (scene && scene.ui && scene.ui.hint) {
            scene.ui.hint = null;
            scene.ui.dirty = true;
            return true;
        }
        return false;
    }

    windowObject.MAREJIG_Hints = Object.freeze({
        chooseHintTarget: MAREJIG_chooseHintTarget,
        showHint: MAREJIG_showHint,
        clearHint: MAREJIG_clearHint
    });
})(window);
