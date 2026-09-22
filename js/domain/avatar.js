// Este script clásico debe cargarse después de core/state-store.js y antes de app.js.
//
// API externa esperada: window.Sentinel puede exponer getSession() y getClient().
// El cliente devuelto debe conservar el contrato de Supabase Auth/Storage usado aquí.
// Sentinel vive en cloud/sentinel.js; este módulo no modifica ese contrato.
(function initLoveArcadeAvatar() {
    const Store = window.LoveArcadeStore;
    const { KB, AVATAR_MAX_LOCAL_KB } = Store.constants;
    let refreshAvatarUI = () => {};

    function _trackAvatarStorageFallback(reason, meta = {}) {
        window.GhostAnalytics?.track(reason, {
            component: 'avatar_upload',
            ...meta
        });
    }

    function _dataUrlToBlob(dataUrl) {
        const [meta, base64] = String(dataUrl).split(',');
        if (!meta || !base64) throw new Error('Formato de imagen inválido.');
        const match = /data:(.*?);base64/.exec(meta);
        const mime = match?.[1] || 'image/jpeg';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Blob([bytes], { type: mime });
    }

    function _blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            reader.readAsDataURL(blob);
        });
    }

    function compressImage(blob, maxWidth = 200, maxHeight = 200, quality = 0.7) {
        return new Promise((resolve, reject) => {
            try {
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
                    const width = Math.max(1, Math.round(img.width * scale));
                    const height = Math.max(1, Math.round(img.height * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        URL.revokeObjectURL(url);
                        reject(new Error('No se pudo comprimir la imagen.'));
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((compressed) => {
                        URL.revokeObjectURL(url);
                        if (!compressed) {
                            reject(new Error('No se pudo comprimir la imagen.'));
                            return;
                        }
                        resolve(compressed);
                    }, 'image/jpeg', quality);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error('No se pudo procesar la imagen.'));
                };
                img.src = url;
            } catch (err) {
                reject(err);
            }
        });
    }

    async function _saveAvatarLocally(dataUrl) {
        const sourceBlob = _dataUrlToBlob(dataUrl);
        const compressed = await compressImage(sourceBlob, 200, 200, 0.7);
        const finalDataUrl = await _blobToDataUrl(compressed);
        const sizeKB = finalDataUrl.length / KB;
        if (sizeKB > AVATAR_MAX_LOCAL_KB) {
            throw new Error('Imagen demasiado grande. Usa una foto de menos de 100 KB.');
        }
        Store.getStore().userAvatar = finalDataUrl;
        Store.save({ immediateCloudSync: true });
        refreshAvatarUI();
    }

    async function _uploadAvatarBlobToCloud(sourceBlob, { userId, sbClient, bucket = 'avatars' }) {
        const path = `${userId}/profile.jpg`;
        const compressed = await compressImage(sourceBlob, 200, 200, 0.7);
        const { error: uploadError } = await sbClient.storage.from(bucket).upload(path, compressed, {
            cacheControl: '3600', upsert: true, contentType: 'image/jpeg'
        });
        if (uploadError) throw uploadError;

        const { data } = sbClient.storage.from(bucket).getPublicUrl(path);
        if (!data?.publicUrl) throw new Error('No se pudo generar URL pública del avatar.');

        const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
        Store.getStore().userAvatar = publicUrl;
        Store.save({ immediateCloudSync: true });
        refreshAvatarUI();
        return { path, publicUrl: data.publicUrl, cacheBustedUrl: publicUrl };
    }

    async function setAvatar(dataUrl) {
        const session = window.Sentinel?.getSession?.();
        const sbClient = window.Sentinel?.getClient?.();
        const userId = session?.user?.id;
        const bucket = 'avatars';

        if (session && sbClient && userId) {
            const path = `${userId}/profile.jpg`;
            try {
                const { data: authData, error: authError } = await sbClient.auth.getSession();
                if (authError) throw authError;
                const freshSession = authData?.session;
                if (!freshSession?.access_token) {
                    _trackAvatarStorageFallback('storage_no_session', { user_id: userId, bucket, path });
                    console.error('[GameCenter] Avatar cloud upload cancelado por sesión ausente/expirada:', { hasSession: false, userId, path, bucket, message: 'Missing access token', statusCode: null });
                    await _saveAvatarLocally(dataUrl);
                    return { success: true, remote: false, reason: 'storage_no_session' };
                }

                const sourceBlob = _dataUrlToBlob(dataUrl);
                const { publicUrl } = await _uploadAvatarBlobToCloud(sourceBlob, { userId, sbClient, bucket });
                return { success: true, remote: true, url: publicUrl };
            } catch (err) {
                const statusCode = err?.statusCode || err?.status || null;
                const message = err?.message || String(err);
                const fallbackReason = Number(statusCode) === 403 ? 'storage_forbidden_rls' : 'storage_network';
                _trackAvatarStorageFallback(fallbackReason, { user_id: userId, bucket, path, status_code: statusCode });
                console.error('[GameCenter] Error detallado al subir avatar a Supabase Storage:', { hasSession: Boolean(session), userId, path, bucket, message, name: err?.name || 'StorageError', statusCode, details: err?.details || null, hint: err?.hint || null });
                console.warn('[GameCenter] Avatar cloud upload falló, usando fallback local:', message);
            }
        }

        await _saveAvatarLocally(dataUrl);
        return { success: true, remote: false };
    }

    async function setAvatarPath(assetPath) {
        const normalized = String(assetPath || '').trim().replace(/^\/+/, '');
        if (!/^assets\/avatar\/[\w./-]+\.(?:avif|webp|png|jpg|jpeg|svg)$/i.test(normalized)) {
            throw new Error('Avatar local no permitido.');
        }

        const session = window.Sentinel?.getSession?.();
        const sbClient = window.Sentinel?.getClient?.();
        const userId = session?.user?.id;
        const bucket = 'avatars';

        if (session && sbClient && userId) {
            const path = `${userId}/profile.jpg`;
            try {
                const { data: authData, error: authError } = await sbClient.auth.getSession();
                if (authError) throw authError;
                const freshSession = authData?.session;
                if (!freshSession?.access_token) {
                    _trackAvatarStorageFallback('storage_no_session', { user_id: userId, bucket, path, preset: true });
                    throw new Error('Missing access token');
                }

                const response = await fetch(normalized, { cache: 'no-cache' });
                if (!response.ok) throw new Error(`No se pudo cargar el avatar predefinido (${response.status}).`);
                const sourceBlob = await response.blob();
                const { publicUrl } = await _uploadAvatarBlobToCloud(sourceBlob, { userId, sbClient, bucket });
                return { success: true, remote: true, preset: true, url: publicUrl };
            } catch (err) {
                const statusCode = err?.statusCode || err?.status || null;
                const fallbackReason = Number(statusCode) === 403 ? 'storage_forbidden_rls' : 'storage_network';
                _trackAvatarStorageFallback(fallbackReason, { user_id: userId, bucket, path, preset: true, status_code: statusCode });
                console.warn('[GameCenter] Avatar predefinido no pudo subirse a Supabase; usando fallback local:', err?.message || String(err));
            }
        }

        Store.getStore().userAvatar = normalized;
        Store.save({ immediateCloudSync: true });
        refreshAvatarUI();
        return { success: true, remote: false, preset: true, url: normalized };
    }

    window.LoveArcadeAvatar = {
        compressImage, _dataUrlToBlob, _blobToDataUrl, _saveAvatarLocally,
        setAvatar, setAvatarPath, getAvatar: () => Store.getStore().userAvatar,
        setUIRefreshHandler: (handler) => { refreshAvatarUI = typeof handler === 'function' ? handler : () => {}; }
    };
})();
