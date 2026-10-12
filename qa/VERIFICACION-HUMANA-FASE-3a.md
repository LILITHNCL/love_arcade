# Verificación Humana — Fase 3a (Integración de Cloud y Backup)

Documentos relacionados: [00-plan-maestro](00-plan-maestro.md) · [BUGS-ENCONTRADOS](BUGS-ENCONTRADOS.md) · [99-huecos](99-huecos.md) · [TKT-013](tickets/FASE-3a/TKT-013-sentinel-interceptor.md) · [TKT-014](tickets/FASE-3a/TKT-014-sentinel-lww-auth.md) · [TKT-015](tickets/FASE-3a/TKT-015-backup-engine.md) · [TKT-016](tickets/FASE-3a/TKT-016-auditoria-immediate-cloud-sync.md)

---

## 1. Comandos exactos y conteos reales de la suite

Ejecutar desde la raíz del repositorio (`/data/data/com.termux/files/home/proyectos/love_arcade`):

### 1.1 Tests individuales de la Fase F3a

1. **TKT-013 (Sentinel: interceptor de localStorage)**:
   ```bash
   node --test tests/integration/sentinel-interceptor.test.mjs
   ```
   *Resultado esperado*: `8 tests (8 pass, 0 fail, 0 todo)`. Salida limpia con código `0`.

2. **TKT-014 (Sentinel: LWW al iniciar sesión)**:
   ```bash
   node --test tests/integration/sentinel-lww-auth.test.mjs
   ```
   *Resultado esperado*: `8 tests (4 pass, 0 fail, 4 todo: BUG-F3a-01, BUG-F3a-02 [3 tests])`. Código `0`.

3. **TKT-015 (BackupEngine: exportación e importación .labak)**:
   ```bash
   node --test tests/integration/backup-engine.test.mjs
   ```
   *Resultado esperado*: `11 tests (10 pass, 0 fail, 1 todo: BUG-F3a-03)`. Código `0`.

4. **TKT-016 (Auditoría de sincronización inmediata immediateCloudSync)**:
   ```bash
   node --test tests/integration/immediate-cloud-sync.test.mjs
   ```
   *Resultado esperado*: `11 tests (10 pass, 0 fail, 1 todo: BUG-F3a-02)`. Código `0`.

### 1.2 Suites globales y comprobaciones estáticas

5. **Suite completa del proyecto**:
   ```bash
   npm test
   ```
   *Resultado esperado*: `135 tests, 23 suites (116 pass, 0 fail, 19 todo)`. Código de salida: `0`.
   *(Línea base previa de F2d: 97 tests, 84 pass, 0 fail, 13 todo. Incremento neto: +38 tests, +32 pass, +6 todo).*

6. **Suite de minijuegos independientes**:
   ```bash
   npm run test:games
   ```
   *Resultado esperado*: `16/16 pass (0 fail, 0 todo)`. Código de salida: `0`.

7. **Escáner estático de documentación**:
   ```bash
   node tests/static/documentation-static-qa.mjs
   ```
   *Resultado esperado*: `Documentation static QA passed: 77 Markdown files checked, no broken links or references to removed historical docs.` Código `0`.

---

## 2. Qué NO se pudo verificar en este entorno (Termux / Node.js)

- **Supabase real y políticas RLS**: En el entorno local de Termux/Node.js no se dispone de conexión de red externa ni de credenciales secretas (por directriz estricta de seguridad, no se leen archivos `.env` ni se configuran tokens de acceso). Las pruebas automatizadas utilizan un mock completo en memoria (`tests/helpers/fake-supabase.cjs`) que emula la API del SDK de Supabase (`auth.onAuthStateChange`, `auth.getSession`, `auth.signInWithPassword`, `from().select().eq().maybeSingle()`, `from().upsert()`). La interacción con los servidores reales de Supabase, la resolución de RLS (`own_select`, `own_insert`, `own_update` basadas en `auth.uid() = id`), la latencia real de red y la gestión de tokens JWT quedan **NO VERIFICADAS** aquí y deben comprobarse manualmente en el navegador con un proyecto activo de Supabase.
- **Web Worker real para Backup (`js/sync-worker.js`)**: En Node.js no se dispone de la API `Worker` del DOM. Los tests de `BackupEngine` evalúan la ruta principal nativa con `CompressionStream`, `DecompressionStream` y `crypto.subtle`. La delegación de tareas hacia `window.workerTask` en el worker en segundo plano requiere un entorno de navegador con Web Workers habilitados.
- **Descarga física al sistema de archivos del usuario**: En las pruebas de `BackupEngine.exportBackup` se comprueba mediante un shim DOM que se crea un elemento `<a>`, se asigna el atributo `download` y el blob URL, se añade al DOM y se llama a `click()`. La descarga real del archivo `.labak` en la carpeta de descargas del sistema operativo requiere interacción humana en un navegador.
- **Selector de archivos nativo del sistema operativo (`<input type="file">`)**: La interacción con el cuadro de diálogo de selección de archivos del sistema requiere un navegador real con interfaz gráfica.
- **Eventos del ciclo de vida del navegador (`beforeunload`, `pagehide`, `visibilitychange`)**: La ejecución de los listeners sincronizadores ante cierre de pestaña o cambio de visibilidad solo puede comprobarse de forma integral en un navegador real.

---

## 3. Verificación de textos y elementos de interfaz (auditoría en código)

Auditoría contra `index.html`, `js/shop-logic.js` y `js/backup-engine.js`:

### 3.1 Sección Sincronización — Respaldo local `.labak`

- **"Guardar respaldo"**:
  - `[verificado]` como encabezado de tarjeta: `<h3 class="memory-card__title">Guardar respaldo</h3>` (`index.html:669`).
  - `[verificado]` como texto del botón de exportación: `<button id="btn-export" ...><span>Guardar respaldo</span></button>` (`index.html:673-676`).
  - `[verificado]` como descripción de tarjeta: `<p class="memory-card__sub">Crea una copia de tu partida para guardarla donde prefieras.</p>` (`index.html:670`).
- **"Elegir respaldo"**:
  - `[verificado]` como texto de la etiqueta del input de archivos: `<label for="import-file" class="btn-ghost file-label" ...>Elegir respaldo</label>` (`index.html:691-693`).
- **"Ningún archivo seleccionado"**:
  - `[verificado]` como indicador por defecto del nombre de archivo: `<span id="import-file-name" class="file-name-display">Ningún archivo seleccionado</span>` (`index.html:695`).
- **"Restaurar progreso"**:
  - `[verificado]` como texto del botón de importación: `<button id="btn-import" ...><span>Restaurar progreso</span></button>` (`index.html:697-700`).
- **"Restaurar partida"**:
  - `[verificado]` como encabezado de tarjeta: `<h3 class="memory-card__title">Restaurar partida</h3>` (`index.html:686`).
  - `[verificado]` como descripción de tarjeta: `<p class="memory-card__sub">Elige un respaldo guardado para recuperar tu progreso.</p>` (`index.html:687`).
- **"Importar respaldo"**:
  - `[texto no verificado]` en la UI visible como botón — No existe ningún botón con este texto exacto. El botón de importación dice textualmente **"Restaurar progreso"** (`index.html:700`). Sin embargo, el mensaje dinámico tras elegir archivo indica: `"Archivo \"<nombre>\" listo. Haz clic en Importar."` (`js/shop-logic.js:1819`).
- **Modal de advertencia de restauración**:
  - `[verificado]` título del modal: `'Importar partida'` (`js/shop-logic.js:1504`).
  - `[verificado]` advertencia de sustitución: `"Esto reemplazará tu progreso actual (monedas, wallpapers, racha y ajustes)... Esta acción no se puede deshacer."` (`js/shop-logic.js:1506-1509`).
  - `[verificado]` botón de confirmación del modal: `'Sí, importar'` (`js/shop-logic.js:1510`).

### 3.2 Sección Sincronización — Sentinel Cloud Sync

- **"Guardado en la nube"**:
  - `[verificado]` como título de tarjeta: `<h3 class="memory-card__title">Guardado en la nube</h3>` (`index.html:711`).
  - `[verificado]` como subtítulo: `<p class="memory-card__sub">Conecta tu cuenta para mantener tu avance disponible.</p>` (`index.html:712`).
- **Badge de estado en tiempo real**:
  - `[verificado]` contenedor: `<span id="cloud-status-badge">` (`index.html:715`).
  - `[verificado]` etiqueta por defecto: `"Inactivo"` (`index.html:717`, `js/cloud/sentinel.js:132`).
  - `[verificado]` estados dinámicos del badge:
    - Inactivo: `"Inactivo"` (`var(--text-low)`)
    - Conectado: `"Conectado"` (`#63b3ed`)
    - Sincronizando: `"Sincronizando…"` (`#f6ad55`)
    - Sincronizado: `"Sincronizado"` (`#68d391`)
    - Error: `"Error"` (`#fc8181`)
- **Estado de cuenta**:
  - `[verificado]` texto por defecto: `"Estado: Invitado"` (`index.html:721`).
  - `[verificado]` texto dinámico online: `"Estado: En línea"` (`js/cloud/sentinel.js:174`).
  - `[verificado]` texto dinámico offline: `"Estado: Sin sesión"` (`js/cloud/sentinel.js:174`).
- **Última sincronización**:
  - `[verificado]` texto por defecto: `"Última sincronización: —-"` (`index.html:724`, `js/cloud/sentinel.js:162`).
  - `[verificado]` formato dinámico con fecha: `"Última sincronización: <dd mmm, hh:mm>"` en formato `es-MX` (`js/cloud/sentinel.js:166-168`).
- **"Gestionar cuenta"**:
  - `[verificado]` botón de apertura del Gatekeeper: `<button id="btn-cloud-open-gatekeeper" ...>Gestionar cuenta</button>` (`index.html:728-731`).

---

## 4. Snippets y formas de respuesta verificados contra el código

### 4.1 BackupEngine (Exportación e Importación de archivo `.labak`)

#### Exportar respaldo (`BackupEngine.exportBackup`)
```javascript
const result = await window.BackupEngine.exportBackup();
console.log(result);
```
- **Forma de respuesta exitosa** (`js/backup-engine.js:166`):
  ```json
  {
    "success": true,
    "filename": "LoveArcade_Backup_2026-10-12.labak",
    "keyCount": 18
  }
  ```
- **Forma de respuesta con error** (`js/backup-engine.js:169`):
  ```json
  {
    "success": false,
    "message": "Error al crear la copia de seguridad."
  }
  ```
- **Eventos DOM emitidos**: `document.dispatchEvent(new CustomEvent('labackup:status', { detail: { type, message } }))` con `type: 'processing' | 'success' | 'error'`.
- **Estructura interna del archivo `.labak` descomprimido (JSON)** (`js/backup-engine.js:80-88, 140-150`):
  ```json
  {
    "version": 1,
    "format": "labak+gzip+sha256",
    "createdAt": "2026-10-12T14:30:00.000Z",
    "source": "http://localhost:3000",
    "keys": {
      "gamecenter_v6_promos": "{\"coins\":150,...}",
      "la_ws_completedLevels": "[]",
      "puz_arcade_progress": "{}"
    },
    "keyCount": 3,
    "checksum": "a8f3... (SHA-256 en minúsculas del JSON canónico sin checksum)"
  }
  ```

#### Importar respaldo (`BackupEngine.importBackupFromFile`)
```javascript
const input = document.getElementById('import-file');
const file = input.files[0];
const result = await window.BackupEngine.importBackupFromFile(file);
console.log(result);
```
- **Forma de respuesta exitosa** (`js/backup-engine.js:221`):
  ```json
  {
    "success": true,
    "restored": 18
  }
  ```
- **Forma de respuesta con error** (`js/backup-engine.js:224`):
  ```json
  {
    "success": false,
    "message": "Integridad inválida: checksum SHA-256 no coincide."
  }
  ```

### 4.2 Sentinel Cloud Sync (Diagnóstico y APIs en consola)

#### Consultar estado del Sentinel
```javascript
const status = window.Sentinel.getStatus();
console.log(status);
```
- **Forma de respuesta** (`js/cloud/sentinel.js:860`):
  ```json
  {
    "hasClient": true,
    "hasSession": true
  }
  ```

#### Forzar sincronización inmediata hacia la nube
```javascript
await window.Sentinel.syncNow();
```
- **Eventos DOM emitidos**:
  - `document.dispatchEvent(new CustomEvent('la:synced', { detail: { at: '<ISO timestamp>', source: 'sentinel-upsert' } }))` tras éxito en Supabase (`js/cloud/sentinel.js:290-292`).
  - `document.dispatchEvent(new CustomEvent('la:cloudsynced', { detail: { source: 'cloud' } }))` cuando se aplica un snapshot descargado de la nube (`js/cloud/sentinel.js:242`).
  - `document.dispatchEvent(new CustomEvent('la:cloud-authenticated'))` al concluir la resolución de sesión (`js/cloud/sentinel.js:413`).
- **Estructura del registro en la tabla `user_profiles` de Supabase** (`js/cloud/sentinel.js:275-280`):
  ```json
  {
    "id": "uuid-del-usuario",
    "game_data": {
      "gamecenter_v6_promos": "{\"coins\":200,...}",
      "la_ws_completedLevels": "[1,2,3]",
      "LUMINA_bestScore": "2048"
    },
    "nickname": "Jugador1",
    "avatar_url": null,
    "updated_at": "2026-10-12T14:35:00.000Z"
  }
  ```

---

## 5. Instrucciones de verificación manual para el usuario

> ⚠️ **IMPORTANTE**: Realiza estas pruebas en un navegador local sobre un perfil limpio (o ventana de incógnito) y **guarda previamente una copia de seguridad** de tu progreso si pruebas en tu navegador habitual, ya que los flujos de restauración y sincronización reemplazan el contenido de `localStorage`.

### 5.1 Flujo visual de respaldo y restauración `.labak` (Sincronización)

1. Abre la aplicación en tu navegador web.
2. Navega a la pestaña de **Sincronización** (`#tab-sync`, en el menú de navegación inferior o menú de perfil).
3. **Paso 1: Exportar respaldo**:
   - Observa la tarjeta **"Guardar respaldo"** (`index.html:669`).
   - Haz clic en el botón **"Guardar respaldo"** (`#btn-export`, `index.html:673`).
   - **Comportamiento esperado**:
     - El botón se deshabilita temporalmente y muestra el mensaje `'Procesando…'`.
     - El navegador genera y descarga un archivo con el formato `LoveArcade_Backup_YYYY-MM-DD.labak`.
     - Aparece el mensaje verde `'✓ Copia de seguridad creada.'` (`js/shop-logic.js:1492`).
     - El botón vuelve a habilitarse.
4. **Paso 2: Modificar el estado local (alterar monedas)**:
   - Abre la consola de desarrollo del navegador (`F12`).
   - Consulta el saldo actual:
     ```javascript
     console.log('Saldo antes:', window.GameCenter.getBalance());
     ```
   - Altera el saldo local a 0 para simular pérdida de progreso:
     ```javascript
     window.LoveArcadeStore.getStore().coins = 0;
     window.LoveArcadeStore.save();
     window.GameCenter.syncUI();
     console.log('Saldo alterado a 0:', window.GameCenter.getBalance());
     ```
   - Confirma visualmente que el marcador de monedas en el HUD refleja `0`.
5. **Paso 3: Seleccionar archivo de respaldo**:
   - En la tarjeta **"Restaurar partida"** (`index.html:686`), haz clic en **"Elegir respaldo"** (`#import-file`, `index.html:691`).
   - Selecciona el archivo `.labak` descargado en el paso 1.
   - **Comportamiento esperado**:
     - El texto `Ningún archivo seleccionado` se actualiza al nombre del archivo (`LoveArcade_Backup_YYYY-MM-DD.labak`).
     - Se muestra el mensaje de feedback: `Archivo "LoveArcade_Backup_...labak" listo. Haz clic en Importar.` (`js/shop-logic.js:1819`).
6. **Paso 4: Ejecutar restauración**:
   - Haz clic en **"Restaurar progreso"** (`#btn-import`, `index.html:697`).
   - **Comportamiento esperado**:
     - Se abre el modal de advertencia `#confirm-modal` con el título **"Importar partida"** y el texto `"Esto reemplazará tu progreso actual (monedas, wallpapers, racha y ajustes)... Esta acción no se puede deshacer."`.
     - Haz clic en el botón **"Sí, importar"**.
     - El botón de importación se deshabilita temporalmente mostrando `'Procesando…'`.
     - Se muestra el mensaje de éxito `'✓ Progreso restaurado con éxito. Recargando…'`.
     - Tras 1.2 segundos la página se recarga automáticamente (`location.reload()`).
7. **Paso 5: Confirmar recuperación**:
   - Tras la recarga, verifica que el marcador de monedas en la barra superior recuperó su saldo original intacto.

### 5.2 Flujo de Sentinel Cloud Sync (en entorno con Supabase configurado)

> **Nota**: Este flujo requiere que la aplicación cuente con variables de entorno de Supabase configuradas en Vercel/servidor (`/api/client-config`). En caso de no contar con credenciales, la aplicación degrada elegantemente a modo local.

1. Abre la pestaña **Sincronización** (`#tab-sync`).
2. Revisa la tarjeta **"Guardado en la nube"** (`index.html:705`).
   - Sin sesión, el badge debe indicar `Inactivo` o `Conectado` si ya cargó el cliente.
   - La etiqueta de cuenta debe indicar `Estado: Invitado` o `Estado: Sin sesión`.
3. Haz clic en **"Gestionar cuenta"** (`#btn-cloud-open-gatekeeper`, `index.html:728`).
   - Se despliega el modal del Gatekeeper (`#cloud-gatekeeper-modal`).
   - Ingresa credenciales de prueba y pulsa iniciar sesión.
4. **Comportamiento esperado tras inicio de sesión exitoso**:
   - El modal se cierra automáticamente.
   - El badge de estado pasa a `Sincronizado` (verde `#68d391`).
   - El estado de cuenta pasa a `Estado: En línea`.
   - Se muestra la fecha y hora de la última sincronización en `Última sincronización: <fecha>`.
5. **Comprobación de sincronización reactiva (interceptor de localStorage)**:
   - Realiza una acción de juego o compra en la tienda (p. ej. comprar un wallpaper).
   - Abre DevTools y observa los eventos de red o escucha el evento `la:synced`:
     ```javascript
     document.addEventListener('la:synced', (e) => console.log('Sincronizado a Supabase:', e.detail));
     ```
   - Tras 1 segundo de inactividad (debounce), el Sentinel ejecuta `upsert` a `user_profiles` y se dispara el evento `la:synced`.
