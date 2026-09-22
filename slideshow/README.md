# Slideshows — Robô Cestinha

Two zero-build presentation decks for MC 857, styled with the Robô Cestinha
visual identity (colors/shapes from `frontend/src/styles/tokens.css` and the
app components).

| Deck | Path | What it covers | Tech |
|---|---|---|---|
| **Data Ingestion** | `slideshow/index.html` | The original ~5 min deck: how the simulator gets real NBA data (`docs/presentation_data_ingestion.md`) | Hand-rolled HTML/CSS/JS |
| **Full-Repo Walkthrough** | `slideshow/full-repo/index.html` | The whole codebase in ~20 min: general overview → frontend (overview + details) → backend (incl. data processing) → final considerations | **Reveal.js 6** (vendored) |

---

## Full-Repo deck (`full-repo/`)

29 slides: 25 timed core slides + 4 backup (Q&A) slides. Timed to ≈ 19:00 of
talk plus transitions — per-slide budgets are `data-budget` attributes on each
`<section>` and shown in the timer chip.

### Run

```bash
open slideshow/full-repo/index.html        # or serve the folder
cd slideshow/full-repo && python3 -m http.server 4173
# → http://localhost:4173
```

All of Reveal.js is vendored under `full-repo/vendor/` — no internet needed.

### Controls

| Key | Action |
|---|---|
| `←` `→` / `Space` / `PgUp` `PgDn` | navigate |
| `O` / `Esc` | overview grid (click a slide to jump) |
| `F` | fullscreen |
| `N` | speaker-notes drawer (talk track + word-count estimate) |
| `T` | pacing timer — slide elapsed vs budget, red when over, plus a total clock |
| `S` | Reveal's speaker view (separate window) |
| `#/13` | deep-link straight to a slide (hash = 1-based index) |
| `?` | Reveal's built-in help overlay |

The bottom bar shows the current part (`PART I · GENERAL OVERVIEW` … `BACKUP · Q&A`)
and the counter. The chrome (top/bottom bars) + hint auto-hide after 6 s idle.

### Editing

- **Slides** — one `<section>` per slide in `index.html`. `data-part` (I–IV/A)
  controls the section label + kicker accent color; `data-budget="0:45"`
  drives the timer.
- **Speaker notes** — `<aside class="notes">…</aside>` inside each section
  (~135 words/min ≈ 1 min of talk).
- **Code blocks** — `<pre><code class="language-python">` gets syntax
  highlighting; terminal/formula blocks use `class="language-nohighlight"`
  to keep their custom `.ps1`/`.cm`/`.err-line`/`.ok-line` spans.
- **Fit check** — the deck targets 1280×720 (Reveal scales to any window,
  no scrolling). Safe content height ≈ 660 px at 16:9. On load the deck
  `console.warn`s for any slide that exceeds the safe height — open the
  dev console (`?` → paste in console) to see them.

Main files: `index.html` (slides), `theme.css` (identity + components),
`app.js` (chrome, timer, notes, Reveal config).

---

## Data-Ingestion deck (`index.html` at this folder root)

The interactive companion to `docs/presentation_data_ingestion.md`: 9 timed
core slides + 4 backup slides. See the "Controls" section in the old README
history / the comments in `app.js` (`N` notes, `T` timer, `G` grid, `F`
fullscreen, `#/N` deep links, swipe support).