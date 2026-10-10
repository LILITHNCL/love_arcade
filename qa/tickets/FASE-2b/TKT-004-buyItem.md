# TKT-004: Economía - buyItem

**Fase:** F2b
**Prioridad:** P0
**Dependencias:** Ninguna

## Riesgo que cubre
Riesgo 3 (Economía: `buyItem`): Saldo negativo, cobro doble de ítems (R12 documentado).
Rutas: `js/domain/economy.js` (L7-34).

## Tipo de test y herramienta
Unitario, usando `node:test` y el helper `vm-sandbox.cjs`.

## Archivos a crear/modificar
- `tests/domain/economy.test.mjs` (migrar a `node:test` y añadir escenarios).

## Escenarios
- **Dado** saldo justo, **cuando** se compra, **entonces** saldo llega a cero (más cashback) y se loguea.
- **Dado** ya poseído, **cuando** se compra, **entonces** no cobra dos veces.
- **Dado** oferta activa, **cuando** se compra, **entonces** usa redondeo correcto.
- **Dado** cashback de 0, **cuando** se compra, **entonces** no añade transacción de ingreso.
- **Dado** precio 0, **cuando** se compra, **entonces** lo permite sin cobrar (o cobra 0) y sin cashback.
- **Dado** saldo insuficiente, **cuando** se compra, **entonces** no muta nada (saldo ni historial).
- **Dado** llamador alterado (R12), **cuando** pasa precio distinto, **entonces** `buyItem` confía ciegamente (lo caracterizamos). Si es peligroso, se documenta como `todo` (BUG-F2b-01).

## Mocks y Fixtures
- `localStorage` falso.
- Fixture de ítem de tienda genérico.
- No se mockea Math.floor ni lógica de Store.

## Criterios de aceptación
- `economy.test.mjs` convertido a `node:test`.
- Todos los escenarios descritos pasan o marcan un `todo`.
- Saldo insuficiente verifica mutación completa del store usando clon profundo.

## Comando
`node --test tests/domain/economy.test.mjs`

## Estado
hecho
**Verificación por mutación**: 
- Mutación: Quitar `store.coins < finalPrice` en `buyItem` (cambiar a `if (false) {` en `js/domain/economy.js:20`).
- Test que falló: `dado saldo insuficiente, cuando se compra, entonces no muta nada`
- Mensaje:
```
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
    {
  +   cashback: 10,
  +   finalPrice: 100,
  +   success: true
  -   reason: 'coins',
  -   success: false
    }
```
