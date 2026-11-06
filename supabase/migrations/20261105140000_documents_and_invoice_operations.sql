-- Additive document metadata, invoice transaction helpers, history, and PDF queue support.
alter table public.agency_documents
  add column if not exists description text not null default '',
  add column if not exists archived_by uuid references public.agency_members(id) on delete set null;
alter table public.document_categories
  add column if not exists drive_folder_id text;

create table if not exists public.agency_document_upload_orphans (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  drive_folder_id text,
  file_name text not null,
  category_id text not null,
  uploaded_by uuid not null references public.agency_members(id) on delete restrict,
  metadata_error text not null,
  drive_deleted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.agency_document_upload_orphans enable row level security;
revoke all on public.agency_document_upload_orphans from anon, authenticated;
grant all on public.agency_document_upload_orphans to service_role;

create table if not exists public.agency_document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.agency_documents(id) on delete cascade,
  event_type text not null check (event_type in ('uploaded','metadata_updated','archived','restored')),
  actor_id uuid references public.agency_members(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists agency_document_events_document_idx on public.agency_document_events(document_id, created_at desc);
alter table public.agency_document_events enable row level security;
grant select on public.agency_document_events to authenticated;
drop policy if exists agency_document_events_active_read on public.agency_document_events;
create policy agency_document_events_active_read on public.agency_document_events for select to authenticated
  using ((select public.is_active_agency_member()));

create or replace function public.update_agency_document_metadata(
  p_document_id uuid, p_name text, p_description text, p_client_id uuid, p_invoice_id uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare actual_client uuid;
begin
  if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 255 or length(coalesce(p_description,''))>2000 then raise exception 'invalid_document_metadata'; end if;
  if p_invoice_id is not null then
    select client_id into actual_client from public.invoices where id=p_invoice_id;
    if not found or (p_client_id is not null and p_client_id is distinct from actual_client) then raise exception 'invoice_client_mismatch'; end if;
    p_client_id := actual_client;
  elsif p_client_id is not null and not exists(select 1 from public.clients where id=p_client_id) then
    raise exception 'client_not_found';
  end if;
  update public.agency_documents set name=trim(p_name),description=coalesce(p_description,''),client_id=p_client_id,invoice_id=p_invoice_id,updated_at=now()
    where id=p_document_id;
  if not found then raise exception 'document_not_found'; end if;
end
$$;
revoke all on function public.update_agency_document_metadata(uuid,text,text,uuid,uuid) from public, anon;
grant execute on function public.update_agency_document_metadata(uuid,text,text,uuid,uuid) to authenticated;

create or replace function public.log_agency_document_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.agency_document_events(document_id,event_type,actor_id,details)
    values(new.id,'uploaded',new.uploaded_by,jsonb_build_object('name',new.name,'category_id',new.category_id));
  elsif old.archived_at is null and new.archived_at is not null then
    insert into public.agency_document_events(document_id,event_type,actor_id)
    values(new.id,'archived',new.archived_by);
  elsif old.archived_at is not null and new.archived_at is null then
    insert into public.agency_document_events(document_id,event_type,actor_id)
    values(new.id,'restored',(select auth.uid()));
  elsif (new.name,new.category_id,new.client_id,new.invoice_id,new.description)
        is distinct from (old.name,old.category_id,old.client_id,old.invoice_id,old.description) then
    insert into public.agency_document_events(document_id,event_type,actor_id,details)
    values(new.id,'metadata_updated',(select auth.uid()),jsonb_build_object('name',new.name,'category_id',new.category_id));
  end if;
  return new;
end
$$;
revoke all on function public.log_agency_document_event() from public, anon, authenticated;
drop trigger if exists agency_documents_event_log on public.agency_documents;
create trigger agency_documents_event_log after insert or update on public.agency_documents
  for each row execute function public.log_agency_document_event();

create or replace function public.set_agency_document_archive(p_document_id uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
  update public.agency_documents
     set archived_at = case when p_archived then now() else null end,
         archived_by = case when p_archived then (select auth.uid()) else null end,
         updated_at = now()
   where id = p_document_id and ((p_archived and archived_at is null) or (not p_archived and archived_at is not null));
  if not found then raise exception 'document_not_found_or_unchanged'; end if;
end
$$;
revoke all on function public.set_agency_document_archive(uuid,boolean) from public, anon;
grant execute on function public.set_agency_document_archive(uuid,boolean) to authenticated;

create table if not exists public.invoice_activity_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  event_type text not null check (event_type in ('created','issued','payment_recorded','cancelled')),
  actor_id uuid references public.agency_members(id) on delete set null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.invoices add column if not exists supersedes_invoice_id uuid references public.invoices(id) on delete set null;
alter table public.invoices add column if not exists package_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(package_snapshot) = 'object');
alter table public.invoice_activity_events drop constraint if exists invoice_activity_events_event_type_check;
alter table public.invoice_activity_events add constraint invoice_activity_events_event_type_check check (event_type in ('created','issued','payment_recorded','cancelled','revision_created'));
create index if not exists invoice_activity_events_invoice_idx on public.invoice_activity_events(invoice_id, created_at desc);
alter table public.invoice_activity_events enable row level security;
grant select on public.invoice_activity_events to authenticated;
drop policy if exists invoice_activity_events_active_read on public.invoice_activity_events;
create policy invoice_activity_events_active_read on public.invoice_activity_events for select to authenticated
  using ((select public.is_active_agency_member()));

create or replace function public.log_invoice_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'invoice_payments' then
    insert into public.invoice_activity_events(invoice_id,event_type,actor_id,details)
    values(new.invoice_id,'payment_recorded',new.recorded_by,jsonb_build_object('payment_id',new.id,'amount',new.amount,'method',new.method));
  elsif tg_op = 'INSERT' then
    insert into public.invoice_activity_events(invoice_id,event_type,actor_id,details)
    values(new.id,'created',new.created_by,jsonb_build_object('invoice_number',new.invoice_number));
  elsif new.status is distinct from old.status then
    insert into public.invoice_activity_events(invoice_id,event_type,actor_id,details)
    values(new.id,case new.status when 'issued' then 'issued' when 'cancelled' then 'cancelled' else 'created' end,(select auth.uid()),jsonb_build_object('from',old.status,'to',new.status));
  end if;
  return new;
end
$$;
revoke all on function public.log_invoice_activity() from public, anon, authenticated;
drop trigger if exists invoices_activity_insert on public.invoices;
drop trigger if exists invoices_activity_status on public.invoices;
drop trigger if exists invoice_payments_activity_insert on public.invoice_payments;
create trigger invoices_activity_insert after insert on public.invoices for each row execute function public.log_invoice_activity();
create trigger invoices_activity_status after update of status on public.invoices for each row execute function public.log_invoice_activity();
create trigger invoice_payments_activity_insert after insert on public.invoice_payments for each row execute function public.log_invoice_activity();

create or replace function public.snapshot_invoice_on_issue()
returns trigger language plpgsql security definer set search_path = '' as $$
declare next_version integer;
begin
  if old.status = 'draft' and new.status = 'issued' then
    select coalesce(max(version),0)+1 into next_version from public.invoice_revisions where invoice_id = new.id;
    insert into public.invoice_revisions(invoice_id,version,snapshot,created_by)
    values(new.id,next_version,jsonb_build_object(
      'invoice',to_jsonb(new),
      'items',(select coalesce(jsonb_agg(to_jsonb(i) order by i.sort_order), '[]'::jsonb) from public.invoice_items i where i.invoice_id=new.id),
      'snapshot_taken_at',now()
    ),(select auth.uid()));
  end if;
  return new;
end
$$;
revoke all on function public.snapshot_invoice_on_issue() from public, anon, authenticated;
drop trigger if exists invoices_snapshot_on_issue on public.invoices;
create trigger invoices_snapshot_on_issue after update of status on public.invoices for each row execute function public.snapshot_invoice_on_issue();

create or replace function public.finalize_invoice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.invoices%rowtype; c public.clients%rowtype; profile public.agency_billing_profiles%rowtype;
  subtotal_value numeric(14,2); discount_value numeric(14,2); tax_value numeric(14,2); total_value numeric(14,2); package_value jsonb;
begin
  if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
  select * into i from public.invoices where id=p_invoice_id and created_by=(select auth.uid()) for update;
  if not found or i.status<>'draft' then raise exception 'draft_invoice_not_found'; end if;
  if not exists(select 1 from public.invoice_items where invoice_id=i.id) then raise exception 'invoice_items_required'; end if;
  select * into profile from public.agency_billing_profiles where is_singleton=true;
  if not found or length(trim(profile.agency_name))=0 or length(trim(profile.address))=0 or length(trim(profile.bank_name))=0 or length(trim(profile.bank_account_number))=0 or length(trim(profile.bank_account_holder))=0 then raise exception 'agency_billing_profile_incomplete'; end if;
  if i.tax_rate>0 and (not coalesce((profile.tax_configuration->>'enabled')::boolean,false) or (profile.tax_configuration->>'rate')::numeric is distinct from i.tax_rate) then raise exception 'invoice_tax_not_configured'; end if;
  select * into c from public.clients where id=i.client_id;
  if not found then raise exception 'invoice_client_not_found'; end if;
  if i.client_package_id is not null then
    select jsonb_build_object('id',p.id,'package_name',p.package_name_snapshot,'description',p.package_description_snapshot,'price',p.package_price_snapshot,'start_date',p.start_date,'end_date',p.end_date,
      'content_quotas',(select coalesce(jsonb_agg(jsonb_build_object('content_type',q.content_type,'quota',q.quota) order by q.content_type),'[]'::jsonb) from public.client_package_quotas q where q.client_package_id=p.id))
      into package_value from public.client_packages p where p.id=i.client_package_id and p.client_id=i.client_id;
    if package_value is null then raise exception 'invoice_package_client_mismatch'; end if;
  end if;
  select round(coalesce(sum(quantity*unit_price),0),2) into subtotal_value from public.invoice_items where invoice_id=i.id;
  discount_value:=least(i.discount,subtotal_value); tax_value:=round(greatest(0,subtotal_value-discount_value)*i.tax_rate,2); total_value:=round(greatest(0,subtotal_value-discount_value)+tax_value,2);
  update public.invoices set
    agency_snapshot=jsonb_build_object('agency_name',profile.agency_name,'address',profile.address,'email',profile.email,'phone',profile.phone,'bank_name',profile.bank_name,'bank_account_number',profile.bank_account_number,'bank_account_holder',profile.bank_account_holder,'logo_url',profile.logo_url,'authorized_signatory',profile.authorized_signatory,'signatory_title',profile.signatory_title,'payment_terms',profile.default_payment_terms,'tax_configuration',profile.tax_configuration),
    client_snapshot=jsonb_build_object('id',c.id,'client_name',c.client_name,'brand_name',c.brand_name,'contact_person',c.contact_person,'email',c.email,'phone',c.phone,'address',c.address,'industry',c.industry),
    package_snapshot=coalesce(package_value,'{}'::jsonb),
    totals_snapshot=jsonb_build_object('subtotal',subtotal_value,'discount',discount_value,'tax_rate',i.tax_rate,'tax_amount',tax_value,'total',total_value),
    payment_snapshot=jsonb_build_object('bank_name',profile.bank_name,'bank_account_number',profile.bank_account_number,'bank_account_holder',profile.bank_account_holder,'payment_terms',profile.default_payment_terms,'amount_paid',0,'remaining_amount',total_value),
    status='issued',issued_at=now(),updated_at=now()
  where id=i.id;
end
$$;
revoke all on function public.finalize_invoice(uuid) from public, anon;
grant execute on function public.finalize_invoice(uuid) to authenticated;

create or replace function public.create_invoice_revision(p_invoice_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare source public.invoices%rowtype; new_id uuid; new_number text; next_version integer; line public.invoice_items%rowtype;
begin
  if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
  if length(trim(coalesce(p_reason,''))) not between 1 and 500 then raise exception 'revision_reason_required'; end if;
  select * into source from public.invoices where id=p_invoice_id and created_by=(select auth.uid()) and status in ('issued','overdue') for update;
  if not found or exists(select 1 from public.invoice_payments where invoice_id=p_invoice_id) then raise exception 'invoice_cannot_be_revised'; end if;
  select public.allocate_invoice_number() into new_number;
  update public.invoices set status='cancelled',updated_at=now() where id=source.id;
  insert into public.invoices(invoice_number,client_id,client_package_id,service_period_start,service_period_end,invoice_date,due_date,service_period,discount,tax_rate,notes,created_by,supersedes_invoice_id)
  values(new_number,source.client_id,source.client_package_id,source.service_period_start,source.service_period_end,source.invoice_date,source.due_date,source.service_period,source.discount,source.tax_rate,source.notes,(select auth.uid()),source.id)
  returning id into new_id;
  for line in select * from public.invoice_items where invoice_id=source.id order by sort_order loop
    insert into public.invoice_items(invoice_id,description,quantity,unit_price,sort_order) values(new_id,line.description,line.quantity,line.unit_price,line.sort_order);
  end loop;
  select coalesce(max(version),0)+1 into next_version from public.invoice_revisions where invoice_id=source.id;
  insert into public.invoice_revisions(invoice_id,version,snapshot,created_by)
  values(source.id,next_version,jsonb_build_object('revision_reason',trim(p_reason),'revision_invoice_id',new_id,'source_snapshot',jsonb_build_object('agency',source.agency_snapshot,'client',source.client_snapshot,'totals',source.totals_snapshot,'payment',source.payment_snapshot),'created_at',now()),(select auth.uid()));
  insert into public.invoice_activity_events(invoice_id,event_type,actor_id,details)
  values(source.id,'revision_created',(select auth.uid()),jsonb_build_object('revision_invoice_id',new_id,'revision_invoice_number',new_number,'reason',trim(p_reason)));
  return new_id;
end
$$;
revoke all on function public.create_invoice_revision(uuid,text) from public, anon;
grant execute on function public.create_invoice_revision(uuid,text) to authenticated;

create or replace function public.save_invoice_draft(
  p_invoice_id uuid,
  p_client_id uuid,
  p_client_package_id uuid,
  p_invoice_date date,
  p_due_date date,
  p_service_period text,
  p_service_period_start date,
  p_service_period_end date,
  p_discount numeric,
  p_tax_rate numeric,
  p_notes text,
  p_items jsonb
) returns table(out_invoice_id uuid, out_invoice_number text)
language plpgsql security definer set search_path = '' as $$
declare current_invoice public.invoices%rowtype; allocated_number text; item jsonb; item_description text; item_quantity numeric; item_price numeric; item_order integer := 0;
begin
  if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
  if p_client_id is null or not exists(select 1 from public.clients where id=p_client_id and status <> 'archived') then raise exception 'client_not_available'; end if;
  if p_due_date < p_invoice_date or (p_service_period_start is not null and p_service_period_end is not null and p_service_period_start > p_service_period_end) then raise exception 'invalid_invoice_period'; end if;
  if p_discount < 0 or p_tax_rate < 0 or p_tax_rate > 1 or p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception 'invalid_invoice_values'; end if;
  if p_client_package_id is not null and not exists(select 1 from public.client_packages where id=p_client_package_id and client_id=p_client_id) then raise exception 'package_client_mismatch'; end if;
  if p_invoice_id is null then
    select public.allocate_invoice_number() into allocated_number;
    insert into public.invoices(invoice_number,client_id,client_package_id,invoice_date,due_date,service_period,service_period_start,service_period_end,discount,tax_rate,notes,created_by)
    values(allocated_number,p_client_id,p_client_package_id,p_invoice_date,p_due_date,coalesce(p_service_period,''),p_service_period_start,p_service_period_end,p_discount,p_tax_rate,coalesce(p_notes,''),(select auth.uid()))
    returning id into out_invoice_id;
  else
    select * into current_invoice from public.invoices where id=p_invoice_id and created_by=(select auth.uid()) and status='draft' for update;
    if not found then raise exception 'editable_draft_invoice_not_found'; end if;
    update public.invoices set client_id=p_client_id,client_package_id=p_client_package_id,invoice_date=p_invoice_date,due_date=p_due_date,service_period=coalesce(p_service_period,''),service_period_start=p_service_period_start,service_period_end=p_service_period_end,discount=p_discount,tax_rate=p_tax_rate,notes=coalesce(p_notes,''),updated_at=now()
      where id=p_invoice_id returning id,invoice_number into out_invoice_id,allocated_number;
    delete from public.invoice_items where invoice_id=out_invoice_id;
  end if;
  if allocated_number is null then select invoice_number into allocated_number from public.invoices where id=out_invoice_id; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    item_description := nullif(trim(item->>'description'),'');
    item_quantity := (item->>'quantity')::numeric;
    item_price := (item->>'unit_price')::numeric;
    if item_description is null or length(item_description)>500 or item_quantity<=0 or item_quantity>100000 or item_price<0 or item_price>1000000000000 then raise exception 'invalid_invoice_item'; end if;
    insert into public.invoice_items(invoice_id,description,quantity,unit_price,sort_order)
    values(out_invoice_id,item_description,item_quantity,item_price,item_order);
    item_order := item_order+1;
  end loop;
  out_invoice_number := allocated_number;
  return next;
end
$$;
revoke all on function public.save_invoice_draft(uuid,uuid,uuid,date,date,text,date,date,numeric,numeric,text,jsonb) from public, anon;
grant execute on function public.save_invoice_draft(uuid,uuid,uuid,date,date,text,date,date,numeric,numeric,text,jsonb) to authenticated;

create or replace function public.record_invoice_payment(
  p_invoice_id uuid, p_paid_at date, p_amount numeric, p_method text, p_notes text, p_proof_document_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare i public.invoices%rowtype; payment_id uuid; remaining numeric;
begin
  if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
  select * into i from public.invoices where id=p_invoice_id for update;
  if not found or i.status not in ('issued','partially_paid','overdue') then raise exception 'invoice_not_payable'; end if;
  remaining := greatest(0,coalesce((i.totals_snapshot->>'total')::numeric,0)-coalesce((i.payment_snapshot->>'amount_paid')::numeric,0));
  if p_amount is null or p_amount<=0 or p_amount>remaining or length(trim(coalesce(p_method,''))) not between 1 and 80 then raise exception 'invalid_payment_amount_or_method'; end if;
  if p_proof_document_id is not null and not exists(select 1 from public.agency_documents where id=p_proof_document_id and invoice_id=p_invoice_id and archived_at is null) then raise exception 'payment_proof_mismatch'; end if;
  insert into public.invoice_payments(invoice_id,paid_at,amount,method,notes,proof_document_id,recorded_by)
    values(p_invoice_id,p_paid_at,p_amount,trim(p_method),coalesce(p_notes,''),p_proof_document_id,(select auth.uid())) returning id into payment_id;
  return payment_id;
end
$$;
revoke all on function public.record_invoice_payment(uuid,date,numeric,text,text,uuid) from public, anon;
grant execute on function public.record_invoice_payment(uuid,date,numeric,text,text,uuid) to authenticated;

create or replace function public.cancel_invoice(p_invoice_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.invoices%rowtype;
begin
  if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
  select * into i from public.invoices where id=p_invoice_id and created_by=(select auth.uid()) for update;
  if not found or i.status not in ('draft','issued','overdue') then raise exception 'invoice_cannot_be_cancelled'; end if;
  if exists(select 1 from public.invoice_payments where invoice_id=p_invoice_id) then raise exception 'invoice_with_payments_cannot_be_cancelled'; end if;
  if i.status='draft' then raise exception 'delete_draft_instead'; end if;
  update public.invoices set status='cancelled',updated_at=now() where id=p_invoice_id;
  insert into public.invoice_activity_events(invoice_id,event_type,actor_id,details)
    values(p_invoice_id,'cancelled',(select auth.uid()),jsonb_build_object('reason',left(trim(coalesce(p_reason,'')),500)));
end
$$;
revoke all on function public.cancel_invoice(uuid,text) from public, anon;
grant execute on function public.cancel_invoice(uuid,text) to authenticated;

alter table public.report_pdf_jobs add column if not exists invoice_id uuid references public.invoices(id) on delete restrict;
alter table public.report_pdf_jobs drop constraint if exists report_pdf_jobs_check;
alter table public.report_pdf_jobs drop constraint if exists report_pdf_jobs_report_type_check;
alter table public.report_pdf_jobs drop constraint if exists report_pdf_jobs_entity_check;
alter table public.report_pdf_jobs add constraint report_pdf_jobs_entity_check check (
  (report_type='monthly' and monthly_report_version_id is not null and social_report_version_id is null and invoice_id is null) or
  (report_type='social' and social_report_version_id is not null and monthly_report_version_id is null and invoice_id is null) or
  (report_type='invoice' and invoice_id is not null and monthly_report_version_id is null and social_report_version_id is null)
);
create unique index if not exists report_pdf_jobs_invoice_unique on public.report_pdf_jobs(invoice_id) where invoice_id is not null;
create index if not exists agency_documents_archived_uploaded_idx on public.agency_documents(archived_at,uploaded_at desc);
