import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import clientConfigHandler, { config as clientConfigExportConfig } from '../../api/client-config.js';
import telemetryHandler, { config as telemetryExportConfig } from '../../api/telemetry.js';
import reportHandler, { config as reportExportConfig } from '../../api/report.js';

const require = createRequire(import.meta.url);
const { createFakeReq, createFakeRes } = require('../helpers/fake-http.cjs');

const FAKE_SUPABASE_URL = 'https://fake-project-00000.supabase.co';
const FAKE_SUPABASE_ANON_KEY = 'fake_anon_public_key_1234567890';

describe('QA (F3b): api/client-config.js y alias api/telemetry.js (TKT-020)', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        delete process.env.NEXT_PUBLIC_LA_CLOUD_URL;
        delete process.env.NEXT_PUBLIC_LA_CLOUD_ANON_KEY;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('Configuración Serverless de client-config.js', () => {
        it('declara bodyParser: false al ser un endpoint exclusivamente GET', () => {
            assert.strictEqual(clientConfigExportConfig?.api?.bodyParser, false);
        });
    });

    describe('1. Validación de método HTTP (405)', () => {
        const invalidMethods = ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'];

        for (const method of invalidMethods) {
            it(`rechaza método ${method} con 405 y cabecera Allow: GET`, () => {
                const req = createFakeReq({ method });
                const res = createFakeRes();

                clientConfigHandler(req, res);

                assert.strictEqual(res.statusCode, 405);
                assert.strictEqual(res.getHeader('allow'), 'GET');
                assert.deepStrictEqual(res.body, { error: 'Method Not Allowed' });
            });
        }
    });

    describe('2. Cabeceras de prevención de almacenamiento en caché', () => {
        it('emite Cache-Control no-store y Pragma no-cache en peticiones GET', () => {
            const req = createFakeReq({ method: 'GET' });
            const res = createFakeRes();

            clientConfigHandler(req, res);

            assert.strictEqual(
                res.getHeader('cache-control'),
                'no-store, no-cache, must-revalidate',
                'Debe emitir Cache-Control con no-store para evitar cache de credenciales'
            );
            assert.strictEqual(
                res.getHeader('pragma'),
                'no-cache',
                'Debe emitir Pragma: no-cache para clientes HTTP/1.0'
            );
        });
    });

    describe('3. Degradación elegante sin variables de entorno', () => {
        it('devuelve status 200 con strings vacíos cuando las variables no existen', () => {
            delete process.env.NEXT_PUBLIC_LA_CLOUD_URL;
            delete process.env.NEXT_PUBLIC_LA_CLOUD_ANON_KEY;

            const req = createFakeReq({ method: 'GET' });
            const res = createFakeRes();

            clientConfigHandler(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.deepStrictEqual(res.body, {
                supabaseUrl: '',
                supabaseKey: '',
            });
        });

        it('devuelve strings vacíos si solo una de las variables está configurada', () => {
            process.env.NEXT_PUBLIC_LA_CLOUD_URL = FAKE_SUPABASE_URL;
            delete process.env.NEXT_PUBLIC_LA_CLOUD_ANON_KEY;

            const req = createFakeReq({ method: 'GET' });
            const res = createFakeRes();

            clientConfigHandler(req, res);

            assert.strictEqual(res.statusCode, 200);
            assert.deepStrictEqual(res.body, {
                supabaseUrl: '',
                supabaseKey: '',
            });
        });
    });

    describe('4. Contrato estricto y no filtración de variables de entorno', () => {
        it('devuelve exactamente y solo las claves supabaseUrl y supabaseKey configuradas', () => {
            process.env.NEXT_PUBLIC_LA_CLOUD_URL = FAKE_SUPABASE_URL;
            process.env.NEXT_PUBLIC_LA_CLOUD_ANON_KEY = FAKE_SUPABASE_ANON_KEY;

            // Variables privadas que NUNCA deben filtrarse al cliente
            process.env.SUPABASE_SERVICE_ROLE_KEY = 'secret_private_service_role_key';
            process.env.DATABASE_URL = 'postgres://user:pass@host:5432/db';
            process.env.TELEGRAM_BOT_TOKEN = 'secret_telegram_token_123';

            const req = createFakeReq({ method: 'GET' });
            const res = createFakeRes();

            clientConfigHandler(req, res);

            assert.strictEqual(res.statusCode, 200);

            // Contrato de claves exacto
            const returnedKeys = Object.keys(res.body).sort();
            assert.deepStrictEqual(
                returnedKeys,
                ['supabaseKey', 'supabaseUrl'],
                'El cuerpo debe contener únicamente las dos claves pactadas'
            );

            assert.strictEqual(res.body.supabaseUrl, FAKE_SUPABASE_URL);
            assert.strictEqual(res.body.supabaseKey, FAKE_SUPABASE_ANON_KEY);

            // Verificar que no se filtran secretos del servidor
            const serialized = JSON.stringify(res.body);
            assert.ok(!serialized.includes('secret_private_service_role_key'));
            assert.ok(!serialized.includes('postgres://'));
            assert.ok(!serialized.includes('secret_telegram_token_123'));
        });
    });

    describe('5. Alias funcional api/telemetry.js', () => {
        it('exporta por referencia exacta el mismo handler y config que api/report.js', () => {
            assert.strictEqual(
                telemetryHandler,
                reportHandler,
                'api/telemetry.js debe exportar por defecto la misma función handler que api/report.js'
            );
            assert.strictEqual(
                telemetryExportConfig,
                reportExportConfig,
                'api/telemetry.js debe exportar el mismo objeto config que api/report.js'
            );
        });
    });
});
