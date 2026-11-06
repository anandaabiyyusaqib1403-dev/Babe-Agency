# Access control matrix

## Legend

`R` read; `C` create/invite; `U` update; `D` delete/revoke; `X` privileged audited action. “Proposed” roles/capabilities are not currently provisioned. Default deny applies; resource and client scope still apply even where a cell grants access.

| Capability/resource | Head of Agency (proposed) | Developer (proposed) | Agency Member (proposed) | Finance Operator (open) | Finance Reviewer (open) | Finance Admin (open) |
|---|---:|---:|---:|---:|---:|---:|
| Studio overview/client portfolio | R/U | R, technical support | R/U | — unless separately granted | — unless separately granted | — unless separately granted |
| Creative workflow and publishing | R/C/U/X | R/C/U per assigned membership | R/C/U per ordinary workflow | — | — | — |
| Review and approval | R/C/X | R/C per assigned workflow | R/C/X per assignment | — | — | — |
| Performance/reports | R/C/U/X | R per operational role | R/C/U by reporting permission | — | — | — |
| Assets/document archive | R/C/U/archive | R/C/U for support scope | R/C/U | Evidence scope only if granted | Evidence scope only if granted | Evidence scope only if granted |
| Read member list | R | — | limited directory only | — | — | — |
| Invite/resend/revoke member | C/U/D | — | — | — | — | — |
| Change role/deactivate/reactivate | X | — | — | — | — | — |
| Workspace settings | R/U/X | technical settings only | — | — | — | — |
| Integrations/technical settings | scoped X | X with approved integration permission | — | — | — | — |
| Read finance transactions/journals | — by default | — | — | R | R | R |
| Create/edit finance draft | — | — | — | C/U draft only | — or draft review | C/U draft only if assigned |
| Approve/post journal | — | — | — | — | X approve/post under separation policy | X only if separately approved |
| Reverse posted journal | — | — | — | — | X with reason | X with reason/approval |
| Close/reopen period | — | — | — | — | X close | X close/reopen with extra audit |
| View financial reports | — | — | — | R | R | R |
| Manage accounts/categories | — | — | — | — | — | X |
| Audit log | operational scope | technical scope | own/action-limited | finance scope | finance scope | finance scope |

The proposed matrix deliberately does not grant finance to Head of Agency or Developer by job title. Owner must approve finance roles, permission assignment, creator/approver separation and break-glass access before financial data is exposed.

## Current implementation comparison

Current DB role values are `owner/admin/member`, with `owner` and `admin` able to manage membership according to the migration-defined helper. Active agency members share access to most operational tables. Invoice and billing tables exist; current policy design grants active-member read access to invoice/payment-related data, so this is not a finance-restricted boundary. The requested finer role separation is a future design, not a current capability. Exact deployed effective grants must be verified after migration-ledger reconciliation.

## Finance action permissions (proposed keys)

| Permission | Operator | Reviewer | Finance Admin |
|---|---:|---:|---:|
| `finance.read` | yes | yes | yes |
| `finance.transaction.draft.write` | yes | no/limited | yes |
| `finance.journal.approve` | no | yes | optional, avoid self-approval |
| `finance.journal.post` | no | yes after approval | optional by explicit policy |
| `finance.journal.reverse` | no | yes with reason, possibly second approver | yes with audit |
| `finance.period.close` | no | yes if designated controller | yes if designated |
| `finance.period.reopen` | no | no | separate elevated capability |
| `finance.report.read` | yes | yes | yes |
| `finance.account.manage` | no | no | yes |
| `finance.category.manage` | no | no | yes |

Do not assign these keys to any named person until finance authority is approved. Implement as permission grants, not `if user.name === ...` or hardcoded email checks.
