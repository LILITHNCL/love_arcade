# TKT-018: Service Worker, estrategias de fetch y ciclo de vida (#18, P1)

- **ID y título**: TKT-018 — Service Worker: estrategias de fetch, limpieza en activate y gestión offline (`sw.js`)
- **Fase**: F3b (Integración: bridge, SW y API)
- **Prioridad**: P1
- **Dependencias**: `sw.js`, sandbox VM (`node:vm`).

## Entorno y mecanismo de carga
- **Formato**: Script clásico de Service Worker (`sw.js`). No usa ESM ni CommonJS (`no export`).
- **Ámbito**: Se ejecuta en el contexto global de Service Worker (`self`), requiriendo las interfaces globales `caches`, `fetch`, `Request`, `Response`, `URL`.
- **Lectura de `process.env`**: No lee `process.env` (código de cliente de Service Worker).
- **Mecanismo de prueba**: Sandbox `node:vm` configurando `self`, `caches`, `fetch` y despacho manual de eventos `FetchEvent` y `ExtendableEvent` (`install`, `activate`, `fetch`).

## Riesgo que cubre

| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Fallo en imágenes de Cloudinary sin red | Jugador abre juego con imágenes alojadas en Cloudinary en modo offline | La app falla en mostrar el recurso o el fallback genérico (`/assets/icon/icon-192-any.png`) si no hay caché previa | `sw.js:116-130` |
| Interferencia de SW en peticiones mutables | El frontend realiza una petición POST (ej. telemetría en `/api/report`) | SW intercepta o corrompe peticiones con métodos distintos a GET rompiendo el flujo de red nativo | `sw.js:114` |
| Almacenamiento indiscriminado de errores y API en caché (R8) | El cliente solicita `/api/client-config` o un recurso inexistente (404/500) del mismo origen | SW guarda en caché respuestas no exitosas (`!response.ok`) o endpoints dinámicos no-store perpetuando el error | `sw.js:132-142` |
| Cachés obsoletas acumuladas en cliente | Despliegue de nueva versión de la app con nombre de caché actualizado | El evento `activate` no purga las claves antiguas de `caches` consumiendo cuota de disco innecesaria | `sw.js:105-111` |
| Precache en disco vs atomicidad con addAll (R9) | Un archivo listado en `PRECACHE_FILES` no existe en el servidor | En disco se comprueba la existencia de cada ruta; en navegadores reales `cache.addAll()` aborta atómicamente si una falla (hueco de entorno) | `sw.js:4-103` |

## Tipo y herramienta
Test de integración en sandbox `node:vm` con `node:test` y `node:assert/strict`.

## Archivos
- Crear suite de tests: `tests/pwa/service-worker-fetch.test.mjs`
- Modificar documentación: `qa/00-plan-maestro.md`, `qa/tickets/FASE-3b/TKT-000-indice.md`, `qa/99-huecos.md`, este ticket.
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)

1. **Peticiones POST no interceptadas**:
   - *Dado*: un evento `fetch` con `event.request.method = 'POST'`.
   - *Cuando*: se procesa en el listener de fetch de `sw.js`.
   - *Entonces*: `event.respondWith` nunca es invocado; la petición se delega transparentemente a la red del navegador.
2. **Cloudinary online · Network-first con guardado en caché**:
   - *Dado*: petición GET a `https://res.cloudinary.com/demo/image.png` con red disponible (`fetch` resuelve OK).
   - *Cuando*: se atiende la petición.
   - *Entonces*: devuelve la respuesta obtenida de la red y guarda una copia clonada en la caché actual.
3. **Cloudinary offline · Recuperación de caché existente**:
   - *Dado*: petición GET a `https://res.cloudinary.com/demo/image.png` con red caída (`fetch` rechaza), pero con copia guardada previamente en caché.
   - *When*: se atiende la petición.
   - *Entonces*: devuelve la respuesta almacenada en la caché.
4. **Cloudinary offline · Fallback al icono cuando no hay caché**:
   - *Dado*: petición GET a Cloudinary con red caída y sin caché previa de esa imagen.
   - *When*: se atiende la petición.
   - *Entonces*: devuelve el recurso fallback cacheado `/assets/icon/icon-192-any.png`.
5. **Mismo origen · Cache-first con acierto (hit)**:
   - *Dado*: petición GET a recurso del mismo origen (`https://love-arcade.test/styles.css`) ya presente en caché.
   - *When*: se atiende la petición.
   - *Entonces*: devuelve inmediatamente el recurso de caché sin invocar a `fetch` de red.
6. **Mismo origen · Cache-first con fallo inicial (miss)**:
   - *Dado*: petición GET a recurso del mismo origen no presente en caché.
   - *When*: se atiende la petición.
   - *Entonces*: realiza el `fetch` a la red, guarda un clon en la caché actual mediante `cache.put` y devuelve la respuesta.
7. **R8 · Comportamiento ante respuestas 404/500 y rutas `/api/*`**:
   - *Dado*: petición GET del mismo origen a `/api/client-config` o a un recurso inexistente que responde HTTP 404/500.
   - *When*: se atiende la petición en el listener de `sw.js`.
   - *Entonces*: se comprueba por comportamiento real si el SW invoca `cache.put` para esa respuesta. Se documenta si almacena respuestas `!response.ok` y endpoints `/api/*` sin emitir fallo prematuro como bug.
8. **Activate · Limpieza de cachés antiguas sin versiones literales**:
   - *Dado*: un almacenamiento `caches` conteniendo una caché antigua (`love-arcade-v1.0.0-legacy`) y la caché activa del Service Worker.
   - *When*: se dispara el evento `activate` y se espera la resolución de `event.waitUntil`.
   - *Entonces*: la caché antigua es eliminada vía `caches.delete`, la caché activa permanece intacta, y se invoca `self.clients.claim()`. No se asume ninguna versión literal de `CACHE_VERSION` en el test.

## Qué NO se mockea y qué se falsea
- **Qué NO se mockea**:
  - Código fuente real de `sw.js`.
  - Construcción de URLs mediante la API nativa de Node `URL`.
- **Qué se falsea**:
  - El contexto global `self` de Service Worker (`addEventListener`, `clients.claim`, `skipWaiting`).
  - La interfaz `caches` (almacén en memoria de respuestas con `open`, `match`, `keys`, `delete`).
  - `fetch` de red (simulado para responder con objetos `Response` o rechazar por error de red).
- **Problema que podría ocultar el mock**:
  - Un mock en memoria de Cache API no reproduce las cuotas de almacenamiento de disco de los navegadores móviles, ni el manejo de streaming de cuerpos grandes.
  - **R9 (Precache en disco vs atomicidad de addAll)**: La existencia de cada archivo de `PRECACHE_FILES` en disco sí se verifica y queda cubierta mediante el test `dado el precache, cuando se resuelve cada ruta, entonces existe en disco`. Por el contrario, un fake de `cache.addAll` en JS no puede simular fielmente la atomicidad del navegador real (donde si un solo archivo falla con 404, toda la transacción de instalación se cancela sin persistir nada). Por tanto, la atomicidad transaccional de `addAll` NO se prueba con un mock y queda documentada como hueco de entorno en `qa/99-huecos.md`.

## Criterios de aceptación
- [x] Peticiones no-GET (POST, PUT, DELETE) son ignoradas y no llaman a `event.respondWith`.
- [x] Peticiones a Cloudinary aplican network-first, recuperando de caché o icono de fallback ante desconexión.
- [x] Peticiones del mismo origen aplican cache-first (hit devuelve caché sin red; miss consulta red y cachea).
- [x] Se verifica por comportamiento el tratamiento de respuestas 404/500 y rutas `/api/*` (R8).
- [x] El evento `activate` purga cualquier clave de caché distinta a la activa sin depender de versiones literales fijas.
- [x] Se verifica la existencia en disco de cada ruta del precache; la atomicidad transaccional de `addAll` se registra como hueco de entorno (R9).

## Comando
```bash
node --test tests/pwa/service-worker-fetch.test.mjs
```

## Estado
Hecho

## Resultados
- **Ejecución de tests**: 3 ejecuciones consecutivas (run 1, 2, 3) con salida limpia: 9 tests, 1 suite, 8 pass, 0 fail, 1 todo (duración ~1.3s).
- **Hallazgo registrado (R8)**: Se confirmó por comportamiento real que el SW almacena incondicionalmente en `CACHE_NAME` respuestas no exitosas (`!response.ok`, ej. 500) y endpoints bajo `/api/*`. Documentado como Bug F3b-01 en `qa/BUGS-ENCONTRADOS.md` y verificado con test `todo` asertando comportamiento deseado (devolución de HTTP 200 tras recuperación de red; actualmente arroja `500 !== 200` y muestra `⚠`).
- **Verificación por mutación**:
  - Mutación 1 (`sw.js:114`): `!== 'GET'` invertido a `=== 'GET'`. Matada (6 fallos: POST ignorado y estrategias GET).
  - Mutación 2 (`sw.js:116`): Hostname `'res.cloudinary.com'` sustituido por `'other.com'`. Matada (3 fallos: tests de Cloudinary).
  - Mutación 3 (`sw.js:136`): Guarda de caché de mismo origen `if (cached) return cached;` invertida a `if (!cached) return cached;`. Matada (2 fallos: hit y miss de mismo origen).
  - Mutación 4 (`sw.js:108`): Filtro de purga de caché `key !== CACHE_NAME` invertido a `key === CACHE_NAME`. Matada (1 fallo: purga en activate).

