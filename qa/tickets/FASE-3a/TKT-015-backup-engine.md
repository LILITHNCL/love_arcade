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

## Mutaciones planeadas por rama (verificación en sesión 5)
1. **Rama de validación de checksum** (`backup-engine.js:209`): cambiar `payload.checksum !== expected` por `false`. El test de checksum alterado fallará al aceptar un archivo inválido.
2. **Rama de orden de escritura** (`backup-engine.js:213-218`): mover el bucle `localStorage.setItem` antes de la verificación de checksum. El test de checksum alterado fallará al detectar llamadas en `setItemLog`.
3. **Rama de validación de extensión** (`backup-engine.js:185`): eliminar la validación de extensiones `.labak` y `.labak.gz`. El test de extensión no autorizada fallará.
4. **Rama de descompresión gzip** (`backup-engine.js:194`): sustituir `_fromGzipBlob` por lectura de texto plano sin descomprimir. Los tests de importación fallarán con error de descompresión.
5. **Rama de notificación de eventos** (`backup-engine.js:46, 131, 175`): omitir llamadas a `_emitStatus` / `notify`. Los tests de eventos de estado fallarán por falta de eventos emitidos.

## Comando para ejecutarlo
```bash
node --test tests/integration/backup-engine.test.mjs
```

## Estado
hecho
