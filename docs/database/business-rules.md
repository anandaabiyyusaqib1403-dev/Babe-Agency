# Database business rules

This document separates database-enforceable invariants from backend workflows. All rules describe the proposed design unless identified as verified existing behavior.

## Identity, tenancy and clients

1. Supabase Auth is the sole authentication identity. `user_profiles.user_id` references `auth.users.id`; membership grants workspace access.
2. Every tenant-owned row has `workspace_id`; client-owned rows also have `client_id`. Composite FKs must validate both ownership scopes. Never trust a client-supplied workspace or client ID without checking the authenticated membership.
3. A user can operate only through an active membership. Membership suspension/revocation takes effect in database policies and server actions.
4. A client is archived rather than hard-deleted once it has operational, report, document or financial references.
5. Project, package assignment, quota period, content pillar and all child records must refer to the same client and workspace.

## Content, schedule and quota

6. One `contents.id` is the stable Content ID from idea through library and reporting. Idea Bank is a workflow status on the same content row, not a separate content record.
7. A content item may have many `content_schedules`; each schedule is a distinct platform publication instance. Publication-specific identifiers, times, status and performance belong to schedule ID.
8. Quota consumption counts unique Content IDs in a quota period (and only according to an explicitly configured eligible status), never publication schedule count. Unique-content aggregation must be server-side and race-safe if usage is later materialized.
9. Content format/platform/status keys are validated against lookup/check constraints. Storyboard positions are unique within a storyboard; parent rows must belong to the same storyboard and cannot self-reference.
10. A client-facing attachment, project, pillar or schedule cannot reference another client through a valid but unrelated UUID.

## Approval and performance

11. `content_approvals` is a current-state projection. Every submitted, approved, changes-requested, cancelled or reopened decision creates an immutable `content_approval_events` record with actor, revision and time. Updating current status never deletes history.
12. Performance snapshots reference one publication schedule and are append-only. A refresh inserts a new snapshot; it does not overwrite historic values.
13. Metric value type and unit follow the referenced metric definition. Validate metric/value compatibility in a controlled write function or trigger.

## Reports and documents

14. Monthly and social reports remain separate domain types with separate drafts and version sequences.
15. A finalized report version captures immutable `snapshot_data`, version/template metadata, deterministic hash, finalizer and timestamp. Once finalized, no update/delete policy is granted; corrections create a new version or replacement report with provenance.
16. Finalized report sources pin exact performance snapshot and schedule IDs. Regenerating the same report later cannot silently change its historic content.
17. Every generated document stores explicit source references, template/version and render result. Generated binary bytes live in Drive; PostgreSQL stores metadata and references.
18. Document rendering and Drive upload have independent statuses and retry histories. A successful render remains available when upload fails.
19. OAuth credentials are not stored in client-visible rows or exposed to browser code. Only server-side worker/service access resolves secret references.

## Double-entry finance

20. A journal entry has two or more lines. Each line has exactly one positive side (`debit_idr` xor `credit_idr`); posting requires sum(debit) = sum(credit), same workspace, IDR currency and an open period.
21. Cross-row balancing cannot be enforced with a row `CHECK`. A single transaction-safe posting RPC validates the lines, approvals/permissions, period, balance and idempotency, then marks the entry posted. Direct client update/insert of posted journal state is denied.
22. Once posted, journal header and lines are immutable. Correction is a separately approved reversal or adjustment with explicit `reversal_of_entry_id`; source and reversal remain queryable. The source is not overwritten or deleted.
23. Transfers debit one cash/bank asset account and credit another asset account. They affect account balances/cash movement but never map to income or expense P&L categories. Transfer classification must be validated at posting.
24. Income and expense reports are derived from posted journal lines and account/category mappings. Cash basis uses cash-account movement; accrual basis uses recognition accounts and posting dates/rules. Do not infer accounting basis from a single transaction date or raw invoice payment total.
25. `finance_transactions` is an intake/source envelope; posted debit/credit journal lines are the financial authority. Avoid storing duplicate authoritative transaction amount totals.
26. Allocations link eligible existing expense journal lines to client/project for profitability. They do not create a second journal or alter agency-wide P&L. Allocation totals cannot exceed the source line amount; a shared allocation basis must be explicit and reproducible.
27. A closed period blocks new posting, backdated posting and line changes. Reopening requires privileged audited action, reason, actor and downstream report impact review. Prefer adjustments in an open period.
28. IDR is the MVP functional currency. Foreign currency, FX revaluation, tax, payroll, invoice management, budgeting and payment gateways are out of scope until approved.
29. Every finance state transition records actor, timestamp, action and source; include immutable audit events for draft edits if regulatory/accounting policy requires field-level history.

## Database vs backend enforcement

| Rule | Database control | Backend/service control |
|---|---|---|
| Tenant/client isolation | RLS plus composite FK/unique keys | Resolve tenant from authenticated membership; never accept it blindly |
| Unique Content ID | PK and stable lifecycle FK | Reuse existing content row across screens |
| Multi-publication | One-to-many schedule FK | Create/update schedule independently |
| Distinct content quota | Required rows/status/date constraints | Atomic count/consume/reservation to avoid concurrent overrun |
| Approval history | Append-only event table and grants | Validate transition and eligible reviewer |
| Publication-specific performance | Snapshot FK to schedule | Import/collect metrics for exact external post |
| Immutable report version | No update/delete grants, immutable trigger/function | Finalize snapshot and calculate hash transactionally |
| Generated source references | FK where typed; source hash/version | Populate exact inputs/template on job creation |
| Journal balance | Atomic RPC/constraint trigger on posting | Validate accounting semantics and permission |
| Closed period and reversal | Restricted state transitions, FK, trigger | Require reason/approval, enforce idempotency and impact checks |
| No double-count allocations | Allocation constraints/source FK | Cap/reconcile allocations and exclude them from GL totals |
| OAuth confidentiality | Revoke browser table access, secret reference only | Resolve secrets in worker/server runtime |

## Delete and update policy

Use restrictive FK actions as default. Soft archive business entities where recovery or historical readability matters. Delete only disposable draft children and join rows. No cascading delete of finance records, audit trail, finalized report snapshots, published performance, approval events or generated-document history. All PK updates are restricted. See `table-specifications.md` for per-table mapping and `open-decisions.md` for unresolved details.
