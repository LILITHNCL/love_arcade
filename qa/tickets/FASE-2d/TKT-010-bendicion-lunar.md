# TKT-010: Bendición Lunar

**Fase**: F2d
**Matriz de cobertura**: #10
**Prioridad**: P1

## Objetivo
Verificar la compra y extensión de la Bendición Lunar (`js/domain/moon-blessing.js`).

## Criterios de aceptación
- Compra con saldo ≥ 100 cobra 100 monedas y fija expiración a 7 días.
- Compra con saldo 100 cobra 100; con saldo 99 no cobra y no muta saldo.
- Compra con bendición activa añade 7 días a la expiración vigente.
- Compra con bendición inactiva (o no existente) suma 7 días al momento actual.
- `extendMoonBlessingDays` debe manejar correctamente días 0, negativos, NaN, string, Infinity y decimales.
- El historial de transacciones debe reflejar la compra y las extensiones.
- Todo testeado con reloj falso (`node:test` y `node:assert`).

## Tareas
- [x] Crear `tests/domain/moon-blessing.test.mjs` usando `vm-sandbox.cjs`.
- [x] Ejecutar tests.
- [x] Mutación 1: quitar cobro o alterar coste a 0.
- [x] Mutación 2: alterar expiración (en lugar de +7 días, poner +0 o no sumar sobre la vigente).
- [x] Verificar fallos de mutación.
