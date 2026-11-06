create table if not exists public.document_categories (
  id text primary key,
  label text not null unique,
  sort_order integer not null unique
);
insert into public.document_categories(id,label,sort_order) values
 ('invoices','Invoices & Payment Proofs',1),('legal','Contracts & Legal',2),('sales','Proposals & Sales',3),
 ('finance','Finance & Planning',4),('operations','Company & Operations',5),('clients','Client Documents',6),
 ('reports','Reports & Deliverables',7),('archive','Archive',8) on conflict(id) do nothing;

create table if not exists public.agency_documents (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 255),
 category_id text not null references public.document_categories(id), client_id uuid references public.clients(id) on delete set null,
 drive_file_id text, mime_type text not null, size_bytes bigint not null check(size_bytes between 0 and 4194304),
 uploaded_by uuid not null references public.agency_members(id), uploaded_at timestamptz not null default now(),
 archived_at timestamptz, invoice_id uuid, created_at timestamptz not null default now()
);
create index if not exists agency_documents_search_idx on public.agency_documents using gin(to_tsvector('simple',name));
create index if not exists agency_documents_client_idx on public.agency_documents(client_id,uploaded_at desc);

create table if not exists public.invoice_number_sequences (
 sequence_key text primary key, next_value bigint not null check(next_value > 0), prefix text not null default 'BABE/INV/', updated_at timestamptz not null default now()
);
insert into public.invoice_number_sequences(sequence_key,next_value) values('default',1) on conflict do nothing;

create table if not exists public.invoices (
 id uuid primary key default gen_random_uuid(), invoice_number text not null unique, client_id uuid not null references public.clients(id) on delete restrict,
 status text not null default 'draft' check(status in ('draft','issued','partially_paid','paid','overdue','cancelled')),
 invoice_date date not null, due_date date not null, service_period text not null default '', agency_snapshot jsonb not null default '{}'::jsonb,
 client_snapshot jsonb not null default '{}'::jsonb, totals_snapshot jsonb not null default '{}'::jsonb,
 payment_snapshot jsonb not null default '{}'::jsonb, template_version integer not null default 1,
 discount numeric(14,2) not null default 0 check(discount>=0), tax_rate numeric(7,4) not null default 0 check(tax_rate between 0 and 1),
 notes text not null default '', created_by uuid not null references public.agency_members(id), issued_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(due_date>=invoice_date)
);
create table if not exists public.invoice_items (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete cascade,
 description text not null check(length(trim(description)) between 1 and 500), quantity numeric(12,2) not null check(quantity>0),
 unit_price numeric(14,2) not null check(unit_price>=0), sort_order integer not null default 0
);
create table if not exists public.invoice_payments (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete restrict,
 paid_at date not null, amount numeric(14,2) not null check(amount>0), method text not null check(length(trim(method)) between 1 and 80),
 notes text not null default '', proof_document_id uuid references public.agency_documents(id) on delete set null,
 recorded_by uuid not null references public.agency_members(id), created_at timestamptz not null default now()
);
create index if not exists invoice_payments_invoice_paid_idx on public.invoice_payments(invoice_id, paid_at desc);
create index if not exists invoices_status_due_idx on public.invoices(status, due_date);
create table if not exists public.invoice_revisions (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null references public.invoices(id) on delete restrict,
 version integer not null check(version>0), snapshot jsonb not null, created_by uuid not null references public.agency_members(id),
 created_at timestamptz not null default now(), unique(invoice_id,version)
);
alter table public.agency_documents add constraint agency_documents_invoice_fk foreign key(invoice_id) references public.invoices(id) on delete set null;

create or replace function public.allocate_invoice_number()
returns text language plpgsql security definer set search_path='' as $$
declare s public.invoice_number_sequences%rowtype; n text;
begin
 if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
 update public.invoice_number_sequences set next_value=next_value+1,updated_at=now() where sequence_key='default' returning * into s;
 n:=s.prefix||lpad((s.next_value-1)::text,3,'0'); return n;
end $$;
revoke all on function public.allocate_invoice_number() from public,anon;
grant execute on function public.allocate_invoice_number() to authenticated;

create or replace function public.finalize_invoice(p_invoice_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare i public.invoices%rowtype; c public.clients%rowtype; agency jsonb; total numeric(14,2);
begin
 if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
 select * into i from public.invoices where id=p_invoice_id for update;
 if not found or i.created_by<>(select auth.uid()) or i.status<>'draft' then raise exception 'draft_invoice_not_found'; end if;
 if not exists(select 1 from public.invoice_items where invoice_id=i.id) then raise exception 'invoice_items_required'; end if;
 select * into c from public.clients where id=i.client_id;
 select jsonb_build_object('name',agency_name,'address',coalesce((select value from public.agency_settings cross join lateral jsonb_each_text(to_jsonb(agency_settings)) where key='address' limit 1),'')) into agency from public.agency_settings limit 1;
 select round(greatest(0,sum(quantity*unit_price)-i.discount)*(1+i.tax_rate),2) into total from public.invoice_items where invoice_id=i.id;
 update public.invoices set agency_snapshot=coalesce(agency,'{}'),client_snapshot=jsonb_build_object('brand_name',c.brand_name),totals_snapshot=jsonb_build_object('subtotal',(select sum(quantity*unit_price) from public.invoice_items where invoice_id=i.id),'discount',i.discount,'tax_rate',i.tax_rate,'total',total),payment_snapshot='{}',status='issued',issued_at=now(),updated_at=now() where id=i.id;
end $$;
revoke all on function public.finalize_invoice(uuid) from public,anon;
grant execute on function public.finalize_invoice(uuid) to authenticated;

create or replace function public.guard_issued_invoice()
returns trigger language plpgsql set search_path='' as $$ begin
 if old.status<>'draft' and (new.client_id,new.invoice_number,new.invoice_date,new.due_date,new.service_period,new.discount,new.tax_rate,new.notes,new.agency_snapshot,new.client_snapshot,new.totals_snapshot) is distinct from (old.client_id,old.invoice_number,old.invoice_date,old.due_date,old.service_period,old.discount,old.tax_rate,old.notes,old.agency_snapshot,old.client_snapshot,old.totals_snapshot) then raise exception 'issued_invoice_is_immutable'; end if;
 return new; end $$;
create trigger invoices_guard_update before update on public.invoices for each row execute function public.guard_issued_invoice();
create or replace function public.update_invoice_payment_status()
returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid; total_due numeric; paid numeric; due date; current_status text;
begin
 target:=case when tg_op='DELETE' then old.invoice_id else new.invoice_id end;
 select (totals_snapshot->>'total')::numeric,due_date,status into total_due,due,current_status
 from public.invoices where id=target for update;
 if not found then raise exception 'invoice_not_found'; end if;
 select coalesce(sum(amount),0) into paid from public.invoice_payments where invoice_id=target;
 if paid>coalesce(total_due,0) then raise exception 'payment_exceeds_invoice_balance'; end if;
 if current_status not in ('draft','cancelled') then
   update public.invoices set
     payment_snapshot=jsonb_build_object('amount_paid',paid,'last_paid_at',(select max(paid_at) from public.invoice_payments where invoice_id=target)),
     status=case when paid>=total_due then 'paid' when paid>0 then 'partially_paid' when due<current_date then 'overdue' else 'issued' end,
     updated_at=now()
   where id=target;
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
create trigger invoice_payments_status after insert or update or delete on public.invoice_payments for each row execute function public.update_invoice_payment_status();

do $$ declare t text; begin foreach t in array array['document_categories','agency_documents','invoice_number_sequences','invoices','invoice_items','invoice_payments','invoice_revisions'] loop
 execute format('alter table public.%I enable row level security',t); execute format('revoke all on public.%I from anon',t);
 execute format('grant select,insert,update,delete on public.%I to authenticated',t);
 execute format('create policy %I on public.%I for all to authenticated using ((select public.is_active_agency_member())) with check ((select public.is_active_agency_member()))',t||'_active_members_all',t);
end loop; end $$;
-- Only the authenticated server upload route may register a Drive file ID.
drop policy if exists agency_documents_active_members_all on public.agency_documents;
create policy agency_documents_read_active_members on public.agency_documents for select to authenticated using ((select public.is_active_agency_member()));
revoke insert,update,delete on public.agency_documents from authenticated;
-- Financial snapshots are write-protected after issuance; payments are an append-only ledger.
drop policy if exists invoices_active_members_all on public.invoices;
create policy invoices_read_active_members on public.invoices for select to authenticated using ((select public.is_active_agency_member()));
create policy invoices_insert_own_draft on public.invoices for insert to authenticated with check (
 (select public.is_active_agency_member()) and created_by=(select auth.uid()) and status='draft'
);
create policy invoices_delete_own_draft on public.invoices for delete to authenticated using (
 (select public.is_active_agency_member()) and created_by=(select auth.uid()) and status='draft'
);
revoke update on public.invoices from authenticated;
drop policy if exists invoice_revisions_active_members_all on public.invoice_revisions;
create policy invoice_revisions_read_active_members on public.invoice_revisions for select to authenticated using ((select public.is_active_agency_member()));
revoke insert,update,delete on public.invoice_revisions from authenticated;
drop policy if exists document_categories_active_members_all on public.document_categories;
create policy document_categories_read_active_members on public.document_categories for select to authenticated using ((select public.is_active_agency_member()));
revoke insert,update,delete on public.document_categories from authenticated;
drop policy if exists invoice_items_active_members_all on public.invoice_items;
create policy invoice_items_read_active_members on public.invoice_items for select to authenticated using ((select public.is_active_agency_member()));
create policy invoice_items_insert_draft on public.invoice_items for insert to authenticated with check (
 (select public.is_active_agency_member()) and exists(select 1 from public.invoices i where i.id=invoice_id and i.created_by=(select auth.uid()) and i.status='draft')
);
create policy invoice_items_update_draft on public.invoice_items for update to authenticated using (
 (select public.is_active_agency_member()) and exists(select 1 from public.invoices i where i.id=invoice_id and i.created_by=(select auth.uid()) and i.status='draft')
) with check (
 (select public.is_active_agency_member()) and exists(select 1 from public.invoices i where i.id=invoice_id and i.created_by=(select auth.uid()) and i.status='draft')
);
create policy invoice_items_delete_draft on public.invoice_items for delete to authenticated using (
 (select public.is_active_agency_member()) and exists(select 1 from public.invoices i where i.id=invoice_id and i.created_by=(select auth.uid()) and i.status='draft')
);
drop policy if exists invoice_payments_active_members_all on public.invoice_payments;
create policy invoice_payments_read_active_members on public.invoice_payments for select to authenticated using ((select public.is_active_agency_member()));
create policy invoice_payments_insert_issued_invoice on public.invoice_payments for insert to authenticated with check (
 (select public.is_active_agency_member()) and recorded_by=(select auth.uid()) and exists(
   select 1 from public.invoices i where i.id=invoice_id and i.status in ('issued','partially_paid','overdue')
 )
);
revoke update,delete on public.invoice_payments from authenticated;
revoke all on function public.update_invoice_payment_status() from public,anon,authenticated;
revoke all on function public.guard_issued_invoice() from public,anon,authenticated;

create or replace function public.get_dashboard_finance_summary()
returns table(issued_invoice_count bigint, unpaid_invoice_count bigint, payments_received numeric)
language plpgsql stable security definer set search_path=''
as $$ begin
 if not coalesce((select public.is_active_agency_member()),false) then raise exception 'active_agency_member_required'; end if;
 return query select
   count(i.id) filter(where i.status not in ('draft','cancelled')),
   count(i.id) filter(where i.status in ('issued','partially_paid','overdue')),
   coalesce((select sum(p.amount) from public.invoice_payments p),0)
 from public.invoices i;
end $$;
revoke all on function public.get_dashboard_finance_summary() from public,anon;
grant execute on function public.get_dashboard_finance_summary() to authenticated;
drop policy if exists invoice_number_sequences_active_members_all on public.invoice_number_sequences;
create policy invoice_sequences_read on public.invoice_number_sequences for select to authenticated using ((select public.is_active_agency_member()));
revoke insert,update,delete on public.invoice_number_sequences from authenticated;
create or replace function public.guard_invoice_items() returns trigger language plpgsql set search_path='' as $$ declare inv uuid; begin if tg_op='DELETE' then inv:=old.invoice_id; else inv:=new.invoice_id; end if; if exists(select 1 from public.invoices where id=inv and status<>'draft') then raise exception 'issued_invoice_items_are_immutable'; end if; if tg_op='DELETE' then return old; else return new; end if; end $$;
create or replace function public.guard_invoice_revision() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'invoice_revision_is_immutable'; end $$;
revoke all on function public.guard_invoice_items() from public,anon,authenticated;
revoke all on function public.guard_invoice_revision() from public,anon,authenticated;
create trigger invoice_items_guard before insert or update or delete on public.invoice_items for each row execute function public.guard_invoice_items();
create trigger invoice_revisions_immutable before update or delete on public.invoice_revisions for each row execute function public.guard_invoice_revision();
