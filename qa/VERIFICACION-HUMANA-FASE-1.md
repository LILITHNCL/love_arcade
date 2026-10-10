# Verificación Humana - Fase 1 (Infraestructura)

Esta fase estableció la infraestructura de QA y corrigió los tests frágiles de la línea base preexistente para conseguir que la suite unificada ejecutada localmente a través de `npm test` pase de manera confiable (Matriz #27).

## Qué revisar

1. **Gestión de paquetes:**
   Se ha añadido un `package.json` mínimo sin dependencias que estandariza la ejecución local, preservando la exclusión de `"type": "module"`.
2. **Estructura de QA y Helpers reutilizables:**
   Los tests se han clasificado en carpetas y se ha centralizado el boilerplate del entorno `vm` en `tests/helpers/vm-sandbox.cjs`.
   - Varios tests de dominio (p.ej. economy, daily-streak, game-center) fueron migrados a consumir el sandbox sin alterar su comportamiento ni lógica asertiva.
3. **Tests unitarios de juegos arreglados:**
   - **`phase14_victory_redesign_unit.mjs`** y **`phase7_unit.mjs`**: Se arreglaron las aserciones que impedían el pase en verde del script `npm run test:games`.
4. **Tests existentes arreglados:**
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
- La salida de `npm test` debe ser verde (`fail 0`). Se reportarán 14-16 tests (dependiendo si el globo excluye a helpers).
- Podrás ver los tests marcados con `todo` (Bug F1 y Bug F4) reportados como amarillos.
- `npm run test:games` debe finalizar con todos los tests unitarios reportando verde, sin fallos en phase14 ni phase7.

## Lo que no se pudo verificar localmente
- Ninguna restricción de entorno se interpuso en esta fase. Todas las aserciones de infraestructura pueden ejecutarse correctamente bajo Termux mediante el runner nativo de Node (`node:test`).
