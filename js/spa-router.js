/**
 * spa-router.js — Love Arcade v10.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Router de navegación para la arquitectura Single Page Application.
 *
 * RESPONSABILIDADES:
 *  - Interceptar los clics en [data-view] de la navbar y la pill-nav.
 *  - Alternar la clase .hidden entre #view-home y #view-shop.
 *  - Actualizar el estado visual y semántico activo en la pill-nav.
 *  - Llamar a window.GameCenter.syncUI() para sincronizar saldo en todos los
 *    indicadores (Navbar + HUD) inmediatamente tras la transición.
 *  - [v9.6] Añadida llamada a window.ShopView.onLeave() / window.HomeView.onLeave()
 *           en _applyView() antes de activar la vista entrante, para que las vistas
 *           puedan liberar recursos (p. ej. IntersectionObserver de precarga).
 *  - Restaurar el scroll a 0,0 ANTES de la animación de entrada (auto/fallback),
 *    garantizando que la vista nueva empieza desde arriba sin salto visual.
 *  - [v9.1] Integrar la History API: botón Atrás vuelve a vista anterior sin recargar.
 *  - [v9.2] Añadir clase .view-section a las vistas para activar la transición
 *           anti-golpe CSS (opacity + translateY, GPU-only, 250ms).
 *
 * VIEW TRANSITIONS (v9.2 — Anti-Golpe):
 *  - Las vistas #view-home y #view-shop llevan la clase .view-section en el HTML.
 *  - CSS define opacity:0 + translateY(10px) como estado base y la transición
 *    a opacity:1 + translateY(0) cuando no tienen .hidden.
 *  - _applyView() ejecuta window.scrollTo ANTES de quitar .hidden, para que
 *    el scroll ya esté en 0 cuando la transición de entrada empieza.
 *  - Regla de los 300ms: la duración de transición es 0.25s (250ms). Nunca
 *    se animarán height, width ni margin — solo opacity y transform.
 *
 * HISTORY API (v9.1):
 *  - navigateTo() llama a history.pushState({ viewId, anchor }) en cada
 *    transición, registrando la entrada en el historial del navegador.
 *  - window.addEventListener('popstate') escucha Atrás/Adelante y llama a
 *    _applyView() SIN un nuevo pushState, evitando entradas duplicadas.
 *  - En DOMContentLoaded se usa history.replaceState para el estado inicial
 *    (evita que el primer "Atrás" genere una entrada huérfana).
 *
 * RESTRICCIONES DE RENDIMIENTO:
 *  - Cero reflows: la transición usa únicamente .hidden (display:none) +
 *    opacity/transform manejados en el compositor GPU.
 *  - El router NO hace fetch ni accede a APIs externas.
 *  - Event listeners registrados una sola vez (DOMContentLoaded).
 */

(function() {
    'use strict';
    
    const VIEWS = ['home', 'shop', 'profile'];
    
    /** @type {Object.<string, HTMLElement>} */
    let viewEls = {};
    /** @type {HTMLElement[]} */
    let pillNavItems = [];
    /** @type {HTMLElement|null} */
    let pillNavTrack = null;
    /** @type {HTMLElement|null} */
    let pillNavIndicator = null;
    let pillNavResizeTimer = null;
    
    /** @type {string} */
    let currentView = 'home';

    // La duración CSS es 250ms; el margen evita liberar la capa antes del
    // último frame de composición. Solo una vista puede retener esta pista.
    const VIEW_TRANSITION_LAYER_RELEASE_MS = 280;
    let viewTransitionLayerTimer = null;
    let transitioningViewEl = null;

    const scheduleIdle = window.requestIdleCallback
        ? (cb) => window.requestIdleCallback(cb, { timeout: 120 })
        : (cb) => setTimeout(() => cb({ didTimeout: true, timeRemaining: () => 0 }), 16);

    function _profileViewCallback(label, fn) {
        if (typeof fn !== 'function') return;
        const startMark = `${label}:start`;
        const endMark = `${label}:end`;
        performance.mark(startMark);
        try {
            fn();
        } finally {
            performance.mark(endMark);
            performance.measure(label, startMark, endMark);
            performance.clearMarks(startMark);
            performance.clearMarks(endMark);
        }
    }

    /**
     * Ejecuta callbacks de ciclo de vida en lotes cooperativos (rAF + idle).
     *
     * Precondiciones: `tasks` contiene funciones puras o tolerantes a reintento.
     * Efectos secundarios: callbacks pueden mutar DOM/estado según cada vista.
     * Coste esperado: O(n) sobre cantidad de tareas; distribución temporal en frames.
     * Diseño (por qué): separar trabajo evita picos de main-thread tras navegación
     * y protege la transición visual inicial de bloqueos.
     */
    function _drainLifecycleQueue(tasks) {
        if (!tasks.length) return;

        const runNext = () => {
            const task = tasks.shift();
            if (task) task();
            if (!tasks.length) return;

            requestAnimationFrame(() => {
                scheduleIdle(() => {
                    runNext();
                });
            });
        };

        runNext();
    }

    // ── Núcleo de transición (sin History API) ────────────────────────────────
    
    /**
     * Aplica la transición visual a una vista SIN registrar en el historial.
     * Ruta interna: usada tanto por navigateTo() como por el handler popstate.
     *
     * Orden de operaciones (v9.2 — Anti-Golpe):
     *  1. Scroll reset inmediato antes de mostrar la vista entrante.
     *     Así la vista nueva siempre empieza desde arriba, y la animación CSS
     *     de entrada (opacity + translateY) parte de una posición limpia.
     *  2. Quitar .hidden de la vista destino → CSS dispara la transición de
     *     entrada (.view-section:not(.hidden) → opacity:1 + translateY(0)).
     *  3. Sincronizar saldo, iconos y callbacks de vista.
     *
     * @param {'home'|'shop'} viewId
     * @param {string|null}   [anchor]
     */
    /**
     * Aplica transición SPA sin mutar History API (núcleo de enrutado).
     *
     * Precondiciones: `viewId` existe en `VIEWS` y sus nodos están cacheados.
     * Efectos secundarios: escrituras DOM (hidden/nav), scroll, callbacks de vistas.
     * Coste esperado: O(v) para alternar vistas + O(t) tareas lifecycle diferidas.
     * Diseño (por qué): pipeline en fases (scroll inmediato, rAF, idle queue) para
     * priorizar Time-to-Visual-Response y desacoplar trabajo no crítico del primer frame.
     */
    function _applyView(viewId, anchor) {
        if (!viewEls[viewId]) return;
        const previousView = currentView;

        // Las vistas permanecen montadas durante toda la sesión. Promovemos
        // únicamente la entrante y liberamos la promoción anterior si la
        // navegación fue interrumpida antes de que acabara su transición.
        if (viewTransitionLayerTimer !== null) {
            clearTimeout(viewTransitionLayerTimer);
            viewTransitionLayerTimer = null;
        }
        if (transitioningViewEl) {
            transitioningViewEl.classList.remove('view-transitioning');
        }
        transitioningViewEl = viewEls[viewId];
        transitioningViewEl.classList.add('view-transitioning');
        
        // [v9.2] Scroll reset ANTES de la transición de entrada.
        // behavior:'auto' evita scroll animado y mantiene compatibilidad amplia.
        // Fallback defensivo para entornos que no aceptan la firma con objeto.
        if (!anchor) {
            try {
                window.scrollTo({ top: 0, behavior: 'auto' });
            } catch (_) {
                window.scrollTo(0, 0);
            }
        }
        
        VIEWS.forEach(id => {
            const viewEl = viewEls[id];
            if (!viewEl) return;
            viewEl.classList.toggle('hidden', id !== viewId);
        });

        viewTransitionLayerTimer = setTimeout(() => {
            transitioningViewEl?.classList.remove('view-transitioning');
            transitioningViewEl = null;
            viewTransitionLayerTimer = null;
        }, VIEW_TRANSITION_LAYER_RELEASE_MS);
        
        currentView = viewId;
        window.AppScheduler?.setActiveView?.(viewId);

        _syncNavHighlight(viewId);

        // Fase 2 (next frame): operaciones no críticas del primer frame.
        requestAnimationFrame(() => {
            // Limita las consultas de sincronización a la vista recién mostrada;
            // GameCenter también actualiza el chrome compartido (navbar).
            window.GameCenter?.syncUI?.(viewEls[viewId]);

            if (anchor) {
                const target = document.getElementById(anchor);
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }

            // Fase 3 (task separado): solo planificación; sin trabajo pesado síncrono.
            setTimeout(() => {
                const lifecycleTasks = [];

                // [fix] onLeave debe dispararse según la vista que abandonamos,
                // no según la vista destino. De lo contrario, las transiciones
                // salientes no liberan recursos de la vista anterior.
                if (previousView !== viewId) {
                    if (previousView === 'home') lifecycleTasks.push(() => window.HomeView?.onLeave?.());
                    if (previousView === 'shop') lifecycleTasks.push(() => window.ShopView?.onLeave?.());
                }

                if (viewId === 'home') lifecycleTasks.push(() => _profileViewCallback('HomeView.onEnter', () => window.HomeView?.onEnter?.()));
                if (viewId === 'home') lifecycleTasks.push(() => _profileViewCallback('HomeView.refresh', () => window.HomeView?.refresh?.()));
                if (viewId === 'shop') lifecycleTasks.push(() => _profileViewCallback('ShopView.onEnter', () => window.ShopView?.onEnter?.()));

                _drainLifecycleQueue(lifecycleTasks);
            }, 0);
        });
    }
    
    // ── API pública ───────────────────────────────────────────────────────────
    
    /**
     * Navega a una vista por su id y registra la entrada en el historial.
     *
     * @param {'home'|'shop'} viewId
     * @param {string|null}   [anchor]   ID del elemento al que hacer scroll (sin #).
     * @param {boolean}       [replace]  Si true, usa replaceState (para estado inicial).
     */
    /**
     * Navega a una vista y sincroniza History API para back/forward nativo.
     *
     * Precondiciones: llamada desde interacción UI o restauración controlada.
     * Efectos secundarios: `_applyView`, `history.pushState/replaceState`.
     * Coste esperado: O(1) sobre historial + coste de `_applyView`.
     * Diseño (por qué): mantener `navigateTo` como frontera pública reduce
     * acoplamiento: cualquier caller obtiene transición + URL state consistentes.
     */
    function navigateTo(viewId, anchor, replace) {
        const state = { viewId, anchor: anchor || null };
        
        if (replace) {
            history.replaceState(state, '');
        } else if (viewId !== currentView) {
            // Solo pushState si realmente cambiamos de vista; evita duplicados
            // al pulsar repetidamente el mismo enlace de nav.
            history.pushState(state, '');
        }
        
        _applyView(viewId, anchor);
    }
    
    /** @returns {string} id de la vista activa. */
    function getCurrentView() {
        return currentView;
    }
    
    // ── Helpers privados ──────────────────────────────────────────────────────

    /**
     * Posiciona el único indicador de la píldora activa. La lectura de layout se
     * hace una sola vez por navegación o tras un resize debounced; no se mide
     * durante ningún frame de animación.
     */
    function _syncPillNavIndicator(viewId, animate) {
        if (!pillNavTrack || !pillNavIndicator) return;
        const activeItem = pillNavItems.find(item => item.dataset.view === viewId && !item.dataset.anchor);
        if (!activeItem) return;

        const offset = activeItem.offsetLeft - 4;
        pillNavIndicator.style.setProperty('--pill-nav-indicator-x', `${offset}px`);
        pillNavIndicator.style.setProperty('--pill-nav-indicator-width', `${activeItem.offsetWidth}px`);

        if (animate && pillNavIndicator.classList.contains('pill-nav__indicator--ready')) {
            pillNavIndicator.classList.add('pill-nav__indicator--moving');
        }
    }
    
    function _syncNavHighlight(viewId) {
        pillNavItems.forEach(item => {
            const isActive = item.dataset.view === viewId && !item.dataset.anchor;
            item.classList.toggle('active', isActive);
            if (isActive) {
                item.setAttribute('aria-current', 'page');
            } else {
                item.removeAttribute('aria-current');
            }
        });
        _syncPillNavIndicator(viewId, true);
    }
    
    function _bindNavItem(el) {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = el.dataset.view;
            const anchor = el.dataset.anchor || null;
            
            if (viewId === currentView && !anchor) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            
            // Separar la navegación del mismo task del click para reducir INP.
            setTimeout(() => navigateTo(viewId, anchor), 0);
        });
    }
    
    // ── Inicialización ────────────────────────────────────────────────────────
    
    document.addEventListener('DOMContentLoaded', () => {
        
        // Construir mapa de vistas
        VIEWS.forEach(id => {
            const el = document.getElementById(`view-${id}`);
            if (el) viewEls[id] = el;
        });
        
        pillNavItems = Array.from(document.querySelectorAll('.pill-nav-item[data-view]'));
        pillNavTrack = document.querySelector('.pill-nav__track');
        pillNavIndicator = document.querySelector('.pill-nav__indicator');

        pillNavIndicator?.addEventListener('transitionend', (event) => {
            if (event.propertyName === 'transform') {
                pillNavIndicator.classList.remove('pill-nav__indicator--moving');
            }
        });

        window.addEventListener('resize', () => {
            clearTimeout(pillNavResizeTimer);
            pillNavResizeTimer = setTimeout(() => _syncPillNavIndicator(currentView, false), 120);
        }, { passive: true });

        // Registrar listeners de navegación
        document.querySelectorAll('[data-view]').forEach(el => {
            if (viewEls[el.dataset.view]) _bindNavItem(el);
        });
        
        _syncNavHighlight('home');
        requestAnimationFrame(() => pillNavIndicator?.classList.add('pill-nav__indicator--ready'));
        
        // ── History API: estado inicial ───────────────────────────────────────
        // replaceState (no pushState) para que la entrada inicial quede en el
        // historial sin crear un salto extra hacia "atrás".
        navigateTo('home', null, /* replace= */ true);
        
        // ── Popstate: botón Atrás / Adelante ─────────────────────────────────
        // El navegador restaura el state y dispara 'popstate'. Usamos _applyView
        // directamente para NO generar una nueva entrada (evita bucle infinito).
        window.addEventListener('popstate', (e) => {
            const state = e.state;
            const viewId = VIEWS.includes(state?.viewId) ? state.viewId : 'home';
            const anchor = state?.anchor || null;
            _applyView(viewId, anchor);
        });
    });
    
    // ── Exposición global ─────────────────────────────────────────────────────
    
    window.SpaRouter = { navigateTo, getCurrentView };
    
})();
