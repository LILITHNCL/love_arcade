# Recuperación manual de racha diaria en Supabase

Esta guía documenta cómo diagnosticar y restaurar la **racha diaria** de un usuario específico desde el **SQL Editor de Supabase** cuando el usuario perdió su racha por error, desincronización o soporte manual.

> **Uso previsto:** soporte/administración. Ejecuta estos scripts solo después de confirmar el `user_id` correcto y la racha que se debe devolver.

## 1. Dónde vive la racha en Supabase

La sincronización cloud guarda el progreso en `public.user_profiles.game_data`, un campo `jsonb` que contiene snapshots de `localStorage`. La racha del hub está dentro de la clave:

```text
game_data -> 'gamecenter_v6_promos'
```

Importante: el valor de `gamecenter_v6_promos` se guarda como **string JSON**, no como objeto JSONB directo. Por eso, para leer o actualizar `daily.streak` y `daily.lastClaim`, primero hay que convertir ese string con `::jsonb`.

Dentro de ese snapshot, la estructura relevante es:

```json
{
  "daily": {
    "lastClaim": 0,
    "streak": 0
  }
}
```

- `daily.streak`: racha vigente mostrada al usuario.
- `daily.lastClaim`: timestamp en milisegundos del último reclamo exitoso.
- `updated_at`: marca LWW (*Last Write Wins*) usada por Sentinel para decidir si la nube o el dispositivo local tiene la versión más reciente.

## 2. Checklist antes de tocar datos

1. Pide o confirma el UUID del usuario (`auth.users.id` / `user_profiles.id`).
2. Confirma qué racha debe quedar activa, por ejemplo `14` días.
3. Decide si quieres que el usuario pueda reclamar hoy:
   - **Conservar `lastClaim` original:** mantiene el estado actual del botón diario.
   - **Poner `lastClaim` en ayer:** normalmente permite reclamar hoy y continuar desde la racha restaurada.
   - **Poner `lastClaim` en hoy:** evita que reclame de nuevo hoy.
4. Haz un respaldo de la fila antes de actualizar.
5. Después de actualizar, asegúrate de que `updated_at = now()` para que Sentinel prefiera la versión de Supabase al abrir/iniciar sesión.

## 3. Diagnóstico: consultar el estado actual

Reemplaza el UUID por el usuario afectado.

```sql
select
  id,
  updated_at,
  game_data ? 'gamecenter_v6_promos' as has_hub_snapshot,
  ((game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,streak}')::int as current_streak,
  to_timestamp(
    (((game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,lastClaim}')::bigint / 1000.0)
  ) as last_claim_at,
  ((game_data ->> 'gamecenter_v6_promos')::jsonb #> '{daily}') as daily_json
from public.user_profiles
where id = '00000000-0000-0000-0000-000000000000';
```

Si `has_hub_snapshot` es `false` o la conversión falla, el usuario no tiene snapshot válido del hub en la nube. En ese caso no ejecutes el update directo sin revisar primero si existe progreso local en el dispositivo del usuario.

## 4. Respaldo antes de actualizar

### Opción A: ver/copiar la fila completa

```sql
select *
from public.user_profiles
where id = '00000000-0000-0000-0000-000000000000';
```

Copia el resultado antes de ejecutar el update.

### Opción B: crear tabla de respaldos si no existe

```sql
create table if not exists public.user_profiles_manual_backups (
  backup_id bigserial primary key,
  backed_up_at timestamptz not null default now(),
  reason text not null,
  user_profile_id uuid not null,
  snapshot jsonb not null
);

insert into public.user_profiles_manual_backups (reason, user_profile_id, snapshot)
select
  'recuperacion_manual_racha',
  id,
  to_jsonb(user_profiles.*)
from public.user_profiles
where id = '00000000-0000-0000-0000-000000000000';
```

## 5. Recuperar racha conservando `lastClaim`

Usa este caso cuando solo quieres corregir el contador de racha, sin cambiar si el bono diario ya fue reclamado hoy.

Parámetros a editar:

- `target_user_id`: UUID del usuario.
- `target_streak`: racha que se debe restaurar.

```sql
with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as target_user_id,
    14::int as target_streak
), current_snapshot as (
  select
    up.id,
    (up.game_data ->> 'gamecenter_v6_promos')::jsonb as hub
  from public.user_profiles up
  join params p on p.target_user_id = up.id
  where up.game_data ? 'gamecenter_v6_promos'
), patched_snapshot as (
  select
    id,
    jsonb_set(
      coalesce(hub, '{}'::jsonb),
      '{daily,streak}',
      to_jsonb((select target_streak from params)),
      true
    ) as patched_hub
  from current_snapshot
)
update public.user_profiles up
set
  game_data = jsonb_set(
    up.game_data,
    '{gamecenter_v6_promos}',
    to_jsonb(patched_snapshot.patched_hub::text),
    true
  ),
  updated_at = now()
from patched_snapshot
where up.id = patched_snapshot.id
returning
  up.id,
  up.updated_at,
  ((up.game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,streak}')::int as restored_streak,
  to_timestamp(
    (((up.game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,lastClaim}')::bigint / 1000.0)
  ) as last_claim_at;
```

## 6. Recuperar racha y permitir reclamar hoy

Usa este caso cuando el usuario perdió la racha y quieres que, al abrir la app hoy, pueda reclamar el bono diario como continuación de la racha restaurada.

La app calcula continuidad con días calendario locales y corte flexible de 03:00 AM. Para una reparación manual simple, poner `lastClaim` en **ayer a mediodía UTC** suele evitar bordes de medianoche.

```sql
with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as target_user_id,
    14::int as target_streak,
    (extract(epoch from (date_trunc('day', now() at time zone 'utc') - interval '12 hours')) * 1000)::bigint as repaired_last_claim_ms
), current_snapshot as (
  select
    up.id,
    (up.game_data ->> 'gamecenter_v6_promos')::jsonb as hub
  from public.user_profiles up
  join params p on p.target_user_id = up.id
  where up.game_data ? 'gamecenter_v6_promos'
), patched_snapshot as (
  select
    id,
    jsonb_set(
      jsonb_set(
        coalesce(hub, '{}'::jsonb),
        '{daily,streak}',
        to_jsonb((select target_streak from params)),
        true
      ),
      '{daily,lastClaim}',
      to_jsonb((select repaired_last_claim_ms from params)),
      true
    ) as patched_hub
  from current_snapshot
)
update public.user_profiles up
set
  game_data = jsonb_set(
    up.game_data,
    '{gamecenter_v6_promos}',
    to_jsonb(patched_snapshot.patched_hub::text),
    true
  ),
  updated_at = now()
from patched_snapshot
where up.id = patched_snapshot.id
returning
  up.id,
  up.updated_at,
  ((up.game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,streak}')::int as restored_streak,
  to_timestamp(
    (((up.game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,lastClaim}')::bigint / 1000.0)
  ) as repaired_last_claim_at;
```

## 7. Recuperar racha y bloquear nuevo reclamo hoy

Usa este caso si ya compensaste al usuario manualmente o no quieres que reclame otra vez el mismo día.

```sql
with params as (
  select
    '00000000-0000-0000-0000-000000000000'::uuid as target_user_id,
    14::int as target_streak,
    (extract(epoch from now()) * 1000)::bigint as repaired_last_claim_ms
), current_snapshot as (
  select
    up.id,
    (up.game_data ->> 'gamecenter_v6_promos')::jsonb as hub
  from public.user_profiles up
  join params p on p.target_user_id = up.id
  where up.game_data ? 'gamecenter_v6_promos'
), patched_snapshot as (
  select
    id,
    jsonb_set(
      jsonb_set(
        coalesce(hub, '{}'::jsonb),
        '{daily,streak}',
        to_jsonb((select target_streak from params)),
        true
      ),
      '{daily,lastClaim}',
      to_jsonb((select repaired_last_claim_ms from params)),
      true
    ) as patched_hub
  from current_snapshot
)
update public.user_profiles up
set
  game_data = jsonb_set(
    up.game_data,
    '{gamecenter_v6_promos}',
    to_jsonb(patched_snapshot.patched_hub::text),
    true
  ),
  updated_at = now()
from patched_snapshot
where up.id = patched_snapshot.id
returning
  up.id,
  up.updated_at,
  ((up.game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,streak}')::int as restored_streak,
  to_timestamp(
    (((up.game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,lastClaim}')::bigint / 1000.0)
  ) as repaired_last_claim_at;
```

## 8. Verificación posterior

Después del update, ejecuta:

```sql
select
  id,
  updated_at,
  ((game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,streak}')::int as current_streak,
  to_timestamp(
    (((game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,lastClaim}')::bigint / 1000.0)
  ) as last_claim_at,
  ((game_data ->> 'gamecenter_v6_promos')::jsonb #> '{daily}') as daily_json
from public.user_profiles
where id = '00000000-0000-0000-0000-000000000000';
```

Luego pide al usuario que cierre y vuelva a abrir sesión/dispositivo para forzar la carga del snapshot cloud. Si tenía una pestaña abierta antes de la reparación, debe recargarla para evitar que un snapshot local viejo vuelva a subir encima.

## 9. Riesgos y notas operativas

- **No actualices `game_data` como objeto directo.** La clave `gamecenter_v6_promos` debe seguir siendo un string JSON porque Sentinel restaura ese valor con `localStorage.setItem`.
- **Siempre actualiza `updated_at`.** Si no lo haces, el mecanismo Last Write Wins puede preferir el estado local antiguo del usuario.
- **Evita reparar mientras el usuario juega con sesión abierta.** Una escritura local posterior podría subir un snapshot anterior y revertir la reparación.
- **No edites monedas o inventario en la misma operación** salvo que el caso de soporte lo requiera. Esta guía solo cambia `daily.streak` y, opcionalmente, `daily.lastClaim`.
- **Si el usuario no tiene `gamecenter_v6_promos`,** primero revisa por qué no existe snapshot del hub. Crear un store completo manualmente es más riesgoso que recuperar desde un dispositivo con progreso local.
