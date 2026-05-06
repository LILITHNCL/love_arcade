# Auditoría CORS/Cache — Cloudinary + Service Worker (Política sin cambio de URL)

## Decisión de arquitectura
Las URLs de Cloudinary **se mantienen sin cambios**. No se introduce versionado en path ni query params para invalidación.

## Patrones actuales inventariados
- Avatar default: `https://res.cloudinary.com/dyspgn0sw/image/upload/default_avatar.webp`
- Covers: `https://res.cloudinary.com/dyspgn0sw/image/upload/f_auto,q_auto,ar_16:9,c_fill,g_auto,w_1080/<public_id>`
- Assets dinámicos: base `https://res.cloudinary.com/dyspgn0sw/image/upload/`

## Política de cache operativa (sin versionado)
| Tipo | Estrategia | TTL operativo | Límite entradas | Purga |
|---|---|---:|---:|---|
| Cloudinary image/upload | Cache First | 14 días | 140 | Por antigüedad + LRU |
| JS/CSS runtime | Stale-While-Revalidate | 7 días | 80 | Por antigüedad + LRU |
| Documents | Network First + fallback | 3 días | 40 | Por antigüedad + LRU |

## Compensación por no versionar URLs
1. Refresh oportunista al volver a foreground (`registration.update()`).
2. Precalentado de covers críticos (above-the-fold) por mensaje al SW.
3. Purga periódica por TTL + cuota para evitar contenido estancado.

## CORS y cacheabilidad esperada
- Fetch Cloudinary en SW se realiza con `mode: cors`.
- Verificar en runtime headers observados (`cache-control`, `access-control-allow-origin`).

## Estado
- Implementado cacheo Cloudinary sin cambio de URL en `sw.js`.
- Implementado warmup de assets críticos desde cliente.
