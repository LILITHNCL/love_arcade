(function MAREJIG_segmentsModule(windowObject) {
    'use strict';

    function MAREJIG_buildNeighborMap(pieces, adjacency) {
        var map = Object.create(null);
        Object.keys(pieces).forEach(function MAREJIG_initNeighbors(pieceId) {
            map[pieceId] = [];
        });
        adjacency.forEach(function MAREJIG_addEdge(edge) {
            if (map[edge.a]) map[edge.a].push(edge.b);
            if (map[edge.b]) map[edge.b].push(edge.a);
        });
        Object.keys(map).forEach(function MAREJIG_sortNeighbors(pieceId) {
            map[pieceId].sort();
        });
        return map;
    }

    function MAREJIG_adjustPlan(segmentPlan, pieceCount) {
        var plan = (Array.isArray(segmentPlan) && segmentPlan.length ? segmentPlan.slice() : [10, 10, 12, 12, 16])
            .filter(function MAREJIG_positiveSegment(size) { return size > 0; });
        var total = plan.reduce(function MAREJIG_sum(totalSoFar, size) { return totalSoFar + size; }, 0);
        var diff = pieceCount - total;
        var cursor = plan.length - 1;

        while (diff !== 0 && plan.length > 0) {
            if (diff > 0) {
                plan[cursor] += 1;
                diff -= 1;
            } else if (plan[cursor] > 1) {
                plan[cursor] -= 1;
                diff += 1;
            }
            cursor -= 1;
            if (cursor < 0) cursor = plan.length - 1;
        }

        return plan.filter(function MAREJIG_nonEmpty(size) { return size > 0; });
    }

    function MAREJIG_pickSeed(unassigned, assigned, neighborMap, rng) {
        var candidates = unassigned.filter(function MAREJIG_touchesAssigned(pieceId) {
            if (assigned.size === 0) return false;
            return neighborMap[pieceId].some(function MAREJIG_neighborAssigned(neighborId) {
                return assigned.has(neighborId);
            });
        });
        var pool = candidates.length ? candidates : unassigned;
        return pool[Math.floor(rng() * pool.length)];
    }

    function MAREJIG_growSegment(seed, targetSize, unassignedSet, neighborMap, rng) {
        var segment = [seed];
        var segmentSet = new Set([seed]);
        unassignedSet.delete(seed);

        while (segment.length < targetSize) {
            var frontier = [];
            segment.forEach(function MAREJIG_collectFrontier(pieceId) {
                neighborMap[pieceId].forEach(function MAREJIG_maybeFrontier(neighborId) {
                    if (unassignedSet.has(neighborId) && segmentSet.has(neighborId) === false && frontier.indexOf(neighborId) === -1) {
                        frontier.push(neighborId);
                    }
                });
            });

            if (!frontier.length) break;
            frontier.sort();
            var next = frontier[Math.floor(rng() * frontier.length)];
            segment.push(next);
            segmentSet.add(next);
            unassignedSet.delete(next);
        }

        return segment;
    }

    function MAREJIG_buildSegments(pieces, adjacency, segmentPlan, rng) {
        var pieceIds = Object.keys(pieces).sort();
        var plan = MAREJIG_adjustPlan(segmentPlan, pieceIds.length);
        var neighborMap = MAREJIG_buildNeighborMap(pieces, adjacency);
        var unassignedSet = new Set(pieceIds);
        var assigned = new Set();
        var order = [];
        var items = {};
        var random = typeof rng === 'function' ? rng : Math.random;

        plan.forEach(function MAREJIG_createSegment(targetSize, index) {
            var id = 's_' + index;
            var unassigned = Array.from(unassignedSet).sort();
            if (!unassigned.length) return;
            var seed = MAREJIG_pickSeed(unassigned, assigned, neighborMap, random);
            var segmentPieceIds = MAREJIG_growSegment(seed, targetSize, unassignedSet, neighborMap, random);

            segmentPieceIds.forEach(function MAREJIG_markAssigned(pieceId) {
                assigned.add(pieceId);
                pieces[pieceId].segmentId = id;
                pieces[pieceId].revealed = index === 0;
            });

            order.push(id);
            items[id] = {
                id: id,
                pieceIds: segmentPieceIds,
                revealed: index === 0,
                completed: false
            };
        });

        if (unassignedSet.size > 0) {
            var lastId = order[order.length - 1] || 's_0';
            if (!items[lastId]) {
                order.push(lastId);
                items[lastId] = { id: lastId, pieceIds: [], revealed: true, completed: false };
            }
            Array.from(unassignedSet).sort().forEach(function MAREJIG_assignRemainder(pieceId) {
                items[lastId].pieceIds.push(pieceId);
                pieces[pieceId].segmentId = lastId;
                pieces[pieceId].revealed = items[lastId].revealed;
                unassignedSet.delete(pieceId);
            });
        }

        return {
            currentSegmentIndex: 0,
            order: order,
            items: items
        };
    }

    function MAREJIG_validateSegments(segments, pieces, adjacency) {
        var errors = [];
        var seen = Object.create(null);
        var neighborMap = MAREJIG_buildNeighborMap(pieces, adjacency || []);

        if (!segments || !Array.isArray(segments.order) || !segments.items) {
            return { ok: false, errors: ['Segmentos ausentes'] };
        }

        segments.order.forEach(function MAREJIG_validateSegment(segmentId, index) {
            var item = segments.items[segmentId];
            if (!item) {
                errors.push('Segmento faltante: ' + segmentId);
                return;
            }
            if (!item.pieceIds || item.pieceIds.length === 0) errors.push('Segmento vacío: ' + segmentId);
            if (index === 0 && item.revealed !== true) errors.push('s_0 no revelado inicialmente');
            if (index > 0 && item.revealed === true) errors.push('Segmento futuro revelado: ' + segmentId);

            item.pieceIds.forEach(function MAREJIG_checkPiece(pieceId) {
                if (!pieces[pieceId]) errors.push('Segmento referencia pieza inexistente: ' + pieceId);
                if (seen[pieceId]) errors.push('Pieza asignada a múltiples segmentos: ' + pieceId);
                seen[pieceId] = segmentId;
                if (pieces[pieceId] && pieces[pieceId].segmentId !== segmentId) errors.push('segmentId inconsistente: ' + pieceId);
            });

            if (item.pieceIds.length > 1) {
                var segmentSet = new Set(item.pieceIds);
                var visited = new Set([item.pieceIds[0]]);
                var queue = [item.pieceIds[0]];
                while (queue.length) {
                    var current = queue.shift();
                    neighborMap[current].forEach(function MAREJIG_visitNeighbor(neighborId) {
                        if (segmentSet.has(neighborId) && !visited.has(neighborId)) {
                            visited.add(neighborId);
                            queue.push(neighborId);
                        }
                    });
                }
                if (visited.size < Math.max(1, Math.floor(item.pieceIds.length * 0.5))) {
                    errors.push('Segmento poco coherente: ' + segmentId);
                }
            }
        });

        Object.keys(pieces).forEach(function MAREJIG_pieceAssigned(pieceId) {
            if (!seen[pieceId]) errors.push('Pieza sin segmento: ' + pieceId);
        });

        return { ok: errors.length === 0, errors: errors };
    }



    function MAREJIG_createRng(seedText) {
        var text = String(seedText || 'segment');
        var hash = 2166136261;
        for (var i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        var state = hash >>> 0;
        return function MAREJIG_segmentRng() {
            state += 0x6D2B79F5;
            var t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function MAREJIG_getActiveSegmentId(segments) {
        if (!segments || !segments.order || !segments.order.length) return null;
        return segments.order[Math.min(segments.currentSegmentIndex || 0, segments.order.length - 1)];
    }

    function MAREJIG_countConnectedInSegment(scene, segmentId) {
        var segment = scene && scene.puzzle && scene.puzzle.segments ? scene.puzzle.segments.items[segmentId] : null;
        if (!segment) return 0;
        var mainGroupId = scene.progress && scene.progress.mainGroupId;
        if (!mainGroupId) {
            var firstPiece = scene.pieces[segment.pieceIds[0]];
            var firstGroupId = firstPiece ? firstPiece.groupId : null;
            return segment.pieceIds.filter(function MAREJIG_pieceInFirstGroup(pieceId) {
                return scene.pieces[pieceId] && scene.pieces[pieceId].groupId === firstGroupId;
            }).length;
        }
        return segment.pieceIds.filter(function MAREJIG_pieceInMainGroup(pieceId) {
            return scene.pieces[pieceId] && scene.pieces[pieceId].groupId === mainGroupId;
        }).length;
    }

    function MAREJIG_isActiveSegmentComplete(scene) {
        var segments = scene && scene.puzzle ? scene.puzzle.segments : null;
        var activeSegmentId = MAREJIG_getActiveSegmentId(segments);
        var segment = activeSegmentId ? segments.items[activeSegmentId] : null;
        if (!segment || segment.completed) return false;
        if (!segment.pieceIds.length) return true;
        if ((segments.currentSegmentIndex || 0) === 0 && !scene.progress.mainGroupId) {
            var firstGroupId = scene.pieces[segment.pieceIds[0]] && scene.pieces[segment.pieceIds[0]].groupId;
            return segment.pieceIds.every(function MAREJIG_pieceInS0Group(pieceId) {
                return scene.pieces[pieceId] && scene.pieces[pieceId].groupId === firstGroupId;
            });
        }
        return segment.pieceIds.every(function MAREJIG_pieceInMain(pieceId) {
            return scene.pieces[pieceId] && scene.pieces[pieceId].groupId === scene.progress.mainGroupId;
        });
    }

    function MAREJIG_placeRevealedGroup(scene, group, segmentId, index, count) {
        var rng = MAREJIG_createRng(String(scene.puzzle.seed) + ':' + segmentId + ':' + group.id);
        var columns = Math.max(2, Math.min(6, count || 2));
        var rows = Math.max(1, Math.ceil(count / columns));
        var slotW = scene.staging.width / columns;
        var slotH = Math.max(1, (scene.staging.height - 20) / rows);
        var piece = scene.puzzle.pieces[group.pieceIds[0]];
        var scale = scene.staging.pieceScale || scene.board.cellSize || 24;
        var col = index % columns;
        var row = Math.floor(index / columns);
        var pieceW = piece.bounds.w * scale;
        var pieceH = piece.bounds.h * scale;
        group.x = scene.staging.x + col * slotW + Math.max(10, (slotW - pieceW) / 2) + (rng() - 0.5) * Math.min(16, slotW * 0.12);
        group.y = scene.staging.y + 18 + row * slotH + Math.max(0, (slotH - pieceH) / 2) + (rng() - 0.5) * Math.min(6, slotH * 0.06);
        group.zIndex = (scene.progress.nextZIndex += 1);
        group.laneIndex = index;
        group.visible = true;
        group.outlineDirty = true;
        group.groupOutline = null;
    }

    function MAREJIG_revealSegment(scene, segmentId) {
        var segment = scene && scene.puzzle && scene.puzzle.segments ? scene.puzzle.segments.items[segmentId] : null;
        if (!segment || segment.revealed) return [];
        segment.revealed = true;
        var newGroupIds = [];
        segment.pieceIds.forEach(function MAREJIG_revealPiece(pieceId) {
            if (scene.puzzle.pieces[pieceId]) scene.puzzle.pieces[pieceId].revealed = true;
            if (scene.pieces[pieceId]) scene.pieces[pieceId].visible = true;
            var groupId = scene.pieces[pieceId] && scene.pieces[pieceId].groupId;
            if (groupId && scene.groups[groupId]) {
                scene.groups[groupId].visible = true;
                if (newGroupIds.indexOf(groupId) === -1) newGroupIds.push(groupId);
            }
        });
        newGroupIds.sort().forEach(function MAREJIG_placeGroup(groupId, index) {
            MAREJIG_placeRevealedGroup(scene, scene.groups[groupId], segmentId, index, newGroupIds.length);
            if (windowObject.MAREJIG_Groups) {
                windowObject.MAREJIG_Groups.invalidateGroupOutline(scene, groupId);
                windowObject.MAREJIG_Groups.recalculateGroupBounds(scene, groupId);
            }
        });
        return newGroupIds;
    }

    function MAREJIG_updateMainGroupAfterMerge(scene, mergedGroupId, previousIds) {
        if (!scene || !scene.progress) return;
        if (!scene.progress.mainGroupId) return;
        if (previousIds && previousIds.indexOf(scene.progress.mainGroupId) !== -1) {
            scene.progress.mainGroupId = mergedGroupId;
        }
    }

    function MAREJIG_advanceIfSegmentComplete(scene) {
        var segments = scene && scene.puzzle ? scene.puzzle.segments : null;
        var activeSegmentId = MAREJIG_getActiveSegmentId(segments);
        if (!activeSegmentId || !MAREJIG_isActiveSegmentComplete(scene)) return { completed: false, revealed: null, puzzleComplete: false };

        var activeSegment = segments.items[activeSegmentId];
        if (activeSegment.completed) return { completed: false, revealed: null, puzzleComplete: false };
        activeSegment.completed = true;
        if (!scene.progress.mainGroupId) {
            scene.progress.mainGroupId = scene.pieces[activeSegment.pieceIds[0]].groupId;
        }
        scene.progress.status = 'Segmento completado';
        scene.ui.message = 'Segmento completado';
        scene.ui.messageStartedAt = Date.now();

        if ((segments.currentSegmentIndex || 0) >= segments.order.length - 1) {
            scene.progress.puzzleCompletedLocal = true;
            scene.progress.status = 'Puzzle completo local';
            scene.ui.message = 'Puzzle completo local';
            return { completed: true, revealed: null, puzzleComplete: true };
        }

        segments.currentSegmentIndex += 1;
        var nextSegmentId = segments.order[segments.currentSegmentIndex];
        MAREJIG_revealSegment(scene, nextSegmentId);
        scene.ui.activeSegmentId = nextSegmentId;
        scene.ui.message = 'Segmento desbloqueado';
        scene.ui.messageStartedAt = Date.now();
        if (scene.ui) scene.ui.dirty = true;
        return { completed: true, revealed: nextSegmentId, puzzleComplete: false };
    }

    function MAREJIG_getSegmentStats(scene) {
        var segments = scene && scene.puzzle ? scene.puzzle.segments : null;
        var activeSegmentId = MAREJIG_getActiveSegmentId(segments);
        var activeSegment = activeSegmentId ? segments.items[activeSegmentId] : null;
        return {
            activeSegmentId: activeSegmentId,
            activeSegmentIndex: segments ? segments.currentSegmentIndex || 0 : 0,
            totalSegments: segments ? segments.order.length : 0,
            connectedInSegment: activeSegmentId ? MAREJIG_countConnectedInSegment(scene, activeSegmentId) : 0,
            activeSegmentPieceCount: activeSegment ? activeSegment.pieceIds.length : 0
        };
    }

    function MAREJIG_getRevealedPieceIds(segments) {
        var ids = [];
        segments.order.forEach(function MAREJIG_collectRevealed(segmentId) {
            var item = segments.items[segmentId];
            if (item && item.revealed) ids = ids.concat(item.pieceIds);
        });
        return ids;
    }

    function MAREJIG_markSegmentRevealed(segments, segmentId) {
        if (segments.items[segmentId]) segments.items[segmentId].revealed = true;
        return segments;
    }

    function MAREJIG_markSegmentCompleted(segments, segmentId) {
        if (segments.items[segmentId]) segments.items[segmentId].completed = true;
        return segments;
    }

    windowObject.MAREJIG_Segments = Object.freeze({
        buildSegments: MAREJIG_buildSegments,
        validateSegments: MAREJIG_validateSegments,
        getActiveSegmentId: MAREJIG_getActiveSegmentId,
        isActiveSegmentComplete: MAREJIG_isActiveSegmentComplete,
        advanceIfSegmentComplete: MAREJIG_advanceIfSegmentComplete,
        revealSegment: MAREJIG_revealSegment,
        getSegmentStats: MAREJIG_getSegmentStats,
        updateMainGroupAfterMerge: MAREJIG_updateMainGroupAfterMerge,
        getRevealedPieceIds: MAREJIG_getRevealedPieceIds,
        markSegmentRevealed: MAREJIG_markSegmentRevealed,
        markSegmentCompleted: MAREJIG_markSegmentCompleted
    });
})(window);
