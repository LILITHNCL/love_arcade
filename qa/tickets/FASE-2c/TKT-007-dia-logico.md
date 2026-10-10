# TKT-007: Día lógico

**Fase**: F2c · **Matriz**: #7 · **Riesgo**: Ninguno (Core) / P0

## Objetivo
Verificar el cálculo del día lógico y el desfase horario.

## Qué se mockea (y qué oculta)
- `Date.now` controlable mediante el reloj falso en el entorno `vm`.
- Oculta problemas relacionados con la zona horaria real del usuario (al trabajar en milisegundos con UTC).

## Casos
- [ ] Desfase de 3 horas (02:59 vs 03:00).
- [ ] Medianoche.
- [ ] Cambio de mes y año.
- [ ] Años bisiestos.
- [ ] `nextResetTime`.

## Verificación por Mutación (Resultado)
Pendiente
## Verificación por Mutación (Resultado)
- Mutación: Cambiar constante de desfase horario `DAILY_DAY_OFFSET_MS = -3 * ...` en `js/core/time-sync.js`.
- Resultado: El test de medianoche y 02:59 capturan el error.
- Mutación revertida: Sí.
