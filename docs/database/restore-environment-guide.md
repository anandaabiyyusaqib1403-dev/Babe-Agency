# Isolated restore environment guide

Status: **PLANNED; ENVIRONMENT NOT AVAILABLE**. No backup restore was attempted.

## Options

| Option | Advantages | Limitations / prerequisites | Assessment |
|---|---|---|---|
| Local Supabase stack on Docker Desktop | Isolated, low marginal cost, includes Supabase services and local Mailpit; good for structural/application rehearsal | Docker/WSL2/virtualization required; current firmware virtualization query returned false; C: space is low; Postgres 17 image and extension compatibility must be checked | Preferred if hardware/IT enables virtualization and Docker. Not ready today. |
| Isolated hosted Supabase project | Closest managed-platform behavior; supports controlled migration/restore checks | May incur cost; must be a separate project with no production traffic; project provisioning requires user approval/cost handling | Alternative requiring explicit approval. Not created. |
| Dedicated PostgreSQL 17 instance | Controlled version and restore process | Not a full Supabase runtime; auth/storage/platform schemas/services and extensions differ; possible cost/admin needs | Useful for SQL structural recovery checks only; not sufficient by itself to prove full Supabase application recovery. |

## Local requirements

- Windows 10 Pro 22H2 x64 build 19045 meets the Windows version listed by current Docker Desktop documentation. 16 GB RAM is available; WSL version 3.0.3.0 was detected.
- Docker Desktop requires WSL2/virtualization. Windows feature status could not be queried without elevation; CPU firmware virtualization/SLAT was reported false. Confirm with system owner/BIOS/UEFI before installation. Some prerequisite changes require administrator permission.
- PostgreSQL 17-compatible Supabase stack and extensions used by the source project; no local database client/server exists today.
- Put images/volume/dump scratch files on an approved volume with adequate capacity. Current C: has about 2.3 GB free; D: ~192 GB and E: ~1.94 TB free, but data security and expected backup size still need approval.
- Separate local `.env`/project credentials from production. Do not link or configure production URLs, service keys, SMTP, workers, webhooks, publishing integrations, or scheduled jobs in the recovery app.
- Configure local mail capture (e.g. Mailpit), block external egress where practical, and verify no real email or callback can be sent.

## Restore test sequence

1. Verify the backup manifest/checksum before import.
2. Create an empty isolated target using a compatible PostgreSQL 17 Supabase image or an approved separate Supabase project.
3. Use official Supabase restore steps for roles/schema/data. Confirm current CLI/restore syntax first; stop on any errors instead of skipping them.
4. Check schemas/tables/columns, constraints, indexes, sequences, views, functions/grants/owners, triggers, RLS policies, extensions, and representative non-sensitive counts/references against the remote inventory.
5. Record exclusions for Storage binary objects, Drive files, edge functions, Auth settings/secrets, and platform-managed dependencies.
6. Validate basic application startup only with isolated configuration and synthetic/read-only actions. No publishing, invitation, finance-posting, or production-side effects.
7. Record start/end time, versions, command status, errors, comparison results, and cleanup. Do not call the backup proven until all acceptance checks pass.

## Current result

No Docker, local PostgreSQL, or isolated project is available; hardware virtualization is unresolved. This guide documents a future isolated test only. Restore remains **NOT PERFORMED**; no production connection or database was changed.
