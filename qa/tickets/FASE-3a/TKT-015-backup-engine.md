# TKT-015: BackupEngine - Exportación e importación .labak

- **ID y título**: TKT-015 — BackupEngine: Exportación e importación de respaldos .labak (`exportBackup` / `importBackupFromFile` con gzip y SHA-256)
- **Fase**: F3a (matriz de cobertura #15, riesgo R4)
- **Prioridad**: P1
- **Dependencias**: `js/core/sync-worker-client.js`, `js/backup-engine.js`, `js/sync-worker.js`, sandbox VM y helper (`tests/helpers/fake-backup.cjs`).

## Riesgo que cubre
| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Pérdida o corrupción de respaldo | Exportación y posterior importación de estado | Pérdida de claves, corrupción de tipos JSON o fallo en ciclo gzip | `js/backup-engine.js:64-88,139-166,197-221` |
| Inyección de datos alterados | Archivo con contenido o checksum alterado | Acepta el archivo o escribe en `localStorage` antes de validar integridad | `js/backup-engine.js:200-218` |
| Importación de archivos no autorizados | Archivo con extensión `.json`, `.txt`, `.zip` | Intenta procesar archivos ajenos provocando errores no controlados | `js/backup-engine.js:184-187` |
| Crasheo ante archivo vacío o corrupto | Archivo vacío o datos binarios no gzip | Lanza excepciones no controladas en el hilo principal | `js/backup-engine.js:193-195,222-225` |
| Corrupción de caracteres Unicode | Textos con emojis, diacríticos o caracteres >0xFF | Truncamiento de bytes, caracteres inválidos o fallo de encoding | `js/backup-engine.js:90-105,107-113` |
| Escritura de claves arbitrarias (R4) | Archivo válido con claves ajenas a Love Arcade | Escribe claves arbitrarias sin filtrar por lista blanca autorizada | `js/backup-engine.js:213-218` |
| Fallo silencioso por cuota de disco | `localStorage.setItem` lanza `QuotaExceededError` | No captura el error de cuota o rompe el contrato de respuesta | `js/backup-engine.js:217,222-225` |

## Tipo y herramienta
Test de integración con `node:test` y `node:assert/strict`, ejecutado en el sandbox de VM del proyecto con `CompressionStream`, `DecompressionStream` y `crypto.subtle` reales de Node.

## Archivos
- Crear helper: `tests/helpers/fake-backup.cjs`.
- Crear suite de tests: `tests/integration/backup-engine.test.mjs`.
- Documentación: `qa/tickets/FASE-3a/TKT-000-indice.md`, `qa/BUGS-ENCONTRADOS.md`, este ticket.
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)
1. **Ida y vuelta conserva el estado (Fallback / sync-worker-client)**: múltiples claves locales → exportar → limpia storage → importar → todas las claves y valores persisten de forma idéntica; emite eventos `'processing'` y `'success'` en `document` y callback `opts.onStatus`.
2. **Ida y vuelta vía Web Worker (`workerTask`)**: entorno con `workerTask` disponible → exporta e importa invocando `backup-export` y `backup-import` con paridad de formato frente a fallback.
3. **Verificación Unicode (>0xFF)**: datos con emojis (`🎮❤️🕹️`), caracteres asiáticos (`東京`) y diacríticos (`Ñandú`, `¡Éxito!`) → ida y vuelta conserva exactamente los caracteres sin corrupción.
4. **Checksum alterado rechazado SIN mutar localStorage**: envelope con checksum alterado → `importBackupFromFile` rechaza con `Integridad inválida: checksum SHA-256 no coincide`, emite `'error'`, y `setItem` nunca es invocado (validación precede a la escritura).
5. **Extensión no autorizada rechazada**: archivo `.json`, `.txt`, `.zip` → rechazado inmediatamente con mensaje guiado; tolera mayúsculas (`.LABAK`, `.LABAK.GZ`).
6. **Entrada nula o indefinida**: `importBackupFromFile(null)` → rechazado con mensaje informativo sin lanzar excepción.
7. **Archivo vacío o no gzip**: `new File([], ...)` o bytes no gzip → rechazado controladamente sin lanzar excepción no capturada.
8. **JSON corrupto o envoltorio incompleto**: datos gzip con JSON malformado o sin campos `checksum`/`keys` → rechaza con error de estructura.
9. **Cuota de disco (`QuotaExceededError`)**: `setItem` falla por cuota → capturado elegantemente devolviendo `{ success: false }` y estado `'error'`.
10. **Interacción de interfaz (`triggerImportPicker`)**: `<input type="file">` válido → limpia `value`, dispara `.click()`, devuelve `true`; con `null` devuelve `false`.
11. **Claves arbitrarias no vigiladas (R4)**: archivo válido con claves ajenas → documentado como bug de producto BUG-F3a-03 bajo test `todo` asertando lista blanca.

## Qué NO se mockea
- Se ejecutan los algoritmos reales de compresión gzip (`CompressionStream`, `DecompressionStream`), SHA-256 (`crypto.subtle.digest`) y serialización/deserialización JSON.
- Se ejecuta el código fuente real de `js/backup-engine.js` y `js/core/sync-worker-client.js`.
- Se falsea la descarga en navegador (`<a>`), almacenamiento en disco y eventos del DOM.

## Criterios de aceptación
- [x] Ida y vuelta conserva el 100% de los datos en fallback y worker.
- [x] Preserva íntegramente caracteres Unicode multiocteto (>0xFF).
- [x] Checksum alterado es rechazado antes de cualquier mutación a `localStorage`.
- [x] Archivos con extensión inválida, vacíos o corruptos son rechazados controladamente.
- [x] Fallo por cuota de disco es capturado sin crashear.
- [x] Riesgo R4 (escritura de claves arbitrarias sin lista blanca) documentado en BUG-F3a-03 con test `todo`.
- [x] Ausencia de salt en el checksum SHA-256 documentada como consideración de diseño.

## Verificación por mutación (P1)
Se ejecutaron 5 mutaciones reproducibles cubriendo las ramas críticas de validación de integridad, orden de escritura, descompresión, control de extensión y notificación de eventos en `js/backup-engine.js`.

### Mutación 1: Rama de validación de checksum (`backup-engine.js:209`)
- **Descripción**: Alterar la comprobación de integridad para ignorar la discrepancia de checksum SHA-256 (`payload.checksum !== expected` cambiado a `false`).
- **Comando reproducible**:
  ```bash
  sed -i 's/if (payload.checksum !== expected)/if (false)/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un archivo con checksum alterado, cuando se importa, entonces rechaza SIN mutar localStorage y sin escribir antes de validar (28.97ms)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:

    true !== false

        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:194:16)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Suite.processPendingSubtests (node:internal/test_runner/test:960:7) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: true,
      expected: false,
      operator: 'strictEqual',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 2: Rama de orden de escritura antes de validar checksum (`backup-engine.js:213-218`)
- **Descripción**: Mover el bucle de escritura `localStorage.setItem` antes de la verificación del checksum SHA-256, simulando escritura prematura.
- **Comando reproducible**:
  ```bash
  sed -i 's/if (payload.checksum !== expected) {/for (const [k, v] of Object.entries(payload.keys || {})) localStorage.setItem(k, v); if (payload.checksum !== expected) {/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un archivo con checksum alterado, cuando se importa, entonces rechaza SIN mutar localStorage y sin escribir antes de validar (26.76776ms)
    AssertionError [ERR_ASSERTION]: No debe invocarse setItem antes de validar el checksum

    2 !== 0

        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:201:16)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Suite.processPendingSubtests (node:internal/test_runner/test:960:7) {
      generatedMessage: false,
      code: 'ERR_ASSERTION',
      actual: 2,
      expected: 0,
      operator: 'strictEqual',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 3: Rama de validación de extensión (`backup-engine.js:185`)
- **Descripción**: Forzar `looksLikeBackup = true` permitiendo extensiones no autorizadas (.json, .txt, .zip) sin rechazo previo.
- **Comando reproducible**:
  ```bash
  sed -i 's/const looksLikeBackup = lowerName.endsWith(FILE_EXTENSION) || lowerName.endsWith(LEGACY_FILE_EXTENSION);/const looksLikeBackup = true;/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un archivo con extensión no autorizada (.json, .txt, .zip), cuando se importa, entonces rechaza antes de procesar sin mutar storage (30.496667ms)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    + actual - expected

    + 'Error de importación.'
    - 'El archivo debe tener extensión .labak o .labak.gz.'

        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:222:20)
        at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Suite.processPendingSubtests (node:internal/test_runner/test:960:7) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: 'Error de importación.',
      expected: 'El archivo debe tener extensión .labak o .labak.gz.',
      operator: 'strictEqual',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 4: Rama de descompresión gzip (`backup-engine.js:194`)
- **Descripción**: Omitir descompresión gzip en fallback (`_fromGzipBlob`), leyendo el blob comprimido directamente como texto plano sin descomprimir.
- **Comando reproducible**:
  ```bash
  sed -i 's/jsonText = await _fromGzipBlob(file);/jsonText = await file.text();/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un estado con múltiples claves, cuando se exporta y reimporta vía fallback (sync-worker-client), entonces conserva el estado íntegro y emite eventos (389.159948ms)
    AssertionError [ERR_ASSERTION]: Unexpected token ' ', "         "... is not valid JSON

    false !== true

        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:69:16)
        at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Promise.all (index 0)
        at async Suite.run (node:internal/test_runner/test:1869:7)
        at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
      generatedMessage: false,
      code: 'ERR_ASSERTION',
      actual: false,
      expected: true,
      operator: 'strictEqual',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 5: Rama de notificación de eventos de estado (`backup-engine.js:45-49`)
- **Descripción**: Desactivar `_emitStatus` omitiendo la emisión del evento personalizado `'labackup:status'` al document.
- **Comando reproducible**:
  ```bash
  sed -i 's/function _emitStatus(type, message) {/function _emitStatus(type, message) { return;/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un estado con múltiples claves, cuando se exporta y reimporta vía fallback (sync-worker-client), entonces conserva el estado íntegro y emite eventos (443.653281ms)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
    + actual - expected

    + []
    - [
    -   {
    -     message: 'Procesando exportación…',
    -     type: 'processing'
    -   },
    -   {
    -     message: 'Copia de seguridad creada',
    -     type: 'success'
    -   }
    - ]

        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:45:16)
        at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Promise.all (index 0)
        at async Suite.run (node:internal/test_runner/test:1869:7)
        at async startSubtestAfterBootstrap (node:internal/test_runner/harness:387:3) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: [],
      expected: [ { type: 'processing', message: 'Procesando exportación…' }, { type: 'success', message: 'Copia de seguridad creada' } ],
      operator: 'deepStrictEqual',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 6: Rama de delegación a Web Worker (`backup-engine.js:123-125`)
- **Descripción**: Forzar error en `_workerBackupTask`, simulando que el helper del worker no está disponible o falla incondicionalmente (escenario 2).
- **Comando reproducible**:
  ```bash
  sed -i 's/if (typeof window.workerTask !== '\''function'\'')/if (true)/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado soporte de Web Worker activo (workerTask), cuando se exporta y reimporta, entonces ejecuta las tareas en el worker con paridad de formato (96.561042ms)
    AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
    
      assert.ok(workerInvocations.includes('backup-export'))
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:124:16)
        at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Suite.processPendingSubtests (node:internal/test_runner/test:960:7) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: false,
      expected: true,
      operator: '==',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 7: Rama de codificación multiocteto Unicode >0xFF (`backup-engine.js:101`)
- **Descripción**: Truncar o eliminar caracteres fuera de ASCII estándar en `_toGzipBlob` (`text.replace(/[^\x00-\x7F]/g, '')`), simulando corrupción de emojis, kanjis y diacríticos (escenario 3).
- **Comando reproducible**:
  ```bash
  sed -i 's/const stream = new Blob(\[text\],/const stream = new Blob([text.replace(\/[^\\x00-\\x7F]\/g, "")],/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado texto con caracteres Unicode (>0xFF), cuando se hace el ida y vuelta, entonces preserva exactamente emojis, caracteres multiocteto y acentos (32.684532ms)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    
    false !== true
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:156:16)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Suite.processPendingSubtests (node:internal/test_runner/test:960:7) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: false,
      expected: true,
      operator: 'strictEqual',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 8: Rama de validación de archivo nulo o indefinido (`backup-engine.js:183`)
- **Descripción**: Desactivar la guarda inicial `if (!file)` en `importBackupFromFile` (escenario 6).
- **Comando reproducible**:
  ```bash
  sed -i 's/if (!file) throw new Error/if (false) throw new Error/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado entrada nula o indefinida, cuando se importa, entonces rechaza con mensaje guiado (16.625052ms)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    + actual - expected
    
    + "Cannot read properties of null (reading 'name')"
    - 'Selecciona un archivo .labak o .labak.gz.'
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:251:16)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Suite.processPendingSubtests (node:internal/test_runner/test:960:7) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: "Cannot read properties of null (reading 'name')",
      expected: 'Selecciona un archivo .labak o .labak.gz.',
      operator: 'strictEqual',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 9: Rama de archivo vacío o no gzip (`backup-engine.js:188`)
- **Descripción**: Retornar éxito prematuro si `file.size === 0` en `importBackupFromFile` en lugar de procesar y validar el flujo gzip (escenario 7).
- **Comando reproducible**:
  ```bash
  sed -i 's/let jsonText = '\'''\'';/let jsonText = '\'''\''; if (file.size === 0) return { success: true, restored: 0 };/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un archivo vacío o no comprimido con gzip, cuando se importa, entonces rechaza controladamente sin lanzar excepción no capturada (19.393021ms)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    
    true !== false
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:265:16)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Suite.processPendingSubtests (node:internal/test_runner/test:960:7) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: true,
      expected: false,
      operator: 'strictEqual',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 10: Rama de validación de estructura de envoltorio / keys (`backup-engine.js:117`)
- **Descripción**: Omitir la validación del campo `payload.keys` en `_validateEnvelope` (`!payload.checksum || !payload.keys ...` cambiado a `!payload.checksum`) (escenario 8).
  *(Nota de proceso: el mutante inicial sobrevivió debido a que el subtest original no incluía `checksum` en el payload incompleto; el test fue reforzado en commit independiente y la mutación repetida confirmó la detección).*
- **Comando reproducible**:
  ```bash
  sed -i 's/!payload.checksum || !payload.keys || typeof payload.keys !== '\''object'\''/!payload.checksum/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un archivo gzip con contenido JSON malformado o envoltorio incompleto, cuando se valida, entonces rechaza sin mutar (38.129427ms)
    AssertionError [ERR_ASSERTION]: The input did not match the regular expression /Estructura de respaldo incompleta/. Input:
    
    'Integridad inválida: checksum SHA-256 no coincide.'
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:296:16)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Suite.processPendingSubtests (node:internal/test_runner/test:960:7) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: 'Integridad inválida: checksum SHA-256 no coincide.',
      expected: /Estructura de respaldo incompleta/,
      operator: 'match',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 11: Rama de fallo de cuota de disco QuotaExceededError en setItem (`backup-engine.js:217`)
- **Descripción**: Capturar silenciosamente el error de `localStorage.setItem` y retornar éxito falso en lugar de propagar la excepción hacia el catch general (escenario 9).
- **Comando reproducible**:
  ```bash
  sed -i 's/localStorage.setItem(key, value);/try { localStorage.setItem(key, value); } catch (_) { return { success: true, restored: entries.length }; }/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un error de cuota (QuotaExceededError) al escribir en storage durante importación, cuando ocurre, entonces captura el error y reporta fallo (29.312553ms)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    
    true !== false
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:326:16)
        at async Test.run (node:internal/test_runner/test:1389:7)
        at async Suite.processPendingSubtests (node:internal/test_runner/test:960:7) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: true,
      expected: false,
      operator: 'strictEqual',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Mutación 12: Rama de reseteo de valor en triggerImportPicker (`backup-engine.js:230`)
- **Descripción**: Omitir `inputEl.value = ''` antes del clic nativo en `triggerImportPicker` (escenario 10).
- **Comando reproducible**:
  ```bash
  sed -i 's/inputEl.value = '\'''\'';/\/\/ inputEl.value = '\'''\'';/' js/backup-engine.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un input file, cuando se invoca triggerImportPicker, entonces resetea el valor y dispara el click nativo (14.634844ms)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    + actual - expected
    
    + 'previous_path.labak'
    - ''
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/backup-engine.test.mjs:344:16)
        at Test.runInAsyncScope (node:async_hooks:226:14)
        at Test.run (node:internal/test_runner/test:1382:25)
        at Suite.processPendingSubtests (node:internal/test_runner/test:960:18) {
      generatedMessage: true,
      code: 'ERR_ASSERTION',
      actual: 'previous_path.labak',
      expected: '',
      operator: 'strictEqual',
      diff: 'simple'
    }
  ```
- **Reversión**: `git checkout -- js/backup-engine.js`
- **Confirmación diff producción**: `git diff -- js/backup-engine.js` → vacío.

### Resumen de mutación
12 mutantes ejecutados, 12 detectados y eliminados por la suite, 0 supervivientes.

## Comando para ejecutarlo
```bash
node --test tests/integration/backup-engine.test.mjs
```

## Revisión adversarial y flakiness (sesión 7)
- **Flakiness**: 3 ejecuciones consecutivas idénticas de `npm test` produjeron exactamente 135 tests, 116 pass, 0 fail, 19 todo (0 fallos intermitentes).
- **Riesgo de tests que pasarían con funcionalidad rota**: La verificación por mutación (12/12 mutantes detectados) probó inversión de validación de checksum, descompresión errónea, escritura prematura antes de validar, filtros de extensión, delegación a worker, caracteres multiocteto Unicode, inputs nulos, archivos vacíos, estructuras de envoltorio incompletas, fallos de cuota de disco y reseteo de pickers DOM. Las aserciones combinan `assert.match`, `assert.strictEqual` y verificación de espías sobre llamadas a `setItem`.
- **Mocks que ocultan problemas**: Se falsean los elementos del DOM (`<a>` y `<input type="file">`) y `URL.createObjectURL`. NO se falsea la compresión (`CompressionStream`/`DecompressionStream` gzip real de Node), NO se falsea el hash criptográfico (`crypto.subtle.digest` SHA-256 real de Node), NO se falsean las instancias nativas de `File`/`Blob` ni la codificación UTF-8 multiocteto.

## Estado
hecho (verificado por mutación y revisión adversarial)
