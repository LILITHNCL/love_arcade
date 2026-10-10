import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');

describe('QA (F2b): Economía - completeLevel en hub y bridge (TKT-006)', () => {
    // Definimos cómo cargar cada entorno
    function createEnv(type) {
        const sandbox = createSandbox();
        const { context } = sandbox;
        
        // Dependencias comunes
        const baseDeps = [
            'js/core/config.js',
            'js/core/state-store.js',
            'js/domain/history.js',
            'js/domain/economy.js',
            'js/domain/identity.js'
        ];
        
        if (type === 'hub') {
            loadFiles(context, [
                ...baseDeps,
                'js/core/utils.js',
                'js/domain/promo-codes.js',
                'js/domain/moon-blessing.js',
                'js/domain/avatar.js',
                'js/domain/daily-streak.js',
                'js/domain/theming.js',
                'js/domain/game-center.js' // Hub version
            ]);
        } else {
            loadFiles(context, [
                ...baseDeps,
                'js/game-bridge-runtime.js' // Bridge version
            ]);
        }
        
        return {
            Store: context.window.LoveArcadeStore,
            GameCenter: context.window.GameCenter,
            context
        };
    }

    const targets = ['hub', 'bridge'];

    for (const target of targets) {
        describe(`Implementación en ${target}`, () => {
            let env;
            
            function reset(coins) {
                env = createEnv(target);
                env.Store.replaceStore(env.Store.migrate({ coins, inventory: {}, history: [], progress: {} }));
            }

            test('dado una primera llamada, cuando se completa, entonces paga y guarda historial', () => {
                reset(100);
                const result = env.GameCenter.completeLevel('juego1', 'nivel1', 50);
                
                assert.deepEqual({ ...result }, { paid: true, coins: 150 });
                assert.equal(env.Store.getStore().coins, 150);
                
                const history = env.Store.getStore().history;
                assert.equal(history.length, 1);
                assert.equal(history[0].tipo, 'ingreso');
                assert.equal(history[0].cantidad, 50);
                assert.equal(history[0].motivo, 'Nivel nivel1 completado · juego1');
            });

            test('dado una segunda llamada, cuando se completa, entonces es idempotente', () => {
                reset(100);
                env.GameCenter.completeLevel('juego1', 'nivel1', 50);
                
                const storeBefore = JSON.parse(JSON.stringify(env.Store.getStore()));
                const result = env.GameCenter.completeLevel('juego1', 'nivel1', 50);
                
                assert.deepEqual({ ...result }, { paid: false, coins: 150 });
                assert.deepEqual(JSON.parse(JSON.stringify(env.Store.getStore())), storeBefore, 'El store no debe mutar en llamadas repetidas');
            });

            test('dado un monto inválido tipo string, cuando se completa, entonces concatena (BUG R1)', { todo: 'BUG-F2b-02: completeLevel permite valores string que concatenan el saldo' }, () => {
                reset(100);
                env.GameCenter.completeLevel('juego1', 'nivel1', '5');
                
                assert.equal(env.Store.getStore().coins, 100, 'Debería rechazar montos tipo string, pero actualmente concatena y da "1005"');
            });

            test('dado un monto NaN, cuando se completa, entonces corrompe el saldo a NaN (BUG R1)', { todo: 'BUG-F2b-03: completeLevel no valida NaN' }, () => {
                reset(100);
                env.GameCenter.completeLevel('juego1', 'nivel1', NaN);
                
                assert.equal(env.Store.getStore().coins, 100, 'Debería rechazar NaN');
            });
            
            test('dado un monto negativo, cuando se completa, entonces permite restar del saldo (BUG R1)', { todo: 'BUG-F2b-04: completeLevel permite recompensas negativas' }, () => {
                reset(100);
                env.GameCenter.completeLevel('juego1', 'nivel1', -10);
                
                assert.equal(env.Store.getStore().coins, 100, 'Debería rechazar valores negativos');
            });
        });
    }

    test('Paridad: ambas copias se comportan igual ante una tabla de casos', () => {
        // En vez de solo los tests unitarios separados, comparamos estados finales completos para los mismos casos.
        const cases = [
            { game: 'j1', level: 'l1', reward: 10 },
            { game: 'j1', level: 'l1', reward: 10 }, // repetido
            { game: 'j2', level: '1', reward: "5" }, // string
            { game: 'j2', level: '2', reward: -5 }, // negativo
            { game: 'j3', level: '1', reward: NaN } // nan
        ];

        let stateHub;
        let stateBridge;

        // Ejecutar en Hub
        const hubEnv = createEnv('hub');
        hubEnv.context.Date.now = () => 1000;
        hubEnv.Store.replaceStore(hubEnv.Store.migrate({ coins: 100, inventory: {}, history: [], progress: {} }));
        for (const c of cases) {
            hubEnv.GameCenter.completeLevel(c.game, c.level, c.reward);
        }
        stateHub = JSON.parse(JSON.stringify(hubEnv.Store.getStore()));

        // Ejecutar en Bridge
        const bridgeEnv = createEnv('bridge');
        bridgeEnv.context.Date.now = () => 1000;
        bridgeEnv.Store.replaceStore(bridgeEnv.Store.migrate({ coins: 100, inventory: {}, history: [], progress: {} }));
        for (const c of cases) {
            bridgeEnv.GameCenter.completeLevel(c.game, c.level, c.reward);
        }
        stateBridge = JSON.parse(JSON.stringify(bridgeEnv.Store.getStore()));

        assert.deepEqual(stateBridge, stateHub, 'El estado resultante de ambas copias de completeLevel debe ser idéntico ante los mismos inputs extraños');
    });
});
