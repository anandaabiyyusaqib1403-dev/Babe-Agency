# Supabase migration reconciliation

## Audit snapshot

- Audited: 2026-11-06.
- Git branch: `main`.
- Local `HEAD` and `origin/main`: `b97ab428c0183905aa98d8fc3959aa416d40fa6f`.
- Supabase project: `BABE AGENCY` (`mmtymicfcqirppfpljnp`), active, PostgreSQL 17.11, organization plan Free.
- Local migration files: 13.
- Remote migration ledger entries: 12.
- Remote schema: 43 public tables; RLS enabled on all 43; 66 public policies; 44 public functions; 69 public triggers.

The working tree was already dirty during preflight, including staged deletions and modifications to authentication/design files plus unrelated untracked files. Those changes were left untouched.

## Local-to-remote migration map

| Local migration | Remote ledger entry | Finding |
|---|---|---|
| `20261104155743_workspace_foundation.sql` | version `20261104155743`, name `202611040001_workspace_foundation` | Version matches; ledger name differs. |
| `20261104155750_task_performance_reporting.sql` | version `20261104155750`, name `202611040002_task_performance_reporting` | Version matches; ledger name differs. |
| `20261104155833_documents_invoices.sql` | version `20261104155833`, name `202611040003_documents_invoices` | Version matches; ledger name differs. |
| `20261104160038_document_invoice_security_indexes.sql` | version `20261104160038`, name `202611040004_document_invoice_security_indexes` | Version matches; ledger name differs. |
| `20261104164409_zapier_reminder_queue.sql` | version `20261104164409`, name `zapier_reminder_queue` | Version and name match. |
| `20261104164636_complete_workspace_schema.sql` | version `20261104164636`, name `complete_workspace_schema` | Version and name match. |
| `20261105114514_workspace_clients_content_detail.sql` | version `20261105114514`, name `workspace_clients_content_detail` | Version and name match. |
| `20261105140000_documents_and_invoice_operations.sql` | version `20261105123210`, name `documents_and_invoice_operations` | Same migration label, different timestamp/version. |
| `20261105150000_documents_indexes.sql` | version `20261105123513`, name `documents_indexes` | Same migration label, different timestamp/version. |
| `20261105151326_google_drive_report_documents.sql` | version `20261105151326`, name `google_drive_report_documents` | Version and name match. |
| `20261105152125_agency_documents_drive_file_unique.sql` | version `20261105152125`, name `agency_documents_drive_file_unique` | Version and name match. |
| `20261105160000_invoice_amount_mirrors.sql` | version `20261105141914`, name `invoice_amount_mirrors` | Same migration label, different timestamp/version. |
| `20261106003000_feature_workflow_consistency.sql` | No entry | Local-only migration. Its two RPC functions are absent from the remote schema. |

The three remote versions `20261105123210`, `20261105123513`, and `20261105141914` have no exact local filename version. Their labels resemble three local files with later timestamps, and the corresponding document/invoice objects are present remotely. The remote ledger does not expose the SQL body or a checksum, so semantic similarity of the current files does not prove that they are byte-for-byte the SQL that ran remotely.

For `invoice_amount_mirrors`, the remote schema has the amount columns, both expected functions, and the issue trigger. For the documents migrations, the expected operational tables and service-only policy are present. These observations confirm portions of the resulting schema, but do not recover the historical SQL used for each mismatched ledger entry.

For `feature_workflow_consistency`, the local file defines `publish_content_schedule(uuid,text)` and `review_content_approval(uuid,text,text)`. Both functions are absent remotely, and the local version has no ledger entry. It must not be re-run or recorded manually until the other timestamp/name inconsistencies have a verified resolution.

## Current identity and authorization schema

- `agency_members` exists and references `auth.users(id)`.
- No `profiles`, `user_profiles`, `workspace_memberships`, `invitations`, or `agency_invitations` table exists.
- Remote `auth.users` has one account and `agency_members` has one active `owner` row with `can_manage_members=true`; this row is `admin@babeagency.id`.
- Existing database roles are `owner`, `admin`, and `member`. `can_manage_agency_members()` authorizes active `owner`/`admin`; `enforce_agency_member_role()` prevents self role changes and protects the last active owner.
- Current security documentation explicitly leaves the mapping from `HEAD_OF_AGENCY` to `owner` open. `DEVELOPER` has no direct stored-role equivalent. The roster emails in the request do not match the sole existing membership, so it cannot safely be treated as Imam Gunawan or used to provision the roster.
- No Auth-user creation trigger was found. The existing server-only admin client expects `SUPABASE_SERVICE_ROLE_KEY`; no invitation handler/API currently calls `inviteUserByEmail`.

## Backup and recovery status

The Supabase organization is on the Free plan. Supabase's current documentation says Free projects do not receive automatic daily backups and recommends maintaining a manual off-site export. No database dump or backup artifact was found in the repository, and the available Supabase connector does not expose backup inventory or recovery-point metadata. Therefore a usable backup/recovery point was **not verified**.

References: [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [Free plan backup FAQ](https://supabase.com/kb/faqs/platform/free-plan-backups).

## Reconciliation decision

**Blocked before migration creation/application.** The exact executed SQL for the three timestamp-mismatched migrations cannot be verified from the available remote ledger, and backup/recovery is not verified. The role-to-database mapping is also unresolved. These are material preconditions for invitation schema and authorization changes.

To resume safely:

1. Provide or establish a verified off-site database export and recovery procedure for the Free project.
2. Recover the exact SQL/history for remote versions `20261105123210`, `20261105123513`, and `20261105141914`, then reconcile local names, versions, and content without changing timestamps to conceal drift.
3. Approve explicit stored-role/permission mapping for `HEAD_OF_AGENCY`, `DEVELOPER`, and `AGENCY_MEMBER`, including how the current `owner` account relates to the named Head of Agency.
4. Re-run read-only schema/ledger checks before writing or applying any migration.

No migration ledger rows, database objects, users, roles, or invitations were changed during this audit.
