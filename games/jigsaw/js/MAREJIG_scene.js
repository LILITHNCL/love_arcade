(function MAREJIG_sceneModule(windowObject) {
    'use strict';

    var MAREJIG_Config = windowObject.MAREJIG_Config;
    var MAREJIG_Groups = windowObject.MAREJIG_Groups;

    function MAREJIG_createRng(seed) {
        var state = seed >>> 0;
        return function MAREJIG_sceneRng() {
            state += 0x6D2B79F5;
            var t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function MAREJIG_getImageMeta(imageResult) {
        var image = imageResult && imageResult.image;
        var drawable = imageResult && imageResult.drawable;
        return {
            width: (image && (image.naturalWidth || image.width)) || (drawable && drawable.width) || MAREJIG_Config.images.runtimeMobile.width,
            height: (image && (image.naturalHeight || image.height)) || (drawable && drawable.height) || MAREJIG_Config.images.runtimeMobile.height
        };
    }

    function MAREJIG_createScene(level, puzzle, imageResult) {
        var activeSegmentId = puzzle.segments.order[0];
        var visiblePieceSet = new Set(puzzle.segments.items[activeSegmentId].pieceIds);
        var rng = MAREJIG_createRng(puzzle.seed ^ 0x51C3A11);
        var pieces = {};
        var groups = {};
        Object.keys(puzzle.pieces).forEach(function MAREJIG_createScenePiece(pieceId) {
            var puzzlePiece = puzzle.pieces[pieceId];
            pieces[pieceId] = {
                id: pieceId,
                visible: visiblePieceSet.has(pieceId),
                path: null,
                bounds: Object.assign({}, puzzlePiece.bounds),
                hitBounds: { x: 0, y: 0, width: 0, height: 0 },
                segmentId: puzzlePiece.segmentId,
                groupId: puzzlePiece.groupId,
                shapeSize: puzzlePiece.shapeSize
            };
        });
        Object.keys(puzzle.groups).forEach(function MAREJIG_createSceneGroup(groupId) {
            var source = puzzle.groups[groupId];
            var firstPieceId = source.pieceIds[0];
            groups[groupId] = {
                id: groupId,
                pieceIds: source.pieceIds.slice(),
                anchorPieceId: source.anchorPieceId || firstPieceId,
                x: 0,
                y: 0,
                zIndex: visiblePieceSet.has(firstPieceId) ? Math.floor(rng() * 1000) : 0,
                lockedToBoard: false,
                visible: visiblePieceSet.has(firstPieceId),
                positioned: false,
                bounds: { x: 0, y: 0, width: 0, height: 0 },
                hitBounds: { x: 0, y: 0, width: 0, height: 0 },
                outlineDirty: true,
                groupOutline: null
            };
        });
        return {
            level: level,
            puzzle: puzzle,
            drawableImage: imageResult && imageResult.drawable ? imageResult.drawable : null,
            imageMeta: MAREJIG_getImageMeta(imageResult),
            imageFailed: Boolean(imageResult && imageResult.failed),
            board: { cols: puzzle.board.cols, rows: puzzle.board.rows, x: 0, y: 0, width: 0, height: 0, cellSize: 0, sourceCellW: 0, sourceCellH: 0 },
            staging: { x: 0, y: 0, width: 0, height: 0, pieceScale: 0, columns: 0, rows: 0 },
            viewport: { width: 0, height: 0 },
            world: { x: 0, y: 0, width: 0, height: 0, safePadding: 24 },
            camera: { x: 0, y: 0, zoom: 1, minZoom: 0.75, maxZoom: 1.6 },
            groups: groups,
            pieces: pieces,
            progress: {
                moves: 0, startedAt: null, elapsedMs: 0, mainGroupId: null,
                puzzleCompletedLocal: false, completionStarted: false, rewardReported: false,
                rewardSkipped: false, status: 'Jugando', gamePhase: 'playing', nextZIndex: 1000
            },
            ui: { activeSegmentId: activeSegmentId, selectedGroupId: null, snapFeedback: null, lastSnapCandidate: null, message: 'Jugando', messageStartedAt: Date.now(), dirty: true }
        };
    }

    function MAREJIG_clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

    function MAREJIG_getVisibleGroups(scene) {
        return Object.keys(scene.groups).map(function MAREJIG_sceneGroup(groupId) { return scene.groups[groupId]; }).filter(function MAREJIG_visibleGroup(group) { return group.visible; });
    }

    function MAREJIG_getWorldDimensions(scene, viewportWidth, viewportHeight, boardWidth, boardHeight) {
        return {
            width: Math.ceil(Math.max(viewportWidth * 1.8, boardWidth * 1.4 + viewportWidth * 0.52)),
            height: Math.ceil(Math.max(viewportHeight * 1.5, boardHeight * 1.8 + viewportHeight * 0.52))
        };
    }

    function MAREJIG_clampCamera(scene) {
        if (!scene || !scene.camera || !scene.world || !scene.viewport) return scene;
        var visibleW = scene.viewport.width / scene.camera.zoom;
        var visibleH = scene.viewport.height / scene.camera.zoom;
        scene.camera.x = MAREJIG_clamp(scene.camera.x, scene.world.x, Math.max(scene.world.x, scene.world.x + scene.world.width - visibleW));
        scene.camera.y = MAREJIG_clamp(scene.camera.y, scene.world.y, Math.max(scene.world.y, scene.world.y + scene.world.height - visibleH));
        return scene;
    }

    function MAREJIG_worldToScreen(scene, point) {
        return { x: (point.x - scene.camera.x) * scene.camera.zoom, y: (point.y - scene.camera.y) * scene.camera.zoom };
    }

    function MAREJIG_screenToWorld(scene, point) {
        return { x: scene.camera.x + point.x / scene.camera.zoom, y: scene.camera.y + point.y / scene.camera.zoom };
    }

    function MAREJIG_centerScene(scene) {
        if (!scene || !scene.viewport) return scene;
        scene.camera.zoom = 1;
        scene.camera.x = scene.board.x + scene.board.width / 2 - scene.viewport.width / 2;
        scene.camera.y = scene.board.y + scene.board.height / 2 - scene.viewport.height * 0.43;
        scene.ui.selectedGroupId = null;
        MAREJIG_clampCamera(scene);
        scene.ui.dirty = true;
        return scene;
    }

    function MAREJIG_boundsOverlap(a, b, gap) {
        return !(a.x + a.width + gap <= b.x || b.x + b.width + gap <= a.x || a.y + a.height + gap <= b.y || b.y + b.height + gap <= a.y);
    }

    function MAREJIG_isInsideSolution(scene, bounds, gap) {
        return MAREJIG_boundsOverlap(bounds, { x: scene.board.x, y: scene.board.y, width: scene.board.width, height: scene.board.height }, gap);
    }

    function MAREJIG_getOccupiedBounds(scene, ignoredId) {
        return MAREJIG_getVisibleGroups(scene).filter(function MAREJIG_positioned(group) { return group.positioned && group.id !== ignoredId; }).map(function MAREJIG_groupBounds(group) { return group.bounds; });
    }

    function MAREJIG_candidateForZone(scene, zone, width, height, rng) {
        return { x: zone.x + rng() * Math.max(1, zone.width - width), y: zone.y + rng() * Math.max(1, zone.height - height) };
    }

    function MAREJIG_getScatterZones(scene) {
        var world = scene.world;
        var board = scene.board;
        var pad = world.safePadding;
        var sideGap = Math.max(22, board.cellSize * 0.7);
        return [
            { x: pad, y: board.y + board.height + sideGap, width: world.width - pad * 2, height: world.height - board.y - board.height - sideGap - pad },
            { x: pad, y: pad, width: Math.max(1, board.x - sideGap - pad), height: world.height - pad * 2 },
            { x: board.x + board.width + sideGap, y: pad, width: Math.max(1, world.width - board.x - board.width - sideGap - pad), height: world.height - pad * 2 },
            { x: pad, y: pad, width: world.width - pad * 2, height: Math.max(1, board.y - sideGap - pad) }
        ].filter(function MAREJIG_validZone(zone) { return zone.width > scene.staging.pieceScale * 1.2 && zone.height > scene.staging.pieceScale * 1.2; });
    }

    function MAREJIG_placeGroupNaturally(scene, group, seedText) {
        if (!scene || !group || group.positioned) return group;
        var anchor = scene.puzzle.pieces[group.anchorPieceId || group.pieceIds[0]];
        if (!anchor) return group;
        var width = anchor.bounds.w * scene.staging.pieceScale;
        var height = anchor.bounds.h * scene.staging.pieceScale;
        var rng = MAREJIG_createRng((scene.puzzle.seed ^ String(seedText || group.id).split('').reduce(function MAREJIG_hashSeed(hash, char) { return Math.imul(hash ^ char.charCodeAt(0), 16777619); }, 2166136261)) >>> 0);
        var zones = MAREJIG_getScatterZones(scene);
        var occupied = MAREJIG_getOccupiedBounds(scene, group.id);
        var gap = Math.max(8, scene.board.cellSize * 0.24);
        var chosen = null;
        for (var attempt = 0; attempt < 120 && zones.length; attempt += 1) {
            var zone = zones[Math.floor(rng() * zones.length) % zones.length];
            var candidate = MAREJIG_candidateForZone(scene, zone, width, height, rng);
            var bounds = { x: candidate.x, y: candidate.y, width: width, height: height };
            if (!MAREJIG_isInsideSolution(scene, bounds, gap) && !occupied.some(function MAREJIG_collides(other) { return MAREJIG_boundsOverlap(bounds, other, gap); })) { chosen = candidate; break; }
        }
        if (!chosen) {
            var step = Math.max(18, scene.staging.pieceScale * 0.72);
            for (var y = scene.world.safePadding; y < scene.world.height - height && !chosen; y += step) {
                for (var x = scene.world.safePadding; x < scene.world.width - width; x += step) {
                    var fallback = { x: x, y: y, width: width, height: height };
                    if (!MAREJIG_isInsideSolution(scene, fallback, gap) && !occupied.some(function MAREJIG_fallbackCollides(other) { return MAREJIG_boundsOverlap(fallback, other, gap * 0.45); })) { chosen = fallback; break; }
                }
            }
        }
        group.x = chosen ? chosen.x : scene.world.safePadding;
        group.y = chosen ? chosen.y : Math.max(scene.world.safePadding, scene.board.y + scene.board.height + gap);
        group.positioned = true;
        group.zIndex = (scene.progress.nextZIndex += 1);
        group.outlineDirty = true;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, group.id);
        return group;
    }

    function MAREJIG_clampGroupToWorld(scene, group) {
        if (!scene || !group || !scene.world || group.lockedToBoard) return group;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, group.id);
        var bounds = group.bounds || { x: group.x, y: group.y, width: 0, height: 0 };
        var pad = Math.max(8, scene.world.safePadding * 0.45);
        var minX = scene.world.x - bounds.width + pad;
        var maxX = scene.world.x + scene.world.width - pad;
        var minY = scene.world.y - bounds.height + pad;
        var maxY = scene.world.y + scene.world.height - pad;
        var nextX = MAREJIG_clamp(bounds.x, minX, maxX);
        var nextY = MAREJIG_clamp(bounds.y, minY, maxY);
        group.x += nextX - bounds.x;
        group.y += nextY - bounds.y;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, group.id);
        return group;
    }

    function MAREJIG_ensureVisibleGroups(scene) {
        if (!scene || !scene.groups || !scene.world) return scene;
        Object.keys(scene.groups).forEach(function MAREJIG_ensureGroup(groupId) {
            var group = scene.groups[groupId];
            if (group && group.visible) MAREJIG_clampGroupToWorld(scene, group);
        });
        MAREJIG_clampCamera(scene);
        scene.ui.dirty = true;
        return scene;
    }

    function MAREJIG_layoutScene(scene, viewportWidth, viewportHeight) {
        var firstLayout = !scene.viewport.width || !scene.board.width;
        var oldCenter = firstLayout ? null : MAREJIG_screenToWorld(scene, { x: scene.viewport.width / 2, y: scene.viewport.height / 2 });
        var ratio = scene.board.cols / scene.board.rows;
        var boardWidth = Math.min(viewportWidth * 0.84, viewportHeight * 0.46 * ratio, 720);
        var boardHeight = boardWidth / ratio;
        var dims = MAREJIG_getWorldDimensions(scene, viewportWidth, viewportHeight, boardWidth, boardHeight);
        scene.viewport.width = viewportWidth;
        scene.viewport.height = viewportHeight;
        scene.world.safePadding = Math.max(20, Math.min(42, viewportWidth * 0.055));
        scene.world.width = Math.max(scene.world.width || 0, dims.width);
        scene.world.height = Math.max(scene.world.height || 0, dims.height);
        scene.board.width = boardWidth;
        scene.board.height = boardHeight;
        scene.board.cellSize = boardWidth / scene.board.cols;
        scene.board.sourceCellW = scene.imageMeta.width / scene.board.cols;
        scene.board.sourceCellH = scene.imageMeta.height / scene.board.rows;
        if (firstLayout) {
            scene.board.x = (scene.world.width - boardWidth) / 2;
            scene.board.y = Math.max(scene.world.safePadding * 2.2, scene.world.height * 0.19);
        }
        scene.staging.x = 0;
        scene.staging.y = 0;
        scene.staging.width = scene.world.width;
        scene.staging.height = scene.world.height;
        scene.staging.pieceScale = Math.max(18, scene.board.cellSize * 0.86);
        MAREJIG_getVisibleGroups(scene).forEach(function MAREJIG_placeVisibleGroup(group, index) {
            if (!group.positioned) MAREJIG_placeGroupNaturally(scene, group, scene.ui.activeSegmentId + ':' + index + ':' + group.id);
            else if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, group.id);
        });
        if (firstLayout) MAREJIG_centerScene(scene);
        else if (oldCenter) {
            scene.camera.x = oldCenter.x - viewportWidth / scene.camera.zoom / 2;
            scene.camera.y = oldCenter.y - viewportHeight / scene.camera.zoom / 2;
            MAREJIG_clampCamera(scene);
        }
        MAREJIG_ensureVisibleGroups(scene);
        scene.ui.dirty = true;
        return scene;
    }

    function MAREJIG_reflowScene(scene) { return MAREJIG_ensureVisibleGroups(scene); }

    function MAREJIG_applySave(scene, save) {
        if (!scene || !save || save.levelId !== scene.level.id) return false;
        if (Number(save.puzzleSeed) && Number(save.puzzleSeed) !== Number(scene.puzzle.seed)) return false;
        var nextGroups = {};
        (save.groups || []).forEach(function MAREJIG_restoreGroup(saved) {
            nextGroups[saved.groupId] = Object.assign({}, scene.groups[saved.groupId] || {}, saved, { id: saved.groupId, pieceIds: saved.pieceIds.slice(), anchorPieceId: saved.anchorPieceId || saved.pieceIds[0], positioned: true, outlineDirty: true, groupOutline: null });
        });
        if (!Object.keys(nextGroups).length) return false;
        scene.groups = nextGroups;
        scene.puzzle.groups = JSON.parse(JSON.stringify(nextGroups));
        (save.pieces || []).forEach(function MAREJIG_restorePiece(savedPiece) {
            if (scene.pieces[savedPiece.pieceId]) Object.assign(scene.pieces[savedPiece.pieceId], { groupId: savedPiece.groupId, visible: Boolean(savedPiece.revealed), locked: Boolean(savedPiece.locked) });
            if (scene.puzzle.pieces[savedPiece.pieceId]) Object.assign(scene.puzzle.pieces[savedPiece.pieceId], { groupId: savedPiece.groupId, revealed: Boolean(savedPiece.revealed), locked: Boolean(savedPiece.locked) });
        });
        var completed = new Set(save.completedSegmentIds || []);
        var revealed = new Set(save.revealedSegmentIds || []);
        scene.puzzle.segments.currentSegmentIndex = Math.max(0, Math.min(Number(save.currentSegmentIndex) || 0, scene.puzzle.segments.order.length - 1));
        scene.puzzle.segments.order.forEach(function MAREJIG_restoreSegment(segmentId, index) {
            var segment = scene.puzzle.segments.items[segmentId];
            segment.completed = completed.has(segmentId);
            segment.revealed = revealed.has(segmentId) || index === 0;
            segment.pieceIds.forEach(function MAREJIG_restoreSegmentPiece(pieceId) { if (scene.pieces[pieceId]) scene.pieces[pieceId].visible = segment.revealed; if (scene.puzzle.pieces[pieceId]) scene.puzzle.pieces[pieceId].revealed = segment.revealed; });
        });
        Object.assign(scene.progress, { elapsedMs: Math.max(0, Number(save.elapsedMs) || 0), moves: Math.max(0, Number(save.moves) || 0), mainGroupId: save.mainGroupId || null, puzzleCompletedLocal: Boolean(save.puzzleCompletedLocal), completionStarted: Boolean(save.completionStarted), rewardReported: Boolean(save.rewardReported) });
        scene.progress.gamePhase = scene.progress.puzzleCompletedLocal ? 'completed' : 'playing';
        scene.progress.status = scene.progress.puzzleCompletedLocal ? 'Completado' : 'Continuando';
        scene.ui.activeSegmentId = scene.puzzle.segments.order[scene.puzzle.segments.currentSegmentIndex] || scene.ui.activeSegmentId;
        scene.ui.message = scene.progress.puzzleCompletedLocal ? 'Puzzle completado' : 'Partida reanudada';
        scene.ui.messageStartedAt = Date.now();
        scene.ui.dirty = true;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateAllGroupBounds(scene);
        return true;
    }

    function MAREJIG_getVisiblePieceIds(scene) { return Object.keys(scene.pieces).filter(function MAREJIG_isVisible(pieceId) { return scene.pieces[pieceId].visible; }); }

    windowObject.MAREJIG_Scene = Object.freeze({
        createScene: MAREJIG_createScene, layoutScene: MAREJIG_layoutScene, reflowScene: MAREJIG_reflowScene,
        ensureVisibleGroups: MAREJIG_ensureVisibleGroups, clampGroupToWorld: MAREJIG_clampGroupToWorld,
        clampCamera: MAREJIG_clampCamera, screenToWorld: MAREJIG_screenToWorld, worldToScreen: MAREJIG_worldToScreen,
        placeGroupNaturally: MAREJIG_placeGroupNaturally, getVisiblePieceIds: MAREJIG_getVisiblePieceIds,
        centerScene: MAREJIG_centerScene, applySave: MAREJIG_applySave
    });
})(window);
