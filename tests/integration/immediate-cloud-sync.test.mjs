import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { setupSentinelSandbox } = require('../helpers/fake-supabase.cjs');

const waitForTick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('QA (F3a): Auditoría de immediateCloudSync (TKT-016)', () => {
    describe('Mecanismo Core: Store.save({ immediateCloudSync: true }) vs Store.save()', () => {
        it('dado una sesión activa, cuando se guarda con immediateCloudSync: true, entonces sube a Supabase inmediatamente y emite la:synced', async () => {
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 300,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });

            await env.login({ user: { id: 'user-imm-1', email: 'imm1@example.com' } });
            env.dispatchDomLoaded();

            let syncedEventDispatched = false;
            let syncedDetail = null;
            env.context.document.addEventListener('la:synced', (e) => {
                syncedEventDispatched = true;
                syncedDetail = e.detail;
            });

            const initialUpserts = env.fakeSupabase.upsertLog.length;
            const store = env.LoveArcadeStore.getStore();
            store.coins = 450;

            env.LoveArcadeStore.save({ immediateCloudSync: true });
            await waitForTick();

            // 1. Subida inmediata a Supabase
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1, 'Debe ejecutar un upsert inmediato en Supabase');
            const record = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            assert.equal(record.id, 'user-imm-1');
            const remoteStore = JSON.parse(record.game_data.gamecenter_v6_promos);
            assert.equal(remoteStore.coins, 450, 'El snapshot subido debe reflejar el saldo modificado');

            // 2. Marca de tiempo de Sentinel actualizada en localStorage
            const localTs = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
            assert.ok(localTs, 'Debe registrar la marca de tiempo de sincronización');
            assert.equal(record.updated_at, localTs, 'La marca remota y local deben coincidir');

            // 3. Evento la:synced emitido en document
            assert.equal(syncedEventDispatched, true, 'Debe emitir el evento la:synced');
            assert.equal(syncedDetail?.source, 'sentinel-upsert');
        });

        it('dado una sesión activa, cuando se guarda sin flag (Store.save()), entonces NO ejecuta subida inmediata antes del debounce', async () => {
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 300,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });

            await env.login({ user: { id: 'user-imm-2', email: 'imm2@example.com' } });
            env.dispatchDomLoaded();

            const initialUpserts = env.fakeSupabase.upsertLog.length;
            const store = env.LoveArcadeStore.getStore();
            store.coins = 350;

            // Guardado normal sin immediateCloudSync
            env.LoveArcadeStore.save();
            await waitForTick();

            // 1. NO sube de inmediato
            assert.equal(
                env.fakeSupabase.upsertLog.length,
                initialUpserts,
                'Un save() estándar no debe subir de inmediato a Supabase (debe esperar debounce)'
            );

            // 2. Persistido localmente en storage
            const localRaw = env.context.localStorage.getItem(env.context.CONFIG.stateKey);
            const localParsed = JSON.parse(localRaw);
            assert.equal(localParsed.coins, 350);

            // 3. Al disparar beforeunload, el cambio pendiente sí se sincroniza
            env.dispatchBeforeUnload();
            await waitForTick();
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1, 'El cambio pendiente debe subirse ante evento de salida');
            const finalRecord = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            assert.equal(JSON.parse(finalRecord.game_data.gamecenter_v6_promos).coins, 350);
        });
    });

    describe('Operaciones de Economía (buyItem, spendCoins, addCoins)', () => {
        it('dado compra en tienda (buyItem), cuando se ejecuta, entonces deduce monedas, agrega item y sincroniza inmediatamente', async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 500,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });

            await env.login({ user: { id: 'user-eco-1', email: 'eco1@example.com' } });
            env.dispatchDomLoaded();

            const initialUpserts = env.fakeSupabase.upsertLog.length;
            const result = env.LoveArcadeEconomy.buyItem({
                id: 'wallpaper_neon_arcade',
                name: 'Fondo Neón Arcade',
                price: 150
            });

            assert.equal(result.success, true);
            await waitForTick();

            // Subida inmediata a Supabase
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1, 'buyItem debe disparar sincronización inmediata');
            const record = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            const remoteStore = JSON.parse(record.game_data.gamecenter_v6_promos);
            // Saldo tras compra de 150 monedas con 10% de cashback (+15): 500 - 150 + 15 = 365
            assert.equal(remoteStore.coins, 365, 'Saldo en la nube actualizado');
            assert.equal(remoteStore.inventory['wallpaper_neon_arcade'], 1, 'Inventario en la nube actualizado');
        });

        it('dado gasto de monedas (spendCoins), cuando se ejecuta, entonces deduce saldo y sincroniza inmediatamente', async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 200,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });

            await env.login({ user: { id: 'user-eco-2', email: 'eco2@example.com' } });
            env.dispatchDomLoaded();

            const initialUpserts = env.fakeSupabase.upsertLog.length;
            const result = env.LoveArcadeEconomy.spendCoins(75, 'Gasto de prueba');
            assert.equal(result.success, true);
            await waitForTick();

            // Subida inmediata a Supabase
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1, 'spendCoins debe disparar sincronización inmediata');
            const record = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            const remoteStore = JSON.parse(record.game_data.gamecenter_v6_promos);
            assert.equal(remoteStore.coins, 125, 'Saldo en la nube reducido inmediatamente');
        });

        it('dado ingreso de monedas (addCoins), cuando se ejecuta, entonces incrementa saldo y sincroniza inmediatamente', async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 50,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });

            await env.login({ user: { id: 'user-eco-3', email: 'eco3@example.com' } });
            env.dispatchDomLoaded();

            const initialUpserts = env.fakeSupabase.upsertLog.length;
            const result = env.LoveArcadeEconomy.addCoins(300, 'Recompensa especial');
            assert.equal(result.success, true);
            await waitForTick();

            // Subida inmediata a Supabase
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1, 'addCoins debe disparar sincronización inmediata');
            const record = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            const remoteStore = JSON.parse(record.game_data.gamecenter_v6_promos);
            assert.equal(remoteStore.coins, 350, 'Saldo en la nube incrementado inmediatamente');
        });
    });

    describe('Operaciones de Bendición Lunar (extendMoonBlessingDays vs buyMoonBlessing)', () => {
        it('dado extendMoonBlessingDays, cuando se invoca, entonces extiende la expiración y sincroniza inmediatamente', async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 100,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });

            await env.login({ user: { id: 'user-mb-1', email: 'mb1@example.com' } });
            env.dispatchDomLoaded();

            const initialUpserts = env.fakeSupabase.upsertLog.length;
            const result = env.LoveArcadeMoonBlessing.extendMoonBlessingDays(5, 'Bono por evento');
            assert.equal(result.success, true);
            await waitForTick();

            // Subida inmediata a Supabase
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1, 'extendMoonBlessingDays debe disparar sincronización inmediata');
            const record = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            const remoteStore = JSON.parse(record.game_data.gamecenter_v6_promos);
            assert.ok(remoteStore.buffs.moonBlessingExpiry > 0, 'La caducidad de bendición lunar debe estar guardada en la nube');
        });

        it('dado buyMoonBlessing, cuando se compra, entonces muta estado local pero NO sincroniza inmediatamente (guarda sin flag)', async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 200,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });

            await env.login({ user: { id: 'user-mb-2', email: 'mb2@example.com' } });
            env.dispatchDomLoaded();

            const initialUpserts = env.fakeSupabase.upsertLog.length;
            const result = env.LoveArcadeMoonBlessing.buyMoonBlessing();
            assert.equal(result.success, true);
            await waitForTick();

            // Comportamiento actual del producto: guarda con Store.save() sin immediateCloudSync
            assert.equal(
                env.fakeSupabase.upsertLog.length,
                initialUpserts,
                'buyMoonBlessing no dispara sincronización inmediata (guarda sin immediateCloudSync)'
            );

            // Verificación: estado local sí se actualizó
            const localStore = env.LoveArcadeStore.getStore();
            assert.equal(localStore.coins, 100);
            assert.ok(localStore.buffs.moonBlessingExpiry > 0);

            // Se sincroniza diferidamente ante evento de ciclo de vida
            env.dispatchBeforeUnload();
            await waitForTick();
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1);
            const record = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            assert.equal(JSON.parse(record.game_data.gamecenter_v6_promos).coins, 100);
        });
    });

    describe('Operaciones de Canje de Códigos e Importación de Guardado', () => {
        it('dado redeemPromoCode, cuando se canjea código válido, entonces suma monedas localmente pero NO sincroniza inmediatamente', async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 50,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });

            await env.login({ user: { id: 'user-promo-1', email: 'promo1@example.com' } });
            env.dispatchDomLoaded();

            const initialUpserts = env.fakeSupabase.upsertLog.length;
            // Canje del código público VERSION9 (+200 monedas)
            const result = await env.LoveArcadePromoCodes.redeemPromoCode('VERSION9');
            assert.equal(result.success, true);
            assert.equal(result.reward, 200);
            await waitForTick();

            // Comportamiento actual: guarda con Store.save() sin immediateCloudSync
            assert.equal(
                env.fakeSupabase.upsertLog.length,
                initialUpserts,
                'redeemPromoCode no dispara sincronización inmediata (guarda sin immediateCloudSync)'
            );
            assert.equal(env.LoveArcadeStore.getStore().coins, 250);

            // Sincronización diferida ante beforeunload
            env.dispatchBeforeUnload();
            await waitForTick();
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1);
            const record = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            assert.equal(JSON.parse(record.game_data.gamecenter_v6_promos).coins, 250);
        });

        it('dado importSave en GameCenter, cuando se importa un código válido, entonces restaura estado local pero NO sincroniza inmediatamente', async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 100,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });

            await env.login({ user: { id: 'user-import-1', email: 'import1@example.com' } });
            env.dispatchDomLoaded();

            // Generar código de respaldo válido con exportSave
            const exportCode = await env.GameCenter.exportSave();
            assert.ok(typeof exportCode === 'string' && exportCode.length > 20);

            // Modificar saldo local antes de importar
            env.LoveArcadeStore.getStore().coins = 999;

            const initialUpserts = env.fakeSupabase.upsertLog.length;
            const result = await env.GameCenter.importSave(exportCode);
            assert.equal(result.success, true);
            await waitForTick();

            // Comportamiento actual: importSave ejecuta Store.save() sin immediateCloudSync
            assert.equal(
                env.fakeSupabase.upsertLog.length,
                initialUpserts,
                'importSave no dispara sincronización inmediata (guarda sin immediateCloudSync)'
            );
            assert.equal(env.LoveArcadeStore.getStore().coins, 100);

            // Sincronización diferida ante beforeunload
            env.dispatchBeforeUnload();
            await waitForTick();
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1);
            const record = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            assert.equal(JSON.parse(record.game_data.gamecenter_v6_promos).coins, 100);
        });
    });

    describe('Operaciones de Progreso de Minijuegos (completeLevel)', () => {
        it('dado completeLevel en GameCenter, cuando se completa nivel nuevo, entonces acredita recompensa y sincroniza inmediatamente', async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 100,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });

            await env.login({ user: { id: 'user-lvl-1', email: 'lvl1@example.com' } });
            env.dispatchDomLoaded();

            const initialUpserts = env.fakeSupabase.upsertLog.length;
            const result = env.GameCenter.completeLevel('maze', 'level-1', 50);
            assert.equal(result.paid, true);
            assert.equal(result.coins, 150);
            await waitForTick();

            // Subida inmediata a Supabase
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1, 'completeLevel debe disparar sincronización inmediata');
            const record = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            const remoteStore = JSON.parse(record.game_data.gamecenter_v6_promos);
            assert.equal(remoteStore.coins, 150);
            assert.deepEqual(remoteStore.progress.maze, ['level-1']);
        });
    });

    describe('Cola de reintento offline / pre-autenticación', () => {
        it('dado usuario sin sesión, cuando ocurre una acción con immediateCloudSync, entonces encola reintento y sube al iniciar sesión', {
            todo: 'BUG-F3a-02: _sentinelSync es abortado en _handleAuthChange / la:cloud-authenticated porque _isRestoringSession está activo'
        }, async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 50,
                        inventory: {},
                        buffs: { moonBlessingExpiry: 0 },
                        daily: { lastClaim: 0, streak: 0 },
                        progress: {},
                        history: [],
                        redeemedHashes: []
                    })
                }
            });
            env.dispatchDomLoaded();

            // 1. Sin sesión activa
            assert.equal(env.fakeSupabase.getCurrentSession(), null);

            // 2. Operación con sincronización inmediata mientras está desconectado
            env.LoveArcadeEconomy.addCoins(200, 'Premio offline');
            await waitForTick();
            assert.equal(env.fakeSupabase.upsertLog.length, 0, 'Sin sesión no puede subir a Supabase');

            // 3. Al iniciar sesión, la cola de reintento inmediata debería despachar el progreso a la nube
            await env.login({ user: { id: 'user-late-auth', email: 'late@example.com' } });
            await waitForTick();

            assert.ok(env.fakeSupabase.upsertLog.length >= 1, 'Debe procesar la sincronización pendiente al autenticarse');
            const lastRecord = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            const remoteStore = JSON.parse(lastRecord.game_data.gamecenter_v6_promos);
            assert.equal(remoteStore.coins, 250, 'El progreso acumulado offline debe haberse subido');
        });
    });
});
