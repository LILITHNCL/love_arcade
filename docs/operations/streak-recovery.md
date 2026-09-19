# Recuperación manual de racha diaria

## Propósito y alcance

Esta es la guía canónica para restaurar manualmente la racha diaria de un usuario en Supabase después de una pérdida de estado, desincronización o corrección de soporte. Solo cubre `daily.streak` y, cuando el caso lo exige, `daily.lastClaim`.

> **Operación privilegiada:** esto no es una API del cliente ni una función normal de la aplicación. Solo debe ejecutarse desde un entorno autorizado, como el SQL Editor de Supabase, con aprobación humana, backup previo y validación posterior. No se debe automatizar desde el frontend ni copiar el SQL a un endpoint.

Los UUID y números que aparecen aquí son placeholders. Sustitúyelos únicamente después de revisar el caso y nunca ejecutes una sentencia sin entender su resultado. No se ejecutan sentencias reales contra Supabase como parte de esta guía.

## Precondiciones

Antes de modificar datos:

- obtener y verificar el UUID del usuario (`auth.users.id` y `public.user_profiles.id` cuando ambos estén disponibles);
- confirmar la racha objetivo y el motivo de soporte;
- decidir uno de los tres casos de recuperación descritos más abajo;
- confirmar que el usuario no está jugando ni tiene una sesión abierta que pueda escribir estado local durante la reparación;
- contar con permisos suficientes para consultar y actualizar `public.user_profiles` y, si aplica, crear la tabla de backups manuales;
- hacer backup de la fila completa;
- acordar quién hará la validación posterior y conservar el resultado de las consultas.

## Ubicación y formato de la racha

El snapshot cloud se almacena en `public.user_profiles.game_data`. La ubicación relevante es:

```text
public.user_profiles.game_data
  -> 'gamecenter_v6_promos'
  -> 'daily'
  -> 'streak'
  -> 'lastClaim'
```

La estructura esperada dentro del snapshot es:

```json
{
  "daily": {
    "streak": 14,
    "lastClaim": 1720000000000
  }
}
```

- `daily.streak` es el contador de la racha.
- `daily.lastClaim` es un timestamp Unix en milisegundos del último reclamo.
- `updated_at` es la marca de escritura de la fila y debe actualizarse con `now()`.

`gamecenter_v6_promos` **no es un objeto JSONB directo** dentro de `game_data`: se guarda como un string que contiene JSON. Por eso las consultas usan `game_data ->> 'gamecenter_v6_promos'` y convierten el resultado con `::jsonb`. Al escribir, el snapshot parcheado se convierte de nuevo a texto con `to_jsonb(...::text)`. No cambies esa representación.

La aplicación calcula los días con un desplazamiento de 03:00 y usa el reloj de red/cache para el reclamo normal. El timestamp elegido manualmente debe validarse contra la zona horaria y el estado real del usuario; una hora “de ayer” en UTC no garantiza por sí sola el mismo día lógico que el navegador.

## Last Write Wins y sincronización

La documentación operativa del proyecto trata `updated_at` como la marca usada por el mecanismo de sincronización para resolver conflictos con una regla Last Write Wins: una versión posterior puede ganar frente a otra anterior. Por eso todas las actualizaciones de esta guía incluyen `updated_at = now()`.

El código inspeccionado confirma que `saveState()` escribe el snapshot local y que una sesión autenticada puede solicitar una sincronización mediante Sentinel. La implementación completa de la comparación de versiones de Sentinel no está presente en los archivos revisados; el operador debe tratar la precedencia exacta como **revisión humana requerida**. En cualquier caso, una escritura local posterior, una pestaña abierta o un dispositivo antiguo puede volver a subir un snapshot anterior y revertir la reparación.

## Checklist antes de modificar datos

1. Confirmar el UUID, la identidad del usuario y la racha aprobada.
2. Confirmar que el usuario cerró la sesión o dejó de usar la aplicación durante la intervención.
3. Ejecutar el diagnóstico y revisar que el snapshot sea válido.
4. Si falta `gamecenter_v6_promos`, detenerse: investigar primero el estado local del usuario. No crear manualmente un snapshot completo sin esa investigación.
5. Ejecutar y conservar el backup de la fila completa.
6. Elegir exactamente el caso A, B o C.
7. Revisar los placeholders y los valores calculados antes de ejecutar el `update`.
8. Ejecutar el update una sola vez y guardar su `returning`.
9. Ejecutar la validación posterior antes de pedir al usuario que vuelva a entrar.

## Diagnóstico

Sustituye el UUID placeholder por el UUID aprobado. No ejecutes un update si el snapshot no existe o si el casteo a JSONB falla.

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

## Backup de la fila completa

Esta consulta es obligatoria. Copia y conserva el resultado antes de modificar nada.

```sql
select *
from public.user_profiles
where id = '00000000-0000-0000-0000-000000000000';
```

### Backup opcional en una tabla manual

La tabla siguiente es un respaldo creado por soporte, no una tabla ni una API del runtime. Verifica primero con el responsable de la base de datos que su nombre y esquema estén autorizados. Sustituye el UUID y el motivo antes de ejecutar. No la crees ni la uses como sustituto del backup obligatorio.

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
where id = '00000000-0000-0000-0000-000000000000'
returning backup_id, backed_up_at, user_profile_id;
```

## Caso A: restaurar la racha conservando `lastClaim`

Usa este caso cuando la racha debe cambiar, pero la decisión sobre si ya reclamó hoy debe conservarse exactamente. Sustituye `target_user_id` y `target_streak`. El `lastClaim` no se toca.

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
      hub,
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
  ((up.game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,lastClaim}')::bigint as preserved_last_claim_ms;
```

## Caso B: restaurar la racha y permitir un nuevo reclamo hoy

Usa este caso solo cuando el soporte haya aprobado que el usuario pueda reclamar nuevamente durante el día actual. `repaired_last_claim_ms` es un placeholder calculado en el ejemplo para situar el último reclamo en el día UTC anterior. Debe ajustarse y validarse con el corte de 03:00 y la zona horaria efectiva del usuario; si no se puede determinar, detén la operación y pide revisión humana.

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
        hub,
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
  ((up.game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,lastClaim}')::bigint as repaired_last_claim_ms;
```

## Caso C: restaurar la racha y bloquear un nuevo reclamo hoy

Usa este caso cuando el bono del día ya fue compensado o cuando la aprobación de soporte exige impedir un segundo reclamo durante el mismo día. El valor de `repaired_last_claim_ms` usa la hora del servidor como referencia; valida después con el reloj de red y el corte de la aplicación.

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
        hub,
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
  ((up.game_data ->> 'gamecenter_v6_promos')::jsonb #>> '{daily,lastClaim}')::bigint as repaired_last_claim_ms;
```

## Validación posterior

Ejecuta la consulta siguiente con el mismo UUID y compara `restored_streak`, `last_claim_at` y `updated_at` con la aprobación de soporte:

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

Confirma también que:

- la fila devuelta es la del UUID correcto;
- `gamecenter_v6_promos` sigue siendo un string JSON válido;
- `daily.streak` y `daily.lastClaim` tienen los valores esperados;
- `updated_at` refleja la operación;
- el resultado coincide con el caso A, B o C y no concede un segundo reclamo por accidente;
- no se modificaron monedas, inventario u otros datos no necesarios.

Después de guardar la evidencia, pide al usuario cerrar y volver a abrir sesión. Si no basta, debe recargar la pestaña o reiniciar el dispositivo para que el snapshot cloud vuelva a cargarse. Una sesión o pestaña que permaneció abierta puede conservar y subir el snapshot local anterior.

## Riesgos operativos

- Una escritura local posterior puede revertir la reparación manual si gana la resolución de conflicto.
- Reparar mientras el usuario juega o mantiene varias sesiones abiertas crea una carrera entre snapshots.
- Un snapshot ausente o malformado no debe completarse con un objeto inventado: requiere investigar el estado local primero.
- El caso B puede permitir un segundo reclamo si el timestamp no coincide con el día lógico de la aplicación.
- El caso C puede no bloquear el reclamo si hay una discrepancia entre el reloj del servidor, el reloj de red o la zona horaria del dispositivo.
- La tabla de backups manuales, si se autoriza, necesita sus propios permisos, retención y protección.
- El comportamiento exacto de Sentinel, sus permisos RLS y la autoridad final entre local y cloud requieren revisión humana cuando no estén demostrados por el código o la configuración actual.

## Reglas de seguridad

- ejecutar únicamente en un entorno autorizado y con aprobación humana;
- no exponer este procedimiento como endpoint ni llamarlo desde el cliente;
- no incluir credenciales, tokens, anon keys ni datos reales en consultas, tickets o documentación;
- no modificar monedas, inventario, historial u otros campos ajenos a la racha;
- hacer backup antes de cada intervención y validar después;
- no ejecutar SQL real durante revisiones automatizadas de documentación;
- detenerse ante un UUID ambiguo, un snapshot ausente, un casteo fallido o una discrepancia de permisos.

## Referencias

- [../OPERATIONS.md](../OPERATIONS.md)
- [../DOMAIN.md](../DOMAIN.md)
- [../ARCHITECTURE.md](../ARCHITECTURE.md)
