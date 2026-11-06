# Component library

Components are built on the existing React/TypeScript codebase; no UI framework dependency was added.

| Component | Source | State/usage contract |
|---|---|---|
| Button | `ui.tsx` | Primary/secondary/quiet; loading adds spinner, `aria-busy` and disables repeat action; destructive uses existing danger class. |
| Input, Textarea, Select | `ui.tsx` | Caller supplies a visible associated label, validation text and name. Focus is visible. |
| Checkbox, Radio | `ui.tsx` | Native inputs; use a fieldset/legend for related groups. |
| Badge | `ui.tsx` | Neutral/success/warning/danger; include readable status text. |
| Avatar | `ui.tsx` | Initials from a name, `role=img` label; no remote image dependency. |
| Dropdown | `ui.tsx` | Native `details/summary`; keyboard operates with Enter/Space. |
| Modal/Dialog | `ui-overlays.tsx` | Focus enters, Tab remains within, Escape closes, prior focus restored. Backdrop dismissal is intentionally not assumed. |
| Drawer | `ui-overlays.tsx` | Same focus behavior; use for side details or mobile navigation when a task benefits from it. |
| Tabs | `ui.tsx` | Semantic navigation links with `aria-current`; current underline/color transition. |
| Tooltip | `ui.tsx` | Native title hint for supplemental text; never the only accessible name or instruction. |
| Table | `ui.tsx` | Scrollable labeled region, `tabIndex=0`; rows are not made clickable by default. Use links/buttons in the intended cell. |
| Pagination | `ui.tsx` | Previous/next disabled at ends; current page announced with `aria-live`. |
| Card | `ui.tsx` | Neutral surface; only add hover affordance when the card is a real link/action. |
| Alert | `ui.tsx` | Info/success/warning/danger with icon marker, text and semantic role; use inline for important errors. |
| Toast | `ui-overlays.tsx` | Auto-dismiss with manual dismiss; `useToast()` sends a supplemental status, capped at four visible items. |
| Skeleton / loading | `ui.tsx` | Skeleton decorative; pair with `LoadingState` for a perceivable status. |
| EmptyState | `ui.tsx` | Describes absence and optional next action. |
| SearchBar / FilterBar | `ui.tsx` | Search has a named input; filter group has an accessible label. Caller owns submit/debounce semantics. |
| Breadcrumb / PageHeader | `ui.tsx` | Named breadcrumb navigation; one page H1, optional description and actions. |
| DetailPanel | `ui.tsx` | Labeled complementary region for selected-record information. |

## States

- **Buttons:** default, hover, active, keyboard focus, disabled and loading. Button text should describe the action; do not show success before server confirmation.
- **Fields:** default, focus, invalid (adjacent text plus `aria-describedby`), disabled and read-only. Use native required and validation attributes where suitable.
- **Navigation:** default, hover, active route, collapsed tooltip, disabled permission entry and mobile drawer open/closed.
- **Tables:** loading skeleton, empty state, error state, selected row only where selection is implemented, hover on row, sort direction indicated by text/icon.
- **Overlays:** entering, open, keyboard focus, closing; unsaved changes require caller-controlled confirmation before invoking close.
- **Toast:** neutral/success/danger with manual dismiss. A toast cannot replace an inline form error or audit-sensitive confirmation.

## Existing versus added

The repository already had form, badge, card, table, pagination, breadcrumb, loading/empty, dialog/drawer and standalone toast primitives. This pass extends those with loading buttons, Avatar, Alert, SearchBar, FilterBar, PageHeader, DetailPanel, a toast provider/hook, and shared responsive/accessibility styles. Existing screen-specific forms, tables and status displays remain in place unless they benefit from these primitives later.
