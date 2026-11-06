# Backup tooling readiness

Assessment date: 2026-11-06. Project: `BABE AGENCY` (`mmtymicfcqirppfpljnp`).

## Gate: BLOCKED

| Requirement | Status | Evidence |
|---|---|---|
| Correct Supabase project | VERIFIED | Project details confirm requested ref/name, ACTIVE_HEALTHY, PostgreSQL 17.11.0.011. |
| Windows / architecture | VERIFIED | Windows 10 Pro build 19045, x64. |
| OS security support | FAIL / NEEDS REVIEW | Windows 10 standard support ended 2025-10-14; ESU enrollment or migration to supported OS is unverified. Do not retain production dumps here until resolved. |
| Node / npm / Git | VERIFIED | Node 24.21.0, `npm.cmd` 11.19.0, Git 2.56.0. |
| PowerShell usable for setup | PARTIAL | Windows PowerShell 5.1; execution policy Restricted blocks `npm.ps1`; `npm.cmd` works. No policy bypass used. |
| Package managers | PARTIAL | `winget` and Chocolatey command paths present; Scoop absent. No package-manager inventory/install performed. |
| Supabase CLI | FAIL | Not found. |
| PostgreSQL 17 client tools | FAIL | `pg_dump`, `pg_restore`, `psql` not found. |
| Docker / local Supabase runtime | FAIL | Docker not found; no local PostgreSQL service. |
| WSL / virtualization | PARTIAL | WSL 3.0.3.0, 16 GB RAM. Windows optional feature state unavailable without elevation; CPU virtualization query returned false. |
| Disk capacity | PARTIAL | C: ~2.3 GB, D: ~192 GB, E: ~1.94 TB free. No secure approved backup destination or expected dump size. |
| Secure DB connection | FAIL | No authorized connection credentials available; no endpoint/TLS/network test. |
| Backup created | FAIL / NOT AVAILABLE | No backup operation attempted. Free plan has no automatic daily backup. |
| Backup integrity | UNVERIFIED | No artifact/checksum/readability test. |
| Isolated recovery target | FAIL | No local runtime or separate project available; no new project was created. |
| Restore test | NOT PERFORMED | No artifact or environment. |
| RPO / RTO | TBD | No recurring schedule or timed restore evidence. |

## Approval and prerequisite sequence

1. User/IT approves a user-local CLI installation and PostgreSQL 17 client-only ZIP extraction. No application package or source files should be changed.
2. Verify WSL2, virtualization in firmware, and Windows features; approve Docker Desktop per-user installation or choose an approved separate recovery target.
3. Secure sufficient protected storage away from low-space C:; approve encryption/access/retention handling.
4. An authorized database owner provides a secure connection secret mechanism and chooses direct IPv6 vs shared session pooler based on network capability. Never send the password through chat.
5. Approve a specific production manual export window and destination. This documentation itself does not authorize the backup operation.
6. Create, checksum, and validate the dump; restore it only to the isolated target and complete all restore checks.
7. Reassess database change readiness only after a successful restore rehearsal and the separate migration forensic blockers are resolved.

Until critical items pass, do not run production dump, restore, migration, or schema operations. Read [setup](./local-environment-setup.md), [connection](./secure-connection-guide.md), [backup runbook](./backup-execution-runbook.md), and [restore environment](./restore-environment-guide.md) for the procedure.

## Final status

Tooling setup: **NOT EXECUTED**. Connection: **NOT TESTED**. Backup: **NOT AVAILABLE**. Restore: **NOT PERFORMED**. Readiness: **BLOCKED**. No installation, SQL, production DB operation, Auth/RLS change, migration, or deployment occurred.
