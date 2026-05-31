(function MAREJIG_menuModule(windowObject, documentObject) {
    'use strict';

    var MAREJIG_Config = windowObject.MAREJIG_Config;
    var MAREJIG_LevelCatalog = windowObject.MAREJIG_LevelCatalog;
    var MAREJIG_Cloudinary = windowObject.MAREJIG_Cloudinary;
    var MAREJIG_Storage = windowObject.MAREJIG_Storage;

    var MAREJIG_menuState = {
        levels: [],
        renderedCount: 0,
        observer: null,
        sentinelObserver: null,
        filtersInitialized: false,
        filters: { pack: '', difficulty: '' },
        elements: null
    };

    function MAREJIG_getElements() {
        if (MAREJIG_menuState.elements) return MAREJIG_menuState.elements;
        MAREJIG_menuState.elements = {
            grid: documentObject.getElementById('marejig-level-grid'),
            empty: documentObject.getElementById('marejig-empty-state'),
            loadMore: documentObject.getElementById('marejig-load-more'),
            sentinel: documentObject.getElementById('marejig-menu-sentinel'),
            pendingTotal: documentObject.getElementById('marejig-total-pending'),
            filterBar: documentObject.getElementById('marejig-filter-bar'),
            packFilter: documentObject.getElementById('marejig-filter-pack'),
            difficultyFilter: documentObject.getElementById('marejig-filter-difficulty')
        };
        return MAREJIG_menuState.elements;
    }

    function MAREJIG_getFilterLabel() {
        var pack = MAREJIG_menuState.filters.pack || 'todos los packs';
        var difficulty = MAREJIG_menuState.filters.difficulty || 'todas las dificultades';
        return pack + ' · ' + difficulty;
    }

    function MAREJIG_applyFilters(levels) {
        return levels.filter(function MAREJIG_filterByMenu(level) {
            if (MAREJIG_menuState.filters.pack && level.pack !== MAREJIG_menuState.filters.pack) return false;
            if (MAREJIG_menuState.filters.difficulty && level.difficulty !== MAREJIG_menuState.filters.difficulty) return false;
            return true;
        });
    }

    function MAREJIG_fillSelect(select, values, currentValue, allLabel) {
        if (!select) return;
        var existingValue = currentValue || select.value || '';
        select.textContent = '';
        var all = documentObject.createElement('option');
        all.value = '';
        all.textContent = allLabel;
        select.appendChild(all);
        values.forEach(function MAREJIG_addOption(value) {
            var option = documentObject.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });
        select.value = values.indexOf(existingValue) !== -1 ? existingValue : '';
    }

    function MAREJIG_initializeFilters() {
        var elements = MAREJIG_getElements();
        if (!elements.filterBar || MAREJIG_menuState.filtersInitialized) return;
        MAREJIG_fillSelect(elements.packFilter, MAREJIG_LevelCatalog.getPacks ? MAREJIG_LevelCatalog.getPacks() : [], MAREJIG_menuState.filters.pack, 'Todos');
        MAREJIG_fillSelect(elements.difficultyFilter, MAREJIG_LevelCatalog.getDifficulties ? MAREJIG_LevelCatalog.getDifficulties() : [], MAREJIG_menuState.filters.difficulty, 'Todas');
        elements.filterBar.addEventListener('change', function MAREJIG_filterChanged() {
            MAREJIG_menuState.filters.pack = elements.packFilter ? elements.packFilter.value : '';
            MAREJIG_menuState.filters.difficulty = elements.difficultyFilter ? elements.difficultyFilter.value : '';
            MAREJIG_mountPendingLevels();
        });
        MAREJIG_menuState.filtersInitialized = true;
    }

    function MAREJIG_getPendingLevels() {
        var activeSave = MAREJIG_Storage.getActiveSave();
        if (activeSave && MAREJIG_Storage.isLevelCompleted(activeSave.levelId)) {
            MAREJIG_Storage.clearActiveSave();
            MAREJIG_Storage.clearLevelProgress(activeSave.levelId);
            activeSave = null;
        }
        return MAREJIG_applyFilters(MAREJIG_LevelCatalog.getOrdered()
            .filter(function MAREJIG_filterCompleted(level) {
                return !MAREJIG_Storage.isLevelCompleted(level.id);
            }))
            .sort(function MAREJIG_sortPending(a, b) {
                var progressA = (activeSave && activeSave.levelId === a.id) || MAREJIG_Storage.getLevelProgress(a.id) ? 1 : 0;
                var progressB = (activeSave && activeSave.levelId === b.id) || MAREJIG_Storage.getLevelProgress(b.id) ? 1 : 0;
                if (progressA !== progressB) return progressB - progressA;
                return a.order - b.order;
            });
    }

    function MAREJIG_formatProgress(progress) {
        if (!progress) return '';
        if (Number.isFinite(progress.placedPieceCount) && Number.isFinite(progress.totalPieceCount) && progress.totalPieceCount > 0) {
            return Math.round((progress.placedPieceCount / progress.totalPieceCount) * 100) + '% armado';
        }
        if (Number.isFinite(progress.currentSegmentIndex)) {
            return 'Segmento ' + (progress.currentSegmentIndex + 1);
        }
        return 'Progreso guardado';
    }

    function MAREJIG_createCard(level) {
        var activeSave = MAREJIG_Storage.getActiveSave();
        var progress = activeSave && activeSave.levelId === level.id ? activeSave : MAREJIG_Storage.getLevelProgress(level.id);
        var card = documentObject.createElement('button');
        var tinyUrl = MAREJIG_Cloudinary.buildTinyPlaceholderUrl(level);
        var thumbnailUrl = MAREJIG_Cloudinary.buildThumbnailUrl(level, 'small');
        var progressText = MAREJIG_formatProgress(progress);

        card.type = 'button';
        card.className = 'marejig-level-card' + (MAREJIG_menuState.levels.length === 1 ? ' marejig-level-card-featured' : '');
        card.setAttribute('data-marejig-level-id', level.id);
        card.setAttribute('aria-label', (progress ? 'Continuar ' : 'Jugar ') + level.title);

        var difficultyLabels = { easy: 'Fácil', standard: 'Normal', hard: 'Difícil' };
        var difficultyLabel = difficultyLabels[level.difficulty] || level.difficulty;

        card.innerHTML = [
            '<span class="marejig-thumb-frame">',
            '  <img class="marejig-level-thumb" loading="lazy" decoding="async" alt="" src="' + tinyUrl + '" data-marejig-src="' + thumbnailUrl + '">',
            '  <span class="marejig-thumb-fallback" aria-hidden="true">' + String(level.order).padStart(2, '0') + '</span>',
            '</span>',
            '<span class="marejig-card-copy">',
            '  <span class="marejig-card-title">' + MAREJIG_escape(level.title) + '</span>',
            '  <span class="marejig-card-meta">',
            '    <span>' + MAREJIG_escape(level.pack) + '</span>',
            '    <span class="marejig-difficulty marejig-difficulty-' + MAREJIG_escape(level.difficulty) + '">' + MAREJIG_escape(difficultyLabel) + '</span>',
            '    <span class="marejig-card-coins"><span aria-hidden="true">●</span> +' + String(level.rewardCoins) + ' monedas</span>',
            '  </span>',
            '  <span class="marejig-card-status">',
            '    <span class="marejig-card-action ' + (progress ? 'marejig-card-continue' : 'marejig-card-new') + '">' + (progress ? 'Continuar' : 'Jugar') + '</span>',
            progressText ? '    <span>' + MAREJIG_escape(progressText) + '</span>' : '',
            '  </span>',
            '</span>'
        ].join('');

        card.addEventListener('click', function MAREJIG_selectCard() {
            if (windowObject.MAREJIG_Main && typeof windowObject.MAREJIG_Main.startLevel === 'function') {
                windowObject.MAREJIG_Main.startLevel(level.id);
            }
        });

        return card;
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

    function MAREJIG_setupThumbObserver() {
        if (MAREJIG_menuState.observer) MAREJIG_menuState.observer.disconnect();

        if (!('IntersectionObserver' in windowObject)) {
            return null;
        }

        MAREJIG_menuState.observer = new IntersectionObserver(function MAREJIG_onThumbs(entries) {
            entries.forEach(function MAREJIG_onThumb(entry) {
                if (!entry.isIntersecting) return;
                var img = entry.target;
                var src = img.getAttribute('data-marejig-src');
                if (src) {
                    img.src = src;
                    img.removeAttribute('data-marejig-src');
                }
                MAREJIG_menuState.observer.unobserve(img);
            });
        }, { rootMargin: '160px 0px' });

        return MAREJIG_menuState.observer;
    }

    function MAREJIG_observeCardImages(container) {
        var observer = MAREJIG_menuState.observer || MAREJIG_setupThumbObserver();
        var images = Array.prototype.slice.call(container.querySelectorAll('.marejig-level-thumb'));

        images.forEach(function MAREJIG_wireImage(img) {
            img.addEventListener('load', function MAREJIG_markLoaded() {
                img.classList.add('marejig-level-thumb-loaded');
            }, { once: false });
            img.addEventListener('error', function MAREJIG_markFailed() {
                img.classList.remove('marejig-level-thumb-loaded');
            }, { once: false });

            if (observer) {
                observer.observe(img);
            } else {
                var src = img.getAttribute('data-marejig-src');
                if (src) img.src = src;
            }
        });
    }

    function MAREJIG_renderNextBatch() {
        var elements = MAREJIG_getElements();
        var start = MAREJIG_menuState.renderedCount;
        var size = start === 0 ? MAREJIG_Config.menu.initialPendingCards : MAREJIG_Config.menu.batchSize;
        var nextLevels = MAREJIG_menuState.levels.slice(start, start + size);
        var fragment = documentObject.createDocumentFragment();

        nextLevels.forEach(function MAREJIG_appendCard(level) {
            fragment.appendChild(MAREJIG_createCard(level));
        });

        elements.grid.appendChild(fragment);
        MAREJIG_menuState.renderedCount += nextLevels.length;
        MAREJIG_observeCardImages(elements.grid);
        MAREJIG_updateControls();
    }

    function MAREJIG_updateControls() {
        var elements = MAREJIG_getElements();
        var hasMore = MAREJIG_menuState.renderedCount < MAREJIG_menuState.levels.length;
        elements.loadMore.hidden = !hasMore;
        elements.empty.hidden = MAREJIG_menuState.levels.length > 0;
        var count = MAREJIG_menuState.levels.length;
        elements.pendingTotal.textContent = count === 1 ? 'Un puzzle listo para armar' : count + ' puzzles listos para armar';
        elements.filterBar.hidden = MAREJIG_LevelCatalog.getOrdered().length <= 8;
    }

    function MAREJIG_setupSentinel() {
        var elements = MAREJIG_getElements();
        if (MAREJIG_menuState.sentinelObserver) MAREJIG_menuState.sentinelObserver.disconnect();
        if (!('IntersectionObserver' in windowObject)) return;

        MAREJIG_menuState.sentinelObserver = new IntersectionObserver(function MAREJIG_onSentinel(entries) {
            entries.forEach(function MAREJIG_checkSentinel(entry) {
                if (entry.isIntersecting && MAREJIG_menuState.renderedCount < MAREJIG_menuState.levels.length) {
                    MAREJIG_renderNextBatch();
                }
            });
        }, { rootMargin: '240px 0px' });
        MAREJIG_menuState.sentinelObserver.observe(elements.sentinel);
    }

    function MAREJIG_mountPendingLevels() {
        var elements = MAREJIG_getElements();
        MAREJIG_initializeFilters();
        MAREJIG_menuState.levels = MAREJIG_getPendingLevels();
        MAREJIG_menuState.renderedCount = 0;
        elements.grid.textContent = '';
        MAREJIG_setupThumbObserver();
        MAREJIG_updateControls();

        if (MAREJIG_menuState.levels.length > 0) {
            MAREJIG_renderNextBatch();
        }
        // Incremental rendering is controlled by the visible 'Ver más' button in phase 1.
    }

    function MAREJIG_refreshAfterCompletion() {
        MAREJIG_mountPendingLevels();
    }

    documentObject.addEventListener('click', function MAREJIG_menuClick(event) {
        if (event.target && event.target.id === 'marejig-load-more') {
            MAREJIG_renderNextBatch();
        }
    });

    windowObject.MAREJIG_Menu = Object.freeze({
        getPendingLevels: MAREJIG_getPendingLevels,
        mountPendingLevels: MAREJIG_mountPendingLevels,
        renderNextBatch: MAREJIG_renderNextBatch,
        refreshAfterCompletion: MAREJIG_refreshAfterCompletion,
        observeThumbnailCards: MAREJIG_observeCardImages,
        getRenderedCount: function MAREJIG_getRenderedCount() { return MAREJIG_menuState.renderedCount; },
        getVisibleLevelCount: function MAREJIG_getVisibleLevelCount() { return MAREJIG_menuState.levels.length; },
        setFilters: function MAREJIG_setFilters(filters) {
            MAREJIG_menuState.filters.pack = filters && filters.pack || '';
            MAREJIG_menuState.filters.difficulty = filters && filters.difficulty || '';
            MAREJIG_mountPendingLevels();
        }
    });
})(window, document);
