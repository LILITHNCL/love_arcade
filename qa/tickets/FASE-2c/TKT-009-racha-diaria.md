# TKT-009: Racha y reparación

**Fase**: F2c · **Matriz**: #9 · **Riesgo**: Ganancia indebida / P1

## Objetivo
Verificar el reclamo y la reparación de la racha diaria.

## Qué se mockea (y qué oculta)
- `localStorage`, reloj, fake Supabase.
- Oculta problemas de la implementación en la UI de que un usuario presione el botón de reclamo múltiples veces mientras la red está lenta (no modelado con la protección asíncrona real si el claimDaily fuera asíncrono, aunque aquí es síncrono).

## Casos
- [ ] Escala 20 + 5·(n-1) con tope de 60.
- [ ] +90 con la Luna, incluido el borde justo en la expiración.
- [ ] Reparación solo con diffDays === 2 y saldo ≥ 500 (500 exacto, 499, saldo tras reparar).
- [ ] Reloj hacia atrás.
- [ ] Doble reclamo el mismo día lógico.
- [ ] Historial coherente tras reclamar y reparar.

## Verificación por Mutación (Resultado)
Pendiente
## Verificación por Mutación (Resultado)
- Mutación 1: Cambiar `=== 2` por `>= 2` en `repairAvailable`. Resultado: test de diffDays > 2 falla adecuadamente. Mutación revertida.
- Mutación 2: Quitar tope de 60 (`Math.min(..., CONFIG.dailyStreakCap)`). Resultado: test de escalado de racha y tope de 60 detectó ganancia de 70 y falló. Mutación revertida.
- Mutación 3: Quitar comprobación de saldo `>= 500` en `repairDailyStreak`. Resultado: test de saldo insuficiente falló. Mutación revertida.
