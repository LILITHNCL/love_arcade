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
                if (visited.size < Math.max(1, Math.floor(item.pieceIds.length * 0.7))) {
                    errors.push('Segmento poco coherente: ' + segmentId);
                }
            }
        });

        Object.keys(pieces).forEach(function MAREJIG_pieceAssigned(pieceId) {
            if (!seen[pieceId]) errors.push('Pieza sin segmento: ' + pieceId);
        });

        return { ok: errors.length === 0, errors: errors };
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
        getRevealedPieceIds: MAREJIG_getRevealedPieceIds,
        markSegmentRevealed: MAREJIG_markSegmentRevealed,
        markSegmentCompleted: MAREJIG_markSegmentCompleted
    });
})(window);
