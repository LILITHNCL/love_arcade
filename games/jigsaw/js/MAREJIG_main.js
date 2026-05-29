(function MAREJIG_mainModule(windowObject, documentObject) {
    'use strict';

    var MAREJIG_LevelCatalog = windowObject.MAREJIG_LevelCatalog;
    var MAREJIG_Cloudinary = windowObject.MAREJIG_Cloudinary;
    var MAREJIG_ImageLoader = windowObject.MAREJIG_ImageLoader;
    var MAREJIG_Menu = windowObject.MAREJIG_Menu;
    var MAREJIG_State = windowObject.MAREJIG_State;
    var MAREJIG_Storage = windowObject.MAREJIG_Storage;
    var MAREJIG_Generator = windowObject.MAREJIG_Generator;

    var MAREJIG_currentLevelId = null;

    function MAREJIG_byId(id) {
        return documentObject.getElementById(id);
    }

    function MAREJIG_showScreen(name) {
        ['menu', 'loading', 'game', 'error'].forEach(function MAREJIG_toggleScreen(screen) {
            var element = MAREJIG_byId('marejig-screen-' + screen);
            if (!element) return;
            var visible = screen === name;
            element.hidden = !visible;
            element.classList.toggle('marejig-screen-current', visible);
        });
        MAREJIG_State.setState({ currentScreen: name });
    }

    function MAREJIG_setProgress(percent, label) {
        var bar = MAREJIG_byId('marejig-progress-bar');
        var copy = MAREJIG_byId('marejig-loading-copy');
        if (bar) bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
        if (copy && label) copy.textContent = label;
    }

    function MAREJIG_setLoadingPreview(level) {
        var preview = MAREJIG_byId('marejig-loading-preview');
        if (!preview) return;
        preview.innerHTML = '<span class="marejig-loading-shimmer"></span>';

        var img = documentObject.createElement('img');
        img.className = 'marejig-loading-preview-img';
        img.alt = '';
        img.decoding = 'async';
        img.loading = 'eager';
        img.crossOrigin = 'anonymous';
        img.onerror = function MAREJIG_previewError() {
            img.remove();
        };
        img.src = MAREJIG_Cloudinary.buildTinyPlaceholderUrl(level);
        preview.appendChild(img);
    }

    function MAREJIG_drawReadyCanvas(level, imageResult, puzzle) {
        var canvas = MAREJIG_byId('marejig-canvas');
        if (!canvas) return;
        var context = canvas.getContext('2d');
        var width = canvas.width;
        var height = canvas.height;

        context.clearRect(0, 0, width, height);
        context.fillStyle = '#060914';
        context.fillRect(0, 0, width, height);

        if (imageResult && imageResult.drawable) {
            try {
                context.drawImage(imageResult.drawable, 0, 0, width, height);
                context.fillStyle = 'rgba(6, 9, 20, 0.28)';
                context.fillRect(0, 0, width, height);
            } catch (error) {
                console.warn('[MAREJIG] No se pudo dibujar imagen cargada', error.message);
                MAREJIG_drawFallbackCanvas(context, width, height, level);
            }
        } else {
            MAREJIG_drawFallbackCanvas(context, width, height, level);
        }

        if (puzzle && puzzle.validation && puzzle.validation.ok) {
            MAREJIG_drawPuzzleWireframe(context, width, height, puzzle);
        } else {
            MAREJIG_drawGridPreview(context, width, height);
        }
    }

    function MAREJIG_drawFallbackCanvas(context, width, height, level) {
        var gradient = context.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#162447');
        gradient.addColorStop(0.52, '#1f4068');
        gradient.addColorStop(1, '#1b1b2f');
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height);
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.font = '700 54px system-ui, sans-serif';
        context.textAlign = 'center';
        context.fillText(level.title, width / 2, height / 2);
    }

    function MAREJIG_drawGridPreview(context, width, height) {
        var cols = 16;
        var rows = 12;
        context.save();
        context.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        context.lineWidth = 1;
        for (var x = 1; x < cols; x += 1) {
            context.beginPath();
            context.moveTo((width / cols) * x, 0);
            context.lineTo((width / cols) * x, height);
            context.stroke();
        }
        for (var y = 1; y < rows; y += 1) {
            context.beginPath();
            context.moveTo(0, (height / rows) * y);
            context.lineTo(width, (height / rows) * y);
            context.stroke();
        }
        context.restore();
    }

    function MAREJIG_drawPuzzleWireframe(context, width, height, puzzle) {
        var cellW = width / puzzle.board.cols;
        var cellH = height / puzzle.board.rows;
        var segmentColors = ['rgba(119, 247, 228, 0.20)', 'rgba(184, 163, 255, 0.20)', 'rgba(255, 209, 102, 0.20)', 'rgba(255, 112, 122, 0.18)', 'rgba(111, 176, 255, 0.18)', 'rgba(166, 255, 130, 0.18)'];

        context.save();
        puzzle.segments.order.forEach(function MAREJIG_fillSegment(segmentId, index) {
            var segment = puzzle.segments.items[segmentId];
            context.fillStyle = segmentColors[index % segmentColors.length];
            segment.pieceIds.forEach(function MAREJIG_fillPiece(pieceId) {
                var piece = puzzle.pieces[pieceId];
                piece.cells.forEach(function MAREJIG_fillCell(cell) {
                    context.fillRect((piece.solution.gridX + cell.x) * cellW, (piece.solution.gridY + cell.y) * cellH, cellW, cellH);
                });
            });
        });

        Object.keys(puzzle.pieces).forEach(function MAREJIG_strokePiece(pieceId) {
            var piece = puzzle.pieces[pieceId];
            context.strokeStyle = piece.segmentId === 's_0' ? 'rgba(119, 247, 228, 0.92)' : 'rgba(255, 255, 255, 0.52)';
            context.lineWidth = piece.segmentId === 's_0' ? 2.2 : 1.25;
            piece.outline.segments.forEach(function MAREJIG_strokeSegment(segment) {
                context.beginPath();
                context.moveTo(segment.x1 * cellW, segment.y1 * cellH);
                context.lineTo(segment.x2 * cellW, segment.y2 * cellH);
                context.stroke();
            });
        });
        context.restore();
    }

    function MAREJIG_renderLevelDetails(level, imageResult, puzzle) {
        var details = MAREJIG_byId('marejig-level-details');
        var title = MAREJIG_byId('marejig-game-title');
        var pack = MAREJIG_byId('marejig-game-pack');
        var readyCopy = MAREJIG_byId('marejig-ready-copy');
        var profile = imageResult ? imageResult.profile : MAREJIG_Cloudinary.getRuntimeProfile();
        var imageStatus = imageResult && imageResult.failed ? 'Fallback visual' : 'Imagen cargada';
        var validation = puzzle && puzzle.validation ? puzzle.validation : null;
        var firstSegmentId = puzzle && puzzle.segments && puzzle.segments.order.length ? puzzle.segments.order[0] : '—';
        var firstSegment = puzzle && puzzle.segments ? puzzle.segments.items[firstSegmentId] : null;
        var distribution = validation && validation.sizeDistribution ? Object.keys(validation.sizeDistribution).sort().map(function MAREJIG_sizeEntry(size) {
            return size + ':' + validation.sizeDistribution[size];
        }).join(' · ') : '—';

        if (title) title.textContent = level.title;
        if (pack) pack.textContent = level.pack + ' · ' + level.difficulty;
        if (readyCopy) {
            readyCopy.textContent = imageStatus + '. Puzzle geométrico generado: ' + (validation && validation.ok ? 'OK' : 'ERROR') + '.';
        }
        if (!details) return;

        details.innerHTML = [
            MAREJIG_detailRow('Nivel', level.id),
            MAREJIG_detailRow('Pack', level.pack),
            MAREJIG_detailRow('Board', level.board.cols + '×' + level.board.rows),
            MAREJIG_detailRow('Piezas objetivo', String(level.targetPieceCount)),
            MAREJIG_detailRow('Segmentos', level.segmentPlan.join(' · ')),
            MAREJIG_detailRow('Recompensa', '+' + level.rewardCoins + ' monedas'),
            MAREJIG_detailRow('Imagen runtime', profile),
            MAREJIG_detailRow('Estado imagen', imageStatus),
            MAREJIG_detailRow('Seed', puzzle ? String(puzzle.seed) : '—'),
            MAREJIG_detailRow('Piezas generadas', validation ? String(validation.pieceCount) : '—'),
            MAREJIG_detailRow('Segmentos generados', puzzle ? String(puzzle.segments.order.length) : '—'),
            MAREJIG_detailRow('Validación', validation && validation.ok ? 'OK' : 'ERROR'),
            MAREJIG_detailRow('Distribución', distribution),
            MAREJIG_detailRow('Primer segmento', firstSegment ? firstSegmentId + ' · ' + firstSegment.pieceIds.length + ' piezas · revelado' : '—'),
            MAREJIG_detailRow('Advertencias', validation && validation.warnings && validation.warnings.length ? validation.warnings.join(' · ') : 'Sin advertencias')
        ].join('');
    }

    function MAREJIG_detailRow(label, value) {
        return '<div class="marejig-detail-row"><span>' + MAREJIG_escape(label) + '</span><span>' + MAREJIG_escape(value) + '</span></div>';
    }

    function MAREJIG_escape(value) {
        return String(value).replace(/[&<>'"]/g, function MAREJIG_replaceUnsafe(char) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '\'': '&#39;',
                '"': '&quot;'
            }[char];
        });
    }

    function MAREJIG_startLevel(levelId) {
        var level = MAREJIG_LevelCatalog.getById(levelId);
        if (!level) {
            console.warn('[MAREJIG] Nivel no encontrado', levelId);
            return;
        }

        MAREJIG_currentLevelId = levelId;
        MAREJIG_State.setState({ selectedLevelId: levelId, loading: true, lastError: null });
        MAREJIG_showScreen('loading');
        MAREJIG_setProgress(8, 'Preparando metadatos');
        MAREJIG_setLoadingPreview(level);

        var profile = MAREJIG_Cloudinary.getRuntimeProfile();
        MAREJIG_ImageLoader.loadPlayableImage(level, profile, MAREJIG_setProgress)
            .then(function MAREJIG_levelLoaded(imageResult) {
                if (MAREJIG_currentLevelId !== levelId) return;
                var puzzle = MAREJIG_Generator.generate(level);
                MAREJIG_State.setState({ loading: false, selectedRuntimeProfile: profile, loadedImageResult: imageResult, puzzle: puzzle });
                MAREJIG_Storage.saveActiveSave({
                    levelId: level.id,
                    runtimeProfile: profile,
                    phase: 'geometry_ready',
                    imageLoaded: !imageResult.failed,
                    puzzleSeed: puzzle.seed,
                    puzzleValid: Boolean(puzzle.validation && puzzle.validation.ok)
                });
                MAREJIG_drawReadyCanvas(level, imageResult, puzzle);
                MAREJIG_renderLevelDetails(level, imageResult, puzzle);
                MAREJIG_showScreen('game');
            })
            .catch(function MAREJIG_levelLoadFatal(error) {
                console.warn('[MAREJIG] Error fatal al preparar nivel', error.message);
                MAREJIG_State.setState({ loading: false, lastError: error.message });
                MAREJIG_showError(error.message);
            });
    }

    function MAREJIG_showError(message) {
        var copy = MAREJIG_byId('marejig-error-copy');
        if (copy) copy.textContent = message || 'Puedes reintentar o volver al catálogo.';
        MAREJIG_showScreen('error');
    }

    function MAREJIG_backToMenu() {
        MAREJIG_currentLevelId = null;
        MAREJIG_Menu.mountPendingLevels();
        MAREJIG_showScreen('menu');
    }

    function MAREJIG_retryCurrentLevel() {
        var state = MAREJIG_State.getState();
        var levelId = state.selectedLevelId || MAREJIG_currentLevelId;
        if (levelId) {
            MAREJIG_startLevel(levelId);
        } else {
            MAREJIG_backToMenu();
        }
    }

    function MAREJIG_wireUi() {
        var cancel = MAREJIG_byId('marejig-cancel-loading');
        var back = MAREJIG_byId('marejig-back-to-menu');
        var errorBack = MAREJIG_byId('marejig-error-back');
        var retry = MAREJIG_byId('marejig-retry-level');

        if (cancel) cancel.addEventListener('click', MAREJIG_backToMenu);
        if (back) back.addEventListener('click', MAREJIG_backToMenu);
        if (errorBack) errorBack.addEventListener('click', MAREJIG_backToMenu);
        if (retry) retry.addEventListener('click', MAREJIG_retryCurrentLevel);
    }

    function MAREJIG_init() {
        var validation = MAREJIG_LevelCatalog.validateCatalog();
        if (!validation.valid) {
            console.warn('[MAREJIG] Catálogo con advertencias', validation.errors);
        }
        MAREJIG_Storage.getSettings();
        MAREJIG_wireUi();
        MAREJIG_Menu.mountPendingLevels();
        MAREJIG_showScreen('menu');
        console.info('[MAREJIG] Scaffold inicializado');
    }

    if (documentObject.readyState === 'loading') {
        documentObject.addEventListener('DOMContentLoaded', MAREJIG_init, { once: true });
    } else {
        MAREJIG_init();
    }

    windowObject.MAREJIG_Main = Object.freeze({
        startLevel: MAREJIG_startLevel,
        backToMenu: MAREJIG_backToMenu
    });
})(window, document);
