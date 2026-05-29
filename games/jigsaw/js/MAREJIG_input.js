(function MAREJIG_inputModule(windowObject) {
    'use strict';

    var MAREJIG_Groups = windowObject.MAREJIG_Groups;

    var MAREJIG_inputState = {
        pointerId: null,
        mode: 'idle',
        selectedGroupId: null,
        dragStart: { x: 0, y: 0 },
        groupStart: { x: 0, y: 0 },
        lastPointer: { x: 0, y: 0 },
        moved: false
    };

    var MAREJIG_context = {
        canvas: null,
        scene: null,
        renderer: null,
        callbacks: {},
        pointers: new Map(),
        handlers: null
    };

    function MAREJIG_canvasPoint(event) {
        var rect = MAREJIG_context.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    function MAREJIG_resetState(keepSelection) {
        MAREJIG_inputState.pointerId = null;
        MAREJIG_inputState.mode = 'idle';
        if (!keepSelection) MAREJIG_inputState.selectedGroupId = null;
        MAREJIG_inputState.dragStart = { x: 0, y: 0 };
        MAREJIG_inputState.groupStart = { x: 0, y: 0 };
        MAREJIG_inputState.lastPointer = { x: 0, y: 0 };
        MAREJIG_inputState.moved = false;
    }

    function MAREJIG_selectGroup(scene, groupId) {
        if (!scene || !groupId) return;
        MAREJIG_Groups.bringGroupToFront(scene, groupId);
        MAREJIG_inputState.selectedGroupId = groupId;
        if (scene.ui) scene.ui.selectedGroupId = groupId;
        if (MAREJIG_context.renderer) MAREJIG_context.renderer.markDirty('select');
        if (MAREJIG_context.callbacks && typeof MAREJIG_context.callbacks.onSelect === 'function') {
            MAREJIG_context.callbacks.onSelect(groupId);
        }
    }

    function MAREJIG_onPointerDown(event) {
        var scene = MAREJIG_context.scene;
        if (!scene || !MAREJIG_context.canvas) return;
        if (scene.progress && (scene.progress.gamePhase === 'completing' || scene.progress.gamePhase === 'completed')) return;
        MAREJIG_context.pointers.set(event.pointerId, MAREJIG_canvasPoint(event));
        if (MAREJIG_context.pointers.size > 1) {
            MAREJIG_inputState.mode = 'pinching';
            MAREJIG_inputState.pointerId = null;
            if (MAREJIG_context.canvas.releasePointerCapture) {
                try { MAREJIG_context.canvas.releasePointerCapture(event.pointerId); } catch (captureError) { /* noop */ }
            }
            return;
        }

        var point = MAREJIG_canvasPoint(event);
        var hit = MAREJIG_Groups.hitTest(scene, point);
        if (!hit) {
            if (scene.ui) scene.ui.selectedGroupId = null;
            MAREJIG_resetState(false);
            if (MAREJIG_context.renderer) MAREJIG_context.renderer.markDirty('deselect');
            return;
        }

        event.preventDefault();
        if (windowObject.MAREJIG_Hints && windowObject.MAREJIG_Hints.clearHint(scene) && MAREJIG_context.renderer) {
            MAREJIG_context.renderer.markDirty('hint-clear-drag');
        }
        if (MAREJIG_context.canvas.setPointerCapture) {
            try { MAREJIG_context.canvas.setPointerCapture(event.pointerId); } catch (captureError) { /* noop */ }
        }
        MAREJIG_selectGroup(scene, hit.groupId);
        MAREJIG_inputState.pointerId = event.pointerId;
        MAREJIG_inputState.mode = 'dragging';
        MAREJIG_inputState.dragStart = point;
        MAREJIG_inputState.lastPointer = point;
        MAREJIG_inputState.groupStart = { x: hit.group.x, y: hit.group.y };
        MAREJIG_inputState.moved = false;
    }

    function MAREJIG_onPointerMove(event) {
        var scene = MAREJIG_context.scene;
        if (!scene) return;
        if (scene.progress && (scene.progress.gamePhase === 'completing' || scene.progress.gamePhase === 'completed')) return;
        var point = MAREJIG_canvasPoint(event);
        MAREJIG_context.pointers.set(event.pointerId, point);
        if (MAREJIG_inputState.mode === 'pinching') return;
        if (event.pointerId !== MAREJIG_inputState.pointerId || MAREJIG_inputState.mode !== 'dragging') return;
        var group = scene.groups[MAREJIG_inputState.selectedGroupId];
        if (!group) return;
        var dx = point.x - MAREJIG_inputState.dragStart.x;
        var dy = point.y - MAREJIG_inputState.dragStart.y;
        var moved = Math.sqrt(dx * dx + dy * dy) > 4;
        if (moved) MAREJIG_inputState.moved = true;
        group.x = MAREJIG_inputState.groupStart.x + dx;
        group.y = MAREJIG_inputState.groupStart.y + dy;
        MAREJIG_inputState.lastPointer = point;
        MAREJIG_Groups.recalculateGroupBounds(scene, group.id);
        if (MAREJIG_context.renderer) MAREJIG_context.renderer.markDirty('drag');
        event.preventDefault();
    }

    function MAREJIG_tryHaptic() {
        var settings = windowObject.MAREJIG_Storage && windowObject.MAREJIG_Storage.getSettings ? windowObject.MAREJIG_Storage.getSettings() : { haptics: true };
        if (settings.haptics !== false && windowObject.navigator && typeof windowObject.navigator.vibrate === 'function') {
            windowObject.navigator.vibrate(12);
        }
    }

    function MAREJIG_onPointerUp(event) {
        var scene = MAREJIG_context.scene;
        MAREJIG_context.pointers.delete(event.pointerId);
        if (!scene) {
            MAREJIG_resetState(true);
            return;
        }
        if (scene.progress && (scene.progress.gamePhase === 'completing' || scene.progress.gamePhase === 'completed')) {
            MAREJIG_resetState(true);
            return;
        }
        if (MAREJIG_inputState.mode === 'pinching') {
            if (MAREJIG_context.pointers.size === 0) MAREJIG_resetState(true);
            return;
        }
        if (event.pointerId !== MAREJIG_inputState.pointerId || MAREJIG_inputState.mode !== 'dragging') return;
        var groupId = MAREJIG_inputState.selectedGroupId;
        var didMove = MAREJIG_inputState.moved;
        var candidate = null;
        var merged = null;
        if (didMove && groupId && scene.groups[groupId]) {
            scene.progress.startedAt = scene.progress.startedAt || Date.now();
            scene.progress.moves += 1;
            candidate = MAREJIG_Groups.findSnapCandidate(scene, groupId, { isTouch: event.pointerType !== 'mouse' });
            if (candidate) {
                var previousIds = [candidate.sourceGroupId, candidate.targetGroupId];
                merged = MAREJIG_Groups.applySnap(scene, groupId, candidate);
                if (merged && windowObject.MAREJIG_Segments) {
                    windowObject.MAREJIG_Segments.updateMainGroupAfterMerge(scene, merged.id, previousIds);
                }
                MAREJIG_tryHaptic();
            }
            if (MAREJIG_context.callbacks && typeof MAREJIG_context.callbacks.onMoveEnd === 'function') {
                MAREJIG_context.callbacks.onMoveEnd({ moved: didMove, groupId: groupId, candidate: candidate, mergedGroupId: merged && merged.id });
            }
        }
        MAREJIG_resetState(true);
        if (merged) MAREJIG_inputState.selectedGroupId = merged.id;
        if (scene.ui) scene.ui.selectedGroupId = MAREJIG_inputState.selectedGroupId;
        if (MAREJIG_context.renderer) MAREJIG_context.renderer.markDirty(candidate ? 'snap' : 'drop');
    }

    function MAREJIG_onPointerCancel(event) {
        MAREJIG_context.pointers.delete(event.pointerId);
        MAREJIG_resetState(true);
        if (MAREJIG_context.renderer) MAREJIG_context.renderer.markDirty('pointer-cancel');
    }

    function MAREJIG_attach(canvas, scene, renderer, callbacks) {
        MAREJIG_detach();
        MAREJIG_context.canvas = canvas;
        MAREJIG_context.scene = scene;
        MAREJIG_context.renderer = renderer;
        MAREJIG_context.callbacks = callbacks || {};
        MAREJIG_context.handlers = {
            pointerdown: MAREJIG_onPointerDown,
            pointermove: MAREJIG_onPointerMove,
            pointerup: MAREJIG_onPointerUp,
            pointercancel: MAREJIG_onPointerCancel,
            pointerleave: MAREJIG_onPointerUp
        };
        canvas.addEventListener('pointerdown', MAREJIG_context.handlers.pointerdown);
        canvas.addEventListener('pointermove', MAREJIG_context.handlers.pointermove);
        canvas.addEventListener('pointerup', MAREJIG_context.handlers.pointerup);
        canvas.addEventListener('pointercancel', MAREJIG_context.handlers.pointercancel);
        canvas.addEventListener('pointerleave', MAREJIG_context.handlers.pointerleave);
        canvas.style.touchAction = 'none';
        return MAREJIG_Input;
    }

    function MAREJIG_detach() {
        if (MAREJIG_context.canvas && MAREJIG_context.handlers) {
            MAREJIG_context.canvas.removeEventListener('pointerdown', MAREJIG_context.handlers.pointerdown);
            MAREJIG_context.canvas.removeEventListener('pointermove', MAREJIG_context.handlers.pointermove);
            MAREJIG_context.canvas.removeEventListener('pointerup', MAREJIG_context.handlers.pointerup);
            MAREJIG_context.canvas.removeEventListener('pointercancel', MAREJIG_context.handlers.pointercancel);
            MAREJIG_context.canvas.removeEventListener('pointerleave', MAREJIG_context.handlers.pointerleave);
        }
        MAREJIG_context.canvas = null;
        MAREJIG_context.scene = null;
        MAREJIG_context.renderer = null;
        MAREJIG_context.callbacks = {};
        MAREJIG_context.pointers.clear();
        MAREJIG_context.handlers = null;
        MAREJIG_resetState(false);
    }

    function MAREJIG_setScene(scene) {
        MAREJIG_context.scene = scene;
        MAREJIG_resetState(false);
    }

    function MAREJIG_cancelInteraction() {
        MAREJIG_context.pointers.clear();
        MAREJIG_resetState(true);
    }

    var MAREJIG_Input = Object.freeze({
        attach: MAREJIG_attach,
        detach: MAREJIG_detach,
        setScene: MAREJIG_setScene,
        cancelInteraction: MAREJIG_cancelInteraction,
        state: MAREJIG_inputState
    });

    windowObject.MAREJIG_Input = MAREJIG_Input;
})(window);
