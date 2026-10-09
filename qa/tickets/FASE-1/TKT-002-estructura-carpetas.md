# TKT-002: Infraestructura reutilizable y estructura de carpetas

**Fase:** F1 Infraestructura
**Prioridad:** P1
**Dependencias:** TKT-001

**Riesgo que cubre:** Código duplicado en la inicialización de tests (`vm` sandbox) y falta de convenciones que dificulta el mantenimiento unificado (Matriz #27).
**Tipo de test y herramienta:** Refactor de helpers (`node:test`).
**Archivos a crear/modificar:**
- `tests/helpers/vm-sandbox.mjs` (y otros helpers base si aplica)
- Renombrar o reubicar archivos para respetar la convención de `02-estrategia.md` si es necesario (`tests/**/*.test.mjs`).

**Escenarios concretos:**
1. Dado un test que necesita cargar código de producción, cuando inicialice el entorno, entonces debe usar un helper compartido que simule `localStorage`, `Date.now`, o el sandbox de `vm` sin necesidad de copiar código.
2. Dado un archivo de test, debe respetar la estructura de subdirectorios (domain, core, integration, etc.).

**Datos/fixtures y qué NO se mockea:**
- No se mockea código de producción, se carga real a través de `node:vm`.

**Criterios de aceptación verificables:**
- Existe `tests/helpers/` con utilidades comprobables.
- Reducción de código duplicado en la suite si hay oportunidad en esta fase, respetando solo lo necesario para el plan maestro actual.

**Comando para ejecutarlo:**
`node --test "tests/**/*.mjs"`

**Estado:** hecho

**Mutación verificada:** Helper vm-sandbox abstraído correctamente y probado rompiendo lógica de promo-codes que derivó en fallo correcto del test respectivo.
