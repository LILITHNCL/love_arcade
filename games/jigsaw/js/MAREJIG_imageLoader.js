(function MAREJIG_imageLoaderModule(windowObject) {
    'use strict';

    var MAREJIG_Cloudinary = windowObject.MAREJIG_Cloudinary;
    var MAREJIG_thumbnailCache = new Map();
    var MAREJIG_fullImageCache = new Map();

    function MAREJIG_loadImageElement(url) {
        return new Promise(function MAREJIG_imagePromise(resolve, reject) {
            if (!url) {
                reject(new Error('URL de imagen vacía'));
                return;
            }

            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.decoding = 'async';
            img.onload = function MAREJIG_onImageLoad() {
                if (typeof img.decode === 'function') {
                    img.decode().then(function MAREJIG_decoded() {
                        resolve(img);
                    }).catch(function MAREJIG_decodeFallback() {
                        resolve(img);
                    });
                    return;
                }
                resolve(img);
            };
            img.onerror = function MAREJIG_onImageError() {
                reject(new Error('No se pudo cargar imagen: ' + url));
            };
            img.src = url;
        });
    }

    function MAREJIG_toDrawable(img) {
        if (typeof windowObject.createImageBitmap !== 'function') {
            return Promise.resolve({ drawable: img, kind: 'image' });
        }

        return windowObject.createImageBitmap(img).then(function MAREJIG_bitmapReady(bitmap) {
            return { drawable: bitmap, kind: 'bitmap' };
        }).catch(function MAREJIG_bitmapFallback() {
            return { drawable: img, kind: 'image' };
        });
    }

    function MAREJIG_loadMenuThumbnail(level) {
        var cacheKey = level.id + ':thumbnail';
        var cached = MAREJIG_thumbnailCache.get(cacheKey);
        if (cached) return cached;

        var promise = MAREJIG_loadImageElement(MAREJIG_Cloudinary.buildThumbnailUrl(level, 'small'));
        MAREJIG_thumbnailCache.set(cacheKey, promise);
        return promise;
    }

    function MAREJIG_loadPlayableImage(level, deviceProfile, onProgress) {
        var profile = deviceProfile || MAREJIG_Cloudinary.getRuntimeProfile();
        var cacheKey = level.id + ':' + profile;
        var cached = MAREJIG_fullImageCache.get(cacheKey);
        if (cached) return cached;

        function MAREJIG_progress(value, label) {
            if (typeof onProgress === 'function') onProgress(value, label);
        }

        var promise = Promise.resolve()
            .then(function MAREJIG_loadFull() {
                MAREJIG_progress(46, 'Cargando imagen completa');
                return MAREJIG_loadImageElement(MAREJIG_Cloudinary.buildFullUrl(level, profile)).then(function MAREJIG_fullLoaded(img) {
                    MAREJIG_progress(78, 'Decodificando imagen');
                    return MAREJIG_toDrawable(img).then(function MAREJIG_drawableReady(drawableResult) {
                        MAREJIG_progress(100, 'Listo');
                        return {
                            levelId: level.id,
                            profile: profile,
                            image: img,
                            drawable: drawableResult.drawable,
                            drawableKind: drawableResult.kind,
                            failed: false
                        };
                    });
                });
            })
            .catch(function MAREJIG_fullImageError(error) {
                MAREJIG_progress(100, 'Fallback visual listo');
                console.warn('[MAREJIG] Imagen full no disponible; usando fallback visual', error.message);
                return {
                    levelId: level.id,
                    profile: profile,
                    image: null,
                    drawable: null,
                    drawableKind: 'fallback',
                    failed: true,
                    error: error.message
                };
            });

        MAREJIG_fullImageCache.set(cacheKey, promise);
        return promise;
    }

    function MAREJIG_releaseFullImage(levelId) {
        Array.from(MAREJIG_fullImageCache.keys()).forEach(function MAREJIG_releaseKey(key) {
            if (key.indexOf(levelId + ':') === 0) {
                MAREJIG_fullImageCache.get(key).then(function MAREJIG_closeDrawable(result) {
                    if (result && result.drawable && typeof result.drawable.close === 'function') {
                        result.drawable.close();
                    }
                }).catch(function MAREJIG_ignoreReleaseError() {});
                MAREJIG_fullImageCache.delete(key);
            }
        });
    }

    function MAREJIG_clearThumbnailCache() {
        MAREJIG_thumbnailCache.clear();
    }

    windowObject.MAREJIG_ImageLoader = Object.freeze({
        loadMenuThumbnail: MAREJIG_loadMenuThumbnail,
        loadPlayableImage: MAREJIG_loadPlayableImage,
        releaseFullImage: MAREJIG_releaseFullImage,
        clearThumbnailCache: MAREJIG_clearThumbnailCache
    });
})(window);
