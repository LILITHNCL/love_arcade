-- Elimina columnas de recordatorios de Eventos LTE (sistema retirado).
-- Depende de que TICKET-09 (eliminación de código de aplicación) ya esté desplegado.
alter table public.user_notification_state
  drop column if exists events_enabled,
  drop column if exists active_event_ids,
  drop column if exists next_event_end_at,
  drop column if exists last_event_ids_sent,
  drop column if exists last_event_sent_at;
