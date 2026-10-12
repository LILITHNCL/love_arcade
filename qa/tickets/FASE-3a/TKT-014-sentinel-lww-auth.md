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

## Mutaciones planeadas por rama (verificación en sesión 5)
1. **Rama de comparación de timestamps** (`sentinel.js:399`): invertir condición `cloudTime > localTime` a `cloudTime < localTime`. Falla escenario 1 (nube más reciente no se aplicaría).
2. **Rama de empate con diferencias** (`sentinel.js:399` o `405`): cambiar `cloudTime > localTime` por `cloudTime >= localTime`. En escenario 3 aplicaría la nube en vez de priorizar local.
3. **Rama de rehidratación en memoria** (`sentinel.js:240`, `_rehydrateHubStoreFromDisk`): omitir la llamada tras `_applySnapshot`. Falla escenario 1 (el store en memoria mantendría los datos antiguos).
4. **Rama de claves ausentes** (`sentinel.js:236`): borrar las claves ausentes mediante `localStorage.removeItem(key)`. Falla escenario 6 (destruiría claves locales ausentes en el snapshot).
5. **Rama de captura de errores** (`sentinel.js:415`): eliminar el bloque `catch` o re-lanzar error. Falla escenario 7 (rompería el flujo ante caída de red).
6. **Rama de condición de nube vacía** (`sentinel.js:405`): eliminar `!hasCloudSnapshot`. Afecta escenario 5 (no contemplaría cuentas nuevas).

## Comando para ejecutarlo
```bash
node --test tests/integration/sentinel-lww-auth.test.mjs
```

## Estado
hecho
