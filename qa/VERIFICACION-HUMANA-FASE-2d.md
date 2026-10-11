# Verificación Humana - Fase 2d (Sistemas aislados)

## Comandos exactos y conteos reales de la suite
Ejecutar desde la raíz del repositorio:

1. **TKT-010 (Bendición Lunar)**:
   ```bash
   node --test tests/domain/moon-blessing.test.mjs
   ```
   *Resultado esperado*: `8 tests (8 pass, 0 fail, 0 todo)`.

2. **TKT-011 (Códigos Promocionales)**:
   ```bash
   node --test tests/domain/promo-codes.test.mjs
   ```
   *Resultado esperado*: `8 tests (7 pass, 0 fail, 1 todo: BUG-F2d-02)`.

3. **TKT-012 (Exportar / Importar partida)**:
   ```bash
   node --test tests/domain/save-export-import.test.mjs
   ```
   *Resultado esperado*: `7 tests (6 pass, 0 fail, 1 todo: BUG-F2d-01)`.

4. **Suite completa del proyecto**:
   ```bash
   npm test
   ```
   *Resultado esperado*: `97 tests, 13 suites (84 pass, 0 fail, 13 todo)`. Código de salida: `0`.

---

## Qué NO se pudo verificar en este entorno (Termux / Node.js)
- **Web Worker real (`js/sync-worker.js`)**: En Node.js/Termux no se dispone del entorno DOM/Worker para instanciar `new Worker('js/sync-worker.js')`. Las pruebas de TKT-012 mockean `window.workerTask` para forzar y validar la ruta de fallback del hilo principal. Como se documentó en TKT-012, el worker real **no aplica gzip** en `export`/`import` (gzip solo se utiliza en `backup-export`/`backup-import`), manteniendo el mismo formato base (JSON `{data, checksum}` → UTF-8 → base64), pero el paso por `postMessage` y la ejecución aislada en el worker requieren navegador.
- **UI y elementos visuales interactivos**: Animaciones de confetti, modales de confirmación, badges dinámicos del HUD y actualización reactiva de la tienda tras compras o canjes.
- **Portapapeles y APIs de archivos**: Acceso a `navigator.clipboard` e importación mediante `<input type="file">`.
- **Sincronización remota inmediata**: Los disparos de `immediateCloudSync` hacia Supabase se difieren para la fase F3a.

---

## Verificación de textos de interfaz (auditoría en código)
- **"Mejoras"**: `[verificado]` — Aparece como tarjeta de acción en Perfil (`index.html:596`, `<span class="profile-action-card__title">Mejoras</span>`) y como título de sección (`index.html:771`, `<h2 class="section-title">Mejoras</h2>`).
- **"Códigos promocionales"**: `[verificado]` — Aparece como tarjeta de acción en Perfil (`index.html:611`, `<span class="profile-action-card__title">Códigos promocionales</span>`) y como título de la pantalla dedicada (`index.html:624`, `<h2 class="section-title">Códigos promocionales</h2>`).
- **"Canjear"**: `[verificado]` — Texto literal del botón de envío del formulario de código promocional (`index.html:643`, `<span>Canjear</span>`) y encabezado de la tarjeta (`index.html:635`, `<h3>Canjear código</h3>`).
- **Badge de la Luna en el HUD**: `[verificado]` — Definido en el HTML de la barra de navegación dentro del badge de monedas (`index.html:257-260`, `<span class="moon-blessing-badge hidden" title="Bendición Lunar activa">`) y controlado dinámicamente en `js/ui/hud-render.js:152-154` conmutando la clase `hidden` y asignando `title = 'Bendición Lunar activa hasta ' + status.expiresAt`.
- **Modal de advertencia de restauración**: `[verificado]` — Implementado en `js/shop-logic.js:1503-1510` con título `"Importar partida"`, advertencia `"Esto reemplazará tu progreso actual (monedas, wallpapers, racha y ajustes)... Esta acción no se puede deshacer."`, botón de confirmación `"Sí, importar"` y montado sobre `#confirm-modal` (`index.html:1000-1008`).
- **"Copiar código de partida"**: `[texto no verificado]` — No existe en el código de la UI. La sección de sincronización (`index.html:677`) utiliza el texto literal **"Guardar respaldo"** mediante un botón que dispara `BackupEngine.exportBackup`.
- **"Restaurar partida"**: `[verificado]` — Aparece textualmente como encabezado en `index.html:686` (`<h3 class="memory-card__title">Restaurar partida</h3>`). El botón de acción asociado dice **"Restaurar progreso"** (`index.html:700`).
- **"100 ⭐"**: `[texto no verificado]` en la UI visible — El botón de la tienda (`index.html:801` y `js/ui/hud-render.js:164`) muestra textualmente **"Activar Bendición Lunar (100 monedas)"**. La cadena `'100 ⭐'` sólo se utiliza como metadato interno de telemetría analítica (`js/domain/moon-blessing.js:21`).
- **Notificación "+7 días"**: `[texto no verificado]` como notificación — El mensaje emergente mostrado tras la compra/extensión (`js/shop-logic.js:1828`) es `✓ Activa hasta <fecha>`. La cadena literal **"+7 días"** figura en el botón de extensión: `"Extender Bendición (+7 días)"` (`js/ui/hud-render.js:161`).

---

## Instrucciones de verificación manual para el usuario

> ⚠️ **IMPORTANTE**: Realiza estas pruebas en un navegador local sobre un perfil limpio o habiendo guardado previamente una copia de seguridad, ya que las operaciones alteran saldo, historial y progreso.

### 1. Bendición Lunar (Tienda / Perfil)
1. Inicia sesión o abre la app asegurando tener al menos 100 monedas en el hub.
2. Navega a **Mejoras** (`index.html:596,771`).
3. Pulsa sobre **"Activar Bendición Lunar (100 monedas)"** (`index.html:801`, `js/ui/hud-render.js:164`).
4. **Comportamiento esperado**:
   - El saldo se reduce exactamente en 100 monedas.
   - Aparece el mensaje de confirmación `✓ Activa hasta <fecha a 7 días>` (`js/shop-logic.js:1828`).
   - El botón pasa a indicar **"Extender Bendición (+7 días)"** (`js/ui/hud-render.js:161`).
   - El badge de bendición lunar en el HUD (`.moon-blessing-badge`, `index.html:257`) se hace visible indicando su vigencia.
5. Recarga la página y confirma que la bendición sigue activa con la fecha esperada.

### 2. Códigos Promocionales (Perfil → Canjear)
1. Navega a la sección de **Códigos promocionales** en el perfil (`index.html:611,624`).
2. Ingresa `<código válido>` rodeado de espacios y con mayúsculas/minúsculas alternadas (ejemplo: `  <código válido>  `).
3. Pulsa **Canjear** (`index.html:643`).
4. **Comportamiento esperado**:
   - Se acredita la recompensa de monedas correspondiente al código.
   - El input se limpia y se muestra mensaje de éxito (`¡+... Monedas!`).
   - Se actualiza el balance en la barra superior.
5. Vuelve a ingresar el mismo `<código válido>` e intenta canjearlo nuevamente.
6. **Comportamiento esperado**:
   - La solicitud es rechazada con el mensaje `"Ya canjeaste este código"`.
   - El saldo y el historial no sufren modificaciones.

### 3a. Exportar / Importar partida en base64 (`GameCenter.exportSave` / `importSave` vía DevTools)
> **Nota de contexto**: Como se determinó en la auditoría de llamadores (C4) y en `qa/99-huecos.md`, no existe UI en la app para copiar/pegar un string base64 de partida; la UI utiliza archivos `.labak`. Por tanto, esta API de `window.GameCenter` debe verificarse desde la consola de desarrollador:

1. Abre la aplicación en el navegador y presiona `F12` (Consola de DevTools).
2. **Consultar saldo antes de exportar**:
   ```javascript
   const saldoInicial = window.GameCenter.getBalance();
   console.log('Saldo inicial:', saldoInicial);
   ```
   *Verificación en código*: `window.GameCenter.getBalance()` expuesto en `js/domain/game-center.js:71` (lee `Store.getStore().coins` vía `js/domain/economy.js:61-63`).
3. **Exportar partida**:
   ```javascript
   const code = await window.GameCenter.exportSave();
   console.log('Código exportado:', code);
   ```
   **Comportamiento esperado**: Devuelve directamente un string no vacío codificado en Base64 (o `null` en caso de error; `js/domain/game-center.js:28,36,37`).
4. **Modificar el saldo desde consola**:
   ```javascript
   window.LoveArcadeStore.getStore().coins = 0;
   window.LoveArcadeStore.save();
   console.log('Saldo modificado a 0:', window.GameCenter.getBalance());
   ```
   *Verificación en código*: Modifica la propiedad en el objeto del almacén (`js/core/state-store.js:170`) y persiste a `localStorage` vía `window.LoveArcadeStore.save()` (`js/core/state-store.js:172`).
5. **Importar partida original**:
   ```javascript
   const res = await window.GameCenter.importSave(code);
   console.log('Resultado importación:', res);
   ```
   **Comportamiento esperado**: Devuelve `{ success: true }` exactamente (`js/domain/game-center.js:60`). No incluye campo `timestamp`.
6. **Consultar saldo después de importar**:
   ```javascript
   const saldoRestaurado = window.GameCenter.getBalance();
   console.log('Saldo restaurado:', saldoRestaurado, '¿Coincide?', saldoRestaurado === saldoInicial);
   ```
   **Comportamiento esperado**: El saldo vuelve a ser exactamente igual a `saldoInicial`.
7. **Probar manipulación / corrupción de código**:
   ```javascript
   const corruptCode = code.slice(0, 10) + 'XXXX' + code.slice(14);
   const errRes = await window.GameCenter.importSave(corruptCode);
   console.log('Resultado corrupto:', errRes);
   console.log('Saldo tras rechazo (intacto):', window.GameCenter.getBalance());
   ```
   **Comportamiento esperado**: Devuelve `{ success: false, message: 'El código fue modificado manualmente. Importación rechazada.' }` (o `'Código inválido o corrupto.'`; `js/domain/game-center.js:45,53,62`). La propiedad de error es `message` (no `error`). El saldo permanece inalterado.
8. **Limitación observable**: Desde la consola de DevTools no se puede distinguir visualmente si la operación corrió en el Web Worker (`js/sync-worker.js`) o en el fallback de hilo principal, a menos que se inspeccionen los eventos de `postMessage` en la pestaña de Threads/Workers de DevTools.

### 3b. Respaldo y Restauración de archivo `.labak` (UI Sincronización)
> **Nota de cobertura**: Este flujo de interfaz gráfica utiliza el motor de archivos `BackupEngine` (`.labak` comprimido en gzip), cuya cobertura automatizada pertenece a la fase **F3a** y no a la fase **F2d** (TKT-012). Se documenta aquí para la verificación visual de la interfaz existente:

1. Dirígete a la sección **Sincronización** (`#tab-sync`).
2. Pulsa en **"Guardar respaldo"** (`#btn-export`, `index.html:677`).
3. **Comportamiento esperado**: Se genera y descarga el archivo de respaldo (`.labak`).
4. Abre una ventana de incógnito o un perfil nuevo de navegador.
5. Ve a **Sincronización**, pulsa **"Elegir respaldo"** (`#import-file`), selecciona el archivo `.labak` recién descargado y pulsa **"Restaurar progreso"** (`#btn-import`, `index.html:700`).
6. Confirma la acción en el modal de advertencia (`js/shop-logic.js:1504`, con título `"Importar partida"` y botón `"Sí, importar"`).
7. **Comportamiento esperado**: La partida se restaura con el saldo, bendiciones e historial exactos de la sesión de origen.
