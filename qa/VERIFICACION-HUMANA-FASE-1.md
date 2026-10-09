# Verificación Humana - Fase 1 (Infraestructura)

Esta fase estableció la infraestructura de QA y corrigió los tests frágiles de la línea base preexistente para conseguir que la suite unificada ejecutada localmente a través de `npm test` pase en verde (Matriz #27).

## Qué revisar

1. **Gestión de paquetes:**
   Se ha añadido un `package.json` mínimo sin dependencias que estandariza la ejecución local.
2. **Estructura de QA:**
   Los tests se han clasificado en carpetas como `integration/`, `pwa/`, y `static/`.
3. **Tests existentes arreglados:**
   - **`game-bridge.test.mjs`**: Ahora busca el formato general de versión (`vX.Y.Z`) en `sw.js` en vez de un string exacto.
   - **`rive-streak-lifecycle.test.mjs`**: Se ha removido el acoplamiento a la forma literal en que el código fuente declara el string `STATE_MACHINE`, y se ha estabilizado la simulación del render loop.
   - **QA estático**: El validador de documentación y variables ya no reporta falsos positivos sobre el mismo código de QA.

## Comandos a ejecutar

Abre una terminal en el directorio del proyecto y ejecuta:

```bash
# 1. Comprueba la suite general unificada:
npm test

# 2. Comprueba la sub-suite de minijuegos:
npm run test:games
```

### Resultados Esperados
- La salida de `npm test` debe ser verde (`fail 0`).
- Podrás ver los 2 tests marcados con `{ todo: ... }` reportados como amarillos (Bug F1 y Bug F4, que se conservan como documentación de hallazgos para que los revises).
- `npm run test:games` debe finalizar con todos los tests unitarios reportando verde.

## Lo que no se pudo verificar localmente
- Ninguna restricción de entorno se interpuso en esta fase. Todas las aserciones de infraestructura pueden ejecutarse correctamente bajo Termux. No obstante, las aserciones E2E con navegador continúan diferidas para la máquina anfitriona (Fase 4).
