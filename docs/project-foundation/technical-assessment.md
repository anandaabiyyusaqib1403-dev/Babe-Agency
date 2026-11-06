# Penilaian teknis BABE CONTENT STUDIO

Tanggal: 6 November 2026  
Basis penilaian: source pada `main` commit `fca7f2ba23ccc1bc794c9b622be5c738c98675b6` dan konfigurasi lokal yang tercatat di repository.

Dokumen ini memisahkan kondisi yang terlihat dari rekomendasi. Ini bukan persetujuan untuk mengubah skema atau konfigurasi produksi.

## Evaluasi arsitektur

### Yang sudah menjadi fondasi

- Next.js App Router memisahkan route UI, API route, Server Action, komponen, dan library server/browser.
- Supabase SSR menggunakan cookie dan `auth.getUser()`. Helper workspace menambahkan pemeriksaan anggota aktif.
- Supabase client untuk browser, server, dan service-role dipisahkan; admin client dibatasi ke server.
- Domain operasional sudah memiliki migrasi SQL, constraints, RLS, RPC, status history, snapshot report/invoice, dan queue worker.
- Worker memproses pekerjaan reminder dan report/invoice PDF secara asynchronous. Kode menggunakan klaim job dari RPC dan service role.
- Shell dan sidebar reusable; desain dasar memakai warna ivory, charcoal, dan forest green menurut audit UI sebelumnya.

### Ketidakpastian yang menghambat maintainability

1. **Manifest dan konfigurasi build tidak ada.** `package.json`, lockfile, `next.config.ts`, `tsconfig.json`, dan konfigurasi lint tidak terdapat pada branch. Ketergantungan, versi runtime, scripts, alias TypeScript, serta kompatibilitas build tidak dapat direproduksi.
2. **Batas domain belum jelas.** File action per area sudah membantu, tetapi akses data dan aturan domain banyak berada dekat page/actions. Belum terlihat pemisahan modul domain dan kontrak service yang eksplisit.
3. **Tipe database belum menjadi sumber kebenaran.** Banyak select dan mutation memakai nama kolom sebagai string; generated Supabase types tidak ditemukan.
4. **Navigasi belum mencerminkan information architecture target.** Sidebar sekarang memakai Workspace, Management, Insights, Documents, dan Preferences. Tidak ada pemetaan menu finance/resources sesuai brief.
5. **Runtime worker belum menjadi unit deploy yang terdokumentasi.** Worker bergantung pada package yang tidak tercatat, environment, browser Playwright yang cocok, lokasi storage, polling, dan pengelolaan proses.

## Technical debt dan risiko

### P0/P1 untuk ditangani sebelum pengembangan fitur luas

- **Build/release tidak reproducible (tinggi):** clone baru tidak punya manifest atau lockfile. Build lokal sebelumnya tidak membuktikan checkout bersih dapat install dan build.
- **Keamanan modul finance belum dirancang (tinggi):** kebijakan yang ada berbasis active member dan owner/admin untuk beberapa fungsi/billing. Belum ada role/permission finance khusus, scope data finance, atau domain finance terpisah. Menambah UI sebelum model otorisasi dapat membuka akses terlalu luas.
- **Source of truth migrasi belum ditetapkan (tinggi):** migrasi tersedia, tetapi status database remote, urutan deploy, backup/rollback, dan drift belum diverifikasi.

### P2/P3

- **Ketergantungan workflow lintas modul:** invoice terhubung dengan client, paket, billing profile, PDF job, Drive, dan storage. Konsistensi dan recovery perlu kontrak eksplisit.
- **Worker tanpa gambaran operasi lengkap:** retry, batas waktu, concurrency, observability, serta strategi saat worker mati perlu dicatat dan ditinjau.
- **Environment tersebar:** worker, Drive, Supabase, dan web app membaca environment secara berbeda; `.env.example` dan startup validation belum ada.
- **Dokumentasi operasional tipis:** hanya setup Drive menjadi dokumen integrasi yang terlihat; autentikasi, migrasi, worker, deployment, backup, dan incident procedure belum dijelaskan.
- **Artefak cadangan di repo:** beberapa `.backup*` OAuth script tercatat pada snapshot awal Git. Hapus/retensi harus menjadi perubahan eksplisit setelah memeriksa apakah diperlukan; audit ini tidak menghapusnya.
- **Generated database types dan CI tidak ditemukan:** regresi schema/action tidak dapat dicegah secara otomatis dari file repository yang terlihat.
- **Batas hasil query dan pagination berbeda antar halaman:** audit terdahulu mencatat limit tetap pada Clients/Content; perlu standar pagination sebelum data bertambah. Temuan detail tetap perlu diverifikasi ulang ketika fitur tersebut diubah.

## Penilaian autentikasi dan keamanan

- Pemeriksaan sesi di proxy hanya mencakup subset route. `getActiveWorkspaceContext()` dipakai pula di banyak halaman/actions/API, sehingga harus dipastikan setiap jalur data yang sensitif tetap menegakkan auth dan membership secara server-side.
- RLS terlihat aktif pada tabel-tabel aplikasi menurut migrasi dan assertion SQL. Assertion belum dijalankan dalam audit ini dan tidak membuktikan konfigurasi production.
- Service-role client ada dan dipakai worker; key harus tetap berada di lingkungan server/worker. Daftar environment checked-in saat ini bukan daftar secret values.
- Integrasi Google Drive memakai scope `drive` menurut setup doc, yang memberi akses luas dan memerlukan kontrol consent yang tepat. Batasi akun dan folder Drive, audit akses, rotasi token, dan rencanakan reauthorization.
- API PDF dan upload perlu mempertahankan pemeriksaan membership, kepemilikan relasi, MIME/ukuran, dan akses file private di setiap endpoint.
- Finance memerlukan permission eksplisit di application layer dan database, bukan hanya menyembunyikan tautan sidebar.

## Rekomendasi arsitektur

Pertahankan Next.js + TypeScript, Supabase PostgreSQL/Auth, Google Drive, worker terpisah, dan Vercel sebagai **arah target**, karena sebagian sudah ada di source. Jangan mengklaim versi atau kesiapan platform tertentu sampai manifest dan deployment config diverifikasi.

Susunan logis yang disarankan:

```text
src/
  app/                 # Route, komposisi page, API adapters
  modules/
    clients/
    content/
    approvals/
    publishing/
    insights/
    finance/           # modul terisolasi dengan permission khusus
    assets/
    documents/
    settings/
  components/          # komponen presentasi reusable
  lib/                 # integrasi infra: Supabase, Drive, env, logger
scripts/worker/         # entrypoint dan handler job worker
supabase/migrations/    # schema versioned
```

Ini target pengorganisasian kode, bukan instruksi untuk memindahkan file sekarang. Setiap module sebaiknya memiliki schema/type, query/repository, domain rules, actions, dan UI boundaries. Jangan membuat abstraksi repository generik sebelum ada kebutuhan berulang.

### Single source of truth

- Database migrations menjadi sumber kebenaran skema; generated TypeScript database types diproduksi dari schema yang sama dan masuk CI.
- Kontrak validasi input memakai schema bersama yang dapat digunakan Server Action/API dan tes.
- Role dan permission didefinisikan satu kali secara eksplisit dan diuji di server serta RLS.
- Design tokens untuk warna, spacing, typography, dan navigation dipusatkan pada CSS variables atau sistem styling yang dipilih setelah stack lengkap diverifikasi.
- Worker queue/job state menjadi sumber kebenaran untuk status PDF/reminder; UI membaca status job dari database.

## Arsitektur finance yang direkomendasikan

Finance adalah modul terpisah dari content workflow, tetapi boleh memiliki relasi terbatas ke client/project melalui foreign key yang jelas.

Sebelum schema finance dibuat, sepakati:

- basis kas dan basis akrual serta bagaimana laporan membedakan keduanya;
- chart of accounts, journal entry, debit/kredit, periode akuntansi, mata uang, pajak, dan closing;
- entity yang dimiliki agency, client, dan project;
- role seperti finance viewer, finance operator, approver, dan finance admin beserta approval limit;
- audit trail append-only untuk posting/reversal dan aturan koreksi transaksi;
- attachment private, retention, scan file, dan otorisasi download;
- rekonsiliasi bank dan sumber data transaksi;
- perlindungan data finansial pada RLS, RPC, storage, export, dan logs.

Jangan memperlakukan invoice/payment yang sudah ada sebagai general ledger; gunakan sebagai sumber dokumen/piutang setelah pemetaan akuntansi disepakati.

## Kriteria kesiapan sebelum fitur baru

1. Checkout bersih dapat install dari satu lockfile, menjalankan lint/typecheck/test/build melalui scripts terdokumentasi.
2. Environment template berisi nama variabel dan keterangan tanpa kredensial.
3. Migrasi dapat dijalankan pada database lokal baru dan assertions dapat dijalankan di CI.
4. Deploy flow, worker process, secrets, backup, dan rollback terdokumentasi.
5. Threat model dan permission matrix disetujui sebelum data finance dibuat.

## Hal yang belum dapat dinilai

Tanpa lockfile/config, build tidak dapat direproduksi. Tanpa akses database target, tidak dapat menyimpulkan migration drift, RLS efektif, data, dan fungsi production. Tanpa Vercel project/deployment logs, hosting atau worker scheduling aktif tidak dapat dikonfirmasi. Audit ini tidak menguji aplikasi secara runtime.
