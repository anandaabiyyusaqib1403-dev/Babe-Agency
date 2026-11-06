# Database recovery procedure

Status: **PLANNED; NOT PROVEN** (assessment date 2026-11-06). Project ref: `mmtymicfcqirppfpljnp`.

## Activation conditions

Use this runbook only after an incident commander/database owner authorizes recovery, the target and recovery point are identified, and the backup passes integrity checks. Do not run any restore against production as a test. Production recovery requires a separate explicit incident decision and a vendor/platform procedure appropriate to the incident.

## Manual logical backup recovery (planned)

1. **Identify artifact:** select the manifest record for the approved project and recovery point. Confirm encrypted file availability, SHA-256, size, tool versions, and included/excluded scope.
2. **Prepare target:** provision an isolated, access-restricted Supabase/PostgreSQL environment compatible with PostgreSQL 17 and required extensions. Disable production webhooks, SMTP delivery, workers, and application traffic. Use separate credentials and no production connection string in the target app.
3. **Restore:** follow current Supabase CLI backup/restore instructions for roles, schema, and data files. Inspect current `--help` and documentation before use. Stop on first error; do not ignore policy, trigger, ownership, or extension errors.
4. **Verify structure:** compare schemas/tables/columns, PK/FK/unique/check constraints, indexes, sequences, views, functions, owners/grants, triggers, RLS enablement/policies, and extensions with the source inventory and manifest.
5. **Verify data:** use read-only counts and referential-integrity checks for key application tables. Handle auth records and encryption dependencies according to the official Supabase guide. Do not export sample personal data into logs or reports.
6. **Verify dependencies:** restore/configure non-database items separately: Supabase Auth provider/settings and secrets, Storage object bytes, Edge Functions, SMTP, scheduled jobs, and external Google Drive files. Do not assume the PostgreSQL dump contains them.
7. **Application validation:** use an isolated app configuration and read-only/synthetic smoke checks. Confirm no messages, publishing, finance postings, scheduled tasks, or production callbacks can occur.
8. **Record result:** capture UTC start/end, source artifact ID/checksum, target engine/extensions, command/tool versions, errors, object/data comparison, exclusions, measured duration, approver, and cleanup decision. Redact secrets and personal data.
9. **Production cutover:** a separate approved incident plan must define writes freeze/capture, chosen recovery point, user communication, cutover, post-recovery integrity checks, and rollback/forward-fix. This document does not authorize cutover.

## RPO and RTO

**RPO: TBD. RTO: TBD.** No backup cadence exists and no restore has been timed. Estimate only after recurring backups are operating and an isolated rehearsal measures export, transfer, restore, verification, and application reconnection.

## Current execution state

No backup or restore command was run; no environment was created; no production DB change was made. Database-change readiness remains **BLOCKED**. For current evidence see [backup manifest](./backup-manifest.md), [integrity report](./backup-integrity-report.md), and [restore test report](./restore-test-report.md).
