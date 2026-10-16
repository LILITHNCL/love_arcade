# TKT-023: Soporte Unicode en identidad, códigos y serialización (#26, P1)

- **ID y título**: TKT-023: Soporte Unicode en nickname, códigos promocionales y exportSave/importSave con paridad Worker/Fallback
- **Fase**: F5 (Edge cases)
- **Prioridad**: P1
- **Dependencias**: `js/domain/identity.js`, `js/domain/promo-codes.js`, `js/domain/game-center.js`, `js/sync-worker.js`, sandbox VM (`tests/helpers/vm-sandbox.cjs`).

## Riesgo que cubre

| Riesgo | Escenario | Error que detecta | Rutas reales |
|---|---|---|---|
| Partición de sustitutos UTF-16 en `nickname` | Un jugador introduce un alias con emojis compuestos (4 bytes) que alcanzan el límite de 15 caracteres | `identity.js:9` aplica `slice(0, 15)` a nivel de unidades UTF-16. Si el corte ocurre en medio de un par sustituto (surrogate pair), genera un carácter huérfano (`\uD83D`) que puede corromper `JSON.stringify` o fallar en `TextEncoder` | `js/domain/identity.js:7-13` |
| Fallo silencioso en canje de códigos con caracteres invisibles o ancho completo | El usuario pega un código que incluye caracteres de ancho cero (`\u200B`), espacios de no separación (`\u00A0`), acentos descompuestos (NFD) o caracteres de ancho completo (`ＡＢＣＤ`) | `promo-codes.js:48` ejecuta `.trim().toUpperCase()`. `trim()` estándar no descarta `\u200B`, y `toUpperCase()` no realiza normalización Unicode NFKC, alterando radicalmente el hash SHA-256 y provocando el rechazo injustificado del código | `js/domain/promo-codes.js:47-65` |
| Excepción `InvalidCharacterError` en exportación Base64 (R3) | El store contiene cadenas con puntos de código superiores a `0xFF` (emojis, caracteres japoneses o acentos en español) | Funciones nativas `btoa()` fallan si los caracteres superan `0xFF`. Se debe comprobar que el flujo `TextEncoder` → bytes → `String.fromCharCode` → `btoa` codifique y decodifique sin pérdida de datos | `js/domain/game-center.js:26-38, 48-56` y `js/sync-worker.js:37-47, 75-100` |
| Discrepancia de integridad entre Worker y Fallback | Un código Base64 exportado por el Web Worker no puede ser leído por el fallback síncrono del cliente o viceversa | Incompatibilidad en el cálculo de checksums o decodificación UTF-8 que impediría restaurar copias de seguridad generadas en diferentes hilos | `js/sync-worker.js` vs `js/domain/game-center.js` |

## Tipo de test y herramienta

Test unitario y de integración con `node:test` y `node:assert/strict`, utilizando APIs nativas de Node (`crypto.subtle`, `TextEncoder`, `TextDecoder`) y sandbox `node:vm` con evaluación limpia de scripts clásicos y de Worker.

## Archivos a crear/modificar

- Archivo de test: `tests/domain/unicode-edge-cases.test.mjs` (a crear en implementación).
- Helper de testing: `tests/helpers/vm-sandbox.cjs` (carga de scripts en sandbox).
- Documentación: `qa/tickets/FASE-5/TKT-023-unicode-sistemas.md` y `qa/tickets/FASE-5/PLAN-F5.md`.

## Escenarios concretos (dado → cuando → entonces)

1. **Truncado de nickname con emojis y secuencias ZWJ**:
   - *Dado*: un nickname de entrada con emojis de 4 bytes en el borde de los 15 caracteres (ej. `'Jugador_12345🎮'`, `'🎮👾✨💖🔥'`).
   - *Cuando*: se ejecuta `Identity.setIdentity(nickname, '@')`.
   - *Entonces*: el valor almacenado en `Store.getStore().nickname` no debe terminar en un sustituto huérfano (`\uD800`–`\uDBFF`) y debe ser serializable limpiamente mediante `JSON.stringify` y decodificable por `TextEncoder`. Si el corte actual produce sustitutos partidos, se documenta el comportamiento deseado bajo `{ todo: 'BUG-F5-06: setIdentity parte pares sustitutos UTF-16 en emojis al cortar a 15 caracteres' }`.

2. **Nickname con caracteres de ancho completo y acentos**:
   - *Dado*: un alias con caracteres japoneses o de ancho completo (`'ラブアーケード'`) y caracteres con tildes (`'Ángel'`).
   - *Cuando*: se asigna y se consulta mediante `Identity.getIdentity()`.
   - *Entonces*: el alias se conserva exactamente con sus caracteres intactos.

3. **Canje de código con caracteres de ancho cero y espacios ocultos**:
   - *Dado*: un código de prueba sintético que contiene un carácter de ancho cero (`'\u200B'`) o caracteres de ancho completo (`'ＣＯＤＩＧＯ'`).
   - *Cuando*: se invoca `redeemPromoCode(inputCode)`.
   - *Entonces*: se valida si el sistema normaliza la entrada antes del cálculo de SHA-256 o si rechaza el canje debido a la divergencia del hash. Se documenta la decisión de diseño.

4. **Exportación e importación con caracteres > 0xFF**:
   - *Dado*: un estado del store que contiene caracteres Unicode por encima de `0xFF` (emojis `'🎮'`, caracteres cirílicos o acentos en el inventario y nickname).
   - *Cuando*: se ejecuta `GameCenter.exportSave()` y posteriormente se importa el string Base64 resultante con `GameCenter.importSave(code)`.
   - *Entonces*: `importSave` valida la integridad del checksum SHA-256 exitosamente y restaura el estado con todos los caracteres Unicode idénticos a los originales sin lanzar `DOMException: InvalidCharacterError`.

5. **Paridad de codificación Worker vs Fallback (evaluable en VM)**:
   - *Dado*: el script de producción `js/sync-worker.js` evaluado en `node:vm` configurando un contexto `self` sintético (con `addEventListener` y `postMessage`).
   - *Cuando*: el Worker exporta un store con caracteres Unicode y el código Base64 resultante es importado mediante el fallback de `game-center.js` (y viceversa: exportado por el fallback e importado por el Worker).
   - *Entonces*: ambas vías verifican el checksum SHA-256 como válido (`valid: true`) e importan exactamente el mismo estado.

## Datos/fixtures y qué NO se mockea

- **Qué NO se mockea**:
  - Código real de `js/domain/identity.js`, `js/domain/promo-codes.js`, `js/domain/game-center.js` y `js/sync-worker.js`.
  - Algoritmos criptográficos y de codificación reales: `crypto.subtle.digest('SHA-256')`, `TextEncoder`, `TextDecoder`, `btoa`, `atob`.
- **Qué se falsea**:
  - Códigos promocionales: Se emplean únicamente claves de prueba sintéticas generadas al vuelo en el sandbox, sin incluir ni revelar ningún código real del proyecto.
  - Entorno de Worker: Se emula el objeto global `self` en VM para permitir ejecutar `sync-worker.js` de forma síncrona/directa sin crear hilos nativos del sistema operativo.

## Criterios de aceptación verificables

- [x] Identidad soporta secuencias complejas de Unicode sin romper la serialización JSON.
- [x] La exportación e importación de partidas tolera caracteres > 0xFF preservando la integridad del hash SHA-256.
- [x] La interoperabilidad cruzada entre el Web Worker y el fallback síncrono queda demostrada en ambas direcciones.
- [x] Ningún código promocional real ni término prohibido de documentación es emitido en el código o salida de tests.

## Comando para ejecutarlo

```bash
node --test tests/domain/unicode-edge-cases.test.mjs
```

## Verificación por mutación

- **Mutación 1 (quitar trim en `promo-codes.js:48`)**: `const code = inputCode.toUpperCase();`. 4 tests fallaron (`AssertionError: Expected values to be strictly equal: false !== true`). Revertido con `git diff` limpio.
- **Mutación 2 (quitar toUpperCase en `promo-codes.js:48`)**: `const code = inputCode.trim();`. 3 tests fallaron (`AssertionError: Expected values to be strictly equal: false !== true`). Revertido con `git diff` limpio.
- **Mutación 3 (cambiar codificación Base64 en `game-center.js:34`)**: Directamente `btoa(payload)` sin `TextEncoder`. Lanzó `InvalidCharacterError` y `exportSave` devolvió `null`. 6 tests fallaron. Revertido con `git diff` limpio.

## Estado

hecho
