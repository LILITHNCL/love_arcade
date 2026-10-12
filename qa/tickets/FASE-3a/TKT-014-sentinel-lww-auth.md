# TKT-014: Sentinel - Last-Write-Wins al iniciar sesión

- **ID y título**: TKT-014 — Sentinel: Last-Write-Wins al iniciar sesión (`_handleAuthChange` / LWW / snapshot merge)
- **Fase**: F3a (matriz de cobertura #14, riesgo R7)
- **Prioridad**: P1
- **Dependencias**: `js/core/config.js`, `js/core/state-store.js`, `js/cloud/sentinel.js`, sandbox VM (`tests/helpers/vm-sandbox.cjs`), helper Supabase en memoria (`tests/helpers/fake-supabase.cjs`).

## Riesgo que cubre
| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Pérdida de progreso en nube más reciente | Nube con timestamp posterior al local | No descarga el snapshot remoto, no rehidrata el store en memoria ni actualiza `love_arcade_sentinel_ts` | `js/cloud/sentinel.js:399-404,240-250` |
| Sobreescritura de progreso local más reciente | Local con timestamp posterior a la nube | Aplica la nube obsoleta o no sube el snapshot local a Supabase | `js/cloud/sentinel.js:405-407,262-282` |
| Conflicto de estados en empate temporal | Mismo timestamp pero snapshots con datos divergentes | Descarta cambios locales o no resuelve la discrepancia subiendo el estado local | `js/cloud/sentinel.js:405-407` |
| Pérdida de progreso inicial en cuentas nuevas | Usuario con datos locales e inicio de sesión con nube vacía | No detecta perfil remoto vacío y omite la subida inicial del progreso local | `js/cloud/sentinel.js:405-407` |
| Pérdida de partidas locales ante claves ausentes | Snapshot remoto sin ciertas claves vigiladas locales | Borra destructivamente claves locales no presentes en el snapshot remoto | `js/cloud/sentinel.js:233-243` |
| Pérdida de datos por relojes desfasados (R7) | Reloj local atrasado o reloj de otro dispositivo adelantado | LWW ciego basado en timestamps de cliente destruye progreso local más avanzado | `js/cloud/sentinel.js:399-404` |
| Corrupción de estado ante fallo de conexión | Error de red o fallo de Supabase al consultar el perfil | Lanza excepción no capturada o corrompe el estado local en memoria / storage | `js/cloud/sentinel.js:415-423` |

## Tipo y herramienta
Test de integración con `node:test` y `node:assert/strict`, ejecutado en el sandbox de VM del proyecto con Supabase falso en memoria.

## Archivos
- Modificar: `tests/helpers/fake-supabase.cjs` (soporte `initialStorage`, aliasing de `LoveArcadeStore`, mock DOM).
- Crear: `tests/integration/sentinel-lww-auth.test.mjs`.
- Documentación: `qa/tickets/FASE-3a/TKT-000-indice.md`, `qa/BUGS-ENCONTRADOS.md`, este ticket.
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)
1. Nube más reciente → `cloudTime > localTime` → aplica snapshot remoto a `localStorage`, rehidrata `LoveArcadeStore` en memoria, actualiza timestamp local al de la nube, emite `la:cloudsynced` y no sube.
2. Local más reciente → `localTime > cloudTime` → debería subir snapshot local a Supabase (`upsertLog.length === 1`), conservar estado local y actualizar timestamp de subida. (Detectado bug de producto BUG-F3a-02 por guarda `_isRestoringSession`; marcado como `todo`).
3. Empate con diferencias → `localTime === cloudTime && snapshotsDiffer` → debería resolver a favor del estado local subiendo snapshot local a la nube. (Marcado como `todo` por BUG-F3a-02).
4. Empate sin diferencias → `localTime === cloudTime && !snapshotsDiffer` → estados idénticos; no realiza sincronizaciones redundantes ni modifica marcas.
5. Nube vacía → `hasLocalSnapshot && !hasCloudSnapshot` → debería subir snapshot local inicial para crear perfil en Supabase. (Marcado como `todo` por BUG-F3a-02).
6. Snapshot con claves ausentes → snapshot remoto sin clave local vigilada (ej. `MAREJIG_completedLevels_v1`) → `_applySnapshot` actualiza las claves presentes pero conserva intactas las claves locales ausentes en la nube (fusión selectiva observada).
7. Fallo de red/Supabase → `fakeSupabase.setSelectError` lanza error → captura el fallo sin lanzar, estado local en memoria y storage intacto, badge de estado en `'error'`.
8. Relojes desfasados (R7) → progreso local más avanzado pero timestamp local inferior por reloj desfasado → no debería sobreescribir destructivamente el progreso local más avanzado. (Marcado como `todo` BUG-F3a-01).

## Qué NO se mockea
- `LoveArcadeStore` (`state-store.js`), configuración de claves (`config.js`) y lógica completa de resolución de conflictos de `SentinelCloudSync` (`sentinel.js`).
- Se falsea la red (`fetch` a `/api/client-config`), el backend de Supabase (tablas y auth en memoria) y los eventos del navegador (`window`/`document`).

## Criterios de aceptación
- [x] Nube más reciente sobreescribe storage, rehidrata store en memoria y actualiza marca local.
- [x] Empate idéntico es idempotente sin subidas espurias.
- [x] Snapshot con claves ausentes es no destructivo respecto a claves locales vigiladas no mencionadas.
- [x] Fallo de red/Supabase se degrada elegantemente sin corromper almacenamiento local.
- [x] Escenarios de subida bloqueados por `_isRestoringSession` identificados y documentados en BUG-F3a-02 con tests `todo`.
- [x] Riesgo R7 (pérdida de progreso por LWW ante relojes desfasados) verificado y documentado en BUG-F3a-01 con test `todo`.

## Verificación por mutación (ejecutada en sesión 5)

Todas las mutaciones por rama fueron probadas de forma reproducible, verificando que los tests de `sentinel-lww-auth.test.mjs` detectan y hacen fallar cada mutante. En la mutación 2 se detectó inicialmente un hueco (la mutación sobrevivía porque el test de empate idéntico no comprobaba la ausencia del evento de descarga); se corrigió el test en commit independiente (`3cb1cac`) añadiendo la aserción correspondiente y se re-ejecutó la mutación haciéndola fallar limpiamente.

### Mutación 1: Rama de comparación de timestamps (`sentinel.js:399`)
- **Descripción**: Invertir la condición `cloudTime > localTime` por `cloudTime < localTime`. Un snapshot de nube más reciente no se aplicaría localmente.
- **Comando reproducible**:
  ```bash
  sed -i 's/cloudTime > localTime/cloudTime < localTime/' js/cloud/sentinel.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado una nube más reciente, cuando se inicia sesión, entonces aplica el snapshot remoto, rehidrata el store en memoria y actualiza la marca de tiempo local
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    100 !== 650
        actual: 100, expected: 650, operator: 'strictEqual'
  ✖ dado un snapshot de la nube más reciente con claves vigiladas ausentes, cuando se aplica, entonces actualiza las claves presentes pero conserva las claves locales ausentes (comportamiento observado)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    50 !== 500
        actual: 50, expected: 500, operator: 'strictEqual'
  ```
- **Reversión**: `git checkout -- js/cloud/sentinel.js`
- **Confirmación diff producción**: `git diff -- js/cloud/sentinel.js` → vacío.

### Mutación 2: Rama de comparación estricta vs empate (`sentinel.js:399`)
- **Descripción**: Cambiar `cloudTime > localTime` por `cloudTime >= localTime`. En caso de empate idéntico dispararía indebidamente `_applySnapshot` y emitiría `la:cloudsynced`.
- **Comando reproducible**:
  ```bash
  sed -i 's/cloudTime > localTime/cloudTime >= localTime/' js/cloud/sentinel.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un empate de marcas de tiempo con snapshots idénticos, cuando se inicia sesión, entonces no realiza sincronizaciones redundantes
    AssertionError [ERR_ASSERTION]: No debe emitir la:cloudsynced en empate idéntico
    true !== false
        actual: true, expected: false, operator: 'strictEqual'
  ```
- **Reversión**: `git checkout -- js/cloud/sentinel.js`
- **Confirmación diff producción**: `git diff -- js/cloud/sentinel.js` → vacío.

### Mutación 3: Rama de rehidratación en memoria del Hub (`sentinel.js:240`)
- **Descripción**: Omitir `_rehydrateHubStoreFromDisk()` tras aplicar un snapshot de la nube en `_applySnapshot`.
- **Comando reproducible**:
  ```bash
  sed -i 's/_rehydrateHubStoreFromDisk();/\/\/ _rehydrateHubStoreFromDisk();/' js/cloud/sentinel.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado una nube más reciente, cuando se inicia sesión, entonces aplica el snapshot remoto, rehidrata el store en memoria y actualiza la marca de tiempo local
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    100 !== 650
        actual: 100, expected: 650, operator: 'strictEqual'
  ✖ dado un snapshot de la nube más reciente con claves vigiladas ausentes, cuando se aplica, entonces actualiza las claves presentes pero conserva las claves locales ausentes (comportamiento observado)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    50 !== 500
        actual: 50, expected: 500, operator: 'strictEqual'
  ```
- **Reversión**: `git checkout -- js/cloud/sentinel.js`
- **Confirmación diff producción**: `git diff -- js/cloud/sentinel.js` → vacío.

### Mutación 4: Rama de preservación de claves ausentes (`sentinel.js:237-238`)
- **Descripción**: Eliminar claves locales ausentes en el snapshot remoto en lugar de realizar fusión conservadora (`else { _originalRemoveItem(key); }`).
- **Comando reproducible**:
  ```bash
  sed -i '/_originalSetItem(key, snap\[key\]);/{n;s/}/} else { _originalRemoveItem(key); }/}' js/cloud/sentinel.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un snapshot de la nube más reciente con claves vigiladas ausentes, cuando se aplica, entonces actualiza las claves presentes pero conserva las claves locales ausentes (comportamiento observado)
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    null !== '[1, 2]'
        actual: null, expected: '[1, 2]', operator: 'strictEqual'
  ```
- **Reversión**: `git checkout -- js/cloud/sentinel.js`
- **Confirmación diff producción**: `git diff -- js/cloud/sentinel.js` → vacío.

### Mutación 5: Rama de manejo de errores en inicio de sesión (`sentinel.js:415-416`)
- **Descripción**: Re-lanzar error en `_handleAuthChange` en vez de degradar elegantemente y marcar badge de `'error'`.
- **Comando reproducible**:
  ```bash
  sed -i "s/_setStatusBadge('error');/throw err; _setStatusBadge('error');/" js/cloud/sentinel.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado un fallo de red o error de Supabase al consultar el perfil durante el inicio de sesión, cuando ocurre, entonces no corrompe el estado local y marca estado de error
    Error: Network request failed
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/sentinel-lww-auth.test.mjs:250:41)
  ```
- **Reversión**: `git checkout -- js/cloud/sentinel.js`
- **Confirmación diff producción**: `git diff -- js/cloud/sentinel.js` → vacío.

### Mutación 6: Rama de actualización de timestamp local tras restaurar (`sentinel.js:401`)
- **Descripción**: Omitir `_originalSetItem(SENTINEL_TS_KEY, data.updated_at)` tras aplicar el snapshot remoto.
- **Comando reproducible**:
  ```bash
  sed -i 's/_originalSetItem(SENTINEL_TS_KEY, data.updated_at);/\/\/ _originalSetItem(SENTINEL_TS_KEY, data.updated_at);/' js/cloud/sentinel.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado una nube más reciente, cuando se inicia sesión, entonces aplica el snapshot remoto, rehidrata el store en memoria y actualiza la marca de tiempo local
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    + actual: '2026-10-12T10:00:00.000Z'
    - expected: '2026-10-12T12:00:00.000Z'
  ```
- **Reversión**: `git checkout -- js/cloud/sentinel.js`
- **Confirmación diff producción**: `git diff -- js/cloud/sentinel.js` → vacío.

### Mutación 7: Rama de emisión de evento la:cloudsynced (`sentinel.js:242`)
- **Descripción**: Omitir `document.dispatchEvent(new CustomEvent('la:cloudsynced' ...))` tras aplicar el snapshot remoto.
- **Comando reproducible**:
  ```bash
  sed -i "s/document.dispatchEvent(new CustomEvent('la:cloudsynced'/\/\/ document.dispatchEvent(new CustomEvent('la:cloudsynced'/" js/cloud/sentinel.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado una nube más reciente, cuando se inicia sesión, entonces aplica el snapshot remoto, rehidrata el store en memoria y actualiza la marca de tiempo local
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    false !== true
        actual: false, expected: true, operator: 'strictEqual'
  ```
- **Reversión**: `git checkout -- js/cloud/sentinel.js`
- **Confirmación diff producción**: `git diff -- js/cloud/sentinel.js` → vacío.

## Comando para ejecutarlo
```bash
node --test tests/integration/sentinel-lww-auth.test.mjs
```

## Revisión adversarial y flakiness (sesión 7)
- **Flakiness**: 3 ejecuciones consecutivas idénticas de `npm test` produjeron exactamente 135 tests, 116 pass, 0 fail, 19 todo (0 fallos intermitentes).
- **Riesgo de tests que pasarían con funcionalidad rota**: La verificación por mutación detectó y eliminó 7/7 mutantes. El hueco adversarial detectado inicialmente en sesión 5 (empate idéntico sobrevivía si no se asertaba la no emisión de `la:cloudsynced`) fue corregido con el commit `3cb1cac`, eliminando la mutación por comparación laxo `>=`.
- **Mocks que ocultan problemas**: Se falsea el cliente de Supabase (`fakeSupabase`), la red (`/api/client-config`) y los eventos del navegador. No se falsea la comparación ISO de fechas, la serialización JSON ni la rehidratación del Store en memoria. Se asumen respuestas inmediatas de Supabase; condiciones de carrera con concurrencia real entre pestañas quedan diferidas a Fase 5 (Edge cases).

## Estado
hecho (verificado por mutación y revisión adversarial)
