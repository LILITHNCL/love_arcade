# TKT-024: Multipestaña, concurrencia y tolerancia a fallos en Sentinel (#26, P1)

- **ID y título**: TKT-024: Multipestaña, concurrencia y resiliencia ante snapshots anómalos en Sentinel
- **Fase**: F5 (Edge cases)
- **Prioridad**: P1
- **Dependencias**: `js/core/state-store.js`, `js/cloud/sentinel.js`, `js/domain/game-center.js`, `tests/helpers/fake-supabase.cjs`, sandbox VM (`tests/helpers/vm-sandbox.cjs`).

## Riesgo que cubre

| Riesgo | Escenario | Error que detecta | Rutas reales |
|---|---|---|---|
| Crash o estado inconsistente por evento `storage` anómalo | Otra pestaña o extensión despacha un evento `storage` con `newValue = null`, clave ajena al juego o contenido JSON corrupto | `sentinel.js:467-479` invoca `_rehydrateHubStoreFromDisk()`. Si el evento no valida el origen de la clave o si el contenido es inválido, puede disparar excepciones no capturadas o dejar el store en un estado roto | `js/cloud/sentinel.js:245-255, 464-480` |
| Desincronización en memoria entre dos instancias locales | Dos pestañas abiertas comparten el mismo `localStorage`. La pestaña A actualiza monedas y la pestaña B debe rehidratar su store | Pérdida de sincronía entre el almacenamiento físico y la memoria viva del juego al operar en simultáneo | `js/core/state-store.js:52-82` y `js/cloud/sentinel.js:467-474` |
| Pérdida de mutaciones durante el inicio de sesión | El usuario interactúa y modifica una clave vigilada mientras `_handleAuthChange` está pausado esperando a Supabase | `_markWatchedKeyDirty` aborta silenciosamente si `_isRestoringSession` está en `true` (`sentinel.js:434`), provocando que las modificaciones realizadas durante la resolución de red no se marquen como pendientes ni se suban a la nube | `js/cloud/sentinel.js:348-424, 433-438` |
| Carrera de datos entre `completeLevel` y `_sentinelSync` | Un minijuego llama a `completeLevel` con sincronización inmediata mientras Sentinel tiene una petición de subida en vuelo | Colisión en la secuencia de peticiones a Supabase que podría sobrescribir el progreso recién completado con un snapshot anterior | `js/domain/game-center.js:16-24` y `js/cloud/sentinel.js:760-800` |
| Snapshot de nube deforme o con tipos erróneos | La nube devuelve un `game_data` con claves omitidas o con tipos inesperados (números en vez de strings JSON serializados) | `_applySnapshot` escribe ciegamente en `localStorage` y `_rehydrateHubStoreFromDisk` falla al parsear o migrar el estado | `js/cloud/sentinel.js:233-255` |

## Tipo de test y herramienta

Test de integración asíncrona determinista con `node:test` y `node:assert/strict`, orquestado mediante promesas controladas (deferred promises) en `fake-supabase.cjs` y despacho síncrono de eventos DOM sobre sandbox `node:vm`.

## Archivos a crear/modificar

- Archivo de test: `tests/integration/concurrency-multitab.test.mjs` (a crear en implementación).
- Helper de testing: `tests/helpers/fake-supabase.cjs` y `tests/helpers/vm-sandbox.cjs`.
- Documentación: `qa/tickets/FASE-5/TKT-024-multipestana-concurrencia.md` y `qa/tickets/FASE-5/PLAN-F5.md`.

## Escenarios concretos (dado → cuando → entonces)

1. **Evento `storage` con clave nula o ajena**:
   - *Dado*: Sentinel inicializado con su listener de `storage` registrado en `window`.
   - *Cuando*: se despacha un evento `storage` con `event.key = null` (ej. `localStorage.clear()` en otra ventana) o `event.key = 'otra_aplicacion_token'`.
   - *Entonces*: Sentinel lo descarta de inmediato sin ejecutar `_rehydrateHubStoreFromDisk()` y sin lanzar excepciones.

2. **Evento `storage` con clave del juego y JSON corrupto**:
   - *Dado*: una clave vigilada como `window.CONFIG.stateKey` actualizada en otra pestaña con un payload JSON roto (ej. `'{"coins":'`).
   - *Cuando*: se despacha el evento `storage`.
   - *Entonces*: `_rehydrateHubStoreFromDisk()` captura el error en su bloque `try/catch` de forma controlada, preservando la estabilidad de la aplicación local.

3. **Sincronización cruzada entre dos instancias de Store**:
   - *Dado*: dos contextos VM (Pestaña 1 y Pestaña 2) compartiendo la misma instancia subyacente de `localStorage` emulado.
   - *Cuando*: la Pestaña 1 añade monedas mediante `Economy.addCoins(50)` y se despacha el evento `storage` hacia la Pestaña 2.
   - *Entonces*: la Pestaña 2 rehidrata su estado desde el disco y su `LoveArcadeStore.getStore().coins` refleja exactamente el nuevo saldo.

4. **Escritura a clave vigilada durante `_handleAuthChange`**:
   - *Dado*: Sentinel ejecutando `_handleAuthChange` pausado en la consulta `select` de Supabase mediante una promesa no resuelta en `fake-supabase.cjs` (`_isRestoringSession === true`).
   - *Cuando*: en ese instante la aplicación escribe una clave vigilada mediante `localStorage.setItem('gamecenter_v6_promos', ...)`.
   - *Entonces*: se valida si `_markWatchedKeyDirty` descarta el cambio o si el sistema asegura que al finalizar `_handleAuthChange` (`finally { _isRestoringSession = false; }`) los cambios producidos durante la espera sean programados para sincronización. Si se descartan silenciosamente, se asienta la aserción esperada con `{ todo: 'BUG-F5-04: escrituras locales ocurridas durante _handleAuthChange son descartadas por _markWatchedKeyDirty' }`.

5. **`completeLevel` concurrente con `_sentinelSync`**:
   - *Dado*: una sincronización `_sentinelSync` en curso hacia Supabase.
   - *Cuando*: se completa un nivel con `GameCenter.completeLevel('laberinto', 'nivel_1', 20)` (que solicita `immediateCloudSync: true`).
   - *Entonces*: la subida en vuelo finaliza y la solicitud inmediata se encadena o despacha de forma secuencial, garantizando que el snapshot final en Supabase contenga el nivel completado.

6. **Snapshot remoto con claves ausentes o datos malformados**:
   - *Dado*: una respuesta de Supabase cuyo `game_data` carece de `CONFIG.stateKey`, o cuyo valor para dicha clave es un número entero `12345` o un objeto no serializado.
   - *Cuando*: Sentinel aplica el snapshot mediante `_applySnapshot(effectiveData)`.
   - *Entonces*: el sistema tolera la ausencia o el tipo inválido y `LoveArcadeStore.migrate` rehidrata el estado aplicando valores predeterminados sin lanzar excepciones fatales.

## Datos/fixtures y qué NO se mockea

- **Qué NO se mockea**:
  - Código real de `js/cloud/sentinel.js`, `js/core/state-store.js`, `js/domain/game-center.js`, `js/domain/economy.js`.
  - Mecanismos de eventos DOM (`Event`, `CustomEvent`).
- **Qué se falsea**:
  - Cliente Supabase: `fake-supabase.cjs` configurado para controlar de forma determinista la resolución de promesas (pausar, reanudar o rechazar) sin usar retardos fijos por tiempo.
  - Almacenamiento: Instancia compartida de `localStorage` falso en memoria conectada entre dos contextos virtuales.

## Criterios de aceptación verificables

- [x] Tolerancia completa demostrada ante eventos `storage` malformados o de claves foráneas.
- [x] Concurrencia entre promesas y escrituras de almacenamiento probada de forma determinista sin `sleep` fijos.
- [x] Verificación de que la aplicación no sufre regresiones ante snapshots incompletos o con tipos erróneos desde la nube.

## Comando para ejecutarlo

```bash
node --test tests/integration/concurrency-multitab.test.mjs
```

## Verificación por mutación

- **Mutación 1 (quitar try/catch en `_rehydrateHubStoreFromDisk()`, `js/cloud/sentinel.js:246`)**: Al despachar un evento `storage` con JSON corrupto (`'{"coins": 340, "inventory":'`), `JSON.parse` lanzó `SyntaxError: Unexpected end of JSON input` no capturado, provocando fallo de aserción (`AssertionError [ERR_ASSERTION]: Got unwanted exception: Debe capturar SyntaxError al rehidratar JSON corrupto sin propagar excepción`). 1 test falló. Revertido limpiamente (`git diff` vacío).
- **Mutación 2 (quitar guarda de claves ausentes y null en `_applySnapshot()`, `js/cloud/sentinel.js:236`)**: Se eliminó `if (Object.prototype.hasOwnProperty.call(snap, key) && snap[key] !== null)`. Al aplicar snapshots incompletos o con claves null, las claves locales fueron pisadas con `'undefined'` y `null`. 2 tests fallaron (`AssertionError: 'undefined' !== '[1, 2]'` y `TypeError: Cannot read properties of null`). Revertido limpiamente (`git diff` vacío).
- **Mutación 3 (alterar orden de aplicación en `_applySnapshot()`, `js/cloud/sentinel.js:233`)**: Se ejecutó `_rehydrateHubStoreFromDisk()` antes de persistir las claves del snapshot en `localStorage`. La rehidratación leyó el estado antiguo antes de aplicar los datos remotos. 2 tests fallaron (`AssertionError: 100 !== 650` y `AssertionError: 50 !== 500`). Revertido limpiamente (`git diff` vacío).

## Estado

hecho

