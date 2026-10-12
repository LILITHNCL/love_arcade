const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');

function createBackupSandbox(options = {}) {
    const storage = new Map();
    if (options.initialStorage) {
        for (const [k, v] of Object.entries(options.initialStorage)) {
            storage.set(k, String(v));
        }
    }

    let simulateQuotaExceeded = false;
    const setItemLog = [];
    const docListeners = new Map();
    const createdBlobs = [];
    const anchorClicks = [];

    const customEventClass = class CustomEvent {
        constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
        }
    };

    const localStorage = {
        get length() { return storage.size; },
        key: (i) => Array.from(storage.keys())[i] ?? null,
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => {
            if (simulateQuotaExceeded) {
                const err = new Error('QuotaExceededError');
                err.name = 'QuotaExceededError';
                throw err;
            }
            setItemLog.push({ key: k, value: String(v) });
            storage.set(k, String(v));
        },
        removeItem: (k) => storage.delete(k),
        clear: () => storage.clear()
    };

    const document = {
        addEventListener: (evt, fn) => {
            if (!docListeners.has(evt)) docListeners.set(evt, new Set());
            docListeners.get(evt).add(fn);
        },
        removeEventListener: (evt, fn) => {
            docListeners.get(evt)?.delete(fn);
        },
        dispatchEvent: (e) => {
            const listeners = docListeners.get(e.type);
            if (listeners) {
                for (const l of listeners) l(e);
            }
            return true;
        },
        createElement: (tag) => {
            if (tag === 'a') {
                const anchor = {
                    href: '',
                    download: '',
                    click() {
                        anchorClicks.push({ href: this.href, download: this.download });
                    }
                };
                return anchor;
            }
            return {};
        },
        body: {
            appendChild: () => {},
            removeChild: () => {}
        }
    };

    const URLMock = {
        createObjectURL: (blob) => {
            createdBlobs.push(blob);
            if (typeof URL.createObjectURL === 'function') {
                return URL.createObjectURL(blob);
            }
            return `blob:fake-${createdBlobs.length}`;
        },
        revokeObjectURL: (url) => {
            if (typeof URL.revokeObjectURL === 'function') {
                try { URL.revokeObjectURL(url); } catch (_) {}
            }
        }
    };

    const context = vm.createContext({
        localStorage,
        document,
        CustomEvent: customEventClass,
        location: { origin: options.origin || 'https://love-arcade.local' },
        URL: URLMock,
        Blob: globalThis.Blob,
        File: globalThis.File,
        Response: globalThis.Response,
        CompressionStream: globalThis.CompressionStream,
        DecompressionStream: globalThis.DecompressionStream,
        crypto: globalThis.crypto,
        TextEncoder: globalThis.TextEncoder,
        TextDecoder: globalThis.TextDecoder,
        Uint8Array: globalThis.Uint8Array,
        Array,
        Object,
        JSON,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        Date,
        Promise,
        console,
        setTimeout,
        clearTimeout,
        window: {}
    });
    context.window.window = context.window;

    // Cargar dependencias en el orden de index.html
    const defaultFiles = [
        'js/core/sync-worker-client.js',
        'js/backup-engine.js'
    ];
    const filesToLoad = options.files || defaultFiles;
    for (const f of filesToLoad) {
        vm.runInContext(read(f), context, { filename: f });
    }

    return {
        context,
        storage,
        setItemLog,
        createdBlobs,
        anchorClicks,
        docListeners,
        setQuotaExceeded: (val) => { simulateQuotaExceeded = val; },
        createBackupFile: async (envelope, filename = 'test.labak') => {
            const stream = new Blob([JSON.stringify(envelope)], { type: 'application/json' })
                .stream()
                .pipeThrough(new CompressionStream('gzip'));
            const blob = await new Response(stream).blob();
            return new File([blob], filename);
        },
        computeChecksum: async (canonical) => {
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
            return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    };
}

module.exports = {
    createBackupSandbox
};
