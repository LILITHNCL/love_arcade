# Operaciones y despliegue

## Propósito

Este documento describe el despliegue, la configuración operativa y las capas opcionales de Love Arcade que no forman parte del runtime base del navegador.

## Estado del documento

- Hecho verificado: el proyecto se sirve como sitio estático.
- Hecho verificado: la capa opcional de backend vive en `/api` y se despliega en Vercel.
- Hecho verificado: la sincronización cloud con Supabase depende de variables de entorno públicas de Vercel.
- Hecho verificado: la ausencia de esas variables debe degradar la funcionalidad sin romper la app principal.
- Inferencia: el sistema está diseñado para funcionar en modo local-first con servicios externos como facilitadores y no como dependencia obligatoria.

## 1. Despliegue base

La aplicación se despliega como un sitio estático. El repositorio no incluye `package.json`, bundler ni scripts de build. El punto de entrada principal es `index.html`.

Los despliegues de Vercel se configuran principalmente mediante:

- `vercel.json` para headers y rewrites;
- `manifest.webmanifest` para comportamiento PWA;
- `sw.js` para cache y app shell.

## 2. Variables de entorno relevantes

La integración cloud opcional requiere variables de entorno en Vercel. El documento de referencia del proyecto distingue de manera explícita:

- `NEXT_PUBLIC_LA_CLOUD_URL`
- `NEXT_PUBLIC_LA_CLOUD_ANON_KEY`

Estas variables permiten que `/api/client-config.js` entregue la configuración pública de Supabase al cliente sin hardcodearla en el repo.

Si estas variables no existen o están vacías, el frontend debe manejar la degradación elegante y seguir funcionando en modo local.

## 3. APIs serverless y seguridad

### `/api/client-config.js`

Expone únicamente la URL pública y la anon key de Supabase cuando las variables de entorno están disponibles. No expone secretos del backend ni tokens de acceso privilegiados.

### `/api/report.js`

Acepta POST y enruta eventos a topics de Telegram. La lógica de seguridad exige validación de origen y el token de Telegram nunca se expone al cliente.

### `/api/telemetry.js`

Forma parte del mismo conjunto de endpoints de observabilidad y reportes. No es una dependencia del flujo principal de juego.

## 4. Supabase y sincronización cloud

La sincronización cloud es opcional. Cuando la configuración está activa, `js/cloud/sentinel.js` puede sincronizar snapshots de estado, perfiles y datos persistentes con Supabase. Sentinel consume `window.LoveArcadeStore` y `window.CONFIG.stateKey`, por lo que el bootstrap no conserva un acoplamiento privado con la sincronización.

El documento actual distingue claramente entre:

- runtime local: `localStorage` y backups locales;
- runtime cloud: Supabase y API Vercel.

## 5. Service Worker y cache

El Service Worker maneja recursos del shell y runtime para una experiencia offline.

El comportamiento actual incluye:

- app shell;
- cache del runtime para recursos activos;
- manejo de assets del frontend y Cloudinary;
- versionado y invalidación por URL y estrategia de caché del entorno.

## 6. Recuperación manual de racha

La recuperación manual de racha es una operación privilegiada de soporte, no una API de la aplicación ni una función normal del cliente. Requiere aprobación humana, backup previo y validación posterior; no debe automatizarse desde el frontend.

Los criterios actuales del proyecto son:

- manipular snapshots JSON almacenados en Supabase;
- actualizar `updated_at`;
- respetar el patrón Last Write Wins;
- ejecutar solo con aprobación del operador humano;
- no tratarlo como una función del cliente disponible para todos los usuarios.

El procedimiento detallado y canónico vive únicamente en [docs/operations/streak-recovery.md](operations/streak-recovery.md). Este documento no duplica su SQL.

## 7. Sistemas retirados relevantes

La auditoría identifica que la capa de notificaciones push fue retirada por la migración `20260918_remove_notifications.sql`.

Esta referencia debe entenderse como una línea de contexto operativo: el sistema de notificaciones push ya no forma parte del flujo actual y debe mantenerse descrito como retiro, no como funcionalidad vigente.

Para activar o ajustar ofertas y cashback en producción, ver la guía operativa [docs/ECONOMIA.md](./ECONOMIA.md).

## 8. Diagnóstico de degradación

Cuando faltan servicios externos o configuraciones cloud:

- la app debe continuar funcionando en local;
- la sincronización cloud queda inactiva;
- los flujos de negocio principales del hub siguen disponibles;
- el usuario recibe una experiencia funcional y no bloqueante.

## 9. Referencias cruzadas

- [README.md](../README.md)
- [docs/ARCHITECTURE.md](./ARCHITECTURE.md)
- [docs/DOMAIN.md](./DOMAIN.md)
- [docs/INTEGRATION.md](./INTEGRATION.md)
- [docs/DOCUMENTATION_POLICY.md](./DOCUMENTATION_POLICY.md)
