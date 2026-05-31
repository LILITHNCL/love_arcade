(function MAREJIG_rendererModule(windowObject) {
    'use strict';
    var MAREJIG_Config = windowObject.MAREJIG_Config;
    var MAREJIG_Scene = windowObject.MAREJIG_Scene;
    var MAREJIG_Groups = windowObject.MAREJIG_Groups;
    var MAREJIG_rendererState = { canvas: null, context: null, scene: null, dpr: 1, rafId: 0, cameraRafId: 0, resizeHandler: null, options: {} };

    function MAREJIG_debounce(fn, wait) { var timer = 0; return function MAREJIG_debounced() { windowObject.clearTimeout(timer); timer = windowObject.setTimeout(fn, wait); }; }
    function MAREJIG_reducedMotion() { return Boolean(windowObject.matchMedia && windowObject.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function MAREJIG_easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function MAREJIG_init(canvas, options) { MAREJIG_destroy(); MAREJIG_rendererState.canvas = canvas; MAREJIG_rendererState.context = canvas && canvas.getContext('2d'); MAREJIG_rendererState.options = options || {}; MAREJIG_rendererState.resizeHandler = MAREJIG_debounce(MAREJIG_resize, 120); windowObject.addEventListener('resize', MAREJIG_rendererState.resizeHandler); windowObject.addEventListener('orientationchange', MAREJIG_rendererState.resizeHandler); MAREJIG_resize(); return MAREJIG_Renderer; }
    function MAREJIG_resize() { var canvas = MAREJIG_rendererState.canvas; if (!canvas) return; var rect = canvas.getBoundingClientRect(); var width = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1)); var height = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1)); var dpr = Math.min(windowObject.devicePixelRatio || 1, MAREJIG_Config.canvas.maxDpr); MAREJIG_rendererState.dpr = dpr; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); if (MAREJIG_rendererState.scene) MAREJIG_Scene.layoutScene(MAREJIG_rendererState.scene, width, height); MAREJIG_markDirty('resize'); }
    function MAREJIG_setScene(scene) { MAREJIG_rendererState.scene = scene; MAREJIG_resize(); MAREJIG_markDirty('scene'); }
    function MAREJIG_markDirty(reason) { var scene = MAREJIG_rendererState.scene; if (scene) scene.ui.dirty = true; if (MAREJIG_rendererState.rafId) return; MAREJIG_rendererState.rafId = windowObject.requestAnimationFrame(function MAREJIG_renderFrame() { MAREJIG_rendererState.rafId = 0; MAREJIG_render(reason); }); }

    function MAREJIG_animateCameraTo(targetCamera, durationMs) {
        var scene = MAREJIG_rendererState.scene;
        if (!scene || !targetCamera) return false;
        if (MAREJIG_rendererState.cameraRafId) windowObject.cancelAnimationFrame(MAREJIG_rendererState.cameraRafId);
        var duration = Math.max(0, Number(durationMs) || 280);
        if (MAREJIG_reducedMotion() || duration === 0) {
            scene.camera.x = targetCamera.x;
            scene.camera.y = targetCamera.y;
            scene.camera.zoom = targetCamera.zoom || scene.camera.zoom;
            MAREJIG_Scene.clampCamera(scene);
            MAREJIG_markDirty('camera-jump');
            return true;
        }
        var start = { x: scene.camera.x, y: scene.camera.y, zoom: scene.camera.zoom };
        var startedAt = 0;
        function MAREJIG_stepCamera(now) {
            if (!startedAt) startedAt = now;
            var t = Math.min(1, (now - startedAt) / duration);
            var eased = MAREJIG_easeOutCubic(t);
            scene.camera.x = start.x + (targetCamera.x - start.x) * eased;
            scene.camera.y = start.y + (targetCamera.y - start.y) * eased;
            scene.camera.zoom = start.zoom + ((targetCamera.zoom || start.zoom) - start.zoom) * eased;
            MAREJIG_Scene.clampCamera(scene);
            MAREJIG_markDirty('camera-animate');
            if (t < 1) MAREJIG_rendererState.cameraRafId = windowObject.requestAnimationFrame(MAREJIG_stepCamera);
            else MAREJIG_rendererState.cameraRafId = 0;
        }
        MAREJIG_rendererState.cameraRafId = windowObject.requestAnimationFrame(MAREJIG_stepCamera);
        return true;
    }

    function MAREJIG_render() {
        var canvas = MAREJIG_rendererState.canvas; var context = MAREJIG_rendererState.context; var scene = MAREJIG_rendererState.scene;
        if (!canvas || !context || !scene) return;
        if (scene.ui.dirty === false) return;
        var dpr = MAREJIG_rendererState.dpr; var width = canvas.width / dpr; var height = canvas.height / dpr;
        context.save(); context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height); MAREJIG_drawBackground(context, width, height);
        context.save(); context.scale(scene.camera.zoom, scene.camera.zoom); context.translate(-scene.camera.x, -scene.camera.y); MAREJIG_drawSolutionArea(context, scene); MAREJIG_drawVisibleGroups(context, scene); MAREJIG_drawInvalidContact(context, scene); context.restore();
        MAREJIG_drawSceneMessage(context, scene, width); context.restore(); scene.ui.dirty = false;
        if (MAREJIG_hasLiveInvalidFeedback(scene)) MAREJIG_markDirty('feedback');
        if (MAREJIG_rendererState.options && typeof MAREJIG_rendererState.options.onRender === 'function') MAREJIG_rendererState.options.onRender(scene);
    }

    function MAREJIG_drawBackground(context, width, height) { var gradient = context.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, '#050711'); gradient.addColorStop(0.5, '#0d1327'); gradient.addColorStop(1, '#070b18'); context.fillStyle = gradient; context.fillRect(0, 0, width, height); context.fillStyle = 'rgba(119,247,228,.055)'; context.beginPath(); context.arc(width * .1, height * .12, Math.min(width, height) * .36, 0, Math.PI * 2); context.fill(); context.fillStyle = 'rgba(184,163,255,.05)'; context.beginPath(); context.arc(width * .9, height * .18, Math.min(width, height) * .28, 0, Math.PI * 2); context.fill(); }
    function MAREJIG_drawSolutionArea(context, scene) { var board = scene.board; context.save(); context.strokeStyle = 'rgba(119,247,228,.16)'; context.lineWidth = 1; context.setLineDash([7, 12]); context.strokeRect(board.x, board.y, board.width, board.height); context.restore(); }

    function MAREJIG_traceGroupCells(context, scene, group, scale) { var anchor = scene.puzzle.pieces[group.anchorPieceId || group.pieceIds[0]]; context.beginPath(); group.pieceIds.forEach(function MAREJIG_tracePiece(pieceId) { var scenePiece = scene.pieces[pieceId]; var piece = scene.puzzle.pieces[pieceId]; if (!scenePiece || !scenePiece.visible || !piece) return; piece.cells.forEach(function MAREJIG_traceCell(cell) { context.rect((piece.solution.gridX + cell.x - anchor.solution.gridX) * scale - .55, (piece.solution.gridY + cell.y - anchor.solution.gridY) * scale - .55, scale + 1.1, scale + 1.1); }); }); }
    function MAREJIG_strokeOuterOutline(context, scene, group, scale) { var outline = MAREJIG_Groups.getGroupOutline(scene, group.id); var anchor = scene.puzzle.pieces[group.anchorPieceId || group.pieceIds[0]]; if (!outline || !anchor) return; context.beginPath(); outline.segments.forEach(function MAREJIG_outlineSegment(segment) { context.moveTo((segment.x1 - anchor.solution.gridX) * scale, (segment.y1 - anchor.solution.gridY) * scale); context.lineTo((segment.x2 - anchor.solution.gridX) * scale, (segment.y2 - anchor.solution.gridY) * scale); }); context.stroke(); }
    function MAREJIG_fillGroup(context, scene, group, scale) { var anchor = scene.puzzle.pieces[group.anchorPieceId || group.pieceIds[0]]; if (!anchor) return; context.save(); MAREJIG_traceGroupCells(context, scene, group, scale); context.clip(); if (scene.drawableImage) { try { context.drawImage(scene.drawableImage, -anchor.solution.gridX * scale - .6, -anchor.solution.gridY * scale - .6, scene.board.cols * scale + 1.2, scene.board.rows * scale + 1.2); } catch (error) { MAREJIG_fillFallback(context, scene, anchor, scale); } } else MAREJIG_fillFallback(context, scene, anchor, scale); context.restore(); }
    function MAREJIG_fillFallback(context, scene, anchor, scale) { var gradient = context.createLinearGradient(0, 0, scene.board.cols * scale, scene.board.rows * scale); gradient.addColorStop(0, '#77f7e4'); gradient.addColorStop(.5, '#8f82ff'); gradient.addColorStop(1, '#ffd166'); context.fillStyle = gradient; context.fillRect(-anchor.solution.gridX * scale, -anchor.solution.gridY * scale, scene.board.cols * scale, scene.board.rows * scale); }
    function MAREJIG_getShakeOffset(scene, group) { var feedback = scene.feedback && scene.feedback.invalidContact; if (!feedback || feedback.groupId !== group.id || MAREJIG_reducedMotion()) return { x: 0, y: 0 }; var age = Date.now() - feedback.startedAt; if (age < 0 || age > feedback.shakeDurationMs) return { x: 0, y: 0 }; var amp = 4.5 * (1 - age / feedback.shakeDurationMs); return { x: Math.sin(age * 0.36) * amp, y: Math.cos(age * 0.42) * amp * 0.35 }; }
    function MAREJIG_drawGroup(context, scene, group) { var scale = scene.staging.pieceScale; var selected = scene.ui.selectedGroupId === group.id; var shake = MAREJIG_getShakeOffset(scene, group); context.save(); context.translate(group.x + shake.x, group.y + shake.y); context.save(); context.shadowColor = 'rgba(0,0,0,.38)'; context.shadowBlur = selected ? 7 : 12; context.shadowOffsetY = selected ? 4 : 7; context.strokeStyle = 'rgba(0,0,0,.3)'; context.lineWidth = 4; MAREJIG_strokeOuterOutline(context, scene, group, scale); context.restore(); MAREJIG_fillGroup(context, scene, group, scale); context.lineJoin = 'round'; context.lineCap = 'round'; context.strokeStyle = selected ? 'rgba(255,209,102,.98)' : 'rgba(255,255,255,.72)'; context.lineWidth = selected ? 2.6 : 1.45; MAREJIG_strokeOuterOutline(context, scene, group, scale); context.restore(); }
    function MAREJIG_drawVisibleGroups(context, scene) { Object.keys(scene.groups).map(function MAREJIG_getGroup(groupId) { return scene.groups[groupId]; }).filter(function MAREJIG_visible(group) { return group.visible; }).sort(function MAREJIG_z(a, b) { return a.zIndex - b.zIndex; }).forEach(function MAREJIG_renderGroup(group) { MAREJIG_drawGroup(context, scene, group); }); }
    function MAREJIG_hasLiveInvalidFeedback(scene) { var feedback = scene.feedback && scene.feedback.invalidContact; return Boolean(feedback && Date.now() - feedback.startedAt <= feedback.durationMs); }
    function MAREJIG_drawInvalidGroupGlow(context, scene, group) { if (!group || !group.visible) return; if (MAREJIG_Groups) MAREJIG_Groups.recalculateGroupBounds(scene, group.id); context.save(); context.translate(group.x, group.y); context.lineJoin = 'round'; context.lineCap = 'round'; context.shadowColor = 'rgba(220, 95, 105, 0.42)'; context.shadowBlur = 14; context.strokeStyle = 'rgba(220, 95, 105, 0.85)'; context.lineWidth = 3; MAREJIG_strokeOuterOutline(context, scene, group, scene.staging.pieceScale); context.restore(); }
    function MAREJIG_drawInvalidContact(context, scene) { var feedback = scene.feedback && scene.feedback.invalidContact; if (!feedback) return; var age = Date.now() - feedback.startedAt; if (age > feedback.durationMs) return; var alpha = Math.max(0, 1 - age / feedback.durationMs); context.save(); context.globalAlpha = Math.max(0.18, alpha); MAREJIG_drawInvalidGroupGlow(context, scene, scene.groups[feedback.groupId]); MAREJIG_drawInvalidGroupGlow(context, scene, scene.groups[feedback.targetGroupId]); context.restore(); }
    function MAREJIG_drawSceneMessage(context, scene, width) { if (!scene.ui.message) return; var age = Date.now() - (scene.ui.messageStartedAt || 0); if (age > 1800 && scene.ui.message !== 'Puzzle completo local') return; context.save(); context.textAlign = 'center'; context.font = '800 13px system-ui,sans-serif'; context.fillStyle = 'rgba(9,17,31,.78)'; context.fillRect(width / 2 - 92, 58, 184, 30); context.fillStyle = '#f8fbff'; context.fillText(scene.ui.message, width / 2, 78); context.restore(); }
    function MAREJIG_destroy() { if (MAREJIG_rendererState.rafId) windowObject.cancelAnimationFrame(MAREJIG_rendererState.rafId); if (MAREJIG_rendererState.cameraRafId) windowObject.cancelAnimationFrame(MAREJIG_rendererState.cameraRafId); if (MAREJIG_rendererState.resizeHandler) { windowObject.removeEventListener('resize', MAREJIG_rendererState.resizeHandler); windowObject.removeEventListener('orientationchange', MAREJIG_rendererState.resizeHandler); } MAREJIG_rendererState.canvas = null; MAREJIG_rendererState.context = null; MAREJIG_rendererState.scene = null; MAREJIG_rendererState.rafId = 0; MAREJIG_rendererState.cameraRafId = 0; MAREJIG_rendererState.resizeHandler = null; }
    var MAREJIG_Renderer = Object.freeze({ init: MAREJIG_init, resize: MAREJIG_resize, setScene: MAREJIG_setScene, markDirty: MAREJIG_markDirty, render: MAREJIG_render, animateCameraTo: MAREJIG_animateCameraTo, destroy: MAREJIG_destroy });
    windowObject.MAREJIG_Renderer = MAREJIG_Renderer;
})(window);
