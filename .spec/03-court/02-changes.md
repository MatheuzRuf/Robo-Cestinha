# Match Broadcast Spec 02 — Compact Layout

## 1. What changes and why

Spec 01's `TeamScorePanel`/`GameClockPanel` cards are tall relative to the information they hold, and `PlayByPlayLog`/`CommentaryPanel` sat in a half-width row below the court, capped short. This spec:
- Replaces the three-card scoreboard row with a single slim bar.
- Moves `PlayByPlayLog` to a left column beside the court, given the full column height instead of a short card.
- Moves commentary to a right column, and changes it from one rotating line to a **scrollable stack of past comments** — a running history, not a single replaced string.
- `MomentumShiftEngine` stays as-is, now sitting under the court/timeline in the center column.

---

## 2. New layout

```
<AppShell activeNavItem="liveBroadcast" tickerText={mockTickerText}>
  <BroadcastHeader />              (unchanged from Spec 01)
  <CompactScoreboardBar />         (replaces ScoreboardRow)
  <BroadcastMainGrid>
    <PlayByPlayColumn />           (left)
    <CenterColumn>
      <CourtStage />
      <PlayCallStrip />
      <TimelineScrubber />
      <MomentumShiftEngine />
    </CenterColumn>
    <CommentaryColumn />           (right)
  </BroadcastMainGrid>
</AppShell>
```

`BroadcastMainGrid` is a 3-column CSS grid: side columns fixed-ish width (e.g. `320px`), center flexible (`1fr`). Side columns stretch to match the center column's full height (court + play call strip + timeline + momentum panel combined), with their own internal scroll — they shouldn't grow the page's height beyond the center column's.

Below a narrow breakpoint, stack vertically in order: scoreboard bar → court/center column → play-by-play → commentary (side columns drop under the center column rather than staying beside it).

---

## 3. `CompactScoreboardBar` (new, replaces `ScoreboardRow`)

Single-row bar replacing the three tall cards from Spec 01.

```ts
interface TeamSummary {
  abbreviation: string;         // "CS"
  name: string;
  score: number;
  seedLabel?: string;
  possession?: boolean;
  fouls: { current: number; max: number };
  timeouts: { remaining: number; total: number };
}

interface CompactScoreboardBarProps {
  home: TeamSummary;
  away: TeamSummary;
  quarterLabel: string;
  gameClock: string;
  shotClock: string;
  simSpeed: 1 | 1.5 | 2;
  onSimSpeedChange: (speed: 1 | 1.5 | 2) => void;
  isPaused: boolean;
  onTogglePause: () => void;
}
```

Single-line layout: `[home abbreviation + score + fouls/timeouts]  —  [quarter · clock · shot clock · speed control · pause]  —  [away score + abbreviation + fouls/timeouts]`. Fouls/timeouts shrink to small inline muted text next to each team's score rather than their own labeled row. Sim speed keeps the `SegmentedControl` from `spec-00-design-system.md`; pause keeps `Button` (`variant="outline"`) — same controls as before, just laid out horizontally in one bar instead of a dedicated center card.

**Remove** `TeamScorePanel` and `GameClockPanel` from Spec 01 — this component replaces both; don't keep the old ones around unused.

---

## 4. `PlayByPlayColumn`

Wraps the existing `PlayByPlayLog` (props unchanged from Spec 01) in a `Card` that fills the column's full height, with internal scroll once entries exceed the visible area. Drop the "last 5" cap from Spec 01 — since there's now room to show a real scrolling history, keep growing the list (capped at a larger sane number, e.g. 50, for memory's sake) rather than truncating to 5.

```ts
interface PlayByPlayColumnProps {
  entries: PlayByPlayLogEntry[];   // same shape as Spec 01, most recent first
}
```

---

## 5. `CommentaryColumn` (replaces `CommentaryPanel`'s single-line behavior)

Renders a stack of past comments, most recent at the top, inside a `Card` filling the column's height with internal scroll — same "growing history" behavior as `PlayByPlayColumn`, not a single line that gets overwritten.

```ts
interface CommentaryEntry {
  id: string;
  gameClock: string;      // "[01:42 Q4]"
  text: string;
}

interface CommentaryColumnProps {
  entries: CommentaryEntry[];    // most recent first, capped similarly (e.g. 50)
  voiceLabel?: string;           // "VOICE SYNTH: CHUCK "CLUTCH" HARLAN" — shown once, at the top of the column, not per-entry
}
```

**Mock data change from Spec 01:** the mock commentary source now appends a new `CommentaryEntry` periodically (independent cadence from play-by-play, e.g. every 10–20 simulated seconds) instead of rotating through and replacing a single `commentaryText` string. This is the only behavior change needed in the mock layer — the frame/event engine from `match-broadcast-spec-00-court-engine.md` is untouched.

i18n keys: `match_broadcast.commentary.title` (unchanged), `match_broadcast.commentary.voice_label` (unchanged) — no new keys needed beyond what Spec 01 already defined, since the visible copy doesn't change, only the layout/data shape.

---

## 6. Non-goals for this spec
- No changes to the court/animation engine (`match-broadcast-spec-00-court-engine.md`) — this is a layout/composition change only.
- No changes to `PlayCallStrip`, `TimelineScrubber`, or `MomentumShiftEngine`'s own internals — only their position in the new grid.
- No persistence of play-by-play/commentary history across a page reload — still in-memory only, resets on refresh, same as Spec 01.
- No virtualized scrolling for long lists — a plain scrollable `Card` is enough at the list sizes this mock data produces.