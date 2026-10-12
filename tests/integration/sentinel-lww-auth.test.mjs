import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { setupSentinelSandbox } = require('../helpers/fake-supabase.cjs');

describe('QA (F3a): Sentinel - Last-Write-Wins al iniciar sesión (TKT-014)', () => {
    it('dado una nube más reciente, cuando se inicia sesión, entonces aplica el snapshot remoto, rehidrata el store en memoria y actualiza la marca de tiempo local', async () => {
        const localKey = 'gamecenter_v6_promos';
        const localStore = { coins: 100, daily: { currentStreak: 2 } };
        const cloudStore = { coins: 650, daily: { currentStreak: 5 } };
        const localTs = '2026-10-12T10:00:00.000Z';
        const cloudTs = '2026-10-12T12:00:00.000Z';

        const env = setupSentinelSandbox({
            initialStorage: {
                [localKey]: localStore,
                love_arcade_sentinel_ts: localTs,
                la_ws_completedLevels: '[1]'
            },
            initialProfiles: {
                'user-cloud-win': {
                    id: 'user-cloud-win',
                    updated_at: cloudTs,
                    game_data: {
                        [localKey]: JSON.stringify(cloudStore),
                        la_ws_completedLevels: '[1, 2, 3]',
                        LUMINA_bestScore: '2048'
                    }
                }
            }
        });

        let cloudSyncedFired = false;
        env.context.document.addEventListener('la:cloudsynced', (e) => {
            if (e.detail?.source === 'cloud') cloudSyncedFired = true;
        });

        await env.login({ user: { id: 'user-cloud-win', email: 'gamer1@example.com' } });

        // 1. LocalStorage actualizado con el snapshot de la nube
        const storedHub = JSON.parse(env.context.localStorage.getItem(localKey));
        assert.equal(storedHub.coins, 650);
        assert.equal(storedHub.daily?.currentStreak, 5);
        assert.equal(env.context.localStorage.getItem('la_ws_completedLevels'), '[1, 2, 3]');
        assert.equal(env.context.localStorage.getItem('LUMINA_bestScore'), '2048');

        // 2. Rehidratación del store en memoria
        const inMemoryStore = env.LoveArcadeStore.getStore();
        assert.equal(inMemoryStore.coins, 650);
        assert.equal(inMemoryStore.daily?.currentStreak, 5);

        // 3. Marca de tiempo local actualizada al timestamp de la nube
        assert.equal(env.context.localStorage.getItem(env.SENTINEL_TS_KEY), cloudTs);

        // 4. Evento de notificación emitido
        assert.equal(cloudSyncedFired, true);

        // 5. No se realizaron subidas a la nube porque la nube era más reciente
        assert.equal(env.fakeSupabase.upsertLog.length, 0);
    });

    it('dado un estado local más reciente que la nube, cuando se inicia sesión, entonces debería subir el snapshot local a la nube y conservar el estado local intacto', { todo: 'BUG-F3a-02: _sentinelSync es abortado en _handleAuthChange porque _isRestoringSession está activo' }, async () => {
        const localKey = 'gamecenter_v6_promos';
        const localStore = { coins: 400 };
        const cloudStore = { coins: 100 };
        const localTs = '2026-10-12T14:00:00.000Z';
        const cloudTs = '2026-10-12T11:00:00.000Z';

        const env = setupSentinelSandbox({
            initialStorage: {
                [localKey]: localStore,
                love_arcade_sentinel_ts: localTs,
                la_ws_completedLevels: '[1, 2, 3]'
            },
            initialProfiles: {
                'user-local-win': {
                    id: 'user-local-win',
                    updated_at: cloudTs,
                    game_data: {
                        [localKey]: JSON.stringify(cloudStore),
                        la_ws_completedLevels: '[]'
                    }
                }
            }
        });

        await env.login({ user: { id: 'user-local-win', email: 'gamer2@example.com' } });

        // Comportamiento deseado: se dispara upsert a Supabase con el snapshot local
        // En producción actual falla porque _sentinelSync comprueba _isRestoringSession y aborta.
        assert.equal(env.fakeSupabase.upsertLog.length, 1);
        const uploaded = env.fakeSupabase.upsertLog[0];
        assert.equal(uploaded.id, 'user-local-win');
        assert.equal(JSON.parse(uploaded.game_data[localKey]).coins, 400);
        assert.equal(uploaded.game_data.la_ws_completedLevels, '[1, 2, 3]');

        // Estado local conservado en memoria y en localStorage
        assert.equal(env.LoveArcadeStore.getStore().coins, 400);
        const currentLocal = JSON.parse(env.context.localStorage.getItem(localKey));
        assert.equal(currentLocal.coins, 400);
        assert.equal(env.context.localStorage.getItem('la_ws_completedLevels'), '[1, 2, 3]');

        // Marca de tiempo local actualizada al nuevo timestamp de subida
        const finalTs = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
        assert.ok(Date.parse(finalTs) >= Date.parse(localTs));
    });

    it('dado un empate de marcas de tiempo pero con snapshots divergentes, cuando se inicia sesión, entonces debería resolver a favor del estado local y subir a la nube', { todo: 'BUG-F3a-02: _sentinelSync es abortado en _handleAuthChange porque _isRestoringSession está activo' }, async () => {
        const localKey = 'gamecenter_v6_promos';
        const localStore = { coins: 250 };
        const cloudStore = { coins: 180 };
        const sameTs = '2026-10-12T12:00:00.000Z';

        const env = setupSentinelSandbox({
            initialStorage: {
                [localKey]: localStore,
                love_arcade_sentinel_ts: sameTs
            },
            initialProfiles: {
                'user-tie-diff': {
                    id: 'user-tie-diff',
                    updated_at: sameTs,
                    game_data: {
                        [localKey]: JSON.stringify(cloudStore)
                    }
                }
            }
        });

        await env.login({ user: { id: 'user-tie-diff', email: 'gamer3@example.com' } });

        // Comportamiento deseado: ante empate con diferencias (snapshotsDiffer === true), sube a la nube
        // En producción actual falla porque _sentinelSync aborta por _isRestoringSession.
        assert.equal(env.fakeSupabase.upsertLog.length, 1);
        const uploaded = env.fakeSupabase.upsertLog[0];
        assert.equal(JSON.parse(uploaded.game_data[localKey]).coins, 250);

        // El estado local permanece intacto (250 monedas)
        assert.equal(env.LoveArcadeStore.getStore().coins, 250);
        assert.equal(JSON.parse(env.context.localStorage.getItem(localKey)).coins, 250);
    });

    it('dado un empate de marcas de tiempo con snapshots idénticos, cuando se inicia sesión, entonces no realiza sincronizaciones redundantes', async () => {
        const localKey = 'gamecenter_v6_promos';
        const localStore = { coins: 300 };
        const sameTs = '2026-10-12T12:00:00.000Z';

        const env = setupSentinelSandbox({
            initialStorage: {
                [localKey]: localStore,
                love_arcade_sentinel_ts: sameTs
            },
            initialProfiles: {
                'user-tie-same': {
                    id: 'user-tie-same',
                    updated_at: sameTs,
                    game_data: {
                        [localKey]: JSON.stringify(localStore)
                    }
                }
            }
        });

        await env.login({ user: { id: 'user-tie-same', email: 'gamer4@example.com' } });

        // No hay subida ni descarga reactiva
        assert.equal(env.fakeSupabase.upsertLog.length, 0);
        assert.equal(env.LoveArcadeStore.getStore().coins, 300);
        assert.equal(env.context.localStorage.getItem(env.SENTINEL_TS_KEY), sameTs);
    });

    it('dado un usuario nuevo sin datos en la nube (nube vacía), cuando se inicia sesión, entonces debería subir el snapshot local inicial a la nube', { todo: 'BUG-F3a-02: _sentinelSync es abortado en _handleAuthChange porque _isRestoringSession está activo' }, async () => {
        const localKey = 'gamecenter_v6_promos';
        const localStore = { coins: 220 };

        const env = setupSentinelSandbox({
            initialStorage: {
                [localKey]: localStore,
                love_arcade_sentinel_ts: '2026-10-12T09:00:00.000Z'
            },
            initialProfiles: {}
        });

        await env.login({ user: { id: 'user-new', email: 'newbie@example.com' } });

        // Comportamiento deseado: sube a Supabase para inicializar el perfil en la nube
        // En producción actual falla porque _sentinelSync aborta por _isRestoringSession.
        assert.equal(env.fakeSupabase.upsertLog.length, 1);
        const uploaded = env.fakeSupabase.upsertLog[0];
        assert.equal(uploaded.id, 'user-new');
        assert.equal(JSON.parse(uploaded.game_data[localKey]).coins, 220);

        // Estado local no se altera
        assert.equal(env.LoveArcadeStore.getStore().coins, 220);
    });

    it('dado un snapshot de la nube más reciente con claves vigiladas ausentes, cuando se aplica, entonces actualiza las claves presentes pero conserva las claves locales ausentes (comportamiento observado)', async () => {
        const localKey = 'gamecenter_v6_promos';
        const cloudTs = '2026-10-12T13:00:00.000Z';
        const localTs = '2026-10-12T10:00:00.000Z';

        const env = setupSentinelSandbox({
            initialStorage: {
                [localKey]: { coins: 50 },
                MAREJIG_completedLevels_v1: '[1, 2]',
                love_arcade_sentinel_ts: localTs
            },
            initialProfiles: {
                'user-partial-cloud': {
                    id: 'user-partial-cloud',
                    updated_at: cloudTs,
                    // La nube solo contiene gamecenter_v6_promos; MAREJIG_completedLevels_v1 está ausente
                    game_data: {
                        [localKey]: JSON.stringify({ coins: 500 })
                    }
                }
            }
        });

        await env.login({ user: { id: 'user-partial-cloud', email: 'partial@example.com' } });

        // 1. Clave presente en nube se actualizó
        assert.equal(env.LoveArcadeStore.getStore().coins, 500);
        assert.equal(JSON.parse(env.context.localStorage.getItem(localKey)).coins, 500);

        // 2. Clave ausente en nube se conserva localmente (fusión selectiva no destructiva de _applySnapshot)
        assert.equal(env.context.localStorage.getItem('MAREJIG_completedLevels_v1'), '[1, 2]');
    });

    it('dado un fallo de red o error de Supabase al consultar el perfil durante el inicio de sesión, cuando ocurre, entonces no corrompe el estado local y marca estado de error', async () => {
        const localKey = 'gamecenter_v6_promos';
        const initialStore = { coins: 333 };

        const env = setupSentinelSandbox({
            initialStorage: {
                [localKey]: initialStore,
                love_arcade_sentinel_ts: '2026-10-12T10:00:00.000Z'
            }
        });

        // Simular error de red en Supabase select
        env.fakeSupabase.setSelectError(new Error('Network request failed'));

        await env.login({ user: { id: 'user-net-err', email: 'err@example.com' } });

        // 1. Estado local permanece intacto en memoria y en localStorage
        assert.equal(env.LoveArcadeStore.getStore().coins, 333);
        assert.equal(JSON.parse(env.context.localStorage.getItem(localKey)).coins, 333);

        // 2. No se intentó subir nada tras el error de lectura
        assert.equal(env.fakeSupabase.upsertLog.length, 0);

        // 3. UI refleja estado de error
        const textEl = env.context.document.getElementById('cloud-status-text');
        if (textEl) {
            assert.equal(textEl.textContent, 'Error');
        }
    });

    it('dado un desfase de reloj donde el estado local tiene mayor progreso pero menor timestamp que la nube, cuando se inicia sesión, entonces no debería sobreescribir destructivamente el progreso local (R7)', { todo: 'BUG-F3a-01: LWW basado únicamente en timestamp de cliente sobreescribe progreso local más avanzado ante relojes desfasados' }, async () => {
        const localKey = 'gamecenter_v6_promos';
        // El dispositivo A (en la nube) guardó con reloj adelantado a las 15:00 con 50 monedas
        const cloudTs = '2026-10-12T15:00:00.000Z';
        const cloudStore = { coins: 50 };

        // El dispositivo B jugó offline con reloj en 11:00 y avanzó hasta 1000 monedas
        const localTs = '2026-10-12T11:00:00.000Z';
        const localStore = { coins: 1000 };

        const env = setupSentinelSandbox({
            initialStorage: {
                [localKey]: localStore,
                love_arcade_sentinel_ts: localTs
            },
            initialProfiles: {
                'user-clock-skew': {
                    id: 'user-clock-skew',
                    updated_at: cloudTs,
                    game_data: {
                        [localKey]: JSON.stringify(cloudStore)
                    }
                }
            }
        });

        await env.login({ user: { id: 'user-clock-skew', email: 'skew@example.com' } });

        // Comportamiento DESEADO: El progreso local más avanzado (1000 monedas) no debe destruirse
        // silenciosamente por un timestamp desfasado.
        // En producción actual falla porque cloudTime (15:00) > localTime (11:00) y LWW aplica
        // el snapshot de 50 monedas sobreescribiendo el progreso. Por eso se marca como todo.
        assert.equal(env.LoveArcadeStore.getStore().coins, 1000, 'El progreso más avanzado debe conservarse ante desfase de reloj (R7)');
    });
});
