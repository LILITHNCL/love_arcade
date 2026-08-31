/*
 * BackupEngine — Love Arcade v15.0
 * Exporta localStorage a .labak e importa desde .labak / .labak.gz (gzip + SHA-256).
 */
(function () {
    'use strict';

    const FILE_EXTENSION = '.labak';
    const LEGACY_FILE_EXTENSION = '.labak.gz';
    const MIME_TYPE = 'application/gzip';
    const KNOWN_KEYS = [
        'gamecenter_v6_promos',
        'love_arcade_time_cache',
        'love_arcade_last_recipient',
        'la_ws_state',
        'la_ws_completedLevels',
        'la_shooter_settings',
        'la_shooter_highscore',
        'puz_arcade_progress',
        'puz_arcade_unlocked',
        'puz_arcade_settings',
        'OS_highscore',
        'JD_highscore',
        'JD_muted',
        'dodger_muted',
        'dodger_highscore',
        'dodger_skin',
        'LUMINA_bestScore',
        'LUMINA_gameState'
    ];

    const DYNAMIC_PATTERNS = [
        /^puz_arcade_save_/,
        /^la_milestone_progress_/
    ];

    function _todayISO() {
        return new Date().toISOString().slice(0, 10);
    }

    function _filename() {
        return `LoveArcade_Backup_${_todayISO()}${FILE_EXTENSION}`;
    }

    function _emitStatus(type, message) {
        document.dispatchEvent(new CustomEvent('labackup:status', {
            detail: { type, message }
        }));
    }

    function _localStorageKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (typeof key === 'string') keys.push(key);
        }
        return keys;
    }

    function _matchesDynamicKey(key) {
        return DYNAMIC_PATTERNS.some((pattern) => pattern.test(key));
    }

    function _collectBackupData() {
        const allKeys = _localStorageKeys();
        const selectedKeys = new Set(KNOWN_KEYS);

        for (const key of allKeys) {
            if (_matchesDynamicKey(key)) selectedKeys.add(key);
            // Extra: incluir dinámicamente cualquier clave existente en esta página.
            selectedKeys.add(key);
        }

        const data = {};
        for (const key of selectedKeys) {
            const value = localStorage.getItem(key);
            if (value !== null) data[key] = value;
        }

        return {
            version: 1,
            format: 'labak+gzip+sha256',
            createdAt: new Date().toISOString(),
            source: location.origin,
            keys: data,
            keyCount: Object.keys(data).length
        };
    }

    async function _sha256Hex(text) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    async function _toGzipBlob(text) {
        if (typeof CompressionStream !== 'function') {
            throw new Error('CompressionStream no soportado en este navegador.');
        }
        const stream = new Blob([text], { type: 'application/json' })
            .stream()
            .pipeThrough(new CompressionStream('gzip'));
        return await new Response(stream).blob();
    }

    async function _fromGzipBlob(blob) {
        if (typeof DecompressionStream !== 'function') {
            throw new Error('DecompressionStream no soportado en este navegador.');
        }
        const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
        return await new Response(stream).text();
    }

    function _validateEnvelope(payload) {
        if (!payload || typeof payload !== 'object') throw new Error('Formato de respaldo inválido.');
        if (!payload.checksum || !payload.keys || typeof payload.keys !== 'object') {
            throw new Error('Estructura de respaldo incompleta.');
        }
    }

    async function _workerBackupTask(payload) {
        if (typeof window.workerTask !== 'function') {
            throw new Error('Worker helper no disponible');
        }
        return await window.workerTask(payload);
    }

    async function exportBackup(opts = {}) {
        const onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : null;
        const notify = (type, message) => {
            _emitStatus(type, message);
            if (onStatus) onStatus(type, message);
        };

        notify('processing', 'Procesando exportación…');

        try {
            const envelope = _collectBackupData();
            const canonical = JSON.stringify(envelope);
            let checksum = '';
            let gzBlob = null;

            try {
                const result = await _workerBackupTask({ action: 'backup-export', canonical });
                checksum = result.checksum;
                gzBlob = new Blob([new Uint8Array(result.bytes)], { type: MIME_TYPE });
            } catch (_) {
                checksum = await _sha256Hex(canonical);
                gzBlob = await _toGzipBlob(JSON.stringify({ ...envelope, checksum }));
            }

            if (!gzBlob) throw new Error('No se pudo crear el archivo de respaldo.');

            const finalBlob = gzBlob.type ? gzBlob : new Blob([gzBlob], { type: MIME_TYPE });
            const url = URL.createObjectURL(finalBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = _filename();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            notify('success', 'Copia de seguridad creada');
            return { success: true, filename: a.download, keyCount: envelope.keyCount };
        } catch (err) {
            notify('error', err?.message || 'Error al crear la copia de seguridad.');
            return { success: false, message: err?.message || 'Error de exportación.' };
        }
    }

    async function importBackupFromFile(file, opts = {}) {
        const onStatus = typeof opts.onStatus === 'function' ? opts.onStatus : null;
        const notify = (type, message) => {
            _emitStatus(type, message);
            if (onStatus) onStatus(type, message);
        };

        notify('processing', 'Procesando importación…');

        try {
            if (!file) throw new Error('Selecciona un archivo .labak o .labak.gz.');
            const lowerName = file.name?.toLowerCase() || '';
            const looksLikeBackup = lowerName.endsWith(FILE_EXTENSION) || lowerName.endsWith(LEGACY_FILE_EXTENSION);
            if (!looksLikeBackup) throw new Error('El archivo debe tener extensión .labak o .labak.gz.');

            let jsonText = '';
            try {
                const bytes = new Uint8Array(await file.arrayBuffer());
                const result = await _workerBackupTask({ action: 'backup-import', bytes: Array.from(bytes) });
                jsonText = result.jsonText;
            } catch (_) {
                jsonText = await _fromGzipBlob(file);
            }

            const payload = JSON.parse(jsonText);
            _validateEnvelope(payload);

            const expected = await _sha256Hex(JSON.stringify({
                version: payload.version,
                format: payload.format,
                createdAt: payload.createdAt,
                source: payload.source,
                keys: payload.keys,
                keyCount: payload.keyCount
            }));

            if (payload.checksum !== expected) {
                throw new Error('Integridad inválida: checksum SHA-256 no coincide.');
            }

            const entries = Object.entries(payload.keys);
            for (const [key, value] of entries) {
                if (typeof key !== 'string') continue;
                if (typeof value !== 'string') continue;
                localStorage.setItem(key, value);
            }

            notify('success', 'Progreso restaurado con éxito');
            return { success: true, restored: entries.length };
        } catch (err) {
            notify('error', err?.message || 'Error al restaurar el respaldo.');
            return { success: false, message: err?.message || 'Error de importación.' };
        }
    }

    function triggerImportPicker(inputEl) {
        if (!inputEl) return false;
        inputEl.value = '';
        inputEl.click();
        return true;
    }

    window.BackupEngine = {
        exportBackup,
        importBackupFromFile,
        triggerImportPicker
    };
})();
