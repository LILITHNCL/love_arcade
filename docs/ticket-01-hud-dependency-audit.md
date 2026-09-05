# TICKET-01 — Auditoría de dependencias del HUD

Fecha de ejecución: 2026-09-05.

## Comando ejecutado

```sh
rg -n --glob '!docs/**' --glob '!node_modules/**' 'hud-greeting|hud-status|hud-balance|pref-suffix' .
```

## Resultado

| Selector | Referencias encontradas | Conclusión |
| --- | --- | --- |
| `.hud-greeting` | `index.html` (markup), `styles.css` (estilo) | Sin consumidor JavaScript; se puede eliminar. |
| `.hud-status`, `.hud-status-dot` | `index.html` (markup), `styles.css` (estilos) | Sin consumidor JavaScript; se pueden eliminar. |
| `.hud-balance*` | `index.html` (markup), `styles.css` (estilos), un comentario no funcional en `styles.css` | Sin selector JavaScript dirigido a este bloque; se puede eliminar. `updateUI()` actualiza todos los `.coin-display`, por lo que la eliminación del consumidor del HUD no cambia el contrato. |
| `#pref-suffix` | `index.html` (markup), `js/app.js` (`applyIdentity`) | Era el único consumidor JavaScript. Se eliminó el acceso de `applyIdentity` junto con el elemento; el nickname y el título del perfil mantienen sus actualizaciones. |

No se encontraron consumidores críticos fuera del HUD para los elementos eliminados. Los IDs que usan `updateDailyButton()`, `updateStreakBar()`, `updateCountdownDisplay()` y `_setDailyMessage()` se conservaron en el nuevo Streak Hub.
