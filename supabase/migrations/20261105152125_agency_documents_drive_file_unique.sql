-- Drive uploads are idempotently upserted by file ID. NULL remains allowed for non-Drive documents.
create unique index if not exists agency_documents_drive_file_id_uidx
  on public.agency_documents(drive_file_id);
