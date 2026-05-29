(function MAREJIG_rendererModule(windowObject) {
    'use strict';

    var MAREJIG_Config = windowObject.MAREJIG_Config;
    var MAREJIG_Scene = windowObject.MAREJIG_Scene;

    var MAREJIG_rendererState = {
        canvas: null,
        context: null,
        scene: null,
        dpr: 1,
        rafId: 0,
        pathCache: new Map(),
        resizeHandler: null,
        options: {}
    };

    function MAREJIG_debounce(fn, wait) {
        if (typeof windowObject.debounce === 'function') return windowObject.debounce(fn, wait);
        var timeoutId = 0;
        return function MAREJIG_debounced() {
            windowObject.clearTimeout(timeoutId);
            timeoutId = windowObject.setTimeout(fn, wait);
        };
    }

    function MAREJIG_init(canvas, options) {
        MAREJIG_destroy();
        MAREJIG_rendererState.canvas = canvas;
        MAREJIG_rendererState.context = canvas ? canvas.getContext('2d') : null;
        MAREJIG_rendererState.options = options || {};
        MAREJIG_rendererState.resizeHandler = MAREJIG_debounce(function MAREJIG_rendererResizeHandler() {
            MAREJIG_resize();
        }, 120);
        windowObject.addEventListener('resize', MAREJIG_rendererState.resizeHandler);
        windowObject.addEventListener('orientationchange', MAREJIG_rendererState.resizeHandler);
        MAREJIG_resize();
        return MAREJIG_Renderer;
    }

    function MAREJIG_resize() {
        var canvas = MAREJIG_rendererState.canvas;
        if (!canvas) return;
        var rect = canvas.getBoundingClientRect();
        var cssWidth = Math.max(1, Math.round(rect.width || canvas.clientWidth || 1));
        var cssHeight = Math.max(1, Math.round(rect.height || canvas.clientHeight || Math.round(cssWidth * 0.75)));
        var dpr = Math.min(windowObject.devicePixelRatio || 1, MAREJIG_Config.canvas.maxDpr);
        MAREJIG_rendererState.dpr = dpr;
        canvas.width = Math.round(cssWidth * dpr);
        canvas.height = Math.round(cssHeight * dpr);
        if (MAREJIG_rendererState.scene) {
            MAREJIG_Scene.layoutScene(MAREJIG_rendererState.scene, cssWidth, cssHeight);
        }
        MAREJIG_markDirty('resize');
    }

    function MAREJIG_setScene(scene) {
        MAREJIG_rendererState.scene = scene;
        MAREJIG_rendererState.pathCache.clear();
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

    function MAREJIG_render() {
        var canvas = MAREJIG_rendererState.canvas;
        var context = MAREJIG_rendererState.context;
        var scene = MAREJIG_rendererState.scene;
        if (!canvas || !context || !scene) return;
        if (scene.ui.dirty === false) return;

        var dpr = MAREJIG_rendererState.dpr;
        var width = canvas.width / dpr;
        var height = canvas.height / dpr;
        context.save();
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, width, height);
        MAREJIG_drawBackground(context, width, height);
        MAREJIG_drawBoardPreview(context, scene);
        MAREJIG_drawStaging(context, scene);
        MAREJIG_drawVisiblePieces(context, scene);
        context.restore();
        scene.ui.dirty = false;
        if (MAREJIG_rendererState.options && typeof MAREJIG_rendererState.options.onRender === 'function') {
            MAREJIG_rendererState.options.onRender(scene);
        }
    }

    function MAREJIG_drawBackground(context, width, height) {
        var gradient = context.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#050711');
        gradient.addColorStop(0.48, '#0d1327');
        gradient.addColorStop(1, '#070b18');
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        context.fillStyle = 'rgba(119, 247, 228, 0.07)';
        context.beginPath();
        context.arc(width * 0.12, height * 0.1, Math.min(width, height) * 0.34, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = 'rgba(184, 163, 255, 0.07)';
        context.beginPath();
        context.arc(width * 0.92, height * 0.08, Math.min(width, height) * 0.26, 0, Math.PI * 2);
        context.fill();
    }

    function MAREJIG_drawRoundRect(context, x, y, width, height, radius) {
        var r = Math.min(radius, width / 2, height / 2);
        context.beginPath();
        context.moveTo(x + r, y);
        context.lineTo(x + width - r, y);
        context.quadraticCurveTo(x + width, y, x + width, y + r);
        context.lineTo(x + width, y + height - r);
        context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
        context.lineTo(x + r, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - r);
        context.lineTo(x, y + r);
        context.quadraticCurveTo(x, y, x + r, y);
        context.closePath();
    }

    function MAREJIG_drawBoardPreview(context, scene) {
        var board = scene.board;
        context.save();
        context.shadowColor = 'rgba(0, 0, 0, 0.38)';
        context.shadowBlur = 24;
        context.shadowOffsetY = 16;
        MAREJIG_drawRoundRect(context, board.x - 8, board.y - 8, board.width + 16, board.height + 16, 24);
        context.fillStyle = 'rgba(255, 255, 255, 0.055)';
        context.fill();
        context.restore();

        context.save();
        MAREJIG_drawRoundRect(context, board.x, board.y, board.width, board.height, 18);
        context.clip();
        if (scene.drawableImage) {
            try {
                context.globalAlpha = 0.24;
                context.drawImage(scene.drawableImage, board.x, board.y, board.width, board.height);
            } catch (error) {
                MAREJIG_drawFallbackPattern(context, board.x, board.y, board.width, board.height, 0.22);
            }
        } else {
            MAREJIG_drawFallbackPattern(context, board.x, board.y, board.width, board.height, 0.25);
        }
        context.globalAlpha = 1;
        context.fillStyle = 'rgba(4, 7, 18, 0.42)';
        context.fillRect(board.x, board.y, board.width, board.height);
        context.restore();

        context.save();
        context.strokeStyle = 'rgba(255, 255, 255, 0.13)';
        context.lineWidth = 1;
        Object.keys(scene.puzzle.pieces).forEach(function MAREJIG_boardPiece(pieceId) {
            var piece = scene.puzzle.pieces[pieceId];
            piece.outline.segments.forEach(function MAREJIG_boardOutline(segment) {
                context.beginPath();
                context.moveTo(board.x + segment.x1 * board.cellSize, board.y + segment.y1 * board.cellSize);
                context.lineTo(board.x + segment.x2 * board.cellSize, board.y + segment.y2 * board.cellSize);
                context.stroke();
            });
        });
        context.strokeStyle = 'rgba(119, 247, 228, 0.35)';
        context.lineWidth = 1.5;
        MAREJIG_drawRoundRect(context, board.x, board.y, board.width, board.height, 18);
        context.stroke();
        context.restore();
    }

    function MAREJIG_drawStaging(context, scene) {
        var staging = scene.staging;
        context.save();
        MAREJIG_drawRoundRect(context, staging.x, staging.y, staging.width, staging.height, 22);
        context.fillStyle = 'rgba(255, 255, 255, 0.045)';
        context.fill();
        context.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        context.stroke();
        context.fillStyle = 'rgba(220, 231, 255, 0.52)';
        context.font = '700 12px system-ui, sans-serif';
        context.fillText('Piezas reveladas · segmento inicial', staging.x + 16, staging.y + 24);
        context.restore();
    }

    function MAREJIG_drawVisiblePieces(context, scene) {
        var groupList = Object.keys(scene.groups).map(function MAREJIG_sceneGroup(groupId) {
            return scene.groups[groupId];
        }).filter(function MAREJIG_visibleGroup(group) {
            return group.visible;
        }).sort(function MAREJIG_sortByZ(a, b) {
            return a.zIndex - b.zIndex;
        });

        groupList.forEach(function MAREJIG_drawGroup(group) {
            group.pieceIds.forEach(function MAREJIG_drawGroupPiece(pieceId) {
                if (scene.pieces[pieceId] && scene.pieces[pieceId].visible) {
                    MAREJIG_drawPiece(context, scene, scene.puzzle.pieces[pieceId], group);
                }
            });
        });
    }

    function MAREJIG_getPathForPiece(scenePiece, puzzlePiece, scale) {
        var cacheKey = puzzlePiece.id + ':' + scale.toFixed(3);
        if (MAREJIG_rendererState.pathCache.has(cacheKey)) return MAREJIG_rendererState.pathCache.get(cacheKey);
        if (typeof windowObject.Path2D !== 'function') return null;
        try {
            var path = new Path2D();
            puzzlePiece.cells.forEach(function MAREJIG_pieceCell(cell) {
                path.rect(cell.x * scale, cell.y * scale, scale, scale);
            });
            MAREJIG_rendererState.pathCache.set(cacheKey, path);
            scenePiece.path = path;
            return path;
        } catch (error) {
            console.warn('[MAREJIG] Path2D no disponible para pieza', puzzlePiece.id, error.message);
            return null;
        }
    }

    function MAREJIG_drawPiece(context, scene, puzzlePiece, group) {
        var scenePiece = scene.pieces[puzzlePiece.id];
        var scale = scene.staging.pieceScale;
        var pieceW = puzzlePiece.bounds.w * scale;
        var pieceH = puzzlePiece.bounds.h * scale;
        var path = MAREJIG_getPathForPiece(scenePiece, puzzlePiece, scale);

        scenePiece.hitBounds = { x: group.x - 8, y: group.y - 8, width: pieceW + 16, height: pieceH + 16 };
        context.save();
        context.translate(group.x, group.y);
        context.shadowColor = 'rgba(0, 0, 0, 0.42)';
        context.shadowBlur = 16;
        context.shadowOffsetY = 9;
        if (path) {
            context.fillStyle = 'rgba(0, 0, 0, 0.24)';
            context.fill(path);
        } else {
            MAREJIG_fillPieceByCells(context, puzzlePiece, scale, 'rgba(0, 0, 0, 0.24)');
        }
        context.shadowColor = 'transparent';
        context.shadowBlur = 0;
        context.shadowOffsetY = 0;

        context.save();
        if (path) {
            context.clip(path);
        } else {
            MAREJIG_clipPieceByCells(context, puzzlePiece, scale);
        }
        if (scene.drawableImage) {
            MAREJIG_drawImageInsidePiece(context, scene, puzzlePiece, scale);
        } else {
            MAREJIG_drawFallbackInsidePiece(context, puzzlePiece, scale);
        }
        if (puzzlePiece.segmentId === scene.ui.activeSegmentId) {
            context.fillStyle = 'rgba(119, 247, 228, 0.09)';
            context.fillRect(0, 0, pieceW, pieceH);
        }
        context.restore();

        context.strokeStyle = puzzlePiece.segmentId === scene.ui.activeSegmentId ? 'rgba(119, 247, 228, 0.92)' : 'rgba(255, 255, 255, 0.72)';
        context.lineWidth = 1.5;
        MAREJIG_strokePieceByCells(context, puzzlePiece, scale);
        context.restore();
    }

    function MAREJIG_drawImageInsidePiece(context, scene, puzzlePiece, scale) {
        var board = scene.board;
        puzzlePiece.cells.forEach(function MAREJIG_drawCellImage(cell) {
            var sourceX = (puzzlePiece.solution.gridX + cell.x) * board.sourceCellW;
            var sourceY = (puzzlePiece.solution.gridY + cell.y) * board.sourceCellH;
            try {
                context.drawImage(
                    scene.drawableImage,
                    sourceX,
                    sourceY,
                    board.sourceCellW,
                    board.sourceCellH,
                    cell.x * scale,
                    cell.y * scale,
                    scale,
                    scale
                );
            } catch (error) {
                MAREJIG_drawFallbackCell(context, puzzlePiece, cell, scale);
            }
        });
    }

    function MAREJIG_drawFallbackPattern(context, x, y, width, height, alpha) {
        var gradient = context.createLinearGradient(x, y, x + width, y + height);
        gradient.addColorStop(0, 'rgba(119, 247, 228, ' + alpha + ')');
        gradient.addColorStop(0.52, 'rgba(184, 163, 255, ' + alpha + ')');
        gradient.addColorStop(1, 'rgba(255, 209, 102, ' + alpha + ')');
        context.fillStyle = gradient;
        context.fillRect(x, y, width, height);
    }

    function MAREJIG_drawFallbackInsidePiece(context, puzzlePiece, scale) {
        puzzlePiece.cells.forEach(function MAREJIG_fallbackCell(cell) {
            MAREJIG_drawFallbackCell(context, puzzlePiece, cell, scale);
        });
    }

    function MAREJIG_drawFallbackCell(context, puzzlePiece, cell, scale) {
        var hue = (puzzlePiece.bounds.x * 19 + puzzlePiece.bounds.y * 31 + cell.x * 11 + cell.y * 7) % 360;
        context.fillStyle = 'hsl(' + hue + ' 72% 58%)';
        context.fillRect(cell.x * scale, cell.y * scale, scale, scale);
        context.fillStyle = 'rgba(255, 255, 255, 0.12)';
        context.fillRect(cell.x * scale, cell.y * scale, scale, scale * 0.34);
    }

    function MAREJIG_fillPieceByCells(context, puzzlePiece, scale, style) {
        context.fillStyle = style;
        puzzlePiece.cells.forEach(function MAREJIG_fillCell(cell) {
            context.fillRect(cell.x * scale, cell.y * scale, scale, scale);
        });
    }

    function MAREJIG_clipPieceByCells(context, puzzlePiece, scale) {
        context.beginPath();
        puzzlePiece.cells.forEach(function MAREJIG_clipCell(cell) {
            context.rect(cell.x * scale, cell.y * scale, scale, scale);
        });
        context.clip();
    }

    function MAREJIG_strokePieceByCells(context, puzzlePiece, scale) {
        puzzlePiece.outline.segments.forEach(function MAREJIG_strokeOutline(segment) {
            var localX1 = (segment.x1 - puzzlePiece.solution.gridX) * scale;
            var localY1 = (segment.y1 - puzzlePiece.solution.gridY) * scale;
            var localX2 = (segment.x2 - puzzlePiece.solution.gridX) * scale;
            var localY2 = (segment.y2 - puzzlePiece.solution.gridY) * scale;
            context.beginPath();
            context.moveTo(localX1, localY1);
            context.lineTo(localX2, localY2);
            context.stroke();
        });
    }

    function MAREJIG_destroy() {
        if (MAREJIG_rendererState.rafId) {
            windowObject.cancelAnimationFrame(MAREJIG_rendererState.rafId);
        }
        if (MAREJIG_rendererState.resizeHandler) {
            windowObject.removeEventListener('resize', MAREJIG_rendererState.resizeHandler);
            windowObject.removeEventListener('orientationchange', MAREJIG_rendererState.resizeHandler);
        }
        MAREJIG_rendererState.canvas = null;
        MAREJIG_rendererState.context = null;
        MAREJIG_rendererState.scene = null;
        MAREJIG_rendererState.rafId = 0;
        MAREJIG_rendererState.pathCache.clear();
        MAREJIG_rendererState.resizeHandler = null;
    }

    var MAREJIG_Renderer = Object.freeze({
        init: MAREJIG_init,
        resize: MAREJIG_resize,
        setScene: MAREJIG_setScene,
        markDirty: MAREJIG_markDirty,
        render: MAREJIG_render,
        destroy: MAREJIG_destroy
    });

    windowObject.MAREJIG_Renderer = MAREJIG_Renderer;
})(window);
