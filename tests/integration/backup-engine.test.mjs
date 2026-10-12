import test, { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createBackupSandbox } = require('../helpers/fake-backup.cjs');

describe('QA (F3a): BackupEngine - Exportación e importación .labak (TKT-015)', () => {
    it('dado un estado con múltiples claves, cuando se exporta y reimporta vía fallback (sync-worker-client), entonces conserva el estado íntegro y emite eventos', async () => {
        const initial = {
            gamecenter_v6_promos: JSON.stringify({ coins: 450, history: [] }),
            la_ws_state: JSON.stringify({ completedLevels: [1, 2, 3] }),
            puz_arcade_save_1: JSON.stringify({ score: 1000 }),
            la_milestone_progress_5: JSON.stringify({ reached: true }),
            custom_unlisted_key: 'custom_value_123'
        };

        const env = createBackupSandbox({ initialStorage: initial });
        const { BackupEngine } = env.context.window;

        const docStatusEvents = [];
        env.context.document.addEventListener('labackup:status', (e) => {
            docStatusEvents.push(e.detail);
        });

        const callbackStatusEvents = [];
        const onStatus = (type, message) => {
            callbackStatusEvents.push({ type, message });
        };

        // 1. Exportar backup
        const exportResult = await BackupEngine.exportBackup({ onStatus });

        assert.equal(exportResult.success, true, exportResult.message);
        assert.ok(exportResult.filename.startsWith('LoveArcade_Backup_'));
        assert.ok(exportResult.filename.endsWith('.labak'));
        assert.equal(exportResult.keyCount, 5);

        // Validar disparadores de descarga y notificaciones
        assert.equal(env.anchorClicks.length, 1);
        assert.equal(env.anchorClicks[0].download, exportResult.filename);
        assert.equal(env.createdBlobs.length, 1);
        assert.equal(env.createdBlobs[0].type, 'application/gzip');

        assert.deepEqual(JSON.parse(JSON.stringify(docStatusEvents)), [
            { type: 'processing', message: 'Procesando exportación…' },
            { type: 'success', message: 'Copia de seguridad creada' }
        ]);
        assert.deepEqual(
            JSON.parse(JSON.stringify(callbackStatusEvents)),
            JSON.parse(JSON.stringify(docStatusEvents))
        );

        // 2. Limpiar el almacenamiento local
        env.storage.clear();
        assert.equal(env.storage.size, 0);

        // 3. Importar desde el archivo generado
        const exportedBlob = env.createdBlobs[0];
        const backupFile = new env.context.File([exportedBlob], exportResult.filename, {
            type: 'application/gzip'
        });

        docStatusEvents.length = 0;
        callbackStatusEvents.length = 0;

        const importResult = await BackupEngine.importBackupFromFile(backupFile, { onStatus });

        assert.equal(importResult.success, true, importResult.message);
        assert.equal(importResult.restored, 5);

        assert.deepEqual(JSON.parse(JSON.stringify(docStatusEvents)), [
            { type: 'processing', message: 'Procesando importación…' },
            { type: 'success', message: 'Progreso restaurado con éxito' }
        ]);
        assert.deepEqual(
            JSON.parse(JSON.stringify(callbackStatusEvents)),
            JSON.parse(JSON.stringify(docStatusEvents))
        );

        // 4. Comprobar que el estado restaurado coincide exactamente con el inicial
        for (const [key, value] of Object.entries(initial)) {
            assert.equal(env.storage.get(key), value, `La clave ${key} debe coincidir`);
            assert.equal(env.context.localStorage.getItem(key), value);
        }
    });

    it('dado soporte de Web Worker activo (workerTask), cuando se exporta y reimporta, entonces ejecuta las tareas en el worker con paridad de formato', async () => {
        const initial = {
            gamecenter_v6_promos: JSON.stringify({ coins: 999 }),
            puz_arcade_progress: JSON.stringify({ solved: 12 })
        };

        const env = createBackupSandbox({ initialStorage: initial });

        const workerInvocations = [];
        env.context.window.workerTask = async (payload) => {
            workerInvocations.push(payload.action);
            if (payload.action === 'backup-export') {
                const checksum = await env.computeChecksum(payload.canonical);
                const fullPayload = JSON.stringify({ ...JSON.parse(payload.canonical), checksum });
                const stream = new env.context.Blob([fullPayload], { type: 'application/json' })
                    .stream()
                    .pipeThrough(new env.context.CompressionStream('gzip'));
                const buffer = await new env.context.Response(stream).arrayBuffer();
                return { checksum, bytes: Array.from(new Uint8Array(buffer)) };
            }
            if (payload.action === 'backup-import') {
                const compressedBlob = new env.context.Blob([new Uint8Array(payload.bytes)], {
                    type: 'application/gzip'
                });
                const stream = compressedBlob.stream().pipeThrough(new env.context.DecompressionStream('gzip'));
                const jsonText = await new env.context.Response(stream).text();
                return { jsonText };
            }
            throw new Error(`Acción desconocida: ${payload.action}`);
        };

        const { BackupEngine } = env.context.window;

        // Exportar vía worker
        const exportRes = await BackupEngine.exportBackup();
        assert.equal(exportRes.success, true);
        assert.ok(workerInvocations.includes('backup-export'));

        // Limpiar storage
        env.storage.clear();

        // Importar vía worker
        const backupFile = new env.context.File([env.createdBlobs[0]], exportRes.filename);
        const importRes = await BackupEngine.importBackupFromFile(backupFile);

        assert.equal(importRes.success, true);
        assert.ok(workerInvocations.includes('backup-import'));
        assert.equal(env.storage.get('gamecenter_v6_promos'), initial.gamecenter_v6_promos);
        assert.equal(env.storage.get('puz_arcade_progress'), initial.puz_arcade_progress);
    });

    it('dado texto con caracteres Unicode (>0xFF), cuando se hace el ida y vuelta, entonces preserva exactamente emojis, caracteres multiocteto y acentos', async () => {
        const initialUnicode = {
            nickname_data: JSON.stringify({ name: 'Lílíth ❤️ 🎮 東京', note: '¡Éxito total! ✨' }),
            special_symbols: '★✓⚡ ñandú ü Ç 漢字'
        };

        const env = createBackupSandbox({ initialStorage: initialUnicode });
        const { BackupEngine } = env.context.window;

        const exportRes = await BackupEngine.exportBackup();
        assert.equal(exportRes.success, true);

        env.storage.clear();

        const file = new env.context.File([env.createdBlobs[0]], exportRes.filename);
        const importRes = await BackupEngine.importBackupFromFile(file);

        assert.equal(importRes.success, true);
        assert.equal(env.storage.get('nickname_data'), initialUnicode.nickname_data);
        assert.equal(env.storage.get('special_symbols'), initialUnicode.special_symbols);
    });

    it('dado un archivo con checksum alterado, cuando se importa, entonces rechaza SIN mutar localStorage y sin escribir antes de validar', async () => {
        const preExistingState = {
            gamecenter_v6_promos: JSON.stringify({ coins: 100 }),
            critical_local_key: 'preserve_this'
        };

        const env = createBackupSandbox({ initialStorage: preExistingState });
        const { BackupEngine } = env.context.window;

        // Construir envelope con checksum corrupto/alterado
        const maliciousEnvelope = {
            version: 1,
            format: 'labak+gzip+sha256',
            createdAt: new Date().toISOString(),
            source: 'https://love-arcade.local',
            keys: {
                gamecenter_v6_promos: JSON.stringify({ coins: 99999 }),
                new_injected_key: 'injected_value'
            },
            keyCount: 2,
            checksum: '0000000000000000000000000000000000000000000000000000000000000000'
        };

        const tamperedFile = await env.createBackupFile(maliciousEnvelope, 'tampered.labak');

        const statusEvents = [];
        const onStatus = (type, message) => statusEvents.push({ type, message });

        env.setItemLog.length = 0;

        const result = await BackupEngine.importBackupFromFile(tamperedFile, { onStatus });

        // 1. Rechazo con mensaje explícito de checksum
        assert.equal(result.success, false);
        assert.match(result.message, /Integridad inválida: checksum SHA-256 no coincide/);

        // 2. Evento de error emitido
        assert.ok(statusEvents.some((e) => e.type === 'error' && e.message.includes('checksum SHA-256 no coincide')));

        // 3. Probar que NO se escribió en localStorage antes de validar (setItem nunca invocado)
        assert.equal(env.setItemLog.length, 0, 'No debe invocarse setItem antes de validar el checksum');

        // 4. Estado previo inalterado
        assert.equal(env.storage.get('gamecenter_v6_promos'), preExistingState.gamecenter_v6_promos);
        assert.equal(env.storage.get('critical_local_key'), preExistingState.critical_local_key);
        assert.equal(env.context.localStorage.getItem('new_injected_key'), null);
        assert.equal(env.storage.has('new_injected_key'), false);
    });

    it('dado un archivo con extensión no autorizada (.json, .txt, .zip), cuando se importa, entonces rechaza antes de procesar sin mutar storage', async () => {
        const env = createBackupSandbox({ initialStorage: { safe_key: 'original' } });
        const { BackupEngine } = env.context.window;

        const invalidExtensions = ['backup.json', 'save.txt', 'archive.zip', 'backup_sin_extension'];

        for (const filename of invalidExtensions) {
            env.setItemLog.length = 0;
            const file = new env.context.File(['dummy text'], filename);
            const res = await BackupEngine.importBackupFromFile(file);

            assert.equal(res.success, false);
            assert.equal(res.message, 'El archivo debe tener extensión .labak o .labak.gz.');
            assert.equal(env.setItemLog.length, 0);
            assert.equal(env.storage.get('safe_key'), 'original');
        }

        // Probar que admite mayúsculas (.LABAK y .LABAK.GZ)
        const validEnvelope = {
            version: 1,
            format: 'labak+gzip+sha256',
            createdAt: new Date().toISOString(),
            source: 'https://love-arcade.local',
            keys: { test_key: 'val' },
            keyCount: 1
        };
        const canonical = JSON.stringify(validEnvelope);
        validEnvelope.checksum = await env.computeChecksum(canonical);

        const upperCaseFile = await env.createBackupFile(validEnvelope, 'BACKUP.LABAK');
        const upperRes = await BackupEngine.importBackupFromFile(upperCaseFile);
        assert.equal(upperRes.success, true);
        assert.equal(env.storage.get('test_key'), 'val');
    });

    it('dado entrada nula o indefinida, cuando se importa, entonces rechaza con mensaje guiado', async () => {
        const env = createBackupSandbox();
        const { BackupEngine } = env.context.window;

        const resNull = await BackupEngine.importBackupFromFile(null);
        assert.equal(resNull.success, false);
        assert.equal(resNull.message, 'Selecciona un archivo .labak o .labak.gz.');

        const resUndef = await BackupEngine.importBackupFromFile(undefined);
        assert.equal(resUndef.success, false);
        assert.equal(resUndef.message, 'Selecciona un archivo .labak o .labak.gz.');
    });

    it('dado un archivo vacío o no comprimido con gzip, cuando se importa, entonces rechaza controladamente sin lanzar excepción no capturada', async () => {
        const env = createBackupSandbox({ initialStorage: { steady_key: 'safe' } });
        const { BackupEngine } = env.context.window;

        // 1. Archivo vacío con extensión .labak
        const emptyFile = new env.context.File([], 'empty.labak');
        const resEmpty = await BackupEngine.importBackupFromFile(emptyFile);
        assert.equal(resEmpty.success, false);
        assert.equal(env.storage.get('steady_key'), 'safe');

        // 2. Archivo corrupto (texto plano no gzip con extensión .labak)
        const nonGzipFile = new env.context.File(['texto no comprimido en formato gzip'], 'corrupt.labak');
        const resCorrupt = await BackupEngine.importBackupFromFile(nonGzipFile);
        assert.equal(resCorrupt.success, false);
        assert.equal(env.storage.get('steady_key'), 'safe');
    });

    it('dado un archivo gzip con contenido JSON malformado o envoltorio incompleto, cuando se valida, entonces rechaza sin mutar', async () => {
        const env = createBackupSandbox({ initialStorage: { initial: '1' } });
        const { BackupEngine } = env.context.window;

        // 1. JSON malformado comprimido
        const brokenJsonFile = await env.createBackupFile('{"incomplete": true,', 'broken.labak');
        const resBroken = await BackupEngine.importBackupFromFile(brokenJsonFile);
        assert.equal(resBroken.success, false);
        assert.equal(env.storage.get('initial'), '1');

        // 2. Envoltorio sin campo keys o sin checksum
        const missingFieldsFile = await env.createBackupFile({ version: 1, keys: null }, 'missing.labak');
        const resMissing = await BackupEngine.importBackupFromFile(missingFieldsFile);
        assert.equal(resMissing.success, false);
        assert.match(resMissing.message, /Estructura de respaldo incompleta/);
        assert.equal(env.storage.get('initial'), '1');

        // 3. Envoltorio con checksum pero con keys ausente o inválido (no objeto)
        const missingKeysFile = await env.createBackupFile({ version: 1, checksum: 'dummy_checksum', keys: null }, 'no-keys.labak');
        const resNoKeys = await BackupEngine.importBackupFromFile(missingKeysFile);
        assert.equal(resNoKeys.success, false);
        assert.match(resNoKeys.message, /Estructura de respaldo incompleta/);

        // 4. Envoltorio con keys válidas pero sin checksum
        const missingChecksumFile = await env.createBackupFile({ version: 1, keys: { safe: 'true' } }, 'no-checksum.labak');
        const resNoChecksum = await BackupEngine.importBackupFromFile(missingChecksumFile);
        assert.equal(resNoChecksum.success, false);
        assert.match(resNoChecksum.message, /Estructura de respaldo incompleta/);
    });

    it('dado un error de cuota (QuotaExceededError) al escribir en storage durante importación, cuando ocurre, entonces captura el error y reporta fallo', async () => {
        const env = createBackupSandbox();
        const { BackupEngine } = env.context.window;

        const envelope = {
            version: 1,
            format: 'labak+gzip+sha256',
            createdAt: new Date().toISOString(),
            source: 'https://love-arcade.local',
            keys: { large_payload: 'x'.repeat(100) },
            keyCount: 1
        };
        const canonical = JSON.stringify(envelope);
        envelope.checksum = await env.computeChecksum(canonical);

        const file = await env.createBackupFile(envelope, 'quota.labak');

        // Simular cuota de disco agotada
        env.setQuotaExceeded(true);

        const res = await BackupEngine.importBackupFromFile(file);
        assert.equal(res.success, false);
        assert.match(res.message, /QuotaExceededError/);
    });

    it('dado un input file, cuando se invoca triggerImportPicker, entonces resetea el valor y dispara el click nativo', () => {
        const env = createBackupSandbox();
        const { BackupEngine } = env.context.window;

        let clickInvoked = false;
        const fakeInput = {
            value: 'previous_path.labak',
            click() {
                clickInvoked = true;
            }
        };

        const triggered = BackupEngine.triggerImportPicker(fakeInput);
        assert.equal(triggered, true);
        assert.equal(fakeInput.value, '');
        assert.equal(clickInvoked, true);

        const triggeredNull = BackupEngine.triggerImportPicker(null);
        assert.equal(triggeredNull, false);
    });

    it('dado un archivo .labak con claves arbitrarias no vigiladas (R4), cuando se importa, entonces solo debería escribir claves autorizadas (lista blanca) y omitir claves arbitrarias', {
        todo: 'BUG-F3a-03: importBackupFromFile restaura cualquier clave sin lista blanca (R4)'
    }, async () => {
        const env = createBackupSandbox();
        const { BackupEngine } = env.context.window;

        const payloadWithArbitraryKeys = {
            version: 1,
            format: 'labak+gzip+sha256',
            createdAt: new Date().toISOString(),
            source: 'https://love-arcade.local',
            keys: {
                love_arcade_time_cache: JSON.stringify({ verified: true }),
                malicious_arbitrary_key: 'pwned_payload',
                foreign_unmonitored_token: 'secret_token_123'
            },
            keyCount: 3
        };

        const canonical = JSON.stringify(payloadWithArbitraryKeys);
        payloadWithArbitraryKeys.checksum = await env.computeChecksum(canonical);

        const backupFile = await env.createBackupFile(payloadWithArbitraryKeys, 'foreign_keys.labak');

        const importRes = await BackupEngine.importBackupFromFile(backupFile);
        assert.equal(importRes.success, true);

        // Clave legítima debe restaurarse
        assert.equal(
            env.storage.get('love_arcade_time_cache'),
            JSON.stringify({ verified: true })
        );

        // COMPORTAMIENTO DESEADO: Las claves arbitrarias no pertenecientes al catálogo vigilado/dinámico no deben ser escritas
        assert.equal(
            env.context.localStorage.getItem('malicious_arbitrary_key'),
            null,
            'No debería escribir claves arbitrarias fuera de la lista blanca'
        );
        assert.equal(
            env.context.localStorage.getItem('foreign_unmonitored_token'),
            null,
            'No debería escribir claves de otras aplicaciones o tokens arbitrarios'
        );
    });
});
