-- Keep indexed invoice amount columns aligned with their immutable snapshots and payment ledger.
create or replace function public.set_invoice_amount_columns_on_issue()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.subtotal := coalesce((new.totals_snapshot->>'subtotal')::numeric, 0);
  new.discount_amount := coalesce((new.totals_snapshot->>'discount')::numeric, 0);
  new.tax_amount := coalesce((new.totals_snapshot->>'tax_amount')::numeric, 0);
  new.total_amount := coalesce((new.totals_snapshot->>'total')::numeric, 0);
  new.paid_amount := 0;
  new.remaining_amount := new.total_amount;
  return new;
end
$$;
revoke all on function public.set_invoice_amount_columns_on_issue() from public, anon, authenticated;
drop trigger if exists invoices_amount_columns_on_issue on public.invoices;
create trigger invoices_amount_columns_on_issue before update of status on public.invoices
  for each row when (old.status = 'draft' and new.status = 'issued')
  execute function public.set_invoice_amount_columns_on_issue();

create or replace function public.update_invoice_payment_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target uuid; total_due numeric; paid numeric; due date; current_status text;
begin
  target := case when tg_op='DELETE' then old.invoice_id else new.invoice_id end;
  select (totals_snapshot->>'total')::numeric,due_date,status into total_due,due,current_status
    from public.invoices where id=target for update;
  if not found then raise exception 'invoice_not_found'; end if;
  select coalesce(sum(amount),0) into paid from public.invoice_payments where invoice_id=target;
  if paid>coalesce(total_due,0) then raise exception 'payment_exceeds_invoice_balance'; end if;
  if current_status not in ('draft','cancelled') then
    update public.invoices set
      payment_snapshot=jsonb_build_object('amount_paid',paid,'last_paid_at',(select max(paid_at) from public.invoice_payments where invoice_id=target)),
      paid_amount=paid,
      remaining_amount=greatest(0,coalesce(total_due,0)-paid),
      status=case when paid>=total_due then 'paid' when paid>0 then 'partially_paid' when due<current_date then 'overdue' else 'issued' end,
      updated_at=now()
    where id=target;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end
$$;
revoke all on function public.update_invoice_payment_status() from public, anon, authenticated;

