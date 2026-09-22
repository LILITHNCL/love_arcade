# Love Arcade

Love Arcade es una SPA web de minijuegos con economía local, tienda de wallpapers y racha diaria. La aplicación funciona principalmente desde el navegador y usa `localStorage` como estado principal, con servicios opcionales de Vercel y Supabase cuando se configuran.

## Entrada principal

- `index.html` es la entrada principal de la aplicación.
- La navegación se maneja con `js/spa-router.js` y las vistas principales son `home`, `shop` y `profile`.

## Cómo ejecutarlo localmente

Cualquiera de estas opciones sirve para levantar el proyecto en un navegador:

```bash
python3 -m http.server 8080
# o
npx serve .
```

Luego abre la URL local en el navegador, por ejemplo:

```text
http://localhost:8080
```

## Stack actual

- HTML, CSS y JavaScript vanilla
- `localStorage` para persistencia principal
- `js/core/` para configuración, tiempo, estado, utilidades y cliente del Web Worker
- `js/domain/` para historial, economía, promociones, Bendición Lunar, racha, identidad, avatar, temas y el ensamblado de la API `window.GameCenter`
- `js/ui/` para HUD, monedas, selector de temas y microinteracciones
- `js/cloud/` para sincronización opcional con Supabase mediante Sentinel
- `js/pwa/` para el aviso de actualización del Service Worker
- `js/app.js` como orquestador clásico síncrono del bootstrap pre-paint, sin lógica de dominio ni cloud
- `js/shop-logic.js` para catálogo y compra
- `js/streak-hub.js` para feedback visual de la racha
- `js/sync-worker.js` para export/import con checksum y backup gzip
- `sw.js` para cache offline del shell
- `/api/*` como capa opcional de Vercel

## Documentación normativa

El mapa documental vigente para la plataforma es:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — arquitectura actual, SPA, router, persistencia y runtime
- [docs/DOMAIN.md](docs/DOMAIN.md) — economía, monedas, tienda, racha, historial y temas
- [docs/INTEGRATION.md](docs/INTEGRATION.md) — contrato de integración para minijuegos
- [docs/OPERATIONS.md](docs/OPERATIONS.md) — despliegue, variables de entorno, Supabase y soporte
- [docs/DOCUMENTATION_POLICY.md](docs/DOCUMENTATION_POLICY.md) — reglas de mantenimiento documental

## Guías y auditorías complementarias

Documentos de profundidad sobre un subsistema concreto; no sustituyen al set normativo anterior
en caso de conflicto:

- [docs/ECONOMIA.md](docs/ECONOMIA.md) — guía operativa de ofertas y cashback
- [docs/sistema-racha-diaria.md](docs/sistema-racha-diaria.md) — informe técnico y UX de la racha diaria
- [docs/operations/streak-recovery.md](docs/operations/streak-recovery.md) — recuperación manual de racha (Supabase)
- [docs/preview-interaction-performance.md](docs/preview-interaction-performance.md) — interacción y rendimiento del preview de Tienda/Colección
- [docs/lifecycle-timers.md](docs/lifecycle-timers.md) — contrato del scheduler central de timers
- [docs/THUMBNAILS_OPTIMIZATION.md](docs/THUMBNAILS_OPTIMIZATION.md) — optimización AVIF de portadas
- [docs/JSDOC_GUIDE.md](docs/JSDOC_GUIDE.md) — convención de comentarios JSDoc del proyecto

## Validación disponible en el repositorio

Actualmente el repositorio no incluye `package.json` ni scripts npm. Las validaciones documentadas para catálogo y flujo principal se ejecutan como comprobaciones estáticas o scripts de prueba específicos cuando existen.

## Nota de alcance

La documentación histórica del repositorio no sustituye a los archivos normativos anteriores. El contrato vigente debe leerse desde los documentos mencionados arriba y desde el código actual.
