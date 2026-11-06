# Remote schema inventory

Audit date: 2026-11-06 (Asia/Jakarta)  
Project: `BABE AGENCY`, ref `mmtymicfcqirppfpljnp` (verified against local project URL before read-only queries)

## Method and limits

Inventory came from read-only Supabase connector queries and catalog inspection. No database-changing statement was executed. This is a point-in-time public-schema inventory, not a dump or a full reproducibility artifact. Detailed table/column catalog export was only partially available through the connector; do not treat summary counts as a complete schema snapshot.

## Object counts

| Object | Observed |
|---|---:|
| `public` tables | 43 |
| Tables with RLS enabled | 43 |
| Tables with RLS disabled | 0 |
| Public RLS policies | 66 |
| Policy commands: ALL / DELETE / INSERT / SELECT / UPDATE | 18 / 4 / 10 / 27 / 7 |
| Public functions | 44 |
| Public triggers | 69 |
| Public indexes | 143 |
| Unique indexes | 85 |
| Constraints: CHECK / FK / PK / UNIQUE | 91 / 85 / 43 / 39 |
| Public views | 2 |
| Public sequences | 0 |

Installed extensions observed: `pg_stat_statements 1.11`, `pgcrypto 1.3`, `plpgsql 1.0`, `supabase_vault 0.3.1`, `uuid-ossp 1.1`.

## Public table names

All 43 names below were returned by the read-only table inventory. RLS was enabled for each. The connector also returned approximate/current row counts, but those counts are volatile and intentionally omitted from this durable schema record.

`agency_members`, `agency_settings`, `clients`, `contents`, `content_schedules`, `tasks`, `task_notification_preferences`, `task_reminder_events`, `performances`, `monthly_reports`, `monthly_report_versions`, `social_reports`, `social_report_items`, `social_report_versions`, `report_pdf_jobs`, `document_categories`, `agency_documents`, `invoice_number_sequences`, `invoices`, `invoice_items`, `invoice_payments`, `invoice_revisions`, `client_briefs`, `client_brief_versions`, `packages`, `package_content_quotas`, `client_packages`, `client_package_quotas`, `content_pillars`, `content_creative_briefs`, `content_storyboards`, `content_storyboard_rows`, `content_approvals`, `content_approval_history`, `content_revisions`, `task_activity_logs`, `email_reminder_queue`, `agency_billing_profiles`, `notifications`, `content_status_history`, `agency_document_upload_orphans`, `agency_document_events`, `invoice_activity_events`.

All 44 public functions observed in the catalog are owned by `postgres`. A subset of functions, including `get_performance_summary`, `prevent_finalized_report_mutation`, `set_task_completed_at`, `set_updated_at`, and `validate_task_assignee`, had execute grants observable for `anon`; this is a privilege inventory fact, not a complete function security review. Review each function's body, `SECURITY DEFINER`, `search_path`, and effective grants before relying on it.

## Membership/auth observations

- `agency_members` exists and has RLS enabled.
- No `profiles`, `user_profiles`, `workspace_memberships`, `invitations`, or `agency_invitations` table was found.
- `agency_members` has six policies covering active-member visibility, self visibility, and member-management operations.
- `can_manage_agency_members()` is `SECURITY DEFINER` with an empty search path and permits active database roles `owner` or `admin`.
- `enforce_agency_member_role()` is a security-definer trigger function; observed behavior protects self-role changes and the last active owner, and derives member-management capability from role.
- Membership triggers include role guard actions for DELETE/INSERT/UPDATE, task-reminder refresh on update, and `set_updated_at`.
- One active `auth.users` record and one active `agency_members` record were observed: `admin@babeagency.id`, role `owner`, `can_manage_members=true`. This does not establish that the record corresponds to the named Head of Agency.
- Existing database roles `owner/admin/member` do not directly match product roles `HEAD_OF_AGENCY/DEVELOPER/AGENCY_MEMBER`.

## Migration-related observed objects

Document/invoice objects and invoice amount columns expected by ledgered migrations are present. This verifies current effects only, not which exact historical SQL produced them. The two workflow functions expected from the local-only `feature_workflow_consistency` migration were checked by signature and are absent:

- `public.publish_content_schedule(uuid,text)`
- `public.review_content_approval(uuid,text,text)`

## Schema drift assessment

**PARTIALLY VERIFIED.** The remote ledger contains 12 rows; local repo has 13 SQL files. Three same-suffix migrations use different timestamps. Public catalog counts and selected membership/document objects were checked, but exact function, policy, constraint, index, and column-definition parity against every SQL source was not established. The ledger does not provide SQL hashes. Full drift status therefore remains unresolved.

## Evidence gaps

1. No database dump or backup file was present in the repository/artifact search.
2. Supabase organization plan is Free; automatic backups are not available on this plan according to current official Supabase documentation.
3. Supabase CLI, `pg_dump`, `psql`, Docker, and database connection password were unavailable in the environment; no secret was exposed.
4. Connector supports catalog queries but not a complete auditable SQL dump.
5. Git object/ref errors prevent a claim of complete historical source recovery.

## Status

Project identity: **VERIFIED**. Counts and listed selected objects: **VERIFIED** as point-in-time results. Complete catalog export and migration-to-schema parity: **PARTIALLY VERIFIED / UNVERIFIED**.
