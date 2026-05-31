(function MAREJIG_menuModule(windowObject, documentObject) {
    'use strict';

    var MAREJIG_Config = windowObject.MAREJIG_Config;
    var MAREJIG_LevelCatalog = windowObject.MAREJIG_LevelCatalog;
    var MAREJIG_Cloudinary = windowObject.MAREJIG_Cloudinary;
    var MAREJIG_Storage = windowObject.MAREJIG_Storage;
    var MAREJIG_menuState = {
        levels: [],
        pendingLevels: [],
        renderedCount: 0,
        observer: null,
        elements: null,
        selectionTimer: 0
    };

    function MAREJIG_getElements() {
        if (MAREJIG_menuState.elements) return MAREJIG_menuState.elements;
        MAREJIG_menuState.elements = {
            featured: documentObject.getElementById('marejig-featured-level'),
            next: documentObject.getElementById('marejig-next-levels'),
            grid: documentObject.getElementById('marejig-level-grid'),
            empty: documentObject.getElementById('marejig-empty-state'),
            loadMore: documentObject.getElementById('marejig-load-more'),
            pendingTotal: documentObject.getElementById('marejig-total-pending')
        };
        return MAREJIG_menuState.elements;
    }

    function MAREJIG_getPendingLevels() {
        var activeSave = MAREJIG_Storage.getActiveSave();
        if (activeSave && MAREJIG_Storage.isLevelCompleted(activeSave.levelId)) {
            MAREJIG_Storage.clearActiveSave();
            MAREJIG_Storage.clearLevelProgress(activeSave.levelId);
            activeSave = null;
        }
        MAREJIG_menuState.pendingLevels = MAREJIG_LevelCatalog.getOrdered()
            .filter(function MAREJIG_filterCompleted(level) { return !MAREJIG_Storage.isLevelCompleted(level.id); })
            .sort(function MAREJIG_sortPending(a, b) {
                var progressA = (activeSave && activeSave.levelId === a.id) || MAREJIG_Storage.getLevelProgress(a.id) ? 1 : 0;
                var progressB = (activeSave && activeSave.levelId === b.id) || MAREJIG_Storage.getLevelProgress(b.id) ? 1 : 0;
                if (progressA !== progressB) return progressB - progressA;
                return a.order - b.order;
            });
        return MAREJIG_menuState.pendingLevels;
    }

    function MAREJIG_escape(value) {
        return String(value).replace(/[&<>'"]/g, function MAREJIG_replaceUnsafe(char) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\'': '&#39;', '"': '&quot;' }[char];
        });
    }

    function MAREJIG_getProgress(level) {
        var activeSave = MAREJIG_Storage.getActiveSave();
        return activeSave && activeSave.levelId === level.id ? activeSave : MAREJIG_Storage.getLevelProgress(level.id);
    }

    function MAREJIG_selectLevel(card, levelId) {
        if (MAREJIG_menuState.selectionTimer) return;
        card.classList.add('marejig-level-poster-selected');
        var reducedMotion = windowObject.matchMedia && windowObject.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var delay = reducedMotion ? 0 : 150;
        MAREJIG_menuState.selectionTimer = windowObject.setTimeout(function MAREJIG_startSelectedLevel() {
            MAREJIG_menuState.selectionTimer = 0;
            if (windowObject.MAREJIG_Main && typeof windowObject.MAREJIG_Main.startLevel === 'function') windowObject.MAREJIG_Main.startLevel(levelId);
        }, delay);
    }

    function MAREJIG_createCard(level, featured, index) {
        var progress = MAREJIG_getProgress(level);
        var action = progress ? 'Continuar' : 'Jugar';
        var card = documentObject.createElement('button');
        var tinyUrl = MAREJIG_Cloudinary.buildTinyPlaceholderUrl(level);
        var thumbnailUrl = MAREJIG_Cloudinary.buildThumbnailUrl(level, featured ? 'large' : 'small');
        card.type = 'button';
        card.className = 'marejig-level-poster ' + (featured ? 'marejig-level-poster-featured' : 'marejig-level-poster-mini');
        card.setAttribute('data-marejig-level-id', level.id);
        card.setAttribute('aria-label', action + ' ' + level.title);
        if (card.style && card.style.setProperty) card.style.setProperty('--marejig-poster-index', String(Math.min(index, 5)));
        card.innerHTML = [
            '<span class="marejig-level-poster__media">',
            '  <img class="marejig-level-thumb" loading="lazy" decoding="async" alt="" src="' + tinyUrl + '" data-marejig-src="' + thumbnailUrl + '">',
            '  <span class="marejig-thumb-fallback" aria-hidden="true">' + String(level.order).padStart(2, '0') + '</span>',
            '</span>',
            '<span class="marejig-level-poster__copy">',
            '  <span class="marejig-level-poster__title">' + MAREJIG_escape(level.title) + '</span>',
            '  <span class="marejig-level-poster__action">' + action + '<span aria-hidden="true"> →</span></span>',
            progress ? '  <span class="marejig-level-poster__progress"><span></span><span class="marejig-visually-hidden">Progreso guardado</span></span>' : '',
            '</span>'
        ].join('');
        card.addEventListener('click', function MAREJIG_selectCard() { MAREJIG_selectLevel(card, level.id); });
        return card;
    }

    function MAREJIG_setupThumbObserver() {
        if (MAREJIG_menuState.observer) MAREJIG_menuState.observer.disconnect();
        if (!('IntersectionObserver' in windowObject)) return null;
        MAREJIG_menuState.observer = new IntersectionObserver(function MAREJIG_onThumbs(entries) {
            entries.forEach(function MAREJIG_onThumb(entry) {
                if (!entry.isIntersecting) return;
                var img = entry.target;
                var src = img.getAttribute('data-marejig-src');
                if (src) { img.src = src; img.removeAttribute('data-marejig-src'); }
                MAREJIG_menuState.observer.unobserve(img);
            });
        }, { rootMargin: '160px 0px' });
        return MAREJIG_menuState.observer;
    }

    function MAREJIG_observeCardImages(container) {
        var observer = MAREJIG_menuState.observer || MAREJIG_setupThumbObserver();
        Array.prototype.slice.call(container.querySelectorAll('.marejig-level-thumb')).forEach(function MAREJIG_wireImage(img) {
            img.addEventListener('load', function MAREJIG_markLoaded() { img.classList.add('marejig-level-thumb-loaded'); });
            img.addEventListener('error', function MAREJIG_markFailed() { img.classList.remove('marejig-level-thumb-loaded'); });
            if (observer) observer.observe(img);
            else { var src = img.getAttribute('data-marejig-src'); if (src) img.src = src; }
        });
    }

    function MAREJIG_renderNextBatch() {
        var elements = MAREJIG_getElements();
        var start = MAREJIG_menuState.renderedCount;
        var size = start === 0 ? Math.max(0, MAREJIG_Config.menu.initialPendingCards - (elements.featured ? 1 : 0)) : MAREJIG_Config.menu.batchSize;
        var offset = elements.featured ? 1 : 0;
        var nextLevels = MAREJIG_menuState.levels.slice(start + offset, start + offset + size);
        var fragment = documentObject.createDocumentFragment();
        nextLevels.forEach(function MAREJIG_appendCard(level, index) { fragment.appendChild(MAREJIG_createCard(level, false, start + index + 1)); });
        elements.grid.appendChild(fragment);
        MAREJIG_menuState.renderedCount += nextLevels.length;
        MAREJIG_observeCardImages(elements.grid);
        MAREJIG_updateControls();
    }

    function MAREJIG_updateControls() {
        var elements = MAREJIG_getElements();
        var pendingCount = MAREJIG_menuState.levels.length;
        var hasMore = MAREJIG_menuState.renderedCount < Math.max(0, pendingCount - (elements.featured ? 1 : 0));
        elements.loadMore.hidden = !hasMore;
        if (elements.next) elements.next.hidden = pendingCount <= 1;
        elements.empty.hidden = pendingCount !== 0;
        elements.pendingTotal.textContent = pendingCount === 0 ? 'No quedan puzzles pendientes' : (pendingCount === 1 ? 'Un puzzle listo para armar' : pendingCount + ' puzzles listos para armar');
    }

    function MAREJIG_mountPendingLevels() {
        var elements = MAREJIG_getElements();
        MAREJIG_menuState.levels = MAREJIG_getPendingLevels();
        MAREJIG_menuState.renderedCount = 0;
        if (elements.featured) elements.featured.textContent = '';
        elements.grid.textContent = '';
        MAREJIG_setupThumbObserver();
        MAREJIG_updateControls();
        if (!MAREJIG_menuState.levels.length) return;
        if (elements.featured) {
            elements.featured.appendChild(MAREJIG_createCard(MAREJIG_menuState.levels[0], true, 0));
            MAREJIG_observeCardImages(elements.featured);
            if (MAREJIG_menuState.levels.length > 1) MAREJIG_renderNextBatch();
        } else {
            MAREJIG_renderNextBatch();
        }
    }

    function MAREJIG_refreshAfterCompletion() { MAREJIG_mountPendingLevels(); }

    documentObject.addEventListener('click', function MAREJIG_menuClick(event) {
        if (event.target && event.target.id === 'marejig-load-more') MAREJIG_renderNextBatch();
    });

    windowObject.MAREJIG_Menu = Object.freeze({
        getPendingLevels: MAREJIG_getPendingLevels,
        mountPendingLevels: MAREJIG_mountPendingLevels,
        refreshAfterCompletion: MAREJIG_refreshAfterCompletion,
        renderNextBatch: MAREJIG_renderNextBatch,
        observeThumbnailCards: MAREJIG_observeCardImages,
        getRenderedCount: function MAREJIG_getRenderedCount() { return MAREJIG_menuState.renderedCount; },
        getVisibleLevelCount: function MAREJIG_getVisibleLevelCount() { return MAREJIG_menuState.levels.length; }
    });
}(window, document));
