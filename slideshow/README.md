# Robô Cestinha Slideshows

Two zero-build presentation decks for MC 857. Both use the same visual system,
navigation, speaker notes, timer, and overview grid. The slides are in
Portuguese; technical names, code identifiers, and selected domain terms remain
in English.

| Deck | Path | Scope |
|---|---|---|
| **Data ingestion** | `slideshow/index.html` | A focused technical presentation of the offline NBA data pipeline. |
| **Project architecture** | `slideshow/full-repo/index.html` | The project overview: system architecture, frontend, backend, patterns, simulation engine, heuristics, and ingestion. |

## Run

Open either HTML file directly, or serve the repository root:

```bash
python3 -m http.server 4173
# http://localhost:4173/slideshow/
# http://localhost:4173/slideshow/full-repo/
```

The architecture deck reuses `slideshow/styles.css` and `slideshow/app.js`.
Its `theme.css` contains only additional diagram layouts. No build step,
Reveal.js package, or network dependency is required.

## Controls

| Key | Action |
|---|---|
| `←` `→` / `Space` / `PgUp` `PgDn` | Navigate |
| `G` | Open the overview grid |
| `N` | Toggle speaker notes |
| `T` | Toggle the pacing timer |
| `F` | Toggle fullscreen |
| `Esc` | Close the current overlay |
| `#/13` | Open a slide directly (1-based index) |

Both decks also support click navigation and touch swipes. The bottom bar shows
the current slide, section, and per-slide budget. The navigation chrome hides
after a period of inactivity.

## Editing

- **Slides:** one `<section class="slide">` per slide. Use `data-title`,
  `data-kicker`, `data-budget`, and `data-group` for navigation and timing.
- **Speaker notes:** place `<aside class="notes"><blockquote>…</blockquote></aside>`
  inside the slide. Notes are shown in the presenter drawer, not on the slide.
- **Shared visual system:** the ingestion deck is the reference. The
  architecture deck loads its shared stylesheet/player and adds only diagram
  layouts in `full-repo/theme.css`.
- **Diagrams:** prefer labeled nodes, flows, and relationships over code
  screenshots. Mark planned connections with dashed lines and explain them in
  speaker notes.
- **Accuracy:** distinguish implemented, partial, and planned behavior. Check
  claims against the source before presenting them as current functionality.
