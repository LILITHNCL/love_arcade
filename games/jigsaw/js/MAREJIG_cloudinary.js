(function MAREJIG_cloudinaryModule(windowObject) {
    'use strict';

    var MAREJIG_Config = windowObject.MAREJIG_Config;
    var MAREJIG_CLOUDINARY_BASE = 'https://res.cloudinary.com';
    var MAREJIG_PRESETS = Object.freeze({
        tiny: Object.freeze(['f_auto', 'q_auto:eco', 'w_32', 'h_24', 'c_fill', 'g_auto', 'ar_4:3']),
        thumbnail: Object.freeze(['f_auto', 'q_auto', 'w_480', 'h_360', 'c_fill', 'g_auto', 'ar_4:3']),
        thumbnailLarge: Object.freeze(['f_auto', 'q_auto', 'w_640', 'h_480', 'c_fill', 'g_auto', 'ar_4:3']),
        fullMobile: Object.freeze(['f_auto', 'q_auto:good', 'w_1600', 'h_1200', 'c_fit']),
        fullPremium: Object.freeze(['f_auto', 'q_auto:best', 'w_2048', 'h_1536', 'c_fit'])
    });

    function MAREJIG_getCloudName(options) {
        if (options && options.cloudName) return options.cloudName;
        return MAREJIG_Config.cloudinary.cloudName;
    }

    function MAREJIG_encodePublicId(publicId) {
        return String(publicId).split('/').map(encodeURIComponent).join('/');
    }

    function MAREJIG_applyFormatPreference(parts, options) {
        var forceAvif = Boolean(options && options.forceAvifForTesting) || Boolean(MAREJIG_Config.cloudinary.forceAvifForTesting);
        if (!forceAvif) return parts.slice();
        return parts.map(function MAREJIG_replaceFormat(part) {
            return part === 'f_auto' ? 'f_avif' : part;
        });
    }

    function MAREJIG_buildUrl(level, presetName, options) {
        var preset = MAREJIG_PRESETS[presetName];
        var cloudName = MAREJIG_getCloudName(options);
        var assetType = (options && options.assetType) || MAREJIG_Config.cloudinary.assetType;
        var deliveryType = (options && options.deliveryType) || MAREJIG_Config.cloudinary.deliveryType;

        if (!level || !level.cloudinaryPublicId || !preset || !cloudName) {
            console.warn('[MAREJIG] Cloudinary URL incompleta', { presetName: presetName, level: level && level.id });
            return '';
        }

        var transformations = MAREJIG_applyFormatPreference(preset, options).join(',');
        return [
            MAREJIG_CLOUDINARY_BASE,
            encodeURIComponent(cloudName),
            encodeURIComponent(assetType),
            encodeURIComponent(deliveryType),
            transformations,
            MAREJIG_encodePublicId(level.cloudinaryPublicId)
        ].join('/');
    }

    function MAREJIG_buildTinyPlaceholderUrl(level) {
        return MAREJIG_buildUrl(level, 'tiny');
    }

    function MAREJIG_buildThumbnailUrl(level, size) {
        return MAREJIG_buildUrl(level, size === 'large' ? 'thumbnailLarge' : 'thumbnail');
    }

    function MAREJIG_buildFullUrl(level, runtimeProfile) {
        return MAREJIG_buildUrl(level, runtimeProfile === 'fullPremium' ? 'fullPremium' : 'fullMobile');
    }


    function MAREJIG_buildAllUrls(level, options) {
        return {
            tiny: MAREJIG_buildUrl(level, 'tiny', options),
            thumbnail: MAREJIG_buildUrl(level, 'thumbnail', options),
            thumbnailLarge: MAREJIG_buildUrl(level, 'thumbnailLarge', options),
            fullMobile: MAREJIG_buildUrl(level, 'fullMobile', options),
            fullPremium: MAREJIG_buildUrl(level, 'fullPremium', options)
        };
    }

    function MAREJIG_validateUrl(url, options) {
        var fetcher = options && options.fetch ? options.fetch : windowObject.fetch;
        if (!url || typeof url !== 'string') {
            return Promise.resolve({ ok: false, skipped: false, status: 0, error: 'URL vacía' });
        }
        if (options && options.offline) {
            return Promise.resolve({ ok: true, skipped: true, status: 0, reason: 'offline' });
        }
        if (typeof fetcher !== 'function') {
            return Promise.resolve({ ok: true, skipped: true, status: 0, reason: 'fetch no disponible' });
        }
        return fetcher(url, { method: 'HEAD', mode: 'cors', cache: 'no-store' }).then(function MAREJIG_headResponse(response) {
            return { ok: response.ok, skipped: false, status: response.status, url: url };
        }).catch(function MAREJIG_headFailed(error) {
            if (options && options.strict) return { ok: false, skipped: false, status: 0, error: error.message, url: url };
            return { ok: true, skipped: true, status: 0, reason: error.message, url: url };
        });
    }

    function MAREJIG_getRuntimeProfile() {
        var longSide = Math.max(windowObject.innerWidth || 0, windowObject.innerHeight || 0);
        var dpr = Math.min(windowObject.devicePixelRatio || 1, MAREJIG_Config.canvas.maxDpr);
        var connection = windowObject.navigator && windowObject.navigator.connection;
        var constrained = Boolean(connection && (connection.saveData || ['slow-2g', '2g', '3g'].indexOf(connection.effectiveType) !== -1));

        if (constrained) return 'fullMobile';
        if (longSide >= 768 && dpr >= 1.5) return 'fullPremium';
        return 'fullMobile';
    }

    windowObject.MAREJIG_Cloudinary = Object.freeze({
        buildUrl: MAREJIG_buildUrl,
        buildTinyPlaceholderUrl: MAREJIG_buildTinyPlaceholderUrl,
        buildThumbnailUrl: MAREJIG_buildThumbnailUrl,
        buildFullUrl: MAREJIG_buildFullUrl,
        buildAllUrls: MAREJIG_buildAllUrls,
        validateUrl: MAREJIG_validateUrl,
        getRuntimeProfile: MAREJIG_getRuntimeProfile
    });
})(window);
