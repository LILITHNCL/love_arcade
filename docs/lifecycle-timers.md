# Lifecycle de timers y scheduler central

## Inventario de `setInterval` original

- `index.html` (inline Home): countdown diario cada `1000 ms` en `updateCountdownDisplay`.
- `js/app.js`: flush de playtime visible cada `15000 ms`.
- `js/app.js`: sync de caché de tiempo cada `30 min`.
- `js/push-notifications.js`: polling de permisos cada `1500 ms` (Opera Android).
- `js/push-notifications.js`: sync de estado de recordatorios cada `5 min`.

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
