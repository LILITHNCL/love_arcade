# Verificación Humana — Fase 5 (Edge cases)

Documentos relacionados: [00-plan-maestro](00-plan-maestro.md) · [BUGS-ENCONTRADOS](BUGS-ENCONTRADOS.md) · [99-huecos](99-huecos.md) · [TKT-021](tickets/FASE-5/TKT-021-persistencia-limite.md) · [TKT-022](tickets/FASE-5/TKT-022-complete-level-paridad.md) · [TKT-023](tickets/FASE-5/TKT-023-unicode-sistemas.md) · [TKT-024](tickets/FASE-5/TKT-024-multipestana-concurrencia.md) · [TKT-025](tickets/FASE-5/TKT-025-saltos-reloj-transversales.md)

---

## 1. Comandos exactos y conteos reales de la suite

Ejecutar desde la raíz del repositorio (`/data/data/com.termux/files/home/proyectos/love_arcade`):

### 1.1 Tests individuales de la Fase F5

1. **TKT-021 (Persistencia al límite: cuota multiravegador, saneamiento de raíz, podado preventivo y fallos de persistencia)**:
   ```bash
   node --test tests/core/storage-limits.test.mjs
   ```
   *Resultado esperado*: `20 tests, 5 suites (14 pass, 0 fail, 6 todo: BUG-F5-01, BUG-F5-02, BUG-F5-03)`. Salida con código `0`.
   *(Desglose: 14 pass y 6 todo `⚠`: 2 de cuota Firefox/1014 en `Store.save`, 2 de propagación de índices en `migrate` con raíz Array/String, y 2 de incoherencia transaccional en `buyItem` ante cuota agotada).*

2. **TKT-022 (Paridad y valores extremos en completeLevel: Infinity, 0 y decimales en Hub y Bridge)**:
   ```bash
   node --test tests/domain/complete-level.test.mjs
   ```
   *Resultado esperado*: `21 tests, 3 suites (9 pass, 0 fail, 12 todo: BUG-F2b-02, BUG-F2b-03, BUG-F2b-04, BUG-F5-04, BUG-F5-05)`. Salida con código `0`.
   *(Desglose: 9 pass —incluyendo el test de paridad estricta Hub↔Bridge ante tabla de casos anómalos— y 12 todo `⚠` replicados simétricamente 6 en Hub y 6 en Bridge para invalid amounts, Infinity y bloqueo de nivel por idempotencia).*

3. **TKT-023 (Soporte Unicode en nickname, códigos promocionales y serialización Base64/Worker)**:
   ```bash
   node --test tests/domain/unicode-edge-cases.test.mjs
   ```
   *Resultado esperado*: `20 tests, 0 suites (19 pass, 0 fail, 1 todo: BUG-F5-06)`. Salida con código `0`.
   *(Desglose: 19 pass —incluyendo exportación e importación con caracteres > 0xFF, paridad bidireccional Worker↔Fallback en VM y canje estricto de códigos sintéticos sin normalización NFKC— y 1 todo `⚠` en truncado UTF-16 de nickname con emoji al límite de 15 caracteres).*

4. **TKT-024 (Multipestaña, concurrencia y tolerancia a fallos en Sentinel)**:
   ```bash
   node --test tests/integration/concurrency-multitab.test.mjs
   ```
   *Resultado esperado*: `14 tests, 6 suites (12 pass, 0 fail, 2 todo: BUG-F5-07, BUG-F5-08)`. Salida con código `0`.
   *(Desglose: 12 pass —eventos `storage` corruptos o de clave ajena, rehidratación cruzada entre pestañas, snapshots malformados y LWW con relojes coincidentes— y 2 todo `⚠`: mutaciones locales descartadas durante `_handleAuthChange` y colisión de subida inmediata concurrente en `completeLevel`).*

5. **TKT-025 (Saltos de reloj transversales, fronteras horarias, cambio de año y caducidad de TTL)**:
   ```bash
   node --test tests/core/time-jumps.test.mjs
   ```
   *Resultado esperado*: `20 tests, 7 suites (19 pass, 0 fail, 1 todo: BUG-F2c-01)`. Salida con código `0`.
   *(Desglose: 19 pass —salvaguardas ante reloj hacia atrás en `claimDaily` y `repairDailyStreak`, frontera exacta 02:59:59 frente a 03:00:00, cambio de año 31-dic a 01-ene, y conmutación de `verified: false` al vencer el TTL de 4 h— y 1 todo `⚠` por permisión de reclamo de racha con caché caducada).*

---

### 1.2 Suites globales y comprobaciones estáticas

6. **Suite completa del proyecto (ejecución reproducible de `npm test`)**:
   ```bash
   npm test
   ```
   *Resultado esperado*: `276 tests, 58 suites (238 pass, 0 fail, 38 todo)`. Código de salida: `0`.
   *(Línea base previa de F3b: 192 tests, 40 suites, 170 pass, 0 fail, 22 todo. Incremento neto de F5: +84 tests, +18 suites, +68 pass, 0 fail, +16 todo).*

7. **Suite de minijuegos independientes**:
   ```bash
   npm run test:games
   ```
   *Resultado esperado*: `16 tests, 0 suites (16 pass, 0 fail, 0 todo)`. Código de salida: `0`.

8. **Escáner estático de documentación**:
   ```bash
   node tests/static/documentation-static-qa.mjs
   ```
   *Resultado esperado*: `Documentation static QA passed: 92 Markdown files checked, no broken links or references to removed historical docs.` Código de salida: `0`.

---

## 2. Qué NO se pudo verificar en este entorno (Termux / Node.js)

- **Concurrencia nativa multi-proceso de pestañas del navegador**: En `node:vm`, dos contextos comparten un objeto `Map` en memoria y los eventos `storage` son despachados de forma síncrona manual. En un navegador real (Chrome/Firefox/Safari), los eventos `storage` se despachan mediante el bus IPC del sistema operativo entre procesos independientes. La sincronización multi-ventana bajo políticas del sistema operativo (suspensión de pestañas en segundo plano, tab discarding, estrangulamiento de CPU) queda clasificada como **[no verificado]** en este entorno y se delega a las pruebas E2E de Fase F4.
- **Agotamiento de cuota de disco físico a nivel de sistema operativo**: En Node se simularon las excepciones `QuotaExceededError` y `NS_ERROR_DOM_QUOTA_REACHED`. El comportamiento nativo del navegador cuando el disco del dispositivo se llena por completo (incluyendo el diálogo nativo del navegador solicitando permisos de almacenamiento persistente mediante `navigator.storage.persist()`) queda **[no verificado]** aquí.
- **Aislamiento real de Web Worker en hilos del sistema operativo**: El script de producción `js/sync-worker.js` se evaluó en `node:vm` emulando el objeto global `self` (`addEventListener` y `postMessage`). El clonado estructurado de memoria, transferencia de búferes (`ArrayBuffer`), y la gestión de memoria en hilos nativos (`Worker` del navegador) quedan **[no verificado]** aquí y se validarán en navegador real en F4.
- **Manipulación de reloj en hardware físico**: Los saltos de reloj se validaron interceptando `Date.now` en el sandbox VM. El impacto de cambios en la hora del sistema operativo móvil/escritorio con la PWA abierta en segundo plano o durante reconexiones de red celular queda **[no verificado]** en terminal.
- **Servidor Supabase remoto real**: Siguiendo las directrices de seguridad, no se utilizaron credenciales ni conexión a internet; la integración de Sentinel se verificó con `fake-supabase.cjs`. La autenticación y almacenamiento en la nube real de Supabase quedan **[no verificado]** aquí.

---

## 3. Verificación de textos, elementos de interfaz y códigos de retorno (auditoría en código)

Auditoría contra `js/core/state-store.js`, `js/ui/hud-render.js`, `js/domain/daily-streak.js`, `js/domain/game-center.js` y `js/domain/identity.js`:

### 3.1 Notificaciones de almacenamiento (Toasts)

- **Notificación preventiva por almacenamiento al límite (~4 MB)**:
  - Texto exacto: `'Tu progreso está cerca del límite de almacenamiento. Exporta tu partida y contacta soporte.'` (`js/core/state-store.js:129`).
  - Tipo: `'warning'`, renderizado como `<div class="toast toast--warning toast--visible">` (`js/ui/hud-render.js:80-83`). `[verificado]`
  - Evento de analítica: `window.GhostAnalytics?.track('storage_warning', { size_kb: ... })` (`js/core/state-store.js:127`). `[verificado]`

- **Notificación por fallo crítico e irrecuperable de cuota**:
  - Texto exacto: `'No se puede guardar el progreso. Exporta tu partida y borra datos del sitio.'` (`js/core/state-store.js:157`).
  - Tipo: `'error'`, renderizado como `<div class="toast toast--error toast--visible">` (`js/ui/hud-render.js:80-83`). `[verificado]`

- **Medidor o barra visual de cuota en el HUD**:
  - `[no verificado]` (no existe ningún elemento HTML en `index.html` ni en `styles.css` destinado a mostrar un porcentaje o medidor visual continuo de cuota ocupada; la comunicación es exclusivamente mediante avisos toast ante umbrales críticos).

---

### 3.2 Mensajes de estado ante inconsistencias horarias

- **Detección de retroceso en el reloj del sistema operativo (`now < lastClaim`)**:
  - Texto exacto en `claimDaily()`: `'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.'` (`js/domain/daily-streak.js:35`). `[verificado]`
  - Texto exacto en `repairDailyStreak()`: `'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.'` (`js/domain/daily-streak.js:112`). `[verificado]`
  - Código de retorno: `{ success: false, verified: ..., message: '...' }` sin alterar `coins` ni `streak`. `[verificado]`

- **Desincronización de reloj con la red (`desynced === true`)**:
  - Texto exacto: `'Reloj desincronizado. Verifica la hora de tu dispositivo e inténtalo de nuevo.'` (`js/domain/daily-streak.js:43` y `:115`). `[verificado]`

- **Reclamo repetido dentro del mismo día lógico (`diffDays === 0`)**:
  - Texto exacto: `'¡Ya reclamaste tu bono hoy! Vuelve mañana.'` (`js/domain/daily-streak.js:52`). `[verificado]`

- **Botón manual de sincronización horaria en el HUD**:
  - `[no verificado]` (no existe un botón de "Sincronizar reloj" en la UI; la actualización horaria opera internamente mediante `LoveArcadeTime` al sincronizar la aplicación).

---

### 3.3 Identidad de usuario y presentación en interfaz

- **Sufijo / pronombre de género en el HUD**:
  - Elemento `#pref-suffix`: `Store.getStore().gender || '@'` (`js/ui/hud-render.js:108`, `index.html:129`). `[verificado]`
- **Alias de jugador en el HUD**:
  - Elemento `#display-nickname`: `Store.getStore().nickname || ''` (`js/ui/hud-render.js:109`, `index.html:128`). `[verificado]`
- **Título de perfil**:
  - Elemento `#profile-title`: `Store.getStore().nickname || 'Love Arcade'` (`js/ui/hud-render.js:110`, `index.html:246`). `[verificado]`
- **Truncado de nickname**:
  - Truncado a 15 caracteres en `js/domain/identity.js:9`: `store.nickname = String(nickname).trim().slice(0, 15);`. `[verificado]`

---

### 3.4 Códigos de retorno de exportSave e importSave

- **Rechazo por código Base64 modificado o alteración de checksum SHA-256**:
  - Respuesta vía Worker: `{ success: false, message: 'El código fue modificado manualmente. Importación rechazada por integridad.' }` (`js/domain/game-center.js:45`). `[verificado]`
  - Respuesta vía fallback cliente: `{ success: false, message: 'El código fue modificado manualmente. Importación rechazada.' }` (`js/domain/game-center.js:53`). `[verificado]`
- **Exportación exitosa con caracteres Unicode (> 0xFF)**:
  - Retorna string Base64 válido sin lanzar `DOMException: InvalidCharacterError` (`js/domain/game-center.js:34-36` y `js/sync-worker.js:44-46`). `[verificado]`

---

## 4. Procedimiento de verificación manual en navegador

### 4.1 Protocolo de seguridad y salvaguarda de datos

> [!WARNING]
> **Exportar copia de seguridad antes de comenzar**:
> Las pruebas de límite de almacenamiento y multipestaña pueden provocar el recorte de datos o sobreescritura de almacenamiento. Antes de realizar cualquier prueba manual:
> 1. Dirigirse a la sección **Sincronización** (`#tab-sync`).
> 2. Pulsar **"Guardar respaldo"** para descargar el archivo `.labak` actual.
> 3. Utilizar una ventana de incógnito o un **perfil de usuario limpio** en el navegador para evitar contaminar o saturar el `localStorage` de su partida habitual.
> 4. **No utilizar códigos promocionales reales ni credenciales**: en las pruebas de canje o autenticación, emplear exclusivamente claves sintéticas de prueba.

---

### 4.2 Paso a paso: Persistencia al límite y aviso toast de ~4 MB

1. **Iniciar servidor local**:
   ```bash
   python3 -m http.server 8080
   ```
2. **Abrir la consola del navegador**:
   - Acceder a `http://localhost:8080` en una ventana limpia.
   - Abrir DevTools (`F12`) → pestaña **Console**.
3. **Simular payload cercano a 4 MB**:
   - En la consola, inflar el estado con niveles simulados para superar el umbral de 4000 KB:
     ```javascript
     const store = window.LoveArcadeStore.getStore();
     for (let i = 0; i < 15000; i++) {
         store.progress.maze.push('nivel_simulado_largo_para_ocupar_bytes_' + i);
     }
     window.LoveArcadeStore.save();
     ```
   - *Resultado esperado*:
     - Aparece en pantalla un toast amarillo/naranja con el texto: `'Tu progreso está cerca del límite de almacenamiento. Exporta tu partida y contacta soporte.'`.
     - En el almacenamiento, `trimGameProgress()` recorta las entradas de niveles a las últimas 50.

---

### 4.3 Paso a paso: Sincronización cruzada entre dos pestañas (Cross-tab)

1. Abrir dos pestañas en el mismo navegador apuntando a `http://localhost:8080`.
2. En la **Pestaña 1**, abrir la consola y otorgar monedas:
   ```javascript
   window.LoveArcadeEconomy.addCoins(200);
   ```
3. Ir a la **Pestaña 2**:
   - Observar el contador de monedas en el HUD o ejecutar en su consola:
     ```javascript
     window.LoveArcadeStore.getStore().coins;
     ```
   - *Resultado esperado*: La Pestaña 2 ha recibido el evento `storage` y rehidratado su estado desde el disco, reflejando el incremento de 200 monedas de inmediato sin necesidad de recargar la página (`F5`).

---

### 4.4 Paso a paso: Unicode complejo en identidad y respaldo Base64

1. En la consola del hub:
   - Configurar un alias con emojis y caracteres multilingües:
     ```javascript
     window.LoveArcadeIdentity.setIdentity('Ángel 👾✨', '@');
     ```
   - *Resultado esperado*: En el HUD se actualiza el alias mostrando `'Ángel 👾✨'` sin caracteres rotos.
2. Exportar la partida:
   ```javascript
   const codigo = await window.GameCenter.exportSave();
   console.log('Código exportado:', codigo);
   ```
   - *Resultado esperado*: Se genera una cadena en Base64 sin arrojar error `InvalidCharacterError`.
3. Probar la restauración:
   ```javascript
   const res = await window.GameCenter.importSave(codigo);
   console.log('Resultado import:', res);
   ```
   - *Resultado esperado*: Retorna `{ success: true }` y el alias con emojis se mantiene intacto.

---

### 4.5 Paso a paso: Salvaguarda ante salto de reloj hacia atrás

1. En la consola, consultar el estado actual de la racha diaria:
   ```javascript
   console.log(window.LoveArcadeStore.getStore().daily);
   ```
2. Realizar un reclamo de racha válido si está disponible, o simular un reclamo con marca de tiempo actual:
   ```javascript
   window.LoveArcadeStore.getStore().daily.lastClaim = Date.now();
   window.LoveArcadeStore.save();
   ```
3. Retrasar la hora del sistema operativo 2 horas hacia el pasado (o en DevTools simular reloj atrasado).
4. Intentar reclamar la racha desde el botón del HUD o por consola:
   ```javascript
   const intento = window.StreakHub.claim();
   console.log(intento);
   ```
   - *Resultado esperado*:
     - La llamada retorna `{ success: false, message: 'Se detectó una inconsistencia horaria. Por favor, verifica la configuración de tu dispositivo.' }`.
     - El botón del HUD no premia monedas ni avanza la racha.

---

### 4.6 Paso a paso: Paridad Hub ↔ Bridge en minijuego

1. Iniciar cualquier minijuego (ej. Laberinto o Sopa de Letras) dentro del Arcade.
2. En la consola del iframe del minijuego:
   ```javascript
   window.GameCenter.completeLevel('maze', 'nivel_prueba_01', 50);
   ```
3. Volver al Hub principal:
   - *Resultado esperado*: El nivel `'nivel_prueba_01'` aparece registrado en `progress.maze` y el saldo del Hub aumentó en 50 monedas, demostrando paridad e interoperabilidad total del contrato.
