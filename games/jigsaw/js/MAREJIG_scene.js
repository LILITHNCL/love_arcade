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
            ui: { activeSegmentId: activeSegmentId, selectedGroupId: null, snapFeedback: null, lastSnapCandidate: null, message: 'Jugando', messageStartedAt: Date.now(), dirty: true },
            feedback: { invalidContact: null }
        };
    }

    function MAREJIG_clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

    function MAREJIG_getVisibleGroups(scene) {
        return Object.keys(scene.groups).map(function MAREJIG_sceneGroup(groupId) { return scene.groups[groupId]; }).filter(function MAREJIG_visibleGroup(group) { return group.visible; });
    }

    function MAREJIG_getWorldDimensions(scene, viewportWidth, viewportHeight, boardWidth, boardHeight) {
        return {
            width: Math.ceil(Math.max(viewportWidth * 2.08, boardWidth + viewportWidth * 0.92)),
            height: Math.ceil(Math.max(viewportHeight * 1.78, boardHeight + viewportHeight * 1.02))
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
        var initialBounds = MAREJIG_getSegmentBounds(scene, scene.ui && scene.ui.activeSegmentId);
        var focus = initialBounds || { x: scene.board.x, y: scene.board.y, width: scene.board.width, height: scene.board.height };
        scene.camera.x = focus.x + focus.width / 2 - scene.viewport.width / 2;
        scene.camera.y = focus.y + focus.height / 2 - scene.viewport.height / 2;
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

    function MAREJIG_unionBounds(boundsList) {
        var filtered = (boundsList || []).filter(function MAREJIG_validBounds(bounds) { return bounds && bounds.width >= 0 && bounds.height >= 0; });
        if (!filtered.length) return null;
        var minX = Infinity;
        var minY = Infinity;
        var maxX = -Infinity;
        var maxY = -Infinity;
        filtered.forEach(function MAREJIG_includeBounds(bounds) {
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    function MAREJIG_getSegmentGroupIds(scene, segmentId) {
        var segment = scene && scene.puzzle && scene.puzzle.segments ? scene.puzzle.segments.items[segmentId] : null;
        var ids = [];
        if (!segment) return ids;
        segment.pieceIds.forEach(function MAREJIG_segmentGroup(pieceId) {
            var groupId = scene.pieces[pieceId] && scene.pieces[pieceId].groupId;
            if (groupId && ids.indexOf(groupId) === -1) ids.push(groupId);
        });
        return ids;
    }

    function MAREJIG_getSegmentBounds(scene, segmentId) {
        var bounds = MAREJIG_getSegmentGroupIds(scene, segmentId).map(function MAREJIG_segmentBounds(groupId) {
            var group = scene.groups[groupId];
            if (group && group.visible && MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, groupId);
            return group && group.visible ? group.bounds : null;
        });
        return MAREJIG_unionBounds(bounds);
    }

    function MAREJIG_getMainFocusBounds(scene) {
        if (scene && scene.progress && scene.progress.mainGroupId && scene.groups[scene.progress.mainGroupId]) {
            if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, scene.progress.mainGroupId);
            return scene.groups[scene.progress.mainGroupId].bounds;
        }
        var revealed = MAREJIG_getVisibleGroups(scene).filter(function MAREJIG_alreadyPositioned(group) { return group.positioned; }).map(function MAREJIG_focusBounds(group) {
            if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, group.id);
            return group.bounds;
        });
        return MAREJIG_unionBounds(revealed) || { x: scene.board.x, y: scene.board.y, width: scene.board.width, height: scene.board.height };
    }

    function MAREJIG_overlapArea(a, b) {
        var width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
        var height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
        return width * height;
    }

    function MAREJIG_boundsNear(a, b, gap) {
        return !(a.x + a.width + gap < b.x || b.x + b.width + gap < a.x || a.y + a.height + gap < b.y || b.y + b.height + gap < a.y);
    }

    function MAREJIG_moveGroupByBounds(scene, group, x, y) {
        if (!group) return group;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, group.id);
        var bounds = group.bounds || { x: group.x, y: group.y, width: 0, height: 0 };
        group.x += x - bounds.x;
        group.y += y - bounds.y;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, group.id);
        return group;
    }

    function MAREJIG_isFreeBounds(scene, bounds, ignoredIds, gap, allowBoard) {
        var ignore = ignoredIds || [];
        var world = scene.world;
        if (bounds.x < world.x || bounds.y < world.y || bounds.x + bounds.width > world.x + world.width || bounds.y + bounds.height > world.y + world.height) return false;
        if (!allowBoard && MAREJIG_isInsideSolution(scene, bounds, gap * 0.5)) return false;
        return !MAREJIG_getVisibleGroups(scene).some(function MAREJIG_collidesExisting(group) {
            return group.positioned && ignore.indexOf(group.id) === -1 && MAREJIG_boundsOverlap(bounds, group.bounds, gap);
        });
    }

    function MAREJIG_findFreePosition(scene, width, height, origin, ignoredIds, options) {
        var gap = Math.max(10, Number(options && options.gap) || scene.staging.pieceScale * 0.28);
        var allowBoard = Boolean(options && options.allowBoard);
        var candidates = [];
        var radiusStep = Math.max(scene.staging.pieceScale * 1.2, Math.min(scene.viewport.width, scene.viewport.height) * 0.12);
        candidates.push({ x: origin.x - width / 2, y: origin.y - height / 2 });
        for (var ring = 1; ring <= 7; ring += 1) {
            var r = radiusStep * ring;
            candidates.push({ x: origin.x - width / 2 + r, y: origin.y - height / 2 });
            candidates.push({ x: origin.x - width / 2 - r, y: origin.y - height / 2 });
            candidates.push({ x: origin.x - width / 2, y: origin.y - height / 2 + r });
            candidates.push({ x: origin.x - width / 2, y: origin.y - height / 2 - r });
            candidates.push({ x: origin.x - width / 2 + r * 0.72, y: origin.y - height / 2 + r * 0.72 });
            candidates.push({ x: origin.x - width / 2 - r * 0.72, y: origin.y - height / 2 + r * 0.72 });
        }
        for (var i = 0; i < candidates.length; i += 1) {
            var c = candidates[i];
            c.x = MAREJIG_clamp(c.x, scene.world.x, scene.world.x + scene.world.width - width);
            c.y = MAREJIG_clamp(c.y, scene.world.y, scene.world.y + scene.world.height - height);
            if (MAREJIG_isFreeBounds(scene, { x: c.x, y: c.y, width: width, height: height }, ignoredIds, gap, allowBoard)) return c;
        }
        return { x: MAREJIG_clamp(origin.x - width / 2, scene.world.x, scene.world.x + scene.world.width - width), y: MAREJIG_clamp(origin.y - height / 2, scene.world.y, scene.world.y + scene.world.height - height) };
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
        var minX = scene.world.x;
        var maxX = scene.world.x + Math.max(0, scene.world.width - bounds.width);
        var minY = scene.world.y;
        var maxY = scene.world.y + Math.max(0, scene.world.height - bounds.height);
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


    function MAREJIG_placeInitialSegmentCentered(scene) {
        var groupIds = MAREJIG_getSegmentGroupIds(scene, scene.ui.activeSegmentId).filter(function MAREJIG_initialVisible(groupId) { return scene.groups[groupId] && scene.groups[groupId].visible && !scene.groups[groupId].positioned; });
        if (!groupIds.length) return null;
        var columns = Math.max(2, Math.ceil(Math.sqrt(groupIds.length)));
        var scale = scene.staging.pieceScale;
        var gap = Math.max(14, scale * 0.38);
        var visibleCenter = { x: scene.camera.x + scene.viewport.width / 2, y: scene.camera.y + scene.viewport.height / 2 };
        if (!scene.camera.x && !scene.camera.y) visibleCenter = { x: scene.world.width / 2, y: scene.world.height * 0.48 };
        var sizes = groupIds.map(function MAREJIG_measureInitial(groupId) {
            var group = scene.groups[groupId];
            var anchor = scene.puzzle.pieces[group.anchorPieceId || group.pieceIds[0]];
            return { id: groupId, width: Math.max(scale, anchor.bounds.w * scale), height: Math.max(scale, anchor.bounds.h * scale) };
        });
        var maxW = sizes.reduce(function MAREJIG_maxW(max, item) { return Math.max(max, item.width); }, scale);
        var maxH = sizes.reduce(function MAREJIG_maxH(max, item) { return Math.max(max, item.height); }, scale);
        var totalRows = Math.ceil(sizes.length / columns);
        var startX = visibleCenter.x - (columns * (maxW + gap) - gap) / 2;
        var startY = visibleCenter.y - (totalRows * (maxH + gap) - gap) / 2;
        sizes.forEach(function MAREJIG_placeInitial(item, index) {
            var group = scene.groups[item.id];
            var col = index % columns;
            var row = Math.floor(index / columns);
            var wobble = ((index % 2) - 0.5) * gap * 0.42;
            MAREJIG_moveGroupByBounds(scene, group, startX + col * (maxW + gap) + (maxW - item.width) / 2 + wobble, startY + row * (maxH + gap) + (maxH - item.height) / 2 - wobble);
            group.positioned = true;
            group.zIndex = (scene.progress.nextZIndex += 1);
            MAREJIG_clampGroupToWorld(scene, group);
        });
        return MAREJIG_getSegmentBounds(scene, scene.ui.activeSegmentId);
    }

    function MAREJIG_placeRevealedSegmentNearFocus(scene, segmentId, options) {
        var groupIds = MAREJIG_getSegmentGroupIds(scene, segmentId).filter(function MAREJIG_newVisible(groupId) { return scene.groups[groupId] && scene.groups[groupId].visible; });
        if (!groupIds.length) return null;
        var focus = MAREJIG_getMainFocusBounds(scene);
        var gap = Math.max(14, scene.staging.pieceScale * 0.34);
        var spacing = Math.max(scene.staging.pieceScale * 1.15, 48);
        var candidates = [
            { x: focus.x + focus.width + spacing, y: focus.y + focus.height * 0.45 },
            { x: focus.x + focus.width * 0.55, y: focus.y + focus.height + spacing },
            { x: focus.x - spacing, y: focus.y + focus.height * 0.45 },
            { x: focus.x + focus.width * 0.55, y: focus.y - spacing },
            { x: focus.x + focus.width + spacing, y: focus.y + focus.height + spacing }
        ];
        var placedBounds = [];
        groupIds.sort().forEach(function MAREJIG_placeRevealed(groupId, index) {
            var group = scene.groups[groupId];
            group.positioned = false;
            if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, groupId);
            var anchor = scene.puzzle.pieces[group.anchorPieceId || group.pieceIds[0]];
            var width = Math.max(scene.staging.pieceScale, anchor.bounds.w * scene.staging.pieceScale);
            var height = Math.max(scene.staging.pieceScale, anchor.bounds.h * scene.staging.pieceScale);
            var base = candidates[index % candidates.length];
            var origin = { x: base.x + (index % 3) * (width + gap) * 0.42, y: base.y + Math.floor(index / 3) * (height + gap) * 0.8 };
            var free = MAREJIG_findFreePosition(scene, width, height, origin, [groupId], { gap: gap, allowBoard: Boolean(options && options.allowBoard) });
            MAREJIG_moveGroupByBounds(scene, group, free.x, free.y);
            group.positioned = true;
            group.zIndex = (scene.progress.nextZIndex += 1);
            MAREJIG_clampGroupToWorld(scene, group);
            placedBounds.push(group.bounds);
        });
        MAREJIG_resolveAllPassiveOverlaps(scene, { limit: 2, ignoredDragging: null });
        return MAREJIG_unionBounds(placedBounds.concat([focus]));
    }

    function MAREJIG_focusCameraOnBounds(scene, bounds, options) {
        if (!scene || !bounds) return scene && scene.camera;
        var padding = Math.max(scene.staging.pieceScale * 0.75, Number(options && options.padding) || 42);
        var target = {
            x: bounds.x + bounds.width / 2 - scene.viewport.width / (2 * scene.camera.zoom),
            y: bounds.y + bounds.height / 2 - scene.viewport.height / (2 * scene.camera.zoom),
            zoom: scene.camera.zoom
        };
        target.x = MAREJIG_clamp(target.x - padding * 0.12, scene.world.x, Math.max(scene.world.x, scene.world.x + scene.world.width - scene.viewport.width / target.zoom));
        target.y = MAREJIG_clamp(target.y - padding * 0.06, scene.world.y, Math.max(scene.world.y, scene.world.y + scene.world.height - scene.viewport.height / target.zoom));
        scene.cameraTarget = target;
        return target;
    }

    function MAREJIG_resolveGroupOverlap(scene, groupId, options) {
        var group = scene && scene.groups ? scene.groups[groupId] : null;
        if (!group || !group.visible || (options && options.draggingGroupId === groupId)) return false;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, groupId);
        var bounds = group.bounds;
        var minArea = Math.max(1, bounds.width * bounds.height);
        var blockers = MAREJIG_getVisibleGroups(scene).filter(function MAREJIG_overlapBlocker(other) {
            if (!other.positioned || other.id === groupId || (options && options.draggingGroupId === other.id)) return false;
            var area = MAREJIG_overlapArea(bounds, other.bounds);
            var otherArea = Math.max(1, other.bounds.width * other.bounds.height);
            return area / Math.min(minArea, otherArea) > 0.10;
        });
        if (!blockers.length) return false;
        var union = MAREJIG_unionBounds(blockers.map(function MAREJIG_blockerBounds(other) { return other.bounds; }).concat([bounds]));
        var origins = [
            { x: union.x + union.width + bounds.width * 0.55, y: bounds.y + bounds.height / 2 },
            { x: union.x - bounds.width * 0.55, y: bounds.y + bounds.height / 2 },
            { x: bounds.x + bounds.width / 2, y: union.y + union.height + bounds.height * 0.55 },
            { x: bounds.x + bounds.width / 2, y: union.y - bounds.height * 0.55 }
        ];
        for (var i = 0; i < origins.length; i += 1) {
            var free = MAREJIG_findFreePosition(scene, bounds.width, bounds.height, origins[i], [groupId], { gap: Math.max(12, scene.staging.pieceScale * 0.28), allowBoard: true });
            var testBounds = { x: free.x, y: free.y, width: bounds.width, height: bounds.height };
            if (MAREJIG_isFreeBounds(scene, testBounds, [groupId], Math.max(8, scene.staging.pieceScale * 0.2), true)) {
                MAREJIG_moveGroupByBounds(scene, group, free.x, free.y);
                MAREJIG_clampGroupToWorld(scene, group);
                return true;
            }
        }
        return false;
    }

    function MAREJIG_resolveAllPassiveOverlaps(scene, options) {
        var changed = false;
        var limit = Math.max(1, Number(options && options.limit) || 3);
        for (var pass = 0; pass < limit; pass += 1) {
            var passChanged = false;
            MAREJIG_getVisibleGroups(scene).sort(function MAREJIG_smallFirst(a, b) { return (a.pieceIds.length || 0) - (b.pieceIds.length || 0); }).forEach(function MAREJIG_resolvePassive(group) {
                if (MAREJIG_resolveGroupOverlap(scene, group.id, { draggingGroupId: options && options.draggingGroupId })) passChanged = true;
            });
            changed = changed || passChanged;
            if (!passChanged) break;
        }
        return changed;
    }

    function MAREJIG_getIncorrectContact(scene, groupId) {
        var group = scene && scene.groups ? scene.groups[groupId] : null;
        if (!group || !group.visible) return null;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, groupId);
        var gap = Math.max(8, scene.staging.pieceScale * 0.22);
        var near = MAREJIG_getVisibleGroups(scene).filter(function MAREJIG_badContact(other) {
            return other.id !== groupId && other.visible && MAREJIG_boundsNear(group.bounds, other.bounds, gap);
        }).sort(function MAREJIG_contactSort(a, b) {
            return MAREJIG_overlapArea(group.bounds, b.bounds) - MAREJIG_overlapArea(group.bounds, a.bounds);
        })[0];
        if (!near) return null;
        return { groupId: groupId, targetGroupId: near.id, bounds: MAREJIG_unionBounds([group.bounds, near.bounds]), groupBounds: group.bounds, targetBounds: near.bounds };
    }

    function MAREJIG_markInvalidContact(scene, groupId, targetGroupId, options) {
        if (!scene.feedback) scene.feedback = {};
        scene.feedback.invalidContact = {
            groupId: groupId,
            targetGroupId: targetGroupId,
            startedAt: Date.now(),
            durationMs: Math.max(120, Number(options && options.durationMs) || 520),
            shakeDurationMs: Math.max(120, Number(options && options.shakeDurationMs) || 160),
            color: 'rgba(220, 95, 105, 0.85)'
        };
        scene.ui.dirty = true;
        return scene.feedback.invalidContact;
    }

    function MAREJIG_clearInvalidContact(scene, groupId) {
        if (!scene || !scene.feedback || !scene.feedback.invalidContact) return;
        var feedback = scene.feedback.invalidContact;
        if (!groupId || feedback.groupId === groupId || feedback.targetGroupId === groupId) {
            scene.feedback.invalidContact = null;
            scene.ui.dirty = true;
        }
    }

    function MAREJIG_layoutScene(scene, viewportWidth, viewportHeight) {
        var firstLayout = !scene.viewport.width || !scene.board.width;
        var oldCenter = firstLayout ? null : MAREJIG_screenToWorld(scene, { x: scene.viewport.width / 2, y: scene.viewport.height / 2 });
        var ratio = scene.board.cols / scene.board.rows;
        var portrait = viewportHeight >= viewportWidth;
        var boardWidth = portrait ? Math.max(viewportWidth * 1.25, Math.min(viewportWidth * 1.45, viewportWidth * 1.35)) : Math.max(viewportWidth * 0.82, viewportHeight * 0.78 * ratio);
        boardWidth = Math.min(boardWidth, 980);
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
            scene.board.y = Math.max(scene.world.safePadding * 2.2, scene.world.height * 0.14);
        }
        scene.staging.x = 0;
        scene.staging.y = 0;
        scene.staging.width = scene.world.width;
        scene.staging.height = scene.world.height;
        scene.staging.pieceScale = Math.max(28, scene.board.cellSize * 0.98);
        if (firstLayout) MAREJIG_placeInitialSegmentCentered(scene);
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
        MAREJIG_ensureVisibleGroups(scene);
        MAREJIG_resolveAllPassiveOverlaps(scene);
        return true;
    }

    function MAREJIG_getVisiblePieceIds(scene) { return Object.keys(scene.pieces).filter(function MAREJIG_isVisible(pieceId) { return scene.pieces[pieceId].visible; }); }

    windowObject.MAREJIG_Scene = Object.freeze({
        createScene: MAREJIG_createScene, layoutScene: MAREJIG_layoutScene, reflowScene: MAREJIG_reflowScene,
        ensureVisibleGroups: MAREJIG_ensureVisibleGroups, clampGroupToWorld: MAREJIG_clampGroupToWorld,
        clampCamera: MAREJIG_clampCamera, screenToWorld: MAREJIG_screenToWorld, worldToScreen: MAREJIG_worldToScreen,
        placeGroupNaturally: MAREJIG_placeGroupNaturally, placeRevealedSegmentNearFocus: MAREJIG_placeRevealedSegmentNearFocus,
        focusCameraOnBounds: MAREJIG_focusCameraOnBounds, getMainFocusBounds: MAREJIG_getMainFocusBounds,
        getSegmentBounds: MAREJIG_getSegmentBounds, resolveGroupOverlap: MAREJIG_resolveGroupOverlap,
        resolveAllPassiveOverlaps: MAREJIG_resolveAllPassiveOverlaps, getIncorrectContact: MAREJIG_getIncorrectContact,
        markInvalidContact: MAREJIG_markInvalidContact, clearInvalidContact: MAREJIG_clearInvalidContact,
        centerScene: MAREJIG_centerScene, applySave: MAREJIG_applySave, getVisiblePieceIds: MAREJIG_getVisiblePieceIds
    });
})(window);
