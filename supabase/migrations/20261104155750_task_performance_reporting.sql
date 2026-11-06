alter table public.agency_members add column if not exists email text;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  client_code text unique,
  brand_name text not null check (length(trim(brand_name)) > 0),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null references public.agency_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, brand_name)
);

create table if not exists public.contents (
  id uuid primary key default gen_random_uuid(),
  content_code text unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  title text not null check (length(trim(title)) > 0),
  content_type text not null default 'Post' check (length(trim(content_type)) > 0),
  workflow_status text not null default 'planned' check (workflow_status in ('planned', 'in_production', 'review', 'approved', 'published', 'cancelled')),
  notes text,
  created_by uuid not null references public.agency_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, client_id)
);

create table if not exists public.content_schedules (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null,
  client_id uuid not null,
  platform text not null check (length(trim(platform)) > 0),
  scheduled_at timestamptz,
  published_at timestamptz,
  publication_status text not null default 'scheduled' check (publication_status in ('scheduled', 'published', 'cancelled')),
  post_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_id, client_id) references public.contents(id, client_id) on delete cascade,
  unique (id, client_id),
  check (publication_status <> 'published' or published_at is not null)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) > 0),
  description text,
  category text not null check (category in ('agency_task', 'client_task')),
  responsibility text not null default 'agency' check (responsibility in ('agency', 'client', 'external')),
  client_id uuid references public.clients(id) on delete restrict,
  content_id uuid,
  assigned_to uuid not null references public.agency_members(id) on delete restrict,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'review', 'done')),
  start_date date,
  due_date date,
  reminder_enabled boolean not null default true,
  dependency_notes text,
  created_by uuid not null references public.agency_members(id),
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_id, client_id) references public.contents(id, client_id) on delete set null (content_id),
  check ((category = 'agency_task' and client_id is null) or (category = 'client_task' and client_id is not null)),
  check (start_date is null or due_date is null or start_date <= due_date)
);

create table if not exists public.task_notification_preferences (
  member_id uuid primary key references public.agency_members(id) on delete cascade,
  email_enabled boolean not null default true,
  reminder_offsets_days integer[] not null default array[3, 1, 0],
  reminder_time time not null default time '09:00',
  timezone text not null default 'Asia/Jakarta',
  updated_at timestamptz not null default now(),
  check (reminder_offsets_days = array[3, 1, 0]::integer[])
);

create table if not exists public.task_reminder_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  recipient_member_id uuid not null references public.agency_members(id) on delete restrict,
  due_date_snapshot date not null,
  reminder_offset_days integer not null check (reminder_offset_days in (3, 1, 0)),
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled', 'skipped')),
  provider text,
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  locked_until timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, recipient_member_id, due_date_snapshot, reminder_offset_days)
);

create table if not exists public.performances (
  id uuid primary key default gen_random_uuid(),
  content_schedule_id uuid not null,
  client_id uuid not null,
  measured_at timestamptz not null default now(),
  measurement_label text not null default 'manual',
  reach bigint check (reach is null or reach >= 0),
  impressions bigint check (impressions is null or impressions >= 0),
  views bigint check (views is null or views >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  shares bigint check (shares is null or shares >= 0),
  saves bigint check (saves is null or saves >= 0),
  content_url text,
  evaluation_notes text,
  created_by uuid not null references public.agency_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (content_schedule_id, client_id) references public.content_schedules(id, client_id) on delete cascade,
  unique (id, client_id),
  unique (id, content_schedule_id, client_id)
);

create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  work_summary text not null default '',
  evaluation text not null default '',
  challenges text not null default '',
  next_plan text not null default '',
  latest_version integer not null default 0 check (latest_version >= 0),
  created_by uuid not null references public.agency_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_start <= period_end),
  unique (id, client_id)
);

create table if not exists public.monthly_report_versions (
  id uuid primary key default gen_random_uuid(),
  monthly_report_id uuid not null references public.monthly_reports(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  snapshot_data jsonb not null,
  snapshot_hash text not null,
  finalized_by uuid not null references public.agency_members(id),
  finalized_at timestamptz not null default now(),
  unique (monthly_report_id, version_number)
);

create table if not exists public.social_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  platform text not null,
  account_label text not null default '',
  period_start date not null,
  period_end date not null,
  summary text not null default '',
  evaluation text not null default '',
  next_plan text not null default '',
  latest_version integer not null default 0 check (latest_version >= 0),
  created_by uuid not null references public.agency_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_start <= period_end),
  unique (id, client_id)
);

create table if not exists public.social_report_items (
  id uuid primary key default gen_random_uuid(),
  social_report_id uuid not null,
  client_id uuid not null,
  performance_id uuid not null,
  content_schedule_id uuid not null,
  added_at timestamptz not null default now(),
  foreign key (social_report_id, client_id) references public.social_reports(id, client_id) on delete cascade,
  foreign key (performance_id, content_schedule_id, client_id) references public.performances(id, content_schedule_id, client_id) on delete restrict,
  unique (social_report_id, performance_id),
  unique (social_report_id, content_schedule_id)
);

create table if not exists public.social_report_versions (
  id uuid primary key default gen_random_uuid(),
  social_report_id uuid not null references public.social_reports(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  snapshot_data jsonb not null,
  snapshot_hash text not null,
  finalized_by uuid not null references public.agency_members(id),
  finalized_at timestamptz not null default now(),
  unique (social_report_id, version_number)
);

create table if not exists public.report_pdf_jobs (
  id uuid primary key default gen_random_uuid(),
  report_type text not null check (report_type in ('monthly', 'social')),
  monthly_report_version_id uuid references public.monthly_report_versions(id) on delete restrict,
  social_report_version_id uuid references public.social_report_versions(id) on delete restrict,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  file_path text,
  last_error text,
  created_by uuid not null references public.agency_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((report_type = 'monthly' and monthly_report_version_id is not null and social_report_version_id is null) or (report_type = 'social' and social_report_version_id is not null and monthly_report_version_id is null)),
  unique (monthly_report_version_id),
  unique (social_report_version_id)
);

create index if not exists tasks_client_status_due_idx on public.tasks (client_id, status, due_date) where archived_at is null;
create index if not exists tasks_assignee_status_due_idx on public.tasks (assigned_to, status, due_date) where archived_at is null;
create index if not exists tasks_due_idx on public.tasks (due_date) where archived_at is null;
create index if not exists task_reminders_dispatch_idx on public.task_reminder_events (scheduled_at) where status = 'pending';
create index if not exists task_reminders_lease_idx on public.task_reminder_events (locked_until) where status = 'sending';
create index if not exists content_schedules_publication_idx on public.content_schedules (client_id, platform, published_at);
create index if not exists performances_client_measured_idx on public.performances (client_id, measured_at desc);
create index if not exists report_pdf_jobs_dispatch_idx on public.report_pdf_jobs (next_attempt_at) where status = 'queued';

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
     where task_id = new.id and status in ('pending', 'sending');
  end if;

  if new.due_date is null or new.assigned_to is null or not new.reminder_enabled or new.status = 'done' or new.archived_at is not null then
    return new;
  end if;

  select m.email into recipient_email
    from public.agency_members m
   where m.id = new.assigned_to and m.is_active;

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

drop trigger if exists tasks_sync_reminders on public.tasks;
create trigger tasks_sync_reminders after insert or update of due_date, assigned_to, reminder_enabled, status, archived_at on public.tasks
for each row execute function public.create_or_update_task_reminders();

create or replace function public.refresh_member_task_reminders()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.tasks set due_date=due_date
   where assigned_to=new.member_id and due_date is not null and archived_at is null;
  return new;
end;
$$;
create trigger task_preferences_refresh_reminders after insert or update on public.task_notification_preferences
for each row execute function public.refresh_member_task_reminders();

create or replace function public.refresh_assignee_task_reminders()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.tasks set due_date=due_date
   where assigned_to=new.id and due_date is not null and archived_at is null;
  return new;
end;
$$;
create trigger agency_members_refresh_task_reminders after update of email, is_active on public.agency_members
for each row when (old.email is distinct from new.email or old.is_active is distinct from new.is_active)
execute function public.refresh_assignee_task_reminders();

create or replace function public.set_task_completed_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'done' then new.completed_at := coalesce(new.completed_at, now()); else new.completed_at := null; end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.validate_task_assignee()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.assigned_to is not null and not exists (select 1 from public.agency_members m where m.id=new.assigned_to and m.is_active) then
    raise exception 'assigned_pic_must_be_an_active_agency_member';
  end if;
  return new;
end;
$$;
drop trigger if exists tasks_validate_assignee on public.tasks;
create trigger tasks_validate_assignee before insert or update of assigned_to on public.tasks for each row execute function public.validate_task_assignee();
drop trigger if exists tasks_set_completed_at on public.tasks;
create trigger tasks_set_completed_at before insert or update on public.tasks for each row execute function public.set_task_completed_at();

create or replace function public.get_performance_summary(
  p_client_id uuid default null,
  p_platform text default null,
  p_period_start date default null,
  p_period_end date default null,
  p_content_type text default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with filtered as (
    select p.*, s.platform, s.published_at, s.content_id, c.content_type
      from public.performances p
      join public.content_schedules s on s.id = p.content_schedule_id and s.client_id = p.client_id
      join public.contents c on c.id = s.content_id and c.client_id = s.client_id
     where (p_client_id is null or p.client_id = p_client_id)
       and (p_platform is null or s.platform = p_platform)
       and s.publication_status='published' and s.published_at is not null
       and (p_period_start is null or (s.published_at at time zone 'Asia/Jakarta')::date >= p_period_start)
       and (p_period_end is null or (s.published_at at time zone 'Asia/Jakarta')::date <= p_period_end)
       and (p_content_type is null or c.content_type = p_content_type)
  ), measured as (
    select * from (
      select filtered.*, row_number() over (partition by content_schedule_id order by measured_at desc, id desc) as snapshot_rank
        from filtered
    ) ranked where snapshot_rank=1
  )
  select jsonb_build_object(
    'snapshot_count', count(*),
    'publication_count', count(distinct content_schedule_id),
    'content_count', count(distinct content_id),
    'reach', sum(reach), 'impressions', sum(impressions), 'views', sum(views),
    'interactions', sum(coalesce(likes,0) + coalesce(comments,0) + coalesce(shares,0) + coalesce(saves,0)),
    'engagement_rate_by_reach', case when sum(reach) > 0 then round(100.0 * sum(coalesce(likes,0) + coalesce(comments,0) + coalesce(shares,0) + coalesce(saves,0)) / sum(reach), 2) else null end
  ) from measured;
$$;

create or replace function public.finalize_monthly_report(p_report_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.monthly_reports%rowtype; v_snapshot jsonb; v_version integer; v_id uuid; v_actor uuid := auth.uid();
begin
  if not coalesce((select public.is_active_agency_member()), false) then raise exception 'active_agency_member_required'; end if;
  select * into r from public.monthly_reports where id = p_report_id for update;
  if not found then raise exception 'report_not_found'; end if;
  select jsonb_build_object(
    'reportType','monthly','client',jsonb_build_object('id',c.id,'brand_name',c.brand_name),
    'period',jsonb_build_object('start',r.period_start,'end',r.period_end),
    'narrative',jsonb_build_object('work_summary',r.work_summary,'evaluation',r.evaluation,'challenges',r.challenges,'next_plan',r.next_plan),
    'contents',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'title',x.title,'content_type',x.content_type,'status',x.workflow_status,'created_at',x.created_at) order by x.created_at) from public.contents x where x.client_id=r.client_id and (x.created_at at time zone 'Asia/Jakarta')::date between r.period_start and r.period_end),'[]'::jsonb),
    'schedules',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'content_id',s.content_id,'platform',s.platform,'scheduled_at',s.scheduled_at,'published_at',s.published_at,'status',s.publication_status) order by coalesce(s.published_at,s.scheduled_at)) from public.content_schedules s where s.client_id=r.client_id and coalesce((s.published_at at time zone 'Asia/Jakarta')::date,(s.scheduled_at at time zone 'Asia/Jakarta')::date) between r.period_start and r.period_end),'[]'::jsonb),
    'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'status',t.status,'priority',t.priority,'due_date',t.due_date,'completed_at',t.completed_at) order by t.due_date nulls last,t.created_at) from public.tasks t where t.client_id=r.client_id and t.archived_at is null and (t.due_date between r.period_start and r.period_end or (t.completed_at at time zone 'Asia/Jakarta')::date between r.period_start and r.period_end)),'[]'::jsonb),
    'calculated_at',now()
  ) into v_snapshot from public.clients c where c.id=r.client_id;
  select coalesce(max(version_number),0)+1 into v_version from public.monthly_report_versions where monthly_report_id=r.id;
  insert into public.monthly_report_versions(monthly_report_id,version_number,snapshot_data,snapshot_hash,finalized_by)
  values (r.id,v_version,v_snapshot,encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex'),v_actor) returning id into v_id;
  update public.monthly_reports set latest_version=v_version,updated_at=now() where id=r.id;
  return v_id;
end;
$$;

create or replace function public.finalize_social_report(p_report_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.social_reports%rowtype; v_snapshot jsonb; v_version integer; v_id uuid; v_actor uuid := auth.uid();
begin
  if not coalesce((select public.is_active_agency_member()), false) then raise exception 'active_agency_member_required'; end if;
  select * into r from public.social_reports where id=p_report_id for update;
  if not found then raise exception 'report_not_found'; end if;
  select jsonb_build_object(
    'reportType','social','client',jsonb_build_object('id',c.id,'brand_name',c.brand_name),
    'platform',r.platform,'account_label',r.account_label,'period',jsonb_build_object('start',r.period_start,'end',r.period_end),
    'narrative',jsonb_build_object('summary',r.summary,'evaluation',r.evaluation,'next_plan',r.next_plan),
    'metrics',jsonb_build_object('publication_count',count(distinct p.content_schedule_id),'content_count',count(distinct cs.content_id),'reach',sum(p.reach),'impressions',sum(p.impressions),'views',sum(p.views),'interactions',sum(coalesce(p.likes,0)+coalesce(p.comments,0)+coalesce(p.shares,0)+coalesce(p.saves,0)),'engagement_rate_by_reach',case when sum(p.reach)>0 then round(100.0*sum(coalesce(p.likes,0)+coalesce(p.comments,0)+coalesce(p.shares,0)+coalesce(p.saves,0))/sum(p.reach),2) else null end),
    'items',coalesce(jsonb_agg(jsonb_build_object('performance_id',p.id,'content_id',co.id,'content_title',co.title,'content_type',co.content_type,'schedule_id',cs.id,'published_at',cs.published_at,'platform',cs.platform,'post_url',coalesce(p.content_url,cs.post_url),'reach',p.reach,'impressions',p.impressions,'views',p.views,'likes',p.likes,'comments',p.comments,'shares',p.shares,'saves',p.saves,'interactions',coalesce(p.likes,0)+coalesce(p.comments,0)+coalesce(p.shares,0)+coalesce(p.saves,0),'engagement_rate_by_reach',case when p.reach>0 then round(100.0*(coalesce(p.likes,0)+coalesce(p.comments,0)+coalesce(p.shares,0)+coalesce(p.saves,0))/p.reach,2) else null end,'evaluation',p.evaluation_notes) order by (coalesce(p.likes,0)+coalesce(p.comments,0)+coalesce(p.shares,0)+coalesce(p.saves,0)) desc) filter (where p.id is not null),'[]'::jsonb),
    'calculated_at',now()
  ) into v_snapshot
  from public.clients c
  left join public.social_report_items i on i.social_report_id=r.id and i.client_id=r.client_id
  left join public.performances p on p.id=i.performance_id and p.client_id=r.client_id and exists (
    select 1 from public.content_schedules eligible
     where eligible.id=p.content_schedule_id and eligible.client_id=p.client_id
       and eligible.platform=r.platform and eligible.publication_status='published'
       and (eligible.published_at at time zone 'Asia/Jakarta')::date between r.period_start and r.period_end
  )
  left join public.content_schedules cs on cs.id=p.content_schedule_id and cs.client_id=p.client_id
  left join public.contents co on co.id=cs.content_id and co.client_id=cs.client_id
  where c.id=r.client_id
  group by c.id,c.brand_name;
  select coalesce(max(version_number),0)+1 into v_version from public.social_report_versions where social_report_id=r.id;
  insert into public.social_report_versions(social_report_id,version_number,snapshot_data,snapshot_hash,finalized_by)
  values (r.id,v_version,v_snapshot,encode(extensions.digest(convert_to(v_snapshot::text,'UTF8'),'sha256'),'hex'),v_actor) returning id into v_id;
  update public.social_reports set latest_version=v_version,updated_at=now() where id=r.id;
  return v_id;
end;
$$;

create or replace function public.prevent_finalized_report_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'finalized_report_versions_are_immutable'; end;
$$;
create trigger monthly_report_versions_immutable before update or delete on public.monthly_report_versions for each row execute function public.prevent_finalized_report_mutation();
create trigger social_report_versions_immutable before update or delete on public.social_report_versions for each row execute function public.prevent_finalized_report_mutation();

create or replace function public.claim_due_task_reminders(p_batch_size integer default 20)
returns setof public.task_reminder_events language plpgsql security definer set search_path = '' as $$
begin
  return query with candidates as (
    select e.id from public.task_reminder_events e
    join public.tasks t on t.id=e.task_id
    where ((e.status='pending' and e.scheduled_at<=now()) or (e.status='sending' and e.locked_until<now()))
      and t.status <> 'done' and t.archived_at is null and t.reminder_enabled and t.due_date=e.due_date_snapshot and t.assigned_to=e.recipient_member_id
    order by e.scheduled_at for update of e skip locked limit greatest(1,least(p_batch_size,100))
  ) update public.task_reminder_events e set status='sending',attempt_count=e.attempt_count+1,locked_until=now()+interval '5 minutes',updated_at=now()
    from candidates c where e.id=c.id returning e.*;
end;
$$;

create or replace function public.claim_report_pdf_jobs(p_batch_size integer default 2)
returns setof public.report_pdf_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query with candidates as (
    select j.id from public.report_pdf_jobs j
    where (j.status='queued' and j.next_attempt_at<=now()) or (j.status='processing' and j.locked_until<now())
    order by j.next_attempt_at for update skip locked limit greatest(1,least(p_batch_size,10))
  ) update public.report_pdf_jobs j set status='processing',attempt_count=j.attempt_count+1,locked_until=now()+interval '10 minutes',updated_at=now()
    from candidates c where j.id=c.id returning j.*;
end;
$$;

create or replace function public.requeue_report_pdf_job(p_job_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select public.is_active_agency_member()), false) then raise exception 'active_agency_member_required'; end if;
  update public.report_pdf_jobs
     set status='queued',attempt_count=0,next_attempt_at=now(),locked_until=null,file_path=null,last_error=null,updated_at=now()
   where id=p_job_id and status='failed';
  if not found then raise exception 'failed_report_pdf_job_not_found'; end if;
end;
$$;

revoke all on function public.create_or_update_task_reminders() from public, anon, authenticated;
revoke all on function public.refresh_member_task_reminders() from public, anon, authenticated;
revoke all on function public.refresh_assignee_task_reminders() from public, anon, authenticated;

create or replace function public.get_dashboard_team_workload()
returns table(member_id uuid, full_name text, active_task_count bigint, in_progress_count bigint, review_count bigint)
language plpgsql stable security definer set search_path=''
as $$ begin
 if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
 return query select m.id,m.full_name,
   count(t.id) filter(where t.status<>'done') as active_task_count,
   count(t.id) filter(where t.status='in_progress') as in_progress_count,
   count(t.id) filter(where t.status='review') as review_count
 from public.agency_members m
 left join public.tasks t on t.assigned_to=m.id and t.archived_at is null
 where m.is_active
 group by m.id,m.full_name
 order by active_task_count desc,m.full_name
 limit 8;
end $$;
revoke all on function public.get_dashboard_team_workload() from public,anon;
grant execute on function public.get_dashboard_team_workload() to authenticated;
revoke all on function public.claim_due_task_reminders(integer) from public, anon, authenticated;
revoke all on function public.claim_report_pdf_jobs(integer) from public, anon, authenticated;
revoke all on function public.requeue_report_pdf_job(uuid) from public, anon;
grant execute on function public.claim_due_task_reminders(integer) to service_role;
grant execute on function public.claim_report_pdf_jobs(integer) to service_role;
grant execute on function public.requeue_report_pdf_job(uuid) to authenticated;
grant execute on function public.get_performance_summary(uuid,text,date,date,text) to authenticated;
revoke all on function public.finalize_monthly_report(uuid) from public, anon;
revoke all on function public.finalize_social_report(uuid) from public, anon;
grant execute on function public.finalize_monthly_report(uuid) to authenticated;
grant execute on function public.finalize_social_report(uuid) to authenticated;

do $$ declare t text; begin
  foreach t in array array['clients','contents','content_schedules','tasks','task_notification_preferences','task_reminder_events','performances','monthly_reports','monthly_report_versions','social_reports','social_report_items','social_report_versions','report_pdf_jobs'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select, insert, update, delete on public.%I to authenticated',t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.is_active_agency_member())) with check ((select public.is_active_agency_member()))',t||'_active_members_all',t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['clients','contents','content_schedules','task_notification_preferences','task_reminder_events','performances','monthly_reports','social_reports','report_pdf_jobs'] loop
    execute format('drop trigger if exists %I on public.%I',t||'_set_updated_at',t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',t||'_set_updated_at',t);
  end loop;
end $$;

drop policy if exists task_reminder_events_active_members_all on public.task_reminder_events;
create policy task_reminder_events_active_members_read on public.task_reminder_events for select to authenticated using ((select public.is_active_agency_member()));
revoke insert, update, delete on public.task_reminder_events from authenticated;
grant select on public.task_reminder_events to authenticated;

drop policy if exists task_notification_preferences_active_members_all on public.task_notification_preferences;
create policy task_notification_preferences_own_read on public.task_notification_preferences for select to authenticated using (member_id=(select auth.uid()) and (select public.is_active_agency_member()));
create policy task_notification_preferences_own_insert on public.task_notification_preferences for insert to authenticated with check (member_id=(select auth.uid()) and (select public.is_active_agency_member()));
create policy task_notification_preferences_own_update on public.task_notification_preferences for update to authenticated using (member_id=(select auth.uid()) and (select public.is_active_agency_member())) with check (member_id=(select auth.uid()) and (select public.is_active_agency_member()));
revoke delete on public.task_notification_preferences from authenticated;

drop policy if exists monthly_report_versions_active_members_all on public.monthly_report_versions;
create policy monthly_report_versions_active_members_read on public.monthly_report_versions for select to authenticated using ((select public.is_active_agency_member()));
revoke insert, update, delete on public.monthly_report_versions from authenticated;
grant select on public.monthly_report_versions to authenticated;

drop policy if exists social_report_versions_active_members_all on public.social_report_versions;
create policy social_report_versions_active_members_read on public.social_report_versions for select to authenticated using ((select public.is_active_agency_member()));
revoke insert, update, delete on public.social_report_versions from authenticated;
grant select on public.social_report_versions to authenticated;

drop policy if exists report_pdf_jobs_active_members_all on public.report_pdf_jobs;
create policy report_pdf_jobs_active_members_read on public.report_pdf_jobs for select to authenticated using ((select public.is_active_agency_member()));
create policy report_pdf_jobs_active_members_insert on public.report_pdf_jobs for insert to authenticated with check ((select public.is_active_agency_member()) and created_by=(select auth.uid()));
revoke update, delete on public.report_pdf_jobs from authenticated;

drop policy if exists "Active members can view active agency members" on public.agency_members;
create policy "Active members can view active agency members" on public.agency_members for select to authenticated
using (is_active and (select public.is_active_agency_member()));

create policy "Active members can read agency report PDFs" on storage.objects for select to authenticated
using (bucket_id = 'agency-reports' and (select public.is_active_agency_member()));
insert into storage.buckets(id,name,public,allowed_mime_types)
values ('agency-reports','agency-reports',false,array['application/pdf'])
on conflict (id) do nothing;
