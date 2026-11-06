# Architecture decisions

Status: decision log untuk rancangan Prompt 02. **Rekomendasi** perlu disetujui sebelum implementasi yang mengunci schema, permission, atau deployment.

| ID | Keputusan | Status | Alasan dan konsekuensi |
|---|---|---|---|
| ADR-001 | Modular monolith untuk web/domain dengan document worker terpisah | Direkomendasikan | Domain berada dalam satu produk dan satu DB; boundary modul mengurangi coupling tanpa overhead service network. Worker punya runtime/skalabilitas berbeda. |
| ADR-002 | Pertahankan Next.js + TypeScript dan Supabase | Target terarah; versi belum terverifikasi | Sudah digunakan source; upgrade/replace ditunda sampai manifest, lockfile dan build config pulih. |
| ADR-003 | Tailwind CSS belum diputuskan sebagai implementasi | Belum dikonfirmasi | Brief menargetkan Tailwind, tetapi repo menunjukkan CSS dan tidak ada package manifest. Pilih setelah audit source/config lengkap. |
| ADR-004 | PostgreSQL migrations adalah schema source of truth; generate TS types dari DB | Direkomendasikan | Menyatukan constraints, query contracts dan typecheck; butuh penambahan tooling/CI setelah dependency baseline tersedia. |
| ADR-005 | Satu Content ID, publikasi memiliki ID tersendiri | Disepakati sebagai domain rule | Menjaga satu konten dapat punya banyak channel/schedule; metric per publication tidak tercampur. |
| ADR-006 | Final reports dan generated documents mengacu ke immutable source versions | Disepakati sebagai domain rule | Re-render/audit dapat memakai sumber dan template yang tepat; job tidak berubah mengikuti draft terbaru. |
| ADR-007 | Supabase metadata/DB adalah source of truth; Google Drive menyimpan bytes | Direkomendasikan | Menghindari Drive folder scan sebagai database dan mempertahankan ownership/status walau provider error. |
| ADR-008 | Render status terpisah dari Drive upload status | Disepakati sebagai requirement | Upload failure tidak menghapus artifact render yang sudah tersimpan. Retry upload tidak perlu render ulang. |
| ADR-009 | Finance sebagai bounded context dengan ledger double-entry append-only | Disepakati sebagai requirement; skema menunggu approval | Invoice/payment yang ada tidak cukup menjadi accounting ledger. Posting/reversal, cash/accrual, closing dan audit memerlukan model khusus. |
| ADR-010 | Finance access memakai capability terpisah dari creative member access | Disepakati sebagai requirement; matriks role menunggu approval | Anggota kreatif dapat punya akses operasional setara tanpa melihat finance. Role/capability harus ditegakkan di server, RLS, RPC, storage dan export. |
| ADR-011 | Jangan memaksakan `apps/` + `packages/` workspace saat ini | Direkomendasikan | Repository belum punya package/workspace manifest. Tetap satu Next app, tambahkan `src/modules` secara bertahap dan pisahkan worker runtime tanpa monorepo tooling baru. |
| ADR-012 | Vercel untuk web dan worker pada runtime durable yang kompatibel | Target Vercel belum diverifikasi; worker host belum dipilih | Next app sesuai kandidat Vercel, tetapi worker polling/Playwright punya kebutuhan proses panjang; deployment configs/account belum ada di repo. |
| ADR-013 | Storage private dengan download authorization aplikasi | Disepakati sebagai prinsip security | File klien/finance tidak public; service role dan Google OAuth credential tidak pernah keluar server. |
| ADR-014 | Audit trail atomik untuk mutasi penting | Disepakati sebagai prinsip | Event yang terpisah dari transaction write berisiko hilang/berbeda; terutama untuk ledger, approval, access dan finalization. |

## Approval yang dibutuhkan sebelum build

1. Restore manifest/lockfile dan pilih package manager/Node version; konfirmasi apakah Vercel memang platform deploy yang digunakan.
2. Setujui role/capability matrix, client/project scoping, member administration, session/MFA/offboarding, serta finance segregation of duties.
3. Tetapkan accounting policy: cash/accrual, fiscal calendar, currency, tax, chart of accounts, revenue/expense recognition, allocations, opening balance dan invoice cutover.
4. Tetapkan Google Drive account/root/folder ownership, consent scope, file retention dan apakah Drive atau Storage menjadi durable canonical byte store untuk setiap jenis file.
5. Setujui metric definitions, platform publishing, report templates/versioning, export spreadsheet format, timezone dan locale.
6. Pilih worker host/runtime, CI, monitoring, backup tier, RPO/RTO, release gates dan production migration policy.

## Perubahan log

Tambahkan tanggal, decision owner, status, konteks, opsi yang dipertimbangkan, alasan, dan konsekuensi untuk setiap keputusan yang berubah. Jangan menandai rekomendasi sebagai final hanya karena telah didokumentasikan.
