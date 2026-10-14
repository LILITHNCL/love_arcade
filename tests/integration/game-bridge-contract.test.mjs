import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSandbox, loadFiles, read } = require('../helpers/vm-sandbox.cjs');

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const bridgeSource = read('js/game-bridge.js');

describe('QA (F3b): Contrato del bridge e integración de economía (TKT-017)', () => {
    it('R10 en HTML · los 8 minijuegos declaran la carga de game-bridge.js como script clásico estricto (sin async, sin defer, sin type=module)', () => {
        const gameFolders = [
            '2048', 'word-hunt', 'jungle-dash', 'jigsaw',
            'Dodger', 'Shooter', 'ollin-smash', 'rompecabezas'
        ];

        for (const folder of gameFolders) {
            const htmlPath = path.join(projectRoot, 'games', folder, 'index.html');
            assert.ok(fs.existsSync(htmlPath), `El archivo ${folder}/index.html debe existir`);
            const html = fs.readFileSync(htmlPath, 'utf8');

            // Análisis tolerante del tag <script> que carga game-bridge.js
            const scriptTagMatch = html.match(/<script\b([^>]*game-bridge\.js[^>]*)>/i);
            assert.ok(scriptTagMatch, `${folder}/index.html debe tener una etiqueta <script> cargando game-bridge.js`);

            const tagAttributes = scriptTagMatch[1];
            assert.equal(
                /\bdefer\b/i.test(tagAttributes),
                false,
                `${folder}/index.html no debe incluir atributo "defer" en game-bridge.js`
            );
            assert.equal(
                /\basync\b/i.test(tagAttributes),
                false,
                `${folder}/index.html no debe incluir atributo "async" en game-bridge.js`
            );
            assert.equal(
                /\btype\s*=\s*["']?module["']?/i.test(tagAttributes),
                false,
                `${folder}/index.html no debe ser cargado con type="module"`
            );
        }
    });

    it('R10 en runtime · lanza error descriptivo si document es undefined', () => {
        const context = vm.createContext({
            window: {},
            console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error
        });
        context.window.window = context.window;

        assert.throws(() => {
            vm.runInContext(bridgeSource, context, { filename: 'js/game-bridge.js' });
        }, (err) => {
            assert.equal(
                err.message,
                '[LoveArcade game bridge] Debe cargarse como script clásico durante el parseo del documento.'
            );
            return true;
        });
    });

    it('R10 en runtime · lanza error descriptivo si document.write no es una función', () => {
        const context = vm.createContext({
            window: {},
            document: { write: null },
            console, JSON, Math, Object, Array, String, Number, Boolean, RegExp, Error
        });
        context.window.window = context.window;

        assert.throws(() => {
            vm.runInContext(bridgeSource, context, { filename: 'js/game-bridge.js' });
        }, (err) => {
            assert.equal(
                err.message,
                '[LoveArcade game bridge] Debe cargarse como script clásico durante el parseo del documento.'
            );
            return true;
        });
    });

    it('Idempotencia de dependencias · no inyecta scripts si todas las dependencias y GameCenter ya existen', () => {
        const { context, document } = createSandbox();

        context.window.CONFIG = {};
        context.window.ECONOMY = {};
        context.window.THEMES = {};
        context.window.LoveArcadeStore = {};
        context.window.LoveArcadeHistory = {};
        context.window.LoveArcadeEconomy = {};
        context.window.LoveArcadeIdentity = {};
        context.window.GameCenter = {};

        vm.runInContext(bridgeSource, context, { filename: 'js/game-bridge.js' });

        assert.equal(
            document.writes.length,
            0,
            'No debe inyectar scripts cuando las dependencias y GameCenter ya están disponibles'
        );
    });

    it('Idempotencia de dependencias · inyecta únicamente runtime si dependencias core ya están listas pero GameCenter no existe', () => {
        const { context, document } = createSandbox();

        context.window.CONFIG = {};
        context.window.ECONOMY = {};
        context.window.THEMES = {};
        context.window.LoveArcadeStore = {};
        context.window.LoveArcadeHistory = {};
        context.window.LoveArcadeEconomy = {};
        context.window.LoveArcadeIdentity = {};
        // GameCenter queda undefined

        vm.runInContext(bridgeSource, context, { filename: 'js/game-bridge.js' });

        assert.equal(
            document.writes.length,
            1,
            'Debe inyectar exactamente una llamada a document.write'
        );
        assert.equal(
            document.writes[0],
            '<script src="/js/game-bridge-runtime.js"></script>',
            'Debe inyectar únicamente el runtime del bridge sin duplicar las dependencias core'
        );
    });

    it('Persistencia cruzada de economía · addCoins y spendCoins desde bridge persisten en gamecenter_v6_promos', () => {
        const { context, storage } = createSandbox();

        loadFiles(context, [
            'js/core/config.js',
            'js/core/state-store.js',
            'js/domain/history.js',
            'js/domain/economy.js',
            'js/domain/identity.js',
            'js/game-bridge-runtime.js'
        ]);

        const { GameCenter } = context.window;
        assert.equal(GameCenter.getBalance(), 0);

        // 1. Agregar 100 monedas
        const addResult = GameCenter.addCoins(100);
        assert.equal(addResult.success, true);
        assert.equal(addResult.coins, 100);
        assert.equal(GameCenter.getBalance(), 100);

        const storedAfterAdd = JSON.parse(storage.get('gamecenter_v6_promos'));
        assert.equal(storedAfterAdd.coins, 100, 'Saldo persistido tras addCoins debe ser 100');

        // 2. Gastar 30 monedas
        const spendResult = GameCenter.spendCoins(30);
        assert.equal(spendResult.success, true);
        assert.equal(spendResult.coins, 70);
        assert.equal(GameCenter.getBalance(), 70);

        const storedAfterSpend = JSON.parse(storage.get('gamecenter_v6_promos'));
        assert.equal(storedAfterSpend.coins, 70, 'Saldo persistido tras spendCoins debe ser 70');
    });

    it('Persistencia cruzada de economía · buyItem desde bridge descuenta saldo, aplica cashback y registra inventario', () => {
        const { context, storage } = createSandbox();

        loadFiles(context, [
            'js/core/config.js',
            'js/core/state-store.js',
            'js/domain/history.js',
            'js/domain/economy.js',
            'js/domain/identity.js',
            'js/game-bridge-runtime.js'
        ]);

        const { GameCenter } = context.window;
        GameCenter.addCoins(200);
        assert.equal(GameCenter.getBalance(), 200);

        // Comprar item de precio 50 con cashback del 10% (5 monedas)
        const buyResult = GameCenter.buyItem({
            id: 'item_test',
            name: 'Item de Prueba',
            price: 50
        });

        assert.equal(buyResult.success, true);
        assert.equal(buyResult.finalPrice, 50);
        assert.equal(buyResult.cashback, 5);

        // Saldo neto: 200 - 50 + 5 = 155
        assert.equal(GameCenter.getBalance(), 155);

        const stored = JSON.parse(storage.get('gamecenter_v6_promos'));
        assert.equal(stored.coins, 155, 'Saldo en storage tras compra y cashback debe ser 155');
        assert.equal(stored.inventory['item_test'], 1, 'Inventario debe registrar item_test');
    });
});
