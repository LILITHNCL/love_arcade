import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { setupSentinelSandbox } = require('../helpers/fake-supabase.cjs');

describe('QA (F3a): Sentinel - Interceptor de localStorage (TKT-013)', () => {
    it('dado una sesión activa, cuando se escribe una clave vigilada, entonces marca dirty y actualiza el timestamp en localStorage', async () => {
        const env = setupSentinelSandbox();
        await env.login({ user: { id: 'user-001', email: 'gamer@example.com' } });
        env.dispatchDomLoaded();

        const watchedKey = 'gamecenter_v6_promos';
        const payload = JSON.stringify({ coins: 350 });

        env.context.localStorage.setItem(watchedKey, payload);

        // 1. Valor persistido
        assert.equal(env.storage.get(watchedKey), payload);
        assert.equal(env.context.localStorage.getItem(watchedKey), payload);

        // 2. Timestamp de Sentinel actualizado con ISO string válido
        const ts = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
        assert.ok(ts, 'Debe registrar la marca de tiempo de sincronización en Sentinel');
        const parsedTime = Date.parse(ts);
        assert.ok(!Number.isNaN(parsedTime), 'La marca de tiempo debe ser una fecha ISO válida');

        // 3. Marca dirty: al disparar beforeunload se dispara sincronización hacia la nube
        assert.equal(env.fakeSupabase.upsertLog.length, 0);
        env.dispatchBeforeUnload();

        // Esperar ciclo asíncrono de upsert
        await new Promise((resolve) => setTimeout(resolve, 30));

        assert.equal(env.fakeSupabase.upsertLog.length, 1);
        const record = env.fakeSupabase.upsertLog[0];
        assert.equal(record.id, 'user-001');
        assert.equal(record.game_data[watchedKey], payload);
    });

    it('dado una sesión activa, cuando se escribe una clave no vigilada, entonces persiste el valor pero NO actualiza timestamp ni marca dirty', async () => {
        const env = setupSentinelSandbox();
        await env.login({ user: { id: 'user-002', email: 'test@example.com' } });
        env.dispatchDomLoaded();

        const initialTs = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
        const unwatchedKey = 'unwatched_local_preference';
        const val = 'high_contrast';

        env.context.localStorage.setItem(unwatchedKey, val);

        // 1. Valor persistido localmente
        assert.equal(env.storage.get(unwatchedKey), val);
        assert.equal(env.context.localStorage.getItem(unwatchedKey), val);

        // 2. Timestamp no alterado
        assert.equal(env.context.localStorage.getItem(env.SENTINEL_TS_KEY), initialTs);

        // 3. No dirty: beforeunload no dispara upsert
        env.dispatchBeforeUnload();
        await new Promise((resolve) => setTimeout(resolve, 30));
        assert.equal(env.fakeSupabase.upsertLog.length, 0);
    });

    it('dado una sesión activa, cuando se ejecuta removeItem de una clave vigilada, entonces la elimina, marca dirty y actualiza el timestamp', async () => {
        const env = setupSentinelSandbox();
        await env.login({ user: { id: 'user-003', email: 'jigsaw@example.com' } });
        env.dispatchDomLoaded();

        const watchedKey = 'MAREJIG_activeSave_v1';
        env.context.localStorage.setItem(watchedKey, JSON.stringify({ puzzleId: 'p1', placed: [1, 2] }));
        const tsAfterSet = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
        assert.ok(tsAfterSet);

        // Sincronizar para limpiar dirty flag
        env.dispatchBeforeUnload();
        await new Promise((resolve) => setTimeout(resolve, 30));
        assert.equal(env.fakeSupabase.upsertLog.length, 1);

        // Pequeña espera para asegurar timestamp monotónico
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Eliminar clave vigilada
        env.context.localStorage.removeItem(watchedKey);

        // 1. Eliminada de almacenamiento local
        assert.equal(env.storage.get(watchedKey), undefined);
        assert.equal(env.context.localStorage.getItem(watchedKey), null);

        // 2. Timestamp actualizado tras el borrado
        const tsAfterRemove = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
        assert.ok(tsAfterRemove);
        assert.ok(Date.parse(tsAfterRemove) >= Date.parse(tsAfterSet));

        // 3. Marca dirty: nuevo beforeunload sube snapshot sin la clave
        env.dispatchBeforeUnload();
        await new Promise((resolve) => setTimeout(resolve, 30));
        assert.equal(env.fakeSupabase.upsertLog.length, 2);

        const latestRecord = env.fakeSupabase.upsertLog[1];
        assert.equal(Object.prototype.hasOwnProperty.call(latestRecord.game_data, watchedKey), false);
    });

    it('dado una sesión activa, cuando se ejecuta removeItem de una clave no vigilada, entonces NO actualiza timestamp ni marca dirty', async () => {
        const env = setupSentinelSandbox();
        await env.login({ user: { id: 'user-004', email: 'cleaner@example.com' } });
        env.dispatchDomLoaded();

        const unwatchedKey = 'temp_search_query';
        env.context.localStorage.setItem(unwatchedKey, 'space arcade');
        const tsBeforeRemove = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);

        env.context.localStorage.removeItem(unwatchedKey);

        assert.equal(env.storage.get(unwatchedKey), undefined);
        assert.equal(env.context.localStorage.getItem(unwatchedKey), null);
        assert.equal(env.context.localStorage.getItem(env.SENTINEL_TS_KEY), tsBeforeRemove);

        env.dispatchBeforeUnload();
        await new Promise((resolve) => setTimeout(resolve, 30));
        assert.equal(env.fakeSupabase.upsertLog.length, 0);
    });

    it('dado un usuario invitado (sin sesión activa), cuando escribe o borra claves vigiladas, entonces NO actualiza timestamp ni programa sincronización', async () => {
        const env = setupSentinelSandbox();
        // Sin login
        env.dispatchDomLoaded();

        const watchedKey = 'la_ws_completedLevels';
        env.context.localStorage.setItem(watchedKey, JSON.stringify([1, 2, 3]));

        // Valor guardado en storage local
        assert.equal(env.context.localStorage.getItem(watchedKey), JSON.stringify([1, 2, 3]));

        // Pero sin sesión activa: timestamp no se crea
        assert.equal(env.context.localStorage.getItem(env.SENTINEL_TS_KEY), null);
        assert.equal(env.storage.get(env.SENTINEL_TS_KEY), undefined);

        // beforeunload no dispara upsert
        env.dispatchBeforeUnload();
        await new Promise((resolve) => setTimeout(resolve, 30));
        assert.equal(env.fakeSupabase.upsertLog.length, 0);

        // removeItem tampoco actualiza timestamp
        env.context.localStorage.removeItem(watchedKey);
        assert.equal(env.context.localStorage.getItem(watchedKey), null);
        assert.equal(env.context.localStorage.getItem(env.SENTINEL_TS_KEY), null);
    });

    it('dado el interceptor instalado, cuando se usan setItem, getItem, removeItem y clear, entonces preservan el contrato estándar de Web Storage sin recursión', async () => {
        const env = setupSentinelSandbox();
        await env.login({ user: { id: 'user-005', email: 'storage@example.com' } });

        // Coerción a string conforme a la especificación Storage
        env.context.localStorage.setItem('LUMINA_bestScore', 2048);
        assert.strictEqual(env.context.localStorage.getItem('LUMINA_bestScore'), '2048');

        // Claves inexistentes devuelven null
        assert.strictEqual(env.context.localStorage.getItem('clave_inexistente'), null);

        // Escribir SENTINEL_TS_KEY no debe entrar en bucle de recursión infinita
        assert.doesNotThrow(() => {
            env.context.localStorage.setItem('gamecenter_v6_promos', '{"coins":50}');
        });

        // clear() limpia las claves
        env.context.localStorage.clear();
        assert.strictEqual(env.context.localStorage.getItem('LUMINA_bestScore'), null);
        assert.strictEqual(env.context.localStorage.getItem('gamecenter_v6_promos'), null);
    });

    it('dado un lote secuencial de escrituras y borrados en claves vigiladas y no vigiladas, entonces cada clave conserva su valor y el timestamp se actualiza coherentemente', async () => {
        const env = setupSentinelSandbox();
        await env.login({ user: { id: 'user-006', email: 'batch@example.com' } });
        env.dispatchDomLoaded();

        const watched1 = 'la_shooter_highscore';
        const watched2 = 'puz_arcade_progress';
        const unwatched = 'session_transient_tab_id';

        env.context.localStorage.setItem(watched1, '9500');
        const ts1 = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
        assert.ok(ts1);

        env.context.localStorage.setItem(unwatched, 'tab-abc');
        const ts2 = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
        assert.equal(ts1, ts2, 'Escribir clave no vigilada no debe alterar el timestamp existente');

        await new Promise((resolve) => setTimeout(resolve, 10));
        env.context.localStorage.setItem(watched2, '{"solved":8}');
        const ts3 = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
        assert.ok(Date.parse(ts3) >= Date.parse(ts2));

        env.context.localStorage.removeItem(watched1);
        const ts4 = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
        assert.ok(Date.parse(ts4) >= Date.parse(ts3));

        // Verificación de persistencia final
        assert.strictEqual(env.context.localStorage.getItem(watched1), null);
        assert.strictEqual(env.context.localStorage.getItem(watched2), '{"solved":8}');
        assert.strictEqual(env.context.localStorage.getItem(unwatched), 'tab-abc');
    });

    it('dado un fallo de cuota (QuotaExceededError) en setItem, cuando se invoca, entonces propaga el error al llamador sin romper el interceptor ni actualizar el timestamp indebidamente', async () => {
        const env = setupSentinelSandbox();
        await env.login({ user: { id: 'user-007', email: 'quota@example.com' } });

        env.sandbox.setQuotaExceeded(true);

        assert.throws(() => {
            env.context.localStorage.setItem('gamecenter_v6_promos', '{"huge":true}');
        }, (err) => {
            return err && err.name === 'QuotaExceededError';
        });

        // Como el guardado falló, no debe haber guardado el valor ni generado un timestamp erróneo
        assert.equal(env.storage.get('gamecenter_v6_promos'), undefined);
        assert.equal(env.context.localStorage.getItem(env.SENTINEL_TS_KEY), null);
        assert.equal(env.storage.get(env.SENTINEL_TS_KEY), undefined);

        // Al restablecer la cuota, el interceptor sigue funcionando normalmente
        env.sandbox.setQuotaExceeded(false);

        assert.doesNotThrow(() => {
            env.context.localStorage.setItem('gamecenter_v6_promos', '{"recovered":true}');
        });

        assert.equal(env.context.localStorage.getItem('gamecenter_v6_promos'), '{"recovered":true}');
        assert.ok(env.context.localStorage.getItem(env.SENTINEL_TS_KEY));
    });
});
