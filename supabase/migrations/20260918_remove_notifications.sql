begin;

drop function if exists public.enqueue_local_shop_campaign(uuid, bigint, timestamptz);
drop function if exists public.bump_shop_version();
drop function if exists public.claim_push_campaigns(integer);
drop function if exists public.requeue_stuck_push_campaigns(interval);

drop table if exists public.user_notification_state cascade;
drop table if exists public.push_delivery_log cascade;
drop table if exists public.push_subscriptions cascade;
drop table if exists public.push_campaigns cascade;
drop table if exists public.app_content_versions cascade;

drop function if exists public.tg_user_notification_state_updated_at();

commit;