# TKT-001: Línea base preexistente

**Fase:** F1 Infraestructura
**Prioridad:** P1
**Dependencias:** Ninguna

**Riesgo que cubre:** Tests frágiles acoplados a la implementación que generan falsos positivos y evitan que la suite pase (Matriz #27).
**Tipo de test y herramienta:** Mantenimiento de tests existentes (`node:test`).
**Archivos a crear/modificar:**
- `tests/game-bridge.test.mjs`
- `tests/rive-streak-lifecycle.test.mjs`
- `tests/documentation-static-qa.mjs`
- `tests/daily-streak-hub-qa.mjs`

**Escenarios concretos:**
1. Dado el test de service worker en `tests/game-bridge.test.mjs`, cuando se verifique la versión de caché, entonces debe comprobar el formato `vX.Y.Z` mediante regex y conservar la aserción del precache.
2. Dado el test `tests/rive-streak-lifecycle.test.mjs`, cuando se ejecute, no debe buscar una cadena literal de `stateMachine` que dependa del formato del código fuente. Se elimina la comprobación con el comentario solicitado.
3. Dado el test `tests/documentation-static-qa.mjs`, cuando busque referencias heredadas, las cadenas dentro de `tests/daily-streak-hub-qa.mjs` deben construirse de forma indirecta para que el escáner no genere falsos positivos.

**Datos/fixtures y qué NO se mockea:**
- No aplica (modificación de tests existentes).

**Criterios de aceptación verificables:**
- `tests/game-bridge.test.mjs` usa `match` de regex sobre el contenido para buscar el patrón `^v\d+(\.\d+)+$`.
- `tests/rive-streak-lifecycle.test.mjs` ya no aserta la cadena exacta de la state machine.
- `tests/documentation-static-qa.mjs` ya no falla sobre `tests/daily-streak-hub-qa.mjs`.

**Comando para ejecutarlo:**
`node --test tests/game-bridge.test.mjs tests/rive-streak-lifecycle.test.mjs tests/documentation-static-qa.mjs`

**Estado:** pendiente
