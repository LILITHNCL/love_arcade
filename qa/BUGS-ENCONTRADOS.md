
# Bugs Encontrados

## Hallazgo de Seguridad
- **Ruta**: `promo-codes.js` (u origen equivalente, documentado en R11 del plan)
- **Problema**: Códigos promocionales en texto plano en comentarios.
- **Tipo**: Hallazgo de seguridad.
- **Nota**: Documentado por instrucción del usuario. No se toca.

## Fallos reales detectados en `tests/daily-streak-hub-qa.mjs`

### 1. Falta de Atribución CC BY
- **Descripción**: La atribución CC BY para la animación Rive ("aristote") no se muestra en la interfaz. Solo aparece en `assets/rive/fire-streak-LICENSE.txt` y en archivos de QA.
- **Archivo y línea**: `tests/daily-streak-hub-qa.mjs` (Línea 12).
- **Comportamiento esperado vs real**: Se esperaba que el HTML incluyera la atribución textualmente, pero no aparece ninguna en ninguna página.
- **Test**: `assert.match(html,/Animación “Dynamic streak fire” por aristote · CC BY/);`
- **Estado**: Decisión del usuario: la atribución queda solo en documentación, no en la app. El todo actual contradice la decisión y se resuelve en F6.

### 4. Opacidad hardcodeada rompe theming (glow)
- **Descripción**: El estado "available" del glow tiene opacidad fijada en duro en lugar de usar el design token.
- **Archivo y línea**: `styles.css` (líneas 1123 y 1130).
- **Comportamiento esperado vs real**: Se esperaba que usara la variable `--streak-rive-glow-available-opacity` (.58), pero está fijado a `.78`.
- **Test**: `assert.match(css,/\.player-hud__glow-layer\[data-state="available"\][\s\S]*?opacity:var\(--streak-rive-glow-available-opacity\)/);`
- **Estado**: Decisión del usuario: la opacidad correcta del estado available es .78. El todo actual contradice la decisión y se resuelve en F6.

### Bug F2a-01: Pérdida de historial en memoria tras doble fallo de cuota
- **Descripción**: Si falla el reintento de guardado en `emergencyCleanup` (debido a cuota de disco exhausta), se borra el historial con `store.history = []` en memoria. Existe una notificación (toast) indicando que no se pudo guardar, pero el estado en memoria queda corrupto sin el historial. Esto se convierte en una pérdida de datos real cuando ocurre el siguiente guardado exitoso, que persistirá el vacío.
- **Archivo y línea**: `js/core/state-store.js` (Línea 159).
- **Comportamiento esperado vs real**: Se esperaba que el historial no se modificara destructivamente en memoria si el save falla por completo. Realidad: se asigna `[]` pero el guardado falla, quedando la app sin historial en memoria.
- **Test**: `dado un doble fallo de cuota, cuando ocurre, entonces no debe vaciar el historial en memoria` en `tests/core/state-store.test.mjs`.
- **Estado**: Pendiente. Marcado como `{ todo: 'BUG-F2a-01' }` en test.

### Bug F2b-01: `buyItem` confía ciegamente en el precio pasado como argumento
- **Descripción**: La función `buyItem` toma el precio directamente del objeto `itemData` que se le pasa en lugar de buscarlo en un catálogo seguro inmutable.
- **Archivo y línea**: `js/domain/economy.js` (Línea 11).
- **Comportamiento esperado vs real**: Se esperaba que un precio menor alterado por un cliente/bridge fuera rechazado o reemplazado por el oficial. Realidad: acepta el precio pasado y permite comprar algo caro por 0 o 1 moneda.
- **Test**: `dado llamador alterado (R12), cuando pasa precio menor al catálogo, entonces confía en el parámetro` en `tests/domain/economy.test.mjs`.
- **Estado**: Pendiente. Marcado como `{ todo: 'BUG-F2b-01' }` en test.

### Bug F2b-02: `completeLevel` permite valores string que concatenan el saldo
- **Descripción**: Si el `rewardAmount` pasado a `completeLevel` es un string (ej. `"5"`), la operación `store.coins += rewardAmount` concatena en vez de sumar matemáticamente.
- **Archivo y línea**: `js/domain/game-center.js` (Línea 19) y `js/game-bridge-runtime.js` (Línea 17).
- **Comportamiento esperado vs real**: Debería rechazar montos string o hacer un casteo seguro. Realidad: el saldo muta de `100` a `"1005"`.
- **Test**: `dado un monto inválido tipo string, cuando se completa, entonces concatena (BUG R1)` en `tests/domain/complete-level.test.mjs`.
- **Estado**: Pendiente. Marcado como `{ todo: 'BUG-F2b-02' }` en test.

### Bug F2b-03: `completeLevel` no valida NaN
- **Descripción**: Si el `rewardAmount` pasado a `completeLevel` es `NaN`, el saldo se corrompe y se convierte en `NaN` de forma irrecuperable.
- **Archivo y línea**: `js/domain/game-center.js` (Línea 19) y `js/game-bridge-runtime.js` (Línea 17).
- **Comportamiento esperado vs real**: Debería rechazar `NaN`. Realidad: el saldo muta a `NaN`.
- **Test**: `dado un monto NaN, cuando se completa, entonces corrompe el saldo a NaN (BUG R1)` en `tests/domain/complete-level.test.mjs`.
- **Estado**: Pendiente. Marcado como `{ todo: 'BUG-F2b-03' }` en test.

### Bug F2b-04: `completeLevel` permite recompensas negativas
- **Descripción**: Si el `rewardAmount` pasado a `completeLevel` es negativo (ej. `-10`), el saldo disminuye. Esto permite que un minijuego malicioso o erróneo drene el saldo del jugador.
- **Archivo y línea**: `js/domain/game-center.js` (Línea 19) y `js/game-bridge-runtime.js` (Línea 17).
- **Comportamiento esperado vs real**: Debería rechazar valores negativos o menores o iguales a cero (salvo justificación). Realidad: el saldo disminuye en 10 monedas.
- **Test**: `dado un monto negativo, cuando se completa, entonces permite restar del saldo (BUG R1)` en `tests/domain/complete-level.test.mjs`.
- **Estado**: Pendiente. Marcado como `{ todo: 'BUG-F2b-04' }` en test.

### Bug F2c-01: Sin caché de tiempo verificada, se permite el reclamo de racha usando `Date.now()` local
- **Descripción**: Si no existe caché de tiempo (`_readTimeCache` devuelve `verified: false`), `claimDaily` permite el reclamo de racha usando el valor de `Date.now()` provisto por la lectura. Esto permite manipulación de reloj (viajar en el tiempo) borrando el caché y adelantando la hora del sistema operativo, obteniendo recompensas infinitas sin validación de red.
- **Archivo y línea**: `js/domain/daily-streak.js` (Línea 47). No hay validación de `!verified` bloqueando.
- **Comportamiento esperado vs real**: Se esperaba que un tiempo no verificado fuera rechazado o puesto en cola para prevenir la trampa de cambio de reloj sin red. Realidad: permite el avance de racha y recompensa.
- **Test**: `dado un caché no verificado, cuando se reclama racha, entonces NO debería permitir el reclamo basándose en Date.now()` en `tests/domain/daily-streak.test.mjs`.
- **Estado**: Pendiente. Marcado como `{ todo: 'BUG-F2c-01: ...' }` en test.

### Bug F2d-01: payload legacy sin checksum es importado permitiendo inyección (R3)
- **Descripción**: La rama legacy de `importSave` en `js/domain/game-center.js` (L51-55) y en el Web Worker `js/sync-worker.js` (L85-92) acepta importar códigos base64 que contienen un objeto JSON sin la propiedad `checksum`. Esto significa que cualquiera puede codificar en base64 `{"coins": 99999}` e inyectarlo, sobreescribiendo su saldo y progreso porque se salta la comprobación de integridad.
- **Archivo y línea**: `js/domain/game-center.js` (Línea 51-55 aprox., fallback) y `js/sync-worker.js` (Línea 85-92, Worker real).
- **Alcance real y llamadores de UI**: No existe ningún llamador de `exportSave`/`importSave` en la UI (`index.html`, `js/ui/hud-render.js`, `js/shop-logic.js`). La interfaz de respaldo utiliza exclusivamente `BackupEngine` (`.labak`). Por tanto, la inyección solo es explotable mediante llamada manual desde la consola de desarrollo del navegador (`window.GameCenter.importSave(...)`).
- **Comportamiento esperado vs real**: Idealmente solo deberían aceptarse payloads firmados, o se debería evaluar si esta compatibilidad es estrictamente necesaria. Actualmente muta el estado local permitiendo trampas.
- **Test**: `dado payload sin checksum (rama legacy), cuando se importa, entonces debería rechazarse sin mutar (R3)` en `tests/domain/save-export-import.test.mjs:78` (marcado `todo`: asierta el comportamiento deseado `success === false` y store sin cambios; hoy falla con `9999 !== 150`, es decir, acepta y muta).
- **Estado**: Pendiente de decisión humana (documentado con todo).

### Bug F2d-02: `redeemPromoCode` lanza TypeError no capturado con entradas no-string
- **Descripción**: La función `redeemPromoCode(inputCode)` en `js/domain/promo-codes.js` (L48) ejecuta `inputCode.trim().toUpperCase()` asumiendo que `inputCode` siempre es una cadena de texto. Si se le pasa `null`, `undefined` o un tipo primitivo como `number`, la llamada `.trim()` falla con `TypeError` no capturado en lugar de validar el tipo y devolver un resultado controlado `{ success: false, message: 'Código inválido' }`.
- **Archivo y línea**: `js/domain/promo-codes.js` (Línea 48).
- **Escenario**: Invocación programática de `redeemPromoCode` con entradas no-string (`null`, `undefined`, `1234`).
- **Comportamiento esperado vs real**:
  - *Esperado*: Rechazar controladamente devolviendo `{ success: false, message: 'Código inválido' }` manteniendo intacto el estado (saldo, hashes e historial).
  - *Real*: Lanza `TypeError` no controlado (`Cannot read properties of null (reading 'trim')`). No llega a mutar el estado, pero rompe el contrato de retorno `{ success, message }`.
- **Test**: `dado null, undefined o número, cuando se canjea, entonces debería devolver success:false sin mutar` en `tests/domain/promo-codes.test.mjs:81` (marcado `{ todo: 'BUG-F2d-02: redeemPromoCode lanza TypeError con entradas no-string en vez de devolver success:false' }`).
- **Severidad**: Baja. La UI de producción (`js/shop-logic.js:1408`) siempre envía el valor de un `<input>` HTML (`input.value.trim()`), por lo que en el flujo visual del usuario siempre es un string.
- **Estado**: Pendiente (decisión del usuario si añadir guarda defensiva de tipo).

### Bug F3a-01: Pérdida de progreso local por LWW ante relojes desfasados (R7)
- **Descripción**: La resolución de conflictos en `SentinelCloudSync._handleAuthChange` utiliza una estrategia Last-Write-Wins (LWW) basada exclusivamente en comparar el timestamp del cliente en la nube (`updated_at`, generado con `new Date().toISOString()`) contra el timestamp local (`love_arcade_sentinel_ts`). Si un dispositivo previo subió datos con un reloj adelantado (o el dispositivo actual tiene el reloj atrasado), al iniciar sesión la condición `cloudTime > localTime` se cumple ciegamente. Sentinel ejecuta `_applySnapshot` y sobreescribe destructivamente el progreso local (monedas, niveles y guardados de juegos) sin detectar que el estado local posee un progreso más avanzado ni realizar una unión/fusión de progreso.
- **Archivo y línea**: `js/cloud/sentinel.js` (Líneas 399-404 y L270).
- **Escenario**: El usuario avanza partidas en el dispositivo B (ej. alcanza 1000 monedas), pero por desfase de reloj su marca local es anterior a la marca de la nube (ej. 50 monedas guardadas previamente por un dispositivo A con reloj adelantado). Al iniciar sesión en B, el snapshot de la nube destruye las 1000 monedas locales y las restablece a 50.
- **Comportamiento esperado vs real**:
  - *Esperado*: Ante conflicto de estados divergentes con progreso avanzado local, no destruir silenciosamente el avance (p. ej. mediante merge con preservación del mayor saldo/niveles desbloqueados o resolución interactiva de conflictos).
  - *Real*: Sobreescribe ciegamente el almacenamiento local con los datos remotos obsoletos.
- **Test**: `dado un desfase de reloj donde el estado local tiene mayor progreso pero menor timestamp que la nube, cuando se inicia sesión, entonces no debería sobreescribir destructivamente el progreso local (R7)` en `tests/integration/sentinel-lww-auth.test.mjs` (marcado `{ todo: 'BUG-F3a-01: LWW basado únicamente en timestamp de cliente sobreescribe progreso local más avanzado ante relojes desfasados' }`).
- **Estado**: Pendiente de decisión humana (documentado con todo).

### Bug F3a-02: `_sentinelSync` aborta silenciosamente la subida en `_handleAuthChange` por flag `_isRestoringSession`
- **Descripción**: Al procesar la autenticación en `_handleAuthChange`, se activa la bandera interna `_isRestoringSession = true` (para evitar bucles del interceptor de almacenamiento mientras se restaura la sesión). Sin embargo, cuando el estado local es más reciente (`localTime > cloudTime`), cuando la nube está vacía (`!hasCloudSnapshot`), o ante un empate con diferencias (`localTime === cloudTime && snapshotsDiffer`), `_handleAuthChange` invoca `await _sentinelSync()`. Dentro de `_sentinelSync()`, la primera línea de guarda es `if (!_sbClient || !_sbSession || _isRestoringSession) return;`. Como `_isRestoringSession` permanece en `true` durante todo el flujo de autenticación, `_sentinelSync()` aborta de inmediato y nunca ejecuta el `upsert` a Supabase. Como resultado, las partidas locales más recientes o los progresos iniciales de cuentas nuevas no se suben a la nube durante el flujo de inicio de sesión.
- **Archivo y línea**: `js/cloud/sentinel.js` (Líneas 263, 360, 406, 413 y 763-765).
- **Escenario**: Un usuario inicia sesión teniendo progreso local nuevo o más reciente que la nube (o habiendo acumulado acciones con `immediateCloudSync: true` offline); el sistema calcula correctamente que el estado local debe prevalecer o reintentarse, pero la subida es silenciosamente abortada por la guarda de `_isRestoringSession`.
- **Comportamiento esperado vs real**:
  - *Esperado*: Ejecutar la subida del snapshot local a Supabase (`upsert`) cuando el estado local es más reciente, cuando la nube está vacía, ante un empate con diferencias, o al despachar la cola de sincronización inmediata pendiente tras autenticarse (`la:cloud-authenticated`).
  - *Real*: `_sentinelSync()` retorna inmediatamente (`return`), dejando la nube desactualizada y consumiendo el reintento sin notificar error.
- **Test**: Cuatro tests cubren este fallo:
  - Tres tests en `tests/integration/sentinel-lww-auth.test.mjs` (marcados con `{ todo: 'BUG-F3a-02: _sentinelSync es abortado en _handleAuthChange porque _isRestoringSession está activo' }`):
    1. `dado un estado local más reciente que la nube, cuando se inicia sesión, entonces debería subir el snapshot local a la nube y conservar el estado local intacto`
    2. `dado un empate de marcas de tiempo pero con snapshots divergentes, cuando se inicia sesión, entonces debería resolver a favor del estado local y subir a la nube`
    3. `dado un usuario nuevo sin datos en la nube (nube vacía), cuando se inicia sesión, entonces debería subir el snapshot local inicial a la nube`
  - Un test en `tests/integration/immediate-cloud-sync.test.mjs` (marcado con `{ todo: 'BUG-F3a-02: _sentinelSync es abortado en _handleAuthChange / la:cloud-authenticated porque _isRestoringSession está activo' }`):
    4. `dado usuario sin sesión, cuando ocurre una acción con immediateCloudSync, entonces encola reintento y sube al iniciar sesión`
- **Estado**: Pendiente de corrección de producto (documentado con todo).

### Bug F3a-03: `importBackupFromFile` restaura cualquier clave sin lista blanca (R4)
- **Descripción**: La función `importBackupFromFile` en `js/backup-engine.js` (L213-218) itera sobre todas las entradas presentes en el objeto `payload.keys` y las persiste directamente en `localStorage` con `localStorage.setItem(key, value)`. No existe ninguna validación ni filtrado contra una lista blanca de claves autorizadas (como `KNOWN_KEYS` o los patrones en `DYNAMIC_PATTERNS`). Como consecuencia, un archivo de respaldo con un checksum válido puede inyectar o sobreescribir cualquier clave arbitraria en el almacenamiento local del navegador.
- **Archivo y línea**: `js/backup-engine.js` (Líneas 213-218).
- **Escenario**: Un archivo `.labak` válido que contenga claves arbitrarias ajenas a Love Arcade (ej. `malicious_arbitrary_key`, tokens o preferencias no vigiladas). Al importarlo, todas las claves arbitrarias son persistidas en `localStorage`.
- **Comportamiento esperado vs real**:
  - *Esperado*: Filtrar las claves importadas permitiendo únicamente aquellas reconocidas como legítimas del catálogo del juego (`KNOWN_KEYS`, patrones dinámicos `puz_arcade_save_*`, `la_milestone_progress_*`), descartando claves arbitrarias no vigiladas.
  - *Real*: Escribe sin restricción todas las claves presentes en `payload.keys`.
- **Test**: `dado un archivo .labak con claves arbitrarias no vigiladas (R4), cuando se importa, entonces solo debería escribir claves autorizadas (lista blanca) y omitir claves arbitrarias` en `tests/integration/backup-engine.test.mjs` (marcado `{ todo: 'BUG-F3a-03: importBackupFromFile restaura cualquier clave sin lista blanca (R4)' }`).
- **Estado**: Pendiente de decisión humana (documentado con todo).

### Bug F3b-01: Almacenamiento indiscriminado en caché de respuestas no-OK (500/404) y endpoints `/api/*` en Service Worker (R8)
- **Descripción**: El listener del evento `fetch` en `sw.js` (L134-142) aplica una estrategia cache-first a todas las solicitudes dirigidas a su mismo origen (`url.origin === self.location.origin`). Ante un fallo inicial de caché (`caches.match` retorna `undefined`), realiza la petición de red con `fetch(event.request)` y guarda incondicionalmente la respuesta en `CACHE_NAME` con `cache.put(event.request, response.clone())`. Esto genera dos problemas de diseño:
  1. Respuestas de error del servidor o recursos inexistentes (`!response.ok`, tales como HTTP 500 o HTTP 404) son guardadas en disco en la caché de la aplicación. En peticiones posteriores, el Service Worker sirve el error cacheado de forma permanente sin consultar nuevamente la red, impidiendo que la aplicación se recupere cuando el servidor o la red vuelven a funcionar.
  2. Endpoints dinámicos de backend bajo `/api/*` (como `/api/client-config` o cualquier ruta API del mismo origen) son interceptados e insertados en la caché estática de assets sin comprobar la ruta ni cabeceras como `Cache-Control: no-store`, congelando la respuesta dinámica inicial.
- **Archivo y línea**: `sw.js` (Líneas 134-142).
- **Escenario**:
  - Escenario 1: Un recurso falla transitoriamente con error 500. `sw.js` almacena el 500 en `CACHE_NAME`. Al reestablecerse el backend y responder 200, las siguientes solicitudes continúan recibiendo el código 500 cacheado.
  - Escenario 2: La aplicación realiza un GET a `/api/client-config`. `sw.js` lo almacena en `CACHE_NAME`. Futuros cambios en la configuración del servidor no son percibidos por el cliente porque se sirve la copia estática.
- **Comportamiento esperado vs real**:
  - *Esperado*: El Service Worker no debe almacenar en caché respuestas no exitosas (`!response.ok`), permitiendo reintentar la red cuando el servidor se recupere. Asimismo, las rutas dinámicas `/api/*` deben ser excluidas de la caché estática del shell o gestionadas con estrategia network-only/network-first sin almacenamiento ciego.
  - *Real*: Guarda ciegamente cualquier respuesta en `CACHE_NAME` (`cache.put`) y la sirve indefinidamente en llamadas posteriores.
- **Test**: `R8 · el Service Worker no debe almacenar respuestas no-OK (500) perpetuando el error tras recuperarse el servidor` en `tests/pwa/service-worker-fetch.test.mjs` (marcado `{ todo: 'BUG-F3b-01: decisión de producto pendiente - el SW cachea respuestas !response.ok y /api/* en CACHE_NAME perpetuando el fallo tras recuperarse la red' }`).
- **Estado**: Pendiente de decisión humana (marcado como "decisión de producto pendiente").

### Bug F3b-02: `eventLabel` pasa a mayúsculas texto ya escapado generando entidades HTML en mayúsculas
- **Descripción**: En `api/report.js`, el campo `event` se sanitiza en L288 (`const safeEvent = sanitize(event).slice(0, 80)`), transformando `<`, `>`, `&`, `"`, `'` en entidades HTML (`&lt;`, `&gt;`, `&amp;`, `&quot;`, `&#39;`). En L314, para generar el título en negrita del mensaje en Telegram, se ejecuta `const eventLabel = safeEvent.replace(/_/g, ' ').toUpperCase()`. Como consecuencia de aplicar `.toUpperCase()` sobre texto ya escapado, las secuencias de escape HTML se convierten en mayúsculas (`&LT;`, `&GT;`, `&AMP;`, `&QUOT;`).
- **Archivo y línea**: `api/report.js` (Línea 314).
- **Escenario**: Petición POST a `/api/report` con `event = 'ev <x> > & "q"'` y `user = 'A <b> & "c"'`.
- **Comportamiento esperado vs real**:
  - *Esperado*: El texto escapado debe conservar las entidades HTML en minúsculas estándar (p. ej. `&lt;x&gt;` o `&lt;X&gt;` según capitalización de contenido, pero con delimitadores de entidad en minúsculas `&lt;`, `&gt;`, `&amp;`, `&quot;`).
  - *Real*: `.toUpperCase()` convierte indiscriminadamente las entidades a mayúsculas: `EV &LT;X&GT; &GT; &AMP; &QUOT;Q&QUOT;` (mientras que `safeUser` conserva `A &lt;b&gt; &amp; &quot;c&quot;`).
- **Impacto sobre Telegram**: "no verificado" (no se evalúa en producción si el parser HTML de Telegram acepta entidades en mayúsculas o las rechaza/desescapa erróneamente).
- **Test**: `eventLabel en mayúsculas conserva las entidades HTML en minúsculas en el mensaje a Telegram` en `tests/api/report.test.mjs` (marcado `{ todo: 'BUG-F3b-02: decisión de producto pendiente - eventLabel pasa a mayúsculas texto ya escapado' }`).
- **Estado**: Pendiente de decisión de producto (documentado con todo).

## Hallazgos de diseño y arquitectura

### Consideración de seguridad: Checksum SHA-256 en BackupEngine sin salt (solo detecta corrupción)
- **Ruta**: `js/backup-engine.js` (L90-95, L200-211) y `js/sync-worker.js` (L115).
- **Detalle**: El checksum generado y validado en los archivos `.labak` es un hash SHA-256 plano del string canónico del objeto de respaldo, sin incorporar ningún secreto o sal (`salt`). Por diseño, este mecanismo garantiza exclusivamente detección de corrupción accidental durante la transferencia o almacenamiento; no ofrece garantías contra manipulación maliciosa de datos (tampering), ya que cualquier usuario o herramienta externa puede alterar los datos y recalcular legítimamente el hash SHA-256 esperado sin requerir claves secretas.
- **Nota**: Siguiendo las directrices del proyecto, no se inventa un test de regresión para esta condición por ser la especificación y diseño actual del formato `.labak`.

