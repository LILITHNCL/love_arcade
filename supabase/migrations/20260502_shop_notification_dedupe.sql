-- Dedupe robusta para campañas de notificación de tienda por usuario + versión
create or replace function public.enqueue_local_shop_campaign(
  p_user_id uuid,
  p_shop_version bigint,
  p_scheduled_for timestamptz default now()
)
returns boolean
language plpgsql
security definer
as $$
declare
  _inserted boolean := false;
begin
  -- Evita carreras entre ejecuciones concurrentes del cron/función
  perform pg_advisory_xact_lock(hashtext('local_shop:' || p_user_id::text || ':' || p_shop_version::text));

  if exists (
    select 1
    from public.push_campaigns c
    where c.target_filter_json->>'target' = 'user_id'
      and c.target_filter_json->>'user_id' = p_user_id::text
      and c.payload_json->>'type' = 'local_shop'
      and (c.payload_json->>'shop_version')::bigint = p_shop_version
      and c.status in ('pending', 'processing', 'sent', 'partial')
  ) then
    return false;
  end if;

  insert into public.push_campaigns (
    title,
    body,
    payload_json,
    target_filter_json,
    scheduled_for,
    status
  ) values (
    '🛍️ Novedades en la tienda',
    'Hay contenido nuevo en la tienda. Entra y descubre las novedades.',
    jsonb_build_object(
      'url', '/#view=shop',
      'tag', 'local-shop-' || p_user_id::text || '-v' || p_shop_version::text,
      'view', 'shop',
      'type', 'local_shop',
      'shop_version', p_shop_version
    ),
    jsonb_build_object(
      'target', 'user_id',
      'user_id', p_user_id::text
    ),
    p_scheduled_for,
    'pending'
  );

  _inserted := true;
  return _inserted;
end;
$$;
