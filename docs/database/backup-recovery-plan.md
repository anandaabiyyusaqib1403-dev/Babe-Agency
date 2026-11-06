# Supabase backup and recovery plan

Assessment: 2026-11-06 (Asia/Jakarta)  
Project: `BABE AGENCY`, ref `mmtymicfcqirppfpljnp`  
Project state: ACTIVE_HEALTHY; PostgreSQL `17.11.0.011` (engine 17)  
Organization plan: Free

## Current result

| Item | State | Evidence |
|---|---|---|
| Project identity | VERIFIED | Supabase project detail returns the requested ID/name, active status, region, and DB version. Local `.env.local` URL host matches this ref; no URL credential was emitted. |
| Automatic managed backups | NOT AVAILABLE | Current Free plan. Supabase says daily managed backups are for Pro/Team/Enterprise; Free projects should export with CLI. |
| Manual database dump | NOT EXECUTED | No Supabase CLI, Docker, `pg_dump`, `pg_restore`, or `psql` found; no connection password/string variable found in the process environment. No database connection options/credentials were exposed. |
| Recovery environment | NOT AVAILABLE | No local PostgreSQL service or Docker executable; no isolated Supabase branch was present. No paid or separately provisioned project was created. |
| Local disk capacity | PARTIALLY VERIFIED | The inspected D: and E: volumes have free space, but no approved encrypted offsite backup destination was identified. Free space alone does not satisfy backup storage requirements. |
| Backup file / manifest | NOT AVAILABLE | No backup was created; see [manifest](./backup-manifest.md). |
| Integrity / restore | NOT PERFORMED | No file and no recovery target; see [integrity report](./backup-integrity-report.md) and [restore report](./restore-test-report.md). |

## Official method assessment

Supabase documentation was checked on 2026-11-06:

- [Database Backups](https://supabase.com/docs/guides/platform/backups) states daily managed backups cover Pro, Team, and Enterprise. Free projects should regularly export with Supabase CLI and maintain offsite copies. Storage API objects themselves are not included in database backups.
- [Free plan backup FAQ](https://supabase.com/kb/faqs/platform/free-plan-backups) confirms no automatic backup on Free.
- [Backup and restore using CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) documents CLI logical dumps split into roles, schema, and data SQL, with Docker and PostgreSQL client tooling. It recommends `supabase db dump` because it applies Supabase-specific filtering; raw `pg_dump` can include internal schemas and fail on permissions.
- [Local development](https://supabase.com/docs/guides/local-development/overview) documents running an isolated local Supabase stack. A production restore rehearsal needs a separate target and compatible extensions.

| Method | Compatibility/coverage | Assessment |
|---|---|---|
| Supabase-managed daily backup | Not included on current Free plan. Storage objects are outside the database backup. | NOT AVAILABLE for this project plan. |
| Supabase CLI `db dump` | Official logical export path; supports role/schema/data dump files and Supabase filtering. Requires CLI, Docker and authorized DB connection access. | Recommended manual method once prerequisites are supplied. Not executed. |
| Raw `pg_dump` | PostgreSQL-native; can export database objects, but direct use on Supabase may include managed/internal schemas or hit permission issues. Version/flags matter. | Not selected as the first method; use only after exact scope and compatibility review. |
| Dashboard backup download | Available when a platform backup exists; Free has no scheduled daily backup. | No backup was listed/downloaded in this assessment. |
| Custom strategy | Encrypted offsite CLI dumps plus isolated restore rehearsal and retained manifest. | Recommended operating procedure; not yet active. |

## Required scope and exclusions

The planned CLI export should include application schema and data, constraints, indexes, functions, triggers, RLS policies, views, database grants/roles as represented by the supported tool, and `auth.users`/related database records where the Supabase CLI workflow includes them. Validate exact behavior with the installed CLI version before relying on it.

Explicit boundaries:

- Supabase-managed/internal schemas must not be dumped/restored indiscriminately. Use the supported Supabase CLI filtering and follow the current restore guide.
- Supabase Storage database metadata is distinct from stored binary objects. A database dump does **not** back up the Storage API object bytes. No Storage binary copy was performed.
- External Google Drive files are outside PostgreSQL and require a separate Drive backup/recovery process. No Drive content was copied.
- Edge Functions, project settings, API/JWT secrets, SMTP/provider configuration, DNS/custom domains, and some platform settings require separate export/reconfiguration; do not put secrets in the database manifest.
- Credentials for custom LOGIN roles may not be included. Auth configuration and platform encryption keys need separate treatment under Supabase’s restore guidance.
- Database exports may contain personal, client, and financial data; treat them as restricted confidential data.

## Planned manual backup procedure

Do not paste passwords or connection strings into chat, repository files, command history, or logs. An authorized operator should:

1. Install a current supported Supabase CLI and Docker. Confirm PostgreSQL 17 compatibility; retain CLI version output. If using raw clients, use PostgreSQL 17 client tools and inspect `pg_dump --version` / `pg_restore --version`.
2. Obtain connection details through Supabase Dashboard’s Connect panel and password through the approved secret manager. Prefer a supported connection method for the host network (direct or session pooler); do not rotate/reset the production password just to perform this audit.
3. Use `supabase db dump` per current official documentation to export roles, schema, and data. Keep the connection secret in a secure mechanism (not a literal shell argument that enters history/process listings). The operator must verify actual CLI options with `supabase db dump --help` before execution.
4. Write only to an access-controlled encrypted offsite destination, not the repository, public web root, or application storage bucket.
5. Record one manifest entry for each output file, including size and SHA-256; inspect CLI exit status and warnings. A checksum proves file identity, not restorability.
6. Confirm the resulting SQL can be parsed/read by compatible PostgreSQL tools and retain logs with credential strings removed.
7. Restore to an isolated recovery environment and complete the checks in [restore test report](./restore-test-report.md) before calling the backup recoverable.

## Recovery environment plan

Preferred first rehearsal: isolated local Supabase stack using Docker and PostgreSQL 17, with no production app URL, outgoing SMTP, scheduled tasks, or production worker credentials. Use synthetic/non-sensitive traffic for verification where possible. If the backup requires a hosted target, provision a separate project only after owner approval for any cost and configure it with no production traffic. Do not restore into production.

Current environment lacks Docker, Postgres clients/server, and a Supabase development branch. Therefore this plan is documented but not executed. No new Supabase project/branch was created.

## RPO / RTO

- **RPO: TBD.** No recurring manual backup schedule or verified backup cadence exists, so data-loss window cannot be guaranteed.
- **RTO: TBD.** No timed restore rehearsal, production database size/restore throughput measurement, or application reconnection runbook has been validated.

Do not promise a numeric RPO or RTO until backup cadence and timed recovery evidence are agreed and measured.

## Security and retention

Backups must be encrypted at rest and in transit, access limited to named database custodians, kept outside GitHub and production, protected by audit logging, and covered by an approved retention/deletion schedule. Keep at least one previous known-good backup only once a repeatable process and storage location exist. No binary dump is stored in this repository.

## Overall status

Backup method: **PLANNED**. Backup execution: **NOT EXECUTED**. Backup artifact: **NOT AVAILABLE**. Integrity: **UNVERIFIED**. Recovery environment: **NOT AVAILABLE**. Restore test: **NOT PERFORMED**. RPO/RTO: **TBD**. Database change readiness remains **BLOCKED**.
