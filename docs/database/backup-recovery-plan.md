# Backup and recovery plan

Audit date: 2026-11-06 (Asia/Jakarta)

## Current backup status

The Supabase organization/project is on the Free plan. Current official Supabase guidance says Free projects do not receive automatic database backups and should be exported manually with the Supabase CLI. No database dump was found locally; no database password/connection string, Supabase CLI, `pg_dump`, Docker, or `psql` was available in this environment. The connector does not provide a database dump/download operation. **No backup was created.**

Official references: [Supabase database backups](https://supabase.com/docs/guides/platform/backups), [Free plan backups FAQ](https://supabase.com/kb/faqs/platform/free-plan-backups).

## Backup procedure for an authorized operator

1. Obtain a current database connection string/password through the approved secret manager; never paste it into chat, docs, shell history, or logs.
2. Use the current supported Supabase CLI `db dump` workflow, or a compatible `pg_dump` connection, to export schema and data. Include relevant roles/grants if the chosen tool supports a safe supported method; separately inventory Supabase-managed Auth/Storage concerns because a PostgreSQL dump alone is not a complete service backup.
3. Encrypt the dump at rest and transfer it to an access-controlled offsite location with retention and access logging.
4. Record UTC timestamp, project ref, tool/version, dump format, byte size, checksum, object scope, excluded scopes, and operator. Do not record credentials.
5. Validate archive readability/checksum. This validates file integrity only, not recoverability.
6. Restrict access because backup may contain personal, client, and finance data.

## Restore rehearsal

No isolated PostgreSQL/Supabase recovery environment or dump was available, and no Supabase development branch existed. Creating a branch can incur cost and was not attempted. Restore testing is therefore **NOT PERFORMED**. A downloaded backup must not be called tested until restored to an isolated environment and verified.

When authorized resources exist:

1. Create or use a separate non-production project/database with access restrictions.
2. Restore the dump only into that isolated target; never use production for rehearsal.
3. Compare schema object counts, columns, constraints, indexes, RLS enablement and policies, functions/owners/grants, triggers, views/extensions, and representative non-sensitive data counts against the inventory.
4. Run application smoke checks against the isolated environment without pointing production clients at it.
5. Record restore command/tool version, duration, errors, checksums, verification output, and remediation. Destroy the rehearsal environment only through its documented lifecycle after evidence is retained.

## Recovery approach

- Prefer point-in-time or platform recovery only when the plan actually provides it and the recovery point is verified.
- For the current Free project, maintain encrypted manual dumps before any future migration and retain at least one known-good prior dump.
- Preserve local migration files and the live ledger; do not repair ledger rows by suffix/name guess.
- For application schema rollback, use a reviewed forward corrective migration where possible. Destructive rollback may lose data and is not a substitute for backup restore.
- Reconcile migration history and perform an isolated restore rehearsal before any production schema change.

## Recovery status

Backup artifact: **UNAVAILABLE**. Backup integrity verification: **NOT APPLICABLE**. Restore test: **NOT PERFORMED**. Recovery procedure: **DOCUMENTED, NOT PROVEN**. Database change gate remains **BLOCKED**.
