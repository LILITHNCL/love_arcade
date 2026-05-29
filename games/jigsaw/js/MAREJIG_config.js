(function MAREJIG_configModule(windowObject) {
    'use strict';

    var MAREJIG_Config = Object.freeze({
        internalName: 'marejigweb',
        publicGameId: 'jigsaw',
        storagePrefix: 'MAREJIG_',
        board: Object.freeze({
            cols: 16,
            rows: 12,
            targetPieceCount: 60
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
        menu: Object.freeze({
            initialPendingCards: 12,
            batchSize: 12
        }),
        cloudinary: Object.freeze({
            // Placeholder público para desarrollo. Reemplazar por el cloudName real de producción.
            cloudName: 'demo',
            assetType: 'image',
            deliveryType: 'upload',
            forceAvifForTesting: false
        })
    });

    windowObject.MAREJIG_Config = MAREJIG_Config;
})(window);
