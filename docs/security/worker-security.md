# Worker security

## Current worker model

The repository contains `scripts/background-worker.mjs`. Existing worker setup reads Supabase service-role credentials and performs privileged queue claims, report/invoice PDF work, Google Drive operations and table updates. This is server-side and separate from browser clients, but use of service role bypasses RLS. The checked-in migrations include queue RPCs and a service-role-only orphan-upload policy. This review did not inspect live runtime environment values and did not expose secrets.

## Target controls

- Store service-role and Google OAuth refresh credentials only in a server secret store/runtime environment. Never prefix with `NEXT_PUBLIC_`, include in client bundles, return them in API payloads or log them.
- Keep separate web and worker credentials where feasible. Prefer narrow RPCs/worker identity and minimal table privileges; service-role use must be limited to a small reviewed module. If the service role is required for Auth Admin invitation, isolate that call in a server-only adapter.
- Worker claims jobs atomically using a narrow RPC, short lease, idempotency key, bounded batch and `FOR UPDATE SKIP LOCKED`; do not expose unrestricted queue writes to normal authenticated clients.
- Validate queue row scope and all referenced workspace/client/source records before processing. Treat job payload, file metadata and provider response as untrusted input.
- Separate worker phases/status: render versus Drive upload; preserve a successful PDF if upload fails; retries use exponential backoff, jitter, maximum attempts and dead-letter/visible failure state.
- Use request/job correlation IDs. Logs include actor/workspace/job identifiers and safe error codes only; never log passwords, access/refresh tokens, service keys, full invitation/recovery links, signed URLs or sensitive finance payloads.
- Apply timeouts, file-size/type limits, path/name sanitization, MIME validation and safe PDF rendering. Prevent arbitrary URL fetching/server-side request forgery in render templates.
- Rotate credentials, audit access and document break-glass procedures. Worker cannot bypass business approval or period-close rules merely because it runs with privileged DB credentials.
- Treat each privileged operation as an authorization boundary: Auth invite may only be called after a server-side `members.invite` check, never from a browser SDK.

## Required implementation checks

Review worker process isolation, deployment runtime, secret source, restart behavior, lease recovery, duplicate delivery, temporary-file handling, and Google token refresh. Verify failed render/upload retries and that job requeue RPC validates scope. Confirm current project RLS bypass behavior and function grants after migration history is reconciled. No worker or secrets were changed as part of this documentation task.
