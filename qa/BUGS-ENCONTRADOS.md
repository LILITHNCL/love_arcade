# Bugs Encontrados

## Hallazgo de Seguridad
- **Ruta**: `promo-codes.js` (u origen equivalente, documentado en R11 del plan)
- **Problema**: Códigos promocionales en texto plano en comentarios.
- **Tipo**: Hallazgo de seguridad.
- **Nota**: Documentado por instrucción del usuario. No se toca.

## Fallos reales detectados en `tests/daily-streak-hub-qa.mjs`

### 1. Falta de Atribución CC BY
- **Aserción que falla**: `tests/daily-streak-hub-qa.mjs` (Línea 12) - `assert.match(html,/Animación “Dynamic streak fire” por aristote · CC BY/);`
- **Causa verificada**: En `index.html` (línea ~329), la animación se incluye pero no hay texto con la atribución requerida por la licencia CC BY de la ilustración. La licencia exige que sea visible.
- **Clasificación**: BUG REAL (Accesibilidad / Legal).

### 3. Opacidad hardcodeada rompe theming
- **Aserción que falla**: `tests/daily-streak-hub-qa.mjs` (Línea 29) - `assert.match(css,/\.player-hud__glow-layer\[data-state="available"\][\s\S]*?opacity:var\(--streak-rive-glow-available-opacity\)/);`
- **Causa verificada**: En `styles.css` (línea 1130), el estado "available" tiene un valor fijo `opacity: .78`, ignorando el design token de theming definido en `:root` como `--streak-rive-glow-available-opacity`.
- **Clasificación**: BUG REAL (Consistencia de Diseño/UI).
