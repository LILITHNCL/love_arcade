const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(projectRoot, file), 'utf8');

function createSandbox(options = {}) {
    const storage = options.storage || new Map();
    let simulateQuotaExceeded = false;
    let mockedNow = null;

    const document = { writes: [], write(value) { this.writes.push(value); } };
    const context = vm.createContext({
         window: {}, document, localStorage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => {
                if (simulateQuotaExceeded) {
                    if (typeof simulateQuotaExceeded === 'function') {
                        simulateQuotaExceeded(key, value);
                    } else if (typeof simulateQuotaExceeded === 'object' && simulateQuotaExceeded !== null) {
                        throw simulateQuotaExceeded;
                    } else {
                        const err = new Error('QuotaExceededError');
                        err.name = 'QuotaExceededError';
                        err.code = 22;
                        throw err;
                    }
                }
                storage.set(key, String(value));
            },
            removeItem: (key) => storage.delete(key),
            clear: () => storage.clear(),
        },
        console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error, 
        Date: new Proxy(Date, {
            get(target, prop) {
                if (prop === 'now' && mockedNow !== null) {
                    return () => mockedNow;
                }
                return target[prop];
            },
            construct(target, args) {
                if (args.length === 0 && mockedNow !== null) {
                    return new target(mockedNow);
                }
                return new target(...args);
            },
            apply(target, thisArg, args) {
                if (args.length === 0 && mockedNow !== null) {
                    return new target(mockedNow).toString();
                }
                return Reflect.apply(target, thisArg, args);
            }
        }),
        setTimeout, clearTimeout,
        Promise, crypto, TextEncoder, TextDecoder, Uint8Array
    });
    context.window.window = context.window;
    
    return { 
        context, 
        storage, 
        document, 
        setQuotaExceeded: (val) => { simulateQuotaExceeded = val; },
        setMockNow: (val) => { mockedNow = val; }
    };
}

function loadFiles(context, files, options = {}) {
    for (const file of files) {
        let code = read(file);
        if (file === 'js/core/time-sync.js' && options && options.exposeTimeSyncInternals) {
            code = code.replace(
                'window.LoveArcadeTime = {',
                'window.LoveArcadeTime = {\n        _writeTimeCache,\n'
            );
        }
        if (file === 'js/domain/promo-codes.js' && options && options.promoCodesTable) {
            code = code.replace(
                /const PROMO_CODES_HASHED = \{[\s\S]*?\};/,
                `const PROMO_CODES_HASHED = ${JSON.stringify(options.promoCodesTable)};`
            );
        }
        vm.runInContext(code, context, { filename: file });
    }
}

module.exports = {
    read,
    createSandbox,
    loadFiles
};
