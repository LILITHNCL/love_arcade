# Verificación Humana — Fase 2a (Persistencia Core)

## Qué se probó y cómo
Se completaron los tests unitarios sobre `js/core/state-store.js` y `js/domain/history.js`, cubriendo los tickets:
- **TKT-001**: Migración y carga (defaults, fallback de temas, conversión de racha legacy, tipos inválidos).
- **TKT-002**: Lógica de guardado (`save`), recorte de progreso a 50 entradas por juego y cleanup por cuota.
- **TKT-003**: Historial (límite de 50 entradas, orden inverso).

Se utilizó un sandbox de Node con `vm` y se simuló `localStorage`. 

## Comandos y Resultados Esperados
1. Para ejecutar la suite general: `npm test`
   - **Resultado esperado**: 29 tests, 26 pass, 0 fail, 3 todo.
2. Para ejecutar los tests de juegos: `npm run test:games`
   - **Resultado esperado**: 16/16 (todos pasan).
3. Para ejecutar un archivo específico: `node --test tests/core/state-store.test.mjs`

## Cómo repetir una mutación
Si deseas verificar que los tests capturan regresiones:
1. Modifica `js/core/state-store.js`. Por ejemplo, cambia el límite de historial en `emergencyCleanup` de 30 a 99 (`slice(-99)`).
2. Ejecuta `node --test tests/core/state-store.test.mjs`.
3. El test `dado una llamada a save, cuando lanza QuotaExceeded, entonces recorta y reintenta` fallará con un AssertionError indicando que no se recortó a 30.
4. Deshaz el cambio con `git checkout js/core/state-store.js`.

## Qué NO se pudo verificar en este entorno (Limitaciones)
1. **Comportamiento real de cuota excedida en navegadores**: Simulamos `QuotaExceededError` de forma síncrona. Algunos navegadores lanzan `NS_ERROR_DOM_QUOTA_REACHED` o código 1014. El límite exacto (ej. 5MB) también depende del navegador.

## Cómo probarlo manualmente en el navegador

**Para probar el Bug F2a-01 (Procedimiento de Cuota Reproducible):**
1. Abre la aplicación en Chrome o Firefox (sin Playwright).
2. Abre las DevTools (F12) -> Consola.
3. Ejecuta `localStorage.setItem('filler', 'A'.repeat(4.9 * 1024 * 1024));` para llenar casi toda la cuota.
4. Juega y gana unas monedas para generar entradas de historial.
5. Sube una imagen como avatar que pese bastante pero menos del límite, o añade más datos hasta forzar que el guardado falle y active el `emergencyCleanup`.
6. Si vuelve a fallar tras el cleanup (forzando otro fallo por cuota), aparecerá el toast de error de guardado. Revisa `window.LoveArcadeStore.getStore().history`. Verás que está vacío (`[]`), perdiéndose en memoria.

**Para comprobar la migración:**
1. En DevTools -> Application -> Local Storage.
2. Modifica la clave `gamecenter_v6_promos` insertando: `{"lastDaily": 1690000000000, "theme": "pink"}`.
3. Recarga la página.
4. Tu tema debería ser ahora `magenta` (se aplica el fallback porque pink fue retirado) y deberías tener una racha de `1` inicializada.
