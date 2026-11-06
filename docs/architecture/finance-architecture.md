# Studio Finance architecture

## Status dan scope

**Kondisi aktual:** repo memiliki invoice, invoice items, payments, revisions, activity events, billing profile, dan ringkasan invoice. Itu bukan general ledger dan tidak menyediakan chart of accounts atau double-entry.

**Target:** domain finance terisolasi yang menjadi sumber kebenaran untuk posted financial facts. Invoice module tetap menjadi dokumen/piutang dan berintegrasi melalui explicit source references. Ini rancangan; tidak ada tabel finance yang dibuat pada tahap ini.

## Batas domain

- Finance owns accounts, financial periods, transaction intake, journal entries/lines, allocations, reconciliation, approvals, closing, report snapshots, and finance audit events.
- Client/Project owns its identity. Finance stores foreign-key dimensions to that identity but does not copy client master data.
- Documents owns attachment metadata and file status. Finance stores document IDs/references.
- Invoice owns issued invoice snapshots/payment document workflow. An adapter maps issue/payment events to finance source events; finance decides journal posting policy and idempotency.
- Creative content has no authority to read or write finance data except approved aggregate read models if future product policy permits.

## Konsep data yang direkomendasikan

| Entity | Fungsi / invariant |
|---|---|
| `finance_accounts` | Chart of accounts: code, name, account type, normal side, currency policy, parent, active/postable flags. No direct posting to group/non-postable account. |
| `financial_periods` | Fiscal boundaries and state `open/closing/closed`; closed periods reject new posts/backdated changes unless controlled reopening audit. |
| `finance_transactions` | Source transaction/intake: date, counterparty, source, external reference, status, requester, idempotency key. May link to invoice/client/project. Not itself the ledger. |
| `journal_entries` | Header: entry no, effective/posted date, period, description, source reference, currency, status, reversal link, created/posted actors, timestamps. |
| `journal_lines` | Account, debit, credit, currency, base amount, dimensions/allocation, memo. Exactly one positive side per line; entry totals balance at posting. |
| `transaction_allocations` | Allocation of an existing expense/revenue line to client/project and method/percentage. Allocations partition original value; do not generate additional agency expense. |
| `finance_approvals` | Reviewer, decision, threshold/policy, timestamp and reason. Initiator cannot approve own transaction where separation-of-duties applies. |
| `bank_accounts` / `reconciliations` | External account metadata without storing online banking credentials; statement imports, matches, unmatched items, reconciled-through timestamp. |
| `financial_report_snapshots` | Immutable report request: basis, period, currency, filters, cutoff, allocation method, source entry IDs/version, generated time and requester. |
| `finance_audit_events` | Append-only create/edit/submit/approve/post/reverse/close/reopen/export/reconcile events. |

Exact names/normal forms are subject to a schema design review before any migration.

## Double-entry posting

Draft journal lines may be edited by authorized operators. Posting is a single atomic database operation:

1. Lock draft entry and target period.
2. Check actor finance permission, active member, approval requirement, period open, account validity, currency rules, source ownership and idempotency.
3. Check at least two valid lines; every line is debit or credit, amounts are positive, base-currency totals satisfy exact decimal precision, and total debit equals total credit per currency/base conversion rules.
4. Check client/project allocations are valid and sum to the allocatable line amount without increasing agency totals.
5. Mark posted, record actor/time, create audit event, and update any permitted derived balance in the same transaction.
6. Commit only if every invariant passes.

Monetary values use fixed-precision numeric/minor units and explicit currency/rounding policy, never floating-point JavaScript arithmetic as authority.

## Contoh jurnal

Invoice IDR 10,000,000 diakui secara akrual:

| Account | Debit | Credit |
|---|---:|---:|
| Accounts receivable | 10,000,000 | 0 |
| Service revenue | 0 | 10,000,000 |

Pembayaran diterima:

| Account | Debit | Credit |
|---|---:|---:|
| Bank | 10,000,000 | 0 |
| Accounts receivable | 0 | 10,000,000 |

Pembayaran menyelesaikan piutang; ia bukan pendapatan kedua kali. Internal transfer IDR 2,000,000:

| Account | Debit | Credit |
|---|---:|---:|
| Bank B | 2,000,000 | 0 |
| Bank A | 0 | 2,000,000 |

Transfer mengubah saldo akun kas tetapi tidak masuk total income/expense/cash flow operasi.

## Cash dan accrual reporting

- Accrual P&L mengambil revenue/expense accounts berdasarkan effective recognition date.
- Cash-basis report menghitung income/expense saat receipt/payment mengubah cash/bank dan mengaitkannya ke sumber yang sama; invoice accrual tidak ikut dihitung sebagai kas sebelum dibayar.
- Cash flow report membagi operating/investing/financing/transfer berdasarkan account mapping yang disetujui. Transfer internal dikeluarkan dari gross inflow/outflow konsolidasi.
- Agency totals mengambil journal sekali. Client/project profitability menggunakan allocation dimensions dari entry yang sama. Jangan menjumlahkan nilai parent + alokasi sebagai dua biaya.
- Unallocated cost tetap terlihat sebagai agency unallocated; jangan diam-diam mengalokasikan 100% secara default.
- Reports menyatakan basis, currency, period, cutoff, inclusion rules, allocation method dan snapshot/source IDs.

## Reversal dan period closing

- Posted entries tidak dapat diubah atau dihapus.
- Reversal membuat entry baru dengan debit/credit dibalik dan `reverses_entry_id` menunjuk asal; alasan, actor dan waktu diwajibkan.
- Penggantian dibuat sebagai entry baru. UI menampilkan chain original → reversal → replacement.
- Closing period memeriksa reconciliation status, suspense/unallocated policy, approval queue dan trial balance. Close operation mencatat actor/timestamp/checklist snapshot.
- Reopening memerlukan permission tertinggi, reason, audit event, serta aturan untuk laporan snapshot yang sudah dikeluarkan.

## Permissions dan RLS

Finance capability terpisah: `finance.view`, `finance.draft`, `finance.submit`, `finance.approve`, `finance.post`, `finance.reconcile`, `finance.close_period`, `finance.export`, `finance.admin`. Role user bisa memiliki subset capability.

RLS membatasi semua tabel, views, RPC, Storage attachments dan exports. Application service melakukan pre-check, tetapi RLS/RPC melakukan kontrol yang sama pada DB. Approval thresholds dan segregation-of-duties ditegakkan atomik di database. Tidak ada akses finance dari role member hanya karena mereka active agency member.

## Auditability dan reconciliation

Ledger append-only; audit event tidak menyimpan secret dan tidak boleh diubah operator biasa. Import transaksi menyimpan file/source ID, row number/source hash, parser version, external ref, dan duplicate decision. Reconciliation menyimpan statement total, matched journal IDs, unmatched items, reviewer, timestamp dan variance. Report snapshot dapat ditelusuri sampai journal lines, source invoice/bank import, attachment dan actor.

## Integrasi dengan invoice existing

Invoice issued/payment events dikirim melalui outbox/event adapter dengan idempotency key (`source_type`, `source_id`, `event_version`). Finance policy memetakan issue ke receivable/revenue (atau deferred revenue sesuai accounting policy), payment ke bank/AR, credit/cancel ke reversal/adjustment. Jangan mengubah invoice status langsung dari finance dan jangan membuat payment ganda ketika event di-retry.

## Hal yang memerlukan persetujuan

Basis akuntansi, fiscal calendar, currency, tax, chart of accounts, revenue recognition, deposit/deferred revenue, expense policy, cost allocation, client-facing access, bank import source, approval thresholds, owner/finance role relationship, attachment retention, opening balances dan cutover invoice lama harus diputuskan sebelum model fisik dibuat.
