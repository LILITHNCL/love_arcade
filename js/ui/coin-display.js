// Este script clásico no depende del store y debe cargarse antes de hud-render.js.
(function initLoveArcadeCoinDisplay() {
    /**
     * Anima un conjunto de contadores mediante requestAnimationFrame.
     *
     * @param {HTMLElement[]} elements Nodos cuyo textContent se actualiza en cada frame.
     * @param {number} start Valor inicial de la animación.
     * @param {number} end Valor final de la animación.
     * @param {number} [duration=650] Duración en milisegundos.
     * @param {(value: number) => void} [onComplete] Callback al terminar.
     */
    function animateValue(elements, start, end, duration = 650, onComplete = () => {}) {
        if (!elements || !elements.length) return;
        if (start === end) {
            elements.forEach(el => { el.textContent = end; });
            onComplete(end);
            return;
        }
        const range = end - start;
        const t0 = performance.now();
        const step = (now) => {
            const progress = Math.min((now - t0) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            elements.forEach(el => { el.textContent = Math.round(start + range * eased); });
            if (progress < 1) requestAnimationFrame(step);
            else onComplete(end);
        };
        requestAnimationFrame(step);
    }

    /** Formatea un número de monedas para la navbar. */
    function formatCoinsNavbar(n) {
        if (n < 10_000) return String(n);
        const thousands = n / 1000;
        return (Number.isInteger(thousands) ? thousands : Math.floor(thousands * 10) / 10) + 'k';
    }

    window.LoveArcadeCoinDisplay = { animateValue, formatCoinsNavbar };
    // Contrato público usado por shop-logic.js.
    window.formatCoinsNavbar = formatCoinsNavbar;
})();
