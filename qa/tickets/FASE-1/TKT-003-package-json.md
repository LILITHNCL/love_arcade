# TKT-003: package.json mínimo

**Fase:** F1 Infraestructura
**Prioridad:** P1
**Dependencias:** TKT-002

**Riesgo que cubre:** Falta de comandos estándar de test y reporte que impide verificar de forma rápida e inequívoca el estado del proyecto localmente (Matriz #27).
**Tipo de test y herramienta:** Scripts NPM.
**Archivos a crear/modificar:**
- `package.json`

**Escenarios concretos:**
1. Dado el repositorio, cuando el desarrollador quiera validar cambios, entonces debe poder ejecutar `npm test` y correr la suite unificada en NodeJS.
2. Dado un minijuego, cuando se ejecute `npm run test:games`, entonces se validarán únicamente los unitarios específicos (como los de Marejig).

**Datos/fixtures y qué NO se mockea:**
- No aplica.

**Criterios de aceptación verificables:**
- `package.json` incluye `"private": true`.
- `scripts` contiene `test` (`node --test "tests/**/*.mjs"`) y `test:games`.
- Opcionalmente `test:coverage` con `--experimental-test-coverage`.
- NO incluye `"type": "module"`.
- NO añade `devDependencies` aún.
- Tras esta fase, `npm test` arroja 0 fallos.

**Comando para ejecutarlo:**
`npm test`

**Estado:** pendiente
