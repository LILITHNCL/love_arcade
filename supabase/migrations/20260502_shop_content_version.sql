-- Versión global de contenido para notificaciones de novedades de tienda
create table if not exists public.app_content_versions (
  id smallint primary key default 1 check (id = 1),
  shop_version bigint not null default 1,
  updated_at timestamptz not null default now()
);

insert into public.app_content_versions (id, shop_version)
values (1, 1)
on conflict (id) do nothing;

create or replace function public.bump_shop_version()
returns bigint
language plpgsql
security definer
as $$
declare
  next_version bigint;
begin
  update public.app_content_versions
  set shop_version = shop_version + 1,
      updated_at = now()
  where id = 1
  returning shop_version into next_version;

  return next_version;
end;
$$;

alter table public.user_notification_state
  add column if not exists last_shop_version_sent bigint not null default 0;
