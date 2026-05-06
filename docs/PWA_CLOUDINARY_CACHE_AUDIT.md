# Auditoría CORS/Cache — Cloudinary + Service Worker

## Inventario de patrones
- Avatar default: `https://res.cloudinary.com/dyspgn0sw/image/upload/default_avatar.webp`
- Covers juegos: `https://res.cloudinary.com/dyspgn0sw/image/upload/f_auto,q_auto,ar_16:9,c_fill,g_auto,w_1080/<public_id>`
- Wallpapers/app assets dinámicos vía `js/app.js` con base `https://res.cloudinary.com/dyspgn0sw/image/upload/`

## Requisitos de cabeceras
- `Access-Control-Allow-Origin: *` o origen explícito de la app.
- `Cache-Control: public, max-age=...` recomendado alto para assets versionados.
- Respuesta accesible en modo `cors` para cacheo desde SW.

## Estrategia definida
| Tipo | URL pattern | Estrategia SW | TTL | Invalidación |
|---|---|---|---|---|
| Cover/avatars Cloudinary | `res.cloudinary.com/.../image/upload/...` | Cache First | Larga | Cambiar versión URL |
| JS/CSS app | mismo origen (`.js/.css`) | Stale-While-Revalidate | Media | Deploy + actualización SW |
| Documentos navegación | `/`, `/index.html` | Network First + fallback cache | Corta | Deploy + actualización SW |

## Versionado recomendado
Usar URLs versionadas de Cloudinary con segmento `v<timestamp>` cuando sea posible para invalidación determinista.

## Estado
- Implementado cache runtime para Cloudinary en `sw.js`.
- Pendiente: migración completa de URLs embebidas a formato versionado en todo el catálogo.
