# 02 — Estrategia de testing

Fuente: [01-diagnostico.md](01-diagnostico.md). Reglas: [ESTRATEGIA-AGENTE.md](ESTRATEGIA-AGENTE.md) y [AGENTS.md](../AGENTS.md).

## 1. Tipos de test: cuáles sí, cuáles no y por qué

| Tipo | ¿Sí/No? | Justificación (con evidencia) |
|---|---|---|
| Unitario de dominio y core | **Sí** (núcleo) | La lógica crítica es pura sobre `LoveArcadeStore` y no toca el DOM: [economy.js](../js/domain/economy.js), [daily-streak.js](../js/domain/daily-streak.js), [time-sync.js](../js/core/time-sync.js), [state-store.js](../js/core/state-store.js). El patrón `node:vm` ya funciona en `tests/domain/` |
| Integración entre módulos (sin navegador) | **Sí** | Riesgos R1-R8 están en las fronteras: bridge↔store, Sentinel↔localStorage↔Supabase, backup↔worker, SW↔caché, handlers de `api/` |
| Handlers serverless | **Sí** | `api/*.js` exportan `handler(req,res)` puros: se importan en Node con `req`/`res` falsos y `fetch` a Telegram sustituido |
| Estático o de contrato | **Sí, poco** | Útil donde el fallo es un artefacto: catálogo ([shop.json](../data/shop.json)), lista de precache que debe existir en disco (R9), orden de scripts del bridge. **No** a regex sobre CSS o comentarios |
| E2E con navegador | **Sí, pocos (≤ 7 flujos)** | Solo flujos que cruzan UI + store + persistencia + recarga. **No se puede ejecutar aquí** (no hay navegador): se verifica en la máquina del usuario |
| Componentes UI con DOM simulado (jsdom) | **No** | La UI depende de layout, `IntersectionObserver`, animaciones, Rive/WASM y orden de scripts globales. Simularlo exigiría mocks extensos acoplados a la implementación; esos flujos quedan cubiertos por E2E |
| Snapshot / visual regression | **No** | Prohibido snapshot indiscriminado; el visual requiere navegador y baseline mantenida |
| Accesibilidad automatizada | **Condicional (F7)** | Hay formularios (login cloud, código promo), diálogos y `aria-live`. Requiere navegador → solo con E2E. Se decide al cerrar F4 |
| Performance / carga | **No** | No hay presupuesto de rendimiento definido ni backend propio que cargar; medirlo en ARM/Termux no es representativo. El único caso medible (generación de puzzles en `phase7_unit.mjs`) demuestra que los umbrales de tiempo son frágiles |
| Mutation testing automatizado (Stryker) | **No** | Requiere configuración y dependencias, y es muy lento en ARM. La verificación por mutación se hace **manual** por ticket P0/P1 (regla de cierre de fase) |

## 2. Stack mínimo

| Herramienta | Qué cubre | Alternativa descartada y por qué | Coste de mantenimiento |
|---|---|---|---|
| `node:test` + `node:assert/strict` (incluidos en Node) | Runner, agrupación, `todo` para fallos esperados, `--test-reporter`, `--watch` | **Vitest/Jest**: añaden `package.json` con dependencias, transformaciones y un entorno propio que choca con el patrón actual de scripts clásicos evaluados con `vm`. No aportan nada que falte aquí | Nulo en dependencias; solo hay que seguir la versión de Node |
| `node:vm` (incluido) | Carga los scripts clásicos reales (sin modificarlos) en un sandbox con `window`/`localStorage` falsos, en el orden de [index.html](../index.html) | **Convertir el código a ESM para importarlo**: obliga a modificar producción (prohibido) | Bajo: un helper compartido sustituye al bloque de sandbox que hoy se copia en cada test |
| APIs reales de Node: `crypto.subtle`, `CompressionStream`, `TextEncoder` | SHA-256, gzip y base64 **reales** en sync-worker, backup y promo (no se mockean) | Mockear `sha256`: ocultaría fallos de codificación (R3, R4) | Nulo |
| `@playwright/test` (**solo devDependency, solo F4/F7**) | E2E en Chromium + emulación móvil; servidor web integrado; trazas | **Cypress**: más pesado, sin WebKit, más dependencias. **Puppeteer**: solo Chromium y sin runner propio (habría que añadir otro) | Medio: ~300 MB de navegadores en la máquina del usuario y actualizar versión 1-2 veces al año. **No se instala ni ejecuta en este entorno** |
| Servidor estático propio en Node (~30 líneas, `tests/e2e/serve.mjs`) | Servir el repo en la raíz (el bridge usa rutas absolutas `/js/...`) para Playwright | **`npx serve` / `http-server`**: otra dependencia. **`python3 -m http.server`**: Python no está garantizado en la máquina del usuario | Bajo |
| `@axe-core/playwright` (**condicional, F7**) | Reglas WCAG sobre el DOM real | Lighthouse: más pesado y orientado a performance | Bajo; solo si se aprueba F7 |

Cobertura: `node --test --experimental-test-coverage` como **información, no como gate**. Es probable que no atribuya el código evaluado vía `vm`; se comprobará en F1 y se documentará el resultado.

**Requiere tu aprobación**: crear un `package.json` mínimo (`"private": true`, solo `scripts`; sin dependencias de runtime). Playwright se añadiría como `devDependency` al empezar F4, no antes.

## 3. Límites del entorno (registrados)

- Android/Termux `aarch64`, Node v26.4.0, npm 11.20.0, Python 3.14.6, registro npm accesible.
- **Sin navegador**: Playwright no publica binarios para Android. F4 y F7 se escriben aquí, pero **no se marcan como verificados**; se entregan con `VERIFICACION-HUMANA-FASE-N.md`.
- Supabase, Telegram y Cloudinary reales: **no se usan** (no hay credenciales ni deben usarse en tests). Las políticas RLS y el comportamiento real de Supabase quedan como verificación humana.
- CPU lenta: no se usan umbrales de tiempo en ms; los tests asíncronos usan reloj falso o esperas por condición.

## 4. Convenciones

- **Nombre**: `*.test.mjs`. Títulos en español con la forma "dado … cuando … entonces …".
- **Estructura**: `describe`/`test` de `node:test` (un fallo no detiene el resto del archivo). Los tests existentes de aserciones planas se migran solo cuando un ticket los toca.
- **Qué se carga real**: todo el código de producción (`js/**`, `api/**`, `sw.js`) se evalúa sin modificar.
- **Qué se falsea** (y queda anotado en cada ticket):
  - `localStorage` (Map, con opción de lanzar `QuotaExceededError`);
  - reloj (`Date.now` controlable);
  - `fetch` de red;
  - cliente Supabase (en memoria);
  - `res` de Vercel;
  - `caches`/`self` del SW.
- **Fallos esperados**: un bug real se documenta en `BUGS-ENCONTRADOS.md` y su test se marca `{ todo: 'BUG-NNN: motivo' }`. Riesgo conocido: un `todo` que empiece a pasar no avisa. Por eso en cada cierre de fase se revisa la lista de `todo`.
- **Prohibido**:
  - regex sobre CSS o comentarios;
  - versiones literales (por ejemplo `CACHE_VERSION`);
  - contar llamadas internas;
  - `sleep` fijos.
- **Selectores E2E**: rol y nombre accesible primero, después texto y después `id` existente. `data-testid` solo si no hay alternativa (y se anota en el ticket).

## 5. Estructura de carpetas propuesta

```
tests/
  helpers/          sandbox vm (orden de scripts), localStorage falso, reloj, fake Supabase, req/res
  core/             state-store, time-sync, utils
  domain/           (existente) economía, racha, promo, avatar, game-center, moon-blessing, import/export
  integration/      bridge↔store, sentinel, backup↔worker
  api/              report, client-config
  pwa/              sw.js (precache existe en disco, estrategias de fetch)
  static/           catálogo y contrato de scripts (tests estáticos que sobrevivan a la auditoría)
  e2e/              Playwright + serve.mjs (excluido de `node --test`)
games/jigsaw/test/  se mantiene en su sitio; los *_playwright.js quedan fuera de la suite local
```

## 6. Comandos locales (objetivo tras F1)

| Comando | Qué ejecuta | ¿Ejecutable aquí? |
|---|---|---|
| `npm test` → `node --test "tests/**/*.test.mjs"` | Suite principal (sin e2e) | Sí |
| `npm run test:games` | Tests unitarios de Marejig (sin `*_playwright.js`) | Sí |
| `npm run test:e2e` → `playwright test` | E2E | **No** (máquina del usuario) |
| `node --test tests/ruta/archivo.test.mjs` | Un archivo | Sí |

Si no apruebas `package.json`, los mismos comandos se documentan como `node --test ...` directos.
