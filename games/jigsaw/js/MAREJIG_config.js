(function MAREJIG_configModule(windowObject) {
    'use strict';

    var MAREJIG_Config = Object.freeze({
        internalName: 'marejigweb',
        publicGameId: 'jigsaw',
        storagePrefix: 'MAREJIG_',
        board: Object.freeze({
            cols: 12,
            rows: 9,
            targetPieceCount: 32
        }),
        images: Object.freeze({
            master: Object.freeze({ width: 2400, height: 1800 }),
            runtimeMobile: Object.freeze({ width: 1600, height: 1200 }),
            runtimePremium: Object.freeze({ width: 2048, height: 1536 }),
            thumbnail: Object.freeze({ width: 480, height: 360 }),
            thumbnailLarge: Object.freeze({ width: 640, height: 480 }),
            tinyPlaceholder: Object.freeze({ width: 32, height: 24 })
        }),
        canvas: Object.freeze({
            maxDpr: 2
        }),
        completionShowcase: Object.freeze({
            durationMs: 8000,
            cameraMs: 1200,
            reducedDurationMs: 3000,
            reducedCameraMs: 160,
            testDurationMs: 300,
            particlesStartMs: 1600,
            particleCount: 24
        }),
        menu: Object.freeze({
            initialPendingCards: 12,
            batchSize: 12
        }),
        debug: Object.freeze({
            enabled: false
        }),
        cloudinary: Object.freeze({
            // Placeholder público para desarrollo. Reemplazar por el cloudName real de producción.
            cloudName: 'dyspgn0sw',
            assetType: 'image',
            deliveryType: 'upload',
            forceAvifForTesting: false
        })
    });

    windowObject.MAREJIG_Config = MAREJIG_Config;
})(window);
