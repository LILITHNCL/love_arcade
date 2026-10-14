# TKT-017: Contrato del bridge (#16, P0)

- **ID y título**: TKT-017 — Contrato de integración del bridge (`js/game-bridge.js` y `js/game-bridge-runtime.js`)
- **Fase**: F3b (Integración: bridge, SW y API)
- **Prioridad**: P0
- **Dependencias**: `js/game-bridge.js`, `js/game-bridge-runtime.js`, `games/*/index.html`, sandbox VM (`tests/helpers/vm-sandbox.cjs`).

## Entorno y mecanismo de carga
- **Formato**: Scripts clásicos de navegador sin sistema de módulos (`IIFE`). No exportan mediante CJS ni ESM; se evalúan en el ámbito global `window`.
- **Lectura de `process.env`**: No leen `process.env` en ningún momento (código exclusivo de cliente).
- **Mecanismo de prueba**: Ejecución en sandbox `node:vm` configurando objetos globales de navegador (`window`, `document`, `localStorage`).

## Auditoría Paso 4: Cobertura existente vs Huecos reales

### Ya cubierto en `tests/integration/game-bridge.test.mjs`
1. Inyección síncrona de las 6 dependencias clásicas (`/js/core/config.js`, `/js/core/state-store.js`, `/js/domain/history.js`, `/js/domain/economy.js`, `/js/domain/identity.js`, `/js/game-bridge-runtime.js`) mediante `document.write` cuando el contexto está limpio (`document.writes.length === 1`).
2. Exposición en `window.GameCenter` de sus 8 métodos públicos: `completeLevel`, `getBalance`, `getHistory`, `addCoins`, `spendCoins`, `buyItem`, `getIdentity`, `hasIdentity`.
3. Idempotencia básica de `completeLevel`: primera llamada acredita recompensa (`paid: true`), llamadas repetidas con mismo `gameId` y `levelId` no duplican saldo (`paid: false`).
4. Persistencia en la clave compartida de hub `gamecenter_v6_promos` tras invocar `completeLevel`.
5. Exposición global de `window.CONFIG`, `window.ECONOMY`, `window.THEMES`.
6. Verificación estática de que los 8 juegos en `games/*/index.html` cargan `../../js/game-bridge.js` antes de su punto de entrada y no cargan `../../js/app.js`.

### Huecos reales que cubre este ticket
1. **R10 en HTML (declaración clásica estricta)**: La verificación previa en `game-bridge.test.mjs` comprobaba que el archivo aparecía antes del entrypoint mediante regex general, pero NO aseguraba que la etiqueta `<script src="../../js/game-bridge.js"></script>` fuera síncrona clásica estricta (es decir, sin atributos `defer`, sin `async` y sin `type="module"`). Un juego con `defer`/`async`/`module` rompería el contrato de `document.write` en el navegador.
2. **R10 en runtime (guarda ante entorno no clásico)**: `js/game-bridge.js:31-33` implementa la guarda `if (typeof document === 'undefined' || typeof document.write !== 'function') throw new Error('[LoveArcade game bridge] Debe cargarse como script clásico durante el parseo del documento.');`. No existe test de comportamiento que valide que el error exacto se lanza cuando `document` es `undefined` o `document.write` no es función (ej. ejecución en worker, módulo ES diferido tras parseo).
3. **Carga condicional e idempotencia de dependencias (`dependenciesReady`)**: `js/game-bridge.js:13-28` evalúa si las dependencias ya existen en `window`.
   - Si las dependencias están listas y `window.GameCenter` ya existe: no debe emitir scripts a `document.write` (`sourcesToWrite` vacío).
   - Si las dependencias están listas pero `window.GameCenter` no existe: debe inyectar únicamente `/js/game-bridge-runtime.js`.
   Este comportamiento condicional no está probado por ningún test.
4. **Interoperabilidad completa de economía desde el bridge hacia el store del hub**: Aunque `completeLevel` fue probado, las operaciones de `addCoins`, `spendCoins` y `buyItem` invocadas desde la fachada `window.GameCenter` del bridge no tenían tests que confirmaran que mutan directamente la clave de almacenamiento del hub `gamecenter_v6_promos` con idéntico formato y reflejo en `LoveArcadeStore.getStore()`.

## Riesgo que cubre

| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Invocación diferida o asíncrona del bridge (R10) | Un minijuego incluye `game-bridge.js` con `defer`, `async` o `type="module"` en su HTML | En navegadores reales `document.write` tras el parseo sobreescribe la página entera o lanza advertencia/error sin cargar dependencias | `games/*/index.html` y `js/game-bridge.js:31-35` |
| Ejecución en entorno sin DOM o tras parseo (R10) | Se evalúa `game-bridge.js` sin objeto `document` o con `document.write` nulo | Debe lanzar de forma síncrona y controlada el error de contrato en vez de fallar con `TypeError` genérico | `js/game-bridge.js:31-33` |
| Inyección redundante de dependencias | `game-bridge.js` se evalúa en una página que ya cargó el store o las dependencias core | Inyectaría de nuevo los scripts provocando reinicialización de módulos y pérdida de estado en memoria | `js/game-bridge.js:13-28` |
| Inconsistencia de saldo entre bridge y store de hub | Minijuego compra un artículo (`buyItem`) o descuenta monedas (`spendCoins`) mediante `GameCenter` | Saldo o inventario no se guardan en `gamecenter_v6_promos`, desincronizando al volver al hub | `js/game-bridge-runtime.js:27-31` |

## Tipo y herramienta
Test de integración y contrato con `node:test` y `node:assert/strict`, ejecutado sobre el sandbox VM (`node:vm`) y lectura estática del DOM de los 8 minijuegos.

## Archivos
- Crear suite de tests: `tests/integration/game-bridge-contract.test.mjs`
- Modificar documentación: `qa/00-plan-maestro.md`, `qa/tickets/FASE-3b/TKT-000-indice.md`, este ticket.
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)

1. **R10 en HTML · Script clásico estricto**:
   - *Dado*: los 8 archivos `games/*/index.html`.
   - *Cuando*: se inspecciona la etiqueta `<script>` que carga `../../js/game-bridge.js`.
   - *Entonces*: la etiqueta no contiene el atributo `defer`, ni `async`, ni `type="module"`, garantizando evaluación síncrona bloqueante durante el parseo HTML.
2. **R10 en runtime · Entorno sin document o sin document.write**:
   - *Dado*: un contexto VM donde `document` es `undefined` (o `document.write` no es función).
   - *Cuando*: se evalúa `js/game-bridge.js`.
   - *Entonces*: lanza una excepción `Error` con el mensaje exacto `[LoveArcade game bridge] Debe cargarse como script clásico durante el parseo del documento.`.
3. **Idempotencia de dependencias · Todo listo**:
   - *Dado*: un contexto donde `CONFIG`, `ECONOMY`, `THEMES`, `LoveArcadeStore`, `LoveArcadeHistory`, `LoveArcadeEconomy`, `LoveArcadeIdentity` y `GameCenter` ya están definidos en `window`.
   - *Cuando*: se evalúa `js/game-bridge.js`.
   - *Entonces*: `document.writes.length` no incrementa (no inyecta ningún `<script>`).
4. **Idempotencia de dependencias · Dependencias listas pero sin GameCenter**:
   - *Dado*: un contexto donde las dependencias core ya están en `window` pero `window.GameCenter` es `undefined`.
   - *Cuando*: se evalúa `js/game-bridge.js`.
   - *Entonces*: `document.writes` contiene exactamente un `<script src="/js/game-bridge-runtime.js"></script>`, sin reinyectar las dependencias core.
5. **Persistencia cruzada · addCoins y spendCoins desde bridge**:
   - *Dado*: el bridge runtime cargado con saldo inicial en `gamecenter_v6_promos`.
   - *Cuando*: se invoca `GameCenter.addCoins(100)` y luego `GameCenter.spendCoins(30)`.
   - *Entonces*: el saldo se actualiza a 70 tanto en `GameCenter.getBalance()` como en `JSON.parse(localStorage.getItem('gamecenter_v6_promos')).coins`.
6. **Persistencia cruzada · buyItem desde bridge**:
   - *Dado*: bridge runtime con saldo de 200 monedas y catálogo cargado.
   - *When*: se invoca `GameCenter.buyItem({ id: 'item_test', price: 50 })`.
   - *Entonces*: la compra se procesa exitosamente, el inventario en `gamecenter_v6_promos` registra `'item_test'` y el saldo aplica la deducción con cashback reglamentario.

## Qué NO se mockea y qué se falsea
- **Qué NO se mockea**:
  - Código real de `js/game-bridge.js` y `js/game-bridge-runtime.js`.
  - Módulos reales de core y dominio (`js/core/config.js`, `js/core/state-store.js`, `js/domain/history.js`, `js/domain/economy.js`, `js/domain/identity.js`).
  - Archivos HTML reales de los 8 minijuegos (`games/*/index.html`).
- **Qué se falsea**:
  - `document.write` (captura las cadenas inyectadas en un array en memoria).
  - `localStorage` (almacén Map en memoria).
- **Problema que podría ocultar el mock**:
  - Un array de captura en `document.write` no simula el bloqueo de red real que experimenta el navegador al cargar recursos externos durante el parseo, ni los errores de red en la descarga de scripts.

## Criterios de aceptación
- [ ] Los 8 `games/*/index.html` declaran la carga de `game-bridge.js` sin `async`, sin `defer` y sin `type="module"`.
- [ ] `game-bridge.js` lanza el error descriptivo de contrato si `document` o `document.write` faltan.
- [ ] No se duplica la inyección de scripts si las dependencias core ya están presentes en el objeto global.
- [ ] Las operaciones de economía (`addCoins`, `spendCoins`, `buyItem`) invocadas desde `GameCenter` del bridge persisten coherentemente en `gamecenter_v6_promos`.

## Comando
```bash
node --test tests/integration/game-bridge-contract.test.mjs
```

## Estado
Pendiente
