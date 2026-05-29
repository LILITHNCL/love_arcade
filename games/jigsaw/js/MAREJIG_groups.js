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
                lockedToBoard: false
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

    function MAREJIG_mergeGroups(groups, pieces, sourceGroupId, targetGroupId) {
        var source = groups[sourceGroupId];
        var target = groups[targetGroupId];
        if (!source || !target || sourceGroupId === targetGroupId) return groups;

        source.pieceIds.forEach(function MAREJIG_movePiece(pieceId) {
            if (target.pieceIds.indexOf(pieceId) === -1) target.pieceIds.push(pieceId);
            if (pieces[pieceId]) pieces[pieceId].groupId = targetGroupId;
        });
        target.pieceIds.sort();
        delete groups[sourceGroupId];
        return groups;
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
        validateGroups: MAREJIG_validateGroups
    });
})(window);
