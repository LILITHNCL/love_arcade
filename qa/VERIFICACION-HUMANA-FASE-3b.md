# Verificación Humana — Fase 3b (Integración: bridge, SW y API)

Documentos relacionados: [00-plan-maestro](00-plan-maestro.md) · [BUGS-ENCONTRADOS](BUGS-ENCONTRADOS.md) · [99-huecos](99-huecos.md) · [TKT-017](tickets/FASE-3b/TKT-017-contrato-bridge.md) · [TKT-018](tickets/FASE-3b/TKT-018-sw-estrategias-fetch.md) · [TKT-019](tickets/FASE-3b/TKT-019-api-report.md) · [TKT-020](tickets/FASE-3b/TKT-020-api-client-config.md)

---

## 1. Comandos exactos y conteos reales de la suite

Ejecutar desde la raíz del repositorio (`/data/data/com.termux/files/home/proyectos/love_arcade`):

### 1.1 Tests individuales de la Fase F3b

1. **TKT-017 (Contrato del bridge e integración de economía)**:
   ```bash
   node --test tests/integration/game-bridge-contract.test.mjs tests/integration/game-bridge.test.mjs
   ```
   *Resultado esperado*: `8 tests, 1 suite (8 pass, 0 fail, 0 todo)`. Salida limpia con código `0`.
   *(Desglose: `game-bridge-contract.test.mjs` con 7 tests pass en 1 suite; `game-bridge.test.mjs` con 1 test de suite clásica pass).*

2. **TKT-018 (Service Worker: estrategias de fetch y ciclo de vida)**:
   ```bash
   node --test tests/pwa/service-worker-fetch.test.mjs tests/pwa/service-worker-precache.test.mjs
   ```
   *Resultado esperado*: `12 tests, 1 suite (10 pass, 0 fail, 2 todo: BUG-F3b-01)`. Salida limpia con código `0`.
   *(Desglose: `service-worker-fetch.test.mjs` con 9 pass y 2 todo `⚠` correspondientes a error 500 y rutas `/api/*` cacheadas; `service-worker-precache.test.mjs` con 1 pass).*

3. **TKT-019 (api/report.js: validación, sanitización y proxy de telemetría a Telegram)**:
   ```bash
   node --test tests/api/report.test.mjs
   ```
   *Resultado esperado*: `28 tests, 8 suites (27 pass, 0 fail, 1 todo: BUG-F3b-02)`. Salida limpia con código `0`.
   *(Desglose: 27 pass y 1 todo `⚠` en `eventLabel` pasando a mayúsculas entidades HTML).*

4. **TKT-020 (api/client-config.js y alias api/telemetry.js)**:
   ```bash
   node --test tests/api/client-config.test.mjs
   ```
   *Resultado esperado*: `11 tests, 7 suites (11 pass, 0 fail, 0 todo)`. Salida limpia con código `0`.

### 1.2 Suites globales y comprobaciones estáticas

5. **Suite completa del proyecto**:
   ```bash
   npm test
   ```
   *Resultado esperado*: `192 tests, 40 suites (170 pass, 0 fail, 22 todo)`. Código de salida: `0`.
   *(Línea base previa de F3a: 135 tests, 23 suites, 116 pass, 0 fail, 19 todo. Incremento neto: +57 tests, +17 suites, +54 pass, 0 fail, +3 todo).*

6. **Suite de minijuegos independientes**:
   ```bash
   npm run test:games
   ```
   *Resultado esperado*: `16/16 pass (0 fail, 0 todo)`. Código de salida: `0`.

7. **Escáner estático de documentación**:
   ```bash
   node tests/static/documentation-static-qa.mjs
   ```
   *Resultado esperado*: `Documentation static QA passed: 84 Markdown files checked, no broken links or references to removed historical docs.` Código `0`.

---

## 2. Qué NO se pudo verificar en este entorno (Termux / Node.js)

- **Service Worker real en navegador**: En Node.js no existe el motor de Service Workers ni la Cache API nativa del navegador. Las pruebas de ciclo de vida e interceptación se ejecutan sobre un entorno sintético en memoria (`FakeCache` y sandbox en `tests/pwa/service-worker-fetch.test.mjs`). El registro de `sw.js` mediante `navigator.serviceWorker.register('/sw.js')`, la activación asíncrona en segundo plano, el evento `controllerchange` que recarga la página ante actualización, y el control real de clientes mediante `self.clients.claim()` quedan **[no verificado]** en este entorno y requieren comprobación en un navegador real.
- **Atomicidad de `cache.addAll(PRECACHE_FILES)`**: En la especificación W3C de Cache API, si una sola petición de la lista de precarga falla (HTTP 404 o error de red), toda la transacción aborta y el SW no se instala. En el test de Node se verifica que cada ruta exista en disco (`tests/pwa/service-worker-fetch.test.mjs`); la atomicidad transaccional nativa del navegador ante caídas parciales de red queda **[no verificado]** y debe validarse en navegador real (Fase F4).
- **Vercel Serverless / Edge Runtime real**: Las funciones en `api/` (`report.js`, `client-config.js`, `telemetry.js`) se diseñaron para el entorno serverless de Vercel. En Node.js se probaron simulando los objetos `req` y `res` mediante `tests/helpers/fake-http.cjs`. Se catalogan como **[no verificado]** en este entorno: el comportamiento de streaming con `keepalive: true`, y cualquier comportamiento o cabecera externa de infraestructura de alojamiento no declarada en el código local (como `x-vercel-id`, `x-forwarded-for` o límites de tiempo de cómputo externos no configurados en el repositorio).
- **Módulos ES en `api/*.js`**: Los archivos `api/*.js` se importan como ES Modules (ESM) por detección automática de sintaxis (declaración de `export const config` y `export default`) al no existir `"type": "module"` en `package.json`, lo cual requiere Node.js >= 22.7.0.
- **API real de Telegram Bot (`https://api.telegram.org/bot<token>/sendMessage`)**: Siguiendo estrictamente las directrices de seguridad, no se leen tokens secretos de archivos `.env` ni se realizan peticiones hacia internet. Las llamadas HTTP hacia Telegram se interceptaron mediante un mock de `globalThis.fetch`. Por tanto, la entrega física de mensajes en los Topics 2 (Analíticas), 3 (Logros) y 4 (Bugs) de un grupo real de Telegram queda **[no verificado]** aquí.
- **Cuota de almacenamiento y desalojo de caché bajo presión de disco**: Las políticas de desalojo automático de caché por falta de espacio en dispositivos móviles físicos no se reproducen en la memoria RAM de Node.js.
- **Renderizado e interacción de minijuegos en iframes**: Los 8 minijuegos se probaron estáticamente y a nivel de contratos de scripts en `node:vm`. La carga gráfica, bucle de frames, audio y consumo de `window.GameCenter` dentro de un elemento `<iframe>` en el navegador real se delegan a las pruebas de Fase F4 (E2E).

---

## 3. Verificación de textos y elementos de interfaz (auditoría en código)

Auditoría contra `index.html`, `js/pwa/sw-update-bridge.js` y `js/game-bridge-runtime.js`:

### 3.1 Banner de actualización de Service Worker (`js/pwa/sw-update-bridge.js`)

- **"Nueva versión disponible."**:
  - `[verificado]` como mensaje del banner de actualización: `<span>Nueva versión disponible.</span>` (`js/pwa/sw-update-bridge.js:10`).
- **"Actualizar"**:
  - `[verificado]` como texto del botón de actualización: `<button id="sw-update-btn" ...>Actualizar</button>` (`js/pwa/sw-update-bridge.js:10`).
  - Acción: envía mensaje `{ type: 'SKIP_WAITING' }` al Service Worker en espera, provocando que tome el control y recargue la página mediante el listener `controllerchange` (`L31-33`).

### 3.2 Elementos de PWA y estado de conexión en la interfaz

- **"Modo sin conexión" / "Estado offline" en el DOM del hub**:
  - `[texto no verificado]` (no existe ningún elemento estático en `index.html` ni banner visual para indicar desconexión de red). La aplicación está diseñada para operar de forma transparente: ante la ausencia de conexión a internet, el Service Worker sirve el shell y los assets precacheados desde `CACHE_NAME` sin mostrar pantallas de error.
- **Instalación de PWA**:
  - `[texto no verificado]` (no existe un botón explícito de "Instalar Love Arcade" en la UI). La instalación se delega al evento estándar `beforeinstallprompt` del navegador y al archivo `manifest.json`.

---

## 4. Procedimiento de verificación manual en navegador y entorno real

### 4.1 Protocolo de seguridad previo

1. **Exportar copia de seguridad**: Antes de iniciar las pruebas manuales, ir a la sección "Sincronización" (`#tab-sync`, `index.html:652` y `:658`) y hacer clic en **"Guardar respaldo"** para descargar el archivo `.labak` actual.
2. **Perfil limpio**: Abrir una ventana de navegación en modo incógnito o crear un perfil de usuario limpio en Chrome, Chromium, Firefox o Safari para no sobreescribir datos de juego existentes.
3. **Privacidad de secretos**: NUNCA ingresar ni compartir códigos promocionales reales, tokens de Telegram ni credenciales de Supabase en capturas de pantalla o reportes de prueba.

---

### 4.2 Paso a paso: Service Worker, PWA y Modo Sin Conexión

1. **Iniciar servidor local**:
   Desde el directorio del proyecto, levantar un servidor HTTP local (por ejemplo con `npx serve .` o `python3 -m http.server 8080`).
2. **Registro e instalación del Service Worker**:
   - Abrir `http://localhost:8080` en el navegador.
   - Abrir DevTools (`F12`) y dirigirse a la pestaña **Application** (en Firefox: **Almacenamiento** / **Depurador**).
   - En el menú lateral, seleccionar **Service Workers**.
   - *Resultado esperado*: Se visualiza el Service Worker `sw.js` con Scope `/` y estado `Activated and is running`.
3. **Inspección de la Cache Storage**:
   - En DevTools → **Application** → **Storage** → **Cache Storage**.
   - Desplegar la caché cuyo nombre empieza por `love-arcade-` (generada dinámicamente como `love-arcade-${CACHE_VERSION}` según `sw.js:2`).
   - *Resultado esperado*: Contiene los recursos estáticos declarados en `APP_SHELL_FILES` (`sw.js:4-82`, que incluye `'/'`, `'/index.html'`, `'/styles.css'`, `'/manifest.webmanifest'`, `'/js/app.js'` en `sw.js:32`, módulos en `/js/*`, catálogo y carátulas) y en `GAMES_FILES` (`sw.js:84-93`, con los HTML y assets de los 8 minijuegos). No se afirman archivos que no figuren en dichas listas.
4. **Prueba de Modo Sin Conexión (Offline)**:
   - En DevTools, ir a la pestaña **Network** (Red) y marcar la casilla **Offline** (o en **Application** → **Service Workers** → marcar **Offline**).
   - Recargar la página (`F5` o `Ctrl+R`).
   - *Resultado esperado*: La página de Love Arcade carga con normalidad desde la caché del Service Worker. No aparece la página de error del navegador ("Sin conexión").
5. **Navegación offline a minijuegos**:
   - Con la red aún configurada en **Offline**, abrir un minijuego (ej. `http://localhost:8080/games/2048/index.html` o `http://localhost:8080/games/jigsaw/index.html`).
   - *Resultado esperado*: El minijuego carga completamente con sus scripts, estilos y assets precacheados.
6. **Comportamiento de imágenes de Cloudinary**:
   - Desmarcar la casilla **Offline** en DevTools para reactivar la red.
   - Abrir el catálogo de minijuegos con carátulas servidas desde `res.cloudinary.com`.
   - En la pestaña **Network**, confirmar que las imágenes se descargan con código HTTP 200 y se guardan en la caché cuyo nombre empieza por `love-arcade-` (`sw.js:2`).
   - Volver a marcar **Offline** y navegar a otra carátula de Cloudinary no descargada previamente.
   - *Resultado esperado*: El Service Worker intercepta la petición fallida y devuelve como sustituto el icono de fallback `/assets/icon/icon-192-any.png`.
7. **Impacto del Bug documentado BUG-F3b-01**:
   - *Comportamiento a observar*: Si un asset de mismo origen responde con error HTTP 500 o 404 (simulado mediante servidor local o interceptor), `sw.js` almacena la respuesta errónea en `CACHE_NAME`. Al reactivar el servidor o corregir el recurso, peticiones posteriores continúan recibiendo el código 500/404 cacheado de forma indefinida hasta que el usuario borre manualmente la caché en DevTools.
   - *Predicción en rutas `/api/*`*: Si una petición `GET /api/client-config` se realiza en el mismo origen, el Service Worker la inserta en `CACHE_NAME` ignorando la cabecera `Cache-Control: no-store`.

---

### 4.3 Paso a paso: Handlers Serverless (`api/report.js` y `api/client-config.js`) con `vercel dev`

Si se dispone del CLI de Vercel (`npm i -g vercel`), se pueden probar los handlers de backend en un entorno de desarrollo local.

> [!WARNING]
> **Seguridad, credenciales y tráfico externo**:
> - **Credenciales**: NUNCA usar credenciales reales ni crear un archivo `.env.local`. Todas las comprobaciones manuales deben realizarse exclusivamente con variables ficticias o falsas pasadas por línea de comandos.
> - **Petición real a Telegram**: Con `vercel dev` y el token falso, el handler SÍ hace una petición HTTP real a `api.telegram.org` (`api/report.js:349`); no se entrega ningún mensaje y Telegram responde error (`502 telegram_upstream_error`, `report.js:377`), o `504` si no hay red (`report.js:391-396`).
> - **Omisión de tráfico externo**: Si no se quiere tráfico externo, omitir el paso 4.3.5 y quedarse con los pasos de 405 (pasos 4.3.3 y 4.3.4) y 403 (paso 4.3.6), que no contactan Telegram.

1. **Iniciar el runtime local con variables de prueba ficticias**:
   ```bash
   TELEGRAM_BOT_TOKEN=fake TELEGRAM_CHAT_ID=0 NEXT_PUBLIC_LA_CLOUD_URL=https://fake.supabase.co NEXT_PUBLIC_LA_CLOUD_ANON_KEY=fake-anon-key vercel dev
   ```
   (El servidor local arrancará por defecto en `http://localhost:3000`).

2. **Probar `GET /api/client-config`**:
   Ejecutar desde terminal:
   ```bash
   curl -i http://localhost:3000/api/client-config
   ```
   *Resultado esperado*:
   - Código HTTP `200 OK`.
   - Cabeceras:
     ```http
     Cache-Control: no-store, no-cache, must-revalidate
     Pragma: no-cache
     ```
   - Cuerpo JSON:
     ```json
     {"supabaseUrl":"https://fake.supabase.co","supabaseKey":"fake-anon-key"}
     ```
     *(En caso de ejecutarse sin pasar variables de entorno, responde con strings vacíos: `{"supabaseUrl":"","supabaseKey":""}`).*

3. **Probar métodos inválidos en `/api/client-config` (HTTP 405)**:
   ```bash
   curl -i -X POST http://localhost:3000/api/client-config
   ```
   *Resultado esperado*:
   - Código HTTP `405 Method Not Allowed`.
   - Cabecera: `Allow: GET`.
   - Cuerpo JSON (`client-config.js:30-31`):
     ```json
     {"error":"Method Not Allowed"}
     ```

4. **Probar alias `/api/telemetry`**:
   ```bash
   curl -i http://localhost:3000/api/telemetry
   ```
   *Resultado esperado*:
   - Responde idénticamente a `api/report.js` vía `_errorJson`: devuelve HTTP `405 Method Not Allowed` (`:181`) ya que solo acepta peticiones POST.
   - Cuerpo JSON:
     ```json
     {
       "ok": false,
       "error": {
         "code": "method_not_allowed",
         "message": "Method Not Allowed",
         "trace_id": "rep_...",
         "timestamp": "..."
       }
     }
     ```
     *(donde `trace_id` y `timestamp` son valores dinámicos generados en cada llamada).*

5. **Probar `/api/report` con origen autorizado (POST)**:
   *(Paso opcional: genera tráfico HTTP hacia `api.telegram.org`; omitir si se desea evitar tráfico externo según la advertencia).*
   ```bash
   curl -i -X POST http://localhost:3000/api/report \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:3000" \
     -d '{"type":"analytics","user":"JugadorManual","event":"test_ping","data":{"dispositivo":"desktop"}}'
   ```
   *Resultado esperado con las variables de prueba ficticias (`TELEGRAM_BOT_TOKEN=fake`, `TELEGRAM_CHAT_ID=0`)*:
   - Al usar un token ficticio, el handler SÍ hace una petición HTTP real a `api.telegram.org` (`api/report.js:349`), pero fallará de forma segura sin emitir ningún mensaje real:
     - Si la petición alcanza Telegram, este responde con error upstream (p. ej. HTTP 401 Unauthorized o 404), y el handler devuelve HTTP `502 Bad Gateway` (`api/report.js:377`) con estructura:
       ```json
       {
         "ok": false,
         "error": {
           "code": "telegram_upstream_error",
           "message": "Telegram API error: ...",
           "trace_id": "rep_...",
           "timestamp": "..."
         }
       }
       ```
     - Si la máquina no tiene acceso a internet o la conexión es rechazada/agota tiempo, devuelve HTTP `504 Gateway Timeout` (`api/report.js:391-396`) con `code: "telegram_network_error"` o `"telegram_timeout"`.
     - Si se ejecutara sin definir `TELEGRAM_BOT_TOKEN` ni `TELEGRAM_CHAT_ID`, devuelve HTTP `500 Server misconfiguration` (`api/report.js:346`):
       ```json
       {
         "ok": false,
         "error": {
           "code": "server_misconfiguration",
           "message": "Server misconfiguration",
           "trace_id": "rep_...",
           "timestamp": "..."
         }
       }
       ```
     *(en todos los casos `trace_id` y `timestamp` son valores dinámicos variables generados por `_errorJson`).*

6. **Probar rechazo de origen no autorizado en `/api/report` (HTTP 403)**:
   ```bash
   curl -i -X POST http://localhost:3000/api/report \
     -H "Content-Type: application/json" \
     -H "Origin: https://sitio-malicioso-externo.com" \
     -d '{"type":"analytics","user":"Attacker","event":"exploit"}'
   ```
   *Resultado esperado*:
   - Código HTTP `403 Forbidden` con `code: "forbidden_origin"` y `message: "Forbidden"` (`api/report.js:221`).
   - Cuerpo JSON:
     ```json
     {
       "ok": false,
       "error": {
         "code": "forbidden_origin",
         "message": "Forbidden",
         "trace_id": "rep_...",
         "timestamp": "...",
         "details": {
           "origin": "https://sitio-malicioso-externo.com"
         }
       }
     }
     ```
     *(con `trace_id` y `timestamp` variables).*
