# TKT-022: Paridad y valores extremos en completeLevel (#26, P0)

- **ID y título**: TKT-022: completeLevel con Infinity, 0 y decimales en hub y bridge con tabla de paridad
- **Fase**: F5 (Edge cases)
- **Prioridad**: P0
- **Dependencias**: `js/domain/game-center.js`, `js/game-bridge-runtime.js`, `tests/domain/complete-level.test.mjs`, sandbox VM (`tests/helpers/vm-sandbox.cjs`).

## Riesgo que cubre

| Riesgo | Escenario | Error que detecta | Rutas reales |
|---|---|---|---|
| Destrucción de saldo por serialización de `Infinity` (R1) | Un minijuego envía `rewardAmount = Infinity` al completar un nivel | `store.coins += Infinity` convierte el saldo en `Infinity`. Al persistir mediante `JSON.stringify`, `Infinity` se convierte en `null`, destruyendo el saldo numérico del jugador en la recarga | `js/domain/game-center.js:16-24` y `js/game-bridge-runtime.js:12-21` |
| Bloqueo de nivel por recompensa cero (`0`) | Un minijuego asigna recompensa de `0` monedas por error o condición de empate | Se registra el nivel en `progress[gameId]`, se loguea una transacción de ingreso con 0 monedas y se retorna `paid: true`, impidiendo reintentar el nivel para obtener monedas legítimas | `js/domain/game-center.js:18-20` y `js/game-bridge-runtime.js:15-17` |
| Corrupción de economía por valores decimales | Un minijuego otorga recompensas fraccionarias (ej. `2.5` o `0.75` monedas) | `completeLevel` no aplica `Math.floor()` a diferencia de `Economy.addCoins`, contaminando el saldo del store con números de punto flotante | `js/domain/game-center.js:20` y `js/game-bridge-runtime.js:17` |
| Disparidad de comportamiento entre Hub y Bridge (R2) | Casos extremos de entrada se comportan de forma divergente entre el entorno del hub y el runtime inyectado en los minijuegos | Ruptura del contrato unificado de `GameCenter`, provocando estados incompatibles al volver de un juego al hub | `js/domain/game-center.js` vs `js/game-bridge-runtime.js` |

## Tipo de test y herramienta

Test unitario y de paridad funcional cruzada con `node:test` y `node:assert/strict`, ampliando la suite existente `tests/domain/complete-level.test.mjs` bajo sandbox `node:vm`.

## Archivos a crear/modificar

- Archivo de test: `tests/domain/complete-level.test.mjs` (ampliación de tests existentes).
- Documentación: `qa/tickets/FASE-5/TKT-022-complete-level-paridad.md` y `qa/tickets/FASE-5/PLAN-F5.md`.

## Escenarios concretos (dado → cuando → entonces)

1. **Recompensa `Infinity`**:
   - *Dado*: saldo inicial de 100 monedas en el Hub y en el Bridge.
   - *Cuando*: se invoca `GameCenter.completeLevel('juego1', 'nivel_inf', Infinity)`.
   - *Entonces*: la función debe salvaguardar la integridad del saldo (devolviendo `{ paid: false }` o manteniendo el saldo numérico inmutable). Si el código actual muta a `Infinity`, se asienta el comportamiento deseado bajo `{ todo: 'BUG-F5-02: completeLevel acepta Infinity corrompiendo el saldo a null en JSON' }`.

2. **Recompensa cero (`0`)**:
   - *Dado*: saldo inicial de 100 monedas y nivel no completado previamente.
   - *Cuando*: se invoca `GameCenter.completeLevel('juego1', 'nivel_cero', 0)`.
   - *Entonces*: registra el nivel en `progress['juego1']`, conserva el saldo en 100, registra la transacción con 0 monedas y retorna `paid: true`.

3. **Recompensa con decimales (`15.5`)**:
   - *Dado*: saldo inicial de 100 monedas.
   - *Cuando*: se invoca `GameCenter.completeLevel('juego1', 'nivel_dec', 15.5)`.
   - *Entonces*: se valida si el saldo resultante es truncado con `Math.floor` a 115 o si se permite saldo fraccionario 115.5. Si se requiere consistencia entera con el resto de la economía (`Math.floor`), se asienta la aserción con `{ todo }`.

4. **Tabla de paridad Hub↔Bridge ante casos extremos**:
   - *Dado*: una secuencia de casos anómalos:
     - `{ game: 'g1', level: 'l1', reward: Infinity }`
     - `{ game: 'g1', level: 'l2', reward: 0 }`
     - `{ game: 'g1', level: 'l3', reward: 2.75 }`
     - `{ game: 'g1', level: 'l4', reward: -0 }`
     - `{ game: 'g1', level: 'l5', reward: Number.MAX_SAFE_INTEGER }`
   - *Cuando*: la secuencia se ejecuta idénticamente sobre una instancia del Hub y sobre una instancia del Bridge con reloj sincronizado (`Date.now = () => 1000`).
   - *Entonces*: el estado final de ambos entornos (`coins`, `progress`, `history`) debe ser estrictamente idéntico mediante `assert.deepEqual(stateBridge, stateHub)`.

## Datos/fixtures y qué NO se mockea

- **Qué NO se mockea**:
  - Código real de `js/domain/game-center.js` (Hub) y `js/game-bridge-runtime.js` (Bridge).
  - Lógica real de `state-store.js` y `history.js`.
- **Qué se falsea**:
  - `Date.now`: Fijado en un valor constante para asegurar que las marcas temporales en los historiales de transacción coincidan exactamente en la comparación de paridad.

## Criterios de aceptación verificables

- [x] Las implementaciones de Hub y Bridge son sometidas a la misma batería de pruebas unitarias.
- [x] La tabla de paridad evalúa secuencialmente los casos extremos y comprueba la identidad total de estado mediante `assert.deepEqual`.
- [x] Cualquier fallo de validación de `Infinity` o decimales queda documentado como `todo` en ⚠ sin quebrar la ejecución de `npm test`.

## Comando para ejecutarlo

```bash
node --test tests/domain/complete-level.test.mjs
```

## Resultados de ejecución

```
ℹ tests 21
ℹ suites 3
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 12
ℹ duration_ms 1163.367656
```

## Verificación por mutación

1. **Mutación 1 (Inversión de guarda de idempotencia en Hub · `js/domain/game-center.js:18`)**:
   - *Cambio*: `if (Store.getStore().progress[gameId].includes(levelId))` cambiado a `if (!Store.getStore().progress[gameId].includes(levelId))`
   - *Resultado*: Fallaron los tests unitarios de Hub (`dado una primera llamada...`, `dado un monto cero...`, `dado un monto con decimales...`) y el test de paridad `✖ Paridad: ambas copias se comportan igual ante una tabla de casos extremos` (`ERR_ASSERTION`). Exit code: 1.
   - *Reversión*: `git checkout js/domain/game-center.js`. `git diff js/domain/game-center.js` quedó limpio y vacío.

2. **Mutación 2 (Inversión de guarda de idempotencia en Bridge · `js/game-bridge-runtime.js:15`)**:
   - *Cambio*: `if (store.progress[gameId].includes(levelId))` cambiado a `if (!store.progress[gameId].includes(levelId))`
   - *Resultado*: Fallaron los tests unitarios de Bridge (`dado una primera llamada...`, `dado una segunda llamada...`, `dado un monto cero...`, `dado un monto con decimales...`) y el test de paridad `✖ Paridad: ambas copias se comportan igual ante una tabla de casos extremos` (`ERR_ASSERTION`). Exit code: 1.
   - *Reversión*: `git checkout js/game-bridge-runtime.js`. `git diff js/game-bridge-runtime.js` quedó limpio y vacío.

3. **Comprobación `Math.floor`**:
   - Ni `js/domain/game-center.js` ni `js/game-bridge-runtime.js` implementan `Math.floor` en `completeLevel` (ambas copias ejecutan directamente `coins += rewardAmount;`). La acumulación de decimales fue validada en verde (`✔`) observacionalmente para ambas implementaciones y documentada como hueco arquitectónico en `qa/99-huecos.md`.

## Estado

hecho

