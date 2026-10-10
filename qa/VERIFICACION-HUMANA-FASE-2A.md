# Verificación Humana — Fase 2a (Persistencia Core)

## Qué se probó y cómo
Se completaron los tests unitarios sobre `js/core/state-store.js` y `js/domain/history.js`, cubriendo los tickets:
- **TKT-001**: Migración y carga (defaults, fallback de temas, conversión de racha legacy, tipos inválidos).
- **TKT-002**: Lógica de guardado (`save`), recorte de progreso a 50 juegos y cleanup por cuota.
- **TKT-003**: Historial (límite de 50 entradas, orden inverso).

Se utilizó un sandbox de Node con `vm` y se simuló `localStorage` con soporte para inyectar `QuotaExceededError`. Todo pasó correctamente con `npm test`.

## Qué NO se pudo verificar en este entorno (Limitaciones)
1. **Comportamiento real de cuota excedida en el navegador**: Simulamos `QuotaExceededError` de forma síncrona, pero el tamaño máximo del navegador varía (5MB generalmente) y los navegadores antiguos (ej. Safari) pueden lanzar `NS_ERROR_DOM_QUOTA_REACHED` en su lugar.
2. **Crash al persistir el historial en la cuota (Bug F2a-01)**: El mock confirmó que si el `save` falla repetidamente en el `emergencyCleanup`, el `history` se asigna a `[]` pero el guardado falla, quedando `[]` en la memoria volátil del programa de forma silente. No se puede comprobar visualmente cómo afecta esto a la UI sin cargarlo en el navegador.

## Cómo probarlo manualmente en el navegador

**Para probar el Bug F2a-01 (Cuota excedida):**
1. Abre la aplicación en Chrome o Firefox (sin Playwright).
2. Abre las DevTools (F12) -> Consola.
3. Rellena tu localStorage casi al máximo ejecutando:
   ```javascript
   localStorage.setItem('filler', 'A'.repeat(4.9 * 1024 * 1024));
   ```
4. Juega y gana unas cuantas monedas o haz compras para generar entradas de historial.
5. Intenta forzar un estado que colapse el `emergencyCleanup` (ej. avatar excesivamente grande que burle la subida por base64, más historial).
6. Verifica en consola o recargando si perdiste todo tu progreso o solo el historial.

**Para comprobar la migración:**
1. En DevTools -> Application -> Local Storage.
2. Modifica la clave `gamecenter_v6_promos` insertando datos antiguos como: `{"lastDaily": 1690000000000, "theme": "pink"}`.
3. Recarga la página.
4. Tu tema debería ser ahora `magenta` y deberías tener una racha de `1` inicializada en tu hub.
