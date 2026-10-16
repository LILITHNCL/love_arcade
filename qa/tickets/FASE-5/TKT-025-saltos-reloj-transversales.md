# TKT-025: Saltos de reloj transversales y fronteras horarias (#26, P1)

- **ID y título**: TKT-025: Saltos de reloj transversales, fronteras horarias (02:59/03:00), cambio de año y caducidad de TTL de 4 h
- **Fase**: F5 (Edge cases)
- **Prioridad**: P1
- **Dependencias**: `js/core/time-sync.js`, `js/domain/daily-streak.js`, `js/domain/moon-blessing.js`, `js/cloud/sentinel.js`, sandbox VM (`tests/helpers/vm-sandbox.cjs`).

## Riesgo que cubre

| Riesgo | Escenario | Error que detecta | Rutas reales |
|---|---|---|---|
| Inconsistencia o trampas por reloj hacia atrás | El usuario retrasa la hora del sistema operativo tras haber realizado un reclamo o compra | `claimDaily()` y `repairDailyStreak()` deben detectar `now < lastClaim` y abortar con mensaje de inconsistencia; la Bendición Lunar no debe quedar activa indefinidamente; Sentinel no debe ser inducido a resolver por LWW a favor de la nube por timestamp retrasado | `js/domain/daily-streak.js:31-37, 111-113`, `js/domain/moon-blessing.js:27-35`, `js/cloud/sentinel.js:386-404` |
| Pérdida o salto irregular de racha por reloj hacia adelante | El reloj avanza 1 día, 2 días (reparación) o más de 2 días | `claimDaily()` debe transicionar limpiamente entre reclamo normal (`diffDays === 1`), reparación requerida (`diffDays === 2`), o reinicio de racha a 1 (`diffDays >= 3`) | `js/domain/daily-streak.js:47-75` |
| Error de cómputo en el corte del día lógico (02:59 vs 03:00) | Se realizan reclamos en el borde exacto de las 03:00 AM (`DAILY_DAY_OFFSET_MS = 3 * 3600 * 1000`) | Reclamos a las 02:59:59 deben asignarse al día lógico previo y a las 03:00:00 al nuevo día; no debe permitirse doble reclamo en el mismo día lógico ni bloquear el avance entre días distintos | `js/core/time-sync.js:54-68` y `js/domain/daily-streak.js:47-55` |
| Desfases en cambio de año o bisiestos | Reclamos realizados entre el 31 de diciembre y el 1 de enero, o durante el 28/29 de febrero | Cálculo erróneo de la diferencia de días en `_getDailyDiffDays` que provoque reseteos accidentales de racha | `js/core/time-sync.js:59-62` |
| Expiración del TTL de 4 horas en la caché de tiempo | Han transcurrido más de 4 horas desde la última sincronización (`cacheAge > TIME_CACHE_TTL`) | `_readTimeCache()` devuelve `verified: false`. `claimDaily()` no debe asumir ciegamente validez de red (BUG-F2c-01) y debe reflejar el estado no verificado | `js/core/time-sync.js:25, 76-84` y `js/domain/daily-streak.js:27-37` |

## Tipo de test y herramienta

Test unitario transversal con `node:test` y `node:assert/strict`, controlando el reloj virtual de forma determinista mediante `sandbox.setMockNow(timestamp)` en `node:vm`.

## Archivos a crear/modificar

- Archivo de test: `tests/core/time-jumps.test.mjs` (a crear en implementación).
- Helper de testing: `tests/helpers/vm-sandbox.cjs`.
- Documentación: `qa/tickets/FASE-5/TKT-025-saltos-reloj-transversales.md` y `qa/tickets/FASE-5/PLAN-F5.md`.

## Escenarios concretos (dado → cuando → entonces)

1. **Reloj hacia atrás en reclamo diario**:
   - *Dado*: un reclamo previo registrado a las 15:00 del día actual (`lastClaim = T`).
   - *Cuando*: el reloj del sistema se retrasa a las 12:00 del mismo día (`now = T - 3 horas`, por lo que `now < lastClaim`) y se invoca `LoveArcadeDailyStreak.claimDaily()`.
   - *Entonces*: la llamada retorna `success: false` con el mensaje exacto `'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.'`, y no modifica el saldo ni la racha.

2. **Reloj hacia atrás en reparación de racha**:
   - *Dado*: racha de 5 días con `lastClaim` en el día anteayer y reloj alterado hacia el pasado (`now < lastClaim`).
   - *Cuando*: se invoca `LoveArcadeDailyStreak.repairDailyStreak()`.
   - *Entonces*: rechaza con `success: false`, mensaje de inconsistencia horaria y no descuenta las 500 monedas de reparación.

3. **Reloj hacia atrás y expiración de Bendición Lunar**:
   - *Dado*: Bendición Lunar adquirida a las 10:00 con duración de 7 días.
   - *Cuando*: el reloj local se retrasa 30 días hacia el pasado.
   - *Entonces*: se valida que `getMoonBlessingStatus()` evalúa `expiry > now` y se documenta el impacto de la manipulación offline sobre la vigencia del beneficio.

4. **Frontera horaria exacta: 02:59:59 frente a 03:00:00**:
   - *Dado*: un reclamo realizado el día 10 a las 02:59:59 (perteneciente al día lógico 9).
   - *Cuando*: el reloj avanza 2 segundos a las 03:00:01 del día 10 (inicio del día lógico 10) y se invoca `claimDaily()`.
   - *Entonces*: `Time._getDailyDiffDays` calcula exactamente `diffDays === 1`, permitiendo el reclamo del nuevo día consecutivo e incrementando la racha.
   - *Y cuando*: el usuario intenta reclamar de nuevo a las 02:59:59 del día 11 (mismo día lógico 10), el sistema calcula `diffDays === 0` y rechaza con `'¡Ya reclamaste tu bono hoy! Vuelve mañana.'`.

5. **Transición en cambio de año (31 de diciembre a 1 de enero)**:
   - *Dado*: un reclamo registrado el 31 de diciembre a las 22:00.
   - *Cuando*: el reloj avanza al 1 de enero a las 04:00 del año siguiente.
   - *Entonces*: el cálculo de diferencia de días `Math.round(diff / 86400000)` arroja exactamente `1`, incrementando la racha sin exigir reparación ni reiniciar a 1.

6. **Caducidad del TTL de 4 horas en caché de tiempo**:
   - *Dado*: una sincronización de red exitosa almacenada en caché a las 10:00.
   - *Cuando*: el reloj virtual avanza a las 14:00:01 (4 horas y 1 segundo después, superando `TIME_CACHE_TTL = 4 * 3600 * 1000`).
   - *Entonces*: `LoveArcadeTime.read()` retorna `verified: false` y `cacheAge > 14400000`. Al invocar `claimDaily()`, se asienta el comportamiento bajo `{ todo: 'BUG-F2c-01: claimDaily permite reclamo con verified:false basándose en Date.now local' }`.

7. **Impacto de saltos de reloj en Sentinel LWW**:
   - *Dado*: Sentinel con sesión activa y un timestamp local `love_arcade_sentinel_ts` registrado en disco.
   - *Cuando*: el reloj local sufre un salto abrupto hacia el pasado antes de iniciar sesión en un dispositivo.
   - *Entonces*: se verifica el cálculo de `localTime < cloudTime` y se comprueba la resiliencia ante sobrescritura destructiva (BUG-F3a-01).

## Datos/fixtures y qué NO se mockea

- **Qué NO se mockea**:
  - Código real de `js/core/time-sync.js`, `js/domain/daily-streak.js`, `js/domain/moon-blessing.js`, `js/cloud/sentinel.js`.
  - Algoritmo de cálculo de fechas de JavaScript (`Date.prototype.setHours`, `Date.prototype.getTime`).
- **Qué se falsea**:
  - `Date.now`: Controlado directamente con milisegundos arbitrarios para evaluar saltos temporales instantáneos y bordes de segundo sin demoras de tiempo real.

## Criterios de aceptación verificables

- [x] Las salvaguardas ante reloj hacia atrás bloquean tanto `claimDaily` como `repairDailyStreak`.
- [x] La precisión del corte a las 03:00:00 AM se valida con resolución de un segundo.
- [x] El cambio de año calcula correctamente `diffDays === 1`.
- [x] La expiración del TTL de 4 horas conmuta `verified` a `false` de forma determinista.

## Verificación por mutación

1. **Mutación 1: Cambiar el desfase de 3 h (`js/core/time-sync.js:18`)**:
   - *Cambio*: `const DAILY_DAY_OFFSET_MS = 4 * 60 * 60 * 1000;`.
   - *Resultado*: Fallan 2 tests de frontera horaria en sección 3 (`0 !== 1` a las 03:00:01 y `1 !== 0` a las 02:59:59). Revertido a 3 h con `git diff` limpio.
2. **Mutación 2: Invertir comparación del TTL de 4 h (`js/core/time-sync.js:77`)**:
   - *Cambio*: `const verified = cacheAge > TIME_CACHE_TTL;`.
   - *Resultado*: Fallan 3 tests en sección 4 (`false !== true` dentro de TTL, `true !== false` fuera de TTL y fallo en `claimDaily`). Revertido con `git diff` limpio.
3. **Mutación 3: Quitar la guarda de diffDays (`js/domain/daily-streak.js:48`)**:
   - *Cambio*: Eliminar `if (diffDays === 0) { ... }`.
   - *Resultado*: Falla el test en borde 02:59:59 del día 16 (`true !== false`, permitiendo reclamos duplicados en el mismo día lógico). Revertido con `git diff` limpio.

## Comando para ejecutarlo

```bash
node --test tests/core/time-jumps.test.mjs
```

## Estado

hecho
