# Índice Fase 1: Infraestructura

**Fase:** F1
**Objetivo:** Establecer una línea base estable, un `package.json` mínimo, un runner unificado (`node --test`) y reparar tests rotos (Matriz #27).

## Tickets en orden de ejecución

1. **[TKT-001](TKT-001-linea-base.md): Línea base preexistente**
   - **Prioridad:** P1
   - **Objetivo:** Arreglar tests que fallan actualmente por acoplamiento y fragilidad (`game-bridge`, `rive-streak-lifecycle`, `documentation-static-qa`).

2. **[TKT-002](TKT-002-estructura-carpetas.md): Infraestructura reutilizable y estructura**
   - **Prioridad:** P1
   - **Dependencia:** TKT-001
   - **Objetivo:** Implementar los helpers compartidos para el sandbox de VM y mocks, asegurando la convención de carpetas descrita en `/qa/02-estrategia.md`.

3. **[TKT-003](TKT-003-package-json.md): package.json mínimo**
   - **Prioridad:** P1
   - **Dependencia:** TKT-002
   - **Objetivo:** Definir los comandos de ejecución unificados `npm test` y `npm run test:games` sin añadir dependencias ni modificar módulos globales.

## Estado global de la fase
Pendiente. A la espera de confirmación para empezar la implementación.
