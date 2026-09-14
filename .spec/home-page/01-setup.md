# Spec 00 — Design Tokens & Base Components

Foundation layer. Build this before the Homepage (Spec 01) — the homepage is composed entirely from these pieces, nothing homepage-specific should be styled ad hoc.

Location: `src/styles/tokens.css`, `src/components/*`.

---

## 1. Design Tokens (`src/styles/tokens.css`)

Retro hardwood / basketball-broadcast palette. Values are approximate — nudge to match final brand assets if provided, but keep the same *roles*.

```css
:root {
  /* Backgrounds */
  --color-bg: #14100D;              /* page background */
  --color-surface: #1F1913;         /* card background */
  --color-surface-raised: #2A221A;  /* nested/inner panels, input fields */
  --color-border: #3A2F24;          /* card & input borders */

  /* Text */
  --color-text: #F0E6D2;            /* primary text, cream */
  --color-text-muted: #A69A87;      /* secondary text, labels */
  --color-text-inverse: #14100D;    /* text on light/cream buttons */

  /* Brand / actions */
  --color-primary: #E2661A;         /* leather orange — primary actions, active states */
  --color-primary-hover: #F0791F;
  --color-cream-button: #EDE3D0;    /* secondary button fill (Join Session, Continue Lobby) */

  /* Status */
  --color-live: #C1272D;            /* live/urgent indicator */
  --color-warning: #F2B705;         /* champion/final results, amber accents */
  --color-success: #4C9A6A;         /* ready/complete states, used sparingly */

  /* Typography */
  --font-display: 'YourDisplayFont', system-ui, sans-serif;  /* headlines, scores */
  --font-body: 'YourBodyFont', system-ui, sans-serif;
  --font-mono: 'YourMonoFont', ui-monospace, monospace;      /* codes, tickers, logs */

  /* Spacing scale */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
```

Do not hardcode hex values or px spacing in any component's `.module.css` — always reference these variables.

---

## 2. Base Components

Each is generic and content-agnostic (props in, no data-fetching, no page-specific copy).

### `AppShell` (`src/components/AppShell/`)
Wraps every page. Renders the top nav bar and bottom broadcast ticker; page content is passed as `children`.

**Top bar contents (left to right):**
- Logo mark + `"ROBÔ CESTINHA"` + subtitle `"MULTIPLAYER TOURNAMENT BROADCAST"`
- Nav links (each can wrap to two lines): Home, Team Locker, Bracket Tree, Live Broadcast — active link gets `--color-primary` background
- Right cluster: online-count badge (dot + text, e.g. `"8/8 TEAMS ONLINE"`), session code chip with copy icon, audio toggle icon button, profile/avatar icon button

**Bottom ticker:**
- Label `"BROADCAST TICKER"` (orange, bold) + scrolling/truncated status text + right-aligned meta (`"ARENA 04 · HARDWOOD FEED ACTIVE"`, copyright)

Props:
```ts
interface AppShellProps {
  activeNavItem: 'home' | 'teamLocker' | 'bracketTree' | 'liveBroadcast';
  onlineCount?: { current: number; total: number };
  sessionCode?: string;
  tickerText?: string;
  children: React.ReactNode;
}
```
If `sessionCode`/`onlineCount`/`tickerText` are absent (e.g. on the homepage with no active session), hide those elements rather than rendering empty placeholders.

### `Button` (`src/components/Button/`)
Variants: `primary` (solid orange, e.g. Create Tournament), `secondary` (cream/light fill, dark text, e.g. Join Session, Continue Lobby), `outline` (dark fill, border, e.g. View Replay Bracket). Supports an optional leading icon.
```ts
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline';
  icon?: React.ReactNode;
  fullWidth?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}
```

### `Card` (`src/components/Card/`)
Plain container: `--color-surface` background, `--radius-lg`, `--color-border` border, `--space-6` padding. No content assumptions — everything inside is `children`.

### `SegmentedControl` (`src/components/SegmentedControl/`)
Two-or-more-option toggle group (used for Simulation Speed, Quarter Length).
```ts
interface SegmentedControlProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}
```
Selected option gets `--color-primary` fill; others stay `--color-surface-raised`.

### `CheckboxRow` (`src/components/CheckboxRow/`)
Label + description on the left, checkbox on the right (used for "Auto-Fill Regional AI Clubs").
```ts
interface CheckboxRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}
```

### `TextInput` (`src/components/TextInput/`)
Standard input with an optional trailing action button (used for the session-code field with a Paste button).
```ts
interface TextInputProps {
  label?: string;
  hint?: string;              // e.g. "FORMAT: #RC-XXXX-MET", right-aligned next to label
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  trailingAction?: { icon: React.ReactNode; label: string; onClick: () => void };
}
```

### `Chip` (`src/components/Chip/`)
Small pill for session codes (`#RC-7842-OAK`), clickable when used as a "featured session" shortcut.
```ts
interface ChipProps {
  label: string;
  onClick?: () => void;
}
```

### `StatusBadge` (`src/components/StatusBadge/`)
Small dot + label combo for statuses like `LIVE · SEMI-FINALS`, `FINAL RESULTS`, `PAUSED · ROUND OF 8`. Color of the dot/text driven by a `tone` prop, not hardcoded per usage.
```ts
interface StatusBadgeProps {
  tone: 'live' | 'complete' | 'paused' | 'info';
  icon?: React.ReactNode;
  children: React.ReactNode;
}
```

### `Modal` (`src/components/Modal/`)
Generic overlay + dialog container (title, body via `children`, close on backdrop click or explicit close). Used later for the display-name modal — build the generic shell now even though the homepage spec doesn't render it open by default.