# Open decisions

These questions affect schema, access control or migration semantics. Recommendations are proposals; none is silently treated as approved. Highest priority items should be resolved before migration design is converted into executable SQL.

| Priority | Decision | Options | Recommendation | Impact if unresolved |
|---|---|---|---|---|
| Critical | Reconcile 13 local migration files with 12 remote ledger entries, including timestamp/name drift and the latest local-only file | Restore a known matching branch; formally repair ledger after evidence; create forward reconciliation migration | First compare applied bodies/schema effects and remote ledger in read-only manner, capture backup; only then approve an explicit repair/forward plan | Any migration can duplicate or omit production changes; unsafe to push schema work |
| Critical | Workspace tenancy mapping from current `agency_members` and 43-table schema | One workspace for BABE; future multi-workspace; tenant ownership on all tables | Model one initial workspace but use workspace-scoped keys from outset; map existing agency membership without changing auth UUID | Determines all FK/RLS design and client data isolation |
| Critical | Finance capability/role model and separation of duties | Admin inherits finance; explicit finance operator/approver; owner-only; dual approval thresholds | Capability permissions independent from creative/admin role; separate draft, approve/post, close/reverse permissions; require owner approval | Controls RLS, posting RPC and finance UI; exact role names remain open |
| Critical | Migration disposition of existing invoices/payments | Leave isolated legacy; bridge each invoice/payment to GL; eventually retire | Keep unchanged/outside MVP; any later bridge must be explicitly approved and reconciled, never auto-count invoice/payment plus GL | Existing invoice totals could otherwise double count or be lost |
| High | Stable client/project semantics for profitability | Client-only attribution; project records; both client and project | Add projects as optional analytic dimension, with client required; ensure project belongs to that client | Determines journal-line and allocation FKs/report grouping |
| High | Cash vs accrual rules and chart of accounts | One basis only initially; support both from same journals; hybrid rules | Build one accrual-capable ledger; derive cash basis from cash-account movements and approved recognition rules; accountant reviews chart | Financial statements may be mislabeled or incomparable without formal rules |
| High | Finance posting and approval thresholds | Single approver; creator/approver separation; threshold-based dual approval | Separate creation from posting; no self-approval for designated material entries; thresholds to be decided by agency owner/accountant | RLS and atomic posting transition depend on it |
| High | Period frequency, close/reopen and backdating | Monthly periods; arbitrary periods; reopen allowed with audit | Monthly periods by default; closed period blocks postings; reopen only privileged audited operation, prefer next-period adjustment | Period and report integrity depend on policy |
| High | Quota eligibility and period boundaries | Count idea, planned, approved or published content; calendar vs contract periods | Count one stable Content ID once when it first reaches an agreed billable/eligible status within period; snapshot package terms per assignment | Quota usage and reports otherwise disagree |
| High | Report finalization semantics | Finalize immutable snapshot and lock draft; allow new version; supersede | Finalize immutable version; draft may continue only by cloning/new version; exact source performance snapshots pinned | Historical reports may shift with live metrics if unresolved |
| Medium | Performance collection model | Manual only; API integration per platform; mixed | Design source-neutral snapshots now; add platform connectors only when credentials/API scope approved | Determines account fields, sync jobs and provider limits |
| Medium | Google Drive metadata ownership and file hierarchy | Drive IDs only; mirrored folder metadata; allow Supabase Storage fallback | Drive remains binary source; store file ID/drive ID/parent and sync status; use server-only secret reference; fallback status is explicit | Browse/search consistency and document recovery behavior |
| Medium | Polymorphic document/report source reference strategy | `(source_type,source_id)` polymorphic; typed nullable FKs; immutable snapshot only | Prefer typed FKs for sources requiring referential integrity; otherwise store stable source IDs plus version/hash in immutable payload | Polymorphic FK cannot be enforced by PostgreSQL |
| Medium | Audit retention and actor deletion | Indefinite; fixed retention; anonymized actor refs | Preserve audit event; nullable actor FK with immutable actor UUID snapshot; choose retention policy with legal/business review | Privacy, storage and accountability tradeoffs |
| Medium | Existing repository layout and generated types | Add database package/workspaces now; keep existing structure | Keep current architecture/repo shape; add generated database types in existing source location only after schema cutover | Avoids premature restructuring; type path needs owner decision |

## Assumptions used for this draft

- One BABE workspace is the initial production tenant, though schema is tenant-scoped.
- IDR is the only MVP currency; no payroll, invoice management, tax filing, budgeting or payment gateway is included in proposed new finance domain.
- Supabase Auth remains the identity provider; no parallel passwords or local auth table.
- Drive stores binary data; PostgreSQL stores references and queryable metadata.
- Monthly/social reports are separate; published performance is publication-specific; final report versions and posted journals are immutable.
- Existing schema remains in place until an approved mapping/cutover is produced. This design creates no schema change.

## Approval gate

Before the first schema migration, the project owner should decide the first four critical items and approve the migration reconciliation plan. Finance role names and thresholds can stay configurable, but the capability boundaries and who may post/close must be agreed before enabling finance writes.
