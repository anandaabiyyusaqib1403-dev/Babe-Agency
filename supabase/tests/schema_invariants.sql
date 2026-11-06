-- Read-only post-migration assertions. Run in local/development only after 001-006.
do $$
declare
  expected_tables text[] := array[
    'agency_members','agency_settings','clients','contents','content_schedules','tasks',
    'task_notification_preferences','task_reminder_events','performances','monthly_reports',
    'monthly_report_versions','social_reports','social_report_items','social_report_versions',
    'report_pdf_jobs','document_categories','agency_documents','invoice_number_sequences',
    'invoices','invoice_items','invoice_payments','invoice_revisions','client_briefs',
    'client_brief_versions','packages','package_content_quotas','client_packages',
    'client_package_quotas','content_pillars','content_creative_briefs','content_storyboards',
    'content_storyboard_rows','content_approvals','content_approval_history','content_revisions',
    'task_activity_logs','email_reminder_queue','agency_billing_profiles','notifications'
  ];
  missing text[];
  unprotected text[];
  table_count integer;
begin
  select array_agg(name) into missing
  from unnest(expected_tables) as expected(name)
  where to_regclass('public.' || quote_ident(name)) is null;
  if missing is not null then raise exception 'Missing application tables: %', missing; end if;

  select count(*) into table_count
  from unnest(expected_tables) as expected(name)
  join pg_class c on c.oid=to_regclass('public.' || quote_ident(expected.name))
  where c.relkind in ('r','p');
  if table_count <> 39 then raise exception 'Expected 39 application tables, found %', table_count; end if;

  select array_agg(c.relname order by c.relname) into unprotected
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
    and c.relname=any(expected_tables) and not c.relrowsecurity;
  if unprotected is not null then raise exception 'RLS is disabled: %', unprotected; end if;

  if exists(select 1 from pg_class where oid='public.client_package_quota_usage'::regclass and reloptions @> array['security_invoker=true']) is false then
    raise exception 'Quota view must use security_invoker';
  end if;
  if exists(select 1 from pg_class where oid='public.content_performance'::regclass and reloptions @> array['security_invoker=true']) is false then
    raise exception 'Performance view must use security_invoker';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='email_reminder_queue_sync_idx') then
    raise exception 'Reminder queue dispatch index is missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_read_own') then
    raise exception 'Recipient-only notification policy is missing';
  end if;
  if has_function_privilege('authenticated','public.log_task_activity()','EXECUTE') then
    raise exception 'Authenticated role must not call internal task logger directly';
  end if;
  if exists(select 1 from storage.buckets where id='agency-reports' and public) then
    raise exception 'agency-reports bucket must remain private';
  end if;
  if exists(select 1 from pg_extension where extname='pg_cron') then
    raise exception 'Unexpected pg_cron extension; this deployment uses the persistent worker';
  end if;
end $$;

select 'schema invariants passed' as result;
