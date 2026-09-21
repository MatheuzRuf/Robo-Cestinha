# Match Broadcast Spec 01 — Match Broadcast Page

Builds the full page from the reference screenshot around the court/animation pieces Spec 00 produced. All data on this page is mock/static for now — no API connection.

Route: temporary fixed path (e.g. `/match-demo`) since there's no real session/match id yet — note this explicitly as a placeholder to swap for `/session/:hash/match/:matchId` once sessions exist.

Location: `src/pages/MatchBroadcast/MatchBroadcast.tsx` + `src/pages/MatchBroadcast/components/*`.

---

## 1. Layout, top to bottom

```
<AppShell activeNavItem="liveBroadcast" tickerText={mockTickerText}>
  <BroadcastHeader />          (live indicator, game meta, sim/replay toggle, latency badge)
  <ScoreboardRow />            (TeamScorePanel x2 + GameClockPanel, center)
  <CourtStage />               (Court + animated Players/Ball, from Spec 00)
  <PlayCallStrip />            (play call text, shot probability, defensive scheme)
  <TimelineScrubber />
  <BroadcastPanelsRow />       (PlayByPlayLog + CommentaryPanel side by side)
  <MomentumShiftEngine />
</AppShell>
```

---

## 2. `BroadcastHeader`

Left: `StatusBadge` (tone `live`) — `"LIVE FEED // COURT 01"`. Plus small muted meta text, e.g. `"DIVISION A CHAMPIONSHIP SERIES · GAME 7"`.
Right: `SegmentedControl` with two options `LIVE SIM` / `REPLAY-BOX` (Replay-Box is disabled/inert for this pass — no replay data source yet), plus a small muted badge showing a static mock latency value, e.g. `"LATENCY: 18ms"`.

i18n keys: `match_broadcast.header.live_label`, `match_broadcast.header.game_meta`, `match_broadcast.header.mode_live`, `match_broadcast.header.mode_replay`, `match_broadcast.header.latency_label`.

---

## 3. `ScoreboardRow`

Three-column row: `TeamScorePanel` (home) — `GameClockPanel` — `TeamScorePanel` (away). Equal width, `GameClockPanel` visually centered/emphasized.

### `TeamScorePanel`
```ts
interface TeamScorePanelProps {
  side: 'home' | 'away';
  teamAbbreviation: string;      // "CS"
  teamName: string;
  score: number;
  seedLabel?: string;            // "SEED #1"
  possession?: boolean;          // shows a small possession indicator/arrow
  teamFouls: { current: number; max: number };
  timeouts: { remaining: number; total: number };
}
```
`away` side mirrors the layout (score/name alignment flipped) rather than being a separately built component.

### `GameClockPanel`
```ts
interface GameClockPanelProps {
  quarterLabel: string;          // "4TH QUARTER"
  gameClock: string;             // "01:36"
  shotClock: string;             // "08"
  simSpeed: 1 | 1.5 | 2;
  onSimSpeedChange: (speed: 1 | 1.5 | 2) => void;
  isPaused: boolean;
  onTogglePause: () => void;
}
```
Sim speed uses the same `SegmentedControl` from `spec-00-design-system.md` (options `1.0X` / `1.5X` / `2.0X`), wired directly to `useGameFrames`'s `speed`/`setSpeed` from this series' Spec 00 (court engine). Pause uses `Button` (`variant="outline"`), wired to `pause`/`resume`.

i18n keys: `match_broadcast.scoreboard.fouls_label`, `match_broadcast.scoreboard.timeouts_label`, `match_broadcast.clock.pause`, `match_broadcast.clock.resume`.

---

## 4. `CourtStage`

Wraps the pieces from this series' Spec 00: renders `Court`, then one `Player` per entry in `frame.players`, then `Ball` at `frame.ball`'s position, using `useGameFrames()`'s current `frame` and `transitionDurationMs`.

```ts
// no props — this component owns the useGameFrames() call directly,
// since it's the only consumer of the animation state.
function CourtStage(): JSX.Element;
```
If `frame` is `null` (not yet arrived), render the empty `Court` with no players — don't block rendering the whole page on the first frame.

---

## 5. `PlayCallStrip`

Thin bar directly under the court.
```ts
interface PlayCallStripProps {
  playCall: string;              // "HORNS CORNER SNAP"
  shotProbability: number;       // 0-100
  defensiveScheme: string;       // "2-3 DROP ZONE"
}
```
For this pass, values are static/mock — not derived from real frame data. Left-aligned play call + probability, right-aligned defensive scheme, matching the reference layout.

i18n keys: `match_broadcast.play_call.label`, `match_broadcast.play_call.probability_label`, `match_broadcast.play_call.defense_label`.

---

## 6. `TimelineScrubber`

Visual-only for this pass — reflects live playback progress through the current quarter, does not support seeking (no historical frames to seek to yet).
```ts
interface TimelineScrubberProps {
  quarterLabel: string;      // "Q4 TIMELINE"
  elapsedLabel: string;      // "10:18"
  remainingLabel: string;    // "00:00"
  progress: number;          // 0-1
}
```
Play/skip icon buttons from the reference image render as disabled for this pass (no seek target to jump to) — don't fake functionality that doesn't do anything yet.

---

## 7. `BroadcastPanelsRow`

Two `Card`s side by side.

### `PlayByPlayLog`
```ts
interface PlayByPlayLogEntry {
  id: string;
  gameClock: string;         // "[01:42 Q4]"
  type: string;               // "3-POINT ATTEMPT", "REBOUND", "PERSONAL FOUL", "STEAL", "2-POINT MADE"
  description: string;
}

interface PlayByPlayLogProps {
  entries: PlayByPlayLogEntry[];   // most recent first, capped (e.g. last 5)
}
```
For this pass, generate mock entries alongside mock frames (e.g. the mock engine emits an occasional log-worthy event, similar to how possession changes are occasional) rather than hardcoding a static list — this keeps the log feeling live without needing a real event pipeline yet. `type` drives a small colored tag (reuse `StatusBadge` or a simpler inline tag styled per type — foul red, made-shot green/amber, etc.)

i18n keys: `match_broadcast.play_by_play.title`, `match_broadcast.play_by_play.showing_last`, `match_broadcast.play_by_play.full_log_link`.

### `CommentaryPanel`
```ts
interface CommentaryPanelProps {
  commentaryText: string;
  voiceLabel?: string;       // "VOICE SYNTH: CHUCK "CLUTCH" HARLAN"
}
```
Static/mock text for this pass, optionally rotating every N seconds via a simple `setInterval` cycling through a small mock array — no real commentary generation yet.

i18n keys: `match_broadcast.commentary.title`, `match_broadcast.commentary.voice_label`, `match_broadcast.commentary.synth_active`.

---

## 8. `MomentumShiftEngine`

```ts
interface MomentumShiftEngineProps {
  runLabel: string;              // "2-MINUTE CLUTCH RUN"
  runDelta: string;              // "+6 CHICAGO RUN"
  homePoints: number;
  awayPoints: number;
  stats: { label: string; value: string }[];   // FG%, Paint Pts, Fast Break Pts
}
```
A progress-bar-style visual for the run (home vs away points as a filled bar), plus the stat row below. Static/mock numbers for this pass.

i18n keys: `match_broadcast.momentum.title`.

---

## 9. Mock data wiring for this page

Since there's no API, `MatchBroadcast.tsx` owns a small set of mock/static values for everything this series' Spec 00 doesn't already drive (team names, scores, fouls, timeouts, play call text, commentary lines, momentum stats). Keep these as a single `mockMatchData` object local to the page (or a `mock/matchData.ts` file next to the page) — don't scatter hardcoded strings across each component; components take props like any other, mock or real.

---

## 10. Non-goals for this spec
- Real backend/session/match data — everything here is mock, wired for a future swap, not built to actually fetch anything yet.
- Replay/Box score mode — the toggle exists in the UI but is inert.
- Timeline seeking, clip playback ("CLIP PLAY" button is decorative/disabled for this pass).
- Responsive/mobile layout beyond basic stacking — this page is broadcast/desktop-first for now.