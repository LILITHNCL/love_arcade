# TKT-010: Bendición Lunar

- **ID y título**: TKT-010 — Bendición Lunar (`buyMoonBlessing` / `extendMoonBlessingDays` / `getMoonBlessingStatus`)
- **Fase**: F2d (matriz de cobertura #10)
- **Prioridad**: P1
- **Dependencias**: `js/core/config.js`, `js/core/state-store.js`, `js/domain/history.js`, `js/domain/moon-blessing.js`, sandbox VM (`tests/helpers/vm-sandbox.cjs`).

## Riesgo que cubre
| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Activar buff gratis o con saldo insuficiente | Saldo < 100 o cobro a 0 | No descuenta monedas o permite compra con saldo 99 | `js/domain/moon-blessing.js:14,18-25,29` |
| Duración incorrecta o no acumulativa | Buff ya activo / expirado | No suma 7 días (86.400.000 ms) o no acumula sobre la expiración activa | `js/domain/moon-blessing.js:15,28,30,43-44` |
| Expiración en el pasado | `moonBlessingExpiry < now` | Extiende desde fecha antigua en vez de `now` | `js/domain/moon-blessing.js:28,30,43` |
| Corrupción por días inválidos en extensión | 0, negativos, NaN, Infinity | Acepta valores inválidos y corrompe `moonBlessingExpiry` | `js/domain/moon-blessing.js:38-39` |
| Transacción financiera sin auditoría | Compra o extensión aplicada | No registra en el historial | `js/domain/moon-blessing.js:31,45` |

## Tipo y herramienta
Test unitario/de dominio con `node:test` y `node:assert/strict`, ejecutado en el sandbox de VM del proyecto.

## Archivos
- Crear/modificar: `tests/domain/moon-blessing.test.mjs`
- Documentación: este ticket, `qa/99-huecos.md` (sección F2d).
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)
1. Saldo 150 (suficiente) → compra → cobra 100, fija 7 días a partir de `fakeNow`, registra gasto en historial (`moon-blessing.test.mjs:10`).
2. Límite de saldo: 99 falla sin mutar saldo ni expiración; 100 pasa, cobra 100 y fija 7 días (`:30`).
3. Bendición activa (`fakeNow + 100000`) → compra → acumula 7 días sobre la expiración vigente (`:52`).
4. Días inválidos (0, -5, NaN, Infinity) → extensión → `success: false` sin mutar expiración (`:68`).
5. Entrada string `"5"` y decimal `5.9` → extensión → `Math.floor` extrae entero (5 días cada uno) acumulando (`:86`).
6. Expiración en el pasado (`fakeNow - 5000`) → compra o extensión → toma `now` como base y no la fecha caducada (`:105`).
7. Extensión con 0 o -2 días no registra en historial; extensión con 3 días registra tipo 'ingreso', cantidad 0 y motivo correspondiente (`:123`).

## Qué NO se mockea
- `LoveArcadeStore` (`state-store.js`), `LoveArcadeHistory` (`history.js`), lógica de `moon-blessing.js`.
- Se mockea `Date.now` con un reloj fijo determinista (`sandbox.setMockNow(1700000000000)`).
> **Nota sobre Date.now fijo:** El reloj congelado garantiza determinismo en los cálculos de expiración (`fakeNow + DURATION_MS`), pero oculta cualquier comportamiento dependiente del paso del tiempo o manipulación offline del reloj del sistema por parte del usuario.

## Criterios de aceptación
- [x] Cobro exacto de 100 y 7 días de duración.
- [x] Límite estricto de saldo: 100 pasa, 99 falla sin mutación.
- [x] Acumulación sobre expiración vigente si está activa.
- [x] Si expiró en el pasado, parte desde `now`.
- [x] Rechazo de días inválidos (0, negativos, NaN, Infinity).
- [x] Manejo de string y decimales vía `Math.floor`.
- [x] Registro en el historial tanto para compra como para extensiones aplicadas.

## Mutaciones (verificación)
| Mutación | archivo:línea | Test que falló | Revertida |
| --- | --- | --- | --- |
| 1. Coste a 0 (`COST = 0`) | `js/domain/moon-blessing.js:14` | `:10`, `:30`, `:52` | Sí |
| 2. Duración a 0 (`DURATION = 0`) | `js/domain/moon-blessing.js:15` | `:10`, `:30`, `:52`, `:105` | Sí |
| 3. No acumular sobre vigente (usar siempre `now`) | `js/domain/moon-blessing.js:30` | `:52` | Sí |
| 4. `>=` a `>` en saldo (`store.coins <= COST`) | `js/domain/moon-blessing.js:18` | `:30` (saldo 100 falla) | Sí |
| 5a. Días inválidos: permitir 0 (`wholeDays < 0`) | `js/domain/moon-blessing.js:39` | `:68`, `:123` | Sí |
| 5b. Días inválidos: permitir negativos (`wholeDays === 0`) | `js/domain/moon-blessing.js:39` | `:68`, `:123` | Sí |
| 5c. Días inválidos: permitir NaN (`wholeDays === Infinity`) | `js/domain/moon-blessing.js:39` | `:68` | Sí |
| 5d. Días inválidos: permitir Infinity (`Number.isNaN(wholeDays)`) | `js/domain/moon-blessing.js:39` | `:68` | Sí |
| 6a. Quitar historial en compra | `js/domain/moon-blessing.js:31` | `:10` | Sí |
| 6b. Quitar historial en extensión | `js/domain/moon-blessing.js:45` | `:123` | Sí |
| 7. En `extendMoonBlessingDays`, `baseTs = now` (no acumular sobre la vigente) | `js/domain/moon-blessing.js:43` | `:86` | Sí |
| 8. `isActive` con `> 0` en lugar de `> now` en `buyMoonBlessing` | `js/domain/moon-blessing.js:28` | `:105` | Sí |
| 9. `baseTs` con `> 0` en lugar de `> now` en `extendMoonBlessingDays` | `js/domain/moon-blessing.js:43` | `:105` | Sí |

## Comando
`node --test tests/domain/moon-blessing.test.mjs`

## Estado
hecho
