# Plan de Fase F5: Edge cases y robustez transversal (Matriz #26)

**Fase:** F5 (Edge cases)  
**Estado:** Planificación completada (pendiente de aprobación)  
**Alcance:** Cobertura de casos límite, almacenamiento al límite, paridad ante valores anómalos, manejo de Unicode, multipestaña y concurrencia sintética, y saltos de reloj transversales.

---

## 1. Alcance y Tickets de la Fase

| Ticket | Prioridad | Área / Tema | Alcance específico |
|---|---|---|---|
| [TKT-021](TKT-021-persistencia-limite.md) | P0 | Persistencia al límite | `Store.save` con errores de cuota no estándar (`NS_ERROR_DOM_QUOTA_REACHED`, `code: 1014`), `Store.migrate` con raíz anómala (`null`, array, número, booleano, string) sin añadir claves espurias, store a ~4 MB con advertencia y podado preventivo, `Economy.buyItem` cuando `Store.save` lanza por cuota, y `_writeTimeCache` ante cuota agotada. |
| [TKT-022](TKT-022-complete-level-paridad.md) | P0 | Paridad `completeLevel` | Comportamiento y paridad cruzada entre Hub (`game-center.js`) y Bridge (`game-bridge-runtime.js`) ante `rewardAmount = Infinity`, `0`, y números con decimales sobre una tabla de casos idéntica. |
| [TKT-023](TKT-023-unicode-sistemas.md) | P1 | Unicode en dominio y datos | Soporte de Unicode en identidad (`nickname` con emojis, secuencias compuestas, caracteres de ancho cero y ancho completo), canje de códigos con acentos y caracteres invisibles, `exportSave` e `importSave` con caracteres > 0xFF, e interoperabilidad Worker (`sync-worker.js`) vs Fallback cargable en `node:vm` sin alterar producción. |
| [TKT-024](TKT-024-multipestana-concurrencia.md) | P1 | Multipestaña y concurrencia | Resiliencia ante eventos `storage` sintéticos (`newValue: null`, JSON corrupto, clave ajena), sincronización de dos instancias del store sobre el mismo almacenamiento, escrituras a claves vigiladas durante `_handleAuthChange` con promesas controladas en `fake-supabase`, `completeLevel` concurrente con `_sentinelSync`, y tolerancia ante snapshots de la nube con claves ausentes o de tipo erróneo. |
| [TKT-025](TKT-025-saltos-reloj-transversales.md) | P1 | Saltos de reloj transversales | Desplazamientos del reloj hacia atrás y adelante, cambio de año y bisiestos, frontera 02:59/03:00 del día lógico, expiración del TTL de 4 horas de la caché de tiempo de red, y su impacto transversal en `claimDaily`, `repairDailyStreak`, Bendición Lunar y marca temporal de Sentinel. |

---

## 2. Archivos afectados

### Tests a crear / ampliar (fuera de producción)
- `tests/core/storage-limits.test.mjs` (nuevo): Persistencia al límite, errores de cuota multiravegador, podado a ~4 MB, `_writeTimeCache` degradado y `migrate` con raíces no-objeto (TKT-021).
- `tests/domain/complete-level.test.mjs` (ampliación): Extensión de la tabla de paridad Hub↔Bridge con casos extremos de `Infinity`, `0` y decimales (TKT-022).
- `tests/domain/unicode-edge-cases.test.mjs` (nuevo): Manejo de Unicode, emojis, normalización y serialización > 0xFF en identidad, canje e import/export (TKT-023).
- `tests/integration/concurrency-multitab.test.mjs` (nuevo): Eventos `storage`, dos instancias de store, handshake con promesas diferidas y snapshots deformes (TKT-024).
- `tests/core/time-jumps.test.mjs` (nuevo): Saltos temporales transversales, fronteras horarias (02:59 vs 03:00) y expiración de TTL de 4 h (TKT-025).

### Helpers de testing (en `tests/helpers/`)
- `tests/helpers/vm-sandbox.cjs`: Reutilización del cargador clásico de scripts en `node:vm`.
- `tests/helpers/fake-supabase.cjs`: Uso de promesas controladas (deferred promises) para orquestar la concurrencia paso a paso durante `_handleAuthChange` sin depender de temporizadores.

### Documentación de QA
- `qa/tickets/FASE-5/PLAN-F5.md`: Este documento.
- `qa/tickets/FASE-5/TKT-021-persistencia-limite.md` a `TKT-025-saltos-reloj-transversales.md`: Definición formal de cada unidad de trabajo.
- `qa/00-plan-maestro.md` y `qa/03-matriz-cobertura.md`: Registro de estado de la fase F5.
- `qa/99-huecos.md` y `qa/BUGS-ENCONTRADOS.md`: Documentación de puntos ciegos y nuevos fallos reales encontrados durante la ejecución.

---

## 3. Dependencias de producción analizadas

- `js/core/config.js`: Constantes base de almacenamiento y economía.
- `js/core/state-store.js`: Métodos `save`, `migrate`, `emergencyCleanup`, `checkStorageSize` y listener de cambios.
- `js/core/time-sync.js`: `_readTimeCache`, `_writeTimeCache`, TTL de 4 horas (`TIME_CACHE_TTL`) y lógica de día lógico (`DAY_CUTOFF_HOUR = 3`).
- `js/domain/economy.js`: `buyItem`, `spendCoins`, `addCoins`.
- `js/domain/history.js`: `logTransaction`, `getHistory`.
- `js/domain/identity.js`: `setIdentity`, `getIdentity`, `hasIdentity`.
- `js/domain/promo-codes.js`: `redeemPromoCode` y función `sha256`.
- `js/domain/moon-blessing.js`: `buyMoonBlessing`, `extendMoonBlessingDays`, `getMoonBlessingStatus`.
- `js/domain/daily-streak.js`: `claimDaily`, `repairDailyStreak`, `_getDailyRepairState`.
- `js/domain/game-center.js`: `completeLevel`, `exportSave`, `importSave`.
- `js/game-bridge-runtime.js`: `completeLevel` para minijuegos del bridge.
- `js/sync-worker.js`: Rutinas de Web Worker para `exportStore` e `importStore`.
- `js/cloud/sentinel.js`: Interceptor de almacenamiento, listener de eventos `storage`, `_applySnapshot`, `_rehydrateHubStoreFromDisk` y `_handleAuthChange`.

---

## 4. Riesgos identificados que cubre la fase

1. **Riesgo R6 / Cuota multiravegador**: Pérdida de progreso o bloqueo total de la aplicación en navegadores Firefox / Gecko si lanzan `NS_ERROR_DOM_QUOTA_REACHED` (`code: 1014`) en lugar del estándar `QuotaExceededError`.
2. **Contaminación de estado en migración**: `migrate` recibe un array o primitivo y genera claves numéricas `'0', '1', ...` que se arrastran en serializaciones posteriores.
3. **Inconsistencia de compras bajo fallo de persistencia**: `buyItem` descuenta monedas en memoria antes de persistir; si el guardado en disco falla, la UI reporta éxito pero el estado no persiste o se corrompe.
4. **Riesgos R1 y R2 / Corrupción por valores extremos**: `completeLevel` muta el saldo con `Infinity` (convirtiéndolo en `null` al serializar JSON) o introduce flotantes en la economía.
5. **Riesgo R3 / Pérdida de integridad Unicode**: Truncado ciego con `.slice(0, 15)` rompe secuencias de emojis; strings con caracteres > 0xFF rompen codificaciones Base64 si no usan UTF-8 seguro.
6. **Riesgo R7 / Concurrencia y multipestaña**: Pestañas simultáneas provocan desincronización de memoria, o el interceptor de Sentinel descarta cambios legítimos ocurridos durante el proceso de autenticación.
7. **Manipulación de reloj y fronteras temporales**: Desfases horarios inducidos o saltos del reloj del sistema engañan al sistema de racha, extienden buffs indebidamente o disparan resolución destructiva en Sentinel.

---

## 5. Orden de ejecución propuesto para la implementación

El orden obedece a la criticidad de los datos (P0 antes de P1) y al aislamiento de dependencias:

```
1. TKT-021 (P0) — Persistencia al límite (Store, cuota y migración)
2. TKT-022 (P0) — completeLevel y paridad extrema Hub↔Bridge
3. TKT-023 (P1) — Unicode en identidad, códigos y serialización
4. TKT-024 (P1) — Multipestaña, concurrencia y tolerancia a fallos en Sentinel
5. TKT-025 (P1) — Saltos de reloj transversales y fronteras horarias
```

---

## 6. Criterios de aceptación globales de la fase

1. **Suite 100% en verde con fallos esperados en ⚠**: Todos los tests deben ejecutarse mediante `npm test` (`node --test`), reportando `✔` para comportamientos conformes y `⚠` (mediante `{ todo: 'BUG-ID: motivo' }`) para cualquier discrepancia o bug real de producción detectado.
2. **Determinismo absoluto sin `sleep` fijos**: Ningún test de la fase utilizará pausas fijas por tiempo (`setTimeout(..., 10/20/50ms)`). La asincronía se sincronizará exclusivamente mediante promesas resueltas por paso (deferred promises), reloj virtual (`setMockNow`) o eventos de ciclo de vida.
3. **Cero dependencias nuevas**: Todo el código de pruebas utilizará las capacidades estándar de Node (`node:test`, `node:assert/strict`, `node:vm`, `crypto.subtle`, `TextEncoder`, `TextDecoder`).
4. **Sin modificación de código de producción**: Ningún archivo bajo `js/`, `api/`, `index.html` o `styles.css` se modificará durante la implementación de tests.
5. **Verificación por mutación en tickets P0 y P1**: Cada escenario crítico se someterá a comprobación adversarial alterando temporalmente la condición o validación probada para verificar que el test falla antes de revertir.

---

## 7. Qué es determinista en Node y qué se debe dejar a F4

### Completamente determinista y verificable en Node (F5):
1. **Manejo de errores de cuota**: Emulación precisa de `localStorage.setItem` lanzando excepciones sintéticas con nombres y códigos específicos (`QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`, `code: 1014`, `code: 22`).
2. **Valores numéricos extremos en minijuegos**: Evaluación pura en sandbox VM de `completeLevel` con `Infinity`, `0`, decimales (`15.75`), `NaN`, strings y negativos, asegurando idéntico resultado entre Hub y Bridge.
3. **Procesamiento de texto Unicode**: Comportamiento de `.slice(0, 15)`, `toUpperCase()`, cálculo SHA-256 de secuencias con emojis y normalización en `identity.js` y `promo-codes.js`.
4. **Codificación Base64 > 0xFF y paridad Worker**: `TextEncoder`/`TextDecoder` y evaluación del script `sync-worker.js` en VM mediante un entorno global `self` simulado.
5. **Concurrencia de promesas en Supabase y Sentinel**: Pausar y reanudar consultas asíncronas con promesas controladas en `fake-supabase.cjs` para forzar colisiones de estado en momentos exactos del flujo de autenticación.
6. **Saltos de reloj y fronteras de día lógico**: Avances y retrocesos de milisegundos controlados por `Date.now` emulado para comprobar el corte exacto de las 03:00 AM y la expiración del TTL de 4 horas.

### Fuera del alcance de Node — Reservado para Fase F4 (E2E con navegador):
1. **Despacho real entre procesos del evento `storage`**: En un navegador real, `storage` se comunica a través del bus del sistema operativo solo entre ventanas/pestañas distintas sin dispararse en la pestaña emisora. Esto requiere múltiples páginas abiertas en Playwright.
2. **Políticas reales de desalojo de disco del navegador**: Presión de almacenamiento del dispositivo y límites dinámicos aplicados por Chromium/WebKit/Gecko bajo contención física de disco.
3. **Ciclo de vida real de Web Worker con postMessage en hilos separados**: Planificación en segundo plano y concurrencia multi-hilo del motor de JavaScript bajo estrés de renderizado de la UI.
4. **Entrada de usuario con teclados móviles virtuales (IME)**: Composición de texto, pegado con formato y autocompletado en campos de entrada (`<input>`) reales.

---

## 8. Decisiones que requieren autorización del usuario

Antes o durante la implementación de la fase, se identifican las siguientes decisiones de diseño y comportamiento:

1. **Decisión D5-01 (TKT-021 · Cuota multiravegador)**:  
   *Contexto*: `js/core/state-store.js:149` comprueba exclusivamente `if (error?.name !== 'QuotaExceededError') throw error;`. En navegadores como Firefox, el error de cuota tiene nombre `NS_ERROR_DOM_QUOTA_REACHED` y código numérico `1014`.  
   *Pregunta*: ¿Debe documentarse como bug formal en `BUGS-ENCONTRADOS.md` con test en `{ todo }` el hecho de que `state-store.js` no captura errores de cuota con nombres no-Chromium?

2. **Decisión D5-02 (TKT-021 · Migración con tipos anómalos en raíz)**:  
   *Contexto*: En `state-store.js:28`, `{ ...defaults, ...loadedStore }` copia índices numéricos `'0', '1', ...` cuando `loadedStore` es un Array o un String, contaminando el store con claves no estándar.  
   *Pregunta*: ¿Debe considerarse comportamiento esperado sanear la raíz validando `typeof loadedStore === 'object' && !Array.isArray(loadedStore)`, marcando la discrepancia con `{ todo }` si contamina claves?

3. **Decisión D5-03 (TKT-022 · Decimales en completeLevel)**:  
   *Contexto*: `completeLevel` tanto en Hub como en Bridge realiza `store.coins += rewardAmount;` sin invocar `Math.floor()`, permitiendo que el saldo acumule decimales. En cambio, `Economy.addCoins` trunca con `Math.floor`.  
   *Pregunta*: ¿Debe el test de paridad exigir que el saldo sea entero truncando decimales (reportando bug si no lo hace), o debe asertar la paridad del comportamiento actual preservando los decimales?

4. **Decisión D5-04 (TKT-023 · Corte de UTF-16 en nickname)**:  
   *Contexto*: `identity.js:9` aplica `slice(0, 15)`. Un emoji compuesto al final de la cadena de 15 unidades UTF-16 puede partirse a la mitad, dejando un carácter sustituto huérfano (`\uD83D`).  
   *Pregunta*: ¿Debe reportarse como bug mediante `{ todo }` que el truncado no sea seguro para grafemas Unicode?

5. **Decisión D5-05 (TKT-023 · Normalización en códigos promocionales)**:  
   *Contexto*: `promo-codes.js` no aplica `.normalize('NFKC')` ni elimina espacios de ancho cero (`\u200B`). Si un usuario pega un código con espacios invisibles, el hash SHA-256 no coincide y falla.  
   *Pregunta*: ¿Se mantiene como comportamiento estricto actual (falla el canje) o se marca como hallazgo de diseño para tolerancia de caracteres invisibles?

6. **Decisión D5-06 (TKT-024 · Escrituras durante restauración de sesión)**:  
   *Contexto*: En `sentinel.js:434`, `_markWatchedKeyDirty` retorna inmediatamente si `_isRestoringSession` es `true`. Cualquier modificación local producida mientras `_handleAuthChange` espera la respuesta remota no queda marcada en `_hasUnsyncedChanges`.  
   *Pregunta*: ¿Debe documentarse este descarte como un bug de concurrencia en `BUGS-ENCONTRADOS.md` con `{ todo }`?
