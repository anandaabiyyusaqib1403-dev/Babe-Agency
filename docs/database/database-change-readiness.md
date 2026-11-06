# Database change readiness gate

Assessment date: 2026-11-06. Target: BABE AGENCY Supabase project `mmtymicfcqirppfpljnp`.

## Gate result: BLOCKED

| Prerequisite | Status | Evidence / blocker |
|---|---|---|
| Correct project identity | PASS | Local Supabase project URL/config ref matches selected `BABE AGENCY` project. |
| Working tree preserved | PASS | Existing dirty and staged changes were retained. |
| Backup exists | FAIL | No dump/artifact; Free plan has no automatic backup; required tooling/connection unavailable. |
| Backup restore is proven | FAIL | No backup or isolated restore target; no rehearsal performed. |
| Local/remote migration ledger reconciled | FAIL | 13 local files vs 12 remote ledger rows; three timestamp divergences. |
| Historical SQL source recovered | FAIL | Original remote timestamp versions not recovered; Git object/ref errors limit history completeness. |
| Schema drift understood | FAIL | 43-table inventory and selected objects observed, but no complete exact source-to-catalog parity proof. |
| Local-only workflow migration assessed | PARTIAL | Ledger absent and both expected functions absent; dependency review still needed before a future implementation. |
| RLS drift checked | PARTIAL | 43/43 tables RLS-enabled, 66 policies inventoried; exact policy-definition parity for all migrations unresolved. |
| Roles/permissions mapped and approved | FAIL | DB roles `owner/admin/member` differ from product roles; Head/Developer mapping and finance permissions remain open. |
| Recovery plan ready | FAIL | Plan documented; no recovery point or restore evidence. |

## Conditions before reconsidering

1. Obtain an encrypted manual backup using an approved tool and verify archive integrity.
2. Restore it successfully to a separate, isolated recovery environment and retain verification evidence.
3. Recover the exact SQL bodies corresponding to the three remote timestamp versions, or formally document an evidence-based reconciliation that does not rewrite history.
4. Resolve Git repository integrity/history gaps and preserve the forensic outputs.
5. Complete exact schema and RLS comparison, including functions, grants, triggers, indexes, constraints, and columns.
6. Approve product-role/permission mapping, especially finance boundary and Head of Agency governance.
7. Review the proposed migration and recovery plan before execution.

Until each critical prerequisite passes, do not run a new migration, migration repair, schema write, or reset. This document records a readiness assessment, not authorization to execute changes.
