# Color tokens

CSS variables live in `src/app/globals.css`; component and layout applications are in `src/app/app.css`.

## Core palette

| Token | Value | Purpose |
|---|---|---|
| `--color-brand-950` | `#102A20` | Deepest forest for strong action/contrast |
| `--color-brand-900` | `#173B2D` | Primary sidebar and brand heading |
| `--color-brand-700` | `#2F674F` | Links and primary controls |
| `--color-brand-100` | `#DFE8E1` | Quiet selected/brand surface |
| `--color-sage-500` | `#B7C9B6` | Restrained selected nav/brand mark accent |
| `--color-sage-100` | `#E9EEE8` | Soft hover/low emphasis surface |
| `--color-canvas` | `#F7F5EF` | Warm ivory page background |
| `--color-surface` | `#FFFEFA` | Main panel and control surface |
| `--color-surface-raised` | `#FFFFFF` | Floating menu surface |
| `--color-text` | `#21342B` | Primary text |
| `--color-muted` | `#5D6E64` | Secondary text |
| `--color-border` | `#DDDCD3` | Neutral boundary |
| `--color-success` | `#315C3E` | Success text/state |
| `--color-warning` | `#76520F` | Warning text/state |
| `--color-danger` | `#8B3D35` | Error/destructive text/state |

## Verified text contrast

| Foreground | Background | Ratio | WCAG AA normal text |
|---|---|---:|---|
| `#21342B` | `#F7F5EF` | 12.11:1 | Pass |
| `#F5F6F1` | `#173B2D` | 11.37:1 | Pass |
| `#173B2D` | `#B7C9B6` | 7.08:1 | Pass |
| `#5D6E64` | `#F7F5EF` | 4.96:1 | Pass |
| `#FFFFFF` | `#2F674F` | 6.62:1 | Pass |

These ratios cover primary intended text pairings; validate newly introduced semantic/status colors and interactive boundaries when using them on a new surface. Status always includes a text label or icon plus text.

## Type, spacing and elevation

- Sans stack: Inter if available, then system UI fonts; no external font download added.
- Editorial heading: Georgia/Times for H1 and selected feature headings; body and control text remains sans.
- Type sizes: 12px metadata, 14px secondary/control, 15px body, 18px section title, 30–42px page title (fluid on desktop, 29px mobile).
- Spacing: 4, 8, 12, 16, 20, 24, 32, 40px.
- Radius: 5px control, 9px standard panel, 13px large panel; circular avatar only.
- Shadows: floating menu, toast and dialog only. Standard content cards sit flat on the page.

## State usage

Forest identifies primary navigation/actions; sage marks selected navigation and limited emphasis. Neutral ivory/white surfaces hold data. Warning, success and danger colors are semantic and paired with labels. Avoid using the sage accent for long body text when a darker brand token is required for contrast.
