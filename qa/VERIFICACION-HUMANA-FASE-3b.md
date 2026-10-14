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
   *Resultado esperado*: `12 tests, 1 suite (11 pass, 0 fail, 1 todo: BUG-F3b-01)`. Salida limpia con código `0`.
   *(Desglose: `service-worker-fetch.test.mjs` con 8 pass y 1 todo `⚠`; `service-worker-precache.test.mjs` con 3 pass).*

3. **TKT-019 (api/report.js: validación, sanitización y proxy de telemetría a Telegram)**:
   ```bash
   node --test tests/api/report.test.mjs
   ```
   *Resultado esperado*: `24 tests, 8 suites (24 pass, 0 fail, 0 todo)`. Salida limpia con código `0`.

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
   *Resultado esperado*: `186 tests, 40 suites (166 pass, 0 fail, 20 todo)`. Código de salida: `0`.
   *(Línea base previa de F3a: 151 tests, 25 suites, 131 pass, 0 fail, 20 todo. Incremento neto: +35 tests, +15 suites, +35 pass, 0 fail, 0 nuevos todo).*

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

- **Service Worker real en navegador**: En Node.js no existe el motor de Service Workers ni la Cache API nativa del navegador. Las pruebas de ciclo de vida e interceptación se ejecutan sobre un entorno sintético en memoria (`FakeCache` y sandbox en `tests/pwa/service-worker-fetch.test.mjs`). El registro de `sw.js` mediante `navigator.serviceWorker.register('/sw.js')`, la activación asíncrona en segundo plano, el evento `controllerchange` que recarga la página ante actualización, y el control real de clientes mediante `self.clients.claim()` quedan **NO VERIFICADAS** en este entorno y requieren comprobación en un navegador real.
- **Atomicidad de `cache.addAll(PRECACHE_FILES)`**: En la especificación W3C de Cache API, si una sola petición de la lista de precarga falla (HTTP 404 o error de red), toda la transacción aborta y el SW no se instala. En el fake en memoria se almacena secuencialmente; la atomicidad transaccional nativa del navegador ante fallos parciales debe validarse en navegador real (Fase F4).
- **Vercel Serverless / Edge Runtime real**: Las funciones en `api/` (`report.js`, `client-config.js`, `telemetry.js`) se diseñaron para el entorno serverless de Vercel. En Node.js se probaron simulando los objetos `req` y `res` mediante `tests/helpers/fake-http.cjs`. No se verificaron aquí las cabeceras inyectadas por los balanceadores de Vercel (`x-vercel-id`, `x-forwarded-for`), el límite de cómputo (10 segundos en plan Hobby) ni el comportamiento real de streaming con `keepalive: true`.
- **API real de Telegram Bot (`https://api.telegram.org/bot<token>/sendMessage`)**: Siguiendo estrictamente las directrices de seguridad, no se leen tokens secretos de archivos `.env` ni se realizan peticiones hacia internet. Las llamadas HTTP hacia Telegram se interceptaron mediante un mock de `globalThis.fetch`. Por tanto, la entrega física de mensajes en los Topics 2 (Analíticas), 3 (Logros) y 4 (Bugs) de un grupo real de Telegram queda **NO VERIFICADA** aquí.
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

1. **Exportar copia de seguridad**: Antes de iniciar las pruebas manuales, ir a la sección "Guardado y sincronización" (`#tab-sync`) y hacer clic en **"Guardar respaldo"** para descargar el archivo `.labak` actual.
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
   - Desplegar la caché `lovearcade-v12.2`.
   - *Resultado esperado*: Contiene la totalidad de los recursos estáticos del hub (`index.html`, `styles.css`, `js/app.js`, `manifest.json`, iconos) y los assets de los minijuegos listados en `APP_SHELL_FILES` y `GAMES_FILES`.
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
   - En la pestaña **Network**, confirmar que las imágenes se descargan con código HTTP 200 y se guardan en la caché `lovearcade-v12.2`.
   - Volver a marcar **Offline** y navegar a otra carátula de Cloudinary no descargada previamente.
   - *Resultado esperado*: El Service Worker intercepta la petición fallida y devuelve como sustituto el icono de fallback `/assets/icon/icon-192-any.png`.
7. **Impacto del Bug documentado BUG-F3b-01**:
   - *Comportamiento a observar*: Si un asset de mismo origen responde con error HTTP 500 o 404 (simulado mediante servidor local o interceptor), `sw.js` almacena la respuesta errónea en `CACHE_NAME`. Al reactivar el servidor o corregir el recurso, peticiones posteriores continúan recibiendo el código 500/404 cacheado de forma indefinida hasta que el usuario borre manualmente la caché en DevTools.
   - *Predicción en rutas `/api/*`*: Si una petición `GET /api/client-config` se realiza en el mismo origen, el Service Worker la inserta en `CACHE_NAME` ignorando la cabecera `Cache-Control: no-store`.

---

### 4.3 Paso a paso: Handlers Serverless (`api/report.js` y `api/client-config.js`) con `vercel dev`

Si se dispone del CLI de Vercel (`npm i -g vercel`), se pueden probar los handlers de backend en un entorno de desarrollo local:

1. **Iniciar el runtime local**:
   ```bash
   vercel dev
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
     - Si `NEXT_PUBLIC_LA_CLOUD_URL` y `NEXT_PUBLIC_LA_CLOUD_ANON_KEY` están configuradas en `.env.local`:
       ```json
       {"supabaseUrl":"https://...","supabaseKey":"..."}
       ```
     - Si no están configuradas:
       ```json
       {"supabaseUrl":"","supabaseKey":""}
       ```

3. **Probar métodos inválidos en `/api/client-config` (HTTP 405)**:
   ```bash
   curl -i -X POST http://localhost:3000/api/client-config
   ```
   *Resultado esperado*:
   - Código HTTP `405 Method Not Allowed`.
   - Cabecera: `Allow: GET`.
   - Cuerpo JSON:
     ```json
     {"error":"Method Not Allowed"}
     ```

4. **Probar alias `/api/telemetry`**:
   ```bash
   curl -i http://localhost:3000/api/telemetry
   ```
   *Resultado esperado*:
   - Responde idénticamente a `api/report.js` (devuelve HTTP 405 en GET ya que solo acepta POST).

5. **Probar `/api/report` con origen autorizado (POST)**:
   ```bash
   curl -i -X POST http://localhost:3000/api/report \
     -H "Content-Type: application/json" \
     -H "Origin: http://localhost:3000" \
     -d '{"type":"analytics","user":"JugadorManual","event":"test_ping","data":{"dispositivo":"desktop"}}'
   ```
   *Resultado esperado*:
   - Si las variables de entorno de Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) están configuradas: responde `200 OK` con `{"ok":true}` y el mensaje se publica en el Topic 2 (📈 Analíticas) del grupo de Telegram con el usuario sanitizado.
   - Si las variables no están configuradas: responde `500 Internal Server Error` con `{"ok":false,"error":{"code":"server_misconfiguration"}}`.

6. **Probar rechazo de origen no autorizado en `/api/report` (HTTP 403)**:
   ```bash
   curl -i -X POST http://localhost:3000/api/report \
     -H "Content-Type: application/json" \
     -H "Origin: https://sitio-malicioso-externo.com" \
     -d '{"type":"analytics","user":"Attacker","event":"exploit"}'
   ```
   *Resultado esperado*:
   - Código HTTP `403 Forbidden`.
   - Cuerpo JSON:
     ```json
     {"ok":false,"error":{"code":"forbidden_origin","message":"Petición rechazada: origen no autorizado"}}
     ```
