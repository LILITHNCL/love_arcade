(function MAREJIG_mainModule(windowObject, documentObject) {
    'use strict';

    var MAREJIG_LevelCatalog = windowObject.MAREJIG_LevelCatalog;
    var MAREJIG_Cloudinary = windowObject.MAREJIG_Cloudinary;
    var MAREJIG_ImageLoader = windowObject.MAREJIG_ImageLoader;
    var MAREJIG_Menu = windowObject.MAREJIG_Menu;
    var MAREJIG_State = windowObject.MAREJIG_State;
    var MAREJIG_Storage = windowObject.MAREJIG_Storage;
    var MAREJIG_Generator = windowObject.MAREJIG_Generator;
    var MAREJIG_Scene = windowObject.MAREJIG_Scene;
    var MAREJIG_Renderer = windowObject.MAREJIG_Renderer;
    var MAREJIG_Input = windowObject.MAREJIG_Input;
    var MAREJIG_Segments = windowObject.MAREJIG_Segments;
    var MAREJIG_Economy = windowObject.MAREJIG_Economy;

    var MAREJIG_currentLevelId = null;
    var MAREJIG_rendererReady = false;
    var MAREJIG_timerId = 0;
    var MAREJIG_timerStartedAt = 0;
    var MAREJIG_lastFocus = null;
    var MAREJIG_startOptions = null;
    var MAREJIG_toastTimerId = 0;

    function MAREJIG_byId(id) { return documentObject.getElementById(id); }

    function MAREJIG_showScreen(name) {
        ['menu', 'loading', 'game', 'error'].forEach(function MAREJIG_toggleScreen(screen) {
            var element = MAREJIG_byId('marejig-screen-' + screen);
            if (!element) return;
            var visible = screen === name;
            element.hidden = !visible;
            element.classList.toggle('marejig-screen-current', visible);
        });
        documentObject.body.classList.toggle('marejig-is-playing', name === 'game');
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
        img.onerror = function MAREJIG_previewError() { img.remove(); };
        img.src = MAREJIG_Cloudinary.buildTinyPlaceholderUrl(level);
        preview.appendChild(img);
    }

    function MAREJIG_escape(value) {
        return String(value).replace(/[&<>'"]/g, function MAREJIG_replaceUnsafe(char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[char];
        });
    }

    function MAREJIG_detailRow(label, value) {
        return '<div class="marejig-detail-row"><span>' + MAREJIG_escape(label) + '</span><span>' + MAREJIG_escape(value) + '</span></div>';
    }

    function MAREJIG_isDebugEnabled() {
        var configDebug = windowObject.MAREJIG_Config && windowObject.MAREJIG_Config.debug && windowObject.MAREJIG_Config.debug.enabled;
        var queryDebug = false;
        try { queryDebug = new URL(windowObject.location && windowObject.location.href || 'https://local/').searchParams.get('debug') === '1'; } catch (error) { queryDebug = false; }
        return Boolean(configDebug || queryDebug);
    }

    function MAREJIG_applyDebugVisibility() {
        var enabled = MAREJIG_isDebugEnabled();
        documentObject.querySelectorAll('.marejig-debug-only').forEach(function MAREJIG_toggleDebug(element) {
            element.hidden = !enabled;
        });
        return enabled;
    }

    function MAREJIG_formatTime(ms) {
        var totalSeconds = Math.floor(Math.max(0, ms || 0) / 1000);
        var minutes = Math.floor(totalSeconds / 60);
        var seconds = totalSeconds % 60;
        return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }

    function MAREJIG_getElapsed(scene) {
        var base = scene && scene.progress ? Number(scene.progress.elapsedMs) || 0 : 0;
        if (MAREJIG_timerStartedAt && scene && scene.progress && scene.progress.gamePhase === 'playing') {
            return base + Date.now() - MAREJIG_timerStartedAt;
        }
        return base;
    }

    function MAREJIG_commitElapsed(scene) {
        if (!scene || !scene.progress || !MAREJIG_timerStartedAt) return;
        scene.progress.elapsedMs = MAREJIG_getElapsed(scene);
        MAREJIG_timerStartedAt = 0;
    }

    function MAREJIG_startTimer(scene) {
        MAREJIG_stopHudTimer(false);
        if (!scene || !scene.progress || scene.progress.gamePhase !== 'playing') return;
        MAREJIG_timerStartedAt = Date.now();
        MAREJIG_timerId = windowObject.setInterval(function MAREJIG_timerTick() {
            var state = MAREJIG_State.getState();
            if (state.scene) MAREJIG_updateHud(state.scene.level, state.puzzle, state.loadedImageResult, state.scene);
        }, 1000);
    }

    function MAREJIG_pauseTimer() {
        var state = MAREJIG_State.getState();
        if (state.scene) MAREJIG_commitElapsed(state.scene);
        MAREJIG_stopHudTimer(false);
    }

    function MAREJIG_stopHudTimer(commit) {
        if (commit) MAREJIG_pauseTimer();
        if (MAREJIG_timerId) windowObject.clearInterval(MAREJIG_timerId);
        MAREJIG_timerId = 0;
        MAREJIG_timerStartedAt = 0;
    }

    function MAREJIG_getCompletedSegmentIds(scene) {
        return scene.puzzle.segments.order.filter(function MAREJIG_completedSegment(segmentId) {
            return scene.puzzle.segments.items[segmentId] && scene.puzzle.segments.items[segmentId].completed;
        });
    }

    function MAREJIG_getRevealedSegmentIds(scene) {
        return scene.puzzle.segments.order.filter(function MAREJIG_revealedSegment(segmentId) {
            return scene.puzzle.segments.items[segmentId] && scene.puzzle.segments.items[segmentId].revealed;
        });
    }

    function MAREJIG_countPlacedPieces(scene) {
        return scene.progress.mainGroupId && scene.groups[scene.progress.mainGroupId] ? scene.groups[scene.progress.mainGroupId].pieceIds.length : MAREJIG_Segments.getSegmentStats(scene).connectedInSegment;
    }

    function MAREJIG_buildActiveSave(scene) {
        return {
            levelId: scene.level.id,
            puzzleSeed: scene.puzzle.seed,
            generatorVersion: scene.puzzle.generatorVersion,
            elapsedMs: MAREJIG_getElapsed(scene),
            moves: scene.progress.moves,
            currentSegmentIndex: scene.puzzle.segments.currentSegmentIndex || 0,
            completedSegmentIds: MAREJIG_getCompletedSegmentIds(scene),
            revealedSegmentIds: MAREJIG_getRevealedSegmentIds(scene),
            mainGroupId: scene.progress.mainGroupId,
            puzzleCompletedLocal: scene.progress.puzzleCompletedLocal,
            completionStarted: scene.progress.completionStarted,
            rewardReported: scene.progress.rewardReported,
            pieces: Object.keys(scene.pieces).sort().map(function MAREJIG_pieceSave(pieceId) {
                var piece = scene.pieces[pieceId];
                return { pieceId: pieceId, groupId: piece.groupId, revealed: Boolean(piece.visible), locked: Boolean(piece.locked) };
            }),
            groups: Object.keys(scene.groups).sort().map(function MAREJIG_groupSave(groupId) {
                var group = scene.groups[groupId];
                return { groupId: groupId, pieceIds: group.pieceIds.slice(), x: group.x, y: group.y, zIndex: group.zIndex, lockedToBoard: Boolean(group.lockedToBoard), visible: Boolean(group.visible) };
            })
        };
    }

    function MAREJIG_saveGame(reason) {
        var state = MAREJIG_State.getState();
        if (!state.scene || !state.puzzle || !state.selectedLevelId) return false;
        if (state.scene.progress && state.scene.progress.gamePhase === 'completed') return true;
        MAREJIG_commitElapsed(state.scene);
        var savePill = MAREJIG_byId('marejig-hud-save');
        if (savePill) savePill.textContent = 'Guardando…';
        var save = MAREJIG_buildActiveSave(state.scene);
        var ok = MAREJIG_Storage.saveActiveSave(save);
        MAREJIG_Storage.saveLevelProgress(state.selectedLevelId, {
            elapsedMs: save.elapsedMs,
            moves: save.moves,
            currentSegmentIndex: save.currentSegmentIndex,
            completedSegmentCount: save.completedSegmentIds.length,
            placedPieceCount: MAREJIG_countPlacedPieces(state.scene),
            totalPieceCount: Object.keys(state.puzzle.pieces).length,
            puzzleSeed: save.puzzleSeed,
            generatorVersion: save.generatorVersion
        });
        if (state.scene.progress) state.scene.progress.status = ok ? 'Guardado' : 'Sin guardar';
        MAREJIG_updateHud(state.scene.level, state.puzzle, state.loadedImageResult, state.scene);
        if (state.scene.progress && state.scene.progress.gamePhase === 'playing') MAREJIG_timerStartedAt = Date.now();
        return ok;
    }

    function MAREJIG_updateHud(level, puzzle, imageResult, scene) {
        var stats = scene && MAREJIG_Segments ? MAREJIG_Segments.getSegmentStats(scene) : null;
        var activeSegmentId = stats ? stats.activeSegmentId : null;
        var activeSegment = activeSegmentId ? puzzle.segments.items[activeSegmentId] : null;
        var moves = scene && scene.progress ? scene.progress.moves : 0;
        var imageStatus = imageResult && imageResult.failed ? 'Fallback visual' : 'Imagen cargada';
        MAREJIG_applyDebugVisibility();
        var saveStatus = MAREJIG_Storage.getLastSaveStatus();
        var values = {
            'marejig-hud-time': 'Tiempo ' + MAREJIG_formatTime(MAREJIG_getElapsed(scene)),
            'marejig-hud-reward': 'Movs ' + moves,
            'marejig-hud-segment': activeSegmentId ? (stats.activeSegmentIndex + 1) + '/' + puzzle.segments.order.length : '—',
            'marejig-hud-visible': activeSegment ? stats.connectedInSegment + '/' + activeSegment.pieceIds.length + ' conectadas' : '0/0 conectadas',
            'marejig-hud-total': puzzle && puzzle.validation ? puzzle.validation.pieceCount + ' piezas' : '0 piezas',
            'marejig-hud-image': imageStatus,
            'marejig-hud-save': saveStatus.label || 'Sin guardar'
        };
        Object.keys(values).forEach(function MAREJIG_setHudValue(id) {
            var element = MAREJIG_byId(id);
            if (element) element.textContent = values[id];
        });
        var progress = MAREJIG_byId('marejig-segment-progress');
        if (progress && activeSegment) {
            var ratio = activeSegment.pieceIds.length ? stats.connectedInSegment / activeSegment.pieceIds.length : 0;
            progress.style.setProperty('--marejig-progress', Math.max(0, Math.min(100, ratio * 100)).toFixed(1) + '%');
        }
    }

    function MAREJIG_renderLevelDetails(level, imageResult, puzzle) {
        var details = MAREJIG_byId('marejig-level-details');
        var title = MAREJIG_byId('marejig-game-title');
        var pack = MAREJIG_byId('marejig-game-pack');
        var readyCopy = MAREJIG_byId('marejig-ready-copy');
        var badge = documentObject.querySelector('.marejig-ready-badge');
        var profile = imageResult ? imageResult.profile : MAREJIG_Cloudinary.getRuntimeProfile();
        var imageStatus = imageResult && imageResult.failed ? 'Fallback visual' : 'Imagen cargada';
        var validation = puzzle && puzzle.validation ? puzzle.validation : null;
        var debugEnabled = MAREJIG_applyDebugVisibility();
        if (title) title.textContent = level.title;
        if (pack) pack.textContent = level.pack + ' · ' + level.difficulty;
        if (badge) badge.textContent = 'Debug';
        if (readyCopy) readyCopy.textContent = imageStatus + '. Datos técnicos visibles solo en modo debug.';
        if (!details) return;
        if (!debugEnabled) {
            details.innerHTML = '';
            return;
        }
        details.innerHTML = [
            MAREJIG_detailRow('Nivel', level.id),
            MAREJIG_detailRow('Pack', level.pack),
            MAREJIG_detailRow('Board', level.board.cols + '×' + level.board.rows),
            MAREJIG_detailRow('Recompensa', '+' + level.rewardCoins + ' monedas'),
            MAREJIG_detailRow('Imagen runtime', profile),
            MAREJIG_detailRow('Seed', puzzle ? String(puzzle.seed) : '—'),
            MAREJIG_detailRow('Generador', puzzle ? String(puzzle.generatorVersion) : '—'),
            MAREJIG_detailRow('Piezas', validation ? String(validation.pieceCount) : '—'),
            MAREJIG_detailRow('Segmentos', puzzle ? String(puzzle.segments.order.length) : '—')
        ].join('');
    }


    function MAREJIG_showToast(message) {
        var toast = MAREJIG_byId('marejig-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.hidden = false;
        if (MAREJIG_toastTimerId) windowObject.clearTimeout(MAREJIG_toastTimerId);
        MAREJIG_toastTimerId = windowObject.setTimeout(function MAREJIG_hideToastLater() {
            toast.hidden = true;
            MAREJIG_toastTimerId = 0;
        }, 1800);
    }

    function MAREJIG_getReducedMotion() {
        var settings = MAREJIG_Storage.getSettings();
        var mediaReduce = windowObject.matchMedia && windowObject.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return Boolean(settings.reducedMotion || mediaReduce);
    }

    function MAREJIG_openModal(id, focusId) {
        var modal = MAREJIG_byId(id);
        if (!modal) return;
        MAREJIG_lastFocus = documentObject.activeElement;
        modal.hidden = false;
        documentObject.body.classList.add('marejig-modal-open');
        var target = focusId ? MAREJIG_byId(focusId) : modal.querySelector('button');
        if (target && target.focus) target.focus();
    }

    function MAREJIG_closeModal(id) {
        var modal = MAREJIG_byId(id);
        if (modal) modal.hidden = true;
        if (!documentObject.querySelector('.marejig-modal:not([hidden])')) documentObject.body.classList.remove('marejig-modal-open');
        if (MAREJIG_lastFocus && MAREJIG_lastFocus.focus) MAREJIG_lastFocus.focus();
    }

    function MAREJIG_openHelp() { MAREJIG_openModal('marejig-help-modal', 'marejig-help-ok'); }
    function MAREJIG_closeHelp() { MAREJIG_closeModal('marejig-help-modal'); }
    function MAREJIG_openPause() { MAREJIG_syncSettingsButtons(); MAREJIG_openModal('marejig-pause-modal', 'marejig-pause-continue'); }
    function MAREJIG_closePause() { MAREJIG_closeModal('marejig-pause-modal'); }
    function MAREJIG_openResetConfirm() { MAREJIG_closePause(); MAREJIG_openModal('marejig-confirm-reset-modal', 'marejig-reset-cancel'); }
    function MAREJIG_closeResetConfirm() { MAREJIG_closeModal('marejig-confirm-reset-modal'); }

    function MAREJIG_syncSettingsButtons() {
        var settings = MAREJIG_Storage.getSettings();
        var haptics = MAREJIG_byId('marejig-toggle-haptics');
        var sound = MAREJIG_byId('marejig-toggle-sound');
        if (haptics) haptics.textContent = 'Haptics: ' + (settings.haptics === false ? 'off' : 'on');
        if (sound) sound.textContent = 'Sonido: ' + (settings.sound === false ? 'off' : 'on');
    }

    function MAREJIG_toggleSetting(name) {
        var settings = MAREJIG_Storage.getSettings();
        var next = {};
        next[name] = settings[name] === false;
        MAREJIG_Storage.saveSettings(next);
        if (name === 'sound' && windowObject.MAREJIG_Audio) windowObject.MAREJIG_Audio.setEnabled(next[name]);
        MAREJIG_syncSettingsButtons();
        MAREJIG_showToast('Preferencia guardada');
    }


    function MAREJIG_confirmResetLevel() {
        var state = MAREJIG_State.getState();
        var levelId = state.selectedLevelId || MAREJIG_currentLevelId;
        if (!levelId) return;
        MAREJIG_closeResetConfirm();
        MAREJIG_pauseTimer();
        MAREJIG_Input.detach();
        MAREJIG_Storage.clearActiveSave();
        MAREJIG_Storage.clearLevelProgress(levelId);
        MAREJIG_showToast('Nivel reiniciado');
        MAREJIG_startLevel(levelId, { forceNew: true, replay: MAREJIG_Storage.isLevelCompleted(levelId) });
    }

    function MAREJIG_ensureRenderer() {
        var canvas = MAREJIG_byId('marejig-canvas');
        if (!canvas || MAREJIG_rendererReady) return;
        MAREJIG_Renderer.init(canvas);
        MAREJIG_rendererReady = true;
    }

    function MAREJIG_getUsableActiveSave(levelId) {
        var save = MAREJIG_Storage.getActiveSave();
        if (!save) return null;
        if (MAREJIG_Storage.isLevelCompleted(save.levelId)) {
            MAREJIG_Storage.clearActiveSave();
            MAREJIG_Storage.clearLevelProgress(save.levelId);
            return null;
        }
        return !levelId || save.levelId === levelId ? save : null;
    }

    function MAREJIG_confirmReplacingActiveSave(levelId) {
        var active = MAREJIG_getUsableActiveSave();
        if (!active || active.levelId === levelId) return 'start';
        var currentLevel = MAREJIG_LevelCatalog.getById(active.levelId);
        var message = 'Hay una partida activa en "' + (currentLevel ? currentLevel.title : active.levelId) + '".\n\nAceptar: Continuar partida actual\nCancelar: elegir opciones para reemplazar o cancelar.';
        if (windowObject.confirm(message)) return 'continue-active';
        if (windowObject.confirm('Empezar nuevo nivel y reemplazar progreso?')) return 'replace';
        return 'cancel';
    }

    function MAREJIG_startLevel(levelId, options) {
        var decision = options && options.forceNew ? 'replace' : MAREJIG_confirmReplacingActiveSave(levelId);
        var active = MAREJIG_getUsableActiveSave();
        if (decision === 'cancel') return;
        if (decision === 'continue-active' && active) { levelId = active.levelId; options = { resume: true }; }
        if (decision === 'replace') { MAREJIG_Storage.clearActiveSave(); MAREJIG_Storage.clearLevelProgress(levelId); options = Object.assign({}, options || {}, { forceNew: true }); }

        var level = MAREJIG_LevelCatalog.getById(levelId);
        if (!level) { console.warn('[MAREJIG] Nivel no encontrado', levelId); return; }
        var save = options && options.forceNew ? null : MAREJIG_getUsableActiveSave(levelId);
        if (MAREJIG_Storage.isLevelCompleted(levelId) && !(options && options.replay)) save = null;

        MAREJIG_pauseTimer();
        MAREJIG_currentLevelId = levelId;
        MAREJIG_startOptions = options || {};
        MAREJIG_State.setState({ selectedLevelId: levelId, loading: true, lastError: null });
        MAREJIG_showScreen('loading');
        MAREJIG_setProgress(8, save ? 'Preparando reanudación' : 'Preparando metadatos');
        MAREJIG_setLoadingPreview(level);

        var profile = MAREJIG_Cloudinary.getRuntimeProfile();
        MAREJIG_ImageLoader.loadPlayableImage(level, profile, MAREJIG_setProgress).then(function MAREJIG_levelLoaded(imageResult) {
            if (MAREJIG_currentLevelId !== levelId) return;
            var puzzle = MAREJIG_Generator.generate(level);
            var scene = MAREJIG_Scene.createScene(level, puzzle, imageResult);
            if (save) MAREJIG_Scene.applySave(scene, save);
            if (MAREJIG_Storage.isLevelCompleted(level.id) && MAREJIG_startOptions && MAREJIG_startOptions.replay) scene.progress.rewardSkipped = true;
            scene.progress.gamePhase = scene.progress.puzzleCompletedLocal ? 'completed' : 'playing';
            MAREJIG_State.setState({ loading: false, selectedRuntimeProfile: profile, loadedImageResult: imageResult, puzzle: puzzle, scene: scene });
            MAREJIG_showScreen('game');
            MAREJIG_ensureRenderer();
            MAREJIG_Renderer.setScene(scene);
            MAREJIG_Input.attach(MAREJIG_byId('marejig-canvas'), scene, MAREJIG_Renderer, {
                onSelect: function MAREJIG_inputSelect() { MAREJIG_updateHud(level, puzzle, imageResult, scene); },
                onMoveEnd: function MAREJIG_inputMoveEnd() {
                    var segmentResult = MAREJIG_Segments.advanceIfSegmentComplete(scene);
                    if (segmentResult.completed) {
                        MAREJIG_showToast(segmentResult.revealed ? 'Segmento desbloqueado' : 'Segmento completado');
                        if (segmentResult.revealed && scene.cameraTarget && MAREJIG_Renderer.animateCameraTo) MAREJIG_Renderer.animateCameraTo(scene.cameraTarget, MAREJIG_getReducedMotion() ? 0 : 280);
                        MAREJIG_saveGame('segment');
                    }
                    if (segmentResult.puzzleComplete) MAREJIG_completePuzzle(scene);
                    else MAREJIG_updateHud(level, puzzle, imageResult, scene);
                    MAREJIG_Renderer.markDirty('input-end');
                }
            });
            MAREJIG_renderLevelDetails(level, imageResult, puzzle);
            MAREJIG_updateHud(level, puzzle, imageResult, scene);
            if (scene.progress.gamePhase === 'playing') {
                MAREJIG_saveGame(save ? 'resume' : 'start');
                MAREJIG_startTimer(scene);
            } else if (scene.progress.puzzleCompletedLocal && !scene.progress.rewardReported) {
                MAREJIG_completePuzzle(scene);
            } else {
                MAREJIG_showVictory(scene, { ok: true, mode: 'already-reported', coins: Math.max(1, Math.floor(level.rewardCoins)), rewardLevelId: 'level_' + level.id });
            }
        }).catch(function MAREJIG_levelLoadFatal(error) {
            console.warn('[MAREJIG] Error fatal al preparar nivel', error.message);
            MAREJIG_State.setState({ loading: false, lastError: error.message });
            MAREJIG_showError(error.message);
        });
    }

    function MAREJIG_completePuzzle(scene) {
        if (!scene || !scene.progress) return;
        if (scene.progress.completionStarted && scene.progress.gamePhase === 'completing') return;
        if (scene.progress.completionStarted && scene.progress.gamePhase === 'completed' && (scene.progress.rewardReported || scene.progress.rewardSkipped || MAREJIG_Storage.isLevelCompleted(scene.level.id))) return;
        scene.progress.completionStarted = true;
        scene.progress.gamePhase = 'completing';
        scene.progress.status = 'Completando';
        MAREJIG_Input.cancelInteraction();
        MAREJIG_commitElapsed(scene);
        MAREJIG_stopHudTimer(false);
        MAREJIG_saveGame('complete');
        scene.ui.message = '¡Puzzle completado!';
        scene.ui.dirty = true;
        MAREJIG_Renderer.markDirty('victory');
        var reduce = windowObject.matchMedia && windowObject.matchMedia('(prefers-reduced-motion: reduce)').matches;
        windowObject.setTimeout(function MAREJIG_afterVictoryAnimation() {
            var metrics = {
                elapsedMs: scene.progress.elapsedMs,
                moves: scene.progress.moves,
                    rewardReported: scene.progress.rewardReported || scene.progress.rewardSkipped
            };
            var economy = MAREJIG_Economy.reportLevelCompleted(scene.level, metrics);
            scene.progress.rewardReported = economy.ok && economy.mode === 'gamecenter';
            scene.progress.gamePhase = 'completed';
            scene.progress.status = 'Completado';
            MAREJIG_Storage.markLevelCompleted(scene.level, {
                elapsedMs: metrics.elapsedMs,
                moves: metrics.moves,
                rewardReported: scene.progress.rewardReported,
                rewardLevelId: economy.rewardLevelId,
                rewardCoins: economy.coins
            });
            MAREJIG_Storage.clearActiveSave();
            MAREJIG_Storage.clearLevelProgress(scene.level.id);
            MAREJIG_Menu.refreshAfterCompletion();
            MAREJIG_updateHud(scene.level, scene.puzzle, MAREJIG_State.getState().loadedImageResult, scene);
            MAREJIG_showVictory(scene, economy);
        }, reduce ? 0 : 520);
    }

    function MAREJIG_showVictory(scene, economy) {
        var modal = MAREJIG_byId('marejig-victory-modal');
        if (!modal) return;
        MAREJIG_lastFocus = documentObject.activeElement;
        MAREJIG_byId('marejig-victory-title').textContent = '¡Nivel completado!';
        MAREJIG_byId('marejig-victory-level').textContent = scene.level.title;
        MAREJIG_byId('marejig-victory-pack').textContent = scene.level.pack;
        MAREJIG_byId('marejig-victory-time').textContent = MAREJIG_formatTime(scene.progress.elapsedMs);
        MAREJIG_byId('marejig-victory-moves').textContent = String(scene.progress.moves);
        MAREJIG_byId('marejig-victory-coins').textContent = '+' + economy.coins;
        MAREJIG_byId('marejig-victory-status').textContent = economy.mode === 'gamecenter' ? 'Monedas acreditadas' : 'Modo standalone: monedas no acreditadas';
        modal.hidden = false;
        documentObject.body.classList.add('marejig-modal-open');
        MAREJIG_pauseTimer();
        var next = MAREJIG_byId('marejig-victory-next');
        if (next) next.focus();
    }

    function MAREJIG_hideVictory() {
        var modal = MAREJIG_byId('marejig-victory-modal');
        if (modal) modal.hidden = true;
        if (!documentObject.querySelector('.marejig-modal:not([hidden])')) documentObject.body.classList.remove('marejig-modal-open');
        if (MAREJIG_lastFocus && MAREJIG_lastFocus.focus) MAREJIG_lastFocus.focus();
    }

    function MAREJIG_startNextPending() {
        MAREJIG_hideVictory();
        var pending = MAREJIG_Menu.getPendingLevels ? MAREJIG_Menu.getPendingLevels() : [];
        if (pending.length) MAREJIG_startLevel(pending[0].id, { forceNew: true });
        else MAREJIG_backToMenu();
    }

    function MAREJIG_showError(message) {
        var copy = MAREJIG_byId('marejig-error-copy');
        if (copy) copy.textContent = message || 'Puedes reintentar o volver al catálogo.';
        MAREJIG_showScreen('error');
    }

    function MAREJIG_backToMenu() {
        var state = MAREJIG_State.getState();
        var releaseLevelId = (state && state.selectedLevelId) || MAREJIG_currentLevelId;
        MAREJIG_pauseTimer();
        MAREJIG_saveGame('menu');
        MAREJIG_Input.detach();
        if (releaseLevelId && MAREJIG_ImageLoader && typeof MAREJIG_ImageLoader.releaseFullImage === 'function') {
            MAREJIG_ImageLoader.releaseFullImage(releaseLevelId);
        }
        MAREJIG_currentLevelId = null;
        MAREJIG_State.setState({ selectedLevelId: null, selectedRuntimeProfile: null, loadedImageResult: null, puzzle: null, scene: null, loading: false });
        MAREJIG_Menu.mountPendingLevels();
        MAREJIG_showScreen('menu');
    }

    function MAREJIG_retryCurrentLevel() {
        var state = MAREJIG_State.getState();
        var levelId = state.selectedLevelId || MAREJIG_currentLevelId;
        if (levelId) MAREJIG_startLevel(levelId, { forceNew: true, replay: true });
        else MAREJIG_backToMenu();
    }

    function MAREJIG_wireUi() {
        var cancel = MAREJIG_byId('marejig-cancel-loading');
        var back = MAREJIG_byId('marejig-back-to-menu');
        var errorBack = MAREJIG_byId('marejig-error-back');
        var retry = MAREJIG_byId('marejig-retry-level');
        var center = MAREJIG_byId('marejig-center-view');
        var pause = MAREJIG_byId('marejig-pause-button');
        var next = MAREJIG_byId('marejig-victory-next');
        var levels = MAREJIG_byId('marejig-victory-levels');
        var replay = MAREJIG_byId('marejig-victory-replay');
        var close = MAREJIG_byId('marejig-victory-close');
        var helpClose = MAREJIG_byId('marejig-help-close');
        var helpOk = MAREJIG_byId('marejig-help-ok');
        var pauseClose = MAREJIG_byId('marejig-pause-close');
        var pauseContinue = MAREJIG_byId('marejig-pause-continue');
        var pauseHelp = MAREJIG_byId('marejig-pause-help');
        var pauseLevels = MAREJIG_byId('marejig-pause-levels');
        var pauseReset = MAREJIG_byId('marejig-pause-reset');
        var recoverPieces = MAREJIG_byId('marejig-recover-pieces');
        var resetConfirm = MAREJIG_byId('marejig-reset-confirm');
        var resetCancel = MAREJIG_byId('marejig-reset-cancel');
        var haptics = MAREJIG_byId('marejig-toggle-haptics');
        var sound = MAREJIG_byId('marejig-toggle-sound');
        if (cancel) cancel.addEventListener('click', MAREJIG_backToMenu);
        if (back) back.addEventListener('click', MAREJIG_backToMenu);
        if (errorBack) errorBack.addEventListener('click', MAREJIG_backToMenu);
        if (retry) retry.addEventListener('click', MAREJIG_retryCurrentLevel);
        if (pause) pause.addEventListener('click', MAREJIG_openPause);
        if (next) next.addEventListener('click', MAREJIG_startNextPending);
        if (levels) levels.addEventListener('click', function MAREJIG_levelsClick() { MAREJIG_hideVictory(); MAREJIG_backToMenu(); });
        if (replay) replay.addEventListener('click', function MAREJIG_replayClick() { var state = MAREJIG_State.getState(); MAREJIG_hideVictory(); if (state.selectedLevelId) MAREJIG_startLevel(state.selectedLevelId, { forceNew: true, replay: true }); });
        if (close) close.addEventListener('click', function MAREJIG_closeClick() { MAREJIG_hideVictory(); });
        if (helpClose) helpClose.addEventListener('click', MAREJIG_closeHelp);
        if (helpOk) helpOk.addEventListener('click', MAREJIG_closeHelp);
        if (pauseClose) pauseClose.addEventListener('click', MAREJIG_closePause);
        if (pauseContinue) pauseContinue.addEventListener('click', MAREJIG_closePause);
        if (pauseHelp) pauseHelp.addEventListener('click', function MAREJIG_pauseHelpClick() { MAREJIG_closePause(); MAREJIG_openHelp(); });
        if (pauseLevels) pauseLevels.addEventListener('click', function MAREJIG_pauseLevelsClick() { MAREJIG_closePause(); MAREJIG_backToMenu(); });
        if (pauseReset) pauseReset.addEventListener('click', MAREJIG_openResetConfirm);
        if (recoverPieces) recoverPieces.addEventListener('click', function MAREJIG_recoverPiecesClick() {
            var state = MAREJIG_State.getState();
            if (state.scene) MAREJIG_Scene.ensureVisibleGroups(state.scene);
            MAREJIG_closePause();
            MAREJIG_Input.cancelInteraction();
            MAREJIG_Renderer.markDirty('recover');
        });
        if (resetConfirm) resetConfirm.addEventListener('click', MAREJIG_confirmResetLevel);
        if (resetCancel) resetCancel.addEventListener('click', MAREJIG_closeResetConfirm);
        if (haptics) haptics.addEventListener('click', function MAREJIG_hapticsClick() { MAREJIG_toggleSetting('haptics'); });
        if (sound) sound.addEventListener('click', function MAREJIG_soundClick() { MAREJIG_toggleSetting('sound'); });
        if (center) center.addEventListener('click', function MAREJIG_centerView() {
            var state = MAREJIG_State.getState();
            if (state.scene) MAREJIG_Scene.centerScene(state.scene);
            MAREJIG_Input.cancelInteraction();
            MAREJIG_Renderer.resize();
            MAREJIG_Renderer.markDirty('center');
        });
        documentObject.addEventListener('visibilitychange', function MAREJIG_visibilityChanged() {
            var state = MAREJIG_State.getState();
            if (documentObject.hidden) { MAREJIG_pauseTimer(); MAREJIG_saveGame('hidden'); }
            else if (state.scene && state.scene.progress && state.scene.progress.gamePhase === 'playing') MAREJIG_startTimer(state.scene);
        });
        windowObject.addEventListener('pagehide', function MAREJIG_pageHide() { MAREJIG_pauseTimer(); MAREJIG_saveGame('pagehide'); });
        documentObject.addEventListener('keydown', function MAREJIG_keydown(event) {
            if (event.key !== 'Escape') return;
            if (!MAREJIG_byId('marejig-help-modal').hidden) MAREJIG_closeHelp();
            else if (!MAREJIG_byId('marejig-pause-modal').hidden) MAREJIG_closePause();
            else MAREJIG_hideVictory();
        });
    }

    function MAREJIG_init() {
        var validation = MAREJIG_LevelCatalog.validateCatalog();
        if (!validation.valid) console.warn('[MAREJIG] Catálogo con advertencias', validation.errors);
        MAREJIG_Storage.getSettings();
        if (windowObject.MAREJIG_Audio) windowObject.MAREJIG_Audio.init();
        MAREJIG_getUsableActiveSave();
        MAREJIG_applyDebugVisibility();
        MAREJIG_wireUi();
        MAREJIG_Menu.mountPendingLevels();
        MAREJIG_showScreen('menu');
        console.info('[MAREJIG] Fase 8 RC inicializada');
    }

    if (documentObject.readyState === 'loading') documentObject.addEventListener('DOMContentLoaded', MAREJIG_init, { once: true });
    else MAREJIG_init();

    windowObject.MAREJIG_Main = Object.freeze({
        startLevel: MAREJIG_startLevel,
        backToMenu: MAREJIG_backToMenu,
        saveGame: MAREJIG_saveGame,
        resetCurrentLevelForDebug: MAREJIG_confirmResetLevel,
        completeCurrentForDebug: function MAREJIG_completeCurrentForDebug() {
            var state = MAREJIG_State.getState();
            if (!state.scene) return false;
            state.scene.puzzle.segments.order.forEach(function MAREJIG_debugCompleteSegment(segmentId) { state.scene.puzzle.segments.items[segmentId].completed = true; state.scene.puzzle.segments.items[segmentId].revealed = true; });
            state.scene.progress.puzzleCompletedLocal = true;
            MAREJIG_completePuzzle(state.scene);
            return true;
        }
    });
})(window, document);
