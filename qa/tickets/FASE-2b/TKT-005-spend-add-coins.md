# TKT-005: Economía - spendCoins y addCoins

**Fase:** F2b
**Prioridad:** P0
**Dependencias:** TKT-004

## Riesgo que cubre
Riesgo 4: Montos inválidos en `spendCoins` y `addCoins` que corrompan el saldo o el historial (ej: strings que concatenen, NaN que destruya números, decimales).
Rutas: `js/domain/economy.js` (L36-55).

## Tipo de test y herramienta
Unitario, usando `node:test` y `vm-sandbox.cjs`.

## Archivos a crear/modificar
- `tests/domain/economy-coins.test.mjs` (archivo nuevo).

## Escenarios
Para `spendCoins` y `addCoins`:
- **Dado** un monto decimal, **cuando** se procesa, **entonces** usa `Math.floor`.
- **Dado** valores inválidos (NaN, Infinity, negativos, 0, string numérico, undefined), **cuando** se procesa, **entonces** no muta el saldo ni añade historial.
- **Dado** saldo insuficiente (solo `spendCoins`), **cuando** se gasta, **entonces** NO muta el estado.
- **Dado** operaciones válidas, **cuando** ocurren en secuencia, **entonces** el historial refleja el motivo correcto y queda coherente.

## Mocks y Fixtures
- `localStorage` falso.

## Criterios de aceptación
- Archivo creado y corriendo.
- Se prueba la mutación completa usando un clon profundo en los casos inválidos.

## Comando
`node --test tests/domain/economy-coins.test.mjs`

## Estado
hecho
**Verificación por mutación**: 
- Mutación: Quitar `Math.floor` en `spendCoins` y `addCoins` (`const n = amount;` en `js/domain/economy.js:38 y 47`).
- Test que falló: `dado monto decimal, cuando se procesa, entonces usa Math.floor`
- Mensaje:
```
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  89.1 !== 90
```
