import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createSandbox, loadFiles, read } from '../helpers/vm-sandbox.cjs';

// Helper para calcular SHA-256 en formato hex al vuelo sin hardcodear claves
async function sha256Hex(text) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

// ── 1. Módulo de Identidad (js/domain/identity.js) ──────────────────────────
test('TKT-023: Identidad y Unicode (nickname, sustitutos UTF-16, alfabetos)', async (t) => {
    function setupIdentity() {
        const sandbox = createSandbox();
        loadFiles(sandbox.context, [
            'js/core/config.js',
            'js/core/utils.js',
            'js/core/state-store.js',
            'js/domain/identity.js'
        ]);
        const { LoveArcadeIdentity: Identity, LoveArcadeStore: Store } = sandbox.context.window;
        Store.replaceStore(Store.migrate({ nickname: '', gender: '@' }));
        return { Identity, Store };
    }

    await t.test('dado un nickname con emoji de 4 bytes en el límite de 15 caracteres, cuando se asigna con setIdentity, no debe dejar sustitutos huérfanos UTF-16', { todo: 'BUG-F5-06: setIdentity parte pares sustitutos UTF-16 en emojis al cortar a 15 caracteres' }, async () => {
        const { Identity, Store } = setupIdentity();
        // 14 caracteres ASCII ('Jugador_123456') + 1 emoji ('🎮', compuesto por 2 unidades de código UTF-16: \uD83C\uDDAE) = 16 unidades de código.
        // identity.js:9 ejecuta .slice(0, 15), cortando entre el sustituto alto (\uD83C) y el bajo (\uDDAE).
        const inputWithEmojiAtBoundary = 'Jugador_123456🎮';
        Identity.setIdentity(inputWithEmojiAtBoundary, '@');
        const stored = Store.getStore().nickname;

        // Comprobamos si el último código UTF-16 es un sustituto huérfano alto (\uD800 - \uDBFF)
        const lastCharCode = stored.charCodeAt(stored.length - 1);
        const hasLoneHighSurrogate = lastCharCode >= 0xD800 && lastCharCode <= 0xDBFF;

        // Comportamiento deseado: el truncado a 15 unidades no debe partir un par sustituto ni dejar caracteres huérfanos
        assert.equal(hasLoneHighSurrogate, false, 'el nickname no debe terminar en un sustituto huérfano UTF-16');
        // Debe ser representable limpiamente sin caracteres de reemplazo U+FFFD
        const encoded = new TextEncoder().encode(stored);
        const decoded = new TextDecoder().decode(encoded);
        assert.equal(decoded.includes('\uFFFD'), false, 'no debe generar caracteres de reemplazo U+FFFD en TextEncoder');
    });

    await t.test('dado un nickname con emojis completos dentro del límite de 15 caracteres, cuando se asigna, conserva todos los emojis y serializa en JSON', async () => {
        const { Identity, Store } = setupIdentity();
        const emojiNickname = '🎮👾✨💖🔥'; // 5 emojis = 10 unidades UTF-16 (dentro del límite de 15)
        Identity.setIdentity(emojiNickname, '@');

        assert.equal(Store.getStore().nickname, emojiNickname);
        assert.equal(Identity.getIdentity().nickname, emojiNickname);
        assert.equal(Identity.hasIdentity(), true);

        // Validación de serialización JSON limpia
        const serialized = JSON.stringify(Store.getStore());
        const parsed = JSON.parse(serialized);
        assert.equal(parsed.nickname, emojiNickname);
    });

    await t.test('dado un nickname con alfabetos internacionales (japonés, cirílico) y caracteres con tildes, cuando se asigna, los preserva intactos', async () => {
        const { Identity, Store } = setupIdentity();
        const testCases = [
            'ラブアーケード',   // Japonés katakana
            'Привет_123',       // Cirílico
            'Ángel_Niño',       // Español con acento y eñe
            'Alphaβeta'         // Griego
        ];

        for (const name of testCases) {
            Identity.setIdentity(name, '@');
            assert.equal(Store.getStore().nickname, name);
            assert.equal(Identity.getIdentity().nickname, name);
            assert.equal(Identity.hasIdentity(), true);
        }
    });

    await t.test('dado un nickname solo con espacios o caracteres invisibles, cuando se evalúa hasIdentity, refleja correctamente si hay contenido visual', async () => {
        const { Identity } = setupIdentity();
        Identity.setIdentity('   ', '@');
        assert.equal(Identity.hasIdentity(), false);

        Identity.setIdentity('  🎮  ', '@');
        assert.equal(Identity.hasIdentity(), true);
    });
});

// ── 2. Códigos Promocionales y Normalización (js/domain/promo-codes.js) ──────
test('TKT-023: Canje de Códigos Promocionales con Códigos FALSOS en Sandbox Aislado', async (t) => {
    // Definimos códigos FALSOS inventados para pruebas sintéticas (NINGÚN código real se incluye ni copia)
    const FAKE_CODE_BASIC = 'TEST_UNICODE_ALPHA_100';
    const FAKE_CODE_ACCENT = 'TEST_ACCENT_ÉXITO_250';
    const FAKE_CODE_NFC = 'TEST_NFC_ÑANDÚ_500';

    const fakeHashTable = {
        [await sha256Hex(FAKE_CODE_BASIC)]: 100,
        [await sha256Hex(FAKE_CODE_ACCENT)]: 250,
        [await sha256Hex(FAKE_CODE_NFC)]: 500
    };

    function setupPromoSandbox() {
        const sandbox = createSandbox();
        loadFiles(sandbox.context, [
            'js/core/config.js',
            'js/core/utils.js',
            'js/core/state-store.js',
            'js/domain/history.js',
            'js/domain/promo-codes.js'
        ], { promoCodesTable: fakeHashTable });

        const { LoveArcadeStore: Store, LoveArcadePromoCodes: PromoCodes } = sandbox.context.window;
        Store.replaceStore(Store.migrate({ coins: 0, redeemedHashes: [], history: [] }));
        return { Store, PromoCodes };
    }

    await t.test('dado un código falso con minúsculas y espacios regulares, cuando se canjea, trim().toUpperCase() normaliza y acredita monedas', async () => {
        const { Store, PromoCodes } = setupPromoSandbox();
        const input = '   test_unicode_alpha_100   ';
        const result = await PromoCodes.redeemPromoCode(input);

        assert.equal(result.success, true);
        assert.equal(result.reward, 100);
        assert.equal(Store.getStore().coins, 100);
        const expectedHash = await sha256Hex(FAKE_CODE_BASIC);
        assert.ok(Store.getStore().redeemedHashes.includes(expectedHash));
    });

    await t.test('dado un código falso con acento en minúsculas, cuando se canjea, toUpperCase() transforma las tildes a mayúsculas y lo canjea', async () => {
        const { Store, PromoCodes } = setupPromoSandbox();
        const input = '  test_accent_éxito_250  ';
        const result = await PromoCodes.redeemPromoCode(input);

        assert.equal(result.success, true);
        assert.equal(result.reward, 250);
        assert.equal(Store.getStore().coins, 250);
    });

    await t.test('dado un código falso con caracteres de ancho cero (\\u200B), cuando se canjea, trim() no los descarta y es rechazado sin mutar store', async () => {
        const { Store, PromoCodes } = setupPromoSandbox();
        // \u200B es Zero-Width Space (categoría Unicode Cf). String.prototype.trim() no lo elimina porque no pertenece a WhiteSpace.
        const inputWithZeroWidth = `\u200B${FAKE_CODE_BASIC}\u200B`;
        const result = await PromoCodes.redeemPromoCode(inputWithZeroWidth);

        assert.deepEqual({ ...result }, { success: false, message: 'Código inválido' });
        assert.equal(Store.getStore().coins, 0);
        assert.equal(Store.getStore().redeemedHashes.length, 0);
    });

    await t.test('dado un código falso con caracteres de ancho completo (Full-Width), cuando se canjea, al no aplicar NFKC se rechaza', async () => {
        const { Store, PromoCodes } = setupPromoSandbox();
        // Caracteres Full-Width (ej. 'ＴＥＳＴ...' \uFF34\uFF25\uFF33\uFF34)
        // toUpperCase() no convierte caracteres de ancho completo a half-width ASCII sin normalize('NFKC')
        const fullWidthCode = 'ＴＥＳＴ_ＵＮＩＣＯＤＥ_ＡＬＰＨＡ_１００';
        const result = await PromoCodes.redeemPromoCode(fullWidthCode);

        assert.deepEqual({ ...result }, { success: false, message: 'Código inválido' });
        assert.equal(Store.getStore().coins, 0);
        assert.equal(Store.getStore().redeemedHashes.length, 0);
    });

    await t.test('dado un código falso con tildes descompuestas (NFD), cuando se canjea, al no aplicar NFC diverge el hash y se rechaza', async () => {
        const { Store, PromoCodes } = setupPromoSandbox();
        // FAKE_CODE_NFC está en forma compuesta NFC ('TEST_NFC_ÑANDÚ_500').
        // La forma NFD separa la 'N' de la tilde ('N\u0303') y la 'U' del acento ('U\u0301').
        const nfdInput = FAKE_CODE_NFC.normalize('NFD');
        assert.notEqual(nfdInput, FAKE_CODE_NFC);

        const result = await PromoCodes.redeemPromoCode(nfdInput);
        assert.deepEqual({ ...result }, { success: false, message: 'Código inválido' });
        assert.equal(Store.getStore().coins, 0);
        assert.equal(Store.getStore().redeemedHashes.length, 0);
    });

    await t.test('dado un código falso rodeado por espacios de no separación (\\u00A0), cuando se canjea, trim() sí los elimina y acepta', async () => {
        const { Store, PromoCodes } = setupPromoSandbox();
        // \u00A0 (NO-BREAK SPACE) pertenece a la categoría Unicode Zs y forma parte de ECMAScript WhiteSpace.
        const inputWithNbsp = `\u00A0${FAKE_CODE_BASIC}\u00A0`;
        const result = await PromoCodes.redeemPromoCode(inputWithNbsp);

        assert.equal(result.success, true);
        assert.equal(result.reward, 100);
        assert.equal(Store.getStore().coins, 100);
    });
});

// ── 3. Serialización Base64 > 0xFF en GameCenter (exportSave / importSave) ──
test('TKT-023: Serialización exportSave/importSave con caracteres > 0xFF y btoa/atob nativos', async (t) => {
    function setupGameCenter() {
        const sandbox = createSandbox();
        // Simulamos fallo del worker para forzar la ejecución del fallback síncrono de game-center.js
        sandbox.context.workerTask = () => Promise.reject(new Error('Worker mock offline'));

        // RESTRICCIÓN ESTRICTA: Usamos exclusivamente btoa y atob nativos de Node sin ningún fallback a Buffer
        sandbox.context.btoa = globalThis.btoa;
        sandbox.context.atob = globalThis.atob;

        loadFiles(sandbox.context, [
            'js/core/config.js',
            'js/core/utils.js',
            'js/core/state-store.js',
            'js/domain/history.js',
            'js/domain/economy.js',
            'js/domain/promo-codes.js',
            'js/domain/moon-blessing.js',
            'js/domain/identity.js',
            'js/domain/avatar.js',
            'js/domain/daily-streak.js',
            'js/domain/theming.js',
            'js/domain/game-center.js'
        ]);

        const { GameCenter, LoveArcadeStore: Store } = sandbox.context.window;
        return { GameCenter, Store, sandbox };
    }

    await t.test('verificación preliminar: btoa nativo de Node falla directamente con puntos de código > 0xFF (Invalid character)', () => {
        // Demuestra que sandbox.context.btoa es la implementación estándar WHATWG y no una envoltura permisiva de Buffer
        assert.throws(
            () => globalThis.btoa('🎮'),
            /Invalid character|Latin1/
        );
        assert.throws(
            () => globalThis.btoa('Ángel_日本語'),
            /Invalid character|Latin1/
        );
    });

    await t.test('dado un store con emojis y caracteres > 0xFF, cuando se ejecuta exportSave e importSave, preserva íntegramente los datos y valida SHA-256', async () => {
        const { GameCenter, Store } = setupGameCenter();
        const complexUnicodeStore = Store.migrate({
            coins: 1234,
            nickname: '🎮Ángel_日本語✨',
            inventory: { 'skin_árbol_🎄': 1 },
            history: [
                { tipo: 'ingreso', cantidad: 1234, motivo: 'Premio Especial 🌟' }
            ]
        });
        Store.replaceStore(complexUnicodeStore);

        // 1. Exportación: no debe lanzar InvalidCharacterError
        // La producción usa TextEncoder() -> bytes -> String.fromCharCode(byte) -> btoa().
        // Cada byte UTF-8 está en el rango 0..255 (Latin-1), evitando que btoa falle.
        const exportedCode = await GameCenter.exportSave();
        assert.ok(typeof exportedCode === 'string' && exportedCode.length > 20);

        // 2. Limpieza del store local para comprobar restauración
        Store.replaceStore(Store.migrate({ coins: 0, nickname: 'vacio' }));

        // 3. Importación: atob() -> Uint8Array -> TextDecoder('utf-8')
        const importResult = await GameCenter.importSave(exportedCode);
        assert.equal(importResult.success, true, importResult.message);

        // 4. Verificación de integridad de los datos restaurados
        const restored = Store.getStore();
        assert.equal(restored.coins, 1234);
        assert.equal(restored.nickname, '🎮Ángel_日本語✨');
        assert.equal(restored.inventory['skin_árbol_🎄'], 1);
        assert.equal(restored.history[0]?.motivo, 'Premio Especial 🌟');
    });

    await t.test('dado un payload con caracteres Unicode cuya firma SHA-256 ha sido alterada, cuando se importa, rechaza por integridad', async () => {
        const { GameCenter, Store } = setupGameCenter();
        Store.replaceStore(Store.migrate({ coins: 500, nickname: 'Jugador_🎮' }));
        const exportedCode = await GameCenter.exportSave();

        // Alteramos un byte en el string base64 que codifica datos
        const tamperedCode = exportedCode.substring(0, 16) + (exportedCode[16] === 'X' ? 'Y' : 'X') + exportedCode.substring(17);
        const res = await GameCenter.importSave(tamperedCode);

        assert.equal(res.success, false);
        assert.match(res.message, /modificado|inválido|corrupto/i);
    });
});

// ── 4. Paridad de Codificación entre sync-worker.js y Fallback de GameCenter ─
test('TKT-023: Paridad de Codificación e Integridad entre sync-worker.js y Fallback', async (t) => {
    const SYNC_SALT = 'love_arcade_v75_integrity_2026';

    function createWorkerSandbox() {
        const workerCode = read('js/sync-worker.js');
        let messageListener = null;
        const pendingResolvers = new Map();

        const workerContext = vm.createContext({
            self: {
                addEventListener: (event, handler) => {
                    if (event === 'message') messageListener = handler;
                },
                postMessage: (msg) => {
                    const resolver = pendingResolvers.get(msg.id);
                    if (resolver) {
                        pendingResolvers.delete(msg.id);
                        resolver(msg.result);
                    }
                }
            },
            crypto,
            TextEncoder,
            TextDecoder,
            btoa: globalThis.btoa,
            atob: globalThis.atob,
            Uint8Array,
            Array,
            JSON,
            console
        });

        vm.runInContext(workerCode, workerContext, { filename: 'js/sync-worker.js' });

        let nextId = 1;
        function postMessageAsync(data) {
            return new Promise((resolve, reject) => {
                const id = nextId++;
                pendingResolvers.set(id, resolve);
                Promise.resolve(messageListener({ data: { id, ...data } })).catch(reject);
            });
        }

        return { postMessageAsync };
    }

    function createFallbackSandbox() {
        const sandbox = createSandbox();
        sandbox.context.workerTask = () => Promise.reject(new Error('Worker mock offline'));
        sandbox.context.btoa = globalThis.btoa;
        sandbox.context.atob = globalThis.atob;

        loadFiles(sandbox.context, [
            'js/core/config.js',
            'js/core/utils.js',
            'js/core/state-store.js',
            'js/domain/history.js',
            'js/domain/economy.js',
            'js/domain/promo-codes.js',
            'js/domain/moon-blessing.js',
            'js/domain/identity.js',
            'js/domain/avatar.js',
            'js/domain/daily-streak.js',
            'js/domain/theming.js',
            'js/domain/game-center.js'
        ]);

        const { GameCenter, LoveArcadeStore: Store } = sandbox.context.window;
        return { GameCenter, Store };
    }

    await t.test('dado un store con Unicode exportado por el Fallback, cuando se importa con sync-worker.js, valida checksum y devuelve datos íntegros', async () => {
        const { GameCenter, Store } = createFallbackSandbox();
        const worker = createWorkerSandbox();

        const unicodeState = Store.migrate({
            coins: 777,
            nickname: '🎮_Hero_日本語_✨',
            inventory: { 'espada_mágica_⚔': 2 }
        });
        Store.replaceStore(unicodeState);

        // Exportación con el Fallback síncrono del cliente
        const fallbackExportCode = await GameCenter.exportSave();
        assert.ok(typeof fallbackExportCode === 'string');

        // Importación con el script real de Web Worker (sync-worker.js)
        const workerResult = await worker.postMessageAsync({
            action: 'import',
            code: fallbackExportCode,
            salt: SYNC_SALT
        });

        assert.equal(workerResult.valid, true, 'sync-worker debe validar el checksum generado por el fallback');
        assert.equal(workerResult.legacy, false);
        assert.equal(workerResult.data.coins, 777);
        assert.equal(workerResult.data.nickname, '🎮_Hero_日本語_✨');
        assert.equal(workerResult.data.inventory['espada_mágica_⚔'], 2);
    });

    await t.test('dado un store con Unicode exportado por sync-worker.js, cuando se importa con el Fallback, valida checksum y restaura store', async () => {
        const { GameCenter, Store } = createFallbackSandbox();
        const worker = createWorkerSandbox();

        const unicodeState = Store.migrate({
            coins: 999,
            nickname: '🚀_Astronauta_🌟',
            inventory: { 'nave_alien_🛸': 1 }
        });

        // Exportación con el Web Worker real
        const workerExportCode = await worker.postMessageAsync({
            action: 'export',
            store: unicodeState,
            salt: SYNC_SALT
        });
        assert.ok(typeof workerExportCode === 'string');

        // Importación con el Fallback síncrono del cliente
        Store.replaceStore(Store.migrate({ coins: 0, nickname: 'limpio' }));
        const fallbackResult = await GameCenter.importSave(workerExportCode);

        assert.equal(fallbackResult.success, true, fallbackResult.message);
        assert.equal(Store.getStore().coins, 999);
        assert.equal(Store.getStore().nickname, '🚀_Astronauta_🌟');
        assert.equal(Store.getStore().inventory['nave_alien_🛸'], 1);
    });

    await t.test('paridad canónica: el checksum calculado por sync-worker.js y GameCenter es idéntico para un mismo payload con Unicode', async () => {
        const { GameCenter, Store } = createFallbackSandbox();
        const worker = createWorkerSandbox();

        const state = Store.migrate({ coins: 350, nickname: 'Ñandú_🎯' });
        Store.replaceStore(state);

        const fallbackCode = await GameCenter.exportSave();
        const workerCode = await worker.postMessageAsync({
            action: 'export',
            store: state,
            salt: SYNC_SALT
        });

        // Ambos códigos base64 deben ser idénticos porque la serialización JSON y el hash SHA-256 son deterministas
        assert.equal(fallbackCode, workerCode, 'la codificación generada por el Worker y el Fallback debe ser idéntica');
    });
});
