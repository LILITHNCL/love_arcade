# Sistema de Skins UI/UX (Producción)

## Objetivo
Sistema completo de skins para Love Arcade que permite cambiar identidad visual total: tokens, tipografías, fondos, iconos, arte de cards y efectos.

## Arquitectura
- **`js/skin-manager.js`**: orquestador de skins por capas.
- **`assets/skins/manifest.json`**: catálogo versionado de skins.
- **`js/app.js`**: integración con `GameCenter`, persistencia y render de selector.
- **`styles.css`**: hooks visuales + partículas.
- **`index.html`**: bootstrap y sección de skins en Tienda > Ajustes.

## Contrato `SkinDefinition`
- `id`, `displayName`, `version`, `themeKey`
- `tokens`: colores semánticos
- `typography`: fuentes por rol
- `backgrounds`: home/cards
- `icons`: `{ sprite, aliases }`
- `gameCards`
- `effects`
- `meta`

## Sistema de iconos (Opción A)
### Alias canónicos
El sistema usa aliases (`check`, `palette`, `moon`, etc.) para desacoplar UI de IDs internos del sprite.

### Resolución
1. Detecta alias por `data-skin-icon` (si existe).
2. Si no existe, deriva alias desde `href="#icon-*"` actual.
3. Busca en `icons.aliases` del skin.
4. Si no encuentra mapping, intenta `icon-{alias}` dentro del sprite del skin.
5. Fallback al icono base original (`data-base-href`).

### Cobertura global
`refreshSkinIcons()` recorre todos los `svg use` del DOM y reemplaza automáticamente los íconos de la plataforma completa.

## Pipeline
1. `applyTokenLayer`
2. `applyTypographyLayer`
3. `applyClassLayer`
4. `applyAssetLayer`
5. `applyEffectsLayer`
6. `loadSkinSprite` + `refreshSkinIcons`

## Persistencia
- `store.skinId` en estado local.
- Migración desde `theme` legado.

## Ajustes en Tienda
En **Tienda > Ajustes** existe la sección **Skin de interfaz** y se renderiza dinámicamente desde `SkinManager.listSkins()`.

## Rendimiento
- Perfiles `full`, `balanced`, `lite`.
- `lite` reduce coste visual en dispositivos modestos o `prefers-reduced-motion`.

## Pendientes recomendados (para hardening final)
- Integrar precache selectivo de sprite/skins en `sw.js`.
- Añadir validación CI para cobertura mínima de aliases por skin.
- Versionar arte de cards por checksum para rollback seguro.


## Validación pre-release
Ejecutar:
- `node tools/validate-skins.mjs`

Este validador verifica existencia de assets declarados, cobertura de aliases obligatorios y consistencia básica del manifiesto antes de despliegue.

## Observabilidad runtime
El runtime emite eventos de analítica:
- `skin_apply_success`
- `missing_skin_asset`
- `missing_skin_icon_alias`

## Robustez SPA
Se incluye `MutationObserver` para reaplicar iconos cuando la SPA inyecta nodos nuevos después del cambio de skin.


## Checklist de release (producción)
- SW con precache de assets de skins e invalidación por versión.
- Estado de carga visual durante skin swap (`data-skin-loading`).
- Carga opcional de fuentes por skin (`typography.fontAssets`).
- Validador de aliases basado en uso real de iconos (`#icon-*`).
- Eventos de observabilidad (`skin_apply_success`, `missing_skin_asset`, `missing_skin_icon_alias`).
- Robustez SPA vía `MutationObserver`.
- Política de licencias por skin (`assets/skins/<id>/LICENSE.md`).
