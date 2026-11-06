-- Delivery to Google Sheets means queued for Zapier, not confirmed as sent.
alter table public.task_reminder_events
  drop constraint if exists task_reminder_events_status_check;

alter table public.task_reminder_events
  add constraint task_reminder_events_status_check
  check (status in ('pending', 'sending', 'queued', 'confirmation_required', 'sent', 'failed', 'cancelled', 'skipped'));

comment on column public.task_reminder_events.provider is
  'External queue provider. google_sheets_zapier means queued only; verify delivery in Zapier Task History or Gmail Sent.';

create or replace function public.create_or_update_task_reminders()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  prefs public.task_notification_preferences%rowtype;
  recipient_email text;
  offset_days integer;
  send_at timestamptz;
  delivery_status text;
  skip_reason text;
begin
  if tg_op = 'UPDATE' then
    update public.task_reminder_events
       set status = 'cancelled', locked_until = null, updated_at = now()
     where task_id = new.id and status in ('pending', 'sending', 'queued', 'confirmation_required');
  end if;
  if new.due_date is null or new.assigned_to is null or not new.reminder_enabled or new.status in ('done','cancelled') or new.archived_at is not null then
    return new;
  end if;
  select m.email into recipient_email from public.agency_members m where m.id = new.assigned_to and m.is_active;
  select p.* into prefs from public.task_notification_preferences p where p.member_id = new.assigned_to;
  if not found then
    prefs.member_id := new.assigned_to;
    prefs.email_enabled := true;
    prefs.reminder_offsets_days := array[3,1,0];
    prefs.reminder_time := time '09:00';
    prefs.timezone := 'Asia/Jakarta';
  end if;
  foreach offset_days in array prefs.reminder_offsets_days loop
    send_at := ((new.due_date - offset_days)::timestamp + prefs.reminder_time) at time zone prefs.timezone;
    delivery_status := 'pending';
    skip_reason := null;
    if recipient_email is null or length(trim(recipient_email)) = 0 then
      delivery_status := 'skipped'; skip_reason := 'Assigned member email is not configured.';
    elsif not prefs.email_enabled then
      delivery_status := 'skipped'; skip_reason := 'Email reminders are disabled for the assigned member.';
    elsif send_at <= now() then
      delivery_status := 'skipped'; skip_reason := 'Reminder time has already passed.';
    end if;
    insert into public.task_reminder_events(task_id, recipient_member_id, due_date_snapshot, reminder_offset_days, scheduled_at, status, last_error)
    values (new.id, new.assigned_to, new.due_date, offset_days, send_at, delivery_status, skip_reason)
    on conflict (task_id, recipient_member_id, due_date_snapshot, reminder_offset_days) do update
      set scheduled_at=excluded.scheduled_at,status=excluded.status,last_error=excluded.last_error,locked_until=null,updated_at=now()
      where public.task_reminder_events.status in ('pending','skipped','failed','cancelled');
  end loop;
  return new;
end;
$$;

revoke all on function public.create_or_update_task_reminders() from public, anon, authenticated;
