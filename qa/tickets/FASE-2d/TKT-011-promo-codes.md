# TKT-011: Códigos Promocionales

- **ID y título**: TKT-011 — Códigos Promocionales (`redeemPromoCode`)
- **Fase**: F2d (matriz de cobertura #11)
- **Prioridad**: P1
- **Dependencias**: `js/core/config.js`, `js/core/utils.js` (`sha256` real con `crypto.subtle`), `js/core/state-store.js`, `js/domain/history.js`, `js/domain/promo-codes.js`, sandbox VM (`tests/helpers/vm-sandbox.cjs`).

## Riesgo que cubre
| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Códigos válidos rechazados por formato | Espacios alrededor o minúsculas | Falta de `.trim()` o `.toUpperCase()` | `js/domain/promo-codes.js:48` |
| Reutilización múltiple de códigos | Re-canje del mismo código o con variaciones de espacios/caso | No verifica `store.redeemedHashes.includes(hash)` | `js/domain/promo-codes.js:54-56` |
| Canje de códigos inexistentes | Código no listado en diccionario de hashes | Permite canje o asigna recompensa no autorizada | `js/domain/promo-codes.js:50-51` |
| Entradas no válidas (vacías, no-string) | `''`, `'   '`, `null`, `undefined`, números | Mutación accidental de saldo o historial | `js/domain/promo-codes.js:48-51` |
| Transacción sin registro en auditoría | Canje exitoso | No registra en el historial | `js/domain/promo-codes.js:60` |

## Tipo y herramienta
Test unitario/de dominio con `node:test` y `node:assert/strict`, ejecutado en el sandbox de VM del proyecto.

## Archivos
- Crear/modificar: `tests/domain/promo-codes.test.mjs`
- Documentación: este ticket, `qa/99-huecos.md` (sección F2d).
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)
1. Código inválido (`'invalido'`) → canje → `{ success: false, message: 'Código inválido' }` sin mutar saldo, hashes ni historial (`promo-codes.test.mjs:19`).
2. Código válido con espacios y minúsculas mixtas → canje → normaliza con trim y toUpperCase, suma monedas correspondientes, registra hash en `redeemedHashes` y agrega transacción tipo 'ingreso' en historial (`:28`).
3. Código ya canjeado → segundo intento (incluso variando mayúsculas/espacios) → `{ success: false, message: 'Ya canjeaste este código' }`, saldo e historial intactos (`:41`).
4. Código válido solo con espacios alrededor → canje → `success: true`, suma saldo (`:51`).
5. Código válido solo en minúsculas → canje → `success: true`, suma saldo (`:58`).
6. Cadena vacía o solo espacios (`''`, `'   '`) → canje → `{ success: false, message: 'Código inválido' }`, saldo e historial intactos (`:72`).
7. Entradas no-string (`null`, `undefined`, `1234`) → canje → lanza `TypeError` por `inputCode.trim()` sin mutar saldo, hashes ni historial (`:83`).

## Qué NO se mockea
- `sha256` real (`crypto.subtle` nativo mediante `js/core/utils.js`).
- `LoveArcadeStore` (`state-store.js`), `LoveArcadeHistory` (`history.js`).
- Diccionario de hashes `PROMO_CODES_HASHED` de `promo-codes.js`.
> **Nota de seguridad:** En ningún archivo de pruebas o documentación se exponen códigos promocionales reales en texto plano (R11). Las aserciones prueban el comportamiento contra un código de prueba canjeable del catálogo del proyecto sin exponer secretos adicionales.

## Criterios de aceptación
- [x] Normalización determinista: `trim()` y `toUpperCase()` probados de forma aislada.
- [x] Bloqueo de reutilización: hash almacenado en `redeemedHashes` impide segundo canje.
- [x] Entradas vacías devuelven `{ success: false }` sin mutar estado.
- [x] Entradas no-string lanzan `TypeError` y garantizan que el estado queda intacto.
- [x] Canje exitoso suma saldo y registra auditoría en `history`.
- [x] SHA-256 criptográfico real ejecutado en todas las verificaciones.

## Mutaciones (verificación)
| Mutación | archivo:línea | Test que falló | Revertida |
| --- | --- | --- | --- |
| 1. Quitar trim (`code = inputCode.toUpperCase()`) | `js/domain/promo-codes.js:48` | `:28`, `:41`, `:51` | Sí |
| 2. Quitar mayúsculas (`code = inputCode.trim()`) | `js/domain/promo-codes.js:48` | `:28`, `:41`, `:58` | Sí |
| 3. Quitar chequeo reutilización (`if (false)`) | `js/domain/promo-codes.js:54` | `:41` | Sí |
| 4. Quitar registro en historial | `js/domain/promo-codes.js:60` | `:28`, `:41` | Sí |

## Comando
`node --test tests/domain/promo-codes.test.mjs`

## Estado
hecho
