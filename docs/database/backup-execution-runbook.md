# Manual database backup execution runbook

Status: **PLANNED; NOT EXECUTED**. Requires explicit approval before any production backup, plus tooling, secure credentials, and approved encrypted storage.

## Preconditions

- Confirm the current project in Supabase is `BABE AGENCY`, ref `mmtymicfcqirppfpljnp`, `ACTIVE_HEALTHY`, PostgreSQL 17.x.
- Confirm Free plan limitations: no managed daily backup; this is a manual export.
- Verify stable Supabase CLI, Docker runtime if required by the CLI workflow, and current command syntax with `supabase db dump --help`. Verify `pg_dump`/`pg_restore`/`psql` version 17.x if required.
- Choose an encrypted offsite destination with access controls and enough free space for expected dump plus working copy. Current D:/E: free space is not itself approval/security qualification. Do not write to Git repository, public URL, app storage, or C: (only about 2.3 GB free).
- Obtain a secure credential injection workflow. No credential may appear in command text/history, logs, docs, or process arguments. If the selected CLI cannot use an approved secret mechanism, stop.
- Record approval, operator, time window, and a recovery environment plan. Do not run migration or schema changes.

## Execution sequence (approved run only)

1. Create a dated, access-restricted directory at the approved backup destination. Never commit it.
2. Reconfirm project ref, project name/status, PostgreSQL version, and exact connection mode. Prefer direct connection; use shared session pooler if network is IPv4-only and direct IPv6 is unavailable. Enforce SSL with certificate verification where supported.
3. From a clean temporary working directory outside the repository, follow current official Supabase CLI backup guide. Export the roles-only, schema, and data SQL artifacts with `supabase db dump`. Inspect `supabase db dump --help`; do not copy commands with a literal password-bearing URL into shell history.
4. Capture command exit code and stderr in a restricted log; redact secrets. Stop on any nonzero result, skipped object, permission issue, or unexplained warning. Do not represent partial files as a complete backup.
5. Record each artifact byte size and SHA-256 using `Get-FileHash -Algorithm SHA256`. Repeat after transfer. Record versions, project ref, UTC time, included/excluded scope, and warnings in [backup manifest](./backup-manifest.md) or the protected operational manifest; no secrets.
6. Verify format/readability: CLI outputs SQL scripts, so inspect file headers and use PostgreSQL-compatible client checks. `pg_restore --list` applies only to custom/directory/tar archives, not plain SQL CLI output. Do not run a restore against production.
7. Restore to an isolated, compatible recovery target and complete the [restore environment guide](./restore-environment-guide.md). Only after restore acceptance may integrity/readiness status be raised.
8. Encrypt and retain files under an approved retention schedule. Restrict access and record who can decrypt. Never upload the binary backup to GitHub.

## Recovery scope

Supabase CLI dump filtering should protect against indiscriminate dumping of Supabase-managed internal schemas. Database exports are not a full platform backup: Storage object bytes, external Google Drive files, Edge Functions, project configuration/secrets, and provider settings require separate treatment. Review current official guidance and list exclusions in the manifest.

## Failure handling

If the connection or dump fails, stop. Preserve only logs that contain no credentials, discard incomplete outputs according to the approved secure-data handling policy, and mark backup unavailable. Do not retry indefinitely, disable TLS, reset passwords, change network allowlists, alter production settings, or substitute raw `pg_dump` without a reviewed scope plan.

## Approved references

- [Supabase CLI backup and restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase PostgreSQL connections](https://supabase.com/docs/guides/database/connecting-to-postgres)
