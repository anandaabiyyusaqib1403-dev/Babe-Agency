# Roadmap implementasi BABE CONTENT STUDIO

Roadmap ini menyusun pekerjaan menurut dependency. Ini rencana, bukan pernyataan bahwa fitur telah tersedia. Tidak ada schema atau konfigurasi production yang diubah saat audit.

## Urutan tahap

| Tahap | Hasil | Dependency | Acceptance criteria |
|---|---|---|---|
| 0. Pulihkan fondasi repository | Manifest, lockfile, config Next/TypeScript/lint, scripts, environment template, dan CI dasar ditetapkan | Keputusan package manager/runtime dan akses source lengkap | Checkout baru dapat install deterministik; typecheck, lint, test yang ada, dan build berjalan melalui scripts; tidak ada secret pada repo; Vercel/worker requirement terdokumentasi |
| 1. Tetapkan kontrak platform | Peta route, role/permission, generated DB types, standar validasi/error/loading/empty state, design tokens, standar query/pagination | Tahap 0; verifikasi Supabase target | Setiap route dan action memiliki klasifikasi akses; generated types cocok dengan migrations; assertion schema dijalankan lokal/CI; sidebar global disepakati dan tetap konsisten di seluruh route |
| 2. Sempurnakan core agency | Studio Overview, Client Portfolio, Studio Settings, member/access management, serta navigasi sesuai brief | Tahap 1; keputusan cakupan/settings dan role | Admin dapat mengelola klien, status, kontak, service/package, brief; anggota mendapat akses sesuai role; loading/error/empty/saved state jelas; pencarian dan pagination bekerja pada dataset uji |
| 3. Lengkapi creative workflow | Content Studio, kalender Publishing Schedule, approval/revision, relasi brief/pillar/storyboard | Tahap 2; keputusan workflow dan channel publishing | Konten dapat direncanakan, dijadwalkan, diserahkan untuk review, direvisi, disetujui; setiap transisi tercatat; UI mencerminkan status DB; integrasi publish eksternal hanya dianggap selesai setelah autentikasi platform dan hasil publikasi terverifikasi |
| 4. Lengkapi insights dan documents | Performance Insights, Reports & Recap, archive, PDF pipeline serta observability worker | Tahap 1–3; definisi metric dan format report | Metric memiliki definisi/formula dan periode; versi final immutable; PDF job dapat diproses, retry, diunduh dengan auth, dan ditelusuri; file Drive/storage privat; worker restart/error tidak kehilangan job |
| 5. Rancang dan bangun finance foundation | Modul finance terisolasi: accounts/categories, transactions, journal, cash/accrual reports, attachments, approval dan audit | Tahap 1; persetujuan kebijakan akuntansi, permission, retention, dan scope | Posting berimbang debit/kredit; koreksi lewat reversal, bukan overwrite; kas dan akrual terpisah; laporan dapat direkonsiliasi ke ledger; akses diuji lintas role dan ditolak oleh API/RLS untuk role tanpa izin |
| 6. Integrasi finance operasional | Link invoice/client/project ke receivable, payment reconciliation, cash flow dan P&L | Tahap 5; mapping invoice lama dan cutover strategy | Nilai invoice/payment tidak diduplikasi; rekonsiliasi menyimpan referensi sumber; laporan agency/client/project konsisten; audit trail lengkap; data lama dimigrasikan hanya dengan rencana dan backup yang disetujui |
| 7. Hardening dan rollout | Performance, accessibility, security, monitoring, backup/recovery, runbooks, staged release | Semua tahap di atas | Uji permission dan restore selesai; dashboard error/queue tersedia; p95 dan query budget disepakati; responsif diuji desktop/tablet/mobile; release bertahap dan rollback didemonstrasikan |

## Dependency antarmodul

```text
Fondasi repo
    ↓
Kontrak auth, types, UI, dan data
    ↓
Clients ──→ Content/Brief ──→ Approval ──→ Publishing
   │                                  │
   └──→ Invoice/Client mapping        └──→ Performance/Reports
                                               ↓
                                      Document/PDF worker

Permission + account model ──→ Finance ledger ──→ Invoice reconciliation
```

Finance ledger tidak boleh bergantung pada content status sebagai kontrol akses. Relasi ke client/content hanya untuk pengelompokan dan pelaporan.

## Rekomendasi urutan delivery

1. Bereskan keterulangan build terlebih dahulu karena semua tahap lain butuh baseline yang bisa diverifikasi.
2. Dokumentasikan role, RLS, error states, pagination, dan integrasi sebelum menambah route baru.
3. Selesaikan core agency dan workflow editorial pada schema yang sudah ada setelah status migrasi diverifikasi.
4. Stabilkan worker dan document archive sebelum laporan/finance menambah volume PDF dan lampiran.
5. Sepakati accounting policy dan permission matrix sebelum menambah satu pun finance table.
6. Jalankan finance module sebagai rollout terkontrol dengan rekonsiliasi dan audit, lalu baru tautkan invoice saat cutover jelas.

## Gate sebelum implementasi database

- Diff migration telah direview; backup dan prosedur rollback tersedia.
- Environment tujuan (local, staging, production) diketahui dan aksesnya disetujui.
- Data model, constraints, retention, RLS, dan role matrix disepakati.
- Ada migration test/CI dan bukti snapshot schema baseline.
- Tidak ada perubahan skema produksi tanpa rencana rollout dan verifikasi.
