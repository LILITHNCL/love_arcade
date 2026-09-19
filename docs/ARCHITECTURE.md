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
4. El HTML carga los scripts principales de lógica en orden funcional: analytics, supabase-loader, lifecycle-scheduler, app.js, backup-engine.js, shop-logic.js, streak-hub.js y spa-router.js.
5. `js/app.js` inicializa el estado global, la economía, los temas, la racha y la API pública `window.GameCenter`.
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

Es el motor principal del hub. Aquí se definen:

- `CONFIG` y `ECONOMY`;
- `window.THEMES`;
- los códigos promocionales hash SHA-256;
- la persistencia principal en `localStorage` usando la clave `gamecenter_v6_promos`;
- la API pública `window.GameCenter`;
- la lógica de bono diario, racha, Bendición Lunar, historial y sincronización local/cloud.

### `js/shop-logic.js`

Encapsula la lógica de la vista Tienda:

- carga del catálogo desde `data/shop.json`;
- render de catálogo y colección;
- validación del contrato del catálogo antes de renderizar;
- compra de artículos, descuento, cashback y canje de promociones;
- render de estados de error y vacíos;
- precarga y observación de tarjetas con `IntersectionObserver` y gestión de reducción de movimiento.

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

La persistencia principal vive en `localStorage` con clave `gamecenter_v6_promos`.

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

## 7. Límites documentales

Este documento no incluye changelogs históricos ni propuestas de rediseño. La autoridad documental para el comportamiento actual es el código y la configuración que existe en el repositorio.

## 8. Referencias cruzadas

- [README.md](../README.md)
- [docs/DOMAIN.md](./DOMAIN.md)
- [docs/INTEGRATION.md](./INTEGRATION.md)
- [docs/OPERATIONS.md](./OPERATIONS.md)
- [docs/DOCUMENTATION_POLICY.md](./DOCUMENTATION_POLICY.md)
