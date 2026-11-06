-- Additive completion of the BABE AGENCY single-workspace schema.
-- Requires the existing foundation/task/report/document migrations and
-- 20261104164409_zapier_reminder_queue.sql. No existing table or row is dropped.

alter table public.agency_members
  add column if not exists role text not null default 'member',
  add column if not exists joined_at timestamptz not null default now();
update public.agency_members set role='admin' where can_manage_members and role='member';
alter table public.agency_members drop constraint if exists agency_members_role_check;
alter table public.agency_members add constraint agency_members_role_check check(role in ('owner','admin','member'));

alter table public.agency_settings
  add column if not exists currency text not null default 'IDR',
  add column if not exists date_format text not null default 'dd MMM yyyy',
  add column if not exists invoice_prefix text not null default 'BABE/INV/',
  add column if not exists reminder_settings jsonb not null default '{"offset_days":[3,1,0],"time":"09:00","timezone":"Asia/Jakarta"}'::jsonb;
alter table public.agency_settings drop constraint if exists agency_settings_reminder_settings_object_check;
alter table public.agency_settings add constraint agency_settings_reminder_settings_object_check check(jsonb_typeof(reminder_settings)='object');

create or replace function public.enforce_agency_member_role()
returns trigger language plpgsql security definer set search_path=''
as $$
declare actor_role text; active_owners bigint;
begin
  if tg_op='DELETE' then
    if auth.uid() is not null then
      select m.role into actor_role from public.agency_members m where m.id=(select auth.uid());
      if not coalesce(actor_role in ('owner','admin'),false) then raise exception 'membership_manager_required'; end if;
      if auth.uid()=old.id then raise exception 'self_membership_removal_forbidden'; end if;
      if actor_role<>'owner' and old.role='owner' then raise exception 'owner_role_required'; end if;
    end if;
    if old.role='owner' then
      select count(*) into active_owners from public.agency_members m where m.role='owner' and m.is_active and m.id<>old.id;
      if active_owners=0 then raise exception 'last_active_owner_cannot_be_removed'; end if;
    end if;
    return old;
  end if;
  if new.can_manage_members and new.role='member' then new.role='admin'; end if;
  new.can_manage_members := new.role in ('owner','admin');
  if auth.uid() is not null then
    select m.role into actor_role from public.agency_members m where m.id=(select auth.uid());
    if tg_op='INSERT' then
      if not coalesce(actor_role in ('owner','admin'),false) then raise exception 'membership_manager_required'; end if;
      if new.role='owner' and actor_role<>'owner' then raise exception 'owner_role_required'; end if;
    else
      if not coalesce(actor_role in ('owner','admin'),false) then raise exception 'membership_manager_required'; end if;
      if auth.uid()=old.id and new.role is distinct from old.role then raise exception 'self_role_change_forbidden'; end if;
      if actor_role<>'owner' and (old.role='owner' or new.role='owner') then raise exception 'owner_role_required'; end if;
      if old.role='owner' and (new.role<>'owner' or not new.is_active) then
        select count(*) into active_owners from public.agency_members m where m.role='owner' and m.is_active and m.id<>old.id;
        if active_owners=0 then raise exception 'last_active_owner_cannot_be_removed'; end if;
      end if;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists agency_members_role_guard on public.agency_members;
drop trigger if exists agency_members_role_guard_insert on public.agency_members;
drop trigger if exists agency_members_role_guard_update on public.agency_members;
drop trigger if exists agency_members_role_guard_delete on public.agency_members;
create trigger agency_members_role_guard_insert before insert on public.agency_members
for each row execute function public.enforce_agency_member_role();
create trigger agency_members_role_guard_update before update of role,can_manage_members,is_active on public.agency_members
for each row execute function public.enforce_agency_member_role();
create trigger agency_members_role_guard_delete before delete on public.agency_members
for each row execute function public.enforce_agency_member_role();
revoke all on function public.enforce_agency_member_role() from public,anon,authenticated;

create or replace function public.can_manage_agency_members()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.agency_members m where m.id=(select auth.uid()) and m.is_active and m.role in ('owner','admin')) $$;
revoke all on function public.can_manage_agency_members() from public,anon;
grant execute on function public.can_manage_agency_members() to authenticated;

alter table public.clients
  add column if not exists client_name text,
  add column if not exists contact_person text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists address text,
  add column if not exists industry text,
  add column if not exists notes text,
  add column if not exists deleted_at timestamptz;
update public.clients set client_name=brand_name where client_name is null;
alter table public.clients drop constraint if exists clients_status_check;
alter table public.clients add constraint clients_status_check check(status in ('lead','active','inactive','archived'));

create table if not exists public.client_briefs (
  id uuid primary key default gen_random_uuid(), client_id uuid not null unique references public.clients(id) on delete restrict,
  objectives text not null default '', target_audience text not null default '', brand_personality text not null default '',
  brand_positioning text not null default '', visual_direction text not null default '', communication_style text not null default '',
  competitors jsonb not null default '[]'::jsonb, references_data jsonb not null default '[]'::jsonb,
  additional_information text not null default '', current_version integer not null default 1 check(current_version>0),
  created_by uuid not null references public.agency_members(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(jsonb_typeof(competitors)='array'), check(jsonb_typeof(references_data)='array')
);
create table if not exists public.client_brief_versions (
  id uuid primary key default gen_random_uuid(), client_brief_id uuid not null references public.client_briefs(id) on delete restrict,
  version_number integer not null check(version_number>0), snapshot_data jsonb not null,
  changed_by uuid references public.agency_members(id) on delete set null, created_at timestamptz not null default now(),
  unique(client_brief_id,version_number)
);
create or replace function public.snapshot_client_brief_update()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
  insert into public.client_brief_versions(client_brief_id,version_number,snapshot_data,changed_by)
  values(old.id,old.current_version,to_jsonb(old),(select auth.uid()));
  new.current_version:=old.current_version+1;
  return new;
end $$;
create or replace function public.snapshot_client_brief_insert()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
  insert into public.client_brief_versions(client_brief_id,version_number,snapshot_data,changed_by)
  values(new.id,new.current_version,to_jsonb(new),(select auth.uid()));
  return new;
end $$;
create trigger client_briefs_snapshot_insert after insert on public.client_briefs for each row execute function public.snapshot_client_brief_insert();
create trigger client_briefs_snapshot_update before update on public.client_briefs for each row execute function public.snapshot_client_brief_update();
revoke all on function public.snapshot_client_brief_update() from public,anon,authenticated;
revoke all on function public.snapshot_client_brief_insert() from public,anon,authenticated;

create table if not exists public.packages (
  id uuid primary key default gen_random_uuid(), package_name text not null unique check(length(trim(package_name))>0),
  description text not null default '', base_price numeric(14,2) not null default 0 check(base_price>=0),
  status text not null default 'active' check(status in ('active','archived')),
  created_by uuid not null references public.agency_members(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.package_content_quotas (
  id uuid primary key default gen_random_uuid(), package_id uuid not null references public.packages(id) on delete cascade,
  content_type text not null check(length(trim(content_type))>0), quota integer not null check(quota>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(package_id,content_type)
);
create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete restrict,
  package_id uuid references public.packages(id) on delete set null, start_date date not null, end_date date,
  package_name_snapshot text not null check(length(trim(package_name_snapshot))>0), package_price_snapshot numeric(14,2) not null check(package_price_snapshot>=0),
  status text not null default 'active' check(status in ('active','paused','completed','cancelled')),
  created_by uuid not null references public.agency_members(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id,client_id), check(end_date is null or end_date>=start_date)
);
create table if not exists public.client_package_quotas (
  id uuid primary key default gen_random_uuid(), client_package_id uuid not null references public.client_packages(id) on delete cascade,
  content_type text not null check(length(trim(content_type))>0), quota integer not null check(quota>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(client_package_id,content_type)
);
create table if not exists public.content_pillars (
  id uuid primary key default gen_random_uuid(), client_id uuid not null references public.clients(id) on delete restrict,
  pillar_name text not null check(length(trim(pillar_name))>0), description text not null default '', status text not null default 'active' check(status in ('active','archived')),
  created_by uuid not null references public.agency_members(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,client_id)
);
alter table public.contents
  add column if not exists client_package_id uuid,
  add column if not exists pillar_id uuid,
  add column if not exists platform text,
  add column if not exists objective text,
  add column if not exists brief text,
  add column if not exists caption text,
  add column if not exists deleted_at timestamptz;
alter table public.contents drop constraint if exists contents_workflow_status_check;
alter table public.contents add constraint contents_workflow_status_check check(workflow_status in ('planned','idea','brief','in_production','production','review','internal_review','client_review','revision','approved','completed','published','cancelled'));
alter table public.contents add constraint contents_package_client_fkey foreign key(client_package_id,client_id) references public.client_packages(id,client_id) on delete set null (client_package_id);
alter table public.contents add constraint contents_pillar_client_fkey foreign key(pillar_id,client_id) references public.content_pillars(id,client_id) on delete set null (pillar_id);
create index if not exists contents_client_package_idx on public.contents(client_package_id);
create index if not exists contents_pillar_client_idx on public.contents(pillar_id,client_id);

create view public.client_package_quota_usage with (security_invoker=true) as
select q.client_package_id,q.content_type,q.quota,count(distinct c.id)::bigint as used
from public.client_package_quotas q
left join public.contents c on c.client_package_id=q.client_package_id and c.content_type=q.content_type
  and c.deleted_at is null
  and c.workflow_status in ('in_production','review','approved','production','internal_review','client_review','revision','completed','published')
group by q.client_package_id,q.content_type,q.quota;
grant select on public.client_package_quota_usage to authenticated;

create table if not exists public.content_creative_briefs (
  id uuid primary key default gen_random_uuid(), content_id uuid not null unique references public.contents(id) on delete cascade,
  creative_direction text not null default '', concept text not null default '', visual_reference jsonb not null default '[]'::jsonb,
  key_message text not null default '', production_notes text not null default '',
  created_by uuid not null references public.agency_members(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(jsonb_typeof(visual_reference)='array')
);
create table if not exists public.content_storyboards (
  id uuid primary key default gen_random_uuid(), content_id uuid not null references public.contents(id) on delete cascade,
  title text not null check(length(trim(title))>0), description text not null default '',
  created_by uuid not null references public.agency_members(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,content_id)
);
create table if not exists public.content_storyboard_rows (
  id uuid primary key default gen_random_uuid(), storyboard_id uuid not null references public.content_storyboards(id) on delete cascade,
  parent_row_id uuid, sequence_no integer not null check(sequence_no>=0), scene text not null default '', visual_description text not null default '',
  shot_type text not null default '', camera_movement text not null default '', audio text not null default '', dialogue text not null default '',
  duration_seconds numeric(8,2) check(duration_seconds is null or duration_seconds>0), notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,storyboard_id), unique(storyboard_id,sequence_no),
  foreign key(parent_row_id,storyboard_id) references public.content_storyboard_rows(id,storyboard_id) on delete cascade
);
create table if not exists public.content_approvals (
  id uuid primary key default gen_random_uuid(), content_id uuid not null references public.contents(id) on delete restrict,
  reviewer_id uuid not null references public.agency_members(id), approval_status text not null default 'pending' check(approval_status in ('pending','approved','revision_requested','rejected')),
  feedback text not null default '', submitted_at timestamptz not null default now(), reviewed_at timestamptz,
  created_by uuid not null references public.agency_members(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check((approval_status='pending' and reviewed_at is null) or (approval_status<>'pending' and reviewed_at is not null)),
  unique(id,content_id)
);
create table if not exists public.content_approval_history (
  id uuid primary key default gen_random_uuid(), approval_id uuid not null references public.content_approvals(id) on delete restrict,
  actor_id uuid references public.agency_members(id) on delete set null, old_status text not null, new_status text not null,
  old_feedback text not null, new_feedback text not null, created_at timestamptz not null default now()
);
create or replace function public.log_content_approval_history()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
  if new.approval_status is distinct from old.approval_status or new.feedback is distinct from old.feedback then
    insert into public.content_approval_history(approval_id,actor_id,old_status,new_status,old_feedback,new_feedback)
    values(old.id,(select auth.uid()),old.approval_status,new.approval_status,old.feedback,new.feedback);
  end if;
  return new;
end $$;
create or replace function public.guard_content_approval_update()
returns trigger language plpgsql set search_path=''
as $$ begin
  if new.content_id is distinct from old.content_id or new.reviewer_id is distinct from old.reviewer_id
     or new.created_by is distinct from old.created_by or new.submitted_at is distinct from old.submitted_at
     or new.created_at is distinct from old.created_at then
    raise exception 'approval_identity_is_immutable';
  end if;
  if old.approval_status<>'pending' then raise exception 'approval_already_reviewed'; end if;
  if new.approval_status not in ('approved','revision_requested','rejected') then raise exception 'invalid_approval_transition'; end if;
  if new.reviewed_at is null then new.reviewed_at:=now(); end if;
  new.updated_at:=now();
  return new;
end $$;
drop trigger if exists content_approvals_guard_update on public.content_approvals;
create trigger content_approvals_guard_update before update on public.content_approvals for each row execute function public.guard_content_approval_update();
revoke all on function public.guard_content_approval_update() from public,anon,authenticated;
create trigger content_approvals_history after update on public.content_approvals for each row execute function public.log_content_approval_history();
revoke all on function public.log_content_approval_history() from public,anon,authenticated;
create table if not exists public.content_revisions (
  id uuid primary key default gen_random_uuid(), content_id uuid not null references public.contents(id) on delete restrict,
  approval_id uuid, revision_number integer not null check(revision_number>0),
  revision_notes text not null, revised_by uuid not null references public.agency_members(id), created_at timestamptz not null default now(),
  unique(content_id,revision_number),
  foreign key(approval_id,content_id) references public.content_approvals(id,content_id) on delete set null (approval_id)
);

alter table public.tasks add column if not exists due_at timestamptz generated always as
  (case when due_date is null then null else ((due_date::timestamp + time '09:00') at time zone 'Asia/Jakarta') end) stored;
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check check(status in ('todo','in_progress','review','done','cancelled'));

create table if not exists public.task_activity_logs (
  id uuid primary key default gen_random_uuid(), task_id uuid not null references public.tasks(id) on delete cascade,
  actor_id uuid references public.agency_members(id) on delete set null, action text not null,
  old_value jsonb, new_value jsonb, created_at timestamptz not null default now()
);
create or replace function public.log_task_activity()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
  if tg_op='INSERT' then
    insert into public.task_activity_logs(task_id,actor_id,action,new_value) values(new.id,(select auth.uid()),'task_created',jsonb_build_object('title',new.title,'status',new.status,'assigned_to',new.assigned_to,'due_date',new.due_date));
    return new;
  end if;
  if new.status is distinct from old.status then insert into public.task_activity_logs(task_id,actor_id,action,old_value,new_value) values(new.id,(select auth.uid()),'status_changed',to_jsonb(old.status),to_jsonb(new.status)); end if;
  if new.assigned_to is distinct from old.assigned_to then insert into public.task_activity_logs(task_id,actor_id,action,old_value,new_value) values(new.id,(select auth.uid()),'assignee_changed',to_jsonb(old.assigned_to),to_jsonb(new.assigned_to)); end if;
  if new.due_date is distinct from old.due_date then insert into public.task_activity_logs(task_id,actor_id,action,old_value,new_value) values(new.id,(select auth.uid()),'deadline_changed',to_jsonb(old.due_date),to_jsonb(new.due_date)); end if;
  return new;
end $$;
create trigger tasks_log_insert after insert on public.tasks for each row execute function public.log_task_activity();
create trigger tasks_log_update after update of status,assigned_to,due_date on public.tasks for each row execute function public.log_task_activity();
revoke all on function public.log_task_activity() from public,anon,authenticated;

create table if not exists public.email_reminder_queue (
  id uuid primary key default gen_random_uuid(), reminder_id uuid not null unique references public.task_reminder_events(id) on delete cascade,
  recipient_email text not null, recipient_name text not null default '', email_subject text not null, email_body text not null,
  google_sheets_row_reference text, idempotency_key text not null unique,
  sync_status text not null default 'pending' check(sync_status in ('pending','syncing','synced','confirmation_required','failed','cancelled')),
  synced_at timestamptz, last_error text, attempt_count integer not null default 0 check(attempt_count>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.agency_billing_profiles (
  id uuid primary key default gen_random_uuid(), is_singleton boolean not null default true unique check(is_singleton),
  agency_name text not null default '', address text not null default '', email text not null default '', phone text not null default '',
  bank_name text not null default '', bank_account_number text not null default '', bank_account_holder text not null default '',
  logo_url text, authorized_signatory text not null default '', signatory_title text not null default '',
  default_payment_terms text not null default '', tax_configuration jsonb not null default '{}'::jsonb,
  created_by uuid references public.agency_members(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(jsonb_typeof(tax_configuration)='object')
);
alter table public.invoices
  add column if not exists client_package_id uuid,
  add column if not exists service_period_start date,
  add column if not exists service_period_end date,
  add column if not exists pdf_drive_file_id text,
  add column if not exists subtotal numeric(14,2) generated always as (nullif(totals_snapshot->>'subtotal','')::numeric) stored,
  add column if not exists discount_amount numeric(14,2) generated always as (coalesce(nullif(totals_snapshot->>'discount','')::numeric,0)) stored,
  add column if not exists tax_amount numeric(14,2) generated always as (coalesce(nullif(totals_snapshot->>'total','')::numeric,0)-greatest(coalesce(nullif(totals_snapshot->>'subtotal','')::numeric,0)-coalesce(nullif(totals_snapshot->>'discount','')::numeric,0),0)) stored,
  add column if not exists total_amount numeric(14,2) generated always as (nullif(totals_snapshot->>'total','')::numeric) stored,
  add column if not exists paid_amount numeric(14,2) generated always as (coalesce(nullif(payment_snapshot->>'amount_paid','')::numeric,0)) stored,
  add column if not exists remaining_amount numeric(14,2) generated always as (greatest(coalesce(nullif(totals_snapshot->>'total','')::numeric,0)-coalesce(nullif(payment_snapshot->>'amount_paid','')::numeric,0),0)) stored;
alter table public.invoices add constraint invoices_client_package_fkey foreign key(client_package_id,client_id) references public.client_packages(id,client_id) on delete set null (client_package_id);
alter table public.invoices add constraint invoices_service_period_order_check check(service_period_start is null or service_period_end is null or service_period_start<=service_period_end);
alter table public.invoice_items add column if not exists subtotal numeric(14,2) generated always as (round(quantity*unit_price,2)) stored;

create or replace function public.finalize_invoice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare i public.invoices%rowtype; c public.clients%rowtype; profile public.agency_billing_profiles%rowtype; total numeric(14,2); subtotal_value numeric(14,2); discount_value numeric(14,2); tax_value numeric(14,2);
begin
  if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
  select * into i from public.invoices where id=p_invoice_id for update;
  if not found or i.created_by<>(select auth.uid()) or i.status<>'draft' then raise exception 'draft_invoice_not_found'; end if;
  if not exists(select 1 from public.invoice_items where invoice_id=i.id) then raise exception 'invoice_items_required'; end if;
  select * into profile from public.agency_billing_profiles where is_singleton=true;
  if not found or length(trim(profile.agency_name))=0 or length(trim(profile.address))=0 or length(trim(profile.bank_name))=0 or length(trim(profile.bank_account_number))=0 or length(trim(profile.bank_account_holder))=0 then
    raise exception 'agency_billing_profile_incomplete';
  end if;
  select * into c from public.clients where id=i.client_id;
  select round(coalesce(sum(quantity*unit_price),0),2) into subtotal_value from public.invoice_items where invoice_id=i.id;
  discount_value:=least(i.discount,subtotal_value);
  tax_value:=round(greatest(0,subtotal_value-discount_value)*i.tax_rate,2);
  total:=round(greatest(0,subtotal_value-discount_value)+tax_value,2);
  update public.invoices set agency_snapshot=jsonb_build_object('agency_name',profile.agency_name,'address',profile.address,'email',profile.email,'phone',profile.phone,'bank_name',profile.bank_name,'bank_account_number',profile.bank_account_number,'bank_account_holder',profile.bank_account_holder,'logo_url',profile.logo_url,'authorized_signatory',profile.authorized_signatory,'signatory_title',profile.signatory_title,'payment_terms',profile.default_payment_terms),
    client_snapshot=jsonb_build_object('brand_name',c.brand_name,'client_name',c.client_name,'address',c.address,'email',c.email),
    totals_snapshot=jsonb_build_object('subtotal',subtotal_value,'discount',discount_value,'tax_rate',i.tax_rate,'tax_amount',tax_value,'total',total),
    payment_snapshot=jsonb_build_object('amount_paid',0,'remaining_amount',total),status='issued',issued_at=now(),updated_at=now()
  where id=i.id;
end $$;
revoke all on function public.finalize_invoice(uuid) from public,anon;
grant execute on function public.finalize_invoice(uuid) to authenticated;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(), recipient_user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null check(notification_type in ('task_created','task_assigned','task_updated','approval_requested','approval_reviewed','invoice_status')),
  title text not null, message text not null, reference_type text not null check(reference_type in ('task','content_approval','invoice')),
  reference_id uuid not null, deduplication_key text not null unique, is_read boolean not null default false, created_at timestamptz not null default now()
);
create or replace function public.notify_task_change()
returns trigger language plpgsql security definer set search_path=''
as $$ declare kind text; label text; key text; begin
  if tg_op='INSERT' then kind:='task_created';label:='Task assigned';key:='task:'||new.id::text||':created';
  else kind:=case when new.assigned_to is distinct from old.assigned_to then 'task_assigned' else 'task_updated' end;label:=case when kind='task_assigned' then 'Task assigned to you' else 'Task updated' end;key:='task:'||new.id::text||':'||new.updated_at::text||':'||kind; end if;
  if new.assigned_to is null then return new; end if;
  insert into public.notifications(recipient_user_id,notification_type,title,message,reference_type,reference_id,deduplication_key)
  values(new.assigned_to,kind,label,new.title,'task',new.id,key) on conflict(deduplication_key) do nothing;
  return new;
end $$;
create trigger tasks_notify_insert after insert on public.tasks for each row execute function public.notify_task_change();
create trigger tasks_notify_update after update of assigned_to,status,due_date on public.tasks for each row execute function public.notify_task_change();
revoke all on function public.notify_task_change() from public,anon,authenticated;
create or replace function public.notify_approval_change()
returns trigger language plpgsql security definer set search_path=''
as $$ declare recipient uuid; content_title text; kind text; label text; key text; begin
  select c.created_by,c.title into recipient,content_title from public.contents c where c.id=new.content_id;
  if tg_op='INSERT' then recipient:=new.reviewer_id;kind:='approval_requested';label:='Content review requested';key:='approval:'||new.id::text||':requested';
  else
    if new.approval_status is not distinct from old.approval_status then return new; end if;
    kind:='approval_reviewed';label:='Content review updated';key:='approval:'||new.id::text||':'||new.approval_status||':'||coalesce(new.reviewed_at::text,'');
  end if;
  if recipient is null then return new; end if;
  insert into public.notifications(recipient_user_id,notification_type,title,message,reference_type,reference_id,deduplication_key)
  values(recipient,kind,label,content_title||' — '||replace(new.approval_status,'_',' '),'content_approval',new.id,key) on conflict(deduplication_key) do nothing;
  return new;
end $$;
create trigger content_approvals_notify_insert after insert on public.content_approvals for each row execute function public.notify_approval_change();
create trigger content_approvals_notify_update after update of approval_status,feedback on public.content_approvals for each row execute function public.notify_approval_change();
revoke all on function public.notify_approval_change() from public,anon,authenticated;
create or replace function public.notify_invoice_status_change()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
  if new.status is distinct from old.status then
    insert into public.notifications(recipient_user_id,notification_type,title,message,reference_type,reference_id,deduplication_key)
    values(new.created_by,'invoice_status','Invoice status updated',new.invoice_number||' is now '||replace(new.status,'_',' '),'invoice',new.id,'invoice:'||new.id::text||':'||new.status||':'||new.updated_at::text)
    on conflict(deduplication_key) do nothing;
  end if;
  return new;
end $$;
create trigger invoices_notify_status after update of status on public.invoices for each row execute function public.notify_invoice_status_change();
revoke all on function public.notify_invoice_status_change() from public,anon,authenticated;

-- Categories already exist as document_categories; extend that table rather than duplicate it.
alter table public.document_categories add column if not exists description text not null default '';
alter table public.agency_documents
  add column if not exists drive_folder_id text,
  add column if not exists web_view_link text,
  add column if not exists storage_provider text not null default 'google_drive',
  add column if not exists updated_at timestamptz not null default now();
alter table public.agency_documents drop constraint if exists agency_documents_storage_provider_check;
alter table public.agency_documents add constraint agency_documents_storage_provider_check check(storage_provider in ('google_drive','supabase_storage'));

-- Read-only reporting view: one performance record per schedule measurement, with platform from its schedule.
create view public.content_performance with (security_invoker=true) as
select p.id,p.content_schedule_id,cs.content_id,p.client_id,cs.platform,p.measured_at as recorded_at,p.reach,p.impressions,p.views,
  p.likes,p.comments,p.shares,p.saves,
  case when p.reach>0 then round(100.0*(coalesce(p.likes,0)+coalesce(p.comments,0)+coalesce(p.shares,0)+coalesce(p.saves,0))/p.reach,2) else null end as engagement_rate_by_reach,
  p.measurement_label as source,p.evaluation_notes as evaluation,p.created_by,p.created_at,p.updated_at
from public.performances p join public.content_schedules cs on cs.id=p.content_schedule_id and cs.client_id=p.client_id;
revoke all on public.content_performance from public,anon;
grant select on public.content_performance to authenticated;

create index if not exists clients_created_by_idx on public.clients(created_by);
create index if not exists contents_created_by_idx on public.contents(created_by);
create index if not exists content_schedules_content_client_idx on public.content_schedules(content_id,client_id);
create index if not exists monthly_reports_client_period_idx on public.monthly_reports(client_id,period_start,period_end);
create index if not exists monthly_reports_created_by_idx on public.monthly_reports(created_by);
create index if not exists monthly_report_versions_finalized_by_idx on public.monthly_report_versions(finalized_by);
create index if not exists performances_schedule_client_idx on public.performances(content_schedule_id,client_id);
create index if not exists performances_created_by_idx on public.performances(created_by);
create index if not exists report_pdf_jobs_created_by_idx on public.report_pdf_jobs(created_by);
create index if not exists social_reports_client_period_idx on public.social_reports(client_id,period_start,period_end);
create index if not exists social_reports_created_by_idx on public.social_reports(created_by);
create index if not exists social_report_items_performance_schedule_client_idx on public.social_report_items(performance_id,content_schedule_id,client_id);
create index if not exists social_report_items_report_client_idx on public.social_report_items(social_report_id,client_id);
create index if not exists social_report_versions_finalized_by_idx on public.social_report_versions(finalized_by);
create index if not exists task_reminder_events_recipient_idx on public.task_reminder_events(recipient_member_id);
create index if not exists tasks_content_client_idx on public.tasks(content_id,client_id) where content_id is not null;
create index if not exists tasks_created_by_idx on public.tasks(created_by);
create index if not exists invoices_client_created_idx on public.invoices(client_id,created_at desc);
create index if not exists client_packages_client_period_idx on public.client_packages(client_id,start_date,end_date);
create index if not exists contents_status_client_idx on public.contents(client_id,workflow_status,created_at desc) where deleted_at is null;
create index if not exists content_schedules_upcoming_idx on public.content_schedules(scheduled_at) where publication_status='scheduled';
create index if not exists task_activity_logs_task_created_idx on public.task_activity_logs(task_id,created_at desc);
create index if not exists email_reminder_queue_sync_idx on public.email_reminder_queue(sync_status,created_at) where sync_status in ('pending','failed');
create index if not exists notifications_recipient_unread_idx on public.notifications(recipient_user_id,created_at desc) where not is_read;
create index if not exists content_approvals_reviewer_status_idx on public.content_approvals(reviewer_id,approval_status,submitted_at desc);
create index if not exists content_revisions_content_created_idx on public.content_revisions(content_id,created_at desc);

do $$ declare t text; begin
  foreach t in array array[
    'client_briefs','client_brief_versions','packages','package_content_quotas','client_packages','client_package_quotas',
    'content_pillars','content_creative_briefs','content_storyboards','content_storyboard_rows','content_approvals','content_approval_history','content_revisions',
    'task_activity_logs','email_reminder_queue','agency_billing_profiles','notifications'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon',t);
  end loop;
end $$;

do $$ declare t text; begin
  foreach t in array array['client_briefs','packages','package_content_quotas','client_packages','client_package_quotas','content_pillars','content_creative_briefs','content_storyboards','content_storyboard_rows','content_approvals'] loop
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.is_active_agency_member())) with check ((select public.is_active_agency_member()))',t||'_active_members_all',t);
  end loop;
end $$;
drop policy if exists content_approvals_active_members_all on public.content_approvals;
create policy content_approvals_active_read on public.content_approvals for select to authenticated using((select public.is_active_agency_member()));
create policy content_approvals_request on public.content_approvals for insert to authenticated with check((select public.is_active_agency_member()) and created_by=(select auth.uid()) and approval_status='pending' and exists(select 1 from public.agency_members m where m.id=reviewer_id and m.is_active));
create policy content_approvals_review on public.content_approvals for update to authenticated using((select public.is_active_agency_member()) and reviewer_id=(select auth.uid()) and approval_status='pending') with check((select public.is_active_agency_member()) and reviewer_id=(select auth.uid()));
revoke delete on public.content_approvals from authenticated;
grant select on public.content_approval_history to authenticated;
create policy content_approval_history_active_read on public.content_approval_history for select to authenticated using((select public.is_active_agency_member()));
revoke insert,update,delete on public.content_approval_history from authenticated;
grant select on public.client_brief_versions to authenticated;
create policy client_brief_versions_active_read on public.client_brief_versions for select to authenticated using ((select public.is_active_agency_member()));
revoke insert,update,delete on public.client_brief_versions from authenticated;
revoke delete on public.client_briefs from authenticated;

grant select,insert on public.content_revisions to authenticated;
create policy content_revisions_active_read on public.content_revisions for select to authenticated using ((select public.is_active_agency_member()));
create policy content_revisions_active_insert on public.content_revisions for insert to authenticated with check ((select public.is_active_agency_member()) and revised_by=(select auth.uid()));

grant select on public.task_activity_logs to authenticated;
create policy task_activity_logs_active_read on public.task_activity_logs for select to authenticated using ((select public.is_active_agency_member()));
revoke insert,update,delete on public.task_activity_logs from authenticated;
grant select,insert,update,delete on public.task_activity_logs to service_role;

grant select on public.email_reminder_queue to authenticated;
create policy email_reminder_queue_active_read on public.email_reminder_queue for select to authenticated using ((select public.is_active_agency_member()));
revoke insert,update,delete on public.email_reminder_queue from authenticated;
grant select,insert,update,delete on public.email_reminder_queue to service_role;

grant select,insert,update on public.agency_billing_profiles to authenticated;
create policy agency_billing_profiles_active_read on public.agency_billing_profiles for select to authenticated using ((select public.is_active_agency_member()));
create policy agency_billing_profiles_manager_insert on public.agency_billing_profiles for insert to authenticated with check ((select public.can_manage_agency_members()));
create policy agency_billing_profiles_manager_update on public.agency_billing_profiles for update to authenticated using ((select public.can_manage_agency_members())) with check ((select public.can_manage_agency_members()));
revoke delete on public.agency_billing_profiles from authenticated;

grant select,update(is_read) on public.notifications to authenticated;
create policy notifications_read_own on public.notifications for select to authenticated using(recipient_user_id=(select auth.uid()) and (select public.is_active_agency_member()));
create policy notifications_mark_own_read on public.notifications for update to authenticated using(recipient_user_id=(select auth.uid()) and (select public.is_active_agency_member())) with check(recipient_user_id=(select auth.uid()) and (select public.is_active_agency_member()));
revoke insert,delete on public.notifications from authenticated;
grant select,insert,update,delete on public.notifications to service_role;

revoke all on function public.notify_task_change() from public,anon,authenticated;
revoke all on function public.notify_approval_change() from public,anon,authenticated;
revoke all on function public.notify_invoice_status_change() from public,anon,authenticated;

-- All new mutable records receive consistent timestamps. Triggered history/queue tables stay append-only.
do $$ declare t text; begin
  foreach t in array array['client_briefs','packages','package_content_quotas','client_packages','client_package_quotas','content_pillars','content_creative_briefs','content_storyboards','content_storyboard_rows','content_approvals','agency_billing_profiles','agency_documents','email_reminder_queue'] loop
    execute format('drop trigger if exists %I on public.%I',t||'_set_updated_at',t);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()',t||'_set_updated_at',t);
  end loop;
end $$;
