# TKT-008: Caché de tiempo

**Fase**: F2c · **Matriz**: #8 · **Riesgo**: R5 / P1

## Objetivo
Verificar el comportamiento del caché de tiempo (`_readTimeCache`) y el impacto de su TTL (4h).

## Qué se mockea (y qué oculta)
- `localStorage` falso.
- `Date.now` falso.
- Oculta el comportamiento real de cuotas excedidas durante el guardado del caché y posibles inconsistencias del JSON.parse real en navegadores con plugins extraños.

## Casos
- [ ] Sin caché → `verified:false`.
- [ ] Caché caducada.
- [ ] `desynced` bloquea el reclamo.
- [ ] JSON corrupto en caché.
- [ ] Caché con tipos inválidos.
- [ ] Confirmar R5: Sin caché verificada, se usa `Date.now()` y se permite el reclamo. Si es debilidad, documentar como hallazgo.

## Verificación por Mutación (Resultado)
Pendiente
## Verificación por Mutación (Resultado)
- Mutación: Quitar comprobación de `desynced` en la racha (aunque esta aplica también para TKT-009). Comentar `if (desynced) { ... }` en `claimDaily`.
- Resultado: El test de bloqueo por reloj desincronizado falla explícitamente y captura el error.
- Mutación revertida: Sí.
