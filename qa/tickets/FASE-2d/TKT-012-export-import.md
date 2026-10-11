# TKT-012: Exportar e importar partida (corrupción y rama legacy)

- **ID y título**: TKT-012 — `exportSave` / `importSave`
- **Fase**: F2d (matriz de cobertura #12)
- **Prioridad**: P0 (corrupción, no mutar) / P1 (R3, rama legacy)
- **Dependencias**: `js/core/config.js`, `js/core/utils.js` (`sha256` real), `js/core/state-store.js`, dominios de `js/domain/*` cargados en el sandbox VM (`tests/helpers/vm-sandbox.cjs`).

## Riesgo que cubre
| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Importar un código corrupto destruye la partida | base64 truncado, un carácter alterado, JSON roto | `importSave` muta el store antes de validar | `js/domain/game-center.js:40-64` |
| Código manipulado con checksum falso | `{data, checksum:'fake_hash'}` | Se quita o rompe la comparación de checksum | `js/domain/game-center.js:51-53` |
| JSON válido sin `coins` numérico | `{"progress":{}}` | Se pierde la validación `typeof data.coins` | `js/domain/game-center.js:57` |
| Entradas no-string / vacías / base64 inválido | `null`, `undefined`, `''`, `123`, `'no-base64!!'` | El `catch` externo deja de devolver `success:false` | `js/domain/game-center.js:61-63` |
| R3: la rama legacy acepta JSON sin checksum | `{coins:9999,...}` en base64 | Inyección de monedas sin firma (BUG-F2d-01) | `js/domain/game-center.js:51,55,57-58` |

## Tipo y herramienta
Test unitario/de dominio con `node:test` + `node:assert/strict`, código real de producción cargado en `vm` (sandbox del proyecto). Sin dependencias nuevas.

## Archivos
- Crear/modificar: `tests/domain/save-export-import.test.mjs`
- Documentación: este ticket, `qa/BUGS-ENCONTRADOS.md` (BUG-F2d-01), `qa/99-huecos.md` (sección F2d).
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)
1. Estado válido (coins 987) → se exporta e importa → el store conserva `coins === 987`. (`save-export-import.test.mjs:27`)
2. Base64 truncado, un carácter alterado o JSON roto → se importa → `success:false` y store idéntico (P0). (`:39`)
3. Payload con `checksum:'fake_hash'` y `coins:9999` → se importa → `success:false` y store idéntico. (`:62`)
4. R3: payload sin checksum `{coins:9999}` → se importa → **debería** rechazarse y no mutar. Hoy acepta y muta (`9999 !== 150`); marcado `todo` BUG-F2d-01. (`:78`)
5. Entradas `null`, `undefined`, `''`, `123`, `'no-base64!!'` → se importa → `success:false` y store idéntico. (`:93`)
6. JSON válido sin `coins` (`{"progress":{}}`) → se importa → `success:false`. (`:105`)

## Qué NO se mockea
- `sha256` real (`crypto.subtle` vía `js/core/utils.js`), `TextEncoder`/`TextDecoder`, store real (`state-store.js`), `migrate`/`replaceStore`.
- `btoa`/`atob`: los globales de Node (WHATWG, igual semántica que el navegador); el shim `Buffer` del test (líneas 9-10) solo actúa si no existen y en Node 26 no se usa.
- Sí se mockea `workerTask` (siempre rechaza) para forzar el fallback del hilo principal.

> **Nota: qué oculta el worker falso.** Con `workerTask` rechazando se ejecuta solo el fallback (`game-center.js:30-37` y `:48-55`); el código de `js/sync-worker.js` (`exportStore` L37-47, `importStore` L75-99) **no se ejecuta**. El worker real **no hace gzip** en `export`/`import`: gzip solo existe en `backup-export`/`backup-import` (`sync-worker.js:49-67,114-121`). El formato es el mismo (JSON `{data, checksum}` → UTF-8 → base64; checksum = SHA-256 de `JSON.stringify(data)+salt`), por lo que un código de uno lo importa el otro. Lo que sí queda sin cubrir: la ruta `result.valid` (`game-center.js:44-46`), la ejecución real en un `Worker` y las diferencias de `atob`/`crypto` dentro del worker.

## Criterios de aceptación
- [x] Ida y vuelta conserva el estado (esc. 1).
- [x] No-string, vacías o base64 inválido → `success:false` sin mutar el store (esc. 5, `:93`).
- [x] JSON roto o base64 truncado → error sin mutar (esc. 2, P0).
- [x] Checksum alterado → rechazado sin mutar (esc. 3).
- [x] Sin `coins` numérico → rechazado (esc. 6).
- [x] R3 verificado: el test deseado falla hoy y está como `todo` → BUG-F2d-01 (`qa/BUGS-ENCONTRADOS.md`).
- [x] Ejecutado forzando el fallback; ver nota del worker falso.

## Mutaciones (verificación)
| Mutación | archivo:línea | Test que falló | Revertida |
| --- | --- | --- | --- |
| 1. Quitar la comparación `payload.checksum !== expected` | `js/domain/game-center.js:53` | `dado payload modificado con checksum falso…` (`:62`) | Sí |
| 2. Quitar `typeof data.coins !== 'number'` | `js/domain/game-center.js:57` | `dado payload JSON válido sin monedas…` (`:105`) | Sí |
| 3. Escribir en el store (`replaceStore`) antes de validar checksum | `js/domain/game-center.js:51` | `dado payload modificado con checksum falso…` (`:62`, store mutado a coins 9999) | Sí |
| 4. Quitar el rechazo (el `catch` externo relanza en vez de devolver `success:false`) | `js/domain/game-center.js:61-63` | `:39`, `:93` y `:105` | Sí |

Notas: el código no tiene una guarda explícita para no-string/vacío; el rechazo depende de que `code.trim()`/`atob`/`JSON.parse` lancen y del `catch` externo, por eso la mutación 4 se aplica sobre el `catch`. Ningún mutante sobrevivió. Tras cada mutación `git diff --stat` de producción quedó vacío.

## Comando
`node --test tests/domain/save-export-import.test.mjs`

## Estado
hecho (con 1 `todo`: BUG-F2d-01, pendiente de decisión humana).
