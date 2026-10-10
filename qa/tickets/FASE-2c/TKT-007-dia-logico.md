# TKT-007: Día lógico

**Fase**: F2c · **Matriz**: #7 · **Riesgo**: Ninguno (Core) / P0

## Objetivo
Verificar el cálculo del día lógico y el desfase horario.

## Dependencias
- Ninguna

## Criterios de aceptación
- `dayDiff` calcula la diferencia de días respetando el desfase de 3h (inicia 03:00).
- `nextResetTime` devuelve la próxima vez que se cumplan las 03:00.

## Qué se mockea (y qué oculta)
- `Date.now` controlable mediante el reloj falso en el entorno `vm`.
- Oculta problemas relacionados con la zona horaria real del usuario (al trabajar en milisegundos con UTC).

## Casos
- [x] Desfase de 3 horas (02:59 vs 03:00). *(Test: dado un reclamo a las 02:59, cuando se consulta a las 03:00 del mismo día natural, entonces cuenta como un día de diferencia)*
- [x] Medianoche. *(Test: dado un reclamo, cuando se consulta a medianoche, entonces sigue siendo el mismo día lógico)*
- [x] Cambio de mes y año. *(Tests: dado un reclamo el último día del mes... y último día del año)*
- [x] Años bisiestos. *(Test: dado un reclamo el 28 de febrero en año bisiesto...)*
- [x] `nextResetTime`. *(Test: dado un tiempo actual, cuando se consulta nextResetTime...)*

## Comando
`node --test tests/core/time-sync.test.mjs`

## Estado
hecho

## Verificación por Mutación (Resultado)
- Mutación: Alterar `nextResetTime` en `js/core/time-sync.js` cambiando `setHours(24, 0, 0, 0)` por `setHours(23, 0, 0, 0)`.
- Resultado: 
```text
✖ dado un tiempo actual, cuando se consulta nextResetTime, entonces devuelve el próximo 03:00 (14.371146ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + 1768464000000
  - 1768467600000
          ^
```
- Mutación revertida: Sí. Diff en js/, sw.js, api/ comprobado vacío.
