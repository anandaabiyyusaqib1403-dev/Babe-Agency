# Secure Supabase database connection guide

Status: **PLANNED / NOT TESTED**. No database connection was opened during the 2026-11-06 environment audit.

## Identity and version gate

Before any future backup, retrieve project details from Supabase and confirm the name `BABE AGENCY`, ref `mmtymicfcqirppfpljnp`, state `ACTIVE_HEALTHY`, and PostgreSQL `17.11.0.011`. The local CLI slug `Babe_agency` is not the project ref. Stop if any value differs.

## Connection method

For `pg_dump`/backup, Supabase recommends a direct database connection because these are single-session native PostgreSQL tasks. Direct endpoints use IPv6 unless the project has the IPv4 add-on. If the network is IPv4-only and the plan lacks an IPv4 add-on, choose the **shared session pooler** endpoint from the Dashboard Connect panel. Do not guess the pooler host or username from region/project name. Use the exact method-specific endpoint and username shown in Dashboard.

Use outbound TLS. Prefer `sslmode=verify-full` with the database server root CA certificate downloaded through Supabase Dashboard, when the client supports it. `sslmode=require` encrypts traffic but does not verify server identity. Never turn off SSL verification to make a failed connection work.

Network allowlists/firewalls must permit outbound DNS and TCP to the chosen endpoint/port. Direct PostgreSQL and shared session pooler use port 5432; transaction pooler uses 6543 but is not the chosen mode for dump/restore. Direct endpoint DNS may require IPv6 support. Network/TLS/connectivity have not been tested from this workstation.

## Credential handling

- Database password is not available to this process and must not be sent in chat.
- Obtain it only through an authorized password manager/Supabase Dashboard workflow. Do not reset production password solely for this audit.
- Do not put password-bearing URLs in source, `.env*`, command history, transcript, ticket, or logs.
- Never use Supabase `service_role`/secret API keys as a database password; API keys and PostgreSQL credentials are different credentials.
- Before using a CLI command that accepts a connection URL, verify a secure secret-injection approach for that exact CLI/client version so the password is not exposed in shell history or process arguments. If unavailable, stop and use an approved managed workstation/secret runner.
- For PostgreSQL clients, use an approved credential file/secret manager with restrictive Windows ACLs; do not leave a plaintext PGPASS file in the repository or shared user profile. Remove temporary credential material after use and redact verbose logs.

## Safe connection test (future, after approval)

1. Verify project identity and chosen connection endpoint out of band.
2. Resolve DNS and test TCP reachability only to that endpoint/port.
3. Open a read-only `psql` session using SSL verification and secure credential injection.
4. Run read-only identity/version checks only, such as `SELECT current_database(), version();` and a non-secret project identity check; close promptly.
5. Do not run DDL/DML, migration repair, Auth changes, or backup until a separate backup approval is recorded.

Connection timeout should be bounded (for example, 10–15 seconds); retries should be limited and never bypass TLS. Report only endpoint mode, success/failure class, and PostgreSQL major version—not a full URL or credentials.

## Current state

Identity: VERIFIED via Supabase project details. Connection options/password: NOT AVAILABLE to the audit process. Endpoint network/TLS: NOT TESTED. Secure connection readiness: **BLOCKED**.
