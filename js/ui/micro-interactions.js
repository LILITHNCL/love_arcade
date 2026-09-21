// Este script clásico debe cargarse después de core/utils.js y antes de app.js.
(function initLoveArcadeMicroInteractions() {
    const { canUseVibration: _canUseVibration } = window.LoveArcadeUtils;

    function initInteractiveMicroFX() {
        const interactiveSelector = 'button, [role="button"], a[href], summary, .game-card, .shop-card, .avatar-container';
        const coarsePointerMql = window.matchMedia('(pointer: coarse)');
        const reducedMotionMql = window.matchMedia('(prefers-reduced-motion: reduce)');
        let coarsePointer = coarsePointerMql.matches;
        let reducedMotion = reducedMotionMql.matches;
        const _bindMediaChange = (mql, handler) => {
            if (typeof mql.addEventListener === 'function') mql.addEventListener('change', handler);
            else if (typeof mql.addListener === 'function') mql.addListener(handler);
        };
        _bindMediaChange(coarsePointerMql, (e) => { coarsePointer = e.matches; });
        _bindMediaChange(reducedMotionMql, (e) => { reducedMotion = e.matches; });
        const isAndroid = /Android/i.test(navigator.userAgent || '');
        let activePressEl = null;

        document.querySelectorAll(interactiveSelector).forEach((el) => {
            el.classList.add('interactive-ripple');
        });

        const releasePress = () => {
            if (!activePressEl) return;
            activePressEl.classList.remove('is-pressing');
            activePressEl = null;
        };

        document.addEventListener('pointerdown', (event) => {
            const el = event.target.closest(interactiveSelector);
            if (!el) return;
            releasePress();
            activePressEl = el;
            if (!el.classList.contains('interactive-ripple')) {
                el.classList.add('interactive-ripple');
            }
            el.classList.add('ripple-active');
            el.classList.add('is-pressing');
            if (!reducedMotion && !coarsePointer) {
                const rect = el.getBoundingClientRect();
                el.style.setProperty('--tap-x', `${event.clientX - rect.left}px`);
                el.style.setProperty('--tap-y', `${event.clientY - rect.top}px`);
                el.classList.remove('is-rippling');
                requestAnimationFrame(() => el.classList.add('is-rippling'));
                setTimeout(() => {
                    el.classList.remove('is-rippling');
                    el.classList.remove('ripple-active');
                }, 430);
            } else {
                setTimeout(() => el.classList.remove('ripple-active'), 90);
            }
            if (isAndroid && _canUseVibration()) {
                navigator.vibrate(8);
            }
        }, { passive: true });

        document.addEventListener('pointerup', () => {
            releasePress();
        }, { passive: true });
        document.addEventListener('pointercancel', () => {
            releasePress();
        }, { passive: true });
        document.addEventListener('scroll', () => {
            releasePress();
        }, { passive: true });
    }

    function initLoadingStateObserver() {
        const loadingSelector = 'button[data-loading], [role="button"][data-loading]';
        const syncButtonState = (button) => {
            const isLoading = button.getAttribute('data-loading') === 'true';
            if (isLoading) {
                if (!button.dataset.lockedInlineSize) {
                    button.dataset.lockedInlineSize = `${Math.ceil(button.getBoundingClientRect().width)}px`;
                }
                button.style.width = button.dataset.lockedInlineSize;
                button.setAttribute('aria-busy', 'true');
                button.disabled = true;
                return;
            }
            button.style.removeProperty('width');
            button.removeAttribute('aria-busy');
            button.disabled = false;
            delete button.dataset.lockedInlineSize;
        };

        document.querySelectorAll(loadingSelector).forEach(syncButtonState);

        const observer = new MutationObserver((records) => {
            records.forEach((record) => {
                if (!(record.target instanceof HTMLElement)) return;
                if (!record.target.matches(loadingSelector)) return;
                syncButtonState(record.target);
            });
        });

        observer.observe(document.body, {
            attributes: true,
            subtree: true,
            attributeFilter: ['data-loading']
        });
    }

    window.LoveArcadeMicroInteractions = { initInteractiveMicroFX, initLoadingStateObserver };
})();
