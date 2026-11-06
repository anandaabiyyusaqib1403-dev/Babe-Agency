# Supabase migration reconciliation

## Current audit snapshot

- Audited: 2026-11-06 (Asia/Jakarta).
- Branch: `main`.
- Local `HEAD` and `origin/main`: `366d867c9e07189e41b02fbf9bad3b06f30b481a`.
- Supabase project identity: `BABE AGENCY`, ref `mmtymicfcqirppfpljnp`; local config/environment URL matched this ref before read-only access.
- Local migration files: 13.
- Remote ledger entries: 12.
- Remote inventory: 43 public tables, all with RLS enabled; 66 policies, 44 public functions, 69 triggers.
- Existing dirty/staged worktree changes were preserved.

## Findings

Three suffix-matched migration labels have divergent timestamps: local `20261105140000_documents_and_invoice_operations.sql` vs remote `20261105123210`; local `20261105150000_documents_indexes.sql` vs remote `20261105123513`; and local `20261105160000_invoice_amount_mirrors.sql` vs remote `20261105141914`. Remote document/invoice objects and invoice amount columns exist, but the ledger has no SQL body/checksum. This does not prove the local source matches what ran remotely.

The local-only `20261106003000_feature_workflow_consistency.sql` has no ledger row. Its functions `publish_content_schedule(uuid,text)` and `review_content_approval(uuid,text,text)` are both absent from the remote catalog. It is `CONFIRMED_NOT_APPLIED` in its current intended effects; do not apply until dependencies and full migration history receive review.

The other nine ledger rows align by local timestamp (some ledger names include a different prefix). Their exact SQL equivalence remains unproven. Git branch/tag inspection did not recover older source versions for the three mismatches. `git fsck` reported broken refs and missing objects; historical completeness is therefore uncertain.

## Decision

Overall database change status: **BLOCKED**. The three divergent versions are `CONTENT_MISMATCH` with historical SQL unresolved; the remaining ledgered files are `NEEDS_MANUAL_REVIEW`; the workflow migration is `CONFIRMED_NOT_APPLIED`. No ledger repair or migration execution is authorized by this report.

No backup artifact/recovery point was verified, and no isolated restore test was possible. See [forensic audit](./migration-forensic-audit.md), [remote schema inventory](./remote-schema-inventory.md), [backup and recovery plan](./backup-recovery-plan.md), and [change readiness gate](./database-change-readiness.md).

## Required before a new migration

1. Produce a protected manual backup and prove restore in an isolated environment.
2. Recover or otherwise establish the exact historical SQL for all three divergent ledger versions.
3. Complete exact schema and RLS comparison, including functions, grants, triggers, indexes, and constraints.
4. Resolve repository history integrity gaps and document confidence.
5. Approve role/permission mapping, including the existing `owner` membership and finance boundary.
6. Re-run the read-only preflight and review a specific change/recovery plan.

No migration, schema object, migration ledger row, Auth user, membership, or invitation was modified during this audit.
