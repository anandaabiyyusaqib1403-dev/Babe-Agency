# Integration architecture

## Aturan integrasi

- Integrasi eksternal dibungkus adapter server-side dengan interface domain yang stabil.
- Domain memanggil adapter melalui application service; UI tidak membuat request dengan credential provider.
- Simpan external ID, source, sync cursor, last successful sync, status, dan error class yang aman di DB.
- Semua mutasi eksternal membawa idempotency key dan correlation ID lokal. Retry tidak membuat file/post/record duplikat.
- Bedakan kegagalan validasi, permission, rate limit, timeout, credential revoked, dan provider outage.

## Google Drive

Gunakan satu akun Google khusus BABE AGENCY. OAuth refresh token, client secret, dan access token hanya disimpan sebagai server/worker secrets. Access token diperoleh saat perlu dan tidak dimasukkan ke database, browser response, logs, atau signed URL.

Kontrak adapter yang disarankan:

- `ensureAgencyFolders()` — idempotent, mengembalikan external folder IDs yang dicatat di settings.
- `ensureClientFolder(clientId)` — memastikan mapping database-to-Drive; nama folder bukan key.
- `uploadObject(source, destination, checksum, idempotencyKey)` — upload/retry tanpa duplikasi.
- `getMetadata(fileId)` dan `createDownloadAccess(fileId, actor)` — metadata minimal, otorisasi dilakukan aplikasi.
- `listChildren(folderId, pageToken, filters)` — pagination Drive API; tidak memuat semua folder sekaligus.
- `selectExternalFile(fileId, clientId, contentId)` — validasi file dan scope, lalu simpan reference di Asset Library.
- `archiveOrTrash(fileId, retentionPolicy)` — soft archive di DB lebih dulu; hapus provider hanya sesuai retention policy.

Usulan struktur Drive:

```text
BABE AGENCY/
  Clients/{stable-client-code}/
    Assets/
    Deliverables/
    Reports/
    Documents/
  Studio/
    Brand Assets/
    Internal Documents/
```

Setiap folder memiliki ID eksternal tersimpan; jangan mengandalkan path/nama sebagai identitas. Metadata Supabase memegang relasi owner, client, content, mime, size, checksum, version, status, dan `drive_file_id`. Drive memegang byte objek.

## PDF dan Excel

- Web memvalidasi permintaan dan membuat job berisi source reference/version, format, template version, locale, timezone, requester, dan idempotency key.
- Worker mengambil snapshot sumber yang sudah tervalidasi, merender fixed template, menyimpan hasil lokal sementara dengan cleanup terjamin, lalu menyimpan hasil durable di private storage sebelum mengunggah ke Drive.
- Export Excel menggunakan template/schema kolom tetap, escaping formula injection untuk cell yang berasal dari input, pembatasan volume, dan audit event.
- File besar dirender per job dan tidak menjadi response synchronous yang menahan request web.

## Integrasi publishing dan metric

Belum ada provider social publishing terverifikasi. Adapter per platform menjadi pilihan setelah platform, token model, rate limits, API permissions, dan kebutuhan approval disepakati. Schedule internal tetap dapat berstatus `scheduled/manual` tanpa mengklaim post sudah diterbitkan.

Ingestion metric memakai publication ID, external post ID, metric time/window, source platform, retrieval timestamp, dan schema version. Upsert idempotent; metric historis tidak ditimpa tanpa menyimpan provenance/update history.

## Supabase boundaries

- User web memakai SSR/browser client dengan key publik dan RLS.
- Service-role client terbatas ke worker/admin service tepercaya. Pisahkan key untuk tiap runtime bila credential management mendukung; batasi environment dan akses personel.
- RPC untuk multi-step atomic posting/finalization/job claim harus memiliki privilege minimal, authorization check eksplisit, `search_path` aman, dan input validation.
- Database migration adalah versi skema; perubahan aplikasi tidak diasumsikan aktif sampai migration di environment tujuan diterapkan dan diverifikasi.

## API integration contract

Adapter mengembalikan hasil bertipe:

```ts
type IntegrationResult<T> =
  | { ok: true; value: T; providerRequestId?: string }
  | { ok: false; code: "auth" | "forbidden" | "not_found" | "rate_limited" | "timeout" | "unavailable" | "invalid"; retryable: boolean; providerRequestId?: string };
```

Jangan mengembalikan raw provider errors, credentials, token response, atau stack trace ke UI.
