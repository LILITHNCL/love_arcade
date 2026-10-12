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

## Mutaciones planeadas por rama (verificación en sesión 5)
1. **Rama de propagación de flag en `state-store.js:140`**: cambiar `{ immediateCloudSync = false }` para forzar siempre `false`. Fallarán los tests de sincronización inmediata de economía y bendición lunar al no notificar el flag a Sentinel.
2. **Rama de suscripción en `sentinel.js:768`**: omitir la llamada `_scheduleCloudSync(immediateCloudSync)` en `LoveArcadeStore.subscribe`. Fallará la subida inmediata hacia Supabase en todas las operaciones.
3. **Rama de condición inmediata en `sentinel.js:756`**: cambiar `if (immediate && sentinel.syncNow)` por `if (false)`. Fallará la subida inmediata en idle/macrotask, postergando todas las escrituras al debounce.
4. **Rama de guardado en `economy.js:32`**: cambiar `Store.save({ immediateCloudSync: true })` por `Store.save()`. Fallará el test de subida inmediata de `buyItem`.
5. **Rama de guardado en `moon-blessing.js:46`**: cambiar `Store.save({ immediateCloudSync: true })` por `Store.save()`. Fallará el test de `extendMoonBlessingDays`.

## Comando para ejecutarlo
```bash
node --test tests/integration/immediate-cloud-sync.test.mjs
```

## Estado
hecho
