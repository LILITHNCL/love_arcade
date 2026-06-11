(function MAREJIG_rendererModule(windowObject) {
    'use strict';

    var MAREJIG_Config = windowObject.MAREJIG_Config;
    var MAREJIG_Scene = windowObject.MAREJIG_Scene;
    var MAREJIG_Groups = windowObject.MAREJIG_Groups;
    var MAREJIG_rendererState = { canvas: null, context: null, scene: null, dpr: 1, rafId: 0, cameraRafId: 0, showcaseRafId: 0, resizeHandler: null, options: {} };

    function MAREJIG_debounce(fn, wait) { var timer = 0; return function MAREJIG_debounced() { windowObject.clearTimeout(timer); timer = windowObject.setTimeout(fn, wait); }; }
    function MAREJIG_reducedMotion() { return Boolean(windowObject.matchMedia && windowObject.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    function MAREJIG_easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function MAREJIG_clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

    function MAREJIG_init(canvas, options) {
        MAREJIG_destroy();
        MAREJIG_rendererState.canvas = canvas;
        MAREJIG_rendererState.context = canvas && canvas.getContext('2d');
        MAREJIG_rendererState.options = options || {};
        MAREJIG_rendererState.resizeHandler = MAREJIG_debounce(MAREJIG_resize, 120);
        windowObject.addEventListener('resize', MAREJIG_rendererState.resizeHandler);
        windowObject.addEventListener('orientationchange', MAREJIG_rendererState.resizeHandler);
        MAREJIG_resize();
        return MAREJIG_Renderer;
    }

    function MAREJIG_resize() {
        var canvas = MAREJIG_rendererState.canvas;
        if (!canvas) return;
        var rect = canvas.getBoundingClientRect();
        var width = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1));
        var height = Math.max(1, Math.round(rect.height || canvas.clientHeight || 1));
        var dpr = Math.min(windowObject.devicePixelRatio || 1, MAREJIG_Config.canvas.maxDpr);
        MAREJIG_rendererState.dpr = dpr;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        if (MAREJIG_rendererState.scene) MAREJIG_Scene.layoutScene(MAREJIG_rendererState.scene, width, height);
        MAREJIG_markDirty('resize');
    }

    function MAREJIG_setScene(scene) {
        MAREJIG_rendererState.scene = scene;
        MAREJIG_resize();
        MAREJIG_markDirty('scene');
    }

    function MAREJIG_markDirty(reason) {
        var scene = MAREJIG_rendererState.scene;
        if (scene) scene.ui.dirty = true;
        if (MAREJIG_rendererState.rafId) return;
        MAREJIG_rendererState.rafId = windowObject.requestAnimationFrame(function MAREJIG_renderFrame() {
            MAREJIG_rendererState.rafId = 0;
            MAREJIG_render(reason);
        });
    }

    function MAREJIG_cancelCameraAnimation() {
        var scene = MAREJIG_rendererState.scene;
        if (MAREJIG_rendererState.cameraRafId) windowObject.cancelAnimationFrame(MAREJIG_rendererState.cameraRafId);
        MAREJIG_rendererState.cameraRafId = 0;
        if (scene && scene.performance && !MAREJIG_rendererState.showcaseRafId) scene.performance.isCameraAnimating = false;
    }

    function MAREJIG_cancelShowcaseAnimation() {
        var scene = MAREJIG_rendererState.scene;
        if (MAREJIG_rendererState.showcaseRafId) windowObject.cancelAnimationFrame(MAREJIG_rendererState.showcaseRafId);
        MAREJIG_rendererState.showcaseRafId = 0;
        if (scene && scene.performance) scene.performance.isCameraAnimating = false;
    }

    function MAREJIG_animateCameraTo(targetCamera, durationMs) {
        var scene = MAREJIG_rendererState.scene;
        if (!scene || !targetCamera) return false;
        MAREJIG_cancelCameraAnimation();
        var duration = MAREJIG_clampDuration(durationMs);
        if (MAREJIG_reducedMotion() || duration === 0) {
            scene.camera.x = targetCamera.x;
            scene.camera.y = targetCamera.y;
            MAREJIG_Scene.clampCamera(scene);
            MAREJIG_markDirty('camera-jump');
            return true;
        }
        var start = { x: scene.camera.x, y: scene.camera.y };
        var startedAt = 0;
        if (scene.performance) scene.performance.isCameraAnimating = true;
        function MAREJIG_stepCamera(now) {
            if (!startedAt) startedAt = now;
            var t = Math.min(1, (now - startedAt) / duration);
            var eased = MAREJIG_easeOutCubic(t);
            scene.camera.x = start.x + (targetCamera.x - start.x) * eased;
            scene.camera.y = start.y + (targetCamera.y - start.y) * eased;
            MAREJIG_Scene.clampCamera(scene);
            MAREJIG_markDirty('camera-animation');
            if (t < 1) MAREJIG_rendererState.cameraRafId = windowObject.requestAnimationFrame(MAREJIG_stepCamera);
            else MAREJIG_cancelCameraAnimation();
        }
        MAREJIG_rendererState.cameraRafId = windowObject.requestAnimationFrame(MAREJIG_stepCamera);
        return true;
    }

    function MAREJIG_clampDuration(durationMs) {
        var duration = Number(durationMs);
        if (duration === 0) return 0;
        return Math.max(160, Math.min(220, duration || 200));
    }

    function MAREJIG_animateCompletionShowcase(scene, options) {
        scene = scene || MAREJIG_rendererState.scene;
        var showcase = scene && scene.feedback && scene.feedback.completionShowcase;
        if (!scene || !showcase) return false;
        MAREJIG_cancelCameraAnimation();
        MAREJIG_cancelShowcaseAnimation();
        var startCamera = { x: scene.camera.x, y: scene.camera.y, zoom: scene.camera.zoom };
        var target = showcase.targetCamera || MAREJIG_Scene.computeShowcaseCamera(scene, showcase.bounds || MAREJIG_Scene.getCompletedPuzzleBounds(scene));
        var onComplete = options && typeof options.onComplete === 'function' ? options.onComplete : null;
        showcase.startedAt = 0;
        if (scene.performance) scene.performance.isCameraAnimating = true;
        function MAREJIG_stepShowcase(now) {
            var frameNow = Date.now();
            if (!showcase.startedAt) showcase.startedAt = frameNow;
            var elapsed = frameNow - showcase.startedAt;
            var cameraT = showcase.cameraDurationMs <= 0 ? 1 : MAREJIG_clamp(elapsed / showcase.cameraDurationMs, 0, 1);
            var eased = MAREJIG_easeOutCubic(cameraT);
            scene.camera.x = startCamera.x + (target.x - startCamera.x) * eased;
            scene.camera.y = startCamera.y + (target.y - startCamera.y) * eased;
            scene.camera.zoom = startCamera.zoom + (target.zoom - startCamera.zoom) * eased;
            MAREJIG_Scene.clampCamera(scene);
            if (scene.performance) scene.performance.isCameraAnimating = cameraT < 1;
            MAREJIG_markDirty('completion-showcase');
            if (elapsed < showcase.durationMs) {
                MAREJIG_rendererState.showcaseRafId = windowObject.requestAnimationFrame(MAREJIG_stepShowcase);
                return;
            }
            scene.camera.x = target.x;
            scene.camera.y = target.y;
            scene.camera.zoom = target.zoom;
            MAREJIG_Scene.clampCamera(scene);
            MAREJIG_rendererState.showcaseRafId = 0;
            if (scene.performance) scene.performance.isCameraAnimating = false;
            if (MAREJIG_Scene.finishCompletionShowcase) MAREJIG_Scene.finishCompletionShowcase(scene);
            MAREJIG_markDirty('completion-showcase-finished');
            if (onComplete) onComplete(scene);
        }
        MAREJIG_rendererState.showcaseRafId = windowObject.requestAnimationFrame(MAREJIG_stepShowcase);
        return true;
    }

    function MAREJIG_render() {
        var canvas = MAREJIG_rendererState.canvas;
        var context = MAREJIG_rendererState.context;
        var scene = MAREJIG_rendererState.scene;
        if (!canvas || !context || !scene) return;
        if (scene.ui.dirty === false) return;
        var dpr = MAREJIG_rendererState.dpr;
        var width = canvas.width / dpr;
        var height = canvas.height / dpr;
        var showcase = scene.feedback && scene.feedback.completionShowcase;
        context.save();
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        MAREJIG_drawBackground(context, width, height);
        context.save();
        context.scale(scene.camera.zoom, scene.camera.zoom);
        context.translate(-scene.camera.x, -scene.camera.y);
        if (!showcase) MAREJIG_drawSolutionArea(context, scene);
        MAREJIG_drawVisibleGroups(context, scene);
        if (!showcase) MAREJIG_drawInvalidContact(context, scene);
        context.restore();
        MAREJIG_drawCompletionShowcase(context, scene);
        MAREJIG_drawSceneMessage(context, scene, width);
        context.restore();
        scene.ui.dirty = false;
        if (MAREJIG_hasLiveInvalidFeedback(scene)) MAREJIG_markDirty('feedback');
        if (MAREJIG_rendererState.options && typeof MAREJIG_rendererState.options.onRender === 'function') MAREJIG_rendererState.options.onRender(scene);
    }

    function MAREJIG_drawBackground(context, width, height) { var gradient = context.createLinearGradient(0, 0, width, height); gradient.addColorStop(0, '#050711'); gradient.addColorStop(0.5, '#0d1327'); gradient.addColorStop(1, '#070b18'); context.fillStyle = gradient; context.fillRect(0, 0, width, height); context.fillStyle = 'rgba(119,247,228,.055)'; context.beginPath(); context.arc(width * .16, height * .18, Math.min(width, height) * .34, 0, Math.PI * 2); context.fill(); }
    function MAREJIG_drawSolutionArea(context, scene) { var board = scene.board; context.save(); context.strokeStyle = 'rgba(255,255,255,.1)'; context.lineWidth = 2; context.setLineDash([7, 12]); context.strokeRect(board.x, board.y, board.width, board.height); context.restore(); }
    function MAREJIG_traceGroupCells(context, scene, group, scale) { var anchor = scene.puzzle.pieces[group.anchorPieceId || group.pieceIds[0]]; context.beginPath(); group.pieceIds.forEach(function MAREJIG_tracePiece(pieceId) { var scenePiece = scene.pieces[pieceId]; var piece = scene.puzzle.pieces[pieceId]; if (!scenePiece || !scenePiece.visible || !piece) return; piece.cells.forEach(function MAREJIG_traceCell(cell) { context.rect((piece.solution.gridX + cell.x - anchor.solution.gridX) * scale - .25, (piece.solution.gridY + cell.y - anchor.solution.gridY) * scale - .25, scale + .5, scale + .5); }); }); }
    function MAREJIG_strokeOuterOutline(context, scene, group, scale) { var outline = MAREJIG_Groups.getGroupOutline(scene, group.id); var anchor = scene.puzzle.pieces[group.anchorPieceId || group.pieceIds[0]]; if (!outline || !anchor) return; context.beginPath(); outline.segments.forEach(function MAREJIG_outlineSegment(segment) { context.moveTo((segment.x1 - anchor.solution.gridX) * scale, (segment.y1 - anchor.solution.gridY) * scale); context.lineTo((segment.x2 - anchor.solution.gridX) * scale, (segment.y2 - anchor.solution.gridY) * scale); }); context.stroke(); }
    function MAREJIG_fillGroup(context, scene, group, scale) { var anchor = scene.puzzle.pieces[group.anchorPieceId || group.pieceIds[0]]; if (!anchor) return; context.save(); MAREJIG_traceGroupCells(context, scene, group, scale); context.clip(); if (scene.drawableImage) { try { context.drawImage(scene.drawableImage, -anchor.solution.gridX * scale - .6, -anchor.solution.gridY * scale - .6, scene.board.cols * scale + 1.2, scene.board.rows * scale + 1.2); } catch (error) { MAREJIG_fillFallback(context, scene, anchor, scale); } } else MAREJIG_fillFallback(context, scene, anchor, scale); context.restore(); }
    function MAREJIG_fillFallback(context, scene, anchor, scale) { var gradient = context.createLinearGradient(0, 0, scene.board.cols * scale, scene.board.rows * scale); gradient.addColorStop(0, '#77f7e4'); gradient.addColorStop(.5, '#8f82ff'); gradient.addColorStop(1, '#ffd166'); context.fillStyle = gradient; context.fillRect(-anchor.solution.gridX * scale, -anchor.solution.gridY * scale, scene.board.cols * scale, scene.board.rows * scale); }
    function MAREJIG_getShakeOffset(scene, group) { var feedback = scene.feedback && scene.feedback.invalidContact; if (!feedback || feedback.groupId !== group.id || MAREJIG_reducedMotion()) return { x: 0, y: 0 }; var age = Date.now() - feedback.startedAt; if (age < 0 || age > feedback.shakeDurationMs) return { x: 0, y: 0 }; var amp = 4.5 * (1 - age / feedback.shakeDurationMs); return { x: Math.sin(age * 0.36) * amp, y: Math.cos(age * 0.42) * amp * 0.35 }; }
    function MAREJIG_drawGroup(context, scene, group) { var scale = scene.staging.pieceScale; var selected = scene.ui.selectedGroupId === group.id; var showcase = scene.feedback && scene.feedback.completionShowcase; var cheap = scene.performance && (scene.performance.isDragging || scene.performance.isPanning || scene.performance.isCameraAnimating); var shake = showcase ? { x: 0, y: 0 } : MAREJIG_getShakeOffset(scene, group); context.save(); context.translate(group.x + shake.x, group.y + shake.y); context.save(); context.shadowColor = 'rgba(0,0,0,.32)'; context.shadowBlur = showcase ? 5 : (cheap ? 3 : (selected ? 6 : 9)); context.shadowOffsetY = showcase ? 4 : (cheap ? 2 : (selected ? 4 : 6)); context.strokeStyle = 'rgba(0,0,0,.3)'; context.lineWidth = showcase ? 3 : 4; MAREJIG_strokeOuterOutline(context, scene, group, scale); context.restore(); MAREJIG_fillGroup(context, scene, group, scale); context.lineJoin = 'round'; context.lineCap = 'round'; context.strokeStyle = showcase ? 'rgba(248,251,255,.86)' : (selected ? 'rgba(255,209,102,.98)' : 'rgba(255,255,255,.72)'); context.lineWidth = showcase ? 1.7 : (selected ? 2.6 : 1.45); MAREJIG_strokeOuterOutline(context, scene, group, scale); context.restore(); }
    function MAREJIG_drawVisibleGroups(context, scene) { Object.keys(scene.groups).map(function MAREJIG_getGroup(groupId) { return scene.groups[groupId]; }).filter(function MAREJIG_visible(group) { return group.visible; }).sort(function MAREJIG_z(a, b) { return a.zIndex - b.zIndex; }).forEach(function MAREJIG_renderGroup(group) { MAREJIG_drawGroup(context, scene, group); }); }
    function MAREJIG_hasLiveInvalidFeedback(scene) { var feedback = scene.feedback && scene.feedback.invalidContact; return Boolean(feedback && Date.now() - feedback.startedAt <= feedback.durationMs); }
    function MAREJIG_drawInvalidGroupGlow(context, scene, group) { if (!group || !group.visible) return; context.save(); context.translate(group.x, group.y); context.lineJoin = 'round'; context.lineCap = 'round'; context.shadowColor = 'rgba(220, 95, 105, 0.42)'; context.shadowBlur = 14; context.strokeStyle = 'rgba(220, 95, 105, 0.85)'; context.lineWidth = 3; MAREJIG_strokeOuterOutline(context, scene, group, scene.staging.pieceScale); context.restore(); }
    function MAREJIG_drawInvalidContact(context, scene) { var feedback = scene.feedback && scene.feedback.invalidContact; if (!feedback) return; var age = Date.now() - feedback.startedAt; if (age > feedback.durationMs) return; var alpha = Math.max(0, 1 - age / feedback.durationMs); context.save(); context.globalAlpha = Math.max(0.18, alpha); MAREJIG_drawInvalidGroupGlow(context, scene, scene.groups[feedback.groupId]); MAREJIG_drawInvalidGroupGlow(context, scene, scene.groups[feedback.targetGroupId]); context.restore(); }

    function MAREJIG_drawCompletionShowcase(context, scene) {
        var showcase = scene.feedback && scene.feedback.completionShowcase;
        if (!showcase || !showcase.startedAt || !showcase.particles || !showcase.particles.length) return;
        var age = Date.now() - showcase.startedAt;
        if (age < showcase.particlesStartMs) return;
        var bounds = showcase.bounds || MAREJIG_Scene.getCompletedPuzzleBounds(scene);
        if (!bounds) return;
        var topLeft = MAREJIG_Scene.worldToScreen(scene, { x: bounds.x, y: bounds.y });
        var bottomRight = MAREJIG_Scene.worldToScreen(scene, { x: bounds.x + bounds.width, y: bounds.y + bounds.height });
        var centerX = (topLeft.x + bottomRight.x) / 2;
        var centerY = (topLeft.y + bottomRight.y) / 2;
        var radiusX = Math.max(28, Math.abs(bottomRight.x - topLeft.x) / 2 + 18);
        var radiusY = Math.max(28, Math.abs(bottomRight.y - topLeft.y) / 2 + 18);
        context.save();
        showcase.particles.forEach(function MAREJIG_drawShowcaseParticle(particle) {
            var localAge = age - showcase.particlesStartMs - particle.delay;
            if (localAge < 0 || localAge > particle.lifetime) return;
            var t = localAge / particle.lifetime;
            var alpha = Math.sin(Math.PI * t) * 0.92;
            var drift = particle.radiusOffset * MAREJIG_easeOutCubic(t);
            var angle = particle.angle + particle.spin * t * 0.18;
            var x = centerX + Math.cos(angle) * (radiusX + drift);
            var y = centerY + Math.sin(angle) * (radiusY + drift);
            context.save();
            context.globalAlpha = alpha;
            context.fillStyle = particle.color;
            context.translate(x, y);
            context.rotate(angle + t * particle.spin * Math.PI);
            if (particle.kind === 'star') MAREJIG_drawStar(context, particle.size);
            else { context.beginPath(); context.arc(0, 0, particle.size * 0.55, 0, Math.PI * 2); context.fill(); }
            context.restore();
        });
        context.restore();
    }

    function MAREJIG_drawStar(context, size) {
        context.beginPath();
        for (var index = 0; index < 10; index += 1) {
            var radius = index % 2 === 0 ? size : size * 0.42;
            var angle = -Math.PI / 2 + index * Math.PI / 5;
            var x = Math.cos(angle) * radius;
            var y = Math.sin(angle) * radius;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
        }
        context.closePath();
        context.fill();
    }

    function MAREJIG_drawSceneMessage(context, scene, width) { if (!scene.ui.message) return; var age = Date.now() - (scene.ui.messageStartedAt || 0); var showcase = scene.feedback && scene.feedback.completionShowcase; if (age > 1800 && !showcase && scene.ui.message !== 'Puzzle completo local') return; context.save(); context.textAlign = 'center'; context.font = '800 13px system-ui,sans-serif'; context.fillStyle = showcase ? 'rgba(9,17,31,.64)' : 'rgba(9,17,31,.78)'; context.fillRect(width / 2 - 92, 58, 184, 30); context.fillStyle = '#f8fbff'; context.fillText(scene.ui.message, width / 2, 78); context.restore(); }

    function MAREJIG_destroy() {
        MAREJIG_cancelCameraAnimation();
        MAREJIG_cancelShowcaseAnimation();
        if (MAREJIG_rendererState.rafId) windowObject.cancelAnimationFrame(MAREJIG_rendererState.rafId);
        if (MAREJIG_rendererState.resizeHandler) {
            windowObject.removeEventListener('resize', MAREJIG_rendererState.resizeHandler);
            windowObject.removeEventListener('orientationchange', MAREJIG_rendererState.resizeHandler);
        }
        MAREJIG_rendererState.canvas = null;
        MAREJIG_rendererState.context = null;
        MAREJIG_rendererState.scene = null;
        MAREJIG_rendererState.rafId = 0;
        MAREJIG_rendererState.cameraRafId = 0;
        MAREJIG_rendererState.showcaseRafId = 0;
        MAREJIG_rendererState.resizeHandler = null;
    }

    var MAREJIG_Renderer = Object.freeze({ init: MAREJIG_init, resize: MAREJIG_resize, setScene: MAREJIG_setScene, markDirty: MAREJIG_markDirty, render: MAREJIG_render, animateCameraTo: MAREJIG_animateCameraTo, animateCompletionShowcase: MAREJIG_animateCompletionShowcase, cancelCameraAnimation: MAREJIG_cancelCameraAnimation, destroy: MAREJIG_destroy });
    windowObject.MAREJIG_Renderer = MAREJIG_Renderer;
})(window);
