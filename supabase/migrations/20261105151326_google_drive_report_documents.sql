-- Link report PDF jobs to their Drive metadata row without duplicating file metadata.
alter table public.agency_documents
  add column if not exists report_pdf_job_id uuid
  references public.report_pdf_jobs(id) on delete set null;

create unique index if not exists agency_documents_report_pdf_job_uidx
  on public.agency_documents(report_pdf_job_id)
  where report_pdf_job_id is not null;
