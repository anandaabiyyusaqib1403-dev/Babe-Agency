# Navigation structure

## Global sidebar

| Section | Destination | Route | State |
|---|---|---|---|
| Studio | Studio Overview | `/dashboard` | Existing data-backed dashboard |
| Studio | Client Portfolio | `/clients` | Existing client list |
| Creative Workflow | Content Studio | `/content` | Existing planner entry |
| Content Studio | Idea Bank | `/content/ideas` | Honest placeholder |
| Content Studio | Content Planner | `/content` | Existing planner |
| Content Studio | Production Board | `/content/production` | Honest placeholder |
| Content Studio | Content Library | `/content/library` | Honest placeholder |
| Creative Workflow | Review & Approval | `/approval` | Existing approval flow |
| Creative Workflow | Publishing Schedule | `/publishing` | Honest placeholder |
| Growth & Insights | Performance Insights | `/performance` | Existing performance screen |
| Growth & Insights | Reports & Recap | `/reports` | Existing reports screen |
| Studio Finance | Finance Overview | `/finance` | Disabled sidebar entry; safe no-data placeholder route |
| Studio Finance | Cash Flow | `/finance/cash-flow` | Disabled sidebar entry; safe no-data placeholder route |
| Studio Finance | Transactions | `/finance/transactions` | Disabled sidebar entry; safe no-data placeholder route |
| Studio Finance | Financial Reports | `/finance/reports` | Disabled sidebar entry; safe no-data placeholder route |
| Studio Finance | Accounts & Categories | `/finance/accounts` | Disabled sidebar entry; safe no-data placeholder route |
| Studio Resources | Asset Library | `/assets` | Honest placeholder |
| Studio Resources | Document Archive | `/documents` | Existing document center |
| Settings | Studio Settings | `/settings` | Existing settings screen |

The tasks route remains available from dashboard links and the task-search/reminder entry point. Existing invoice screens remain reachable through the document area; they are not presented as the new double-entry finance module.

## Behavior

- All workspace routes use the same `WorkspaceShell` and `SidebarNavigation`; client detail routes keep the global sidebar.
- Active route matching covers nested client/content/finance detail paths.
- Groups expand/collapse. Desktop collapse preserves state across navigation through the root `AppShellStateProvider`; collapsed group buttons retain an accessible label and a native title hint.
- At viewport widths up to 760px, the sidebar becomes a modal drawer. Menu button exposes expanded state; Escape and close control dismiss it; focus is contained and returned to the menu button.
- Finance navigation accepts permission keys through `WorkspaceShell`. Since the current schema/source does not provide these permission grants, no finance entries are linked by default. Manual entry to a finance placeholder shows no data. This is a UI default only; server/RLS authorization is still required before any finance data is added.
- Module placeholders explicitly say the area is not available and do not imply a feature is complete or display fake operational data.

## Profile and global utilities

The top bar has breadcrumb, existing task search, task reminder link and an accessible profile menu for profile, security settings and sign out. Search remains scoped to the current real route (`/tasks`) rather than pretending to search every module. The task reminder entry points to the existing overdue-task view; it does not claim to be a full notification inbox.
