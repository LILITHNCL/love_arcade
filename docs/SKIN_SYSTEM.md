# Sistema de Skins UI/UX (Producción)

## Objetivo
Sistema completo de skins para Love Arcade que permite cambiar identidad visual completa: tokens, tipografías, fondos, iconos, arte de cards y efectos.

## Arquitectura
- **`js/skin-manager.js`**: orquestador de skins (carga manifiesto, aplica capas, fallback).
- **`assets/skins/manifest.json`**: catálogo versionado de skins.
- **`js/app.js`**: integración con `GameCenter` (`setSkin/getSkin/listSkins`) y persistencia `store.skinId`.
- **`styles.css`**: hooks de render visual + partículas por skin.
- **`index.html`**: bootstrap del manager y atributos declarativos de skin.

## Contrato `SkinDefinition`
Campos principales:
- `id`, `displayName`, `version`, `themeKey`
- `tokens`: colores semánticos
- `typography`: fuentes por rol
- `backgrounds`: home/cards
- `icons`: sprite por skin
- `gameCards`: imagen por id de juego
- `effects`: partículas y perfil
- `meta`: metadata de licencias/autoría

## Pipeline de aplicación
1. `applyTokenLayer` → CSS custom properties.
2. `applyTypographyLayer` → variables tipográficas.
3. `applyClassLayer` → `body.skin-*`, `html[data-skin]`, `html[data-skin-profile]`.
4. `applyAssetLayer` → fondos e imágenes declarativas (`data-skin-bg`, `data-skin-card-image`).
5. `applyEffectsLayer` → partículas/flags de efectos.

## Persistencia y migración
- Nuevo campo: `store.skinId`.
- Migración automática desde `store.theme` legado:
  - `crimson` → `hutao-ember`
  - resto → `arcade-default`

## API pública
- `GameCenter.setSkin(skinId)`
- `GameCenter.getSkin()`
- `GameCenter.listSkins()`

## Rendimiento
- Perfiles: `full`, `balanced`, `lite`.
- `lite` se activa en reduce-motion y móviles compactos.
- Partículas controladas por `data-skin-particles` y perfil.

## Versionado y caché
- `assets/skins/manifest.json` define versiones y costo estimado por skin.
- Recomendación: conectar este manifiesto con `sw.js` para precache del skin activo.

## Convenciones para nuevos skins
1. Crear carpeta en `assets/skins/<skin-id>/`.
2. Añadir fondos e imágenes optimizadas (`.webp`).
3. Registrar skin en `manifest.json`.
4. Si hay icon pack, usar IDs compatibles con sprite base.
5. Probar en perfiles `full/balanced/lite`.

## QA checklist
- Cambio de skin persiste tras recarga.
- Fallback correcto si faltan assets.
- No hay CLS perceptible al cambiar fuentes.
- FPS aceptable en perfil `lite`.
