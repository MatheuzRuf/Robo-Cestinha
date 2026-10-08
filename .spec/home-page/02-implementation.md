# Spec 01 — Home Page

Route: `/`. Depends on Spec 00 (design tokens + base components) — do not introduce new one-off styles here; compose from `AppShell`, `Card`, `Button`, `TextInput`, `StatusBadge`.

Location: `src/pages/Home/Home.tsx` + `src/pages/Home/components/*`.

---

## 1. Layout, top to bottom

```
<AppShell activeNavItem="home">
  <HeroSection />
  <SessionActionsSection />   (Host card + Join card, side by side)
  <RecentSessionsSection />   (heading + up to 3 SessionCard items)
</AppShell>
```

No footer content beyond what `AppShell`'s ticker already provides.

---

## 2. `HeroSection`

Centered text block.
- Headline, two lines, each a separate `<span>`/element so they can be colored independently:
  - Line 1: `"LOCAL HARDWOOD."` — `--color-text`
  - Line 2: `"INSTANT TOURNAMENTS."` — `--color-primary`
  - Font: `--font-display`, large (e.g. `clamp(2.5rem, 5vw, 4rem)`), bold, tight line-height.
- Subtext below, `--color-text-muted`: `"Create or join an 8-team simulated basketball tournament session."`

No CTA buttons live in this section — those belong to the cards below it.

i18n keys (snake_case): `home.hero.line_1`, `home.hero.line_2`, `home.hero.subtitle`.

---

## 3. `SessionActionsSection`

Two `Card`s in a row (stack vertically below a breakpoint, e.g. `768px`), equal height.

### 3.1 Host New Session Card
```
[icon] HOST NEW SESSION
Create an 8-team session.

<Button variant="primary" icon={<BasketballIcon/>} fullWidth>
  CREATE TOURNAMENT
</Button>
```

**On "Create Tournament" click:**
- If no display name is saved on this device, open the name modal (Spec 02) first; on submit, proceed.
- If a name is already saved, proceed directly.
- "Proceed" = call the create-session action with `{ name }` (stub as a passed-in `onCreateSession` prop for now).

i18n keys (snake_case): `home.host.title`, `home.host.description`, `home.host.cta`.

### 3.2 Join Arena Card
```
[icon] JOIN ARENA
Enter your tournament hash or full invite link to claim an unclaimed
regional franchise or spectate hardwood live action.

<TextInput label="SESSION PASSCODE OR URL" hint="FORMAT: #RC-XXXX-MET"
           placeholder="E.G. #RC-8812-BKN"
           trailingAction={{ icon: <PasteIcon/>, label: "PASTE", onClick: pasteFromClipboard }} />

<Button variant="secondary" icon={<ArrowIcon/>} fullWidth>
  JOIN SESSION
</Button>
```

**State owned by this component:**
```ts
const [sessionCode, setSessionCode] = useState('');
```
- `PASTE` reads from clipboard via the Clipboard API and sets `sessionCode`.

**On "Join Session" click:** same name-modal gate as Host card, then call `onJoinSession({ name, sessionCode })` (stubbed prop).

i18n keys (snake_case): `home.join.title`, `home.join.description`, `home.join.input_label`, `home.join.input_hint`, `home.join.input_placeholder`, `home.join.cta`.

---

## 4. `RecentSessionsSection`

```
⟲ RECENT SESSIONS                                    (eyebrow, --color-primary, small)
RECENT HARDWOOD SESSIONS                              (heading, --font-display)
                                    Saved on this device.  (right-aligned, --color-text-muted)

[SessionCard] [SessionCard] [SessionCard]
```

- Data source: local device storage (list of past sessions — see `useDeviceIdentity`/session-history hook, built separately; this spec only defines the rendering).
- Renders **up to 3** most-recently-visited sessions. If none exist, hide the whole section (no empty-state illustration needed for v1 — confirm separately if one is wanted).
- Grid: 3 columns desktop, stacks to 1 column below `768px`.

i18n keys (snake_case): `home.recent.eyebrow`, `home.recent.heading`, `home.recent.saved_note`.

### `SessionCard` (`src/pages/Home/components/SessionCard.tsx`)

```ts
interface SessionCardProps {
  sessionCode: string;
  sessionName: string;
  status: { tone: 'live' | 'complete' | 'paused'; label: string };
  detailLine: string;              // e.g. "Court 1: Austin Armadillos vs Dallas Drifters"
  primaryStat: { label: string; value: string };   // left side of the score row
  secondaryStat?: { label: string; value: string; highlight?: boolean }; // e.g. score, or a badge like "8/8 READY"
  footerLeft: string;               // e.g. "Q4 01:24", "7 Games Logged", "All Rosters Full"
  footerRight: string;              // e.g. "7/8 Teams Claimed", "Stats Vault Ready", "Paused Today"
  cta: { label: string; variant: 'primary' | 'secondary' | 'outline'; onClick: () => void };
}
```

Layout inside the card:
1. Top row: `StatusBadge` (left) + session code as plain muted text (right)
2. Session name — bold, larger
3. Detail line — muted, smaller
4. Stat row — label/value pair on the left, a boxed value (score or ready-badge) on the right
5. Footer row — two small muted lines with icons, split left/right
6. `Button` (full width) using the `cta` variant/label passed in

**Do not hardcode which of the 3 example states (live / final / paused) exists** — the component takes props and renders whatever status is passed; the three example cards in the reference image are three *instances* of this one component, not three variants to build separately.

Example instantiation (live state, from reference):
```tsx
<SessionCard
  sessionCode="#RC-9104-TEX"
  sessionName="LONESTAR INVITATIONAL"
  status={{ tone: 'live', label: 'LIVE · SEMI-FINALS' }}
  detailLine="Court 1: Austin Armadillos vs Dallas Drifters"
  primaryStat={{ label: 'AUSTIN ARMADILLOS', value: 'Your Claimed Club' }}
  secondaryStat={{ label: '', value: '74 : 71', highlight: true }}
  footerLeft="Q4 01:24"
  footerRight="7/8 Teams Claimed"
  cta={{ label: 'RESUME BROADCAST', variant: 'primary', onClick: () => {} }}
/>
```

---

## 5. Non-goals for this spec
- The display-name modal itself (see Spec 02).
- Real data fetching for recent sessions or session creation/join API calls — this spec covers structure, props, and local UI state only; wire to real handlers/hooks separately.
- Responsive behavior below mobile breakpoints beyond the single stacking rule noted above.
