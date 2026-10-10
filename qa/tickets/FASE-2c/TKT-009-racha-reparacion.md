# TKT-009: Racha y reparación

**Fase**: F2c · **Matriz**: #9 · **Riesgo**: P1

## Objetivo
Verificar la escalada de la racha, el tope de recompensa, los bonos adicionales (Luna) y el sistema de reparación de racha (costo y condiciones).

## Dependencias
- `localStorage`
- `window.LoveArcadeHistory` (logTransaction)
- TKT-007 (time-sync)
- TKT-008 (cache-tiempo)

## Criterios de aceptación
- Recompensa escala 20 + 5·(n-1) hasta tope de 60.
- La racha requiere `diffDays === 1` para continuar; `diffDays === 0` es rechazado; `diffDays === 2` exige reparación; `diffDays > 2` reinicia la racha.
- Bendición lunar añade 90 extra (solo si `expiry > now`).
- La reparación cuesta 500 monedas y registra un gasto en el historial.

## Qué se mockea (y qué oculta)
- `localStorage` falso para saldos e historial.
- Reloj falso para simular días diferentes.
- Oculta problemas de estado reactivo (los componentes de UI podrían no enterarse de que el saldo bajó 500 monedas si no escuchan el evento correcto).

## Casos
- [x] Escala 20 + 5·(n-1) con tope de 60. *(Test: dado un reclamo continuo, cuando escala la racha, entonces la recompensa es 20 + 5*(n-1) con tope de 60)*
- [x] +90 con la Luna, incluido el borde justo en la expiración. *(Test: dado un bono con bendición lunar... incluso en el borde de expiración)*
- [x] Reparación solo con `diffDays === 2` y saldo >= 500 (500 exacto, 499, saldo tras reparar). *(Tests: dado un diffDays de 2 y saldo >= 500... y saldo < 500...)*
- [x] Reloj hacia atrás. *(Test: dado un reloj negativo, cuando se reclama o repara...)*
- [x] Doble reclamo el mismo día lógico. *(Test: dado un reclamo previo hoy, cuando se pide el bono de nuevo...)*
- [x] Historial coherente tras reclamar y reparar. *(Test: verificado en las aserciones de historial de reclamar y reparar)*

## Comando
`node --test tests/domain/daily-streak.test.mjs`

## Estado
hecho

## Verificación por Mutación (Resultado)
- Mutación: Quitar el tope de 60 (cambiar `CONFIG.dailyStreakCap` por `Infinity` en `js/domain/daily-streak.js`).
- Resultado:
```text
✖ dado un reclamo continuo, cuando escala la racha, entonces la recompensa es 20 + 5*(n-1) con tope de 60 (17.203489ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  70 !== 60
  
      at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/domain/daily-streak.test.mjs:82:16)
```
- Mutación revertida: Sí. Diff en js/, sw.js, api/ comprobado vacío.

- Mutación: Quitar el chequeo de saldo >= 500 para la reparación (`if (false) {` en lugar de `if (Store.getStore().coins < DAILY_REPAIR_COST) {`).
- Resultado:
```text
✖ dado un diffDays de 2 y saldo < 500, cuando se intenta reparar, entonces falla y no muta saldo (18.250729ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  true !== false
  
      at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/domain/daily-streak.test.mjs:157:16)
```
- Mutación revertida: Sí. Diff en js/, sw.js, api/ comprobado vacío.

- Mutación: Cambiar `diffDays === 2` a `diffDays >= 2` en el flujo principal y de reparación.
- Resultado:
```text
✖ dado más de 2 días sin reclamar, cuando se reclama, entonces la racha se reinicia a 1 (18.774688ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:
  + actual - expected
  
    {
  +   coins: 9,
  +   reward: undefined,
  +   streak: 8
  -   coins: 29,
  -   reward: 20,
  -   streak: 1
    }
  
      at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/domain/daily-streak.test.mjs:91:16)
```
- Mutación revertida: Sí. Diff en js/, sw.js, api/ comprobado vacío.

- Mutación: Borde de la expiración de la luna (`moonBlessingExpiry > now` cambiado a `>=`).
  Nota: Originalmente esta mutación sobrevivía porque el caso de igualdad estricta no estaba testeado. Se añadió un caso específico con `moonExpiry === now` para cubrir esta laguna y ahora falla correctamente.
- Resultado:
```text
✖ dado un bono con bendición lunar, cuando se reclama, entonces suma 90 extra incluso en el borde de expiración (16.920469ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  90 !== 0
  
      at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/domain/daily-streak.test.mjs:126:16)
```
- Mutación revertida: Sí. Diff en js/, sw.js, api/ comprobado vacío.
