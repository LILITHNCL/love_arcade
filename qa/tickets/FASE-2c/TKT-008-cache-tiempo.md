# TKT-008: Caché de tiempo

**Fase**: F2c · **Matriz**: #8 · **Riesgo**: R5 / P1

## Objetivo
Verificar el comportamiento del caché de tiempo (`_readTimeCache`) y el impacto de su TTL (4h).

## Dependencias
- `localStorage`
- TKT-007 (time-sync)

## Criterios de aceptación
- `verified` es false si no hay caché o si pasaron más de 4 horas.
- La desincronización detectada persisten en el caché.
- Si hay errores en caché (JSON inválido/corrupto), actúa como no verificado.

## Qué se mockea (y qué oculta)
- `localStorage` falso.
- `Date.now` falso.
- Oculta el comportamiento real de cuotas excedidas durante el guardado del caché y posibles inconsistencias del JSON.parse real en navegadores con plugins extraños.

## Casos
- [x] Sin caché → `verified:false`. *(Test: dado ningún caché guardado, cuando se lee el tiempo, entonces verified es false)*
- [x] Caché caducada. *(Test: dado un caché de 4h y 1ms (caducado)...)*
- [x] `desynced` bloquea el reclamo. *(Test: dado un caché válido pero desynced... en claimDaily)*
- [x] JSON corrupto en caché. *(Test: dado un JSON corrupto en caché...)*
- [x] Caché con tipos inválidos. *(Test: dado un JSON con tipos inválidos en caché...)*
- [x] Confirmar R5: Sin caché verificada, se usa `Date.now()` y se permite el reclamo. *(Test: dado un caché no verificado, cuando se reclama racha... (BUG-F2c-01))*

## Comando
`node --test tests/core/time-sync.test.mjs`

## Estado
hecho

## Verificación por Mutación (Resultado)
- Mutación: Cambiar el TTL de 4h a 8h en `js/core/time-sync.js` (`const TIME_CACHE_TTL = 8 * 60 * 60 * 1000;`).
- Resultado:
```text
✖ dado un caché de 4h y 1ms (caducado), cuando se lee el tiempo, entonces verified es false (34.157083ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  true !== false
  
      at TestContext.<anonymous> (file:///data/data/com.termux/files/home/proyectos/love_arcade/tests/core/time-sync.test.mjs:95:16)
```
- Mutación revertida: Sí. Diff en js/, sw.js, api/ comprobado vacío.
