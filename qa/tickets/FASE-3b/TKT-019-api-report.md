# TKT-019: Endpoint de telemetría y reporte (`api/report.js`) (#19, P2)

- **ID y título**: TKT-019 — Validación, sanitización y proxy a Telegram en `api/report.js`
- **Fase**: F3b (Integración: bridge, SW y API)
- **Prioridad**: P2
- **Dependencias**: `api/report.js`, `node:test`, `node:assert/strict`.

## Entorno y mecanismo de carga
- **Formato**: Módulo ES (`export default async function handler(req, res)` y `export const config`). Node v26 detecta automáticamente sintaxis ESM y lo importa con `import('./api/report.js')`.
- **Firma del handler**: Función asíncrona `handler(req, res)` conforme a Vercel Serverless Functions.
- **Lectura de `process.env`**:
  - `PRODUCTION_DOMAIN`: leído dentro de `handler(req, res)` en `api/report.js:194` en tiempo de ejecución.
  - `TELEGRAM_BOT_TOKEN`: leído dentro de `handler(req, res)` en `api/report.js:338` en tiempo de ejecución.
  - `TELEGRAM_CHAT_ID`: leído dentro de `handler(req, res)` en `api/report.js:339` en tiempo de ejecución.
  - No se leen variables de entorno en el ámbito de carga del módulo (top-level).
- **Aislamiento de variables de entorno**: El test define valores falsos para `process.env` (`PRODUCTION_DOMAIN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) antes de invocar el handler y los restaura estrictamente en bloques `afterEach` o `finally`.

## Riesgo que cubre

| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Peticiones no autorizadas por método | Un cliente o crawler envía peticiones GET, PUT o DELETE a `/api/report` | El endpoint no rechaza el método y falla internamente intentando enviar mensajes vacíos a Telegram | `api/report.js:180-182` |
| Abuso por origen no autorizado (CORS/CSRF) | Una web externa no autorizada envía eventos falsos con el origen de su sitio | Si la validación de `PRODUCTION_DOMAIN` falla, permite inyección de telemetría basura desde dominios ajenos | `api/report.js:194-225` |
| Bloqueo accidental de entornos de prueba | Petición originada en `localhost` o en una URL preview de Vercel (`*.vercel.app`) | Rechazo espurio 403 que impide probar telemetría en staging/preview o desarrollo local | `api/report.js:216-224` |
| Inyección de código HTML en Telegram | Un jugador malicioso envía un nickname conteniendo etiquetas HTML como `<b>` o `<script>` | Telegram parsea el mensaje en modo HTML; sin sanitización, se altera el formato del chat o se rompe la entrega | `api/report.js:278-289` |
| Fuga del token del bot de Telegram | Telegram upstream está caído o responde con error (4xx/5xx/red) | El manejador de errores expone la URL que contiene el bot token en la respuesta JSON o en los detalles devueltos al cliente | `api/report.js:349,368-402` |
| Fallo de parseo de body en cold start | `req.body` llega como string, `Buffer` o `undefined` (stream crudo) según el runtime de Vercel | La función crashea con `TypeError` o descarta los datos del usuario cayendo en 'desconocido' | `api/report.js:118-153` |

## Tipo y herramienta
Test de integración del handler serverless con `node:test` y `node:assert/strict`, ejecutando el handler real importado vía ESM.

## Archivos
- Crear suite de tests: `tests/api/report.test.mjs`
- Modificar documentación: `qa/00-plan-maestro.md`, `qa/tickets/FASE-3b/TKT-000-indice.md`, este ticket.
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)

1. **Método no permitido (405)**:
   - *Dado*: una petición con `req.method = 'GET'` (o `'PUT'`, `'DELETE'`).
   - *Cuando*: se invoca `handler(req, res)`.
   - *Entonces*: responde con status 405 y JSON `{ ok: false, error: { code: 'method_not_allowed', ... } }`.
2. **Origen no autorizado (403)**:
   - *Dado*: `process.env.PRODUCTION_DOMAIN = 'love-arcade.vercel.app'` y una petición POST con cabecera `origin: 'https://sitio-malicioso.com'`.
   - *When*: se invoca `handler(req, res)`.
   - *Entonces*: responde con status 403 y JSON `{ ok: false, error: { code: 'forbidden_origin', ... } }`.
3. **Orígenes autorizados (200)**:
   - *Dado*: `process.env.PRODUCTION_DOMAIN = 'love-arcade.vercel.app'`.
   - *When*: se realizan peticiones POST con:
     a) `origin: 'https://love-arcade.vercel.app'` (producción)
     b) `origin: 'https://preview-deploy-xyz.vercel.app'` (preview)
     c) `origin: 'http://localhost:3000'` (desarrollo local)
     d) `origin: 'http://127.0.0.1:8080'` (ip local)
   - *Entonces*: todas superan la validación de origen y proceden con el envío a Telegram.
4. **Sanitización HTML del nickname en el payload saliente**:
   - *Dado*: payload con `user: 'Alice <script>alert("hack")</script> & Bob'`.
   - *When*: se invoca el handler simulando envío a Telegram.
   - *Entonces*: la carga útil enviada en `fetch` a Telegram contiene el texto sanitizado `Alice &lt;script&gt;alert(&quot;hack&quot;)&lt;/script&gt; &amp; Bob` y ninguna etiqueta HTML maliciosa sin escapar.
5. **Telegram caído / error upstream sin fuga de credenciales**:
   - *Dado*: `process.env.TELEGRAM_BOT_TOKEN = 'token_super_secreto_12345'` y la llamada `fetch` a Telegram responde status 500 o lanza error de red.
   - *When*: se procesa la petición en `handler(req, res)`.
   - *Entonces*: devuelve status de error (502, 504 o 500) y se comprueba rigurosamente que el string `'token_super_secreto_12345'` NO aparece en ningún campo del JSON devuelto ni en headers.
6. **Soporte de distintos formatos de req.body**:
   - *Dado*: peticiones válidas donde `req.body` es:
     a) Objeto plano: `{ type: 'analytics', user: 'player1', event: 'game_start' }`
     b) String JSON: `'{"type":"bug","user":"player2","event":"error_log"}'`
     c) Buffer binario: `Buffer.from('{"type":"achievement","user":"player3","event":"unlocked"}')`
     d) `undefined` con emisión de stream crudo: `req.on('data', chunk)` y `req.on('end')`
   - *When*: se procesan en el handler.
   - *Entonces*: todos son parseados correctamente por `_parseBody` y los valores correspondientes de `user` y `event` se reflejan en el mensaje saliente.
7. **Configuración faltante en el servidor (500)**:
   - *Dado*: variables `TELEGRAM_BOT_TOKEN` o `TELEGRAM_CHAT_ID` ausentes en `process.env`.
   - *When*: se invoca el handler.
   - *Entonces*: devuelve status 500 con código `server_misconfiguration` sin crashear.

## Qué NO se mockea y qué se falsea
- **Qué NO se mockea**:
  - Código real de `api/report.js` (incluyendo `handler`, `_parseBody`, `sanitize`, construcción de plantillas HTML y mapeo de hilos).
- **Qué se falsea**:
  - `fetch` global hacia la API externa `api.telegram.org` (se intercepta para inspeccionar el cuerpo saliente y simular respuestas/caídas).
  - Objetos `req` y `res` de Node/Vercel (emulador ligero con métodos `status()`, `json()`, `setHeader()`, cabeceras y eventos de stream).
  - Variables de entorno en `process.env` (valores de prueba temporales, restaurados tras cada test).
- **Problema que podría ocultar el mock**:
  - El mock de `fetch` no comprueba si Telegram cambia sus límites de tamaño de mensaje (4096 caracteres) o si rechaza combinaciones específicas de etiquetas HTML.

## Criterios de aceptación
- [ ] Peticiones no-POST devuelven 405 Method Not Allowed.
- [ ] Dominios externos no autorizados reciben 403 Forbidden cuando `PRODUCTION_DOMAIN` está configurado.
- [ ] Subdominios de `vercel.app`, `localhost` y el dominio de producción son permitidos.
- [ ] Caracteres especiales de HTML en `user` son correctamente escapados en el payload enviado a Telegram.
- [ ] Errores de Telegram devuelven código de error sin revelar `TELEGRAM_BOT_TOKEN` al cliente.
- [ ] `req.body` como objeto, string, Buffer o stream crudo se parsea satisfactoriamente.
- [ ] Las variables de entorno de prueba se restauran completamente sin dejar efectos secundarios en el proceso.

## Comando
```bash
node --test tests/api/report.test.mjs
```

## Estado
Pendiente
