// Este script clásico debe cargarse después de core/state-store.js y antes de economy.js.
(function initLoveArcadeHistory() {
    const Store = window.LoveArcadeStore;

    /**
     * Registra una transacción en el historial persistido.
     * @param {'ingreso'|'gasto'} tipo
     * @param {number} cantidad
     * @param {string} motivo
     */
    function logTransaction(tipo, cantidad, motivo) {
        const store = Store.getStore();
        if (!Array.isArray(store.history)) store.history = [];
        store.history.push({ tipo, cantidad, motivo, fecha: Date.now() });
        if (store.history.length > 50) {
            store.history = store.history.slice(-50);
        }
    }

    /**
     * Devuelve el historial en orden cronológico inverso.
     * @returns {Array<{tipo: 'ingreso'|'gasto', cantidad: number, motivo: string, fecha: number}>}
     */
    function getHistory() {
        return [...(Store.getStore().history || [])].reverse();
    }

    window.LoveArcadeHistory = { logTransaction, getHistory };
})();
