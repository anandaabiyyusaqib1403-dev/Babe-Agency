-- Indexes and service-role policy for Documents operational tables.
create index if not exists agency_document_events_actor_idx on public.agency_document_events(actor_id);
create index if not exists agency_document_upload_orphans_uploader_idx on public.agency_document_upload_orphans(uploaded_by);
create index if not exists agency_documents_archived_by_idx on public.agency_documents(archived_by);
create index if not exists invoice_activity_events_actor_idx on public.invoice_activity_events(actor_id);
create index if not exists invoices_supersedes_invoice_idx on public.invoices(supersedes_invoice_id);
drop policy if exists agency_document_upload_orphans_service_only on public.agency_document_upload_orphans;
create policy agency_document_upload_orphans_service_only on public.agency_document_upload_orphans for all to service_role using (true) with check (true);