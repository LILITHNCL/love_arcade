// Este script clásico debe cargarse antes de js/app.js; no depende de store ni del DOM.
(function initLoveArcadeUtils() {
    /**
     * Calcula el SHA-256 de un texto y devuelve el hash en hexadecimal.
     * Usa la API nativa crypto.subtle — disponible en todos los navegadores modernos.
     * @param {string} text
     * @returns {Promise<string>}
     */
    async function sha256(text) {
        const buffer = await crypto.subtle.digest(
            'SHA-256',
            new TextEncoder().encode(text)
        );
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    /**
     * Crea una versión con debounce de una función.
     * Útil para controlar la frecuencia de operaciones costosas (buscador, resize).
     * @param {Function} fn    Función a debounce-ar.
     * @param {number}   delay Espera en ms antes de ejecutar (por defecto 300ms).
     * @returns {Function}
     */
    function debounce(fn, delay = 300) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    function canUseVibration() {
        if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
            return false;
        }

        const userActivation = navigator.userActivation;
        if (!userActivation) return true;
        return Boolean(userActivation.isActive || userActivation.hasBeenActive);
    }

    // Compatibilidad pública para shop-logic.js y minijuegos existentes.
    window.debounce = debounce;
    window.LoveArcadeUtils = { sha256, canUseVibration };
})();
