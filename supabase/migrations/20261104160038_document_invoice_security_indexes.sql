-- Tighten helper function API exposure and support document/invoice FK lookups.
revoke execute on function public.is_active_agency_member() from public, anon;
revoke execute on function public.can_manage_agency_members() from public, anon;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

create index if not exists agency_documents_category_idx on public.agency_documents(category_id);
create index if not exists agency_documents_uploaded_by_idx on public.agency_documents(uploaded_by);
create index if not exists agency_documents_invoice_idx on public.agency_documents(invoice_id);
create index if not exists invoice_items_invoice_idx on public.invoice_items(invoice_id);
create index if not exists invoice_payments_proof_document_idx on public.invoice_payments(proof_document_id);
create index if not exists invoice_payments_recorded_by_idx on public.invoice_payments(recorded_by);
create index if not exists invoices_created_by_idx on public.invoices(created_by);
create index if not exists invoice_revisions_created_by_idx on public.invoice_revisions(created_by);
