# Local environment setup for backup tooling

Assessment date: 2026-11-06. Installation has **NOT BEEN PERFORMED**; all commands below are a proposed user-reviewed plan.

## Findings

This workstation is Windows 10 Pro 22H2 x64, build 19045, Windows PowerShell 5.1.19041.6456, Node 24.21.0, npm 11.19.0, Git 2.56.0, with `winget` and Chocolatey present. `npm.cmd` works; the `npm.ps1` shim is blocked because execution policy is Restricted. Use `.cmd` wrappers or native executables; do not weaken policy as a workaround. Windows 10 reached end of support on 2025-10-14; confirm the machine is enrolled in Extended Security Updates or move to supported Windows before storing production database dumps here. [Microsoft lifecycle notice](https://support.microsoft.com/en-us/windows/deployment/updates-lifecycle/windows-10-support-has-ended-on-october-14-2025).

No Supabase CLI, Docker, PostgreSQL client, or local PostgreSQL service was found. WSL 3.0.3.0 is installed, 16 GB RAM is present, but Windows feature status could not be queried without elevation and CPU virtualization/SLAT detection returned false. Verify firmware and WSL2 readiness before planning Docker Desktop. Current free space: C: ~2.3 GB, D: ~192 GB, E: ~1.94 TB. Backup size and secure destination remain unknown.

## Planned installs

### 1. Supabase CLI (stable release)

Use the official [Supabase CLI releases](https://github.com/supabase/cli/releases) Windows x64 archive. Choose a stable release (not `next`, beta, or prerelease), download its published checksum file, verify with `Get-FileHash`, then extract `supabase.exe` to a versioned directory under the current user profile (for example, `%LOCALAPPDATA%\Programs\SupabaseCLI\<version>`). Example extraction after downloading the official archive:

```powershell
Expand-Archive -LiteralPath '<downloaded-official-cli-zip>' -DestinationPath "$env:LOCALAPPDATA\Programs\SupabaseCLI\<version>"
& "$env:LOCALAPPDATA\Programs\SupabaseCLI\<version>\supabase.exe" --version
```

Add that directory to the **user** PATH only after checking for collisions. This avoids changing the application package manifest and avoids a machine-wide install. The alternative official Scoop bucket is documented by Supabase, but Scoop is not currently installed; its bootstrap may require a PowerShell policy adjustment, so it is not the preferred option here.

Verification: `supabase.exe --version` and `supabase.exe db dump --help`. Do not run `login`, `link`, `db dump`, or local stack commands as part of installation verification.

Update by downloading and checksum-verifying a newer stable archive, then changing the user PATH entry after smoke-checking it. Remove by deleting the versioned user directory and that PATH entry. No admin rights should be required for a user-local binary.

### 2. PostgreSQL 17 client tools only

Use the [PostgreSQL Windows download page](https://www.postgresql.org/download/windows/) and its EDB link. Prefer the PostgreSQL 17 x64 ZIP package so no service is installed. Extract required executables and adjacent DLLs into a versioned user directory, such as `%LOCALAPPDATA%\Programs\PostgreSQLClient\17`:

```powershell
Expand-Archive -LiteralPath '<downloaded-official-postgresql-17-client-zip>' -DestinationPath "$env:LOCALAPPDATA\Programs\PostgreSQLClient\17"
& "$env:LOCALAPPDATA\Programs\PostgreSQLClient\17\bin\pg_dump.exe" --version
& "$env:LOCALAPPDATA\Programs\PostgreSQLClient\17\bin\pg_restore.exe" --version
& "$env:LOCALAPPDATA\Programs\PostgreSQLClient\17\bin\psql.exe" --version
```

Add its `bin` folder to user PATH, after ensuring no older PostgreSQL folder precedes it.

Verify `pg_dump.exe --version`, `pg_restore.exe --version`, and `psql.exe --version` all report 17.x. Do not select/install the PostgreSQL server, register a service, initialize a data directory, or open local ports. Update by replacing the versioned client directory; remove the directory and user PATH entry. If EDB ZIP layout/dependencies do not support a client-only extraction, stop and choose another official package path instead of accepting an unwanted server install.

### 3. Docker Desktop (conditional)

Only needed for an isolated local Supabase stack and the current documented CLI workflow where Docker runs dump helpers. This computer meets the documented Windows 10 Pro 22H2 build 19045 and 8 GB RAM floor, and has WSL installed. Firmware virtualization and Windows feature status remain unresolved; the current virtualization query returned false. Verify virtualization in BIOS/UEFI and WSL 2.1.5+ feature state before downloading. Docker Desktop per-user install is the lower-privilege mode; enabling features or all-users install requires admin rights. Do not attempt it without user approval.

Install from [official Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/). Verify `docker version` and `docker info`, then verify a local non-production Supabase stack only after the recovery environment is approved. Put Docker image storage on a suitably protected drive with sufficient space; C: currently has ~2.3 GB free. Uninstall through Windows Apps; retain or remove container volumes only after deciding whether local test data must be preserved.

### Installation command notes

The ZIP commands above are templates, not commands executed in this audit. Inspect the archive layout first: the EDB binary ZIP may contain a `pgsql` parent directory, so resolve the actual `bin` directory before invoking the client tools. Retain the matching runtime DLLs. Extraction does not register a server service; do not run `initdb`, `pg_ctl`, or server registration commands.

For Docker, use the official downloaded installer interactively after approval:

```powershell
Start-Process -FilePath '<official-downloaded-Docker-Desktop-Installer.exe>' -Wait
```

Select a supported installation mode using the current Docker guide. Windows feature/firmware changes may need administrator or IT action. Do not assume Windows 10 remains supported merely because build 19045 appears in the requirements: verify OS lifecycle/ESU and Docker's current support policy first. No installer was downloaded or launched.

### SHA-256 verification

No installation required: PowerShell `Get-FileHash -Algorithm SHA256 -LiteralPath <path>` is built in. Verify the hash again after moving the backup to its protected destination.

## PATH and shell notes

- Run `where.exe supabase`, `where.exe pg_dump`, `where.exe pg_restore`, `where.exe psql`, and inspect `Get-Command` after installation to ensure the intended versions win PATH resolution.
- Use explicit executable paths for first verification if older versions exist.
- PowerShell execution policy is `Restricted`. Do not execute `.ps1` npm shims; use `npm.cmd`/`npx.cmd`. Do not set `ExecutionPolicy Bypass` or change LocalMachine policy.
- Current Node version is above the Supabase CLI's documented Node 20 minimum for npm/npx installations. This does not itself install the CLI.

## Package maintenance

Keep a local tooling record with source URL, release version, checksum, install path, and date. Update only from the same official source and re-verify hashes. Remove tools through their corresponding package manager or delete user-local versioned folders and PATH entries. No package manager install/update/uninstall was run in this assessment.
