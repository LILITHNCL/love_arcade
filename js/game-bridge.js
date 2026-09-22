// Entry point clásico y síncrono para documentos bajo /games.
// No cargar js/app.js desde un minijuego: ese archivo inicializa UI exclusiva del hub.
(function initLoveArcadeGameBridge() {
    const dependencySources = [
        '/js/core/config.js',
        '/js/core/state-store.js',
        '/js/domain/history.js',
        '/js/domain/economy.js',
        '/js/domain/identity.js',
        '/js/game-bridge-runtime.js'
    ];

    const dependenciesReady = () => Boolean(
        window.CONFIG &&
        window.ECONOMY &&
        window.THEMES &&
        window.LoveArcadeStore &&
        window.LoveArcadeHistory &&
        window.LoveArcadeEconomy &&
        window.LoveArcadeIdentity
    );

    // document.write conserva la evaluación bloqueante y ordenada de scripts clásicos
    // cuando game-bridge.js se incluye durante el parseo del documento del juego.
    const runtimeSource = '/js/game-bridge-runtime.js';
    const sourcesToWrite = dependenciesReady()
        ? (window.GameCenter ? [] : [runtimeSource])
        : dependencySources;

    if (sourcesToWrite.length) {
        if (typeof document === 'undefined' || typeof document.write !== 'function') {
            throw new Error('[LoveArcade game bridge] Debe cargarse como script clásico durante el parseo del documento.');
        }
        document.write(sourcesToWrite.map((src) => `<script src="${src}"></script>`).join(''));
    }
})();
