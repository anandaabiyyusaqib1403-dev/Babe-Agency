# Database change readiness gate

Assessment date: 2026-11-06. Target: BABE AGENCY Supabase project `mmtymicfcqirppfpljnp`.

## Gate result: BLOCKED

| Prerequisite | Status | Evidence / blocker |
|---|---|---|
| Correct project identity | PASS | Supabase project detail verified requested ref/name. Local `.env.local` URL host matches the remote ref. `supabase/config.toml` contains local CLI project slug `Babe_agency`, not the remote ref; these were not conflated. |
| Working tree preserved | PASS | Existing dirty and staged changes were retained. |
| Backup exists | FAIL | No dump/artifact; Free plan has no automatic backup; required tooling/connection unavailable. See [manifest](./backup-manifest.md). |
| Backup integrity verified | FAIL | No file to checksum/read/parse. See [integrity report](./backup-integrity-report.md). |
| Backup restore is proven | FAIL | No backup or isolated restore target; no rehearsal performed. See [restore test report](./restore-test-report.md). |
| Local/remote migration ledger reconciled | FAIL | 13 local files vs 12 remote ledger rows; three timestamp divergences. |
| Historical SQL source recovered | FAIL | Original remote timestamp versions not recovered; Git object/ref errors limit history completeness. |
| Schema drift understood | FAIL | 43-table inventory and selected objects observed, but no complete exact source-to-catalog parity proof. |
| Local-only workflow migration assessed | PARTIAL | Ledger absent and both expected functions absent; dependency review still needed before a future implementation. |
| RLS drift checked | PARTIAL | 43/43 tables RLS-enabled, 66 policies inventoried; exact policy-definition parity for all migrations unresolved. |
| Roles/permissions mapped and approved | FAIL | DB roles `owner/admin/member` differ from product roles; Head/Developer mapping and finance permissions remain open. |
| Recovery plan ready | FAIL | Procedure documented but unproven; RPO/RTO are TBD and no recovery point/restore evidence exists. See [recovery procedure](./recovery-procedure.md). |

## Conditions before reconsidering

1. Obtain an encrypted manual backup using an approved tool and verify archive integrity.
2. Restore it successfully to a separate, isolated recovery environment and retain verification evidence.
3. Recover the exact SQL bodies corresponding to the three remote timestamp versions, or formally document an evidence-based reconciliation that does not rewrite history.
4. Resolve Git repository integrity/history gaps and preserve the forensic outputs.
5. Complete exact schema and RLS comparison, including functions, grants, triggers, indexes, constraints, and columns.
6. Approve product-role/permission mapping, especially finance boundary and Head of Agency governance.
7. Review the proposed migration and recovery plan before execution.

Until each critical prerequisite passes, do not run a new migration, migration repair, schema write, or reset. This document records a readiness assessment, not authorization to execute changes.
