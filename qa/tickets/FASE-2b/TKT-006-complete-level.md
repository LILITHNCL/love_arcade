# TKT-006: Economía - completeLevel, hub y bridge

**Fase:** F2b
**Prioridad:** P0
**Dependencias:** TKT-004, TKT-005

## Riesgo que cubre
Riesgo 1 y 2: Lógica duplicada de recompensas en `game-center.js` (Hub) y `game-bridge-runtime.js` (Bridge). Si difieren, los juegos y el hub se desincronizan. Si concatenan strings (ej. `"5"`), corrompen el `coins` del store.
Rutas: `js/domain/game-center.js` (L16-24) y `js/game-bridge-runtime.js` (L12-21).

## Tipo de test y herramienta
Integración / Paridad. `node:test` y `vm-sandbox.cjs`.

## Archivos a crear/modificar
- `tests/domain/complete-level.test.mjs`

## Escenarios
Se ejecutarán los mismos escenarios paramétricos contra las dos implementaciones (`Hub` y `Bridge`), reiniciando el sandbox entre cada iteración:
- **Dado** una primera llamada con juego y nivel, **cuando** se completa, **entonces** paga y guarda en historial.
- **Dado** una segunda llamada con el mismo juego y nivel, **cuando** se completa (idempotencia), **entonces** no paga de nuevo y no añade a historial.
- **Dado** un `rewardAmount` inválido (string `"5"`), **cuando** se completa, **entonces** documentar (caracterizar) que concatena (R1).
- **Dado** un `rewardAmount` negativo, **cuando** se completa, **entonces** resta monedas (R1 caracterizado).
- **Dado** un `rewardAmount` de NaN, **cuando** se completa, **entonces** corrompe a NaN (R1 caracterizado).

## Mocks y Fixtures
- `localStorage` falso.
- Ambas funciones cargadas en dos contextos `vm` distintos (hub sandbox vs bridge sandbox).

## Criterios de aceptación
- El test verifica los resultados exactos para ambas implementaciones.
- Los bugs de concatenación/NaN se marcan como `todo` si verifican que el comportamiento actual es frágil.

## Comando
`node --test tests/domain/complete-level.test.mjs`

## Estado
hecho
**Verificación por mutación**: 
- Mutación: Quitar la idempotencia en `completeLevel` de `js/domain/game-center.js` (L18).
- Test que falló: `Paridad: ambas copias se comportan igual ante una tabla de casos` (y el test de idempotencia en hub).
- Mensaje del test de paridad:
```
  AssertionError [ERR_ASSERTION]: El estado resultante de ambas copias de completeLevel debe ser idéntico ante los mismos inputs extraños
  + actual - expected
  ... Skipped lines
  
    {
      buffs: {
        moonBlessingExpiry: 0
      },
  +   coins: '1105-5NaN',
  -   coins: '1205-5NaN',
```
