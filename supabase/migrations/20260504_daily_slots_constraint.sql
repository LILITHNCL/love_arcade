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
