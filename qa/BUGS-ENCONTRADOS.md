
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
