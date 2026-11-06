# BABE CONTENT STUDIO design system

## Purpose and visual direction

The workspace adapts the supplied reference's useful structure—persistent vertical navigation, clear top context, dense but grouped data, and a detail area when a workflow needs one—without carrying over its hospital identity, copy or data. BABE's identity uses deep forest navigation, warm ivory work surfaces, sage as a restrained highlight, and editorial serif page titles paired with a readable system sans for operational text.

The layout favors real client/content/task information already available in the application. The dashboard keeps current database-driven summaries; it does not insert demo totals or fabricated financial KPIs. Nonexistent modules show explicit foundation placeholders with no simulated records.

## Shell and hierarchy

- One global sidebar groups Studio, Creative Workflow, Growth & Insights, Studio Finance, Studio Resources and Settings.
- Sidebar state lives in a provider at the root layout so desktop collapse does not reset on navigation. Workspace pages use the same `WorkspaceShell`; client detail routes do not switch navigation.
- The top bar shows breadcrumb context, the existing task search entry point, task-reminder link and a profile menu for profile/security/sign-out.
- Main content has a restrained page heading and flexible width. Dense lists and tables keep their own horizontal overflow. A right-side detail panel is a reusable pattern and is used only where a page has meaningful detail content.
- On small viewports the sidebar becomes a modal drawer with Escape, focus containment, a close control and body scroll lock. The main content remains single-column; tables can scroll horizontally within their labeled region.

## Tokens

Source of truth: CSS variables in `src/app/globals.css`, detailed in `color-tokens.md`. Core colors: forest `#173B2D`, sage `#B7C9B6`, ivory `#F7F5EF`, white `#FFFEFA`, body ink `#21342B`, muted text `#5D6E64`. Pairings were checked with the antislop contrast utility: ink/ivory 12.11:1, white/forest 11.37:1, forest/sage 7.08:1, muted/ivory 4.96:1, white/brand green 6.62:1.

Typography: system sans for UI, data and forms; Georgia/Times serif for major page headings and placeholder editorial statements. Spacing uses a 4px base scale with larger 24/32/40px section steps. Radius is 5px for controls, 9px for panels and 18px for larger dialog surfaces. Shadows are reserved for floating menus/toasts/dialogs.

## Component set

Reusable primitives are in `src/components/ui.tsx` and `ui-overlays.tsx`:

- Form: `Button` (including loading state), `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `SearchBar`, `FilterBar`.
- Structure: `Card`, responsive `Table`, `Pagination`, `Breadcrumb`, `PageHeader`, `DetailPanel`, `Tabs`, `Dropdown`.
- Feedback: `Badge`, `Avatar`, `Alert`, `Tooltip`, `Skeleton`, `LoadingState`, `EmptyState`, `ToastProvider`, `useToast`.
- Overlays: `Dialog`, `Drawer`, `ConfirmationDialog`, dismissible `Toast` with focus handling.

Use native links for navigation and buttons for actions. A card is not clickable unless rendered as an actual link/button. The table wrapper has a keyboard-focusable horizontal scroll region and a label. Components keep labels/errors in text and do not rely on color alone. See `component-library.md` for state contracts.

## State and behavior principles

- Default, hover, active, focus-visible and disabled are distinct. Loading buttons disable repeat submits and announce busy state; server success must be confirmed by the caller before success feedback is shown.
- Field errors remain next to the associated input. Important failures use inline `Alert`/error text; toast is supplemental.
- Empty, loading and error states explain what happened or what action is available. Placeholders say that a module is not implemented and do not fabricate data.
- Motion is short and purposeful; transform/opacity are used for overlays and toasts. `prefers-reduced-motion: reduce` removes nonessential motion.
- Responsive behavior, timing and keyboard handling are in `micro-interactions.md`.

## Design boundaries

The permission system is not yet wired into page props. `SidebarNavigation` accepts permission keys, and missing finance permissions default to disabled entries. Finance routes return a no-data access/configuration placeholder. This navigation choice is not authorization; any eventual finance data route must add server and RLS checks first.

This foundation does not add operational features, database changes or production deployment. Existing content, client, review, performance, report, document, task and invoice screens remain backed by their existing source; this design pass does not claim their business behavior is newly implemented.
