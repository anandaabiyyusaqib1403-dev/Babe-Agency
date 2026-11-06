# Backup integrity report

Assessment date: 2026-11-06.  
Project ref: `mmtymicfcqirppfpljnp`.

## Result: NOT AVAILABLE / UNVERIFIED

No backup file was produced. Supabase CLI, Docker, `pg_dump`, `pg_restore`, and `psql` were not available in this environment, and no authorized connection credentials were found in process environment variable names. There is consequently no file size, format, checksum, parser validation, export warning log, or object coverage report to inspect.

| Integrity check | Result |
|---|---|
| File exists | NO |
| Non-zero file size | NOT APPLICABLE |
| Backup format recognized | NOT APPLICABLE |
| SHA-256 calculated | NOT APPLICABLE |
| Dump command completed successfully | NOT APPLICABLE |
| Restore tool can read the dump | NOT APPLICABLE |
| Export warnings / skipped objects reviewed | NOT APPLICABLE |
| Recoverability established | NO |

When a dump is made, verify every roles/schema/data artifact, record SHA-256 and byte size, review command output for skipped/error objects, and validate the file using the matching restore tooling. These checks establish artifact integrity/readability only. Recoverability requires a successful restore into an isolated compatible environment; see [restore-test-report.md](./restore-test-report.md).

No database, source code, credential, or production setting was changed to attempt backup creation.
