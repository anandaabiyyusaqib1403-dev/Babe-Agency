# Deployment architecture

## Kondisi repository

Source memperlihatkan Next.js App Router, Supabase SSR, worker Node.js menggunakan Playwright, dan konfigurasi lokal Supabase. Branch tidak memiliki package manifest/lockfile, Vercel configuration, CI workflow, atau bukti production deployment. Karena itu target berikut adalah rekomendasi dan belum mencerminkan deployment aktif.

## Target environment

```text
Developer machine
  ├── Next.js web local
  ├── Supabase local (PostgreSQL/Auth/Storage)
  └── document worker local + test Google account/folder

CI
  ├── install dari lockfile
  ├── lint / typecheck / unit / integration / document checks
  ├── Supabase migrations + RLS/schema checks pada ephemeral DB
  └── build artifacts; tidak memegang production secrets

Staging
  ├── Vercel preview/protected web app
  ├── Supabase staging project
  ├── worker staging runtime
  └── Drive staging root/folder

Production
  ├── Vercel web deployment
  ├── Supabase production project
  ├── durable worker host with restart/monitoring
  ├── dedicated Google agency account and restricted root
  └── backup/restore and alerting
```

Web dan worker boleh berbagi source modules, namun deploy/restart/scaling terpisah. Worker butuh proses Node durable, browser binary yang kompatibel dengan Playwright package, filesystem temp yang cukup, CPU/memory budget, outbound access ke Supabase/Google, dan graceful shutdown.

## Release flow

1. Pull request menjalankan deterministic install dari lockfile, static checks, tests yang tersedia, schema/RLS checks, document template checks, dan build.
2. Perubahan migration diperiksa dan dijalankan pada local/ephemeral DB; tidak ada automatic production migration tanpa approval gate.
3. Deploy web ke staging dan deploy worker compatible version; smoke test auth, queue, storage, Drive, dan unduh dokumen.
4. Promosikan artifact yang sama ke production. Apply backward-compatible migrations lebih dulu; deploy application/worker; lakukan data backfill terukur bila diperlukan.
5. Monitor error rate, DB/query latency, queue depth/age, render/upload failure dan auth denial. Gunakan rollback plan untuk app dan forward-fix/restore untuk DB, bukan menganggap migration bisa selalu dibalik.

## Secrets dan environment

Pisahkan environment names untuk local/staging/production. Web hanya menerima public Supabase URL/key dan server secrets yang benar-benar dipakai route; worker menerima Supabase service role dan Google OAuth secrets. Secret tidak disalin ke client build, log, docs, build artifact, atau Git. Rotasi/incident runbook wajib.

Variables yang terlihat pada source termasuk Supabase URL/public key, service role, Google Drive OAuth client/secret/refresh token/folder ID, Sheets IDs/credentials, app URL, dan worker poll interval. Lengkapi `.env.example` dengan nama, tujuan, runtime, dan status required/optional setelah package baseline dipulihkan; tanpa nilai kredensial.

## Database migration operations

- Satu migration per perubahan ter-review; perubahan additive/expand-contract untuk schema yang live.
- Record migration version dan deployment release yang menerapkannya.
- Sebelum production change: backup check, staging migration, data volume/lock review, rollback/forward plan, owner approval, maintenance impact.
- Setelah perubahan: schema diff, RLS/advisor checks, read/write smoke query, error log review.
- RLS behavior dan data restore perlu dites di non-production. Jangan menyimpulkan production state dari `supabase/config.toml`.

## Worker operations

- Satu release version menyertakan worker schema compatibility range.
- Worker heartbeat/lease, health signal, graceful shutdown, bounded concurrency dan max job duration.
- Alert queue age/depth, stuck leases, retries, dead jobs, Drive auth failures, render crashes, storage capacity.
- Saat worker pause, web tetap dapat enqueue dan menunjukkan state queued. Saat Drive outage, hasil rendered tetap tersedia sesuai policy.
- Deploy satu worker canary dahulu sebelum scale concurrency.

## Backup, restore, rollback

Tetapkan RPO/RTO, pemilik restore, frekuensi uji, dan retensi. Database backup tidak mencadangkan file Drive secara otomatis; inventaris file references, checksum dan file retention harus masuk prosedur terpisah. Simulasikan restore pada environment bersih dan verifikasi referential integrity dan download authorization. Application rollback tidak boleh menghapus ledger/history atau membuat migration incompatibility.

## Keputusan platform yang belum dikunci

Pilih runtime worker (container/VM/managed process), browser image/version, process manager, metrics/log provider, CI provider, Vercel team/project, staging isolation, Supabase plan/region, backup tier, and maintenance window setelah melihat account/traffic/volume dan package versions. Jangan deploy dari rancangan ini.
