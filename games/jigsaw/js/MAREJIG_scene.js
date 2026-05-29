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
        var width = (image && (image.naturalWidth || image.width)) || (drawable && drawable.width) || MAREJIG_Config.images.runtimeMobile.width;
        var height = (image && (image.naturalHeight || image.height)) || (drawable && drawable.height) || MAREJIG_Config.images.runtimeMobile.height;
        return { width: width, height: height };
    }

    function MAREJIG_createScene(level, puzzle, imageResult) {
        var activeSegmentId = puzzle.segments.order[0];
        var activeSegment = puzzle.segments.items[activeSegmentId];
        var visiblePieceSet = new Set(activeSegment.pieceIds);
        var rng = MAREJIG_createRng(puzzle.seed ^ 0x51C3A11);
        var pieces = {};
        var groups = {};

        Object.keys(puzzle.pieces).forEach(function MAREJIG_createScenePiece(pieceId) {
            var puzzlePiece = puzzle.pieces[pieceId];
            var visible = visiblePieceSet.has(pieceId);
            pieces[pieceId] = {
                id: pieceId,
                visible: visible,
                path: null,
                bounds: Object.assign({}, puzzlePiece.bounds),
                hitBounds: { x: 0, y: 0, width: 0, height: 0 },
                segmentId: puzzlePiece.segmentId,
                groupId: puzzlePiece.groupId,
                shapeSize: puzzlePiece.shapeSize
            };
        });

        Object.keys(puzzle.groups).forEach(function MAREJIG_createSceneGroup(groupId) {
            var group = puzzle.groups[groupId];
            var firstPieceId = group.pieceIds[0];
            var visible = visiblePieceSet.has(firstPieceId);
            groups[groupId] = {
                id: groupId,
                pieceIds: group.pieceIds.slice(),
                x: 0,
                y: 0,
                zIndex: visible ? Math.floor(rng() * 1000) : 0,
                lockedToBoard: false,
                visible: visible,
                positioned: false,
                bounds: { x: 0, y: 0, width: 0, height: 0 },
                hitBounds: { x: 0, y: 0, width: 0, height: 0 },
                laneIndex: activeSegment.pieceIds.indexOf(firstPieceId),
                jitter: { x: rng() - 0.5, y: rng() - 0.5 }
            };
        });

        return {
            level: level,
            puzzle: puzzle,
            drawableImage: imageResult && imageResult.drawable ? imageResult.drawable : null,
            imageMeta: MAREJIG_getImageMeta(imageResult),
            imageFailed: Boolean(imageResult && imageResult.failed),
            board: {
                cols: puzzle.board.cols,
                rows: puzzle.board.rows,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                cellSize: 0,
                sourceCellW: 0,
                sourceCellH: 0
            },
            staging: {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                pieceScale: 0
            },
            camera: {
                x: 0,
                y: 0,
                zoom: 1,
                minZoom: 0.85,
                maxZoom: 2
            },
            groups: groups,
            pieces: pieces,
            progress: {
                moves: 0,
                startedAt: null,
                elapsedMs: 0,
                hintsUsed: 0,
                mainGroupId: null,
                puzzleCompletedLocal: false,
                completionStarted: false,
                rewardReported: false,
                rewardSkipped: false,
                status: 'Jugando',
                gamePhase: 'playing',
                nextZIndex: 1000
            },
            ui: {
                activeSegmentId: activeSegmentId,
                selectedGroupId: null,
                snapFeedback: null,
                lastSnapCandidate: null,
                message: 'Jugando',
                messageStartedAt: Date.now(),
                dirty: true
            }
        };
    }

    function MAREJIG_layoutScene(scene, viewportWidth, viewportHeight) {
        var margin = Math.max(14, Math.min(28, viewportWidth * 0.045));
        var gap = Math.max(14, Math.min(24, viewportHeight * 0.035));
        var availableWidth = Math.max(1, viewportWidth - margin * 2);
        var boardMaxHeight = Math.max(160, viewportHeight * 0.55);
        var boardWidth = Math.min(availableWidth, boardMaxHeight * 4 / 3);
        var boardHeight = boardWidth * 3 / 4;
        var boardX = (viewportWidth - boardWidth) / 2;
        var boardY = margin;
        var stagingY = boardY + boardHeight + gap;
        var stagingHeight = Math.max(120, viewportHeight - stagingY - margin);
        var visibleGroups = Object.keys(scene.groups).map(function MAREJIG_groupById(groupId) {
            return scene.groups[groupId];
        }).filter(function MAREJIG_visibleGroup(group) {
            return group.visible;
        }).sort(function MAREJIG_sortGroups(a, b) {
            return a.laneIndex - b.laneIndex;
        });
        var columns = Math.max(2, Math.min(5, Math.ceil(Math.sqrt(Math.max(1, visibleGroups.length) * (viewportWidth > 720 ? 1.4 : 1)))));
        var rows = Math.max(1, Math.ceil(visibleGroups.length / columns));
        var slotW = availableWidth / columns;
        var slotH = stagingHeight / rows;
        var boardCell = boardWidth / scene.board.cols;
        var pieceScale = Math.max(12, Math.min(boardCell * 0.92, slotW * 0.44, slotH * 0.50));

        scene.board.x = boardX;
        scene.board.y = boardY;
        scene.board.width = boardWidth;
        scene.board.height = boardHeight;
        scene.board.cellSize = boardCell;
        scene.board.sourceCellW = scene.imageMeta.width / scene.board.cols;
        scene.board.sourceCellH = scene.imageMeta.height / scene.board.rows;
        scene.staging.x = margin;
        scene.staging.y = stagingY;
        scene.staging.width = availableWidth;
        scene.staging.height = stagingHeight;
        scene.staging.pieceScale = pieceScale;

        visibleGroups.forEach(function MAREJIG_placeGroup(group, index) {
            var piece = scene.puzzle.pieces[group.pieceIds[0]];
            var col = index % columns;
            var row = Math.floor(index / columns);
            var pieceW = piece.bounds.w * pieceScale;
            var pieceH = piece.bounds.h * pieceScale;
            if (!group.positioned) {
                group.x = margin + col * slotW + (slotW - pieceW) / 2 + group.jitter.x * Math.min(12, slotW * 0.08);
                group.y = stagingY + row * slotH + (slotH - pieceH) / 2 + group.jitter.y * Math.min(10, slotH * 0.08);
                group.positioned = true;
            }
            if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, group.id);
        });

        scene.camera.x = 0;
        scene.camera.y = 0;
        scene.camera.zoom = 1;
        if (scene.progress) scene.progress.nextZIndex = Math.max(scene.progress.nextZIndex || 0, visibleGroups.reduce(function MAREJIG_maxLayoutZ(max, group) {
            return Math.max(max, Number(group.zIndex) || 0);
        }, 1000));
        scene.ui.dirty = true;
        return scene;
    }

    function MAREJIG_centerScene(scene) {
        if (!scene) return scene;
        scene.camera.x = 0;
        scene.camera.y = 0;
        scene.camera.zoom = 1;
        scene.ui.selectedGroupId = null;
        scene.ui.dirty = true;
        return scene;
    }



    function MAREJIG_applySave(scene, save) {
        if (!scene || !save || save.levelId !== scene.level.id) return false;
        if (Number(save.puzzleSeed) && Number(save.puzzleSeed) !== Number(scene.puzzle.seed)) {
            console.warn('[MAREJIG] Save ignorado por seed incompatible', save.levelId);
            return false;
        }

        var savedGroups = {};
        (save.groups || []).forEach(function MAREJIG_indexSavedGroup(group) {
            savedGroups[group.groupId] = group;
        });
        var nextGroups = {};
        Object.keys(savedGroups).forEach(function MAREJIG_restoreGroup(groupId) {
            var saved = savedGroups[groupId];
            nextGroups[groupId] = Object.assign({}, scene.groups[groupId] || {}, {
                id: groupId,
                pieceIds: saved.pieceIds.slice(),
                x: Number(saved.x) || 0,
                y: Number(saved.y) || 0,
                zIndex: Number(saved.zIndex) || 0,
                lockedToBoard: Boolean(saved.lockedToBoard),
                visible: Boolean(saved.visible),
                positioned: true
            });
        });
        if (!Object.keys(nextGroups).length) return false;
        scene.groups = nextGroups;
        scene.puzzle.groups = JSON.parse(JSON.stringify(nextGroups));

        (save.pieces || []).forEach(function MAREJIG_restorePiece(savedPiece) {
            if (scene.pieces[savedPiece.pieceId]) {
                scene.pieces[savedPiece.pieceId].groupId = savedPiece.groupId;
                scene.pieces[savedPiece.pieceId].visible = Boolean(savedPiece.revealed);
                scene.pieces[savedPiece.pieceId].locked = Boolean(savedPiece.locked);
            }
            if (scene.puzzle.pieces[savedPiece.pieceId]) {
                scene.puzzle.pieces[savedPiece.pieceId].groupId = savedPiece.groupId;
                scene.puzzle.pieces[savedPiece.pieceId].revealed = Boolean(savedPiece.revealed);
                scene.puzzle.pieces[savedPiece.pieceId].locked = Boolean(savedPiece.locked);
            }
        });

        var completed = new Set(save.completedSegmentIds || []);
        var revealed = new Set(save.revealedSegmentIds || []);
        scene.puzzle.segments.currentSegmentIndex = Math.max(0, Math.min(Number(save.currentSegmentIndex) || 0, scene.puzzle.segments.order.length - 1));
        scene.puzzle.segments.order.forEach(function MAREJIG_restoreSegment(segmentId, index) {
            var segment = scene.puzzle.segments.items[segmentId];
            if (!segment) return;
            segment.completed = completed.has(segmentId);
            segment.revealed = revealed.has(segmentId) || index === 0;
            segment.pieceIds.forEach(function MAREJIG_restoreSegmentPiece(pieceId) {
                if (scene.pieces[pieceId]) scene.pieces[pieceId].visible = segment.revealed;
                if (scene.puzzle.pieces[pieceId]) scene.puzzle.pieces[pieceId].revealed = segment.revealed;
            });
        });

        scene.progress.elapsedMs = Math.max(0, Number(save.elapsedMs) || 0);
        scene.progress.moves = Math.max(0, Number(save.moves) || 0);
        scene.progress.hintsUsed = Math.max(0, Number(save.hintsUsed) || 0);
        scene.progress.mainGroupId = save.mainGroupId || null;
        scene.progress.puzzleCompletedLocal = Boolean(save.puzzleCompletedLocal);
        scene.progress.completionStarted = Boolean(save.completionStarted);
        scene.progress.rewardReported = Boolean(save.rewardReported);
        scene.progress.gamePhase = scene.progress.puzzleCompletedLocal ? 'completed' : 'playing';
        scene.progress.status = scene.progress.puzzleCompletedLocal ? 'Completado' : 'Continuando';
        scene.progress.nextZIndex = Object.keys(scene.groups).reduce(function MAREJIG_maxZ(max, groupId) {
            return Math.max(max, Number(scene.groups[groupId].zIndex) || 0);
        }, scene.progress.nextZIndex || 1000);
        scene.ui.activeSegmentId = scene.puzzle.segments.order[scene.puzzle.segments.currentSegmentIndex] || scene.ui.activeSegmentId;
        scene.ui.message = scene.progress.puzzleCompletedLocal ? 'Puzzle completado' : 'Partida reanudada';
        scene.ui.messageStartedAt = Date.now();
        scene.ui.dirty = true;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateAllGroupBounds(scene);
        return true;
    }

    function MAREJIG_getVisiblePieceIds(scene) {
        return Object.keys(scene.pieces).filter(function MAREJIG_isVisible(pieceId) {
            return scene.pieces[pieceId].visible;
        });
    }

    windowObject.MAREJIG_Scene = Object.freeze({
        createScene: MAREJIG_createScene,
        layoutScene: MAREJIG_layoutScene,
        getVisiblePieceIds: MAREJIG_getVisiblePieceIds,
        centerScene: MAREJIG_centerScene,
        applySave: MAREJIG_applySave
    });
})(window);
