# TKT-016: Auditoría de immediateCloudSync

- **ID y título**: TKT-016 — Auditoría de `immediateCloudSync` (`Store.save` vs `SentinelCloudSync` vs módulos de dominio)
- **Fase**: F3a (P1, hueco heredado de F2b/F2d)
- **Prioridad**: P1
- **Dependencias**: `js/core/config.js`, `js/core/state-store.js`, `js/cloud/sentinel.js`, módulos de dominio (`js/domain/economy.js`, `js/domain/moon-blessing.js`, `js/domain/promo-codes.js`, `js/domain/game-center.js`), sandbox VM (`tests/helpers/vm-sandbox.cjs`) y helper Supabase (`tests/helpers/fake-supabase.cjs`).

## Riesgo que cubre
| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Desincronización silenciosa en nube ante compras | Jugador compra artículo en tienda (`buyItem`) y cierra app antes del debounce de 1000 ms | Si `immediateCloudSync: true` se elimina o ignora, las compras no se suben de inmediato a Supabase | `js/domain/economy.js:32`, `js/cloud/sentinel.js:714-730,756` |
| Pérdida de saldo ante gastos directos de monedas | Jugador gasta monedas (`spendCoins`) | Saldo en la nube queda desactualizado permitiendo doble gasto en otros dispositivos | `js/domain/economy.js:43`, `js/cloud/sentinel.js:714-730` |
| Pérdida de recompensas e ingresos directos | Jugador recibe monedas (`addCoins`) o completa nivel (`completeLevel`) | Recompensas no se reflejan en la nube de forma inmediata ante salidas prematuras | `js/domain/economy.js:53`, `js/domain/game-center.js:22` |
| Desincronización de beneficios activos | Jugador extiende días de Bendición Lunar (`extendMoonBlessingDays`) | La expiración del beneficio no se actualiza inmediatamente en el perfil remoto | `js/domain/moon-blessing.js:46`, `js/cloud/sentinel.js:714-730` |
| Inconsistencia de sincronización en compras de bendición | Jugador adquiere Bendición Lunar (`buyMoonBlessing`) | Guarda con `Store.save()` sin flag inmediato; no sube a la nube hasta expirar debounce (1000 ms) | `js/domain/moon-blessing.js:32` |
| Inconsistencia de sincronización en canje de códigos | Jugador canjea código promocional (`redeemPromoCode`) | Guarda con `Store.save()` sin flag inmediato; monedas y hashes quedan pendientes en storage local | `js/domain/promo-codes.js:61` |
| Inconsistencia de sincronización en restauración | Jugador importa código de guardado (`importSave`) | Guarda con `Store.save()` sin flag inmediato; perfil restaurado no se sube de inmediato a la nube | `js/domain/game-center.js:59` |
| Aborto silencioso en cola de reintento offline (BUG-F3a-02) | Acción con flag inmediato en usuario desconectado; al iniciar sesión `_sentinelSync` se aborta por `_isRestoringSession` | Pierde la sincronización pendiente de acciones offline al autenticarse | `js/cloud/sentinel.js:413,419,263,763-765` |

## Tipo y herramienta
Test de integración con `node:test` y `node:assert/strict`, ejecutado en el sandbox de VM del proyecto con Supabase falso en memoria y carga completa de módulos de dominio.

## Archivos
- Modificar helper: `tests/helpers/fake-supabase.cjs` (soporte para shims de `requestIdleCallback`, `btoa`, `atob` y opción `loadDomainModules`).
- Crear suite de tests: `tests/integration/immediate-cloud-sync.test.mjs`.
- Documentación: `qa/tickets/FASE-3a/TKT-000-indice.md`, `qa/99-huecos.md`, este ticket.
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)
1. **Mecanismo core con flag inmediato**: sesión activa → `Store.save({ immediateCloudSync: true })` → ejecuta upsert inmediato a Supabase en ciclo idle/macrotask (`upsertLog.length === initial + 1`), actualiza `love_arcade_sentinel_ts` y emite evento `la:synced` con `source: 'sentinel-upsert'`.
2. **Mecanismo core sin flag (debounced)**: sesión activa → `Store.save()` normal → NO sube de inmediato (`upsertLog.length === initial`), pero persiste en `localStorage` y sube ante evento de salida (`beforeunload`).
3. **Economía · `buyItem`**: compra con saldo suficiente → deduce monedas, aplica 10% de cashback (+15 monedas en compra de 150), agrega ítem a inventario y sube snapshot a Supabase inmediatamente con saldo 365 e inventario actualizado.
4. **Economía · `spendCoins`**: gasto directo de 75 monedas → deduce saldo y ejecuta subida inmediata a Supabase con saldo 125.
5. **Economía · `addCoins`**: depósito de 300 monedas → incrementa saldo y ejecuta subida inmediata a Supabase con saldo 350.
6. **Bendición Lunar · `extendMoonBlessingDays`**: extensión de 5 días → actualiza timestamp de caducidad en buffs y ejecuta subida inmediata a Supabase.
7. **Bendición Lunar · `buyMoonBlessing` (inconsistencia)**: compra de bendición por 100 monedas → muta estado local pero NO sincroniza inmediatamente (guarda con `Store.save()` sin flag; sincronización diferida por debounce / `beforeunload`).
8. **Promociones · `redeemPromoCode` (inconsistencia)**: canje de código válido → suma 200 monedas localmente pero NO sincroniza inmediatamente (guarda sin flag; sincronización diferida).
9. **Respaldo · `importSave` (inconsistencia)**: importación de código de guardado → restaura saldo y progreso localmente pero NO sincroniza inmediatamente (guarda sin flag; sincronización diferida).
10. **Minijuegos · `completeLevel`**: completa nivel nuevo en minijuego → acredita 50 monedas, registra nivel en progreso y sube inmediatamente a Supabase.
11. **Cola offline / pre-login (BUG-F3a-02)**: usuario sin sesión ejecuta acción con flag inmediato → encola reintento; al iniciar sesión debería procesar la sincronización pendiente (bloqueado por BUG-F3a-02; marcado con `todo`).

## Qué NO se mockea
- Se ejecutan los módulos reales de dominio (`state-store.js`, `economy.js`, `moon-blessing.js`, `promo-codes.js`, `game-center.js`, `sentinel.js`).
- Se ejecutan los algoritmos reales de SHA-256 (`crypto.subtle`) para promociones y validación de guardados.
- Se falsea la red (`fetch` a `/api/client-config`), el backend de Supabase (tablas y auth en memoria) y eventos del navegador.

## Criterios de aceptación
- [x] `Store.save({ immediateCloudSync: true })` dispara upsert inmediato a Supabase sin esperar debounce.
- [x] `Store.save()` estándar no sube de inmediato a Supabase antes de la expiración del debounce.
- [x] Operaciones de economía (`buyItem`, `spendCoins`, `addCoins`) sincronizan inmediatamente en la nube.
- [x] `extendMoonBlessingDays` y `completeLevel` sincronizan inmediatamente en la nube.
- [x] Inconsistencia comprobada por comportamiento: `buyMoonBlessing`, `redeemPromoCode` e `importSave` guardan sin flag y no sincronizan de inmediato (sincronizan diferidamente tras debounce / beforeunload).
- [x] Cola de reintento offline al iniciar sesión documentada bajo BUG-F3a-02 con test `todo`.

## Verificación por mutación (P1)
Se ejecutaron 7 mutaciones reproducibles cubriendo todas las ramas de propagación del flag, suscripción en Sentinel, despacho inmediato y módulos de dominio en producción.

### Mutación 1: Rama de propagación de flag en `state-store.js:140`
- **Descripción**: Forzar `immediateCloudSync = false` en `LoveArcadeStore.save`, anulando la propagación del flag hacia los suscriptores.
- **Comando reproducible**:
  ```bash
  sed -i 's/const { immediateCloudSync = false } = options;/const immediateCloudSync = false;/' js/core/state-store.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado una sesión activa, cuando se guarda con immediateCloudSync: true, entonces sube a Supabase inmediatamente y emite la:synced (118.643177ms)
    AssertionError [ERR_ASSERTION]: Debe ejecutar un upsert inmediato en Supabase
    
    0 !== 1
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/immediate-cloud-sync.test.mjs:45:20)
  ```
- **Reversión**: `git checkout -- js/core/state-store.js`
- **Confirmación diff producción**: `git diff -- js/core/state-store.js` → vacío.

### Mutación 2: Rama de suscripción al Store en Sentinel (`sentinel.js:768`)
- **Descripción**: Omitir la invocación de `_scheduleCloudSync(immediateCloudSync)` dentro del callback de suscripción a `window.LoveArcadeStore`.
- **Comando reproducible**:
  ```bash
  sed -i 's/if (source === '\''save'\'' && notifyCloud) _scheduleCloudSync(immediateCloudSync);/\/\/ if (source === '\''save'\'' && notifyCloud) _scheduleCloudSync(immediateCloudSync);/' js/cloud/sentinel.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado una sesión activa, cuando se guarda con immediateCloudSync: true, entonces sube a Supabase inmediatamente y emite la:synced (116.520573ms)
    AssertionError [ERR_ASSERTION]: Debe ejecutar un upsert inmediato en Supabase
    
    0 !== 1
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/immediate-cloud-sync.test.mjs:45:20)
  ```
- **Reversión**: `git checkout -- js/cloud/sentinel.js`
- **Confirmación diff producción**: `git diff -- js/cloud/sentinel.js` → vacío.

### Mutación 3: Rama de sincronización inmediata en Sentinel (`sentinel.js:756`)
- **Descripción**: Desactivar la rama inmediata en `_syncCloudIfNeeded`, forzando que todas las sincronizaciones esperen el debounce estándar.
- **Comando reproducible**:
  ```bash
  sed -i 's/if (immediate && sentinel.syncNow) sentinel.syncNow();/if (false) sentinel.syncNow();/' js/cloud/sentinel.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado una sesión activa, cuando se guarda con immediateCloudSync: true, entonces sube a Supabase inmediatamente y emite la:synced (126.201771ms)
    AssertionError [ERR_ASSERTION]: Debe ejecutar un upsert inmediato en Supabase
    
    0 !== 1
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/immediate-cloud-sync.test.mjs:45:20)
  ```
- **Reversión**: `git checkout -- js/cloud/sentinel.js`
- **Confirmación diff producción**: `git diff -- js/cloud/sentinel.js` → vacío.

### Mutación 4: Rama de guardado inmediato en compra de artículo (`economy.js:32`)
- **Descripción**: Quitar el flag `{ immediateCloudSync: true }` en `buyItem`, guardando con `Store.save()`.
- **Comando reproducible**:
  ```bash
  sed -i '32s/{ immediateCloudSync: true }/{}/' js/domain/economy.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado compra en tienda (buyItem), cuando se ejecuta, entonces deduce monedas, agrega item y sincroniza inmediatamente (95.401458ms)
    AssertionError [ERR_ASSERTION]: buyItem debe disparar sincronización inmediata
    
    0 !== 1
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/immediate-cloud-sync.test.mjs:139:20)
  ```
- **Reversión**: `git checkout -- js/domain/economy.js`
- **Confirmación diff producción**: `git diff -- js/domain/economy.js` → vacío.

### Mutación 5: Rama de guardado inmediato en gasto de monedas (`economy.js:43`)
- **Descripción**: Quitar el flag `{ immediateCloudSync: true }` en `spendCoins`, guardando con `Store.save()`.
- **Comando reproducible**:
  ```bash
  sed -i '43s/{ immediateCloudSync: true }/{}/' js/domain/economy.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado gasto de monedas (spendCoins), cuando se ejecuta, entonces deduce saldo y sincroniza inmediatamente (64.403541ms)
    AssertionError [ERR_ASSERTION]: spendCoins debe disparar sincronización inmediata
    
    0 !== 1
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/immediate-cloud-sync.test.mjs:172:20)
  ```
- **Reversión**: `git checkout -- js/domain/economy.js`
- **Confirmación diff producción**: `git diff -- js/domain/economy.js` → vacío.

### Mutación 6: Rama de guardado inmediato en extensión de Bendición Lunar (`moon-blessing.js:46`)
- **Descripción**: Quitar el flag `{ immediateCloudSync: true }` en `extendMoonBlessingDays`, guardando con `Store.save()`.
- **Comando reproducible**:
  ```bash
  sed -i '46s/{ immediateCloudSync: true }/{}/' js/domain/moon-blessing.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado extendMoonBlessingDays, cuando se invoca, entonces extiende la expiración y sincroniza inmediatamente (84.3275ms)
    AssertionError [ERR_ASSERTION]: extendMoonBlessingDays debe disparar sincronización inmediata
    
    0 !== 1
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/immediate-cloud-sync.test.mjs:236:20)
  ```
- **Reversión**: `git checkout -- js/domain/moon-blessing.js`
- **Confirmación diff producción**: `git diff -- js/domain/moon-blessing.js` → vacío.

### Mutación 7: Rama de guardado inmediato en compleción de nivel (`game-center.js:22`)
- **Descripción**: Quitar el flag `{ immediateCloudSync: true }` en `completeLevel`, guardando con `Store.save()`.
- **Comando reproducible**:
  ```bash
  sed -i '22s/{ immediateCloudSync: true }/{}/' js/domain/game-center.js
  ```
- **Salida real del test que falla**:
  ```
  ✖ dado completeLevel en GameCenter, cuando se completa nivel nuevo, entonces acredita recompensa y sincroniza inmediatamente (83.973437ms)
    AssertionError [ERR_ASSERTION]: completeLevel debe disparar sincronización inmediata
    
    0 !== 1
    
        at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/integration/immediate-cloud-sync.test.mjs:405:20)
  ```
- **Reversión**: `git checkout -- js/domain/game-center.js`
- **Confirmación diff producción**: `git diff -- js/domain/game-center.js` → vacío.

### Resumen de mutación
7 mutantes ejecutados, 7 detectados y eliminados por la suite, 0 supervivientes.

## Comando para ejecutarlo
```bash
node --test tests/integration/immediate-cloud-sync.test.mjs
```

## Estado
hecho
