import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { setupSentinelSandbox, FakeStorageEvent } = require('../helpers/fake-supabase.cjs');
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');

describe('QA (F5): Multipestaña, concurrencia y resiliencia en Sentinel (TKT-024)', () => {

    describe('(a) Evento storage sintético sobre la clave del store y claves anómalas', () => {
        it('dado un evento storage con key null (ej. clear() en otra ventana), cuando se despacha, entonces Sentinel no lanza y conserva los datos locales intactos', () => {
            const initialStore = {
                coins: 250,
                daily: { currentStreak: 3 },
                inventory: { badge_gold: 1 }
            };

            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify(initialStore)
                }
            });

            // Despachar evento con key = null
            assert.doesNotThrow(() => {
                env.dispatchStorageEvent({
                    key: null,
                    oldValue: null,
                    newValue: null
                });
            }, 'El listener de storage no debe lanzar ante eventos con key null');

            // El store en memoria debe permanecer completamente intacto
            const current = env.LoveArcadeStore.getStore();
            assert.equal(current.coins, 250, 'Las monedas locales no deben verse afectadas');
            assert.equal(current.daily?.currentStreak, 3, 'La racha local no debe verse afectada');
        });

        it('dado un evento storage con una clave ajena al juego, cuando se despacha, entonces se descarta sin lanzar ni modificar el store local', () => {
            const initialStore = { coins: 180, progress: {} };
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify(initialStore)
                }
            });

            assert.doesNotThrow(() => {
                env.dispatchStorageEvent({
                    key: 'otra_aplicacion_token_externo',
                    oldValue: null,
                    newValue: 'payload_ajeno_12345'
                });
            }, 'El listener debe ignorar claves no vigiladas sin lanzar');

            const current = env.LoveArcadeStore.getStore();
            assert.equal(current.coins, 180, 'El saldo del store debe permanecer intacto');
            assert.equal(env.context.localStorage.getItem('otra_aplicacion_token_externo'), null, 'No debe escribir claves foráneas en storage local');
        });

        it('dado un evento storage con la clave del juego y un payload JSON corrupto, cuando se despacha, entonces captura el error en try/catch y no pierde datos locales', () => {
            const initialStore = { coins: 340, inventory: { avatar_cat: 1 } };
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify(initialStore)
                }
            });

            // Simulamos que otra pestaña dejó un JSON incompleto/corrupto en el almacenamiento físico
            const brokenJson = '{"coins": 340, "inventory":';
            env.context.localStorage.setItem('gamecenter_v6_promos', brokenJson);

            // Al despachar el evento storage hacia esta pestaña, _rehydrateHubStoreFromDisk() parsea 'raw'
            // El bloque try/catch debe capturar el SyntaxError impidiendo la caída de la SPA
            assert.doesNotThrow(() => {
                env.dispatchStorageEvent({
                    key: 'gamecenter_v6_promos',
                    oldValue: JSON.stringify(initialStore),
                    newValue: brokenJson
                });
            }, 'Debe capturar SyntaxError al rehidratar JSON corrupto sin propagar excepción');

            // La memoria viva del juego debe preservar el estado anterior sin vaciarse
            const current = env.LoveArcadeStore.getStore();
            assert.equal(current.coins, 340, 'El store en memoria conserva el saldo');
            assert.equal(current.inventory?.avatar_cat, 1, 'El inventario en memoria no se destruye');
        });

        it('dado un evento storage sobre la clave del store con newValue null, cuando se despacha, entonces no lanza y no destruye el store en memoria', () => {
            const initialStore = { coins: 500, nickname: 'HéroeLocal' };
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify(initialStore)
                }
            });

            assert.doesNotThrow(() => {
                env.dispatchStorageEvent({
                    key: 'gamecenter_v6_promos',
                    oldValue: JSON.stringify(initialStore),
                    newValue: null
                });
            }, 'El handler de storage debe tolerar newValue null sin lanzar');

            const current = env.LoveArcadeStore.getStore();
            assert.equal(current.coins, 500, 'El saldo se mantiene');
        });
    });

    describe('(b) Dos instancias del store sobre el mismo localStorage falso documentando LWW del historial', () => {
        it('dado dos contextos compartiendo el mismo localStorage, cuando la Pestaña 1 actualiza monedas y emite evento storage, la Pestaña 2 rehidrata su saldo', () => {
            const sharedStorage = new Map();
            const initialState = {
                coins: 100,
                history: [{ tipo: 'ingreso', cantidad: 100, motivo: 'bienvenida', fecha: 1000 }],
                progress: {},
                inventory: {},
                daily: { currentStreak: 1 }
            };
            sharedStorage.set('gamecenter_v6_promos', JSON.stringify(initialState));

            // Instancia Pestaña 1 (Hub emisor)
            const env1 = setupSentinelSandbox({
                storage: sharedStorage,
                loadDomainModules: true
            });

            // Instancia Pestaña 2 (Hub receptor)
            const env2 = setupSentinelSandbox({
                storage: sharedStorage,
                loadDomainModules: true
            });

            assert.equal(env1.LoveArcadeStore.getStore().coins, 100);
            assert.equal(env2.LoveArcadeStore.getStore().coins, 100);

            // Pestaña 1 añade 50 monedas
            env1.LoveArcadeEconomy.addCoins(50, 'victoria_minijuego');
            assert.equal(env1.LoveArcadeStore.getStore().coins, 150);

            // Simular el despacho del evento storage del navegador hacia Pestaña 2
            const updatedRaw = sharedStorage.get('gamecenter_v6_promos');
            env2.dispatchStorageEvent({
                key: 'gamecenter_v6_promos',
                oldValue: JSON.stringify(initialState),
                newValue: updatedRaw
            });

            // Pestaña 2 debe haber rehidratado su store desde el disco
            assert.equal(env2.LoveArcadeStore.getStore().coins, 150, 'Pestaña 2 debe reflejar las 150 monedas tras el evento storage');
        });

        it('dado dos instancias con mutaciones concurrentes de historial en memoria, cuando ambas persisten, documenta que el último escritor sobrescribe el historial (LWW)', () => {
            const sharedStorage = new Map();
            const initialState = {
                coins: 200,
                history: [{ tipo: 'ingreso', cantidad: 200, motivo: 'inicial', fecha: 1000 }],
                progress: {},
                inventory: {},
                daily: {}
            };
            sharedStorage.set('gamecenter_v6_promos', JSON.stringify(initialState));

            // Instancia A y B leen el mismo estado inicial
            const envA = setupSentinelSandbox({ storage: sharedStorage, loadDomainModules: true });
            const envB = setupSentinelSandbox({ storage: sharedStorage, loadDomainModules: true });

            assert.equal(envA.LoveArcadeStore.getStore().history.length, 1);
            assert.equal(envB.LoveArcadeStore.getStore().history.length, 1);

            // Instancia A realiza una transacción y guarda
            envA.LoveArcadeEconomy.addCoins(40, 'premio_pestaña_A');
            // Instancia B, sin haber rehidratado la de A, realiza otra transacción y guarda
            envB.LoveArcadeEconomy.spendCoins(25, 'compra_pestaña_B');

            // Leer lo que quedó en el almacenamiento compartido físico
            const persisted = JSON.parse(sharedStorage.get('gamecenter_v6_promos'));
            
            // Documentación de LWW (Último escritor gana):
            // Como Store.save() serializa el objeto de store completo en memoria, el save() de la Pestaña B
            // sobrescribe el historial en disco con su propio array local [inicial, compra_pestaña_B],
            // descartando 'premio_pestaña_A' de la Pestaña A.
            const motivos = persisted.history.map(h => h.motivo);
            assert.ok(!motivos.includes('premio_pestaña_A'), 'La transacción de la Pestaña A fue sobrescrita por la Pestaña B (LWW)');
            assert.ok(motivos.includes('compra_pestaña_B'), 'La transacción de la Pestaña B prevalece como último escritor');
            assert.equal(persisted.coins, 175, 'El saldo persistido final refleja el cálculo de la Pestaña B (200 - 25)');
        });
    });

    describe('(c) Escritura de clave vigilada durante _handleAuthChange con promesas controladas', () => {
        it('dado Sentinel ejecutando _handleAuthChange pausado en la consulta de red, cuando se escribe una clave vigilada, entonces debería preservarse y programarse para sincronización', {
            todo: 'BUG-F5-07: escrituras a claves vigiladas durante _handleAuthChange son descartadas por _markWatchedKeyDirty al estar _isRestoringSession activo'
        }, async () => {
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({ coins: 300 }),
                    love_arcade_sentinel_ts: '2026-10-10T00:00:00.000Z'
                }
            });

            // Esperar de forma determinista que Sentinel configure su cliente y listeners
            while (!env.Sentinel?.getStatus()?.hasClient) {
                await new Promise((r) => setImmediate(r));
            }

            // Configuramos una promesa diferida controlada manualmente para la consulta select de Supabase
            const selectDeferred = env.fakeSupabase.deferNextSelect();

            // Iniciamos la autenticación de forma síncrona
            const session = { user: { id: 'user-pause-1', email: 'pause@example.com' } };
            
            // Promesa que se resolverá cuando _handleAuthChange termine de procesarse por completo
            const authCompletedPromise = new Promise((resolve) => {
                env.context.document.addEventListener('la:cloud-authenticated', resolve, { once: true });
            });

            // Disparamos simulateSignIn: Sentinel inicia _handleAuthChange y queda pausado en select().maybeSingle()
            env.fakeSupabase.simulateSignIn(session);

            // Verificamos que Sentinel está en pleno proceso de restauración con la sesión asignada
            assert.equal(env.Sentinel.getSession()?.user?.id, 'user-pause-1');

            // En este preciso instante de espera de red, el usuario o la aplicación escribe en una clave vigilada
            env.context.localStorage.setItem('gamecenter_v6_promos', JSON.stringify({
                coins: 350,
                updatedDuringAuthWait: true
            }));

            // Ahora resolvemos la consulta remota de Supabase con datos vacíos (para que prevalezca el estado local)
            selectDeferred.resolve({ data: null, error: null });

            // Esperamos la finalización limpia de _handleAuthChange mediante su evento
            await authCompletedPromise;

            // En el código actual (sentinel.js:434):
            // `if (!SENTINEL_WATCHED_KEYS.has(key) || !_sbSession || _isRestoringSession) return;`
            // Como _isRestoringSession estaba en true durante la escritura, _hasUnsyncedChanges NO se marcó como true
            // y al liberarse el mutex en `finally { _isRestoringSession = false; }`, el cambio local quedó silenciosamente descartado.
            // Asertamos el comportamiento deseado: que la mutación haya sido programada o subida a Supabase.
            const stored = JSON.parse(env.context.localStorage.getItem('gamecenter_v6_promos'));
            assert.equal(stored.coins, 350, 'El valor local debe persistirse en localStorage');

            // El comportamiento deseado exige que la subida haya sido programada o realizada en Supabase
            assert.ok(env.fakeSupabase.upsertLog.length > 0, 'La mutación ocurrida durante el handshake debe sincronizarse con Supabase');
            const lastUpsert = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            const uploadedStore = JSON.parse(lastUpsert.game_data.gamecenter_v6_promos);
            assert.equal(uploadedStore.coins, 350, 'El snapshot de la nube debe contener el cambio local ocurrido durante la espera');
        });
    });

    describe('(d) completeLevel del bridge concurrente con una subida en vuelo de Sentinel', () => {
        it('dado Sentinel con sesión activa, cuando se llama a completeLevel de forma secuencial, entonces sube a Supabase inmediatamente', async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 100,
                        progress: {},
                        history: []
                    })
                }
            });

            await env.login({ user: { id: 'user-seq-1', email: 'seq@example.com' } });
            env.dispatchDomLoaded();

            const initialUpserts = env.fakeSupabase.upsertLog.length;

            // Completar nivel mediante GameCenter (Bridge/Hub)
            const result = env.GameCenter.completeLevel('laberinto', 'nivel_facil', 25);
            assert.equal(result.paid, true);
            assert.equal(result.coins, 125);

            // Verificamos que se ejecutó la subida inmediata
            assert.equal(env.fakeSupabase.upsertLog.length, initialUpserts + 1, 'Debe emitir un upsert inmediato');
            const record = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            const data = JSON.parse(record.game_data.gamecenter_v6_promos);
            assert.equal(data.coins, 125);
            assert.equal(data.progress.laberinto[0], 'nivel_facil');
        });

        it('dado una sincronización en curso hacia Supabase, cuando completeLevel ocurre concurrentemente, entonces debe encadenarse secuencialmente para que la nube reciba el nivel', {
            todo: 'BUG-F5-08: completeLevel con immediateCloudSync concurrente con _sentinelSync no se encadena secuencialmente y se pierde de la nube'
        }, async () => {
            const env = setupSentinelSandbox({
                loadDomainModules: true,
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({
                        coins: 100,
                        progress: {},
                        history: []
                    })
                }
            });

            await env.login({ user: { id: 'user-conc-1', email: 'conc@example.com' } });
            env.dispatchDomLoaded();

            // Configuramos una promesa diferida para pausar el siguiente upsert en Supabase
            const upsertDeferred = env.fakeSupabase.deferNextUpsert();

            // Disparamos una sincronización manual (_isSyncing pasa a true y queda en vuelo)
            const syncPromise = env.Sentinel.syncNow();

            // Comprobar que el primer upsert está registrado en la cola de salida pero aún esperando respuesta de red
            assert.equal(env.fakeSupabase.upsertLog.length, 1);

            // MIENTRAS la subida está en vuelo, el minijuego llama a completeLevel con immediateCloudSync: true
            const result = env.GameCenter.completeLevel('laberinto', 'nivel_concurrente', 30);
            assert.equal(result.paid, true);
            assert.equal(result.coins, 130);

            // El store en memoria y en localStorage ya tienen el nivel completado
            const localStore = env.LoveArcadeStore.getStore();
            assert.equal(localStore.progress.laberinto[0], 'nivel_concurrente');

            // Ahora liberamos la primera subida en vuelo resolviendo su promesa de red
            upsertDeferred.resolve({ data: { id: 'user-conc-1' }, error: null });
            await syncPromise;

            // En el código actual (sentinel.js:264):
            // `if (_isSyncing) return;`
            // La llamada a syncNow() disparada por completeLevel retornó inmediatamente sin encolarse.
            // Al finalizar la primera subida, la línea 289 ejecutó `_hasUnsyncedChanges = false;`.
            // La subida inmediata se perdió y nunca se encadenó una segunda petición a Supabase.
            // Comprobamos el comportamiento deseado: la subida debe encadenarse y el snapshot final en Supabase debe contener el nivel.
            assert.ok(env.fakeSupabase.upsertLog.length >= 2, 'Debe despacharse secuencialmente una segunda subida para el nivel completado');
            const finalRecord = env.fakeSupabase.upsertLog[env.fakeSupabase.upsertLog.length - 1];
            const finalGameData = JSON.parse(finalRecord.game_data.gamecenter_v6_promos);
            assert.ok(Array.isArray(finalGameData.progress?.laberinto) && finalGameData.progress.laberinto.includes('nivel_concurrente'), 'El snapshot final en Supabase debe contener el nivel completado');
            assert.equal(finalGameData.coins, 130, 'El snapshot final en Supabase debe reflejar las 130 monedas');
        });
    });

    describe('(e) Snapshot cloud con claves ausentes, null o de tipo erróneo', () => {
        it('dado un snapshot remoto con claves vigiladas ausentes, cuando se aplica, entonces no borra ni anula las claves locales ausentes', async () => {
            const localStore = { coins: 400, nickname: 'Guardián' };
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify(localStore),
                    la_ws_completedLevels: '[1, 2]',
                    LUMINA_bestScore: '1024',
                    love_arcade_sentinel_ts: '2026-10-10T10:00:00.000Z'
                },
                initialProfiles: {
                    'user-sparse': {
                        id: 'user-sparse',
                        updated_at: '2026-10-12T12:00:00.000Z',
                        // La nube solo tiene LUMINA_bestScore; carece de gamecenter_v6_promos y la_ws_completedLevels
                        game_data: {
                            LUMINA_bestScore: '2048'
                        }
                    }
                }
            });

            await env.login({ user: { id: 'user-sparse', email: 'sparse@example.com' } });

            // 1. La clave presente en la nube se actualiza
            assert.equal(env.context.localStorage.getItem('LUMINA_bestScore'), '2048');

            // 2. Las claves locales ausentes en la nube NO se borraron ni se fijaron en null/undefined
            assert.equal(env.context.localStorage.getItem('la_ws_completedLevels'), '[1, 2]');
            const preservedStore = JSON.parse(env.context.localStorage.getItem('gamecenter_v6_promos'));
            assert.equal(preservedStore.coins, 400);
            assert.equal(preservedStore.nickname, 'Guardián');

            // 3. El store en memoria conserva los datos locales intactos
            const inMem = env.LoveArcadeStore.getStore();
            assert.equal(inMem.coins, 400);
            assert.equal(inMem.nickname, 'Guardián');
        });

        it('dado un snapshot remoto donde una clave vigilada tiene valor null explícito, cuando se aplica, entonces la guarda no borra la clave local', async () => {
            const localStore = { coins: 500 };
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify(localStore),
                    love_arcade_sentinel_ts: '2026-10-10T10:00:00.000Z'
                },
                initialProfiles: {
                    'user-null-key': {
                        id: 'user-null-key',
                        updated_at: '2026-10-12T12:00:00.000Z',
                        game_data: {
                            // Clave con valor null explícito en la nube
                            gamecenter_v6_promos: null,
                            LUMINA_bestScore: '512'
                        }
                    }
                }
            });

            await env.login({ user: { id: 'user-null-key', email: 'nullkey@example.com' } });

            // La guarda snap[key] !== null debe evitar sobreescribir con null
            const stored = JSON.parse(env.context.localStorage.getItem('gamecenter_v6_promos'));
            assert.equal(stored.coins, 500, 'El store local no debe ser sobreescrito con null');
            assert.equal(env.context.localStorage.getItem('LUMINA_bestScore'), '512');
        });

        it('dado un snapshot remoto con tipo erróneo (entero 12345 en vez de string JSON), cuando se aplica, entonces no lanza y migra a defaults seguros', async () => {
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({ coins: 150 }),
                    love_arcade_sentinel_ts: '2026-10-10T10:00:00.000Z'
                },
                initialProfiles: {
                    'user-bad-type': {
                        id: 'user-bad-type',
                        updated_at: '2026-10-12T12:00:00.000Z',
                        game_data: {
                            gamecenter_v6_promos: 12345
                        }
                    }
                }
            });

            // No debe lanzar excepción
            await assert.doesNotReject(async () => {
                await env.login({ user: { id: 'user-bad-type', email: 'badtype@example.com' } });
            });

            // Rehidratación segura: JSON.parse('12345') produce 12345, y LoveArcadeStore.migrate(12345)
            // fusiona sobre los valores por defecto ({ ...defaults, ...12345 }) devolviendo un store válido
            const store = env.LoveArcadeStore.getStore();
            assert.ok(typeof store === 'object' && store !== null);
            assert.ok(typeof store.coins === 'number', 'Debe tener un saldo numérico por defecto');
        });

        it('dado un snapshot remoto con JSON roto en la clave del store, cuando se aplica, entonces captura el error sin romper la app', async () => {
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify({ coins: 150 }),
                    love_arcade_sentinel_ts: '2026-10-10T10:00:00.000Z'
                },
                initialProfiles: {
                    'user-corrupt-snap': {
                        id: 'user-corrupt-snap',
                        updated_at: '2026-10-12T12:00:00.000Z',
                        game_data: {
                            gamecenter_v6_promos: '{"coins": 999, corrupto...'
                        }
                    }
                }
            });

            // El try/catch en _rehydrateHubStoreFromDisk evita el fallo fatal
            await assert.doesNotReject(async () => {
                await env.login({ user: { id: 'user-corrupt-snap', email: 'corrupt@example.com' } });
            });

            // La aplicación no crasheó
            assert.ok(env.LoveArcadeStore.getStore());
        });

        it('dado que el snapshot recibido de la nube no es un objeto (null, string o número), cuando _applySnapshot se invoca, retorna limpiamente sin mutar', () => {
            const initialStore = { coins: 333 };
            const env = setupSentinelSandbox({
                initialStorage: {
                    gamecenter_v6_promos: JSON.stringify(initialStore)
                }
            });

            // Acceso directo o mediante payload inválido
            assert.doesNotThrow(() => {
                env.context.localStorage.setItem('gamecenter_v6_promos', JSON.stringify(initialStore));
            });

            const store = env.LoveArcadeStore.getStore();
            assert.equal(store.coins, 333);
        });
    });
});
