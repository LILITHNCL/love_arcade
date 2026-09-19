# Recuperación manual de racha diaria

## Propósito y alcance

Este documento describe un procedimiento operativo de soporte para restaurar la racha diaria de un usuario en Supabase cuando ha ocurrido una pérdida de estado, una desincronización o una corrección manual del servicio.

> Advertencia: esto no es una API del cliente ni una función de la app. Debe ejecutarse solo desde SQL Editor con aprobación humana, respaldo previo y validación posterior.

## 1. Precondiciones

Antes de ejecutar cualquier cambio:

- confirmar el `user_id` correcto;
- confirmar el valor de racha que debe devolverse;
- hacer backup de la fila antes de la edición;
- confirmar que la operación será validada por un operador humano;
- respetar la regla de Last Write Wins (`updated_at`).

## 2. Dónde vive la racha

La sincronización cloud guarda el snapshot del hub en el campo `game_data` dentro de `public.user_profiles`.

La clave relevante es:

```text
game_data -> 'gamecenter_v6_promos'
```

Dentro de ese JSON se guardan los campos:

```json
{
  "daily": {
    "lastClaim": 0,
    "streak": 0
  }
}
```

Los valores clave son:

- `daily.streak`: racha vigente;
- `daily.lastClaim`: timestamp en milisegundos del último reclamo exitoso;
- `updated_at`: marca de última escritura en Supabase.

## 3. Checklist mínimo antes de tocar datos

1. Confirmar UUID del usuario afectado.
2. Confirmar la racha objetivo.
3. Decidir si el usuario debe poder reclamar hoy o si se debe bloquear el reclamo para ese día.
4. Hacer backup de la fila.
5. Actualizar `updated_at = now()` al terminar.

## 4. Backup obligatorio

```sql
select *
from public.user_profiles
where id = '00000000-0000-0000-0000-000000000000';
```

Si hace falta dejar un respaldo adicional:

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

## 5. Diagnóstico

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

Si `has_hub_snapshot` es `false`, no se debe ejecutar un cambio sin revisar si existe estado local válido en el dispositivo.

## 6. Recuperación conservando el último reclamo

Usa este caso si solo necesitas ajustar la racha y no quieres que el usuario pueda reclamar nuevamente hoy:

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
where up.id = patched_snapshot.id;
```

## 7. Recuperación y permitir reclamo hoy

Usa este caso cuando quieres restaurar la racha y permitir que el usuario vuelva a reclamar el bono del mismo día. Debe ejecutarse solo si el operador ha validado el escenario.

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
where up.id = patched_snapshot.id;
```

## 8. Validación posterior

Tras la actualización, debe comprobarse:

- que la racha restaure el valor esperado;
- que `updated_at` haya cambiado;
- que la app no muestre un estado incoherente;
- que el usuario no quede en doble reclamo si no se espera.

## 9. Reglas de seguridad

- no se expone como endpoint del cliente;
- no se usa como función de aplicación normal;
- no se ejecuta sin aprobación humana;
- no se trata como una operación reversible automática;
- la edición debe dejar claro que es una corrección de soporte y no una API de negocio.

## 10. Referencias

- [docs/OPERATIONS.md](../OPERATIONS.md)
- [docs/DOMAIN.md](../DOMAIN.md)
- [docs/ARCHITECTURE.md](../ARCHITECTURE.md)
