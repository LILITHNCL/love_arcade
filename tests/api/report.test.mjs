import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import handler, { config } from '../../api/report.js';

const require = createRequire(import.meta.url);
const { createFakeReq, createFakeRes } = require('../helpers/fake-http.cjs');

const FAKE_PRODUCTION_DOMAIN = 'love-arcade.vercel.app';
const FAKE_BOT_TOKEN = 'fake_telegram_bot_token_secret_98765';
const FAKE_CHAT_ID = '-100987654321';

describe('QA (F3b): api/report.js - Proxy Serverless de Telemetría (TKT-019)', () => {
    let originalEnv;
    let originalFetch;
    let originalConsoleWarn;
    let originalConsoleError;
    let capturedLogs;
    let fetchCalls;

    beforeEach(() => {
        // Guardar snapshot de process.env
        originalEnv = { ...process.env };
        originalFetch = globalThis.fetch;
        originalConsoleWarn = console.warn;
        originalConsoleError = console.error;

        // Configuración de entorno de prueba limpia
        process.env.PRODUCTION_DOMAIN = FAKE_PRODUCTION_DOMAIN;
        process.env.TELEGRAM_BOT_TOKEN = FAKE_BOT_TOKEN;
        process.env.TELEGRAM_CHAT_ID = FAKE_CHAT_ID;

        // Captura de logs de consola
        capturedLogs = [];
        console.warn = (...args) => {
            capturedLogs.push({ level: 'warn', message: args.map(String).join(' ') });
        };
        console.error = (...args) => {
            capturedLogs.push({ level: 'error', message: args.map(String).join(' ') });
        };

        // Interceptación de globalThis.fetch (sin peticiones de red reales)
        fetchCalls = [];
        globalThis.fetch = async (url, options) => {
            fetchCalls.push({ url, options });
            return {
                ok: true,
                status: 200,
                json: async () => ({ ok: true, result: { message_id: 12345 } }),
                text: async () => JSON.stringify({ ok: true }),
            };
        };
    });

    afterEach(() => {
        // Restaurar estado global estricto
        process.env = originalEnv;
        globalThis.fetch = originalFetch;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
    });

    describe('Configuración de exportación (Vercel Serverless)', () => {
        it('declara explícitamente bodyParser con límite de 16kb', () => {
            assert.ok(config?.api?.bodyParser, 'Debe existir la configuración de bodyParser');
            assert.strictEqual(config.api.bodyParser.sizeLimit, '16kb');
        });
    });

    describe('1. Validación de método HTTP (405)', () => {
        it('rechaza peticiones GET con 405 Method Not Allowed', async () => {
            const req = createFakeReq({ method: 'GET' });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 405);
            assert.strictEqual(res.body?.ok, false);
            assert.strictEqual(res.body?.error?.code, 'method_not_allowed');
            assert.strictEqual(fetchCalls.length, 0, 'No debe invocar a Telegram');
        });

        it('rechaza peticiones PUT y DELETE con 405', async () => {
            for (const method of ['PUT', 'DELETE']) {
                const req = createFakeReq({ method });
                const res = createFakeRes();

                await handler(req, res);

                assert.strictEqual(res.statusCode, 405);
                assert.strictEqual(res.body?.error?.code, 'method_not_allowed');
            }
            assert.strictEqual(fetchCalls.length, 0);
        });
    });

    describe('2. Validación de origen y seguridad (403)', () => {
        it('rechaza orígenes externos no autorizados con 403 Forbidden', async () => {
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://sitio-malicioso.com' },
                body: { type: 'analytics', user: 'player1', event: 'game_start' },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(res.body?.ok, false);
            assert.strictEqual(res.body?.error?.code, 'forbidden_origin');
            assert.strictEqual(res.body?.error?.details?.origin, 'https://sitio-malicioso.com');
            assert.strictEqual(fetchCalls.length, 0);
        });

        it('rechaza petición con referer no autorizado si origin está ausente', async () => {
            const req = createFakeReq({
                method: 'POST',
                headers: { referer: 'https://phishing-site.org/index.html' },
                body: { type: 'analytics', user: 'player1', event: 'game_start' },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(res.body?.error?.code, 'forbidden_origin');
            assert.strictEqual(fetchCalls.length, 0);
        });

        it('rechaza petición con origen vacío cuando PRODUCTION_DOMAIN está configurado', async () => {
            const req = createFakeReq({
                method: 'POST',
                headers: {},
                body: { type: 'analytics', user: 'player1', event: 'game_start' },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 403);
            assert.strictEqual(res.body?.error?.code, 'forbidden_origin');
            assert.strictEqual(fetchCalls.length, 0);
        });

        it('acepta peticiones si PRODUCTION_DOMAIN no está configurado (modo permisivo dev)', async () => {
            delete process.env.PRODUCTION_DOMAIN;
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://otro-origen.com' },
                body: { type: 'analytics', user: 'player1', event: 'game_start' },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.body?.ok, true);
            assert.strictEqual(fetchCalls.length, 1);
        });
    });

    describe('3. Orígenes autorizados (200)', () => {
        const authorizedOrigins = [
            'https://love-arcade.vercel.app',
            'https://subdominio.love-arcade.vercel.app',
            'https://preview-deploy-xyz.vercel.app',
            'https://vercel.app',
            'http://localhost:3000',
            'http://localhost:8080',
            'http://127.0.0.1:5500',
        ];

        for (const origin of authorizedOrigins) {
            it(`permite origen válido: ${origin}`, async () => {
                const req = createFakeReq({
                    method: 'POST',
                    headers: { origin },
                    body: { type: 'analytics', user: 'test_user', event: 'test_event' },
                });
                const res = createFakeRes();

                await handler(req, res);

                assert.strictEqual(res.statusCode, 200);
                assert.strictEqual(res.body?.ok, true);
            });
        }
    });

    describe('4. Sanitización HTML del nickname y campos en el payload saliente', () => {
        it('escapa caracteres HTML (&, <, >, ", \') en user, event y data sin llegar crudos a Telegram', async () => {
            const maliciousUser = 'A <tag> & "B" \'c\''; // 41 caracteres escapado (cabe en 50, sin toUpperCase)
            const maliciousEvent = 'ev <x> > D'; // pasa por toUpperCase
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: {
                    type: 'bug',
                    user: maliciousUser,
                    event: maliciousEvent,
                    data: {
                        '<injected_key>': '<b>script <alert> & "data" \'val\' > end</b>',
                    },
                },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(fetchCalls.length, 1);

            const outgoingPayload = JSON.parse(fetchCalls[0].options.body);
            const outgoingText = outgoingPayload.text;

            // Verificar que los caracteres peligrosos NO están crudos
            assert.ok(!outgoingText.includes('<tag>'), 'No debe contener <tag> crudo');
            assert.ok(!outgoingText.includes('<b>script'), 'No debe contener <b> crudo inyectado en data');
            assert.ok(!outgoingText.includes('<alert>'), 'No debe contener <alert> crudo');
            assert.ok(!outgoingText.includes('<injected_key>'), 'La clave de data debe ser sanitizada');

            // Verificar que los caracteres están correctamente escapados
            assert.ok(outgoingText.includes('&lt;tag&gt;'));
            assert.ok(outgoingText.includes('&amp; &quot;B&quot;'));
            assert.ok(outgoingText.includes('&#39;c&#39;'));
            assert.ok(outgoingText.includes('&gt; end'));
            assert.ok(outgoingText.includes('&lt;injected_key&gt;'));
            assert.ok(outgoingText.includes('&lt;b&gt;script'));
            assert.ok(outgoingText.includes('&#39;val&#39;'));
        });

        it('asigna el Topic 4 y emoji 🚨 a reportes de tipo bug', async () => {
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: { type: 'bug', user: 'player1', event: 'crash_event' },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            const outgoingPayload = JSON.parse(fetchCalls[0].options.body);
            assert.strictEqual(outgoingPayload.message_thread_id, 4);
            assert.ok(outgoingPayload.text.includes('🚨'));
        });

        it('asigna el Topic 3 y emoji 🏆 a reportes de tipo achievement', async () => {
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: { type: 'achievement', user: 'player1', event: 'level_clear' },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            const outgoingPayload = JSON.parse(fetchCalls[0].options.body);
            assert.strictEqual(outgoingPayload.message_thread_id, 3);
            assert.ok(outgoingPayload.text.includes('🏆'));
        });

        it('eventLabel en mayúsculas conserva las entidades HTML en minúsculas en el mensaje a Telegram', {
            todo: 'BUG-F3b-02: decisión de producto pendiente - eventLabel pasa a mayúsculas texto ya escapado'
        }, async () => {
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: {
                    type: 'bug',
                    user: 'A <b> & "c"',
                    event: 'ev <x> > & "q"',
                },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(fetchCalls.length, 1);

            const outgoingPayload = JSON.parse(fetchCalls[0].options.body);
            const outgoingText = outgoingPayload.text;

            // Comportamiento DESEADO: el evento en el título conserva las entidades HTML estándar en minúsculas
            assert.ok(
                outgoingText.includes('&lt;') && !outgoingText.includes('&LT;'),
                'Las entidades HTML del evento deben permanecer en minúsculas (&lt;) en lugar de transformarse a mayúsculas (&LT;)'
            );
        });

        it('trunca el nickname de usuario a 50 caracteres para prevenir saturación', async () => {
            const longUser = 'U'.repeat(120);
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: {
                    type: 'analytics',
                    user: longUser,
                    event: 'normal_event',
                },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            const outgoingPayload = JSON.parse(fetchCalls[0].options.body);
            const outgoingText = outgoingPayload.text;

            // Longitud máxima de user sanitizado es 50
            assert.ok(outgoingText.includes('U'.repeat(50)));
            assert.ok(!outgoingText.includes('U'.repeat(51)));
        });

        it('trunca el identificador de evento a 80 caracteres para prevenir saturación', async () => {
            const longEvent = 'E'.repeat(200);
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: {
                    type: 'analytics',
                    user: 'normal_user',
                    event: longEvent,
                },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            const outgoingPayload = JSON.parse(fetchCalls[0].options.body);
            const outgoingText = outgoingPayload.text;

            // Longitud máxima de event sanitizado es 80
            assert.ok(outgoingText.includes('E'.repeat(80)));
            assert.ok(!outgoingText.includes('E'.repeat(81)));
        });
    });

    describe('5. Manejo de fallos en Telegram y no exposición de secretos', () => {
        it('Telegram devuelve HTTP no-OK (502) sin exponer el token en la respuesta ni en consola', async () => {
            globalThis.fetch = async () => ({
                ok: false,
                status: 429,
                json: async () => ({ ok: false, error_code: 429, description: 'Too Many Requests' }),
            });

            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: { type: 'analytics', user: 'player1', event: 'level_pass' },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 502);
            assert.strictEqual(res.body?.ok, false);
            assert.strictEqual(res.body?.error?.code, 'telegram_upstream_error');

            const bodyStr = JSON.stringify(res.body);
            assert.ok(!bodyStr.includes(FAKE_BOT_TOKEN), 'El token no debe aparecer en el cuerpo de respuesta');

            const logsStr = JSON.stringify(capturedLogs);
            assert.ok(!logsStr.includes(FAKE_BOT_TOKEN), 'El token no debe aparecer en los logs del servidor');
        });

        it('Error de red al contactar Telegram (504) sin exponer el token', async () => {
            globalThis.fetch = async () => {
                throw new Error('connect ECONNREFUSED 149.154.167.220:443');
            };

            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: { type: 'analytics', user: 'player1', event: 'level_pass' },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 504);
            assert.strictEqual(res.body?.ok, false);
            assert.strictEqual(res.body?.error?.code, 'telegram_network_error');

            const bodyStr = JSON.stringify(res.body);
            assert.ok(!bodyStr.includes(FAKE_BOT_TOKEN));

            const logsStr = JSON.stringify(capturedLogs);
            assert.ok(!logsStr.includes(FAKE_BOT_TOKEN));
        });

        it('Timeout al contactar Telegram (504 telegram_timeout)', async () => {
            globalThis.fetch = async () => {
                const err = new Error('The operation was aborted');
                err.name = 'AbortError';
                throw err;
            };

            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: { type: 'analytics', user: 'player1', event: 'level_pass' },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 504);
            assert.strictEqual(res.body?.error?.code, 'telegram_timeout');
        });

        it('Variables de entorno de Telegram ausentes devuelven 500 server_misconfiguration', async () => {
            delete process.env.TELEGRAM_BOT_TOKEN;

            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: { type: 'analytics', user: 'player1', event: 'level_pass' },
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 500);
            assert.strictEqual(res.body?.ok, false);
            assert.strictEqual(res.body?.error?.code, 'server_misconfiguration');
            assert.strictEqual(fetchCalls.length, 0);
        });
    });

    describe('6. Soporte de formatos de req.body y defensiva', () => {
        it('parsea req.body cuando es un string JSON', async () => {
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: JSON.stringify({ type: 'achievement', user: 'str_user', event: 'str_event' }),
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(fetchCalls.length, 1);
            const outgoing = JSON.parse(fetchCalls[0].options.body);
            assert.ok(outgoing.text.includes('str_user'));
            assert.ok(outgoing.text.includes('STR EVENT'));
        });

        it('parsea req.body cuando es un Buffer binario', async () => {
            const jsonBuffer = Buffer.from(JSON.stringify({
                type: 'bug',
                user: 'buf_user',
                event: 'buf_event',
            }), 'utf8');

            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: jsonBuffer,
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(fetchCalls.length, 1);
            const outgoing = JSON.parse(fetchCalls[0].options.body);
            assert.ok(outgoing.text.includes('buf_user'));
            assert.ok(outgoing.text.includes('BUF EVENT'));
        });

        it('parsea stream crudo cuando req.body es undefined', async () => {
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: undefined,
                rawStream: [
                    '{"type":"analytics",',
                    '"user":"stream_hero",',
                    '"event":"stream_finish"}',
                ],
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(fetchCalls.length, 1);
            const outgoing = JSON.parse(fetchCalls[0].options.body);
            assert.ok(outgoing.text.includes('stream_hero'));
            assert.ok(outgoing.text.includes('STREAM FINISH'));
        });

        it('gestiona JSON malformado con defaults sin lanzar excepción no capturada', async () => {
            const req = createFakeReq({
                method: 'POST',
                headers: { origin: 'https://love-arcade.vercel.app' },
                body: '{ json_roto: sin_cerrar',
            });
            const res = createFakeRes();

            await handler(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(fetchCalls.length, 1);
            const outgoing = JSON.parse(fetchCalls[0].options.body);
            // Default user es 'desconocido' y default event es 'unknown'
            assert.ok(outgoing.text.includes('desconocido'));
            assert.ok(outgoing.text.includes('UNKNOWN'));
        });
    });
});
