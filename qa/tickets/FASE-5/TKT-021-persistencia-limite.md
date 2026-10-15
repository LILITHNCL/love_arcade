# TKT-021: Persistencia al límite (#26, P0)

- **ID y título**: TKT-021: Persistencia al límite — cuota multiravegador, saneamiento de raíz, podado preventivo de 4 MB y fallos de persistencia
- **Fase**: F5 (Edge cases)
- **Prioridad**: P0
- **Dependencias**: `js/core/config.js`, `js/core/state-store.js`, `js/domain/economy.js`, `js/core/time-sync.js`, helper de sandbox VM (`tests/helpers/vm-sandbox.cjs`).

## Riesgo que cubre

| Riesgo | Escenario | Error que detecta | Rutas reales |
|---|---|---|---|
| Incompatibilidad de cuota en navegadores no-Chromium (R6) | El navegador lanza `NS_ERROR_DOM_QUOTA_REACHED` (`code: 1014`) al exceder cuota de disco en `localStorage.setItem` | `js/core/state-store.js:149` solo comprueba `error?.name !== 'QuotaExceededError'`, relanzando la excepción y provocando un crash no controlado sin ejecutar `emergencyCleanup()` ni notificar al usuario | `js/core/state-store.js:148-164` |
| Contaminación de estado por entrada raíz anómala en migración | `localStorage` contiene valores válidos en JSON pero no-objetos (`null`, `[1, 2]`, `42`, `"cadena"`) | `migrate(loadedStore)` ejecuta `{ ...defaults, ...loadedStore }`, lo que en arrays o strings introduce claves numéricas espurias (`'0'`, `'1'`) que se propagan al guardar | `js/core/state-store.js:14-50` |
| Desbordamiento de almacenamiento (~4 MB) | El estado del jugador supera los 4000 KB debido a avance prolongado o avatares pesados | La función `save()` no ejecuta `trimGameProgress()` a tiempo ni emite la advertencia visual (`showStorageToast`) ni registra la métrica preventiva de analítica | `js/core/state-store.js:11, 123-145` |
| Inconsistencia transaccional de `buyItem` ante fallo de cuota | Se realiza una compra en `Economy.buyItem`, se deducen monedas en memoria y se registra en historial, pero `Store.save()` falla por cuota irrecuperable | `buyItem` no implementa `try/catch` para revertir la deducción en memoria, devolviendo éxito de compra con un saldo local no sincronizado con el disco | `js/domain/economy.js:7-34` y `js/core/state-store.js:148-164` |
| Fallo silencioso en escritura de caché de tiempo | `localStorage` está lleno y `Time._writeTimeCache` intenta guardar la estimación de red | Se debe verificar que el bloque `try/catch` de `_writeTimeCache` degrade de forma segura sin romper la aplicación y que `_readTimeCache` reporte `verified: false` | `js/core/time-sync.js:33-41, 70-88` |

## Tipo de test y herramienta

Test unitario y de frontera con `node:test` y `node:assert/strict`, utilizando sandbox `node:vm` con emulación controlada de `localStorage` capaz de simular excepciones de cuota específicas y contadores de tamaño de payload.

## Archivos a crear/modificar

- Archivo de test: `tests/core/storage-limits.test.mjs` (a crear en implementación).
- Helper de testing: `tests/helpers/vm-sandbox.cjs` (reutilización).
- Documentación: `qa/tickets/FASE-5/TKT-021-persistencia-limite.md` y `qa/tickets/FASE-5/PLAN-F5.md`.

## Escenarios concretos (dado → cuando → entonces)

1. **Cuota en Firefox / estándares DOM (`NS_ERROR_DOM_QUOTA_REACHED`)**:
   - *Dado*: un entorno de almacenamiento donde `localStorage.setItem` lanza una excepción con `name = 'NS_ERROR_DOM_QUOTA_REACHED'` y `code = 1014`.
   - *Cuando*: se invoca `LoveArcadeStore.save()`.
   - *Entonces*: el sistema reconoce la excepción como cuota, ejecuta `emergencyCleanup()` y reintenta el guardado. Si la implementación actual relanza el error por comprobar solo `QuotaExceededError`, se documenta con `{ todo: 'BUG-F5-01: Store.save solo captura QuotaExceededError e ignora NS_ERROR_DOM_QUOTA_REACHED (Firefox)' }`.

2. **Migración con raíz `null`, número y booleano**:
   - *Dado*: un payload recuperado de almacenamiento que contiene `null`, el número `42` o el booleano `false`.
   - *Cuando*: se ejecuta `LoveArcadeStore.migrate(loadedStore)`.
   - *Entonces*: retorna exactamente el objeto con los valores predeterminados (`defaults`) sin lanzar excepción y sin añadir propiedades no deseadas.

3. **Migración con raíz array o string (sin claves espurias)**:
   - *Dado*: un payload recuperado de almacenamiento que contiene un array `["progreso_invalido", 123]` o una cadena `"guardado_corrupto"`.
   - *Cuando*: se ejecuta `LoveArcadeStore.migrate(loadedStore)`.
   - *Entonces*: la función debe sanear la estructura devolviendo los valores predeterminados sin propagar claves numéricas como `'0'`, `'1'` generadas por el spread operator. (Si el código actual propaga índices numéricos, se asienta la aserción deseada bajo `{ todo }`).

4. **Almacenamiento al límite (~4 MB) y advertencia visual**:
   - *Dado*: un store inflado con datos que sobrepasan 4000 KB (ej. listas de progreso extensas).
   - *Cuando*: se invoca `LoveArcadeStore.save()`.
   - *Entonces*: `trimGameProgress()` recorta las entradas de niveles a un máximo de 50 por juego, se emite una notificación de advertencia mediante `showStorageToast` con tipo `'warning'`, y se dispara el evento `GhostAnalytics.track('storage_warning', ...)`.

5. **Transacción en `buyItem` con fallo irrecuperable de cuota**:
   - *Dado*: un saldo de 1000 monedas y una llamada a `Economy.buyItem(itemData)` con precio de 200 monedas, en un entorno donde `Store.save()` falla por cuota irrecuperable tras el cleanup.
   - *Cuando*: se procesa la compra.
   - *Entonces*: se valida si el estado en memoria revierte la deducción de monedas o si se notifica de forma controlada el fallo de persistencia sin corromper el saldo respecto al disco.

6. **Resiliencia de `_writeTimeCache` ante cuota**:
   - *Dado*: `localStorage` agotado donde `localStorage.setItem` lanza error de cuota.
   - *Cuando*: `Time._writeTimeCache({ drift: 0, desynced: false })` intenta persistir los datos de sincronización horaria.
   - *Entonces*: la excepción es capturada silenciosamente sin detener la ejecución y posteriores llamadas a `Time._readTimeCache()` retornan de forma segura `verified: false`.

## Datos/fixtures y qué NO se mockea

- **Qué NO se mockea**:
  - Código real de `js/core/state-store.js`, `js/domain/economy.js`, `js/domain/history.js`, `js/core/time-sync.js`.
  - Mecanismos reales de serialización (`JSON.stringify`, `JSON.parse`).
- **Qué se falsea**:
  - `localStorage`: Almacén en memoria emulado mediante Map, con inyectores de fallos configurables para simular `QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`, `code: 1014`, o bloqueos selectivos por tamaño.
  - `GhostAnalytics`: Espía ligero en memoria para capturar llamadas a `track`.

## Criterios de aceptación verificables

- [ ] Todos los escenarios de cuota estándar y no-Chromium son evaluados de forma determinista.
- [ ] La migración de estados con tipos raíz incompatibles (`null`, array, número, booleano, string) no introduce claves ajenas a los defaults.
- [ ] La condición de podado y advertencia en ~4 MB es verificada mediante aserciones sobre `store.progress` y la llamada a `showStorageToast`.
- [ ] Discrepancias identificadas en código de producción quedan cubiertas con tests asertando el comportamiento seguro bajo `{ todo }`.

## Comando para ejecutarlo

```bash
node --test tests/core/storage-limits.test.mjs
```

## Estado

pendiente
