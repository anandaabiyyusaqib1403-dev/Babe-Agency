# Security threat review

This is a design-time threat register informed by source inspection and Supabase Security Advisor (2026-11-06). Priorities: Critical = could expose or compromise protected agency/finance data; High = significant access abuse or account takeover path; Medium = meaningful abuse with compensating controls. A finding is not an exploit confirmation.

| Threat | Cause / impact | Mitigation | Priority / current evidence |
|---|---|---|---|
| Unauthorized registration | If hosted Supabase sign-up is enabled, anyone may create Auth identities; may reach app if membership logic fails | Disable public sign-up; invitation-only admin provisioning; active membership required at every DB/server boundary; test hosted setting | High; remote setting not inspected |
| Account enumeration | Different messages/status/timing disclose whether email belongs to BABE | Generic login/reset/invite responses, rate limits, uniform processing and no public member lookup | Medium; reset UI already generic; login propagates Auth error text in current source |
| Invitation abuse | Public resend endpoints, unbounded mail, weak tokens or role fields accepted from request | Admin-only invite in MVP; opaque expiring one-time links; rate limiting, idempotency, role allowlist, cooldown, audit; generic response | High; invite flow not implemented |
| Expired/replayed invitation | Reuse of old or expired link creates membership or resets password | One-time provider PKCE code; expiry; invalidate old invite on resend; atomically consume token and activate | High; flow not implemented |
| Privilege escalation | Client submits own higher role, impersonates inviter, or can assign owner | Server permission check, owner invariant/guard, prevent self-elevation, controlled grant RPC, audit before/after | High; SQL guard exists for current owner role; target RBAC absent |
| IDOR | Route/action accepts arbitrary member/client/document/invoice IDs and relies on UI hiding | Server-side permission/scope checks plus RLS; authorize exact object before Drive fetch/update; test forged IDs | High; routes use active-member gate; review all object-specific actions before multi-tenant rollout |
| Cross-workspace leakage | Current schema is agency-wide; future workspace key omission or broad RLS permits other tenant rows | Tenant keys, composite FKs, workspace permission helper and RLS; never accept tenant ID from body alone | Critical for multi-workspace; current target is effectively single agency |
| Cross-client leakage | Client-scoped objects linked only by independent UUIDs; unauthorized assignment/report access | Composite `(workspace_id,client_id,id)` FKs; server validation; client scope grants where needed | High; database design identifies future composite constraints; live current policies not enumerated |
| Finance data leakage | Active-member shared SELECT, invoice/payment exposure, definer finance RPCs | Finance-specific capabilities/RLS; restrict finance summary and invoice RPC; separate finance authority from Head/Developer title | Critical; broad migration pattern and Advisor warning on finance summary callable |
| Session hijacking/stale access | Leaked cookies/tokens or active JWT remains after deactivation | Secure HttpOnly/SameSite cookie setup; TLS; short reasonable expiry/refresh; immediate membership check in RLS; revoke/bank sessions; reauth sensitive actions | High; current session revoke behavior and hosted settings not inspected |
| Exposed service role key | Service key enters browser bundle, logs or public environment | `server-only` admin module; server secret store; bundle scan; least use, rotation, no disclosure | Critical; source marks admin client server-only and env name is server-only; deployment secret not checked |
| Unsafe deactivation | Only UI or `is_active` changes while session/JWT stays authorized; records deleted | DB membership state checked on each request; ban/revoke Auth sessions; preserve history and authored rows; transactional audit | High; no management flow currently found |
| Forged administrative request / CSRF | Attacker invokes Server Action/API route or mutates target role/email | SameSite/Origin protections, auth + permission check in every action, schema validation, rate limiting, no trust in hidden controls | High; settings actions use server context but there is no member admin flow |
| Callable SECURITY DEFINER functions | Authenticated can call privileged function endpoints; authorization checks may be insufficient | Review function body/grants, fixed `search_path`, explicit caller/object checks, revoke unused `EXECUTE`; retain definer only when needed | High; Supabase Advisor reports 15 functions |
| Weak/compromised password | Leaked-password screening disabled, weak credential reuse | Enable leaked password protection; configure minimum length/strength; require MFA for privileged accounts if available/approved | High; Supabase Advisor reports protection disabled |
| Audit tampering | Users update/delete history or privileged owner bypasses logs | Append-only audit grants/triggers; external retention/backup; audit sensitive export, role, finance and break-glass events | High; some event tables are read-only in migrations; full live grants not enumerated |
| Account enumeration by login | Login component displays raw Supabase auth error | Normalize to “Email or password is incorrect” and keep response shape/time similar | Medium; raw error currently shown in `login-form.tsx` |
| Worker credential misuse | Service role bypasses RLS and worker has broad access | Isolate secrets/process, narrow RPCs, validate job scope, safe logs, rotation and audit | High; worker uses service-role client in source |

## Prioritized response

1. Before Auth rollout, inspect hosted signup/confirmation/redirect/SMTP/password settings; disable signup if enabled and ensure generic login errors.
2. Review all 15 `SECURITY DEFINER` findings, prioritizing `get_dashboard_finance_summary`, membership helper functions, invoice mutations and document/job mutation RPCs. Confirm each callable operation is safe for any authenticated member or narrow its grants.
3. Separate finance visibility/access from creative members and verify finance-bearing invoices/billing profile data; do not assume current finance boundary is adequate.
4. Reconcile migration ledger before any policy or identity migration. Capture current effective policy/grant catalog using approved read-only access, then test negative cross-scope cases.
5. Add invitation and member-state lifecycle only after policy/role mapping is approved; preserve audit trail and block stale sessions through active-membership checks.

No exploit test, account mutation or configuration change was performed in this audit.
