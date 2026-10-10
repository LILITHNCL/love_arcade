
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
- **Estado**: pendiente de decisión del usuario (decidir si el .txt basta como atribución o hay que mostrarla en la interfaz).

### 4. Opacidad hardcodeada rompe theming (glow)
- **Descripción**: El estado "available" del glow tiene opacidad fijada en duro en lugar de usar el design token.
- **Archivo y línea**: `styles.css` (líneas 1123 y 1130).
- **Comportamiento esperado vs real**: Se esperaba que usara la variable `--streak-rive-glow-available-opacity` (.58), pero está fijado a `.78`.
- **Test**: `assert.match(css,/\.player-hud__glow-layer\[data-state="available"\][\s\S]*?opacity:var\(--streak-rive-glow-available-opacity\)/);`
- **Estado**: hallazgo de diseño, decisión del usuario: ¿.58 o .78?

### Bug F2a-01: Pérdida de historial en memoria tras doble fallo de cuota
- **Descripción**: Si falla el reintento de guardado en `emergencyCleanup` (debido a cuota de disco exhausta), se borra el historial con `store.history = []` en memoria. Existe una notificación (toast) indicando que no se pudo guardar, pero el estado en memoria queda corrupto sin el historial. Esto se convierte en una pérdida de datos real cuando ocurre el siguiente guardado exitoso, que persistirá el vacío.
- **Archivo y línea**: `js/core/state-store.js` (Línea 159).
- **Comportamiento esperado vs real**: Se esperaba que el historial no se modificara destructivamente en memoria si el save falla por completo. Realidad: se asigna `[]` pero el guardado falla, quedando la app sin historial en memoria.
- **Test**: `dado un doble fallo de cuota, cuando ocurre, entonces no debe vaciar el historial en memoria` en `tests/core/state-store.test.mjs`.
- **Estado**: Pendiente. Marcado como `{ todo: 'BUG-F2a-01' }` en test.
