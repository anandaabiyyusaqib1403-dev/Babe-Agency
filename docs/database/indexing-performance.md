# Indexing and performance

## Principles

Index only query paths that are part of a real screen, job or report. Use leading `workspace_id` for tenant-scoped access, then client/status/date columns used together. PostgreSQL automatically indexes primary/unique constraints, but not every FK; add supporting indexes where joins/filtering need them. RLS helper lookups must be backed by `(workspace_id,user_id,status)` and role/permission join indexes. Validate choices with `EXPLAIN (ANALYZE, BUFFERS)` on representative data after implementation; do not infer performance from index presence alone.

## Proposed query indexes

| Use case | Candidate index | Notes |
|---|---|---|
| Active members and RLS membership lookup | `workspace_memberships(workspace_id,user_id,status)` unique on workspace/user plus status | Keep status in policy lookup; role assignment `(workspace_id,membership_id,role_id)` and permission join reverse index `(workspace_id,permission_id,role_id)`. |
| Client list/filter | `clients(workspace_id,status,name)` | Use keyset pagination by `(name,id)` or stable created time; avoid unbounded client-side search. |
| Content planner | `contents(workspace_id,client_id,planned_for,workflow_status,id)` | Match actual filter/sort order; separate partial index for active/non-archived rows only if query predicate is stable. |
| Production board | `contents(workspace_id,workflow_status,updated_at DESC,id)` plus client-specific variant if most users filter client | Kanban should fetch counts/page per status, not all content plus client-side filtering. |
| Publishing calendar | `content_schedules(workspace_id,scheduled_at,status,id)` | Add `(workspace_id,client_id,scheduled_at)` for client-filtered calendar. Restrict range to visible calendar window. |
| Content → schedules lookup | `content_schedules(workspace_id,client_id,content_id)` | Supports detail view and quota/report expansion. |
| Approval queue | `content_approvals(workspace_id,status,created_at,id)` and `(workspace_id,client_id,status,created_at)` | Consider partial index `WHERE status='pending'` only if frequent and status semantics fixed. |
| Approval history | `content_approval_events(approval_id,occurred_at,id)` | Append-only chronological history. |
| Performance history | `publication_performance_snapshots(workspace_id,client_id,schedule_id,captured_at DESC,id)` | Latest snapshot per publication can use `DISTINCT ON`/lateral query; consider partial “current” projection only if measured need justifies maintaining it. |
| Metric filtering | `publication_metric_values(metric_id,snapshot_id)` | PK `(snapshot_id,metric_id)` supports lookup by snapshot; reverse index supports metric aggregates. |
| Report drafts | `(workspace_id,client_id,period_start,status)` on both report parent tables | Unique period constraint handles exact period lookup. |
| Report version references | `report_version_performance_refs(monthly_version_id,performance_snapshot_id)` and social counterpart | Index source snapshot reverse lookup if used in traceability queries. |
| Drive metadata | Unique `(workspace_id,drive_id,drive_file_id)`; `(workspace_id,client_id,name)`; `(workspace_id,modified_at DESC)` when browsing | Use Drive page token/continuation at integration layer; do not fetch every Drive file into DB just to browse. |
| Asset library | `(workspace_id,client_id,asset_type,status,created_at DESC)` | Filter/archive by tenant/client and type. |
| Document archive | `(workspace_id,client_id,document_type,created_at DESC)` | Keep null-client workspace documents queryable through workspace/type index. |
| Render/upload queue | Partial indexes `(next_attempt_at,created_at)` where render queued/failed and upload pending/failed | Worker claims rows with `FOR UPDATE SKIP LOCKED`; keep separate state indexes and bounded retry batches. |
| Finance transactions | `(workspace_id,transaction_date DESC,id)`; `(workspace_id,status,transaction_date DESC)`; `(workspace_id,client_id,transaction_date DESC)` | Date range and client reports; avoid indexing free-text memo without a concrete search need. |
| Journal lookup | `finance_journal_entries(workspace_id,period_id,entry_date,status)` and `(workspace_id,entry_date DESC,id)` | Period and chronology. |
| Journal line ledgers | `(workspace_id,account_id,journal_entry_id)` and `(workspace_id,client_id,project_id,journal_entry_id)` | Join to posted entries; account statement should filter posted parent and date range. Denormalized `entry_date` requires consistency trigger, so prefer join unless profiling justifies it. |
| Reconciliation | `(workspace_id,account_id,status,statement_end DESC)`; unique `(reconciliation_id,journal_line_id)` | Reconcile within account and statement period. |
| Profitability allocations | `(workspace_id,client_id,project_id,journal_line_id)` | Aggregate analytic attribution without treating allocations as new postings. |
| Finance snapshots | `(workspace_id,period_id,report_type,created_at DESC)` | Snapshots are immutable and scoped by accounting period. |
| Audit | `(workspace_id,occurred_at DESC,id)`; `(workspace_id,entity_type,entity_id,occurred_at DESC)` | Consider monthly partitioning only after volume and retention requirements are known. |
| Notifications | `(workspace_id,recipient_membership_id,read_at,created_at DESC)` | Partial unread index may help if unread inbox is frequent. |

## Query strategies

- Use server-side pagination with stable keyset cursors for growing lists; use offset only for small bounded result sets.
- Select only columns required by a screen. Fetch content rows and their schedule counts/next publication through grouped queries or views, avoiding one query per card (N+1).
- Dashboard tiles should use bounded SQL aggregation or materialized summaries with a documented refresh/invalidation path. Never download all content/performance/finance rows to compute totals in the browser.
- Calendar screens request a date range plus a reasonable lookback/lookahead; include timezone conversion at the application boundary and preserve timestamps as instants.
- Quota usage should query `count(distinct content_id)` over eligible contents and period dates; add a partial/content index supporting status and creation/planned date. Cache only after load measurements.
- Latest performance for each publication should select latest snapshot by schedule with an index-supported lateral/`DISTINCT ON` query. Report finalization copies chosen snapshots into immutable version data.
- Finance reports should aggregate only posted entries in the selected period and accounting basis; period and account indexes support this. Trial balance and cash-flow queries need query plans reviewed against realistic journal volume.
- Drive list/browse uses provider pagination and stores only referenced/indexed file metadata needed by BABE. Avoid recursive full-drive scans.
- Realtime is selective: subscribe to active board/approval/queue changes only. Do not stream every table or whole finance ledger to clients.

## Risks and review points

RLS predicates may dominate cost if helper functions scan unindexed membership joins. Composite foreign keys ensure integrity but add write/index cost; create only keys needed for real scope invariants. JSONB snapshot payloads are for retrieval/rendering, not high-cardinality filter fields. A high-churn queue needs bounded claim batches and retry backoff. Audit partitioning, summary tables and read replicas are later optimizations, not MVP prerequisites.
