# Keputusan proyek BABE CONTENT STUDIO

Dokumen ini memisahkan arahan yang diberikan pemilik proyek dari keputusan teknis yang telah diverifikasi. Keputusan target belum berarti implementasi sudah ada.

## Arahan produk yang sudah ditetapkan

| Keputusan | Status | Catatan |
|---|---|---|
| Nama produk BABE CONTENT STUDIO untuk operasi BABE AGENCY | Disepakati sebagai arahan proyek | Repository saat ini masih menampilkan label BABE AGENCY/WORKSPACE di beberapa shell |
| Visual Creative; sidebar Deep Forest Green; background Warm Ivory; accent Sage Green; tipografi editorial; density balanced | Disepakati sebagai arah desain | CSS aktual sudah memakai palet ivory/forest menurut audit terdahulu, tetapi token sistem lengkap belum diverifikasi |
| Global Sidebar; navigasi konsisten saat membuka workspace klien | Disepakati sebagai requirement | Sidebar reusable tersedia, tetapi menu dan workspace klien belum cocok sepenuhnya dengan struktur target |
| Desktop-first dan responsive | Disepakati sebagai requirement | Implementasi CSS responsive terlihat; belum ada pengujian viewport dalam audit |
| Full Internal Finance, terpisah dari content, dengan kontrol akses khusus | Disepakati sebagai requirement | Belum ada finance ledger/module lengkap pada repository |
| Tahap ini hanya audit, dokumentasi, rekomendasi | Disepakati untuk pekerjaan ini | Tidak ada migration, konfigurasi produksi, atau deployment dilakukan |

## Arah teknologi yang direncanakan

| Area | Arahan target | Kondisi repository |
|---|---|---|
| Frontend | Next.js + TypeScript | Source App Router/TypeScript ada; versi dan reproducibility belum diketahui |
| Styling | Tailwind CSS | Tidak dapat diverifikasi; file CSS biasa terlihat, package manifest tidak ada |
| Database/Auth | Supabase PostgreSQL/Auth | Supabase client, SSR auth, migrations, dan config lokal tersedia |
| Backend | Server-side modules | Server Actions, API handlers, dan server libraries tersedia; boundary domain dapat diperjelas |
| Storage | Google Drive integration | OAuth/Drive code, setup docs, dan storage fallback ada |
| PDF | HTML/CSS dengan Playwright | Worker memakai `playwright-core` dan membuat HTML PDF; paket/browser version tidak dapat diverifikasi |
| Background processing | Separate document worker | `scripts/background-worker.mjs` mengerjakan queue reminder/PDF |
| Hosting | Vercel | Belum terkonfirmasi; konfigurasi/deployment evidence tidak ada di branch |

## Keputusan teknis sementara yang direkomendasikan

Keputusan berikut menjadi rekomendasi sampai pemilik proyek menyetujuinya:

1. Pertahankan Next.js, TypeScript, Supabase, Google Drive, Playwright worker, dan Vercel sebagai kandidat utama karena sebagian sudah hadir. Jangan upgrade atau mengganti framework sebelum dependency nyata bisa dipulihkan dari manifest/lockfile.
2. Jadikan migration Supabase sebagai sumber skema, lalu generate database types dan validasi kontrak input dari satu definisi.
3. Pertahankan sidebar global sebagai shell aplikasi. Konteks client/workspace menjadi filter/breadcrumb di area konten, bukan shell navigasi lain.
4. Pisahkan finance sebagai module dan domain akses tersendiri. Gunakan ledger double-entry dan reversal append-only setelah kebijakan akuntansi disetujui.
5. Pertahankan worker sebagai proses terpisah. Dokumentasikan hosting, concurrency, retries, observability, dan secret scope sebelum produksi.
6. Gunakan storage privat untuk dokumen dan lampiran; download tetap melewati otorisasi aplikasi atau signed access yang pendek masa berlakunya.

## Keputusan yang masih perlu konfirmasi

### Repository dan release

- Apakah file `package.json`, lockfile, `next.config.ts`, `tsconfig.json`, dan konfigurasi lint ada di sumber lain/commit sebelumnya? Jika ada, repo harus dipulihkan sebelum implementasi fitur.
- Package manager dan versi Node.js yang wajib dipakai.
- Apakah perubahan dokumentasi tahap ini cukup berada di branch kerja atau juga perlu dipush ke `main`?
- Apakah repository public boleh tetap public? Workspace lokal memiliki dokumen kontrak, invoice, anggaran, roadmap, dan pitch deck. Dokumen tersebut tidak masuk audit docs publik; mereka harus tetap di luar repo kecuali klasifikasi akses diubah secara sadar.
- Platform runtime worker, trigger/restart policy, dan cara deploy worker.

### Auth dan operasi

- Role anggota final dan permission per area: client, approval, settings, document, finance.
- Apakah setiap anggota dapat melihat semua data klien/content atau ada batas client/project.
- Lingkungan Supabase target, status migrasi yang sudah diterapkan, prosedur backup, dan kepemilikan credentials.
- Kebutuhan SSO/MFA, masa sesi, invite flow, audit akses, dan proses offboarding.
- Lingkup file Drive, akun pemilik, retensi dokumen, serta proses consent/reverification OAuth.

### Finance

- Basis akuntansi (kas, akrual, atau keduanya), kalender fiscal year, mata uang, pajak, aturan periode tutup.
- Chart of accounts dan aturan debit/kredit; perlakuan invoice, uang muka, piutang, biaya dibayar di muka, payroll/fee, pajak, dan reimbursement.
- Apakah client/project dapat melihat laporan tertentu atau finance hanya internal.
- Role finance, approval limit, pemisahan tugas, dan transaksi yang butuh dual approval.
- Sumber transaksi, rekonsiliasi bank, attachment retention, dan audit/legal requirements.
- Strategi migrasi invoice/payment existing ke ledger dan tanggal mulai saldo awal.

### Product workflow

- Platform publishing yang akan diintegrasikan dan apakah target tahap pertama hanya jadwal manual.
- Metric Performance Insights dan sumber datanya.
- Struktur Asset Library, metadata, versioning, hak akses, dan kebutuhan preview/thumbnail.
- Definisi Studio Overview dan KPI yang tampil.
- Bahasa UI default, format zona waktu/mata uang, dan standar dokumen/PDF.

## Log perubahan keputusan

Belum ada keputusan teknis di atas yang mengubah database atau production. Tambahkan tanggal, pemilik keputusan, alasan, dan dampak sebelum mengubah status rekomendasi menjadi disepakati.
