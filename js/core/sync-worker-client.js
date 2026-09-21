// Este script clásico debe cargarse antes de domain/game-center.js y backup-engine.js.
(function initLoveArcadeSyncWorkerClient() {
    let syncWorker = null;

    function getSyncWorker() {
        if (syncWorker) return syncWorker;
        try {
            syncWorker = new Worker('js/sync-worker.js');
            syncWorker.onerror = () => { syncWorker = null; };
        } catch (_) {
            syncWorker = null;
        }
        return syncWorker;
    }

    /**
     * Envía una tarea al Web Worker de sincronización y devuelve una Promise con el resultado.
     * Los consumidores aplican su fallback en el hilo principal si el worker no está disponible.
     *
     * @param {{ action: string, [key: string]: any }} payload
     * @returns {Promise<any>}
     */
    function workerTask(payload) {
        return new Promise((resolve, reject) => {
            const worker = getSyncWorker();
            if (!worker) { reject(new Error('Worker no disponible')); return; }
            const id = `${Date.now()}-${Math.random()}`;
            const handler = (event) => {
                if (event.data.id !== id) return;
                worker.removeEventListener('message', handler);
                if (event.data.error) reject(new Error(event.data.error));
                else resolve(event.data.result);
            };
            worker.addEventListener('message', handler);
            worker.postMessage({ ...payload, id });
        });
    }

    window.workerTask = workerTask;
})();
