# Micro-interactions

## Timing and easing

| Interaction | Target | Implementation |
|---|---:|---|
| Hover feedback | 120–180ms | 140–150ms color/border transition |
| Button press | 100–150ms | 100ms translateY(1px), no layout shift |
| Tooltip | 150–200ms | Native browser title hint for supplemental text |
| Dropdown | 150–200ms | 160ms opacity/translate entrance |
| Modal entrance | 180–240ms | 180ms overlay fade + 200ms dialog opacity/scale |
| Drawer entrance | 200–260ms | 200–220ms transform/opacity |
| Toast entrance | 160–220ms | 180ms transform/opacity; default duration 5s |
| Sidebar collapse | 180–240ms | 200ms width/flex-basis transition |

Use ease-out for entry, standard ease for hover, and no bounce/elastic motion.

## Interaction behavior

- **Sidebar:** hover surface is subtle; active route uses a sage fill and dark text; section buttons announce `aria-expanded`; collapsed items retain accessible labels. Root layout state avoids resetting collapse on route changes.
- **Buttons:** hover, active, focus-visible and disabled styles are distinct. `Button loading` disables repeat action, exposes `aria-busy`, and displays a small spinner. Caller only shows success after the server confirms success.
- **Cards/KPIs:** current KPI tiles are actual links and receive hover feedback; other cards remain neutral and do not look like buttons.
- **Tables:** table body hover is low contrast; row selection/action is not inferred. Existing action links remain explicit. Scroll region is keyboard focusable and named.
- **Search/filters:** search controls receive border/focus ring. Existing search forms submit explicitly; no per-keystroke database requests are added. Filter UI remains owned by the screen that knows its real data.
- **Modal/drawer:** focus enters and stays in the open dialog, Escape closes, previous focus returns. Backdrop click does not close by default; callers with unsaved data must confirm before closing.
- **Tabs/dropdowns:** active tab underline/color changes smoothly; native details/summary keeps keyboard behavior.
- **Toast/form feedback:** dismissible, capped to four visible messages, with five-second default. Important validation/server errors stay near the relevant form as text.
- **Loading:** skeleton shimmer supports data-loading screens and honors reduced motion; `LoadingState` announces text. Existing routes keep their own accurate empty/error messages.

## Reduced motion and accessibility

Global `prefers-reduced-motion: reduce` reduces transitions and animations to near-zero duration and disables smooth scrolling. All shell navigation is keyboard-operable; there is a skip link, visible `:focus-visible` ring, minimum 44px primary touch controls, named icon buttons, native labels/links/buttons and dialog focus management. Status markers include text. Horizontal table overflow remains contained and reachable.

No automated accessibility or visual regression test was added. Reduced motion and mobile behavior still require browser inspection as part of the requested validation.
