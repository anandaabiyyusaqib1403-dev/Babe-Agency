# Backup tooling requirements

Assessment date: 2026-11-06. Scope is local preparation only; no installation, production DB connection, backup, or restore occurred.

## Current workstation

| Item | Observed state |
|---|---|
| OS | Windows 10 Pro, build 19045 (22H2), x64; standard support ended 2025-10-14. Confirm ESU or move to supported Windows before handling production backup data. |
| PowerShell | Windows PowerShell 5.1.19041.6456; execution policy `Restricted` |
| Node.js / npm | Node `v24.21.0`; npm `11.19.0` via `npm.cmd`. `npm` PowerShell shim `.ps1` is blocked by policy; do not bypass it. |
| Git | `2.56.0.windows.3` |
| Package managers | `winget` and Chocolatey command paths present; Scoop absent. No package install was attempted. |
| Supabase CLI | Not found |
| Docker | Not found |
| PostgreSQL client tools | `pg_dump`, `pg_restore`, `psql` not found |
| PostgreSQL server | No local PostgreSQL service found |
| WSL | WSL 3.0.3.0 and kernel 6.1.85.1 observed. Windows optional feature state could not be queried without elevation. |
| Memory | 16 GB RAM |
| CPU virtualization | Firmware/SLAT query returned false; confirm from firmware/IT before assuming Docker can run. |
| Disk free | C: about 2.3 GB; D: about 192 GB; E: about 1.94 TB. Exact backup size and approved secure destination are unknown. |
| Project | `BABE AGENCY`, ref `mmtymicfcqirppfpljnp`, ACTIVE_HEALTHY, PostgreSQL `17.11.0.011`; organization plan Free. |

The local `supabase/config.toml` contains `project_id = "Babe_agency"` (local CLI slug), not the remote project reference. The remote project identity was independently verified through Supabase project details. Do not treat these identifiers as interchangeable.

## Required tools and recommendation

| Tool | Purpose | Recommendation | Official source / install approach | Verify / update / remove |
|---|---|---|---|---|
| Supabase CLI | Supabase-aware logical dump and local stack control | Current stable (non-beta) CLI; pin exact version in the tooling record | Prefer official Windows x64 release from [supabase/cli releases](https://github.com/supabase/cli/releases) into a dedicated user tools directory, or official Supabase Scoop bucket if the user chooses Scoop. Avoid adding a CLI dependency to this app repo solely for backup. | `supabase.exe --version`; update by replacing with a verified stable release; remove binary and any user PATH entry. |
| PostgreSQL client tools | `pg_dump`, `pg_restore`, `psql` | PostgreSQL 17.x clients, latest available 17 minor; prefer same major as server (`17.11`) or newer supported 17.x patch | Use the official PostgreSQL Windows download page, which links EDB. Select the EDB PostgreSQL 17 x64 binary ZIP and extract only client binaries/dependencies into a dedicated user tools directory; do not install/register the PostgreSQL server. | `pg_dump.exe --version`, `pg_restore.exe --version`, `psql.exe --version`; update by replacing the client folder; remove folder/PATH entry. |
| Docker Desktop | Isolated local Supabase stack; CLI dump helper runtime where required | Current stable Windows x64 per-user installation, WSL 2 backend | [Official Docker Desktop Windows guide](https://docs.docker.com/desktop/setup/install/windows-install/). Per-user mode avoids administrator rights for the install itself; enabling Windows/virtualization features may require admin. | `docker version`, `docker info`; update via Docker Desktop; uninstall through Settings/Apps. |
| SHA-256 | Backup artifact identity and integrity evidence | Windows built-in PowerShell cmdlet | No additional package: `Get-FileHash -Algorithm SHA256 -LiteralPath <file>` | Recompute after copying; compare exact digest in the protected manifest. |

### Version compatibility

Use PostgreSQL 17 client tools for the PostgreSQL 17.11 project. PostgreSQL documents `pg_dump` as able to dump older server versions, but it cannot dump a server major version newer than the client supports; same-major client tools avoid this mismatch. CLI `db dump` currently uses Supabase-specific filtering and emits roles/schema/data SQL files per the official guide. It is not a PostgreSQL custom archive, so `pg_restore --list` does not apply to those SQL files. If a separate custom-format dump is considered, first confirm Supabase compatibility/scope with the official workflow and use `pg_restore` only for that format.

## Install order (planned; not executed)

1. Resolve Windows support status (Windows 10 end of support), virtualization readiness, and available C: space. Keep Docker image/data storage on a chosen non-system volume only after checking access controls and capacity. C: has only ~2.3 GB free, so avoid placing Docker images or dumps there.
2. Install a pinned stable Supabase CLI from its official Windows x64 release and verify version/checksum.
3. Extract PostgreSQL 17 client binaries only from the official-linked EDB package. Add a versioned user PATH entry only after checking for existing PostgreSQL bins; do not install a server.
4. Install Docker Desktop only if the isolation strategy is local Supabase. Confirm WSL2/virtualization features and any required admin action first.
5. Verify `supabase --version`, `pg_dump --version`, `pg_restore --version`, `psql --version`, `docker version`, and `Get-FileHash` locally. Do not connect to production during tool verification.
6. Obtain an approved secret-handling method and backup destination before any remote database operation.

No install commands were run. See [local environment setup](./local-environment-setup.md) for command examples and [readiness](./backup-tooling-readiness.md) for blockers.
