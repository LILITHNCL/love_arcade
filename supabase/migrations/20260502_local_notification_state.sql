-- Estado de recordatorios locales sincronizado por cliente y consumido por push-dispatch
create table if not exists public.user_notification_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_enabled boolean not null default true,
  moon_enabled boolean not null default true,
  shop_enabled boolean not null default true,
  events_enabled boolean not null default true,
  next_daily_claim_at timestamptz,
  moon_blessing_expires_at timestamptz,
  shop_catalog_hash text,
  active_event_ids text[] not null default '{}',
  next_event_end_at timestamptz,
  last_shop_catalog_hash_sent text,
  last_event_ids_sent text[] not null default '{}',
  last_daily_sent_at timestamptz,
  last_moon_sent_at timestamptz,
  last_shop_sent_at timestamptz,
  last_event_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.tg_user_notification_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_notification_state_updated_at on public.user_notification_state;
create trigger trg_user_notification_state_updated_at
before update on public.user_notification_state
for each row
execute function public.tg_user_notification_state_updated_at();

alter table public.user_notification_state enable row level security;

create policy if not exists user_notification_state_select_own
on public.user_notification_state
for select
using (auth.uid() = user_id);

create policy if not exists user_notification_state_insert_own
on public.user_notification_state
for insert
with check (auth.uid() = user_id);

create policy if not exists user_notification_state_update_own
on public.user_notification_state
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
