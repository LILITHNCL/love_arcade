# TKT-003 | Historial | P1

**Fase:** F2a
**Dependencias:** TKT-001

**Riesgo que cubre:** 
- Gestión de transacciones, límites (50) y orden.
- Rutas: `js/domain/history.js` (`logTransaction`, `getHistory`).

**Tipo de test y herramienta:** Unitario con `node:test` y `node:assert`.

**Archivos a crear/modificar:**
- `tests/domain/history.test.mjs`

**Escenarios concretos:**
- **Dado** varias transacciones, **cuando** se leen con `getHistory`, **entonces** se devuelven en orden cronológico inverso.
- **Dado** más de 50 transacciones, **cuando** se registran, **entonces** se mantiene un tope exacto de 50.
- **Dado** entradas inválidas o sin campos, **cuando** ocurre, **entonces** el store las tolera (o ver cómo se comporta).

**Datos/fixtures y qué NO se mockea:**
- Código real de `history.js` y `state-store.js`.
- Reloj mockeado.

**Criterios de aceptación verificables:**
- Tope y orden correcto verificados.

**Comando:** `npm test -- tests/domain/history.test.mjs`
**Estado:** pendiente
