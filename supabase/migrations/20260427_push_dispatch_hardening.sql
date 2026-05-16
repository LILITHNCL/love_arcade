-- Push dispatch hardening for Love Arcade
-- Date: 2026-04-27

begin;

-- Allow richer campaign statuses.
alter table public.push_campaigns
  drop constraint if exists push_campaigns_status_check;

alter table public.push_campaigns
  add constraint push_campaigns_status_check
  check (status in ('pending', 'processing', 'sent', 'partial', 'error'));

-- Observability fields.
alter table public.push_campaigns
  add column if not exists processing_started_at timestamptz,
  add column if not exists processed_at timestamptz,
  add column if not exists sent_count integer not null default 0,
  add column if not exists failed_count integer not null default 0,
  add column if not exists inactive_count integer not null default 0,
  add column if not exists last_error text;

-- Keep table query-friendly for retries / scheduler.
create index if not exists idx_push_campaigns_processing_started_at
  on public.push_campaigns(processing_started_at)
  where status = 'processing';

-- Atomic claim to avoid double-processing with concurrent workers.
create or replace function public.claim_push_campaigns(batch_size integer default 5)
returns setof public.push_campaigns
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.push_campaigns
    where status = 'pending'
      and scheduled_for <= now()
    order by id asc
    for update skip locked
    limit greatest(batch_size, 1)
  ), updated as (
    update public.push_campaigns pc
    set status = 'processing',
        processing_started_at = now(),
        updated_at = now(),
        last_error = null
    from candidates c
    where pc.id = c.id
    returning pc.*
  )
  select * from updated;
end;
$$;

revoke all on function public.claim_push_campaigns(integer) from public;
grant execute on function public.claim_push_campaigns(integer) to service_role;

-- Recovery function for stuck campaigns.
create or replace function public.requeue_stuck_push_campaigns(max_age interval default interval '10 minutes')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  update public.push_campaigns
  set status = 'pending',
      processing_started_at = null,
      updated_at = now(),
      last_error = coalesce(last_error, 'Automatically re-queued after processing timeout')
  where status = 'processing'
    and processing_started_at is not null
    and processing_started_at < now() - max_age;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.requeue_stuck_push_campaigns(interval) from public;
grant execute on function public.requeue_stuck_push_campaigns(interval) to service_role;

commit;
