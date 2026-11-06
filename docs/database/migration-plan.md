# Migration plan

## Current migration state

Repository inspection found 13 SQL migration files under `supabase/migrations/`. The remote Supabase migration ledger has 12 versions. Three operations have differing local/remote timestamps/names and the latest local file `20261106003000_feature_workflow_consistency.sql` is absent from the remote ledger. The active schema reports 43 `public` tables, all with RLS enabled. This is a drift warning, not authorization to repair or replay anything. Do not run `db push`, `migration repair`, schema reset, or SQL against the project until a human-reviewed reconciliation determines which bodies were applied.

The repository also lacks checked-in generated database types and package/lock configuration noted by the project audit; application build/test reproducibility is not established. The architecture is modular monolith; keep the current repo structure and avoid imposing `apps/`/`packages/` solely for schema work.

## Preconditions (no migration execution in this phase)

1. Record a dated read-only schema snapshot: tables, columns, constraints, indexes, policies, grants, functions, triggers, extensions and `supabase_migrations.schema_migrations` rows.
2. Compare each local migration body to remote-applied migration contents or schema effects. Identify exact applied-but-unrecorded, recorded-but-missing and divergent entries. Do not edit historical SQL files to make them appear equivalent.
3. Export/backup data and agree a tested restore point. Inspect representative current rows and establish row counts/key mappings for each affected domain.
4. Map old `agency_members` to workspace membership and existing client/content/report/resource/invoice objects to the target. Decide whether to rename, extend or create-and-copy; do not create duplicate parallel sources of truth without a cutover plan.
5. Resolve decisions in `open-decisions.md` that affect keys, permissions, reporting and finance posting. Generate/check in type updates only alongside an approved schema migration and matching source change.

## Proposed logical sequence

These are migration work packages, not ready-to-run SQL. Assign actual sequential timestamps only after drift reconciliation and repository conventions are agreed.

| Order | Proposed migration work package | Dependencies and key review |
|---:|---|---|
| 0 | Reconcile history and capture baseline | No schema mutation. Decide remote/local ledger repair separately and review consequences. |
| 1 | Workspace tenancy and identity bridge | Workspace, profiles, memberships, role/permission catalogs. Backfill current agency members to one BABE workspace; keep stable `auth.users` UUIDs; validate every account before enabling strict policies. |
| 2 | Tenant keys and ownership constraints | Add nullable workspace/client keys to existing operational rows, backfill, validate no orphans/cross-client references, add composite unique/FKs, then make tenant columns non-null where warranted. Batch large backfills. |
| 3 | Client/project/quota normalization | Map existing clients, briefs, pillars, packages and quota records; avoid duplicate package/quota truth. Create flexible quota definitions/assignment periods only after mapping current usage. |
| 4 | Content lifecycle and schedule integrity | Preserve current content UUID as stable Content ID; migrate schedule relationships, formats/platforms, tags, storyboards and revisions. Verify multiple schedules per content and same-client composite FKs. |
| 5 | Approval and performance history | Preserve approval history and performance rows; performance must map to exact schedule. Validate null/orphan schedule IDs before tightening FK. |
| 6 | Report version/source snapshots | Keep monthly/social reports distinct; preserve existing versions and snapshot hashes/data. Add explicit performance refs and immutable finalization policy. Compare regenerated historic reports before cutover. |
| 7 | Drive/resource/document jobs | Preserve Drive file IDs/metadata and existing storage fallback; introduce separate render/upload statuses and job attempts. Do not move binary files in this schema phase without a separate migration plan. |
| 8 | Finance foundation (chart, period, transaction source, journal) | Seed approved IDR accounts/categories; keep existing invoice/payment tables isolated. Import opening balances only after accountant review and reconciliation. Use posting RPC before enabling any posted state. |
| 9 | Finance controls, allocations and reconciliation | Add approval, reversal, period close, attachments, allocations and financial snapshots; validate no double counting and close-period locks. |
| 10 | RLS tightening and policy cutover | Enable/work through policies after backfill validation. Test cross-tenant cases; deploy compatible application code before removing old access paths. |
| 11 | Types, observability and cleanup | Generate/check in typed DB client types; remove obsolete compatibility paths only after production verification and explicit retention decision. |

## Safe expand/backfill/contract pattern

For any nontrivial change: (a) add nullable columns/new tables and additive policies; (b) deploy code that can read old and new shape; (c) backfill in idempotent batches with checkpoints; (d) compare counts, checksums, orphan reports and business totals; (e) enforce constraints `NOT VALID` then validate where supported; (f) switch reads/writes behind a controlled cutover; (g) retain rollback window; (h) contract/remove old shape in a later approved migration. Avoid lock-heavy table rewrites during operating hours.

## Recovery and rollback

- Migrations should be forward-only when reversal risks losing data. Recovery is a tested backup restore or a new compensating migration, not assuming every DDL/data migration is cleanly reversible.
- For additive DDL before data cutover, rollback can leave unused nullable columns/tables. For backfills, keep source values and an idempotent mapping table/checkpoint; do not erase old rows during the rollback window.
- For finance posting, never reverse via table rollback after real postings; use auditable reversal entries and period controls.
- For report finalization, immutable snapshots are retained. A bad finalization is superseded with a new version and audit note, not edited in place.
- For permission cutover, keep tested break-glass owner access and verify policy behavior in staging before production. No service-role key may be placed in browser code.
- Take and verify a backup before any production migration; rehearse restore to an isolated environment and record recovery time/data-loss objectives.

No migrations have been authored or executed as part of this design. Refer to [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations) and [Supabase backups](https://supabase.com/docs/guides/platform/backups) when preparing an approved implementation.
