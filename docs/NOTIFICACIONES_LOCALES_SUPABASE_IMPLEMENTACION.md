# Notificaciones de Love Arcade (Producción)

Última actualización: 2026-05-04

## Objetivo
Este documento centraliza la arquitectura y operación de notificaciones de Love Arcade en producción:
- campañas remotas,
- recordatorios locales procesados en backend (bono diario, tienda, eventos, bendición lunar),
- deduplicación robusta,
- versionado de contenido de tienda.

---

## Arquitectura

### Cliente (Web App)
Archivos clave:
- `js/push-notifications.js`
- `js/shop-logic.js`

Responsabilidades:
1. Registrar Service Worker y suscripción Push Web.
2. Guardar suscripción en `push_subscriptions`.
3. Sincronizar estado de recordatorios en `user_notification_state`.
4. Fallar de forma explícita si no hay configuración VAPID pública disponible.

### Service Worker
Archivo:
- `sw.js`

Responsabilidades:
- Mostrar notificaciones entrantes (`push`).
- Resolver deep-link de apertura (`notificationclick`).
- Usar estrategia de `tag` para evitar reemplazos involuntarios.

### Backend (Supabase Edge Function)
Archivo:
- `supabase/functions/push-dispatch/index.ts`

Responsabilidades:
1. Evaluar reglas de recordatorios por usuario (con escaneo paginado por lotes).
2. Encolar campañas en `push_campaigns`.
3. Despachar campañas pendientes a `push_subscriptions` activas.
4. Registrar entrega en `push_delivery_log`.
5. Marcar suscripciones inválidas (`404/410`) como inactivas.
6. Exponer métricas operativas por ejecución (`states_scanned`, `eval_errors`, etc.).

---

## Esquema SQL requerido (migraciones)

Aplicar estas migraciones (en orden):
1. `supabase/migrations/20260502_local_notification_state.sql`
2. `supabase/migrations/20260502_shop_content_version.sql`
3. `supabase/migrations/20260502_shop_notification_dedupe.sql`
4. `supabase/migrations/20260502_daily_reminder_slots.sql`
5. `supabase/migrations/20260504_daily_slots_constraint.sql`

---

## Seguridad y configuración

- `EDGE_SHARED_SECRET` es obligatorio en producción.
- `REQUIRE_EDGE_AUTH=true` recomendado (default esperado).
- La API pública `/api/push-public-config` retorna `500` si falta `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- El cron debe invocar la Edge Function con `Authorization: Bearer <EDGE_SHARED_SECRET>`.

---

## Reglas de negocio en producción

### 1) Novedades de tienda
- Se detectan por versión global `app_content_versions.shop_version`.
- Dedupe robusta por `user_id + shop_version` mediante `enqueue_local_shop_campaign(...)`.
- `last_shop_version_sent` solo avanza cuando la campaña fue efectivamente encolada.

### 2) Bono diario
- Se evalúa por hora local del usuario (offset sincronizado desde cliente).
- Ventanas:
  - mañana: 08:00–11:59
  - día: 13:00–16:59
  - noche: 19:00–22:59
- Máximo 3 notificaciones por día (1 por ventana).
- `daily_notified_slots` restringido a: `morning`, `day`, `night`.

### 3) Bendición lunar y eventos
- Se evalúan por proximidad de expiración/fin según estado sincronizado.

---

## Operación

### Deploy
```bash
supabase functions deploy push-dispatch
```

### Cron
- Ejecutar `push-dispatch` de forma periódica (vigente: cada 1 minuto).

### Health check sugerido
Verificar periódicamente:
- `push_campaigns` (`status`, `last_error`, `sent_count`, `failed_count`)
- `push_delivery_log` (`status`)
- `push_subscriptions` (`is_active`)
- `user_notification_state` (coherencia de flags y timestamps)
