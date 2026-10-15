import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');

describe('QA (F2b/F5): Economía - completeLevel en hub y bridge (TKT-006 / TKT-022)', () => {
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

            test('dado un monto cero (0), cuando se completa, entonces registra nivel, guarda historial de 0 y retorna paid true', () => {
                reset(100);
                const result = env.GameCenter.completeLevel('juego1', 'nivel_cero', 0);
                
                assert.deepEqual({ ...result }, { paid: true, coins: 100 });
                assert.equal(env.Store.getStore().coins, 100);
                assert.deepEqual([...env.Store.getStore().progress['juego1']], ['nivel_cero']);
                
                const history = env.Store.getStore().history;
                assert.equal(history.length, 1);
                assert.equal(history[0].tipo, 'ingreso');
                assert.equal(history[0].cantidad, 0);
                assert.equal(history[0].motivo, 'Nivel nivel_cero completado · juego1');

                // Idempotencia: una segunda llamada con el mismo nivel no paga
                const second = env.GameCenter.completeLevel('juego1', 'nivel_cero', 10);
                assert.deepEqual({ ...second }, { paid: false, coins: 100 });
                assert.equal(env.Store.getStore().history.length, 1, 'No debe registrar nueva transacción');
            });

            test('dado un monto con decimales (15.5), cuando se completa, entonces acumula decimales según el diseño actual (hueco de redondeo)', () => {
                reset(100);
                const result = env.GameCenter.completeLevel('juego1', 'nivel_dec', 15.5);
                
                assert.deepEqual({ ...result }, { paid: true, coins: 115.5 });
                assert.equal(env.Store.getStore().coins, 115.5);
                assert.deepEqual([...env.Store.getStore().progress['juego1']], ['nivel_dec']);
                
                const history = env.Store.getStore().history;
                assert.equal(history.length, 1);
                assert.equal(history[0].tipo, 'ingreso');
                assert.equal(history[0].cantidad, 15.5);
                assert.equal(history[0].motivo, 'Nivel nivel_dec completado · juego1');
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

            test('dado un monto Infinity, cuando se completa, entonces corrompe el saldo a null en serialización (BUG R1)', { todo: 'BUG-F5-04: completeLevel acepta Infinity corrompiendo el saldo a null en serialización' }, () => {
                reset(100);
                const res = env.GameCenter.completeLevel('juego1', 'nivel_inf', Infinity);
                
                assert.equal(env.Store.getStore().coins, 100, 'Debería rechazar Infinity salvaguardando el saldo numérico');
                assert.equal(res.paid, false, 'No debería pagar con Infinity');
            });

            test('dado un monto -Infinity, cuando se completa, entonces corrompe el saldo a null en serialización (BUG R1)', { todo: 'BUG-F5-04: completeLevel acepta -Infinity corrompiendo el saldo a null en serialización' }, () => {
                reset(100);
                const res = env.GameCenter.completeLevel('juego1', 'nivel_neginf', -Infinity);
                
                assert.equal(env.Store.getStore().coins, 100, 'Debería rechazar -Infinity salvaguardando el saldo numérico');
                assert.equal(res.paid, false, 'No debería pagar con -Infinity');
            });

            test('dado un monto inválido (Infinity), cuando se intenta completar, entonces no debe marcar el nivel en progress permitiendo reintento válido posterior (BUG R1)', { todo: 'BUG-F5-05: completeLevel registra el nivel en progress aunque el monto sea inválido impidiendo reintentos legítimos' }, () => {
                reset(100);
                env.GameCenter.completeLevel('juego1', 'nivel_inv', Infinity);
                
                const progress = env.Store.getStore().progress['juego1'] || [];
                assert.equal(progress.includes('nivel_inv'), false, 'Un monto inválido rechazado no debe marcar el nivel como completado');
                
                const retry = env.GameCenter.completeLevel('juego1', 'nivel_inv', 50);
                assert.equal(retry.paid, true, 'Debe permitir completar el nivel tras llamada inválida previa');
                assert.equal(env.Store.getStore().coins, 150);
            });
        });
    }

    test('Paridad: ambas copias se comportan igual ante una tabla de casos extremos (TKT-006 / TKT-022)', () => {
        // Tabla de casos extremos ejecutada secuencialmente en Hub y Bridge
        const cases = [
            { game: 'j1', level: 'l1', reward: 10 },
            { game: 'j1', level: 'l1', reward: 10 }, // repetido (idempotencia)
            { game: 'j1', level: 'l_zero', reward: 0 }, // cero
            { game: 'j1', level: 'l_zero', reward: 0 }, // repetido cero
            { game: 'j1', level: 'l_negzero', reward: -0 }, // -0
            { game: 'j1', level: 'l_dec1', reward: 15.5 }, // decimales
            { game: 'j1', level: 'l_dec2', reward: 2.75 }, // más decimales
            { game: 'j2', level: 'l_str', reward: '5' }, // string
            { game: 'j2', level: 'l_neg', reward: -5 }, // negativo
            { game: 'j3', level: 'l_max', reward: Number.MAX_SAFE_INTEGER }, // entero grande
            { game: 'j4', level: 'l_inf', reward: Infinity }, // Infinity
            { game: 'j4', level: 'l_neginf', reward: -Infinity }, // -Infinity
            { game: 'j5', level: 'l_nan', reward: NaN } // NaN
        ];

        let stateHub;
        let stateBridge;
        const resultsHub = [];
        const resultsBridge = [];

        // Ejecutar en Hub
        const hubEnv = createEnv('hub');
        hubEnv.context.Date.now = () => 1000;
        hubEnv.Store.replaceStore(hubEnv.Store.migrate({ coins: 100, inventory: {}, history: [], progress: {} }));
        for (const c of cases) {
            const res = hubEnv.GameCenter.completeLevel(c.game, c.level, c.reward);
            resultsHub.push({ ...res });
        }
        stateHub = JSON.parse(JSON.stringify(hubEnv.Store.getStore()));

        // Ejecutar en Bridge
        const bridgeEnv = createEnv('bridge');
        bridgeEnv.context.Date.now = () => 1000;
        bridgeEnv.Store.replaceStore(bridgeEnv.Store.migrate({ coins: 100, inventory: {}, history: [], progress: {} }));
        for (const c of cases) {
            const res = bridgeEnv.GameCenter.completeLevel(c.game, c.level, c.reward);
            resultsBridge.push({ ...res });
        }
        stateBridge = JSON.parse(JSON.stringify(bridgeEnv.Store.getStore()));

        assert.deepEqual(resultsBridge, resultsHub, 'Las respuestas devueltas por ambas copias deben ser idénticas en cada caso');
        assert.deepEqual(stateBridge, stateHub, 'El estado resultante de ambas copias de completeLevel debe ser idéntico ante los mismos inputs extraños');
    });
});
