# Arquitectura actual

## Propósito

Este documento define la arquitectura vigente de Love Arcade como una SPA estática en HTML, CSS y JavaScript vanilla. Sirve como referencia principal para el comportamiento actual y para las decisiones operativas de la plataforma.

## Estado del documento

- Hecho verificado: la aplicación se sirve como sitio estático, sin bundler ni scripts npm.
- Hecho verificado: la entrada principal es `index.html`.
- Hecho verificado: la navegación principal expone `home`, `shop` y `profile` a través de `js/spa-router.js`.
- Inferencia: la arquitectura está diseñada para priorizar la experiencia local/offline sobre la sincronización cloud y la capa de backend opcional.
- No confirmado: la intención exacta de algunos módulos de UI descritos en tickets históricos debe revisarse en CSS o en el código actual antes de declararlos como parte del contrato público.

## 1. Runtime y arranque

Love Arcade se ejecuta como una SPA estática. La aplicación no usa un framework ni un pipeline de compilación. El flujo típico es:

1. El navegador carga `index.html`.
2. El documento define la estructura global del shell: navbar, navegación, vistas SPA y sprite SVG.
3. El script crítico dentro del `<head>` aplica el tema persistido antes del primer paint para evitar parpadeo visual.
4. El HTML carga los scripts principales de lógica en orden funcional: analytics, supabase-loader, lifecycle-scheduler, core/*, domain/*, app.js, backup-engine.js, shop-logic.js, streak-hub.js y spa-router.js.
5. `js/core/config.js` inicializa la configuración estática, economía y temas; `js/core/state-store.js` inicializa el estado global; los módulos de `js/domain/` aportan reglas de negocio antes de que `js/app.js` ensamble temporalmente la API pública `window.GameCenter`.
6. `js/spa-router.js` controla la transición entre `home`, `shop` y `profile` usando `hidden` y la History API.

## 2. Vistas SPA y router

### Vistas principales

La SPA tiene tres vistas visibles de forma mutua:

- `home`
- `shop`
- `profile`

El enrutado y el estado visual se gestionan con `js/spa-router.js`.

### Comportamiento del router

El router:

- intercepta clics sobre elementos con `data-view`;
- alterna `.hidden` entre las vistas;
- actualiza el estado visual activo de la navegación principal;
- llama a `window.GameCenter.syncUI()` para sincronizar indicadores compartidos;
- ejecuta callbacks de ciclo de vida de vista (`onEnter`, `onLeave`, `refresh`) cuando aplica;
- usa la History API para conservar navegación hacia atrás/adelante.

### Ciclo de vida de vistas

La transición entre vistas incorpora un flujo de tareas cooperativas:

- la vista anterior se marca para salida antes de entrar en la nueva vista;
- `window.HomeView?.onLeave?.()`, `window.ShopView?.onLeave?.()` y los callbacks de `onEnter` se disparan según la vista saliente y la entrante;
- la lógica de tareas se distribuye con `requestAnimationFrame` y `requestIdleCallback` o `setTimeout`, para no bloquear la primera transición visible;
- la navegación restablece el scroll y aplica una transición visual basada en `opacity` y `transform` sin animar layout.

La implementación actual del lifecycle enlaza el router con la vista del home y la tienda, y la lógica del scheduler de tareas vive en `js/lifecycle-scheduler.js` para controlar vistas visibles y pausas de intervalos.

## 3. Módulos principales

### `js/app.js`

Es el bootstrap actual del hub. Mantiene el renderizado de UI y Sentinel Cloud Sync; `js/domain/game-center.js` ensambla la API pública `window.GameCenter`.

### `js/domain/game-center.js`

Ensambla `window.GameCenter` con los módulos de dominio y conserva sin cambios la
superficie pública consumida por la SPA y los minijuegos. `syncUI()` delega a un
puente configurado por `js/app.js`, que conserva temporalmente el renderizado.

### `js/domain/theming.js` y `js/ui/theme-grid.js`

`theming.js` persiste y aplica los roles CSS del tema activo; `theme-grid.js` renderiza
los botones nativos del selector y delega sus clics a `window.GameCenter.setTheme()`.

### `js/domain/avatar.js`

Encapsula la conversión y compresión de imágenes, el guardado local y las operaciones
`setAvatar()`, `setAvatarPath()` y `getAvatar()`. Depende de `window.LoveArcadeStore`
y consume opcionalmente `window.Sentinel.getSession()` / `getClient()` como contrato
externo para Auth y Supabase Storage; el renderizado del avatar permanece en `js/app.js`
hasta que se extraiga el HUD.

### `js/core/config.js`

Contiene la configuración estática cargada antes de `js/app.js`:

- `window.CONFIG` y `window.ECONOMY`;
- `window.THEMES`;
- los códigos promocionales hash SHA-256 y el fallback de temas legado consumidos por el hub.

### `js/core/utils.js`

Contiene utilidades sin estado ni acceso al DOM: expone `window.debounce` por compatibilidad y
`window.LoveArcadeUtils` con `sha256` y `canUseVibration` para consumo interno del hub.

### `js/core/state-store.js`

Contiene la persistencia local del hub: migración, control de cuota, limpieza de emergencia y serialización de `localStorage` para `gamecenter_v6_promos`. Expone `window.LoveArcadeStore` con `getStore`, `replaceStore`, `save`, `migrate` y `subscribe`; los consumidores de dominio conservan el estado encapsulado detrás de esa API.

### `js/shop-logic.js`

Encapsula la lógica de la vista Tienda:

- carga del catálogo desde `data/shop.json`;
- render de catálogo y colección;
- validación del contrato del catálogo antes de renderizar;
- compra de artículos, descuento, cashback y canje de promociones;
- render de estados de error y vacíos;
- precarga y observación de tarjetas con `IntersectionObserver` y gestión de reducción de movimiento.

El contrato de interacción y rendimiento de los previews de Tienda y Colección se detalla en
[docs/preview-interaction-performance.md](./preview-interaction-performance.md).

### `js/spa-router.js`

Gestiona la navegación entre las vistas `home`, `shop` y `profile`, sincroniza el estado visual
y coordina los callbacks de ciclo de vida de las vistas mediante la History API.

### `js/lifecycle-scheduler.js`

Centraliza el registro, la pausa y la reanudación de intervalos según la visibilidad de la página,
el ciclo de página y la vista SPA activa. Su contrato completo está en
[docs/lifecycle-timers.md](./lifecycle-timers.md).

### `js/analytics.js`

Captura telemetría de interacción de forma no bloqueante y la envía a los endpoints serverless
opcionales, con filtros de entorno, control de cola y limitación de frecuencia.

### `js/backup-engine.js`

Exporta e importa respaldos locales en formato `.labak`, usando checksum SHA-256 y compresión gzip
cuando el navegador la soporta.

### `js/supabase-loader.js`

Expone una carga diferida del SDK de Supabase desde CDN con fallback, para que la sincronización
cloud opcional pueda degradarse sin bloquear el runtime principal.

### `js/streak-hub.js`

Es un adaptador visual para el estado diario y la retroalimentación interactiva de la racha. Su tarea principal es traducir el estado de negocio a UI, no sustituir la lógica del dominio.

### `js/sync-worker.js`

Ejecuta export/import y hash de sesión en un worker para no bloquear la interfaz principal. Soporta:

- serialización Base64;
- checksum SHA-256;
- compresión gzip para backups locales.

### `sw.js`

El Service Worker gestiona un app shell y cache runtime, con foco en una experiencia offline y en recursos cargados por Cloudinary o por el propio shell.

## 4. Persistencia local y capas de ejecución

### Local (runtime principal)

La persistencia principal vive en `js/core/state-store.js` y usa `localStorage` con clave `gamecenter_v6_promos`. `window.LoveArcadeStore` encapsula las lecturas, reemplazos, guardados, migraciones y suscripciones del snapshot.

La capa de referencia del estado del usuario incluye, entre otros datos:

- monedas;
- inventario;
- historial de transacciones;
- racha diaria;
- vencimiento de Bendición Lunar;
- tema persistido;
- referencias de progreso y claves de sincronización.

La sincronización local usa checksum SHA-256 y soporte para exportación/importación, con backups gzip gestionados por `js/backup-engine.js` y `js/sync-worker.js`.

### Cloud opcional

La sincronización cloud no es obligatoria para la experiencia principal. Cuando está activada, depende de configuración pública entregada por `/api/client-config.js` y del cliente Supabase cargado por `js/supabase-loader.js`.

### Serverless opcional

La capa serverless vive en `api/` y es un complemento del frontend:

- `api/client-config.js` expone configuración pública de Supabase;
- `api/report.js` y `api/telemetry.js` gestionan proxy/telemetría;
- `vercel.json` define headers y rewrites para Vercel.

La ausencia de esas variables o endpoints debe degradar la funcionalidad sin bloquear la app principal.

## 5. Tienda y catálogo

### Fuente de catálogo

La tienda usa `data/shop.json` como fuente publicada del catálogo.

### Contrato actual

La estructura del catálogo usa campos como:

- `id`
- `name`
- `price`
- `category`
- `type`
- `imageUrl`
- `downloadUrl` (cuando aplica)

El código actual valida la estructura antes de renderizar y usa una separación funcional entre:

- tienda: artículos no poseídos;
- colección: artículos poseídos;

### Preload y UI

La tienda usa una estrategia de carga incremental y de precarga regulada:

- `IntersectionObserver`;
- prioridad baja para imágenes fuera de viewport;
- carga bajo demanda en colecciones y tarjetas;
- atención a `prefers-reduced-motion` y a la conexión del usuario cuando procede.

La colección se monta bajo demanda y la búsqueda local se mantiene en la vista de Colección, no como una búsqueda global de la Tienda.

## 6. Assets y flujo visual

El HTML usa preloads de cover images y un sprite SVG estático para iconos. Los assets visuales se sirven con transformaciones de CDN cuando aplica, y los documentos históricos que mencionan un sistema de iconos generados dinámicamente o un flujo de assets antiguo no deben tratarse como contrato actual.

La estrategia vigente de portadas AVIF responsivas está documentada en
[docs/THUMBNAILS_OPTIMIZATION.md](./THUMBNAILS_OPTIMIZATION.md).

## 7. Límites documentales

Este documento no incluye changelogs históricos ni propuestas de rediseño. La autoridad documental para el comportamiento actual es el código y la configuración que existe en el repositorio.

## 8. Referencias cruzadas

- [README.md](../README.md)
- [docs/DOMAIN.md](./DOMAIN.md)
- [docs/INTEGRATION.md](./INTEGRATION.md)
- [docs/OPERATIONS.md](./OPERATIONS.md)
- [docs/DOCUMENTATION_POLICY.md](./DOCUMENTATION_POLICY.md)
