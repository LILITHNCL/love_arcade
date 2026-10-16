import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createSandbox, loadFiles } = require('../helpers/vm-sandbox.cjs');
const { setupSentinelSandbox } = require('../helpers/fake-supabase.cjs');

const CORE_FILES = [
    'js/core/config.js',
    'js/core/state-store.js',
    'js/core/time-sync.js',
    'js/domain/history.js',
    'js/domain/moon-blessing.js',
    'js/domain/daily-streak.js'
];

describe('TKT-025: Saltos de reloj transversales, fronteras horarias y caducidad de caché', () => {
    let context, storage, setMockNow;
    let Store, Daily, Moon, Time;
    const DAY = 86_400_000;

    beforeEach(() => {
        const sandbox = createSandbox();
        context = sandbox.context;
        storage = sandbox.storage;
        setMockNow = sandbox.setMockNow;

        loadFiles(context, CORE_FILES);

        Store = context.window.LoveArcadeStore;
        Daily = context.window.LoveArcadeDailyStreak;
        Moon = context.window.LoveArcadeMoonBlessing;
        Time = context.window.LoveArcadeTime;
    });

    function setTime(timestamp, { drift = 0, desynced = false, capturedAt = timestamp } = {}) {
        setMockNow(timestamp);
        storage.set('love_arcade_time_cache', JSON.stringify({ drift, desynced, capturedAt }));
    }

    function resetStore({ coins = 0, lastClaim = 0, streak = 0, moonExpiry = 0 } = {}) {
        Store.replaceStore(Store.migrate({
            coins,
            daily: { lastClaim, streak },
            buffs: { moonBlessingExpiry: moonExpiry },
            history: []
        }));
    }

    describe('1. Saltos de reloj hacia atrás y hacia adelante en claimDaily y repairDailyStreak', () => {
        test('dado un último reclamo previo, cuando el reloj del sistema salta hacia atrás más de un día (now < lastClaim), entonces claimDaily rechaza por inconsistencia horaria y no muta saldo ni racha', () => {
            const lastClaim = Date.UTC(2026, 5, 15, 12, 0, 0);
            const jumpedPast = Date.UTC(2026, 5, 12, 12, 0, 0); // Salto de 3 días al pasado
            setTime(jumpedPast);
            resetStore({ coins: 150, lastClaim, streak: 5 });

            const result = Daily.claimDaily();

            assert.equal(result.success, false);
            assert.equal(result.message, 'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.');
            assert.equal(Store.getStore().coins, 150);
            assert.equal(Store.getStore().daily.streak, 5);
            assert.equal(Store.getStore().daily.lastClaim, lastClaim);
            assert.equal(Store.getStore().history.length, 0);
        });

        test('dado un último reclamo previo, cuando el reloj del sistema salta hacia atrás más de un día (now < lastClaim), entonces repairDailyStreak rechaza por inconsistencia horaria y no descuenta monedas', () => {
            const lastClaim = Date.UTC(2026, 5, 15, 12, 0, 0);
            const jumpedPast = Date.UTC(2026, 5, 10, 12, 0, 0); // Salto de 5 días al pasado
            setTime(jumpedPast);
            resetStore({ coins: 600, lastClaim, streak: 5 });

            const result = Daily.repairDailyStreak();

            assert.equal(result.success, false);
            assert.equal(result.message, 'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.');
            assert.equal(Store.getStore().coins, 600);
            assert.equal(Store.getStore().daily.streak, 5);
            assert.equal(Store.getStore().history.length, 0);
        });

        test('dado un último reclamo previo, cuando el reloj avanza hacia adelante exactamente un día lógico (diffDays === 1), entonces claimDaily incrementa la racha y otorga recompensa escalonada', () => {
            const lastClaim = Date.UTC(2026, 5, 15, 12, 0, 0);
            const nextDay = Date.UTC(2026, 5, 16, 12, 0, 0);
            setTime(nextDay);
            resetStore({ coins: 100, lastClaim, streak: 3 });

            const result = Daily.claimDaily();

            assert.equal(result.success, true);
            assert.equal(result.streak, 4);
            assert.equal(result.reward, 35); // 20 + 5 * (4 - 1)
            assert.equal(Store.getStore().coins, 135);
            assert.equal(Store.getStore().daily.lastClaim, nextDay);
            assert.equal(Store.getStore().history.length, 1);
            assert.equal(Store.getStore().history[0].tipo, 'ingreso');
            assert.equal(Store.getStore().history[0].cantidad, 35);
        });

        test('dado un último reclamo previo, cuando el reloj avanza hacia adelante exactamente dos días lógicos (diffDays === 2), entonces claimDaily exige reparación y repairDailyStreak rescata la racha', () => {
            const lastClaim = Date.UTC(2026, 5, 15, 12, 0, 0);
            const twoDaysLater = Date.UTC(2026, 5, 17, 12, 0, 0);
            setTime(twoDaysLater);
            resetStore({ coins: 550, lastClaim, streak: 4 });

            const claimResult = Daily.claimDaily();
            assert.equal(claimResult.success, false);
            assert.equal(claimResult.repairRequired, true);
            assert.equal(claimResult.canAffordRepair, true);
            assert.equal(claimResult.repairCost, 500);
            assert.equal(Store.getStore().coins, 550);

            const repairResult = Daily.repairDailyStreak();
            assert.equal(repairResult.success, true);
            assert.equal(repairResult.streak, 4);
            assert.equal(repairResult.cost, 500);
            assert.equal(Store.getStore().coins, 50);
            assert.equal(Store.getStore().daily.lastClaim, twoDaysLater);
            assert.equal(Store.getStore().daily.streak, 4);
        });

        test('dado un último reclamo previo, cuando el reloj avanza hacia adelante más de dos días lógicos (diffDays >= 3), entonces claimDaily reinicia la racha a 1 y repairDailyStreak no está disponible', () => {
            const lastClaim = Date.UTC(2026, 5, 15, 12, 0, 0);
            const fiveDaysLater = Date.UTC(2026, 5, 20, 12, 0, 0);
            setTime(fiveDaysLater);
            resetStore({ coins: 1000, lastClaim, streak: 7 });

            const repairResult = Daily.repairDailyStreak();
            assert.equal(repairResult.success, false);
            assert.equal(repairResult.message, 'La reparación de racha no está disponible ahora.');
            assert.equal(Store.getStore().coins, 1000);

            const claimResult = Daily.claimDaily();
            assert.equal(claimResult.success, true);
            assert.equal(claimResult.streak, 1);
            assert.equal(claimResult.reward, 20);
            assert.equal(Store.getStore().coins, 1020);
            assert.equal(Store.getStore().daily.streak, 1);
            assert.equal(Store.getStore().daily.lastClaim, fiveDaysLater);
        });
    });

    describe('2. Transición en cambio de año y año bisiesto a través de DailyStreak', () => {
        test('dado un reclamo a las 22:00 del 31 de diciembre, cuando el reloj avanza al 1 de enero a las 04:00 del año siguiente, entonces claimDaily calcula diffDays === 1 e incrementa la racha', () => {
            const dec31 = new Date(2026, 11, 31, 22, 0, 0).getTime();
            const jan01 = new Date(2027, 0, 1, 4, 0, 0).getTime();
            setTime(jan01);
            resetStore({ coins: 0, lastClaim: dec31, streak: 5 });

            const result = Daily.claimDaily();

            assert.equal(result.success, true);
            assert.equal(result.streak, 6);
            assert.equal(result.reward, 45); // 20 + 5 * (6 - 1)
            assert.equal(Store.getStore().coins, 45);
            assert.equal(Store.getStore().daily.lastClaim, jan01);
        });

        test('dado un reclamo a las 22:00 del 31 de diciembre, cuando el reloj avanza al 2 de enero a las 04:00 (diffDays === 2), entonces repairDailyStreak rescata la racha en el nuevo año', () => {
            const dec31 = new Date(2026, 11, 31, 22, 0, 0).getTime();
            const jan02 = new Date(2027, 0, 2, 4, 0, 0).getTime();
            setTime(jan02);
            resetStore({ coins: 500, lastClaim: dec31, streak: 6 });

            const claimResult = Daily.claimDaily();
            assert.equal(claimResult.success, false);
            assert.equal(claimResult.repairRequired, true);

            const repairResult = Daily.repairDailyStreak();
            assert.equal(repairResult.success, true);
            assert.equal(repairResult.streak, 6);
            assert.equal(Store.getStore().coins, 0);
            assert.equal(Store.getStore().daily.streak, 6);
            assert.equal(Store.getStore().daily.lastClaim, jan02);
        });

        test('dado un reclamo el 28 de febrero en año bisiesto (2024), cuando avanza al 29 de febrero a las 04:00 y luego al 1 de marzo a las 04:00, entonces la racha avanza consecutivamente', () => {
            const feb28 = new Date(2024, 1, 28, 22, 0, 0).getTime();
            const feb29 = new Date(2024, 1, 29, 4, 0, 0).getTime();
            setTime(feb29);
            resetStore({ coins: 0, lastClaim: feb28, streak: 2 });

            const res1 = Daily.claimDaily();
            assert.equal(res1.success, true);
            assert.equal(res1.streak, 3);
            assert.equal(Store.getStore().daily.lastClaim, feb29);

            const mar01 = new Date(2024, 2, 1, 4, 0, 0).getTime();
            setTime(mar01);
            const res2 = Daily.claimDaily();
            assert.equal(res2.success, true);
            assert.equal(res2.streak, 4);
            assert.equal(Store.getStore().daily.lastClaim, mar01);
        });
    });

    describe('3. Borde exacto 02:59:59 frente a 03:00:00 del día lógico (DAILY_DAY_OFFSET_MS = 3 h)', () => {
        test('dado un reclamo previo a las 02:59:59 del día 15, cuando el reloj avanza 2 segundos a las 03:00:01 del día 15, entonces conmuta el día lógico (diffDays === 1) y permite el reclamo consecutivo', () => {
            const claim1Time = new Date(2026, 4, 15, 2, 59, 59).getTime(); // Pertenece al día lógico 14
            const claim2Time = new Date(2026, 4, 15, 3, 0, 1).getTime();   // Pertenece al día lógico 15

            setTime(claim2Time);
            resetStore({ coins: 0, lastClaim: claim1Time, streak: 1 });

            assert.equal(Time.dayDiff(claim2Time, claim1Time), 1);

            const result = Daily.claimDaily();
            assert.equal(result.success, true);
            assert.equal(result.streak, 2);
            assert.equal(result.reward, 25);
            assert.equal(Store.getStore().coins, 25);
            assert.equal(Store.getStore().daily.lastClaim, claim2Time);
        });

        test('dado un reclamo realizado a las 03:00:01 del día 15, cuando se intenta reclamar a las 02:59:59 del día 16, entonces pertenece al mismo día lógico (diffDays === 0) y es rechazado', () => {
            const claimTime = new Date(2026, 4, 15, 3, 0, 1).getTime();    // Día lógico 15
            const attemptTime = new Date(2026, 4, 16, 2, 59, 59).getTime(); // Todavía día lógico 15

            setTime(attemptTime);
            resetStore({ coins: 25, lastClaim: claimTime, streak: 2 });

            assert.equal(Time.dayDiff(attemptTime, claimTime), 0);

            const result = Daily.claimDaily();
            assert.equal(result.success, false);
            assert.equal(result.message, '¡Ya reclamaste tu bono hoy! Vuelve mañana.');
            assert.equal(Store.getStore().coins, 25);
            assert.equal(Store.getStore().daily.streak, 2);
            assert.equal(Store.getStore().daily.lastClaim, claimTime);
        });

        test('dado el intento rechazado a las 02:59:59 del día 16, cuando el reloj avanza 2 segundos a las 03:00:01 del día 16, entonces transiciona a diffDays === 1 y permite reclamar', () => {
            const claimTime = new Date(2026, 4, 15, 3, 0, 1).getTime();    // Día lógico 15
            const newClaimTime = new Date(2026, 4, 16, 3, 0, 1).getTime(); // Día lógico 16

            setTime(newClaimTime);
            resetStore({ coins: 25, lastClaim: claimTime, streak: 2 });

            assert.equal(Time.dayDiff(newClaimTime, claimTime), 1);

            const result = Daily.claimDaily();
            assert.equal(result.success, true);
            assert.equal(result.streak, 3);
            assert.equal(result.reward, 30);
            assert.equal(Store.getStore().coins, 55);
            assert.equal(Store.getStore().daily.lastClaim, newClaimTime);
        });
    });

    describe('4. Caducidad del TTL de 4 horas en la caché de tiempo (TIME_CACHE_TTL)', () => {
        test('dado un caché capturado en T, cuando transcurren 3 h 59 m 59 s (dentro de TTL), Time.read retorna verified: true', () => {
            const capturedAt = 1700000000000;
            const now = capturedAt + (4 * 3600 * 1000) - 1000; // 3 h 59 m 59 s
            setTime(now, { drift: 250, desynced: false, capturedAt });

            const readResult = Time.read();
            assert.equal(readResult.verified, true);
            assert.equal(readResult.cacheAge, (4 * 3600 * 1000) - 1000);
            assert.equal(readResult.time, now + 250);
        });

        test('dado un caché capturado en T, cuando transcurren 4 h 00 m 01 s (supera TTL), Time.read conmuta deterministamente a verified: false', () => {
            const capturedAt = 1700000000000;
            const now = capturedAt + (4 * 3600 * 1000) + 1000; // 4 h 00 m 01 s
            setTime(now, { drift: 250, desynced: false, capturedAt });

            const readResult = Time.read();
            assert.equal(readResult.verified, false);
            assert.equal(readResult.cacheAge, (4 * 3600 * 1000) + 1000);
            assert.equal(readResult.time, now + 250);
        });

        test('dado un caché cuyo TTL de 4 horas ha caducado, cuando se invoca claimDaily, entonces NO debería permitir el reclamo basándose en tiempo no verificado', { todo: 'BUG-F2c-01: claimDaily permite reclamo con verified:false tras expirar el TTL de 4 h del caché de tiempo' }, () => {
            const capturedAt = Date.UTC(2026, 5, 16, 8, 0, 0);
            const now = capturedAt + (4 * 3600 * 1000) + 1000; // 12:00:01 (expirado)
            setTime(now, { drift: 0, desynced: false, capturedAt });
            resetStore({ coins: 0, lastClaim: now - DAY, streak: 1 });

            const readResult = Time.read();
            assert.equal(readResult.verified, false);

            const result = Daily.claimDaily();
            // Comportamiento deseado: bloquear reclamo no verificado ante TTL expirado
            assert.equal(result.success, false);
        });

        test('dado un caché con TTL caducado, cuando se invoca claimDaily, refleja en producción el valor verified: false devuelto por el caché', () => {
            const capturedAt = Date.UTC(2026, 5, 16, 8, 0, 0);
            const now = capturedAt + (4 * 3600 * 1000) + 1000;
            setTime(now, { drift: 0, desynced: false, capturedAt });
            resetStore({ coins: 0, lastClaim: now - DAY, streak: 1 });

            const result = Daily.claimDaily();
            assert.equal(result.verified, false);
            assert.equal(result.success, true);
        });
    });

    describe('5. Expiración y vigencia de la Bendición Lunar con reloj movido', () => {
        test('dado una Bendición Lunar activa adquirida en T0, cuando el reloj avanza hacia el futuro dentro de la vigencia (T0 + 3 días), mantiene activo el beneficio y otorga bonus en claimDaily', () => {
            const T0 = 1700000000000;
            setTime(T0);
            resetStore({ coins: 200, lastClaim: 0, streak: 0 });

            const buyResult = Moon.buyMoonBlessing();
            assert.equal(buyResult.success, true);
            const expiry = Store.getStore().buffs.moonBlessingExpiry;
            assert.equal(expiry, T0 + (7 * DAY));

            // Avanzar 3 días hacia adelante
            const tPlus3 = T0 + (3 * DAY);
            setTime(tPlus3);
            resetStore({
                coins: 100,
                lastClaim: tPlus3 - DAY,
                streak: 1,
                moonExpiry: expiry
            });

            const status = Moon.getMoonBlessingStatus();
            assert.equal(status.active, true);
            assert.equal(status.remainingMs, 4 * DAY);

            const claimResult = Daily.claimDaily();
            assert.equal(claimResult.success, true);
            assert.equal(claimResult.moonBonus, 90);
            assert.equal(claimResult.reward, 115); // 25 base + 90 bonus
            assert.equal(Store.getStore().coins, 215);
        });

        test('dado una Bendición Lunar activa adquirida en T0, cuando el reloj avanza al futuro más allá de la vigencia (T0 + 8 días), el beneficio caduca y no otorga bonus en claimDaily', () => {
            const T0 = 1700000000000;
            const expiry = T0 + (7 * DAY);
            const tPlus8 = T0 + (8 * DAY);
            setTime(tPlus8);
            resetStore({
                coins: 100,
                lastClaim: tPlus8 - DAY,
                streak: 1,
                moonExpiry: expiry
            });

            const status = Moon.getMoonBlessingStatus();
            assert.equal(status.active, false);
            assert.equal(status.remainingMs, 0);
            assert.equal(status.expiresAt, null);

            const claimResult = Daily.claimDaily();
            assert.equal(claimResult.success, true);
            assert.equal(claimResult.moonBonus, 0);
            assert.equal(claimResult.reward, 25);
            assert.equal(Store.getStore().coins, 125);
        });

        test('dado una Bendición Lunar activa adquirida en T0, cuando el reloj local es manipulado retrasándolo 30 días al pasado (now < T0), evalúa expiry > now conservando el estado activo sin validar reloj (comportamiento real observado)', () => {
            const T0 = 1700000000000;
            const expiry = T0 + (7 * DAY);
            const tMinus30 = T0 - (30 * DAY); // Reloj 30 días al pasado
            setTime(tMinus30);
            resetStore({
                coins: 100,
                lastClaim: T0,
                streak: 1,
                moonExpiry: expiry
            });

            // En producción, Moon.getMoonBlessingStatus evalúa expiry > Date.now() directamente
            const status = Moon.getMoonBlessingStatus();
            assert.equal(status.active, true);
            assert.equal(status.remainingMs, (37 * DAY)); // Inflado artificialmente por el desfase

            // Sin embargo, Daily.claimDaily sí detecta el reloj hacia atrás (now < lastClaim) y bloquea
            const claimResult = Daily.claimDaily();
            assert.equal(claimResult.success, false);
            assert.equal(claimResult.message, 'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.');
        });
    });

    describe('6. Impacto de reloj atrasado en love_arcade_sentinel_ts y resolución LWW', () => {
        test('dado un usuario con sesión activa en Sentinel y timestamp previo, cuando el reloj del sistema salta hacia el pasado y se modifica una clave vigilada, entonces love_arcade_sentinel_ts retrocede en el tiempo (regresión no monotónica)', async () => {
            const env = setupSentinelSandbox();
            const initialTs = '2026-10-15T12:00:00.000Z';

            env.sandbox.setMockNow(Date.parse(initialTs));
            await env.login({ user: { id: 'user-skew-01', email: 'skew1@example.com' } });
            env.dispatchDomLoaded();

            // Primera modificación en la fecha normal
            const watchedKey = 'gamecenter_v6_promos';
            env.context.localStorage.setItem(watchedKey, JSON.stringify({ coins: 300 }));
            assert.equal(env.context.localStorage.getItem(env.SENTINEL_TS_KEY), initialTs);

            // Reloj del sistema sufre un salto abrupto hacia el pasado
            const jumpedPastTs = '2026-01-01T00:00:00.000Z';
            env.sandbox.setMockNow(Date.parse(jumpedPastTs));

            // Modificación de clave vigilada bajo reloj retrasado
            env.context.localStorage.setItem(watchedKey, JSON.stringify({ coins: 400 }));

            // Sentinel escribe Date.now() sin asegurar monotonía respecto al timestamp previo
            const currentTs = env.context.localStorage.getItem(env.SENTINEL_TS_KEY);
            assert.equal(currentTs, jumpedPastTs);
            assert.ok(Date.parse(currentTs) < Date.parse(initialTs), 'El timestamp retrocedió en el tiempo debido al reloj atrasado');
        });

        test('dado un timestamp local atrasado respecto a la nube, cuando se procesa auth en Sentinel, entonces la condición cloudTime > localTime induce la restauración destructiva de la nube sobre el almacenamiento local', async () => {
            const watchedKey = 'gamecenter_v6_promos';
            const cloudTs = '2026-06-01T00:00:00.000Z';
            const cloudStore = { coins: 50 };

            // Dispositivo con reloj retrasado a enero, con mayor progreso local (999 monedas)
            const regressedLocalTs = '2026-01-01T00:00:00.000Z';
            const localStore = { coins: 999 };

            const env = setupSentinelSandbox({
                initialStorage: {
                    [watchedKey]: localStore,
                    love_arcade_sentinel_ts: regressedLocalTs
                },
                initialProfiles: {
                    'user-lww-regressed': {
                        id: 'user-lww-regressed',
                        updated_at: cloudTs,
                        game_data: {
                            [watchedKey]: JSON.stringify(cloudStore)
                        }
                    }
                }
            });

            await env.login({ user: { id: 'user-lww-regressed', email: 'lww@example.com' } });

            // Mecanismo real de producción: cloudTime (junio) > localTime (enero)
            // Se restaura el snapshot de la nube destruyendo el progreso local más reciente
            const storedData = JSON.parse(env.context.localStorage.getItem(watchedKey));
            assert.equal(storedData.coins, 50, 'LWW resolvió a favor de la nube por timestamp superior');
            assert.equal(env.LoveArcadeStore.getStore().coins, 50);
            assert.equal(env.context.localStorage.getItem(env.SENTINEL_TS_KEY), cloudTs);
        });
    });
});
