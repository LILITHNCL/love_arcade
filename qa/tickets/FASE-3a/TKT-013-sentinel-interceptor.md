# TKT-013: Sentinel - Interceptor de localStorage

- **ID y título**: TKT-013 — Sentinel: interceptor de localStorage (`setItem` / `removeItem` / claves vigiladas)
- **Fase**: F3a (matriz de cobertura #13)
- **Prioridad**: P1
- **Dependencias**: `js/core/config.js`, `js/core/state-store.js`, `js/cloud/sentinel.js`, sandbox VM (`tests/helpers/vm-sandbox.cjs`), helper Supabase en memoria (`tests/helpers/fake-supabase.cjs`).

## Riesgo que cubre
| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Pérdida de sincronización de cambios locales | Escritura de clave vigilada con sesión activa | No marca dirty ni actualiza el timestamp `love_arcade_sentinel_ts` | `js/cloud/sentinel.js:433-438,446-450` |
| Sincronizaciones espurias hacia la nube | Escritura o borrado de clave no vigilada | Marca dirty erróneamente o altera el timestamp de sincronización | `js/cloud/sentinel.js:434,449` |
| Borrado de partidas/progreso no propagado | `removeItem` de clave vigilada (p. ej. guardado activo de minijuego) | No marca dirty ni actualiza el timestamp al eliminar | `js/cloud/sentinel.js:458-462` |
| Desbordamiento o recursión en storage | Escritura sobre clave vigilada invoca recursivamente el interceptor | Bucle infinito de llamadas entre interceptor y almacenamiento | `js/cloud/sentinel.js:430,436` |
| Interrupción de llamadores ante fallo de cuota | `localStorage.setItem` lanza `QuotaExceededError` | El interceptor captura o altera la excepción impidiendo que el llamador active su limpieza | `js/cloud/sentinel.js:446-450` |

## Tipo y herramienta
Test de integración con `node:test` y `node:assert/strict`, ejecutado en el sandbox de VM del proyecto con Supabase falso en memoria.

## Archivos
- Crear: `tests/helpers/fake-supabase.cjs` (helper fuera del glob de test).
- Crear: `tests/integration/sentinel-interceptor.test.mjs`.
- Documentación: `qa/tickets/FASE-3a/TKT-000-indice.md`, este ticket.
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)
1. Sesión activa → `localStorage.setItem` de clave vigilada (`gamecenter_v6_promos`) → valor persiste, actualiza timestamp ISO en `love_arcade_sentinel_ts` y marca dirty (`beforeunload` sube snapshot a Supabase).
2. Sesión activa → `localStorage.setItem` de clave no vigilada → valor persiste pero NO actualiza timestamp ni marca dirty.
3. Sesión activa → `localStorage.removeItem` de clave vigilada (`MAREJIG_activeSave_v1`) → se elimina localmente, actualiza timestamp y marca dirty (nuevo snapshot no contiene la clave).
4. Sesión activa → `localStorage.removeItem` de clave no vigilada → se elimina localmente pero NO altera timestamp ni marca dirty.
5. Usuario invitado (sin sesión) → `setItem` y `removeItem` de claves vigiladas → operan normalmente en local pero NO generan timestamp ni programan sincronización.
6. Contrato de Storage → `setItem`, `getItem`, `removeItem` y `clear` tras instalar el interceptor → coerción a string conforme a especificación, sin recursión infinita y sin alterar claves inexistentes.
7. Lote secuencial de escrituras y borrados → claves vigiladas y no vigiladas intercaladas → cada clave mantiene su valor y el timestamp refleja la última operación vigilada sin verse afectado por claves no vigiladas.
8. Fallo de cuota (`QuotaExceededError`) en `setItem` → propaga la excepción intacta al llamador, no escribe en storage ni actualiza el timestamp; restablecida la cuota, el interceptor reanuda su operación normal.

## Qué NO se mockea
- `LoveArcadeStore` (`state-store.js`), configuración de claves (`config.js`) y lógica completa de `SentinelCloudSync` (`sentinel.js`).
- Se falsea la red (`fetch` a `/api/client-config`), el SDK de Supabase (cliente en memoria sin llamadas externas) y los eventos del navegador (`window`/`document`).

## Criterios de aceptación
- [x] Escritura de claves vigiladas marca dirty y actualiza el timestamp `love_arcade_sentinel_ts`.
- [x] Escritura de claves no vigiladas no altera el timestamp ni marca dirty.
- [x] Borrado de claves vigiladas marca dirty y actualiza el timestamp.
- [x] Borrado de claves no vigiladas no altera el timestamp.
- [x] Modo invitado opera en almacenamiento local sin tocar marcas de nube.
- [x] Preserva el contrato estándar de Web Storage sin bucles de recursión.
- [x] Múltiples escrituras y borrados en secuencia mantienen consistencia de timestamps y valores.
- [x] Fallos de cuota se propagan limpiamente sin romper el interceptor ni dejar marcas falsas.

## Mutaciones planeadas por rama (verificación en sesión 5)
1. **Rama de verificación de claves vigiladas** (`sentinel.js:434`): invertir condición `!SENTINEL_WATCHED_KEYS.has(key)`. Falla escenario 2 (marcaría dirty para claves no vigiladas).
2. **Rama de marca de tiempo** (`sentinel.js:436`): comentar `_originalSetItem(SENTINEL_TS_KEY, ...)`. Falla escenario 1, 3 y 7 (no actualizaría timestamp).
3. **Rama de interceptor setItem** (`sentinel.js:449`): comentar `_markWatchedKeyDirty(key, ...)`. Falla escenario 1 (no registraría escrituras vigiladas).
4. **Rama de interceptor removeItem** (`sentinel.js:461`): comentar `_markWatchedKeyDirty(key, ...)`. Falla escenario 3 (no registraría borrados de vigiladas).
5. **Rama de sesión activa** (`sentinel.js:434`): omitir la comprobación `!_sbSession`. Falla escenario 5 (marcaría dirty en modo invitado).
6. **Rama de persistencia original** (`sentinel.js:448`): omitir `_originalSetItem(key, value)`. Falla escenario 1, 2 y 6 (no guardaría en local).

## Comando para ejecutarlo
```bash
node --test tests/integration/sentinel-interceptor.test.mjs
```

## Estado
hecho
