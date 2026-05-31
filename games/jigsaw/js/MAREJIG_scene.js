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
            feedback: { invalidContact: null },
            performance: { isDragging: false, isPanning: false, isCameraAnimating: false }
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


    function MAREJIG_getCompactClusterItems(scene, segmentId, options) {
        var requested = options && options.groupIds;
        return MAREJIG_getSegmentGroupIds(scene, segmentId).filter(function MAREJIG_compactVisible(groupId) {
            return scene.groups[groupId] && scene.groups[groupId].visible && (!requested || requested.indexOf(groupId) !== -1);
        }).map(function MAREJIG_measureCompact(groupId) {
            var group = scene.groups[groupId];
            if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, groupId);
            return { id: groupId, width: Math.max(scene.staging.pieceScale, group.bounds.width), height: Math.max(scene.staging.pieceScale, group.bounds.height) };
        }).sort(function MAREJIG_largestCompactFirst(a, b) { return (b.width * b.height) - (a.width * a.height) || a.id.localeCompare(b.id); });
    }

    function MAREJIG_placeSegmentAsCompactCluster(scene, segmentId, focusBounds, options) {
        var items = MAREJIG_getCompactClusterItems(scene, segmentId, options);
        if (!items.length) return null;
        var margin = MAREJIG_clamp(scene.board.cellSize * 0.24, 10, 18);
        var jitter = MAREJIG_clamp(scene.board.cellSize * 0.12, 4, 8);
        var maxW = items.reduce(function MAREJIG_compactMaxW(max, item) { return Math.max(max, item.width); }, 0);
        var maxH = items.reduce(function MAREJIG_compactMaxH(max, item) { return Math.max(max, item.height); }, 0);
        var columns = Math.max(2, Math.ceil(Math.sqrt(items.length * 1.4)));
        var rows = Math.ceil(items.length / columns);
        if (rows > 3) { rows = 3; columns = Math.ceil(items.length / rows); }
        var slotW = maxW + margin + jitter * 2;
        var slotH = maxH + margin + jitter * 2;
        while (columns > Math.ceil(items.length / 3) && columns * slotW - margin > scene.viewport.width * 0.95) columns -= 1;
        rows = Math.ceil(items.length / columns);
        var clusterW = columns * slotW - margin;
        var clusterH = rows * slotH - margin;
        var comfort = Math.max(20, scene.board.cellSize * 0.62);
        var world = scene.world;
        var center = { x: scene.camera.x + scene.viewport.width / (2 * scene.camera.zoom), y: scene.camera.y + scene.viewport.height / (2 * scene.camera.zoom) };
        if (!scene.camera.x && !scene.camera.y) center = { x: world.x + world.width / 2, y: world.y + world.height * 0.48 };
        var focus = focusBounds || null;
        var candidates = focus ? [
            { x: focus.x + focus.width / 2 - clusterW / 2, y: focus.y + focus.height + comfort },
            { x: focus.x + focus.width + comfort, y: focus.y + focus.height / 2 - clusterH / 2 },
            { x: focus.x - clusterW - comfort, y: focus.y + focus.height / 2 - clusterH / 2 },
            { x: focus.x + focus.width / 2 - clusterW / 2, y: focus.y - clusterH - comfort }
        ] : [{ x: center.x - clusterW / 2, y: center.y - clusterH / 2 }];
        var ignored = items.map(function MAREJIG_compactId(item) { return item.id; });
        function MAREJIG_clampCluster(candidate) {
            return { x: MAREJIG_clamp(candidate.x, world.x, Math.max(world.x, world.x + world.width - clusterW)), y: MAREJIG_clamp(candidate.y, world.y, Math.max(world.y, world.y + world.height - clusterH)) };
        }
        function MAREJIG_clusterCollision(candidate) {
            return MAREJIG_getVisibleGroups(scene).some(function MAREJIG_compactBlocker(group) {
                return group.positioned && ignored.indexOf(group.id) === -1 && MAREJIG_boundsOverlap({ x: candidate.x, y: candidate.y, width: clusterW, height: clusterH }, group.bounds, margin * 0.35);
            });
        }
        var start = MAREJIG_clampCluster(candidates[0]);
        for (var c = 0; c < candidates.length; c += 1) {
            var candidate = MAREJIG_clampCluster(candidates[c]);
            if (!MAREJIG_clusterCollision(candidate)) { start = candidate; break; }
        }
        var seed = (scene.puzzle.seed ^ String(segmentId).split('').reduce(function MAREJIG_clusterHash(hash, char) { return Math.imul(hash ^ char.charCodeAt(0), 16777619); }, 2166136261)) >>> 0;
        var rng = MAREJIG_createRng(seed);
        var placed = [];
        items.forEach(function MAREJIG_placeCompact(item, index) {
            var group = scene.groups[item.id];
            var col = index % columns;
            var row = Math.floor(index / columns);
            var offsetX = (rng() * 2 - 1) * jitter;
            var offsetY = (rng() * 2 - 1) * jitter;
            MAREJIG_moveGroupByBounds(scene, group, start.x + col * slotW + (maxW - item.width) / 2 + offsetX, start.y + row * slotH + (maxH - item.height) / 2 + offsetY);
            group.positioned = true;
            group.zIndex = (scene.progress.nextZIndex += 1);
            MAREJIG_clampGroupToWorld(scene, group);
            placed.push(group.bounds);
        });
        var clusterBounds = MAREJIG_unionBounds(placed);
        if (scene.ui) scene.ui.lastClusterBounds = clusterBounds;
        return focus ? MAREJIG_unionBounds([focus, clusterBounds]) : clusterBounds;
    }

    function MAREJIG_placeInitialSegmentCentered(scene) {
        return MAREJIG_placeSegmentAsCompactCluster(scene, scene.ui.activeSegmentId, null, { initial: true });
    }

    function MAREJIG_placeRevealedSegmentNearFocus(scene, segmentId, options) {
        return MAREJIG_placeSegmentAsCompactCluster(scene, segmentId, MAREJIG_getMainFocusBounds(scene), options || {});
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

    function MAREJIG_insetBounds(bounds, inset) {
        var safeInset = Math.max(0, Math.min(inset, bounds.width * 0.24, bounds.height * 0.24));
        return { x: bounds.x + safeInset, y: bounds.y + safeInset, width: Math.max(0, bounds.width - safeInset * 2), height: Math.max(0, bounds.height - safeInset * 2) };
    }

    function MAREJIG_hasSignificantOverlap(scene, a, b) {
        var inset = Math.min(10, scene.board.cellSize * 0.18);
        var aa = MAREJIG_insetBounds(a, inset);
        var bb = MAREJIG_insetBounds(b, inset);
        var overlapW = Math.max(0, Math.min(aa.x + aa.width, bb.x + bb.width) - Math.max(aa.x, bb.x));
        var overlapH = Math.max(0, Math.min(aa.y + aa.height, bb.y + bb.height) - Math.max(aa.y, bb.y));
        var ratio = (overlapW * overlapH) / Math.max(1, Math.min(aa.width * aa.height, bb.width * bb.height));
        var visible = Math.max(6, scene.board.cellSize * 0.16);
        return ratio >= 0.22 || (overlapW >= visible && overlapH >= visible);
    }

    function MAREJIG_findNearbyFreePosition(scene, groupId, origin, options) {
        var group = scene && scene.groups ? scene.groups[groupId] : null;
        if (!group) return null;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, groupId);
        var bounds = group.bounds;
        var radii = [12, 24, 40, 64, 88, 120];
        var world = scene.world;
        var best = { x: origin.x, y: origin.y };
        function MAREJIG_nearbyCandidate(x, y) {
            var candidate = { x: MAREJIG_clamp(x, world.x, Math.max(world.x, world.x + world.width - bounds.width)), y: MAREJIG_clamp(y, world.y, Math.max(world.y, world.y + world.height - bounds.height)), width: bounds.width, height: bounds.height };
            var blocked = MAREJIG_getVisibleGroups(scene).some(function MAREJIG_nearbyBlocker(other) {
                if (other.id === groupId || !other.positioned) return false;
                var ratio = MAREJIG_overlapArea(candidate, other.bounds) / Math.max(1, Math.min(candidate.width * candidate.height, other.bounds.width * other.bounds.height));
                return ratio >= 0.08 || MAREJIG_hasSignificantOverlap(scene, candidate, other.bounds);
            });
            return blocked ? null : candidate;
        }
        var direct = MAREJIG_nearbyCandidate(origin.x, origin.y);
        if (direct) return direct;
        for (var r = 0; r < radii.length; r += 1) {
            for (var step = 0; step < 12; step += 1) {
                var angle = (Math.PI * 2 * step) / 12;
                var found = MAREJIG_nearbyCandidate(origin.x + Math.cos(angle) * radii[r], origin.y + Math.sin(angle) * radii[r]);
                if (found) return found;
            }
        }
        return best;
    }

    function MAREJIG_resolveGroupOverlap(scene, groupId, options) {
        var group = scene && scene.groups ? scene.groups[groupId] : null;
        if (!group || !group.visible || (options && options.draggingGroupId === groupId)) return false;
        if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, groupId);
        var bounds = group.bounds;
        var blocked = MAREJIG_getVisibleGroups(scene).some(function MAREJIG_overlapBlocker(other) {
            return other.positioned && other.id !== groupId && (!options || options.draggingGroupId !== other.id) && MAREJIG_hasSignificantOverlap(scene, bounds, other.bounds);
        });
        if (!blocked) return false;
        var free = MAREJIG_findNearbyFreePosition(scene, groupId, { x: bounds.x, y: bounds.y }, options);
        if (!free || (free.x === bounds.x && free.y === bounds.y)) return false;
        MAREJIG_moveGroupByBounds(scene, group, free.x, free.y);
        MAREJIG_clampGroupToWorld(scene, group);
        return true;
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
        var gap = scene.board.cellSize * 0.15;
        var near = MAREJIG_getVisibleGroups(scene).filter(function MAREJIG_badContact(other) {
            if (other.id === groupId || !other.visible) return false;
            var separationX = Math.max(0, other.bounds.x - (group.bounds.x + group.bounds.width), group.bounds.x - (other.bounds.x + other.bounds.width));
            var separationY = Math.max(0, other.bounds.y - (group.bounds.y + group.bounds.height), group.bounds.y - (other.bounds.y + other.bounds.height));
            return MAREJIG_overlapArea(group.bounds, other.bounds) > 0 || Math.hypot(separationX, separationY) < gap;
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
        var portraitScale = scene.board.cols >= 16 ? 1.45 : 1.35;
        var boardWidth = portrait ? viewportWidth * portraitScale : Math.max(viewportWidth * 0.82, viewportHeight * 0.78 * ratio);
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
        placeGroupNaturally: MAREJIG_placeGroupNaturally, placeSegmentAsCompactCluster: MAREJIG_placeSegmentAsCompactCluster, placeRevealedSegmentNearFocus: MAREJIG_placeRevealedSegmentNearFocus,
        focusCameraOnBounds: MAREJIG_focusCameraOnBounds, getMainFocusBounds: MAREJIG_getMainFocusBounds,
        getSegmentBounds: MAREJIG_getSegmentBounds, findNearbyFreePosition: MAREJIG_findNearbyFreePosition, resolveGroupOverlap: MAREJIG_resolveGroupOverlap,
        resolveAllPassiveOverlaps: MAREJIG_resolveAllPassiveOverlaps, getIncorrectContact: MAREJIG_getIncorrectContact,
        markInvalidContact: MAREJIG_markInvalidContact, clearInvalidContact: MAREJIG_clearInvalidContact,
        centerScene: MAREJIG_centerScene, applySave: MAREJIG_applySave, getVisiblePieceIds: MAREJIG_getVisiblePieceIds
    });
})(window);
