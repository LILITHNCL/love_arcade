# Lifecycle de timers y scheduler central

## Inventario de `setInterval` original

- `index.html` (inline Home): countdown diario cada `1000 ms` en `updateCountdownDisplay`.
- `js/lifecycle-scheduler.js`: gestiona el ciclo de vida de los intervalos registrados.
- `js/core/time-sync.js`: sync de caché de tiempo cada `30 min`, registrado bajo el grupo `sync`.

## Contrato de lifecycle (start/stop)

- Todo módulo que necesite repetición debe registrar el timer con `window.AppScheduler.registerInterval(group, label, fn, delay)`.
- Grupos válidos por responsabilidad:
  - `countdown`: relojes visuales de UI.
  - `sync`: sincronización periódica de estado/caché.
  - `poll`: sondeo de APIs/permisos.
- Al salir de una vista SPA, el módulo debe pausar su grupo o limpiar su task en `onLeave()`.
- Al entrar a vista SPA, debe reanudar grupo (si aplica) y forzar un refresco puntual en `onEnter()`.
- Para evitar timers huérfanos en navegación interna:
  - usar `clearIntervalTask(task)` al desmontar recursos permanentes,
  - no conservar IDs sueltos de `setInterval` fuera del scheduler.
- El scheduler pausa/reanuda automáticamente por:
  - `visibilitychange`,
  - `pagehide/pageshow`,
  - vista activa SPA (`setActiveView(viewId)`, actualmente activa timers sólo en `home`).

## Countdown visual

- El countdown de Home ya no crea múltiples intervalos por módulo.
- Se actualiza desde un único task grupal (`countdown`) y sólo repinta cuando cambia el segundo visible.
