# RLS security matrix

## Existing state and target

Read-only inspection of the active Supabase project reports RLS enabled on all 43 `public` tables. This proves RLS is enabled, not that each current policy is correct or equivalent to the target design. Existing membership uses `agency_members` with owner/admin/member roles; the proposed target introduces workspaces, memberships and permission grants. Do not apply target policies until ownership and data migration are mapped. Finance permissions/roles are intentionally undecided.

Supabase Auth authenticates users. RLS should call a small, indexed, stable helper such as `has_workspace_permission(workspace_id, permission_key)` using `auth.uid()` and active membership grants. Avoid recursive policy references; helper functions must use carefully reviewed `SECURITY DEFINER`, fixed `search_path`, minimal grants and no caller-controlled tenant arguments. Revoke `anon` access unless a specific public use case is approved. Supabase service-role key bypasses RLS and must stay server-side; worker access should use the narrowest supported server credential and explicit audit identity.

## Proposed role model

Recommended baseline capabilities (not final role names):

- **Workspace owner/admin**: membership administration, integrations, global settings; finance access only with explicit finance capability.
- **Creative operator**: equal routine access to clients/content/schedules/approvals/resources/reports as granted by workspace; no finance reads or writes by default.
- **Finance operator**: finance read and draft transaction/journal entry capabilities; posting/closing separated into an elevated capability.
- **Finance approver/controller**: approve/post/close/reverse through audited server functions; consider separation of duties from creator.
- **Read-only/auditor**: scoped SELECT for assigned domains and immutable audit/report history.
- **Document worker**: server-only job claim/update and Drive metadata operations needed to render/upload; no broad browser role.

Users may hold multiple capabilities. This avoids locking final finance role names before the owner approves them. Client-level assignment is an optional scope layer; global creative parity should remain the default if consistent with product direction.

## Action matrix

Legend: `R` select, `C` insert, `U` update, `D` delete, `X` privileged server transition only, `—` denied by default. “Creative member” means active workspace membership with creative capability; “Finance creator/approver” are proposed capabilities, not approved roles.

| Data domain | Owner/admin | Creative member | Finance creator | Finance approver | Auditor | Worker |
|---|---|---|---|---|---|---|
| Profiles and memberships | R/C/U/X | R own / R members limited | R own | R own | R scoped | — |
| Clients and briefs | R/C/U/archive | R/C/U | R only if separately granted | R only if separately granted | R scoped | — |
| Content, schedules, production | R/C/U/archive | R/C/U | — | — | R if assigned | — |
| Approval current state/events | R/C/X | R/C/X within assigned workflow | — | — | R | — |
| Performance snapshots | R/C | R/C | — | — | R | C/X if collector authorized |
| Draft reports and items | R/C/U | R/C/U | — | — | R | — |
| Final report versions | R/C/X finalize | R/C/X if permission | — | — | R | C/X only for associated document jobs |
| Assets/documents metadata | R/C/U/archive | R/C/U | R only if finance evidence scope | R if needed | R | R/C/U for jobs only |
| Finance transaction drafts | — unless explicit finance grant | — | R/C/U | R | R | — |
| Posted journals/lines | — unless explicit finance grant | — | R (no mutation) | R/X post/reverse | R | — |
| Finance period/close | — unless explicit finance grant | — | R | R/X close/reopen | R | — |
| Finance attachments/reconciliation | — unless explicit finance grant | — | R/C/U | R/X complete | R | — |
| Audit events | R scoped | R own/limited | R finance scope | R finance scope | R | C through server-only event interface |
| Integrations/secrets metadata | R/C/U/X | — | — | — | R metadata only | R server-side config reference only |
| Queue/job attempts | R admin status | — | — | — | R operational view | R/C/U claim/run through RPC |

Admin should not automatically inherit finance data access. Define owner override behavior only after policy approval and record every such access/action.

## Policy shape by table family

1. Enable RLS for every workspace-owned table. `USING` and `WITH CHECK` require `auth.uid()` to resolve to an active membership in `workspace_id` with the required permission; client rows must also match an allowed `client_id` scope.
2. Membership table policies allow a user to read their own membership and admins to manage memberships. Prevent self-escalation and owner removal through direct row updates; use audited RPC for invitations, role grants and owner transfer.
3. Lookup catalogs that are global and non-sensitive (e.g. metric definitions/platforms) may have authenticated read-only policy; role/permission assignment remains server-managed.
4. Append-only audit, approval, performance and finalized snapshot tables allow scoped `SELECT` and controlled `INSERT`; deny `UPDATE` and `DELETE` to application roles. Server transition functions insert events.
5. Finance tables require finance-specific permission keys (`finance.read`, `finance.draft.write`, `finance.journal.approve`, `finance.journal.post`, `finance.period.close`, `finance.report.read`). No creative policy grants finance access by implication.
6. `finance_journal_lines` writes occur only through draft-entry functions; posting validates balanced totals and period state under transaction lock. Posted entries are read-only except reversal/adjustment workflow.
7. Background queues and integration config have no end-user policy unless a UI status projection is deliberately exposed. Workers call narrow RPCs and never receive browser service-role credentials.
8. Storage and Drive policies are separate from row RLS. If Supabase Storage remains as fallback, use private buckets, scoped object paths, signed URLs and matching authorization; Google Drive OAuth/token operations stay in server runtime.

## Policy testing and operational safeguards

Before shipping any migration, review `pg_policies`, table grants and function grants, then test as `anon`, authenticated users with no membership, active member, suspended member, cross-workspace member, creative-only member, finance-only member and worker. Test both reads and writes including forged `workspace_id`/`client_id`. Verify helpers do not leak membership existence and avoid unbounded joins. Turn on audit for sensitive finance exports and privileged role changes. Document break-glass process and credential rotation.

Official references: [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase database security](https://supabase.com/docs/guides/database/secure-data).
