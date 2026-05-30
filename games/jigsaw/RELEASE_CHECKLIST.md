# Marejigweb — Release checklist (Fase 8 RC)

Usa esta checklist antes de integrar `games/jigsaw/` en Love Arcade como release candidate de producción.

## 1. Integración Love Arcade

- [ ] El botón **Salir** apunta a `../../index.html`.
- [ ] `../../js/app.js` es el último script del `<body>`.
- [ ] El juego arranca standalone sin `GameCenter`.
- [ ] Con mock de `GameCenter`, completar un nivel reporta una sola recompensa.
- [ ] Repetir un nivel completado no vuelve a pagar.
- [ ] Recargar después de victoria no duplica la recompensa.
- [ ] No hay asignaciones a `window.GameCenter`, `window.ECONOMY` ni `window.THEMES`.
- [ ] No se declaran globals `CONFIG`, `ECONOMY` ni `THEMES`.

## 2. Storage

- [ ] Solo existen claves propias con prefijo `MAREJIG_`.
- [ ] Las únicas claves permitidas son:
  - `MAREJIG_completedLevels_v1`
  - `MAREJIG_levelProgress_v1`
  - `MAREJIG_activeSave_v1`
  - `MAREJIG_settings_v1`
- [ ] No se guardan imágenes, thumbnails, base64, blobs, canvas ni bitmaps.
- [ ] Un save corrupto no rompe el arranque.
- [ ] El active save se limpia al completar.
- [ ] El nivel completado desaparece del menú de pendientes.
- [ ] Completar standalone no genera reclamo retroactivo al volver con GameCenter.

## 3. Economía

- [ ] La economía sigue centralizada en `js/MAREJIG_economy.js`.
- [ ] No hay usos de `addCoins`, `spendCoins` ni `getBalance`.
- [ ] La recompensa es entero positivo y fija por nivel.
- [ ] La idempotencia local evita pagos repetidos por victoria, replay o reload.

## 4. Cloudinary producción

- [ ] No hay API keys, API secrets ni tokens en frontend.
- [ ] `cloudName` real está configurado en `js/MAREJIG_config.js` antes de producción.
- [ ] Cada nivel tiene `cloudinaryPublicId` estable.
- [ ] Las imágenes fuente son AVIF, horizontales 4:3 y preferentemente `2400×1800`.
- [ ] URLs `tiny`, `thumbnail`, `thumbnailLarge`, `fullMobile` y `fullPremium` se construyen correctamente.
- [ ] `f_auto` y `q_auto` siguen por defecto.
- [ ] `f_avif` solo se fuerza en testing explícito.
- [ ] La validación HEAD/fetch es opcional y no rompe offline.
- [ ] El fallback visual aparece si una imagen no carga.

## 5. Performance y memoria

- [ ] Menú con fixture de 200 niveles no renderiza todo al inicio.
- [ ] `Ver más` añade un lote, no 200 nodos de golpe.
- [ ] Completados se filtran antes de render.
- [ ] Thumbnails cargan lazy desde `data-marejig-src`.
- [ ] No se piden imágenes full desde el menú.
- [ ] La imagen full se libera al volver a pendientes.
- [ ] Canvas usa DPR capado.
- [ ] Renderer usa dirty rendering y no loop continuo.
- [ ] `pointermove` solo actualiza posición/coalescea RAF; no guarda, no recalcula segmentos/economía ni outlines.
- [ ] No se crean imágenes grandes por pieza.

## 6. Gameplay QA

- [ ] Drag funciona en mobile/touch.
- [ ] `pointercancel` limpia el estado de input.
- [ ] Snap ocurre solo por adjacency real.
- [ ] Piezas ocultas o de segmentos futuros no hacen snap.
- [ ] Grupos unidos no muestran bordes internos; solo outline externo.
- [ ] Hit testing evita huecos de piezas L/U/T y limita padding táctil a `min(8px, 18% celda)`.
- [ ] Un segmento completado revela solo el siguiente segmento.
- [ ] El último segmento dispara victoria una sola vez.
- [ ] Input queda bloqueado durante completar/victoria.
- [ ] Reiniciar conserva completados y recompensas ya registradas.
- [ ] No existe botón, overlay ni lógica activa de pistas.
- [ ] Hard valida 60 piezas reales sobre board `16×12`, rango 56–64, y no revela más de 10 piezas nuevas por segmento.
- [ ] Resize/orientación no regenera puzzle, no cambia `groupId`/segmento activo y mantiene piezas visibles o recuperables.
- [ ] La acción “Recuperar piezas” desde opciones devuelve grupos fuera de pantalla al área segura.

## 7. Responsive QA manual

Probar estas vistas:

- [ ] 360×740
- [ ] 390×844
- [ ] 430×932
- [ ] 768×1024
- [ ] 1024×768
- [ ] Desktop 1366×768

En cada vista verificar:

- [ ] Gameplay oculta header, logo, botón Salir grande, título, pack, tiempo, movimientos, conectadas y chips técnicos fuera de `?debug=1`.
- [ ] Sandbox fullscreen sin tarjeta de tablero ni staging visible; cámara y pan mantienen accesibles las piezas dispersas.
- [ ] Botones sin solapes.
- [ ] Canvas visible y zona de puzzle principal.
- [ ] Filtros del menú usable con teclado/touch.
- [ ] Modales dentro de pantalla.

## 8. Accesibilidad

- [ ] Botones principales tienen texto o `aria-label` claro.
- [ ] Modales tienen `role="dialog"`, `aria-modal="true"` y labels.
- [ ] El foco visible se aprecia en botones/cards/selects.
- [ ] Escape cierra modales no destructivos.
- [ ] La confirmación destructiva de reinicio requiere decisión explícita.
- [ ] `prefers-reduced-motion` reduce animaciones.
- [ ] Navegación básica por teclado funciona en el menú.
- [ ] Contraste visual suficiente en HUD, chips y botones.

## 9. Pruebas requeridas

```bash
git diff --check
git diff --cached --check
for file in games/jigsaw/js/*.js; do node --check "$file" || exit 1; done
node games/jigsaw/tools/validate-levels.mjs
node games/jigsaw/test/phase4_unit.js
node games/jigsaw/test/phase5_unit.js
node games/jigsaw/test/phase6_unit.js
node games/jigsaw/test/phase7_unit.mjs
node games/jigsaw/test/phase8_audit.mjs
node games/jigsaw/test/phase7_smoke_playwright.js
```

Para smoke browser estricto:

```bash
npm install --no-save playwright
npx playwright install chromium
python3 -m http.server 4173
MAREJIG_REQUIRE_PLAYWRIGHT=1 node games/jigsaw/test/phase7_smoke_playwright.js
```

## 10. Antes de subir catálogo real 200+

- [ ] Sustituir placeholders por public IDs reales gradualmente por pack.
- [ ] Ejecutar `node games/jigsaw/tools/validate-levels.mjs` tras cada batch.
- [ ] Ejecutar fixture/stress de 200 niveles.
- [ ] Verificar varias imágenes reales con `HEAD`/fetch en entorno con red.
- [ ] Smoke mobile con al menos un nivel por dificultad.
- [ ] Confirmar que ningún completado aparece en pendientes.
- [ ] Confirmar que el menú no precarga imágenes full.
