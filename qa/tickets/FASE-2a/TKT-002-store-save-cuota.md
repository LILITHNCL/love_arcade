# TKT-002 | Store: save y cuota | P0

**Fase:** F2a
**Dependencias:** TKT-001

**Riesgo que cubre:** 
- R6 (borrado silencioso del historial al fallar guardado).
- Rutas: `js/core/state-store.js` (`save`, `emergencyCleanup`).

**Tipo de test y herramienta:** Unitario con `node:test` y `node:assert`.

**Archivos a crear/modificar:**
- `tests/core/state-store.test.mjs`

**Escenarios concretos:**
- **Dado** una llamada a `save`, **cuando** `localStorage` lanza `QuotaExceededError` (simulado), **entonces** se ejecuta `emergencyCleanup`, recorta el historial y reintenta exitosamente.
- **Dado** un reintento que también lanza error de cuota, **cuando** ocurre, **entonces** se verifica si se pierden datos silenciosamente (documentar en BUGS).
- **Dado** progreso de un juego de >50 elementos, **cuando** el payload supera el tamaño de advertencia, **entonces** se recorta el progreso a 50.
- **Dado** un save exitoso, **cuando** se hace migrate/load en otra sesión, **entonces** conserva el estado intacto.

**Datos/fixtures y qué NO se mockea:**
- Código real de `state-store.js`.
- Mock de localStorage para inyectar fallos de cuota.

**Criterios de aceptación verificables:**
- Comportamiento de cuota y retención cubierto.

**Comando:** `npm test -- tests/core/state-store.test.mjs`
**Estado:** hecho
