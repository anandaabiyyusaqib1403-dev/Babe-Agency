# RLS policy review

## Evidence and limits

Read-only project inspection reported 43 `public` tables with RLS enabled. Supabase Security Advisor was queried on 2026-11-06. Local migration SQL (13 files) was statically searched/reviewed for `CREATE POLICY`, `USING`, `WITH CHECK`, grants/revokes, RLS enablement and security-definer functions. The remote migration ledger/schema history is out of sync with the local migration set (see `docs/database/migration-plan.md`).

The available tools did not expose a read-only listing of every **currently deployed** policy definition, table grant and `pg_policies` row; the task forbids SQL execution. Therefore this is a migration-source and Advisor review, not a certified live policy-by-policy test. Do not represent source policy text as guaranteed to be the current remote effective state.

## Current policy patterns found in checked-in migrations

- `agency_members` uses row-level own-member read plus manager read/insert/update/delete policies; manager helper recognizes active `owner/admin`. A trigger prevents non-owner owner assignment and guards the last active owner.
- `agency_settings` uses active-member read and membership-manager write policies.
- The comprehensive schema migration grants CRUD and a general `FOR ALL` policy to active members for many tables. That is an agency-wide shared-membership boundary, not permission-based or client-level access isolation.
- Some sensitive/history tables are narrower: approval history and brief versions are read-only; activity/history events have insert/update/delete revoked; notification updates are limited to own read state; document upload orphan records are service-role only.
- Invoice and invoice-payment policies generally permit active members to read financial invoice information, with some draft mutation constrained to creator and state. This is not finance-specific access control and can expose finance-adjacent information to creative members.
- Policies call helpers such as `is_active_agency_member()` and `can_manage_agency_members()`; they are `SECURITY DEFINER` with a fixed empty `search_path` in checked-in SQL. Such helpers still need careful execute grants and logic review.

## Remote Security Advisor findings

1. **15 authenticated-callable `SECURITY DEFINER` functions — WARN.** Names include membership helpers, invoice allocation/finalization/payment/cancellation, report finalizers, dashboard finance summary and document/report-job operations. This is not proof of exploit by itself, but each function must be reviewed for caller authorization, object scope, fixed `search_path`, parameter validation and minimum `EXECUTE` grant. In particular, finance summary RPC access and invoice RPCs must not make privileged state readable/mutable to every authenticated member.
2. **Leaked password protection disabled — WARN.** Supabase reported compromised-password checking off. Recommend enabling it after owner approval and verifying resulting password policy; it was not changed during this task.

See [Supabase database linter finding: authenticated SECURITY DEFINER execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Required review by operation

| Surface | Current static-review concern | Target requirement |
|---|---|---|
| SELECT | Broad active-member policies expose shared data; invoice/payments are not finance-isolated | Workspace + permission + client scope; explicit finance read grant |
| INSERT | Active membership is often sufficient, with table-specific checks | `WITH CHECK` binds actor, workspace/client, permitted state and ownership |
| UPDATE | Active-member `FOR ALL` paths can allow broad mutation unless table grants narrow it | Restrict columns/state transitions; protect posted/final/history rows; actor may only change permitted fields |
| DELETE | CRUD grant + broad policy on some tables; semantic deletion needs per-domain confirmation | Deny on financial/history/finalized rows; soft-archive only eligible records |
| `USING` | Helpers may be safe but membership-wide; object scope is not a client boundary | Check active membership, capability and tenant/client parent relationship |
| `WITH CHECK` | Must be evaluated for tenant/owner reassignment on every insert/update | Revalidate new row scope and relationship, not merely membership existence |
| Recursion | Definer helpers reduce policy self-recursion risk, but must be minimal and safe | Avoid querying protected membership tables via recursive invoker policies; use audited narrow helpers |
| Privilege escalation | Role guard protects owner transitions in SQL; exact effective grants unverified | No self-elevation, no forged target workspace, controlled owner transfer and role grant RPC |
| Cross-workspace/client | Current single-agency model is not a multi-workspace/client membership design | Tenant-scoped keys/policies and composite FKs; explicit client assignment only where approved |
| Finance leakage | Shared active-member access and Advisor finance RPC warnings | Finance permissions at both RLS and server action/RPC; no finance from Head/Developer title |

## Actions before implementation

After migration reconciliation, capture `pg_policies`, table/sequence/function grants, `prosecdef`, function definitions, triggers, and `anon/authenticated/service_role` grants through an approved read-only audit. Review every exposed RPC including all 15 warnings. Test policies as anonymous, no-membership, active, suspended, deactivated, creative-only, finance-only, cross-client and cross-workspace users. Check `USING` and `WITH CHECK` independently; a safe SELECT policy does not imply safe writes. Test nested foreign-key joins, views, storage buckets and signed URLs. Do not “fix” policy warnings by blindly changing all functions to invoker; some require definer semantics but need explicit authorization and minimal grants.
