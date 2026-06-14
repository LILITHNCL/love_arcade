/**
 * event-logic.js — Love Arcade v11.2
 * ─────────────────────────────────────────────────────────────────────────────
 * Motor de Eventos por Tiempo Limitado (LTE) e interactivos.
 *
 * CAMBIOS v11.2 (Event Engine — Full Hardening II):
 *  - [FIX CRÍTICO] Cacería de Tesoros: corregido el bug que impedía inyectar
 *    el número total de objetos. La nueva lógica recopila todos los anclajes
 *    candidatos de todos los selectores (configurados + fallback), filtra
 *    aquellos ocultos o de tamaño insuficiente (mínimo 40×40 px para visibles)
 *    y selecciona aleatoriamente hasta `total` elementos únicos para inyectar.
 *    Esto garantiza que aparezcan exactamente la cantidad solicitada y que
 *    todos sean accesibles sin necesidad de navegar a otras vistas.
 *  - Se añade _collectCandidates() para centralizar la búsqueda.
 *  - Se amplía HUNT_FALLBACK_ANCHORS con más selectores de la vista de inicio.
 *  - Se mantiene la corrección de overflow en anclajes y su padre inmediato.
 *  - [v11.1 y anteriores ya estaban incluidos: milestone listener, gacha daily,
 *    scheduler de precarga, etc.]
 */

(function () {
    'use strict';

    const EVENTS_CACHE_KEY  = 'love_arcade_events_v1';
    const HUNT_PROGRESS_KEY = 'la_hunt_progress';
    const MILESTONE_KEY     = 'la_milestone';
    const GACHA_DAILY_KEY   = 'la_gacha_daily';
    const GACHA_DAILY_MAX   = 5;

    /**
     * Selectores de respaldo para la Cacería de Tesoros.
     * Se han ampliado con elementos de la vista de inicio y otras secciones
     * para garantizar suficientes anclajes visibles incluso sin navegar a tienda.
     */
    const HUNT_FALLBACK_ANCHORS = [
        // Game cards — más grandes, bien distribuidos, overflow visible
        '#games .game-card:nth-child(1)',
        '#games .game-card:nth-child(2)',
        '#games .game-card:nth-child(3)',
        '#games .game-card:nth-child(4)',
        '#games .game-card:nth-child(5)',
        '#games .game-card:nth-child(6)',
        // FAQ sections
        '#faq details:nth-child(1)',
        '#faq details:nth-child(2)',
        '#faq details:nth-child(3)',
        // Shop elements (visibles al navegar a Tienda)
        '#view-shop .shop-toolbar',
        '#view-shop .promo-toggle-wrap',
        // HUD y elementos de la vista de inicio
        '.player-hud',
        '.player-hud .hud-streak',
        '.hud-balance',
        '.hud-balance-row',
        '.games-grid',
        '#games',
        '#faq',
    ];

    /**
     * Cuadrantes de posicionamiento para items de cacería.
     * Rangos más conservadores (15–75%) para no salirse de elementos pequeños.
     */
    const HUNT_QUADRANTS = [
        { top: [12, 30], left: [60, 78] },
        { top: [62, 78], left: [12, 30] },
        { top: [12, 30], left: [12, 30] },
        { top: [62, 78], left: [60, 78] },
        { top: [38, 55], left: [38, 62] },
    ];

    let _eventsCache = null;
    let _loadPromise = null;
    let _countdownInterval    = null;
    const COUNTDOWN_INTERVAL_MS = 60_000;

    /** Bloquea el botón del gacha mientras el modal de ruleta está abierto. */
    let _gachaAnimating = false;

    // ════════════════════════════════════════════════════════════════════════════
    // ICONOS SVG INLINE — independientes del sprite externo
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Trazos SVG (Lucide-compatibles, stroke, 24×24 viewBox).
     * No requieren sprite ni definiciones externas en el HTML.
     */
    const SVG_ICONS = {
        clock:   '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        info:    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
        zap:     '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
        star:    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
        calendar:'<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
        trophy:  '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
        check:   '<polyline points="20 6 9 17 4 12"/>',
        alert:   '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
        coin:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5C9.5 8.12 10.62 7 12 7s2.5 1.12 2.5 2.5S13.38 12 12 12s-2.5 1.12-2.5 2.5S10.62 17 12 17s2.5-1.12 2.5-2.5"/>',
        slot:    '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 7h2v6H7zM11 7h2v6h-2zM15 7h2v6h-2z"/>',
    };

    /**
     * Genera un elemento SVG inline a partir del mapa SVG_ICONS.
     * No depende de ningún sprite externo definido en el HTML.
     *
     * @param {string} name  Clave del icono en SVG_ICONS (ej: 'clock', 'star').
     * @param {number} [size=18]  Tamaño en píxeles del lado del icono.
     * @returns {string} Markup HTML del icono SVG.
     */
    function _icon(name, size = 18) {
        const paths = SVG_ICONS[name] || SVG_ICONS.star;
        return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // UTILIDADES DE TIEMPO
    // ════════════════════════════════════════════════════════════════════════════

    function _isEventLive(event) {
        const now   = Date.now();
        const start = event.startDate ? new Date(event.startDate).getTime() : 0;
        const end   = event.endDate   ? new Date(event.endDate).getTime()   : Infinity;
        return now >= start && now < end;
    }

    function _formatTimeLeft(dateStr) {
        const diff = new Date(dateStr).getTime() - Date.now();
        if (diff <= 0) return 'Expirado';
        const days  = Math.floor(diff / 86_400_000);
        const hours = Math.floor((diff % 86_400_000) / 3_600_000);
        const mins  = Math.floor((diff % 3_600_000)  / 60_000);
        if (days >= 2)               return `${days} días`;
        if (days === 1 && hours > 0) return `1 d ${hours} h`;
        if (days === 1)              return '1 día';
        if (hours > 0 && mins > 0)   return `${hours} h ${mins} min`;
        if (hours > 0)               return `${hours} h`;
        return mins > 0 ? `${mins} min` : 'Menos de 1 min';
    }

    function _getRemainingMs(event) {
        if (!event?.endDate) return Infinity;
        const endTs = new Date(event.endDate).getTime();
        if (Number.isNaN(endTs)) return Infinity;
        return Math.max(0, endTs - Date.now());
    }

    function _getMainRewardLabel(event) {
        const cfg = event?.config || {};
        switch (event?.type) {
            case 'interactive_hunt':
                return `${cfg.reward || 500} monedas`;
            case 'personal_milestone': {
                const mult = cfg.multiplier || 2;
                const durMin = Math.round((cfg.multiplierDurationMs || 1_800_000) / 60_000);
                return `×${mult} por ${durMin} min`;
            }
            case 'gacha_flash':
                return `${cfg.minReward || 10}–${cfg.maxReward || 1000} monedas`;
            case 'daily_missions': {
                const total = (cfg.missions || []).reduce((sum, m) => sum + (m.reward || 0), 0);
                return `Hasta ${total} monedas`;
            }
            default:
                return event?.ui?.subtitle || 'Bonificación activa';
        }
    }

    function _toSummaryEvent(event, status = 'active') {
        const startsIn = event.startDate ? _formatTimeLeft(event.startDate) : '';
        return {
            id: event.id,
            type: event.type || 'generic',
            status,
            title: event.ui?.title || event.title || 'Evento especial',
            subtitle: event.ui?.subtitle || '',
            description: event.ui?.description || event.description || '',
            timeLeft: status === 'upcoming' ? startsIn : _formatTimeLeft(event.endDate),
            reward: _getMainRewardLabel(event),
            remainingMs: status === 'upcoming'
                ? Math.max(0, new Date(event.startDate).getTime() - Date.now())
                : _getRemainingMs(event),
        };
    }

    function _getEventStatus(event) {
        const now = Date.now();
        const start = event.startDate ? new Date(event.startDate).getTime() : 0;
        const end = event.endDate ? new Date(event.endDate).getTime() : Infinity;
        if (now >= start && now < end) return 'active';
        if (now < start) return 'upcoming';
        return 'past';
    }

    // ════════════════════════════════════════════════════════════════════════════
    // CARGA DE DATOS
    // ════════════════════════════════════════════════════════════════════════════

    function _loadEvents() {
        if (_eventsCache) return Promise.resolve(_eventsCache);
        if (_loadPromise) return _loadPromise;

        _loadPromise = fetch('data/events.json', { cache: 'no-store' })
            .then(r => r.json())
            .then(data => {
                _eventsCache = data;
                try {
                    localStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
                } catch (_) {}
                window.isEventActive = isEventActive;
                _safeInitHunt(data);
                _initMilestoneListener(data);
                return data;
            })
            .catch(() => {
                _eventsCache = { activeEvents: [] };
                return _eventsCache;
            });

        return _loadPromise;
    }

    _loadEvents().catch(() => {});

    // ════════════════════════════════════════════════════════════════════════════
    // isEventActive — API GLOBAL
    // ════════════════════════════════════════════════════════════════════════════

    function isEventActive(eventId) {
        if (!_eventsCache) return false;
        const ev = _eventsCache.activeEvents.find(e => e.id === eventId);
        if (!ev) return false;
        return _isEventLive(ev);
    }

    window.isEventActive = isEventActive;

    // ════════════════════════════════════════════════════════════════════════════
    // MECÁNICA: CACERÍA DE TESOROS (interactive_hunt)
    // ════════════════════════════════════════════════════════════════════════════

    function _readHuntCount() {
        try {
            const raw = localStorage.getItem(HUNT_PROGRESS_KEY + '_count');
            return raw ? parseInt(raw, 10) : 0;
        } catch (_) { return 0; }
    }

    function _writeHuntCount(count) {
        try { localStorage.setItem(HUNT_PROGRESS_KEY + '_count', String(count)); } catch (_) {}
    }

    function _readHuntIds() {
        try {
            const raw = localStorage.getItem(HUNT_PROGRESS_KEY + '_ids');
            if (!raw) return [];
            return JSON.parse(raw);
        } catch (_) { return []; }
    }

    function _writeHuntIds(ids) {
        try { localStorage.setItem(HUNT_PROGRESS_KEY + '_ids', JSON.stringify(ids)); } catch (_) {}
    }

    /**
     * Resuelve un selector a un elemento del DOM no usado todavía.
     * Soporta múltiples coincidencias y elige una al azar.
     *
     * [v11.2] Para elementos VISIBLES, requiere un mínimo de 40×40 px para
     * garantizar que el item de cacería sea clickeable. Elementos en vistas
     * ocultas (getBoundingClientRect = 0) se permiten sin restricción de
     * tamaño porque serán visibles cuando el usuario navegue a esa vista.
     *
     * @param {string}   selector  Selector CSS a evaluar.
     * @param {Set}      usedEls   Elementos ya utilizados en esta inyección.
     * @returns {Element|null}
     */
    function _resolveAnchor(selector, usedEls) {
        try {
            const candidates = Array.from(document.querySelectorAll(selector))
                .filter(el => {
                    if (usedEls.has(el)) return false;
                    const rect = el.getBoundingClientRect();
                    // Elemento en vista oculta (display:none en la SPA): OK
                    const isHidden = rect.width === 0 && rect.height === 0;
                    if (isHidden) return true;
                    // Elemento visible: debe tener tamaño mínimo para ser usable
                    return rect.width >= 40 && rect.height >= 40;
                });
            if (!candidates.length) return null;
            return candidates[Math.floor(Math.random() * candidates.length)];
        } catch (_) { return null; }
    }

    /**
     * Inyecta físicamente un objeto de cacería en el DOM.
     *
     * [v11.2 FIX] Se fuerza overflow:visible en el anclaje y en su padre
     * inmediato para garantizar que el item sea visible aunque el contenedor
     * tenga overflow:hidden (comportamiento frecuente en .game-card, etc.).
     */
    function _injectHuntItem(anchor, itemId, emoji, quadIdx, huntEvent, total, reward) {
        const q      = HUNT_QUADRANTS[quadIdx % HUNT_QUADRANTS.length];
        const topPct  = q.top[0]  + Math.random() * (q.top[1]  - q.top[0]);
        const leftPct = q.left[0] + Math.random() * (q.left[1] - q.left[0]);

        const item = document.createElement('button');
        item.className       = 'treasure-item';
        item.dataset.itemId  = itemId;
        item.dataset.eventId = huntEvent.id;
        item.setAttribute('aria-label', 'Objeto de cacería — ¡haz clic para recolectarlo!');
        item.textContent     = emoji;

        item.style.setProperty('--hunt-top',  `${topPct}%`);
        item.style.setProperty('--hunt-left', `${leftPct}%`);

        // Garantizar posicionamiento relativo y visibilidad
        if (getComputedStyle(anchor).position === 'static') {
            anchor.style.position = 'relative';
        }
        anchor.style.overflow = 'visible';

        // Propagar overflow:visible al padre inmediato si lo oculta
        const parent = anchor.parentElement;
        if (parent) {
            const parentOverflow = getComputedStyle(parent).overflow;
            if (parentOverflow === 'hidden' || parentOverflow === 'clip') {
                parent.style.overflow = 'visible';
            }
        }

        item.addEventListener('click', () =>
            _onTreasureCollect(item, huntEvent, total, reward)
        );
        anchor.appendChild(item);
    }

    /**
     * Wrapper seguro para _initHunt: garantiza ejecución tras DOMContentLoaded.
     *
     * [v11.2] El fetch puede resolver desde caché antes de que el DOM esté listo
     * en primera visita. Esta función detecta el estado del documento y difiere
     * la inyección si es necesario.
     */
    function _safeInitHunt(eventsData) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => _initHunt(eventsData), { once: true });
        } else {
            _initHunt(eventsData);
        }
    }

    /**
     * Inicializa la Cacería de Tesoros.
     *
     * [v11.2] Nueva lógica: recopila todos los anclajes candidatos de todos los
     * selectores, filtra por visibilidad y tamaño mínimo, y selecciona aleatoriamente
     * hasta `total` elementos únicos para inyectar. Esto garantiza que aparezcan
     * exactamente la cantidad solicitada y que todos sean accesibles.
     *
     * @param {object} eventsData
     */
    function _initHunt(eventsData) {
        const huntEvent = (eventsData.activeEvents || []).find(
            e => e.type === 'interactive_hunt' && _isEventLive(e)
        );
        if (!huntEvent) return;

        const cfg    = huntEvent.config || {};
        const total  = cfg.total    || 5;
        const emoji  = cfg.itemEmoji || '⭐';
        const reward = cfg.reward   || 500;

        const foundIds = _readHuntIds();
        if (foundIds.length >= total) return;

        const configuredAnchors = cfg.anchors || [];
        const allSelectors = [...configuredAnchors, ...HUNT_FALLBACK_ANCHORS];

        // Recolectar todos los elementos candidatos únicos
        const candidates = [];
        const usedElements = new Set();

        for (const selector of allSelectors) {
            const elements = Array.from(document.querySelectorAll(selector));
            for (const el of elements) {
                if (usedElements.has(el)) continue;
                // Verificar visibilidad y tamaño
                const rect = el.getBoundingClientRect();
                const isHidden = rect.width === 0 && rect.height === 0;
                if (isHidden) continue; // elementos ocultos no sirven
                if (rect.width < 40 || rect.height < 40) continue; // demasiado pequeño
                usedElements.add(el);
                candidates.push(el);
            }
        }

        // Seleccionar aleatoriamente hasta `total` candidatos únicos
        const selected = [];
        const shuffled = [...candidates];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        for (let i = 0; i < Math.min(total, shuffled.length); i++) {
            selected.push(shuffled[i]);
        }

        // Inyectar en los seleccionados
        for (let idx = 0; idx < selected.length; idx++) {
            const anchor = selected[idx];
            const itemId = `hunt-${huntEvent.id}-${idx}`;
            if (foundIds.includes(itemId)) continue;
            _injectHuntItem(anchor, itemId, emoji, idx, huntEvent, total, reward);
        }

        // Si no se alcanzó el total, se puede registrar en consola para depuración
        if (selected.length < total) {
            console.warn(`[Cacería] Solo se pudieron inyectar ${selected.length} de ${total} objetos.`);
        }
    }

    function _onTreasureCollect(itemEl, huntEvent, total, reward) {
        const itemId   = itemEl.dataset.itemId;
        const foundIds = _readHuntIds();
        if (foundIds.includes(itemId)) return;

        foundIds.push(itemId);
        _writeHuntIds(foundIds);
        _writeHuntCount(foundIds.length);

        itemEl.classList.add('treasure-item--collected');
        setTimeout(() => itemEl.remove(), 600);

        const remaining = total - foundIds.length;
        if (remaining > 0) {
            _showToast(
                `${_icon('star', 15)}&thinsp;+1 estrella &middot; Faltan ${remaining}`,
                '#7c3aed'
            );
        } else {
            _showToast(
                `${_icon('trophy', 15)}&thinsp;¡Cacería completa! +${reward} monedas`,
                '#7c3aed'
            );
            if (window.GameCenter) {
                window.GameCenter.addCoins(reward, `Cacería completada: ${huntEvent.id}`);
            }
            if (_eventsCache) _renderEventsView(_eventsCache);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MECÁNICA: HITOS PERSONALES (personal_milestone)
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Lee el progreso del hito leyendo directamente desde GameCenter.getMissionStats().
     *
     * [v11.2 FIX] Migrado desde la clave localStorage la_milestone_progress_*,
     * que solo se actualizaba cuando la:levelcomplete disparaba en el contexto
     * del hub. Los juegos externos (games/*.html) despachan ese evento en su
     * propio document, por lo que el hub nunca lo recibía.
     * GameCenter.getMissionStats().games_played se actualiza en cualquier
     * contexto porque completeLevel() persiste en localStorage directamente.
     */
    function _readMilestoneProgress() {
        if (window.GameCenter?.getMissionStats) {
            return window.GameCenter.getMissionStats().games_played;
        }
        return 0;
    }

    /**
     * Comprueba si el multiplicador del hito ya fue activado hoy.
     * Evita re-activaciones en cada llamada a onEnter().
     */
    function _isMilestoneActivatedToday(eventId) {
        try {
            const raw = localStorage.getItem(`${MILESTONE_KEY}_activated_${eventId}`);
            if (!raw) return false;
            const { date } = JSON.parse(raw);
            return date === new Date().toISOString().slice(0, 10);
        } catch (_) { return false; }
    }

    function _setMilestoneActivatedToday(eventId) {
        try {
            const today = new Date().toISOString().slice(0, 10);
            localStorage.setItem(
                `${MILESTONE_KEY}_activated_${eventId}`,
                JSON.stringify({ date: today })
            );
        } catch (_) {}
    }

    /**
     * Evalúa si algún hito personal debe activar su multiplicador.
     * Se llama desde onEnter() (para detectar partidas jugadas fuera del hub)
     * y desde el listener de la:levelcomplete (para activación en sesión).
     *
     * [v11.2] Esta función es la única fuente de activación del multiplicador.
     * _initMilestoneListener solo registra el listener de evento; la lógica
     * de activación reside aquí para evitar duplicación.
     *
     * @param {Object[]} milestoneEvents  Eventos de tipo personal_milestone activos.
     */
    function _checkMilestoneCompletion(milestoneEvents) {
        if (!milestoneEvents || !milestoneEvents.length) return;
        milestoneEvents.forEach(ev => {
            if (!_isEventLive(ev)) return;

            const cfg      = ev.config || {};
            const target   = cfg.target || 10;
            const progress = _readMilestoneProgress();

            if (progress < target) return;
            if (_isMilestoneActivatedToday(ev.id)) return;

            _setMilestoneActivatedToday(ev.id);

            const mult     = cfg.multiplier          || 2;
            const duration = cfg.multiplierDurationMs || 1_800_000;

            if (window.GameCenter) {
                window.GameCenter.activateBonusMultiplier(
                    mult, duration,
                    `Hito: ${ev.ui?.title || ev.id}`
                );
            }

            _showToast(
                `${_icon('trophy', 15)}&thinsp;¡Hito completado! ×${mult} por ${Math.round(duration / 60_000)} min`,
                '#f59e0b'
            );

            if (_eventsCache) _renderEventsView(_eventsCache);
        });
    }

    /**
     * Registra el listener de la:levelcomplete para actualizaciones en sesión.
     *
     * [v11.2] El listener ya no lleva lógica de contador propia; delega a
     * _checkMilestoneCompletion() que usa GameCenter.getMissionStats() como
     * fuente de verdad. Así, partidas completadas fuera del hub (games/*.html)
     * también se contabilizan cuando el usuario vuelve a la vista de eventos.
     */
    function _initMilestoneListener(eventsData) {
        const milestoneEvents = (eventsData.activeEvents || []).filter(
            e => e.type === 'personal_milestone' && _isEventLive(e)
        );
        if (!milestoneEvents.length) return;

        document.addEventListener('la:levelcomplete', () => {
            // Re-evaluación inmediata para activación en sesión
            _checkMilestoneCompletion(milestoneEvents);
            // Re-renderizar tarjeta con progreso actualizado
            if (_eventsCache) _renderEventsView(_eventsCache);
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MECÁNICA: GACHAPÓN RELÁMPAGO (gacha_flash)
    // ════════════════════════════════════════════════════════════════════════════

    function _readGachaDailySpins(eventId) {
        try {
            const raw = localStorage.getItem(`${GACHA_DAILY_KEY}_${eventId}`);
            if (!raw) return 0;
            const { date, spins } = JSON.parse(raw);
            const today = new Date().toISOString().slice(0, 10);
            return date === today ? (spins || 0) : 0;
        } catch (_) { return 0; }
    }

    function _writeGachaDailySpins(eventId, spins) {
        try {
            const today = new Date().toISOString().slice(0, 10);
            localStorage.setItem(
                `${GACHA_DAILY_KEY}_${eventId}`,
                JSON.stringify({ date: today, spins })
            );
        } catch (_) {}
    }

    /**
     * Calcula la recompensa del gacha con distribución reequilibrada.
     *
     * [v11.1 BALANCE]
     *  55 % → [min, ~35]    VE parcial ≈ 12
     *  30 % → [~35, ~90]    VE parcial ≈ 19
     *  12 % → [~90, ~250]   VE parcial ≈ 20
     *  2.5% → [~250, ~500]  VE parcial ≈ 9
     *  0.5% → [~500, max]   VE parcial ≈ 4
     *  VE total ≈ 64 monedas  |  Costo: 50  |  Net ≈ +14 / tirada
     *  5 tiradas/día → net esperado máx ≈ 70 monedas/día
     */
    function _rollGachaReward(min, max) {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        const rand = buf[0] / 0xFFFFFFFF;

        const t1 = Math.max(min + 1, Math.min(35,  max * 0.035));
        const t2 = Math.max(t1  + 1, Math.min(90,  max * 0.09));
        const t3 = Math.max(t2  + 1, Math.min(250, max * 0.25));
        const t4 = Math.max(t3  + 1, Math.min(500, max * 0.50));

        let reward;
        if (rand < 0.55) {
            reward = min + Math.floor(rand / 0.55 * (t1 - min));
        } else if (rand < 0.85) {
            reward = t1 + Math.floor((rand - 0.55) / 0.30 * (t2 - t1));
        } else if (rand < 0.97) {
            reward = t2 + Math.floor((rand - 0.85) / 0.12 * (t3 - t2));
        } else if (rand < 0.995) {
            reward = t3 + Math.floor((rand - 0.97) / 0.025 * (t4 - t3));
        } else {
            reward = t4 + Math.floor((rand - 0.995) / 0.005 * (max - t4));
        }

        return Math.max(min, Math.min(max, Math.floor(reward)));
    }

    /**
     * Ejecuta un giro del Gachapón Relámpago.
     * [v11.1] Incluye verificación de límite diario.
     */
    function _spinGacha(gachaEvent) {
        if (!window.GameCenter) return { success: false, message: 'GameCenter no disponible' };

        const cfg  = gachaEvent.config || {};
        const cost = cfg.cost      || 50;
        const min  = cfg.minReward || 10;
        const max  = cfg.maxReward || 1000;

        const usedToday = _readGachaDailySpins(gachaEvent.id);
        if (usedToday >= GACHA_DAILY_MAX) {
            return {
                success: false,
                message: `Límite diario alcanzado (${GACHA_DAILY_MAX}/${GACHA_DAILY_MAX}). Vuelve mañana.`,
                spinsLeft: 0
            };
        }

        if (window.GameCenter.getBalance() < cost) {
            return { success: false, message: `Necesitas ${cost} monedas para girar.` };
        }

        const spendResult = window.GameCenter.spendCoins?.(cost, `Gachapón: ${gachaEvent.id}`);
        if (!spendResult?.success) {
            return { success: false, message: 'Saldo insuficiente.' };
        }

        const reward    = _rollGachaReward(min, max);
        const newTotal  = usedToday + 1;
        _writeGachaDailySpins(gachaEvent.id, newTotal);
        const spinsLeft = GACHA_DAILY_MAX - newTotal;

        window.GameCenter.addCoins(reward, `Gachapón Relámpago: ${gachaEvent.id}`);

        return { success: true, reward, message: `¡Ganaste ${reward} monedas!`, spinsLeft };
    }

    // ════════════════════════════════════════════════════════════════════════════
    // GACHAPÓN — MODAL DE RULETA (slot machine)
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Abre el modal de ruleta tipo tragamonedas.
     * Números falsos se deslizan y aterrizan en el resultado real.
     * El modal es un overlay fijo; no modifica el layout de la vista de eventos.
     *
     * [v11.2] Emojis reemplazados por iconos SVG inline.
     *
     * @param {number}   reward       Monedas ganadas.
     * @param {string}   accentColor  Color de acento del evento.
     * @param {Function} onClose      Callback al cerrar (re-renderiza la vista).
     */
    function _showGachaRoulette(reward, accentColor, onClose) {
        if (document.getElementById('la-gacha-overlay')) return;

        const ITEM_H   = 64;
        const NUM_FAKE = 22;

        const fakeNums = Array.from({ length: NUM_FAKE }, () =>
            Math.floor(10 + Math.random() * 990)
        );
        const allNums  = [...fakeNums, reward];

        // [v11.2] Labels con iconos SVG en lugar de emojis
        let rewardLabel = `${_icon('slot', 16)}&thinsp;Resultado`;
        let rewardClass = 'gacha-result--normal';
        if (reward >= 500)      {
            rewardLabel = `${_icon('trophy', 16)}&thinsp;¡JACKPOT!`;
            rewardClass = 'gacha-result--jackpot';
        } else if (reward >= 200) {
            rewardLabel = `${_icon('zap', 16)}&thinsp;¡Excelente!`;
            rewardClass = 'gacha-result--great';
        } else if (reward >= 80) {
            rewardLabel = `${_icon('star', 16)}&thinsp;¡Bien!`;
            rewardClass = 'gacha-result--good';
        }

        const overlay = document.createElement('div');
        overlay.id        = 'la-gacha-overlay';
        overlay.className = 'gacha-roulette-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Resultado del Gachapón');

        overlay.innerHTML = `
        <div class="gacha-roulette-modal" style="--gacha-color:${accentColor};">
            <div class="gacha-roulette-header">
                <span class="gacha-roulette-icon" aria-hidden="true">${_icon('slot', 28)}</span>
                <h3 class="gacha-roulette-title">Portal Estelar</h3>
            </div>

            <div class="gacha-slot-wrap" aria-hidden="true">
                <div class="gacha-slot-window">
                    <div class="gacha-slot-strip" id="la-slot-strip">
                        ${allNums.map(n => `<div class="gacha-slot-item">${n}</div>`).join('')}
                    </div>
                </div>
                <div class="gacha-slot-sheen gacha-slot-sheen--top"></div>
                <div class="gacha-slot-sheen gacha-slot-sheen--bottom"></div>
                <div class="gacha-slot-center-line"></div>
            </div>

            <div class="gacha-roulette-result ${rewardClass}" id="la-gacha-result" aria-live="polite">
                <span class="gacha-result-coins">${_icon('coin', 18)}&thinsp;+${reward}</span>
                <span class="gacha-result-label">${rewardLabel}</span>
            </div>

            <button class="gacha-roulette-close hidden" id="la-gacha-close">¡Genial!</button>
        </div>`;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('gacha-roulette-overlay--visible'));

        const strip   = document.getElementById('la-slot-strip');
        const targetY = (allNums.length - 1) * ITEM_H;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                strip.style.transition = `transform 2.4s cubic-bezier(0.22, 0.68, 0, 1.05)`;
                strip.style.transform  = `translateY(-${targetY}px)`;
            });
        });

        const resultEl = document.getElementById('la-gacha-result');
        const closeBtn = document.getElementById('la-gacha-close');

        strip.addEventListener('transitionend', () => {
            strip.style.transition = 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)';
            strip.style.transform  = `translateY(-${targetY - 6}px)`;
            setTimeout(() => {
                strip.style.transition = 'transform 0.12s ease-in';
                strip.style.transform  = `translateY(-${targetY}px)`;
                setTimeout(() => {
                    resultEl.classList.add('gacha-result--revealed');
                    closeBtn.classList.remove('hidden');
                }, 150);
            }, 180);
        }, { once: true });

        function _closeModal() {
            overlay.classList.remove('gacha-roulette-overlay--visible');
            overlay.classList.add('gacha-roulette-overlay--closing');
            setTimeout(() => {
                overlay.remove();
                if (typeof onClose === 'function') onClose();
            }, 320);
        }

        closeBtn.addEventListener('click', _closeModal);
        overlay.addEventListener('click', e => {
            if (e.target === overlay && !closeBtn.classList.contains('hidden')) _closeModal();
        });

        const _onKeyDown = e => {
            if (e.key === 'Escape' && !closeBtn.classList.contains('hidden')) {
                _closeModal();
                document.removeEventListener('keydown', _onKeyDown);
            }
        };
        document.addEventListener('keydown', _onKeyDown);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // TOAST — Notificaciones flotantes ligeras
    // ════════════════════════════════════════════════════════════════════════════

    /**
     * Muestra una notificación flotante breve.
     *
     * [v11.2 FIX] Usa innerHTML en lugar de textContent para permitir que
     * los iconos SVG inline (_icon()) se rendericen correctamente.
     * El contenido siempre viene de strings literales del código (no de
     * input de usuario), por lo que el uso de innerHTML es seguro.
     */
    function _showToast(message, color = 'var(--accent)') {
        const toast = document.createElement('div');
        toast.className = 'la-event-toast';
        toast.style.setProperty('--toast-color', color);
        toast.innerHTML = message;   // [v11.2] innerHTML para SVG icons
        document.body.appendChild(toast);
        toast.getBoundingClientRect(); // forzar reflow para la animación CSS
        toast.classList.add('la-event-toast--visible');
        setTimeout(() => {
            toast.classList.remove('la-event-toast--visible');
            setTimeout(() => toast.remove(), 400);
        }, 3000);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // MAPA DE TIPOS DE EVENTO — metadatos visuales
    // ════════════════════════════════════════════════════════════════════════════

    const EVENT_META = {
        coin_multiplier: {
            color: '#00d4ff', colorDim: 'rgba(0,212,255,0.14)', colorBorder: 'rgba(0,212,255,0.38)',
            colorGlow: 'rgba(0,212,255,0.18)',
            gradientBg: 'linear-gradient(150deg,#060f1e 0%,#091525 60%,rgba(0,212,255,0.05) 100%)',
            artEmojis: ['🪙','⚡','💫','🪙'],
            getHeroValue: ev => `×${ev.multiplier || 1.5}`,
            getShortDesc:  ev => ev.description || 'Multiplicador de monedas activo en todos los minijuegos.'
        },
        streak_boost: {
            color: '#f59e0b', colorDim: 'rgba(245,158,11,0.14)', colorBorder: 'rgba(245,158,11,0.38)',
            colorGlow: 'rgba(245,158,11,0.18)',
            gradientBg: 'linear-gradient(150deg,#0f0a00 0%,#1a1200 60%,rgba(245,158,11,0.05) 100%)',
            artEmojis: ['🔥','⚡','🔥','✨'],
            getHeroValue: () => '+2',
            getShortDesc:  ev => ev.description || 'Cada bono diario suma +2 a tu racha.'
        },
        interactive_hunt: {
            color: '#7c3aed', colorDim: 'rgba(124,58,237,0.14)', colorBorder: 'rgba(124,58,237,0.38)',
            colorGlow: 'rgba(124,58,237,0.18)',
            gradientBg: 'linear-gradient(150deg,#0a0614 0%,#120a24 60%,rgba(124,58,237,0.06) 100%)',
            artEmojis: ['⭐','🔍','✨','⭐'],
            getHeroValue: ev => `${ev.config?.total || 5}/5`,
            getShortDesc:  ev => ev.ui?.description || 'Encuentra objetos escondidos en la plataforma.'
        },
        personal_milestone: {
            color: '#f59e0b', colorDim: 'rgba(245,158,11,0.14)', colorBorder: 'rgba(245,158,11,0.38)',
            colorGlow: 'rgba(245,158,11,0.18)',
            gradientBg: 'linear-gradient(150deg,#0f0a00 0%,#1a1200 60%,rgba(245,158,11,0.05) 100%)',
            artEmojis: ['🏆','⚡','🎮','🏆'],
            getHeroValue: ev => `×${ev.config?.multiplier || 2}`,
            getShortDesc:  ev => ev.ui?.description || 'Completa partidas para activar un multiplicador de monedas.'
        },
        gacha_flash: {
            color: '#ec4899', colorDim: 'rgba(236,72,153,0.14)', colorBorder: 'rgba(236,72,153,0.38)',
            colorGlow: 'rgba(236,72,153,0.18)',
            gradientBg: 'linear-gradient(150deg,#140009 0%,#200010 60%,rgba(236,72,153,0.06) 100%)',
            artEmojis: ['🎰','✨','💎','🎰'],
            getHeroValue: ev => `${ev.config?.cost || 50} m.`,
            getShortDesc:  ev => ev.ui?.description || 'Gachapón de tiempo limitado. ¡Gana hasta 1000 monedas!'
        },
        daily_missions: {
            color: '#10b981', colorDim: 'rgba(16,185,129,0.14)', colorBorder: 'rgba(16,185,129,0.38)',
            colorGlow: 'rgba(16,185,129,0.18)',
            gradientBg: 'linear-gradient(150deg,#000f09 0%,#001a10 60%,rgba(16,185,129,0.05) 100%)',
            artEmojis: ['📋','✅','🎯','📋'],
            getHeroValue: () => '×2',
            getShortDesc:  ev => ev.ui?.description || 'Completa objetivos diarios para ganar recompensas.'
        }
    };

    function _getMeta(type) {
        return EVENT_META[type] || EVENT_META.coin_multiplier;
    }

    function _escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ════════════════════════════════════════════════════════════════════════════
    // RENDERING — TARJETAS POR TIPO
    // ════════════════════════════════════════════════════════════════════════════

    function _renderHuntCard(event, meta) {
        const cfg        = event.config || {};
        const total      = cfg.total || 5;
        const foundCount = _readHuntIds().length;
        const isComplete = foundCount >= total;
        const timeLeft   = _formatTimeLeft(event.endDate);
        const color      = meta.color;

        const safeTitle = _escapeHTML(event.ui?.title || 'Cacería de Tesoros');
        const safeDescription = _escapeHTML(event.ui?.description || '');
        const safeId = _escapeHTML(event.id);
        const safeType = _escapeHTML(event.type);
        const safeTimeLeft = _escapeHTML(timeLeft);
        return `
        <article class="lte-card lte-card--interactive"
                 data-event-id="${safeId}" data-event-type="${safeType}"
                 style="background:${meta.gradientBg}; --ev-color:${color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};">
            <div class="lte-art" aria-hidden="true">
                ${meta.artEmojis.map((e,i) => `<span class="lte-art__deco lte-art__deco--${i+1}">${e}</span>`).join('')}
            </div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${color} 0%,transparent 100%);"></div>
            <div class="lte-card__head">
                ${isComplete
                    ? `<span class="lte-status-badge" style="background:rgba(16,185,129,0.2);color:#10b981;border-color:rgba(16,185,129,0.4);">
                           ${_icon('check', 11)}&thinsp;COMPLETADA
                       </span>`
                    : `<span class="lte-status-badge lte-status-badge--live">
                           <span class="lte-live-dot" style="--dot-color:${color};"></span>EN VIVO
                       </span>`}
                <span class="lte-timer-pill" style="color:${color};border-color:${meta.colorBorder};background:${meta.colorDim};">
                    ${_icon('clock', 11)}&thinsp;${safeTimeLeft}
                </span>
            </div>
            <div class="lte-card__hero-wrap">
                <span class="lte-hero-value" style="color:${color};">${foundCount}/${total}</span>
            </div>
            <div class="lte-card__info">
                <h3 class="lte-card__name">${safeTitle}</h3>
                <p class="lte-card__desc">${safeDescription}</p>
            </div>
            <div class="lte-progress-wrap">
                <div class="lte-progress-bar" role="progressbar"
                     aria-valuenow="${foundCount}" aria-valuemax="${total}"
                     style="--progress:${Math.round(foundCount / total * 100)}%;--bar-color:${color};">
                    <div class="lte-progress-bar__fill"></div>
                </div>
                <span class="lte-progress-label" style="color:${color};">
                    ${foundCount}/${total} estrellas &middot; Premio: ${cfg.reward || 500} monedas
                </span>
            </div>
        </article>`;
    }

    function _renderMilestoneCard(event, meta) {
        const cfg      = event.config || {};
        const target   = cfg.target  || 10;
        const mult     = cfg.multiplier || 2;
        const durMin   = Math.round((cfg.multiplierDurationMs || 1_800_000) / 60_000);
        // [v11.2] Progreso leído desde GameCenter.getMissionStats().games_played
        const progress = _readMilestoneProgress();
        const isDone   = progress >= target;
        const timeLeft = _formatTimeLeft(event.endDate);
        const color    = meta.color;

        const bonusStatus = window.GameCenter?.getBonusMultiplierStatus?.() || { active: false };
        const bonusLabel  = bonusStatus.active && bonusStatus.multiplier === mult
            ? `${_icon('check', 11)}&thinsp;×${mult} ACTIVO &middot; ${Math.ceil(bonusStatus.remainingMs / 60_000)} min restantes`
            : null;

        const safeTitle = _escapeHTML(event.ui?.title || 'Hito Personal');
        const safeDescription = _escapeHTML(event.ui?.description || '');
        const safeId = _escapeHTML(event.id);
        const safeType = _escapeHTML(event.type);
        const safeTimeLeft = _escapeHTML(timeLeft);
        return `
        <article class="lte-card lte-card--interactive"
                 data-event-id="${safeId}" data-event-type="${safeType}"
                 style="background:${meta.gradientBg}; --ev-color:${color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};">
            <div class="lte-art" aria-hidden="true">
                ${meta.artEmojis.map((e,i) => `<span class="lte-art__deco lte-art__deco--${i+1}">${e}</span>`).join('')}
            </div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${color} 0%,transparent 100%);"></div>
            <div class="lte-card__head">
                ${isDone
                    ? `<span class="lte-status-badge" style="background:rgba(16,185,129,0.2);color:#10b981;border-color:rgba(16,185,129,0.4);">
                           ${bonusLabel
                               ? `${_icon('zap', 11)}&thinsp;×${mult} ACTIVO`
                               : `${_icon('check', 11)}&thinsp;COMPLETADO`}
                       </span>`
                    : `<span class="lte-status-badge lte-status-badge--live">
                           <span class="lte-live-dot" style="--dot-color:${color};"></span>EN VIVO
                       </span>`}
                <span class="lte-timer-pill" style="color:${color};border-color:${meta.colorBorder};background:${meta.colorDim};">
                    ${_icon('clock', 11)}&thinsp;${safeTimeLeft}
                </span>
            </div>
            <div class="lte-card__hero-wrap">
                <span class="lte-hero-value" style="color:${color};">×${mult}</span>
            </div>
            <div class="lte-card__info">
                <h3 class="lte-card__name">${safeTitle}</h3>
                <p class="lte-card__desc">${safeDescription}</p>
            </div>
            ${bonusLabel ? `
            <div class="lte-bonus-active-pill" style="color:${color};border-color:${meta.colorBorder};background:${meta.colorDim};">
                ${_icon('zap', 11)}&thinsp;${bonusLabel}
            </div>` : ''}
            <div class="lte-progress-wrap">
                <div class="lte-progress-bar" role="progressbar"
                     aria-valuenow="${progress}" aria-valuemax="${target}"
                     style="--progress:${Math.min(100, Math.round(progress / target * 100))}%;--bar-color:${color};">
                    <div class="lte-progress-bar__fill"></div>
                </div>
                <span class="lte-progress-label" style="color:${color};">
                    ${progress}/${target} partidas &middot; buff de ${durMin} min al completar
                </span>
            </div>
        </article>`;
    }

    /**
     * Renderiza la tarjeta del Gachapón Relámpago.
     * [v11.1] Muestra tiradas restantes del día y bloquea al agotar el límite.
     * [v11.2] Emojis reemplazados por iconos SVG. Hero value corregido.
     */
    function _renderGachaCard(event, meta) {
        const cfg      = event.config || {};
        const cost     = cfg.cost      || 50;
        const maxRew   = cfg.maxReward || 1000;
        const minRew   = cfg.minReward || 10;
        const timeLeft = _formatTimeLeft(event.endDate);
        const color    = meta.color;
        const balance  = window.GameCenter?.getBalance?.() || 0;

        const usedToday      = _readGachaDailySpins(event.id);
        const spinsLeft      = Math.max(0, GACHA_DAILY_MAX - usedToday);
        const dailyExhausted = spinsLeft === 0;
        const canSpin        = !dailyExhausted && balance >= cost;

        const btnLabel = dailyExhausted
            ? `${_icon('clock', 14)}&thinsp;Límite diario (${GACHA_DAILY_MAX}/${GACHA_DAILY_MAX})`
            : balance < cost
                ? `Necesitas ${cost} monedas`
                : `${_icon('star', 14)}&thinsp;Girar &middot; ${cost} monedas`;

        const spinsHint = dailyExhausted
            ? `<span class="lte-gacha-spins lte-gacha-spins--empty">Vuelve mañana para más tiradas</span>`
            : `<span class="lte-gacha-spins" style="color:${meta.colorBorder};">
                   ${_icon('slot', 13)}&thinsp;${spinsLeft} de ${GACHA_DAILY_MAX} tiradas disponibles hoy
               </span>`;

        const safeTitle = _escapeHTML(event.ui?.title || 'Gachapón Relámpago');
        const safeDescription = _escapeHTML(event.ui?.description || '');
        const safeId = _escapeHTML(event.id);
        const safeType = _escapeHTML(event.type);
        const safeTimeLeft = _escapeHTML(timeLeft);
        return `
        <article class="lte-card lte-card--interactive"
                 data-event-id="${safeId}" data-event-type="${safeType}"
                 style="background:${meta.gradientBg}; --ev-color:${color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};">
            <div class="lte-art" aria-hidden="true">
                ${meta.artEmojis.map((e,i) => `<span class="lte-art__deco lte-art__deco--${i+1}">${e}</span>`).join('')}
            </div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${color} 0%,transparent 100%);"></div>
            <div class="lte-card__head">
                <span class="lte-status-badge lte-status-badge--live">
                    <span class="lte-live-dot" style="--dot-color:${color};"></span>EN VIVO
                </span>
                <span class="lte-timer-pill" style="color:${color};border-color:${meta.colorBorder};background:${meta.colorDim};">
                    ${_icon('clock', 11)}&thinsp;${safeTimeLeft}
                </span>
            </div>
            <div class="lte-card__hero-wrap">
                <span class="lte-hero-value" style="color:${color};">${minRew}–${maxRew}</span>
            </div>
            <div class="lte-card__info">
                <h3 class="lte-card__name">${safeTitle}</h3>
                <p class="lte-card__desc">${safeDescription}</p>
            </div>
            <div class="lte-gacha-action">
                <button class="lte-gacha-btn${canSpin ? '' : ' lte-gacha-btn--disabled'}"
                        data-gacha-event-id="${event.id}"
                        ${canSpin ? '' : 'disabled aria-disabled="true"'}>
                    ${btnLabel}
                </button>
                ${spinsHint}
                <span class="lte-gacha-range" style="color:${meta.colorBorder};">
                    Gana de ${minRew} a ${maxRew} monedas
                </span>
            </div>
        </article>`;
    }

    function _renderDailyMissionsCard(event, meta) {
        const missions = event.config?.missions || [];
        const color    = meta.color;

        if (!window.GameCenter) return '';

        const stats = window.GameCenter.getMissionStats();

        const missionItems = missions.map(m => {
            const isClaimed = stats.claimed.includes(m.id);
            let current = 0;
            if (m.type === 'playtime')     current = stats.playtime;
            if (m.type === 'games_played') current = stats.games_played;

            const pct    = Math.min(100, Math.round(current / m.target * 100));
            const isDone = current >= m.target;

            let currentLabel = current;
            let targetLabel  = m.target;
            if (m.type === 'playtime') {
                currentLabel = `${Math.floor(current / 60)} min`;
                targetLabel  = `${Math.floor(m.target / 60)} min`;
            }

            return `
            <div class="lte-mission-item${isClaimed ? ' lte-mission-item--claimed' : ''}">
                <div class="lte-mission-header">
                    <span class="lte-mission-label">${_escapeHTML(m.label)}</span>
                    <span class="lte-mission-reward" style="color:${color};">
                        ${_icon('coin', 13)}&thinsp;+${m.reward}
                    </span>
                </div>
                <div class="lte-progress-bar lte-progress-bar--sm" role="progressbar"
                     aria-valuenow="${current}" aria-valuemax="${m.target}"
                     style="--progress:${pct}%;--bar-color:${color};">
                    <div class="lte-progress-bar__fill"></div>
                </div>
                <div class="lte-mission-footer">
                    <span class="lte-progress-label" style="color:${color};">
                        ${isClaimed
                            ? `${_icon('check', 11)}&thinsp;Reclamada`
                            : `${currentLabel} / ${targetLabel}`}
                    </span>
                    ${isDone && !isClaimed
                        ? `<button class="lte-claim-btn" style="--claim-color:${color};"
                                   data-mission-id="${_escapeHTML(m.id)}" data-mission-reward="${m.reward}">
                               Reclamar
                           </button>`
                        : ''}
                </div>
            </div>`;
        }).join('');

        const safeId = _escapeHTML(event.id);
        const safeType = _escapeHTML(event.type);
        const safeTitle = _escapeHTML(event.ui?.title || 'Misiones del Día');
        const safeDescription = _escapeHTML(event.ui?.description || '');
        return `
        <article class="lte-card lte-card--interactive lte-card--missions"
                 data-event-id="${safeId}" data-event-type="${safeType}"
                 style="background:${meta.gradientBg}; --ev-color:${color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};">
            <div class="lte-art" aria-hidden="true">
                ${meta.artEmojis.map((e,i) => `<span class="lte-art__deco lte-art__deco--${i+1}">${e}</span>`).join('')}
            </div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${color} 0%,transparent 100%);"></div>
            <div class="lte-card__head">
                <span class="lte-status-badge lte-status-badge--live">
                    <span class="lte-live-dot" style="--dot-color:${color};"></span>EN VIVO
                </span>
                <span class="lte-timer-pill" style="color:${color};border-color:${meta.colorBorder};background:${meta.colorDim};">
                    ${_icon('clock', 11)}&thinsp;Se reinicia a medianoche
                </span>
            </div>
            <div class="lte-card__info" style="margin-bottom:12px;">
                <h3 class="lte-card__name">${safeTitle}</h3>
                <p class="lte-card__desc">${safeDescription}</p>
            </div>
            <div class="lte-missions-list">${missionItems}</div>
        </article>`;
    }

    function _renderGenericCard(event) {
        const meta      = _getMeta(event.type);
        const isExpired = !_isEventLive(event);
        const timeLeft  = _formatTimeLeft(event.endDate);
        const heroValue = meta.getHeroValue(event);
        const shortDesc = meta.getShortDesc(event);
        const color     = meta.color;

        const safeId = _escapeHTML(event.id);
        const safeType = _escapeHTML(event.type);
        const safeTimeLeft = _escapeHTML(timeLeft);
        const safeHeroValue = _escapeHTML(heroValue);
        const safeShortDesc = _escapeHTML(shortDesc);
        const safeTitle = _escapeHTML(event.title || event.ui?.title || '');
        const artHTML = meta.artEmojis.map((emoji, i) =>
            `<span class="lte-art__deco lte-art__deco--${i+1}" aria-hidden="true">${_escapeHTML(emoji)}</span>`
        ).join('');

        const statusBadge = isExpired
            ? `<span class="lte-status-badge lte-status-badge--expired">EXPIRADO</span>`
            : `<span class="lte-status-badge lte-status-badge--live">
                   <span class="lte-live-dot" style="--dot-color:${color};"></span>EN VIVO
               </span>`;

        const timerBadge = isExpired ? '' : `
            <span class="lte-timer-pill"
                  style="color:${color}; border-color:${meta.colorBorder}; background:${meta.colorDim};">
                ${_icon('clock', 11)}&thinsp;${safeTimeLeft}
            </span>`;

        return `
        <article class="lte-card${isExpired ? ' lte-card--expired' : ''}"
                 data-event-id="${safeId}" data-event-type="${safeType}"
                 style="background:${meta.gradientBg}; --ev-color:${color}; --ev-glow:${meta.colorGlow}; --ev-border:${meta.colorBorder};"
                 ${isExpired ? 'aria-disabled="true"' : ''}>
            <div class="lte-art" aria-hidden="true">${artHTML}</div>
            <div class="lte-card__accent-bar" style="background:linear-gradient(90deg,${color} 0%,transparent 100%);"></div>
            <div class="lte-card__head">${statusBadge}${timerBadge}</div>
            <div class="lte-card__hero-wrap" aria-label="Efecto del evento: ${safeHeroValue}">
                <span class="lte-hero-value" style="color:${color};">${safeHeroValue}</span>
            </div>
            <div class="lte-card__info">
                <h3 class="lte-card__name">${safeTitle}</h3>
                <p class="lte-card__desc">${safeShortDesc}</p>
            </div>
        </article>`;
    }

    function _renderEventCard(event) {
        if (!_isEventLive(event)) return '';
        const meta = _getMeta(event.type);
        switch (event.type) {
            case 'interactive_hunt':   return _renderHuntCard(event, meta);
            case 'personal_milestone': return _renderMilestoneCard(event, meta);
            case 'gacha_flash':        return _renderGachaCard(event, meta);
            case 'daily_missions':     return _renderDailyMissionsCard(event, meta);
            default:                   return _renderGenericCard(event);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // RENDERING — HERO HEADER
    // ════════════════════════════════════════════════════════════════════════════

    function _renderHero(activeCount) {
        const plural = activeCount !== 1;
        return `
        <div class="lte-hero">
            <div class="lte-hero__eyebrow${activeCount === 0 ? ' lte-hero__eyebrow--empty' : ''}">
                ${activeCount > 0
                    ? `${_icon('zap', 12)}&thinsp;${activeCount} EVENTO${plural ? 'S' : ''} ACTIVO${plural ? 'S' : ''}`
                    : `${_icon('clock', 12)}&thinsp;SIN EVENTOS ACTIVOS`}
            </div>
            <h2 class="lte-hero__title">Eventos</h2>
            <p class="lte-hero__sub">
                ${activeCount > 0
                    ? 'Bonificaciones y desafíos activos — ¡participa antes de que expiren!'
                    : 'Pronto habrá nuevas bonificaciones. ¡Vuelve a revisar pronto!'}
            </p>
        </div>`;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // RENDERING — VISTA COMPLETA
    // ════════════════════════════════════════════════════════════════════════════

    function _renderEventsView(eventsData) {
        const container = document.getElementById('view-events');
        if (!container) return;

        const allEvents   = eventsData.activeEvents || [];
        const liveEvents  = allEvents.filter(e => _isEventLive(e));
        const activeCount = liveEvents.length;

        let html = `<div class="events-view-inner">`;
        html += _renderHero(activeCount);

        if (liveEvents.length > 0) {
            html += `<div class="lte-cards-list">`;
            html += liveEvents.map(_renderEventCard).filter(Boolean).join('');
            html += `</div>`;
            html += `
            <p class="lte-legend">
                ${_icon('info', 12)}
                <span>Los eventos se aplican automáticamente. Las misiones y la cacería requieren interacción.</span>
            </p>`;
        } else {
            const upcomingEvents = allEvents
                .filter(e => _getEventStatus(e) === 'upcoming')
                .map(e => _toSummaryEvent(e, 'upcoming'))
                .sort((a, b) => a.remainingMs - b.remainingMs);
            const pastEvents = allEvents
                .filter(e => _getEventStatus(e) === 'past')
                .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime())
                .map(e => _toSummaryEvent(e, 'past'));
            const nextEvent = upcomingEvents[0];
            const recentEvent = pastEvents[0];
            const streakInfo = window.GameCenter?.getStreakInfo?.();

            html += `
            <div class="lte-empty lte-empty--useful">
                ${_icon(nextEvent ? 'clock' : 'calendar', 42)}
                <p>${nextEvent ? _escapeHTML(nextEvent.title) : 'Eventos en pausa, arcade activo.'}</p>
                <span>${nextEvent
                    ? `Empieza en ${_escapeHTML(nextEvent.timeLeft)} · ${_escapeHTML(nextEvent.reward)}`
                    : 'No hay próximos eventos programados. Vuelve pronto o completa tu reto diario mientras tanto.'}</span>
                ${streakInfo?.canClaim ? `<button type="button" class="btn-primary lte-empty__cta" data-view="hub">Reclamar bono diario</button>` : `<button type="button" class="btn-primary lte-empty__cta" data-view="games">Jugar partidas</button>`}
                ${recentEvent ? `<small>Último destacado: ${_escapeHTML(recentEvent.title)} · ${_escapeHTML(recentEvent.reward)}</small>` : ''}
            </div>`;
        }

        html += `</div>`;
        container.innerHTML = html;
        _bindViewListeners(container, eventsData);
    }

    /**
     * Registra los event listeners de la vista de eventos.
     *
     * [v11.1] El flag _gachaAnimating previene spam de tiradas durante la
     * animación. El botón se re-habilita solo al cerrar el modal de ruleta.
     * [v11.2] Toasts con iconos SVG inline.
     */
    function _bindViewListeners(container, eventsData) {
        container.querySelectorAll('.lte-gacha-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                if (_gachaAnimating) return;

                const eventId = btn.dataset.gachaEventId;
                const gachaEv = (eventsData.activeEvents || []).find(e => e.id === eventId);
                if (!gachaEv) return;

                const result = _spinGacha(gachaEv);

                if (!result.success) {
                    _showToast(
                        `${_icon('alert', 15)}&thinsp;${result.message}`,
                        '#94a3b8'
                    );
                    setTimeout(() => _renderEventsView(_eventsCache), 100);
                    return;
                }

                _gachaAnimating = true;
                btn.disabled = true;
                btn.classList.add('lte-gacha-btn--disabled');

                const color = _getMeta(gachaEv.type).color;

                _showGachaRoulette(result.reward, color, () => {
                    _gachaAnimating = false;
                    if (_eventsCache) _renderEventsView(_eventsCache);
                });
            });
        });

        container.querySelectorAll('.lte-claim-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const missionId = btn.dataset.missionId;
                const reward    = parseInt(btn.dataset.missionReward, 10);
                if (!window.GameCenter) return;

                const result = window.GameCenter.claimMissionReward(missionId, reward);
                if (result.success) {
                    _showToast(
                        `${_icon('check', 15)}&thinsp;+${reward} monedas reclamadas`,
                        '#10b981'
                    );
                    setTimeout(() => _renderEventsView(_eventsCache), 100);
                }
            });
        });

        container.querySelectorAll('.lte-empty__cta[data-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                const viewId = btn.dataset.view;
                if (viewId) window.SpaRouter?.navigateTo?.(viewId);
            });
        });
    }

    // ════════════════════════════════════════════════════════════════════════════
    // CICLO DE VIDA SPA
    // ════════════════════════════════════════════════════════════════════════════

    let _rendered = false;

    /**
     * Llamado por spa-router.js al entrar a la vista de eventos.
     *
     * [v11.2] Tras cargar y renderizar, evalúa si algún hito personal alcanzó
     * su objetivo mientras el usuario jugaba en páginas externas (games/*.html).
     * Esto garantiza que el multiplicador se active aunque el evento
     * la:levelcomplete nunca llegó al documento del hub.
     */
    async function onEnter() {
        const container = document.getElementById('view-events');

        if (!_rendered && container) {
            container.innerHTML = `
            <div class="events-view-inner">
                <div class="lte-skeleton lte-skeleton--hero"></div>
                <div class="lte-skeleton lte-skeleton--card"></div>
                <div class="lte-skeleton lte-skeleton--card lte-skeleton--card-2"></div>
            </div>`;
        }

        try {
            const eventsData = await _loadEvents();
            _renderEventsView(eventsData);
            _rendered = true;

            // [v11.2] Verificar hitos completados fuera del hub (games/*.html)
            const milestoneEvents = (eventsData.activeEvents || []).filter(
                e => e.type === 'personal_milestone' && _isEventLive(e)
            );
            _checkMilestoneCompletion(milestoneEvents);

        } catch (err) {
            console.warn('[EventLogic] Error al cargar eventos:', err);
        }

        _clearCountdown();
        _countdownInterval = setInterval(() => {
            if (_eventsCache) _renderEventsView(_eventsCache);
        }, COUNTDOWN_INTERVAL_MS);
    }

    async function getHomeEventsSummary(limit = 2) {
        const eventsData = await _loadEvents();
        const allEvents = eventsData.activeEvents || [];
        const liveEvents = allEvents
            .filter(e => _getEventStatus(e) === 'active')
            .map(e => _toSummaryEvent(e, 'active'))
            .sort((a, b) => a.remainingMs - b.remainingMs);
        const upcomingEvents = allEvents
            .filter(e => _getEventStatus(e) === 'upcoming')
            .map(e => _toSummaryEvent(e, 'upcoming'))
            .sort((a, b) => a.remainingMs - b.remainingMs);
        const pastEvents = allEvents
            .filter(e => _getEventStatus(e) === 'past')
            .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime())
            .map(e => _toSummaryEvent(e, 'past'));

        const focusEvent = liveEvents[0] || upcomingEvents[0] || pastEvents[0] || null;
        const mode = liveEvents.length ? 'active' : (upcomingEvents.length ? 'upcoming' : (pastEvents.length ? 'quiet' : 'empty'));

        return {
            mode,
            activeCount: liveEvents.length,
            upcomingCount: upcomingEvents.length,
            pastCount: pastEvents.length,
            urgentEvent: liveEvents[0] || null,
            focusEvent,
            topEvents: liveEvents.slice(0, Math.max(1, Math.min(limit, 2))),
            upcomingEvents: upcomingEvents.slice(0, Math.max(1, Math.min(limit, 2))),
            recentEvents: pastEvents.slice(0, Math.max(1, Math.min(limit, 2))),
        };
    }

    function onLeave() {
        _clearCountdown();
    }

    function _clearCountdown() {
        if (_countdownInterval !== null) {
            clearInterval(_countdownInterval);
            _countdownInterval = null;
        }
    }

    window.EventView     = { onEnter, onLeave, getHomeEventsSummary };
    window.isEventActive = isEventActive;

})();
