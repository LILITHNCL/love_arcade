# Temporal: Cambios requeridos en Supabase y Vercel (Notificaciones)

> Archivo temporal operativo. Fecha: 2026-05-04.

## 1) Cambios que **deben** aplicarse en Supabase

### 1.1 Ejecutar nueva migración
Aplicar en orden después de las migraciones previas:

- `supabase/migrations/20260504_daily_slots_constraint.sql`

SQL (referencia):
```sql
-- Restringe valores válidos para daily_notified_slots
update public.user_notification_state
set daily_notified_slots = array(
  select s
  from unnest(coalesce(daily_notified_slots, '{}')) as s
  where s in ('morning', 'day', 'night')
)
where exists (
  select 1
  from unnest(coalesce(daily_notified_slots, '{}')) as s
  where s not in ('morning', 'day', 'night')
);

alter table public.user_notification_state
  drop constraint if exists user_notification_state_daily_notified_slots_check;

alter table public.user_notification_state
  add constraint user_notification_state_daily_notified_slots_check
  check (
    coalesce(daily_notified_slots, '{}') <@ array['morning', 'day', 'night']::text[]
  );
```

### 1.2 Re-deploy de Edge Function
```bash
supabase functions deploy push-dispatch
```

### 1.3 Variables de entorno (Supabase Edge Functions)
Configurar/verificar:

- `LA_CLOUD_URL`
- `LA_CLOUD_SERVICE_ROLE_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `EDGE_SHARED_SECRET` (**obligatoria en producción**)
- `REQUIRE_EDGE_AUTH=true`
- `APP_ENV=production`
- `EVAL_BATCH_SIZE=500` (ajustable)
- `EVAL_MAX_BATCHES=10` (ajustable)

### 1.4 Cron invocando función con auth
Asegurar que el scheduler envía:

`Authorization: Bearer <EDGE_SHARED_SECRET>`

## 2) Cambios que **deben** aplicarse en Vercel

### 2.1 Variable pública obligatoria
Configurar en Vercel (Production/Preview según aplique):

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`

Sin esta variable, `/api/push-public-config` responde HTTP 500 por diseño.

### 2.2 Re-deploy
Hacer redeploy del frontend para propagar cambios de:
- `api/push-public-config.js`
- `js/push-notifications.js`
- `sw.js`

## 3) Verificación posterior al despliegue

1. Activar notificaciones desde cliente y confirmar alta en `push_subscriptions`.
2. Confirmar sincronización en `user_notification_state`.
3. Ejecutar `push-dispatch` y validar respuesta JSON con:
   - `states_scanned`
   - `states_processed`
   - `eval_errors`
   - `enqueue_errors`
   - `enqueue_dedupe_skipped`
4. Verificar `push_campaigns`/`push_delivery_log` sin duplicados indeseados.
