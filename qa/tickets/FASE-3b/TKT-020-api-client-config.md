# TKT-020: Endpoint de configuración de cliente y alias de telemetría (#20, P2)

- **ID y título**: TKT-020 — Endpoint serverless `api/client-config.js` y alias funcional `api/telemetry.js`
- **Fase**: F3b (Integración: bridge, SW y API)
- **Prioridad**: P2
- **Dependencias**: `api/client-config.js`, `api/telemetry.js`, `api/report.js`, `node:test`, `node:assert/strict`.

## Entorno y mecanismo de carga
- **Formato**: Módulos ES (`export default function handler(req, res)` y `export const config`). Node v26 detecta automáticamente sintaxis ESM y los importa con `import('./api/client-config.js')` y `import('./api/telemetry.js')`.
- **Firma del handler**: Función `handler(req, res)` síncrona/asíncrona conforme a Vercel Serverless Functions.
- **Lectura de `process.env`**:
  - `NEXT_PUBLIC_LA_CLOUD_URL`: leído en `api/client-config.js:38` al ejecutarse `handler(req, res)`.
  - `NEXT_PUBLIC_LA_CLOUD_ANON_KEY`: leído en `api/client-config.js:39` al ejecutarse `handler(req, res)`.
  - No se leen variables de entorno en el ámbito de carga del módulo (top-level).
- **Aislamiento de variables de entorno**: El test define valores falsos para `NEXT_PUBLIC_LA_CLOUD_URL` y `NEXT_PUBLIC_LA_CLOUD_ANON_KEY` en `process.env` antes de la llamada y los restaura estrictamente en bloques `afterEach` o `finally`.

## Riesgo que cubre

| Riesgo | Escenario | Error que detecta | Ruta |
| --- | --- | --- | --- |
| Petición con método HTTP inválido | Cliente o bot envía POST, PUT o DELETE a `/api/client-config` | El endpoint intenta responder o no declara la cabecera `Allow: GET`, violando la semántica HTTP | `api/client-config.js:29-32` |
| Almacenamiento en caché de credenciales | CDN o proxy intermedio almacena en caché la respuesta de configuración | Si las credenciales de Supabase rotan, los clientes reciben credenciales obsoletas cacheadas | `api/client-config.js:35-36` |
| Caída del cliente por variables de entorno ausentes | Entorno de desarrollo o despliegue preview sin variables de Supabase | La función lanza excepción o devuelve `undefined`, provocando errores no capturados en Sentinel | `api/client-config.js:41-45` |
| Exposición indebida de variables de entorno del servidor | La respuesta JSON incluye accidentalmente variables privadas del entorno Node | Fuga de secretos del backend si se serializa un objeto no filtrado | `api/client-config.js:47` |
| Divergencia del alias de telemetría | `api/telemetry.js` diverge de `api/report.js` tras refactorización | Clientes o bloqueadores de anuncios que usan la ruta alternativa de telemetría fallan o procesan con lógica distinta | `api/telemetry.js:10-11` |

## Tipo y herramienta
Test de integración de handlers serverless con `node:test` y `node:assert/strict`, importando directamente los módulos ES de producción.

## Archivos
- Crear suite de tests: `tests/api/client-config.test.mjs`
- Modificar documentación: `qa/00-plan-maestro.md`, `qa/tickets/FASE-3b/TKT-000-indice.md`, este ticket.
- Producción: sin cambios.

## Escenarios (dado → cuando → entonces)

1. **Método no permitido (405)**:
   - *Dado*: una petición con `req.method = 'POST'` (o `'PUT'`, `'DELETE'`).
   - *Cuando*: se invoca `handler(req, res)` de `api/client-config.js`.
   - *Entonces*: establece la cabecera `Allow: GET`, devuelve status 405 y JSON `{ error: 'Method Not Allowed' }`.
2. **Cabeceras de prevención de caché**:
   - *Dado*: una petición GET válida.
   - *When*: se procesa en `handler(req, res)`.
   - *Entonces*: `res.setHeader` fue invocado con `Cache-Control: no-store, no-cache, must-revalidate` y `Pragma: no-cache`.
3. **Degradación elegante sin variables de entorno**:
   - *Dado*: `NEXT_PUBLIC_LA_CLOUD_URL` y `NEXT_PUBLIC_LA_CLOUD_ANON_KEY` no existen o son strings vacíos en `process.env`.
   - *When*: se invoca `handler(req, res)`.
   - *Entonces*: devuelve status 200 y JSON `{ supabaseUrl: '', supabaseKey: '' }`, permitiendo que Sentinel desactive la sincronización cloud limpiamente sin crashear.
4. **Contrato estricto con variables de entorno configuradas**:
   - *Dado*: `process.env.NEXT_PUBLIC_LA_CLOUD_URL = 'https://fake-project.supabase.co'` y `process.env.NEXT_PUBLIC_LA_CLOUD_ANON_KEY = 'fake-anon-public-key-xyz'`.
   - *When*: se invoca `handler(req, res)`.
   - *Entonces*: devuelve status 200 y el objeto JSON contiene única y exactamente las claves `['supabaseUrl', 'supabaseKey']` con los valores correspondientes. No se expone ninguna otra clave o secreto.
5. **Comprobación del alias `api/telemetry.js`**:
   - *Dado*: los módulos importados de `api/telemetry.js` y `api/report.js`.
   - *When*: se comparan sus exportaciones `default` (el handler) y `config`.
   - *Entonces*: `telemetryModule.default === reportModule.default` y `telemetryModule.config === reportModule.config` son estrictamente verdaderos por referencia.

## Qué NO se mockea y qué se falsea
- **Qué NO se mockea**:
  - Código real de `api/client-config.js`, `api/telemetry.js` y `api/report.js`.
  - Mecanismo de exportación de módulos ES.
- **Qué se falsea**:
  - Objetos `req` y `res` de Node/Vercel (emulador ligero con registro de headers, status y payload JSON).
  - Variables de entorno en `process.env` (valores de prueba temporales, restaurados tras cada test).
- **Problema que podría ocultar el mock**:
  - El mock de `res.setHeader()` y `res.json()` almacena valores en memoria pero no prueba el comportamiento de CDNs reales (como Vercel Edge Network) al interpretar la cabecera `Cache-Control`.

## Criterios de aceptación
- [x] Peticiones que no sean GET devuelven 405 y cabecera `Allow: GET`.
- [x] Se emiten siempre las cabeceras `Cache-Control: no-store, no-cache, must-revalidate` y `Pragma: no-cache`.
- [x] Sin variables de entorno configuradas, devuelve 200 con `{ supabaseUrl: '', supabaseKey: '' }`.
- [x] Con variables de entorno configuradas, la respuesta JSON contiene exclusivamente `supabaseUrl` y `supabaseKey`.
- [x] `api/telemetry.js` exporta por referencia exactamente el mismo handler y config que `api/report.js`.

## Comando
```bash
node --test tests/api/client-config.test.mjs
```

## Estado
Hecho

## Resultados de verificación

- **Ejecución aislada (3 ejecuciones de estabilidad)**:
  - Run 1: 11 tests, 7 suites, 11 pass, 0 fail, 0 todo (código 0).
  - Run 2: 11 tests, 7 suites, 11 pass, 0 fail, 0 todo (código 0).
  - Run 3: 11 tests, 7 suites, 11 pass, 0 fail, 0 todo (código 0).
  - 0% flakiness observado.
- **Verificación por mutación**:
  - Mutación 1 (quitar `no-store` en `Cache-Control` de `api/client-config.js`): detectada inmediatamente por el test de prevención de caché (código 1, 1 fallo: `Debe emitir Cache-Control con no-store`). Revertido limpiamente.
  - Mutación 2 (hacer que `api/client-config.js` filtre una clave extra `internalSecret`): detectada inmediatamente por el test de contrato de claves (código 1, 1 fallo: `El cuerpo debe contener únicamente las dos claves pactadas`). Revertido limpiamente.
- **Impacto en suite completa (`npm test`)**:
  - Salida baseline previa (F3a): 135 tests, 23 suites, 116 pass, 0 fail, 19 todo.
  - Salida tras finalización de F3b: 192 tests (+57 total), 40 suites (+17 total), 170 pass (+54 total), 0 fail, 22 todo (+3 todo). Suite en verde.
