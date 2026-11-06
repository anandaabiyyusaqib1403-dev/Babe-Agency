# Database overview

## Scope and evidence

This is a **proposed target database design**, not a description of deployed tables. The repository already has a Supabase PostgreSQL schema and migration files; this document does not create or alter them. Evidence reviewed: `docs/architecture/`, `docs/project-foundation/`, the checked-in `supabase/migrations/`, source query patterns, and a read-only inspection of the linked Supabase project (`mmtymicfcqirppfpljnp`, PostgreSQL 17). Its `public` schema reports 43 tables, all with RLS enabled. The repo contains 13 migration files while the remote migration ledger has 12 entries with timestamp/name mismatches. Reconcile that drift before any schema migration.

No generated Supabase TypeScript database types are checked into the repository. The connected database can generate types, but doing so is an implementation step, not a schema change in this proposal.

## Proposed shape

The target logical design contains **68 proposed tables across 10 domains**. This is a design inventory, not a promise that 68 tables must be created in one migration. Existing task/notification and invoice-related tables need an explicit transition/mapping; they are not silently replaced. The existing invoice subsystem is outside the new general-ledger scope and must remain isolated until a separately approved migration.

| Domain | Tables | Responsibility |
|---|---:|---|
| Workspace & identity | 8 | Auth-linked profiles, memberships, role grants, permissions, audit |
| Clients, projects & quotas | 11 | Client identity, briefs, guidelines, packages, quota periods |
| Creative workflow | 11 | Stable content identity, schedules, production, storyboard, revisions |
| Review & approval | 2 | Approval state and append-only decisions |
| Performance | 4 | Social accounts, metric definitions, publication-specific snapshots |
| Reports | 6 | Drafts, immutable versions and explicit source references |
| Studio resources | 7 | Drive metadata, assets, documents and generation jobs |
| Studio finance | 12 | Accounts, periods, journals, allocations, reconciliation and snapshots |
| Integrations | 1 | Workspace integration metadata and secret references |
| Existing operational support | 6 | Tasks, reminders, activity, notifications |
| **Total** | **68** | Proposed logical target |

## Core conventions

- PostgreSQL UUID primary/foreign keys; `gen_random_uuid()` defaults for newly created IDs.
- `timestamptz` for instants, `date` for calendar periods, and `numeric(20,2)` IDR amounts.
- Every tenant-owned row carries `workspace_id`; client-owned rows also carry `client_id`. Use composite unique keys and composite foreign keys so a valid UUID cannot accidentally cross workspaces or clients.
- `auth.users.id` is the authentication identity. `user_profiles` extends identity; it does not authenticate users.
- Primary/foreign keys use `ON UPDATE RESTRICT`. Deletes are restricted by default; cascade only for disposable draft children. Financial, audit and finalized snapshot records are append-only or retained.
- Mutable state uses text plus a `CHECK` or lookup table according to the change rate. Lookup tables suit permissions, roles, platforms, formats, categories and metrics; a PostgreSQL enum is reserved for genuinely stable values.
- JSONB is limited to immutable report payloads, renderer options and provider-specific metadata that has no stable relational query contract.
- Database constraints protect row-local facts. Cross-row invariants (balanced journal, same-client references, immutable posted/final records) require composite FKs, triggers and/or restricted atomic server-side functions.

## Existing vs proposed

Verified current schema includes clients, contents, publication schedules, performances linked to schedules, report drafts/versions with snapshot data, approvals/history, briefs, packages/quotas, storyboard rows, Drive document metadata and a substantial invoice/payment subsystem. Existing same-client composite references already protect some content, performance and report relationships. Preserve and extend those protections.

Not verified in the current schema: workspace tenancy, a permission-grant model, a general-ledger chart of accounts, journal entries/lines, closeable finance periods, finance-specific authorization, or separate rendering and Drive-upload states. Proposed names and relationships in this package must not be mistaken for existing production objects.

## Primary relationship spine

`auth.users → user_profiles → workspace_memberships → workspaces`; workspace owns clients and all operational domains. A client owns projects, content, packages and quota periods. One `contents.id` persists through the workflow; `content_schedules` is one-to-many; publication performance belongs to an individual schedule. Reports pin performance snapshot IDs and freeze data in version snapshots. Finance journals are the accounting source of truth; transactions are source/intake records and allocations are analytic links, never duplicate expenses. Drive owns binary files; PostgreSQL owns metadata and references.

## References

- Supabase RLS guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase database security: https://supabase.com/docs/guides/database/secure-data
- Supabase backups: https://supabase.com/docs/guides/platform/backups

See `entity-relationship.md` and `table-specifications.md` for the proposed model. See `open-decisions.md` before translating it into migrations.
