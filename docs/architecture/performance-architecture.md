# Performance architecture

## Query strategy

- Semua list besar menggunakan pagination server-side (cursor/keyset untuk urutan stabil, offset hanya untuk kebutuhan kecil dan terukur).
- Filter/sort hanya memakai kolom yang didukung index; validasi kolom sort dari allowlist.
- Select hanya kolom yang dibutuhkan page. Hindari `select *` untuk overview dan daftar.
- Gunakan joins/batched queries atau RPC agregasi untuk menghindari N+1. Jangan mengambil semua clients/content lalu melakukan filter/agregasi di browser.
- Dashboard agregasi dipagari rentang tanggal, client scope, dan role. Cache hanya data yang tidak personal/finance-sensitive dan memiliki invalidation rules eksplisit.
- Query error dibedakan dari hasil kosong; halaman memiliki loading/error/empty state tanpa fallback yang menyembunyikan kegagalan.

## Indexing dan PostgreSQL

- Index berdasarkan pola query nyata: `(client_id, created_at desc)`, `(publication_id, metric_date)`, `(status, scheduled_at)`, `(status, created_at)` pada job, dan key lookup FK.
- Index partial pada row aktif/queue yang sering diproses; unique constraints untuk idempotency dan external IDs.
- Finance: index `(account_id, posted_at)`, `(period_id, status)`, `(client_id, posted_at)`, tetapi hindari banyak index pada ledger append-only tanpa query evidence.
- Audit migration dengan `EXPLAIN (ANALYZE, BUFFERS)` di staging dengan data representatif. Jangan membuat index atau query production sebagai bagian dari dokumen ini.
- Gunakan transaction scope pendek; worker/job tidak menahan lock selama proses render atau upload jaringan.

## Data loading UI

- Server Components membaca data awal dan meminimalkan client-side JS.
- Lazy-load detail berat seperti preview PDF, storyboard panjang, grafik historis, dan Drive browser.
- Calendar mengambil window tanggal yang terlihat plus buffer, bukan semua schedule.
- Realtime hanya untuk queue/status yang perlu update cepat; subscription dibatasi filter dan ditutup saat unmount. Jangan subscribe semua tabel.
- Komponen tabel/board menggunakan pagination/infinite loading dengan state dan batas item yang jelas.

## Worker dan external APIs

- Drive list menggunakan provider pagination dan batas concurrency.
- PDF render concurrency dibatasi berdasarkan memori worker dan ukuran halaman. Timeouts per job dan browser lifecycle wajib.
- Retry provider menggunakan exponential backoff + jitter, menghormati `Retry-After`, dan membatasi retry permanen untuk invalid credentials/invalid data.
- Queue claim menggunakan locking/lease database supaya beberapa worker tidak mengambil job yang sama; lease diperbarui untuk job lama.
- Render memakai immutable snapshot agar tidak menahan koneksi/query DB selama PDF dibuat.

## Target dan pengukuran

Sebelum menetapkan angka SLO, pulihkan build dan ukur traffic/data aktual. Usulan baseline pengukuran:

- page server query p50/p95, DB query p95, payload bytes dan cache hit;
- list pagination latency pada data realistis;
- time-to-first-byte dan Web Vitals per route;
- queue waiting time, render duration, upload duration, retry/failure count;
- ukuran PDF/XLSX, peak worker memory dan concurrency.

Dashboard tidak boleh memuat semua transaksi ledger untuk menghitung saldo; gunakan SQL aggregate yang terfilter dan consistent cutoff. Jangan cache hasil finance lintas user/role tanpa key yang memasukkan permission scope.
