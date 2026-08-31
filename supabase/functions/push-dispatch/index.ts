// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const LA_CLOUD_URL = Deno.env.get('LA_CLOUD_URL');
const LA_CLOUD_SERVICE_ROLE_KEY = Deno.env.get('LA_CLOUD_SERVICE_ROLE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@example.com';
const EDGE_SHARED_SECRET = Deno.env.get('EDGE_SHARED_SECRET') || '';
const APP_ENV = (Deno.env.get('APP_ENV') || Deno.env.get('NODE_ENV') || 'production').toLowerCase();
const REQUIRE_EDGE_AUTH = (Deno.env.get('REQUIRE_EDGE_AUTH') || 'true').toLowerCase() !== 'false';
const SHOP_CONTENT_VERSION = Number(Deno.env.get('SHOP_CONTENT_VERSION') || '0');
const EVAL_BATCH_SIZE = Math.max(1, Number(Deno.env.get('EVAL_BATCH_SIZE') || '500'));
const EVAL_MAX_BATCHES = Math.max(1, Number(Deno.env.get('EVAL_MAX_BATCHES') || '10'));

if (!LA_CLOUD_URL || !LA_CLOUD_SERVICE_ROLE_KEY) {
  throw new Error('Missing LA_CLOUD_URL or LA_CLOUD_SERVICE_ROLE_KEY env vars');
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  throw new Error('Missing VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY env vars');
}

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function unauthorized(): Response {
  return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
}

function isAuthValid(req: Request): boolean {
  if (!EDGE_SHARED_SECRET) {
    if (REQUIRE_EDGE_AUTH || APP_ENV === 'production') return false;
    return true;
  }
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token.length > 0 && token === EDGE_SHARED_SECRET;
}

function getDailySlot(nowUtc: Date, offsetMinutes: number): { localDate: string, slot: 'morning' | 'day' | 'night' | null } {
  const localMs = nowUtc.getTime() - offsetMinutes * 60_000;
  const local = new Date(localMs);
  const hour = local.getUTCHours();
  const localDate = local.toISOString().slice(0, 10);
  if (hour >= 8 && hour < 12) return { localDate, slot: 'morning' };
  if (hour >= 13 && hour < 17) return { localDate, slot: 'day' };
  if (hour >= 19 && hour < 23) return { localDate, slot: 'night' };
  return { localDate, slot: null };
}

Deno.serve(async (req) => {
  if (!isAuthValid(req)) {
    return unauthorized();
  }

  const sb = createClient(LA_CLOUD_URL, LA_CLOUD_SERVICE_ROLE_KEY);
  const nowIso = new Date().toISOString();
  let globalShopVersion = SHOP_CONTENT_VERSION;

  const { data: versionRow } = await sb
    .from('app_content_versions')
    .select('shop_version')
    .eq('id', 1)
    .maybeSingle();
  if (versionRow?.shop_version) {
    globalShopVersion = Number(versionRow.shop_version || 0);
  }

  let statesScanned = 0;
  let statesProcessed = 0;
  let evalErrors = 0;
  let enqueueErrors = 0;
  let enqueueDedupeSkipped = 0;

  for (let batch = 0; batch < EVAL_MAX_BATCHES; batch += 1) {
    const from = batch * EVAL_BATCH_SIZE;
    const to = from + EVAL_BATCH_SIZE - 1;
    const { data: reminderStates, error: statesErr } = await sb
      .from('user_notification_state')
      .select('*')
      .order('updated_at', { ascending: true })
      .range(from, to);

    if (statesErr) {
      return jsonResponse({ ok: false, error: `user_notification_state fetch: ${statesErr.message}` }, 500);
    }
    if (!reminderStates?.length) break;
    statesScanned += reminderStates.length;

    for (const st of reminderStates || []) {
      statesProcessed += 1;
      const { localDate, slot } = getDailySlot(new Date(), Number(st.daily_timezone_offset_minutes || 0));
      const alreadyNotifiedToday = String(st.daily_last_notified_on || '') === localDate
        ? (st.daily_notified_slots || [])
        : [];
      const dueDaily = Boolean(st.daily_enabled)
        && Boolean(st.daily_can_claim)
        && Boolean(slot)
        && !alreadyNotifiedToday.includes(slot);
      const moonThresholdIso = st.moon_blessing_expires_at
        ? new Date(new Date(st.moon_blessing_expires_at).getTime() - 12 * 60 * 60 * 1000).toISOString()
        : null;
      const dueMoon = st.moon_enabled && moonThresholdIso && moonThresholdIso <= nowIso
        && (!st.last_moon_sent_at || st.last_moon_sent_at < moonThresholdIso);
      const dueShop = st.shop_enabled && globalShopVersion > Number(st.last_shop_version_sent || 0);
      const inserts: Array<Record<string, unknown>> = [];
      const updates: Record<string, unknown> = {};

      if (dueDaily) {
        inserts.push({
          title: '🎁 Bono diario disponible',
          body: 'Tu bono diario ya está listo. Reclámalo ahora en Love Arcade.',
          payload_json: { url: '/#view=home', tag: `local-daily-${st.user_id}-${localDate}-${slot}`, view: 'home', type: 'local_daily' },
          target_filter_json: { target: 'user_id', user_id: st.user_id },
          scheduled_for: nowIso,
          status: 'pending'
        });
        updates.last_daily_sent_at = nowIso;
        updates.daily_last_notified_on = localDate;
        updates.daily_notified_slots = [...alreadyNotifiedToday, slot];
      }
      if (dueMoon) {
        inserts.push({
          title: '🌙 Bendición Lunar por expirar',
          body: 'Tu Bendición Lunar está por terminar. Extiéndela para conservar el bonus.',
          payload_json: { url: '/#view=shop', tag: `local-moon-${st.user_id}-${new Date().getTime()}`, view: 'shop', type: 'local_moon' },
          target_filter_json: { target: 'user_id', user_id: st.user_id },
          scheduled_for: nowIso,
          status: 'pending'
        });
        updates.last_moon_sent_at = nowIso;
      }
      if (dueShop) {
        const { data: enqueued, error: enqueueErr } = await sb.rpc('enqueue_local_shop_campaign', {
          p_user_id: st.user_id,
          p_shop_version: globalShopVersion,
          p_scheduled_for: nowIso
        });

        if (enqueueErr) {
          enqueueErrors += 1;
          console.error('[push-dispatch] enqueue_local_shop_campaign error', enqueueErr.message);
        } else if (enqueued === true) {
          updates.last_shop_sent_at = nowIso;
          updates.last_shop_catalog_hash_sent = st.shop_catalog_hash || null;
          updates.last_shop_version_sent = globalShopVersion;
        } else {
          enqueueDedupeSkipped += 1;
          console.info(`[push-dispatch] local_shop dedupe skip user:${st.user_id} version:${globalShopVersion}`);
        }
      }
      if (inserts.length) {
        const { error: insertErr } = await sb.from('push_campaigns').insert(inserts);
        if (insertErr) {
          evalErrors += 1;
          console.error(`[push-dispatch] campaign insert error user:${st.user_id} err:${insertErr.message}`);
          continue;
        }
      }
      if (Object.keys(updates).length) {
        const { error: updErr } = await sb.from('user_notification_state').update(updates).eq('user_id', st.user_id);
        if (updErr) {
          evalErrors += 1;
          console.error(`[push-dispatch] user_notification_state update error user:${st.user_id} err:${updErr.message}`);
        }
      }
    }
  }

  const { data: requeued, error: requeueErr } = await sb.rpc('requeue_stuck_push_campaigns', {
    max_age: '10 minutes'
  });

  if (requeueErr) {
    return jsonResponse({ ok: false, error: `requeue_stuck_push_campaigns: ${requeueErr.message}` }, 500);
  }

  const { data: campaigns, error: claimErr } = await sb.rpc('claim_push_campaigns', { batch_size: 5 });

  if (claimErr) {
    return jsonResponse({ ok: false, error: `claim_push_campaigns: ${claimErr.message}` }, 500);
  }

  if (!campaigns?.length) {
    return jsonResponse({
      ok: true, requeued, processed: 0, message: 'No campaigns pending',
      states_scanned: statesScanned, states_processed: statesProcessed,
      eval_errors: evalErrors, enqueue_errors: enqueueErrors, enqueue_dedupe_skipped: enqueueDedupeSkipped
    }, 200);
  }

  for (const campaign of campaigns) {
    const target = campaign?.target_filter_json?.target || 'all';

    let subsQuery = sb
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, is_active')
      .eq('is_active', true);

    if (target === 'user_id') {
      const uid = String(campaign?.target_filter_json?.user_id || '');
      if (uid) subsQuery = subsQuery.eq('user_id', uid);
    } else if (target !== 'all') {
      subsQuery = subsQuery.eq('user_id', '__none__');
    }

    const { data: subscriptions, error: subsErr } = await subsQuery;
    if (subsErr) {
      await sb
        .from('push_campaigns')
        .update({
          status: 'error',
          processed_at: new Date().toISOString(),
          last_error: subsErr.message
        })
        .eq('id', campaign.id);
      continue;
    }

    const payload = JSON.stringify({
      title: campaign.title,
      body: campaign.body,
      ...(campaign.payload_json || {})
    });

    let sentCount = 0;
    let failedCount = 0;
    let inactiveCount = 0;
    const errors: string[] = [];

    for (const s of subscriptions || []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: {
              p256dh: s.p256dh,
              auth: s.auth
            }
          },
          payload
        );

        sentCount += 1;
        await sb.from('push_delivery_log').insert({
          campaign_id: campaign.id,
          subscription_id: s.id,
          status: 'sent',
          provider_response: 'ok'
        });
      } catch (err: any) {
        failedCount += 1;
        const providerMessage = String(err?.body || err?.message || 'unknown error');
        const statusCode = Number(err?.statusCode || 0);
        errors.push(`subscription:${s.id} status:${statusCode} msg:${providerMessage}`);

        await sb.from('push_delivery_log').insert({
          campaign_id: campaign.id,
          subscription_id: s.id,
          status: 'failed',
          provider_response: providerMessage
        });

        if (statusCode === 404 || statusCode === 410) {
          inactiveCount += 1;
          await sb.from('push_subscriptions').update({ is_active: false }).eq('id', s.id);
        }
      }
    }

    let campaignStatus: 'sent' | 'partial' | 'error' = 'sent';
    if (sentCount === 0 && failedCount > 0) campaignStatus = 'error';
    else if (sentCount > 0 && failedCount > 0) campaignStatus = 'partial';

    const lastError = errors.length ? errors.slice(0, 5).join(' | ').slice(0, 4000) : null;

    await sb
      .from('push_campaigns')
      .update({
        status: campaignStatus,
        sent_at: sentCount > 0 ? new Date().toISOString() : null,
        processed_at: new Date().toISOString(),
        processing_started_at: null,
        sent_count: sentCount,
        failed_count: failedCount,
        inactive_count: inactiveCount,
        last_error: lastError
      })
      .eq('id', campaign.id);
  }

  return jsonResponse({
    ok: true,
    requeued,
    processed: campaigns.length,
    states_scanned: statesScanned,
    states_processed: statesProcessed,
    eval_errors: evalErrors,
    enqueue_errors: enqueueErrors,
    enqueue_dedupe_skipped: enqueueDedupeSkipped
  }, 200);
});
