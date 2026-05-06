# Auditoría CORS/Cache — Cloudinary + Service Worker (Producción)

## Política definitiva
- Se mantienen las URLs actuales de Cloudinary (sin versionado).
- Estrategia para `res.cloudinary.com/.../image/upload/...`: **Cache First + TTL + LRU**.

## Buckets y límites operativos
| Bucket | Estrategia | TTL | Límite |
|---|---|---:|---:|
| `cloudinary-media-*` | Cache First | 14 días | 140 entradas |
| `runtime-static-*` | SWR | 7 días | 80 entradas |
| `documents-*` | Network First + fallback | 3 días | 40 entradas |

## Warmup crítico
- Se precalientan covers above-the-fold de `index.html`.
- **Todas las URLs de Cloudinary en `data/shop.json` se consideran esenciales y se envían al SW para warmup progresivo**.

## CORS / headers observables
- Fetch desde SW con `mode:cors`.
- Validar en runtime:
  - `access-control-allow-origin`
  - `cache-control`
- Registrar miss/hit/error vía métricas `LA_SW_METRIC`.

## Métricas y alertas operativas
- Eventos estándar: `sw_install`, `sw_activate`, `cache_hit`, `cache_miss_fill`, `offline_fallback_document_miss`, `sw_reload`, `share_fallback`.
- Buffer local de métricas + envío best-effort a `/api/telemetry`.
- Alertas sugeridas (backend):
  - ratio alto `offline_fallback_document_miss`;
  - loops de recarga SW;
  - miss-rate Cloudinary anómalo.
- Integración de alertas a Telegram: implementar en backend consumidor de `/api/telemetry` (webhook bot).
