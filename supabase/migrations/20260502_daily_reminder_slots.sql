alter table public.user_notification_state
  add column if not exists daily_can_claim boolean not null default false,
  add column if not exists daily_last_claim_at timestamptz,
  add column if not exists daily_timezone_offset_minutes integer not null default 0,
  add column if not exists daily_last_notified_on date,
  add column if not exists daily_notified_slots text[] not null default '{}';
