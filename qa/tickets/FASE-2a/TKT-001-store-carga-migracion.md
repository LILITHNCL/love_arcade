# TKT-001 | Store: carga y migración | P0

**Fase:** F2a
**Dependencias:** Ninguna

**Riesgo que cubre:** 
- Corrupción de datos y retrocompatibilidad de JSON en disco.
- Evita crashes por `JSON.parse` y datos incompletos o tipos incorrectos.
- Rutas: `js/core/state-store.js` (`migrate`).

**Tipo de test y herramienta:** Unitario con `node:test` y `node:assert`.

**Archivos a crear/modificar:**
- `tests/core/state-store.test.mjs`

**Escenarios concretos:**
- **Dado** un JSON corrupto en localStorage, **cuando** carga la app, **entonces** usa los defaults sin lanzar excepción.
- **Dado** un JSON vacío o sin los nuevos campos (ej. daily, buffs), **cuando** se migra, **entonces** añade la estructura completa.
- **Dado** un legacy que guarda el tiempo de racha, **cuando** se migra, **entonces** lo convierte a `daily.lastClaim` y `daily.streak` = 1 (si no existía), y elimina el campo viejo.
- **Dado** un tema legacy que no existe en `THEMES`, **cuando** se migra, **entonces** usa el fallback ('violet').
- **Dado** un save válido y actual, **cuando** se migra dos veces, **entonces** da el mismo resultado (idempotencia).
- **Dado** campos retirados (ej. códigos, misiones), **cuando** se migra, **entonces** se eliminan.
- **Casos límite**: tipos inválidos saneados (género que no es válido → @, nickname que no es string → "", arrays mal formados → []).

**Datos/fixtures y qué NO se mockea:**
- Código de `state-store.js` real cargado vía VM.
- `window.CONFIG`, `window.THEMES`, `window.LoveArcadeConfig` presentes en el entorno.
- `localStorage` se mockea (con un map), el resto es real.

**Criterios de aceptación verificables:**
- Los tests pasan sin error.
- Mutación de la lógica falla el test.

**Comando:** `npm test -- tests/core/state-store.test.mjs`
**Estado:** pendiente
