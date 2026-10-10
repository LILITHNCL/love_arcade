# TKT-009: Racha y reparación

**Fase**: F2c · **Matriz**: #9 · **Riesgo**: Ganancia indebida / P1

## Objetivo
Verificar el reclamo y la reparación de la racha diaria.

## Dependencias
- `time-sync`
- Store

## Criterios de aceptación
- Reclamar racha suma el monto correspondiente a la escala (con límite) e incrementa el contador.
- Reparación sólo disponible si la diferencia de días es exactamente 2, si hay saldo, y si la racha previa era > 0.
- La Bendición Lunar (activa) suma monedas extra.

## Qué se mockea (y qué oculta)
- `localStorage`, reloj.
- Oculta problemas de la implementación en la UI de que un usuario presione el botón de reclamo múltiples veces mientras la red está lenta (no modelado con la protección asíncrona real si el claimDaily fuera asíncrono, aunque aquí es síncrono).

## Casos
- [x] Escala 20 + 5·(n-1) con tope de 60. *(Test: dado un reclamo continuo, cuando escala la racha...)*
- [x] +90 con la Luna, incluido el borde justo en la expiración. *(Test: dado un bono con bendición lunar...)*
- [x] Reparación solo con diffDays === 2 y saldo ≥ 500 (500 exacto, 499, saldo tras reparar). *(Tests: dado un diffDays de 2 y saldo >= 500, saldo < 500, diffDays > 2)*
- [x] Reloj hacia atrás. *(Test: dado un reloj negativo...)*
- [x] Doble reclamo el mismo día lógico. *(Test: dado un reclamo previo hoy...)*
- [x] Historial coherente tras reclamar y reparar. *(Tests integrados en reclamo y reparación validando el array de historial)*

## Comando
`node --test tests/domain/daily-streak.test.mjs`

## Estado
hecho

## Verificación por Mutación (Resultado)
- Mutación 1: Cambiar `=== 2` por `>= 2` en `repairAvailable`. Resultado: test de diffDays > 2 falla adecuadamente. Mutación revertida.
- Mutación 2: Cambiar el borde de expiración de la luna (`>` a `>=`). Resultado: test del borde de expiración falla adecuadamente. Mutación revertida.
