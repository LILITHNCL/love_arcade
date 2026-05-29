(function MAREJIG_sceneModule(windowObject) {
    'use strict';

    var MAREJIG_Config = windowObject.MAREJIG_Config;

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
            ui: {
                activeSegmentId: activeSegmentId,
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
        var pieceScale = Math.max(9, Math.min(boardCell * 0.78, slotW * 0.36, slotH * 0.42));

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
            group.x = margin + col * slotW + (slotW - pieceW) / 2 + group.jitter.x * Math.min(12, slotW * 0.08);
            group.y = stagingY + row * slotH + (slotH - pieceH) / 2 + group.jitter.y * Math.min(10, slotH * 0.08);
            scene.pieces[group.pieceIds[0]].hitBounds = {
                x: group.x - 8,
                y: group.y - 8,
                width: pieceW + 16,
                height: pieceH + 16
            };
        });

        scene.camera.x = 0;
        scene.camera.y = 0;
        scene.camera.zoom = 1;
        scene.ui.dirty = true;
        return scene;
    }

    function MAREJIG_getVisiblePieceIds(scene) {
        return Object.keys(scene.pieces).filter(function MAREJIG_isVisible(pieceId) {
            return scene.pieces[pieceId].visible;
        });
    }

    windowObject.MAREJIG_Scene = Object.freeze({
        createScene: MAREJIG_createScene,
        layoutScene: MAREJIG_layoutScene,
        getVisiblePieceIds: MAREJIG_getVisiblePieceIds
    });
})(window);
