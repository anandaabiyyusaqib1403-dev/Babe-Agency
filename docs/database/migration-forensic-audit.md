# Migration forensic audit

Audit date: 2026-11-06 (Asia/Jakarta)  
Repository: `main`, HEAD `366d867c9e07189e41b02fbf9bad3b06f30b481a`  
Supabase project ref verified against local project URL: `mmtymicfcqirppfpljnp` (`BABE AGENCY`)

## Scope and safety

This is a read-only investigation. No SQL migration, DDL, DML, migration repair, auth operation, or deployment was run. The project reference in `supabase/config.toml` and the host in local environment configuration agree with the Supabase project selected by the connector. Secret values were not read or printed.

The worktree already contained staged and unstaged changes before this audit. They were preserved. Git reports broken refs/missing objects during full-history verification; findings about history therefore have limited confidence.

## Migration inventory and reconciliation

There are 13 local SQL files and 12 remote ledger rows. The ledger records version/name, not a SQL checksum, so matching names and observable objects do not prove byte-for-byte equivalence.

| Local filename | Local timestamp | Remote timestamp | Remote name | SQL source | Expected/observed remote effects | Evidence and confidence | Decision / action |
|---|---:|---:|---|---|---|---|---|
| `20261104155743_workspace_foundation.sql` | 20261104155743 | 20261104155743 | `202611040001_workspace_foundation` | Present locally; only known Git history introduction found | Foundation objects observed; no source hash comparison available | Ledger + current inventory; medium | NEEDS_MANUAL_REVIEW: compare SQL and complete intended object set |
| `20261104155750_task_performance_reporting.sql` | 20261104155750 | 20261104155750 | `202611040002_task_performance_reporting` | Present locally; only known Git history introduction found | Task/performance/report objects observed | Ledger + current inventory; medium | NEEDS_MANUAL_REVIEW |
| `20261104155833_documents_invoices.sql` | 20261104155833 | 20261104155833 | `202611040003_documents_invoices` | Present locally; only known Git history introduction found | Document/invoice objects observed | Ledger + current inventory; medium | NEEDS_MANUAL_REVIEW |
| `20261104160038_document_invoice_security_indexes.sql` | 20261104160038 | 20261104160038 | `202611040004_document_invoice_security_indexes` | Present locally; only known Git history introduction found | Security/index objects observed; exact definitions not proven equal | Ledger + inventory; medium | NEEDS_MANUAL_REVIEW |
| `20261104164409_zapier_reminder_queue.sql` | 20261104164409 | 20261104164409 | `zapier_reminder_queue` | Present locally; known history only | Queue-related objects; exact SQL equivalence unverified | Ledger + inventory; medium | NEEDS_MANUAL_REVIEW |
| `20261104164636_complete_workspace_schema.sql` | 20261104164636 | 20261104164636 | `complete_workspace_schema` | Present locally; known history only | Workspace schema effects observed | Ledger + inventory; medium | NEEDS_MANUAL_REVIEW |
| `20261105114514_workspace_clients_content_detail.sql` | 20261105114514 | 20261105114514 | `workspace_clients_content_detail` | Present locally; known history only | Client/content objects observed | Ledger + inventory; medium | NEEDS_MANUAL_REVIEW |
| `20261105140000_documents_and_invoice_operations.sql` | 20261105140000 | 20261105123210 | `documents_and_invoice_operations` | Local source present; historical remote-timestamp source not found | Document events/invoice-related objects exist; semantic match is not source proof | Ledger timestamp differs; history incomplete; medium | CONTENT_MISMATCH (version/name divergence), exact applied SQL unresolved; do not repair |
| `20261105150000_documents_indexes.sql` | 20261105150000 | 20261105123513 | `documents_indexes` | Local source present; historical remote-timestamp source not found | Indexes exist but exact index definitions/source mapping require review | Timestamp divergence + inventory; medium | CONTENT_MISMATCH; do not repair |
| `20261105151326_google_drive_report_documents.sql` | 20261105151326 | 20261105151326 | `google_drive_report_documents` | Present locally; known history only | Drive/report document objects observed | Ledger + inventory; medium | NEEDS_MANUAL_REVIEW |
| `20261105152125_agency_documents_drive_file_unique.sql` | 20261105152125 | 20261105152125 | `agency_documents_drive_file_unique` | Present locally; known history only | Agency document uniqueness effect observed | Ledger + inventory; medium | NEEDS_MANUAL_REVIEW |
| `20261105160000_invoice_amount_mirrors.sql` | 20261105160000 | 20261105141914 | `invoice_amount_mirrors` | Local source present; historical remote-timestamp source not found | Invoice amount mirror columns observed | Ledger timestamp diverges; current columns are not proof of source identity; medium | CONTENT_MISMATCH; do not repair |
| `20261106003000_feature_workflow_consistency.sql` | 20261106003000 | — | — | Original local SQL found | Both expected functions absent remotely: `publish_content_schedule(uuid,text)`, `review_content_approval(uuid,text,text)` | Ledger absence + `to_regprocedure` checks; high for current non-presence | CONFIRMED_NOT_APPLIED; preserve source and assess later |

## Three timestamp/name divergences

The three suffix names `documents_and_invoice_operations`, `documents_indexes`, and `invoice_amount_mirrors` exist in local and remote ledger under different timestamps. Search of known local branches and tags found no alternate timestamped SQL source. Only remote `main` was advertised; no remote tags were found. Local Git branches contain the migration set introduced in commit `fca7f2b`, but `git fsck --full --no-reflogs --unreachable` reported broken refs and missing objects. Thus the known history is not demonstrably complete. The exact SQL previously applied remotely remains unresolved. Do not rename files, repair ledger entries, or replay these files based on suffix alone.

## `feature_workflow_consistency`

The local SQL contains two `CREATE OR REPLACE FUNCTION` definitions and grants for the two signatures listed above. No additional table, trigger, policy, or data changes were found in that file. Both procedures are absent from the live catalog. Their referenced workflow tables/helpers appear to exist, but full dependency compatibility has not been proven. The migration is not in the remote ledger. This supports `CONFIRMED_NOT_APPLIED` for its current intended effects, but not permission to execute it.

## Git source recovery

Known local branch set: `main`, `master`, `clean-main`, `database-design`, `foundation-audit`, `security-design`, `system-architecture`; no relevant tags. History inspection found the current migration files introduced in `fca7f2b`; no earlier SQL bodies for the divergent remote timestamps were recovered. The repository contains unrelated OAuth `.backup` artifacts, but no database dump. Broken object/ref diagnostics reduce confidence that all historical Git content was available.

## Migration decision vocabulary

- `CONFIRMED_APPLIED`: exact source/effect evidence is sufficient. No migration is promoted to this level solely from its ledger name; the eleven ledgered migrations remain manual-review items, with three timestamp mismatches explicitly `CONTENT_MISMATCH`.
- `CONFIRMED_NOT_APPLIED`: workflow consistency migration is absent from ledger and its two functions are absent from the database.
- `CONTENT_MISMATCH`: local/remote timestamp mappings diverge; actual historical SQL is unresolved.
- `UNRESOLVED`: original source/effects cannot be established from available history.
- `NEEDS_MANUAL_REVIEW`: ledger exists but exact SQL equivalence and all effects have not been proven.

## Conclusion

Overall status: **BLOCKED** for new database migrations. The live project identity and selected catalog facts are verified, but historical source equivalence, Git-history completeness, a recoverable backup, and a restore rehearsal are not established.
