# Player Statistics — How Each Attribute Is Computed

**Applies to:** `data/processed/players.json` (and `attributes_table.csv`)
**Data scope:** NBA **2025-26 regular season** (all 582 players with ≥1 minute played). Playoffs are **not** included — the goal is to capture each player's skill as a whole, and regular-season rates over 60–82 games are the most stable measure.

Every attribute is a **0–1 value** (or a rate) and is documented below with its formula, the raw inputs, a worked example (LeBron James), and the assumptions behind it.

---

## 1. Where the numbers come from

All raw data comes from `stats.nba.com` via the `nba-api` package, saved verbatim under `data/raw/2025_26/`:

| Raw file | Endpoint | What it provides |
|---|---|---|
| `all_players.csv` | `CommonAllPlayers` | Every current NBA player: id, name, slug, team |
| `rosters/{ABV}.csv` | `CommonTeamRoster` (×30) | Official **position** (G/F/C), **height**, age, jersey |
| `player_stats_base_totals.csv` | `LeagueDashPlayerStats (Base)` | All season **totals**: made/attempted shots, rebounds, assists, turnovers, steals, blocks, fouls, minutes, games — plus the league's own **`FG_PCT` / `FG3_PCT` / `FT_PCT`** columns |
| `player_stats_advanced_totals.csv` | `LeagueDashPlayerStats (Advanced)` | `USG_PCT` (usage rate), **`OREB_PCT`** (offensive rebound %), `EFG_PCT`, `TS_PCT`, pace, off/def ratings |
| `player_clutch_totals.csv` | `LeagueDashPlayerClutch` | Stats **in clutch situations** (last 5 min of close games) |
| `player_stats_starters/bench_totals.csv` | `LeagueDashPlayerStats` with `starter_bench` split | Starter vs bench minutes per player |
| `team_stats_*_totals.csv` | `LeagueDashTeamStats` | Team totals → denominators, pace, off/def ratings |

**Which attribute comes from where** (priority rule: use the league's own computed value whenever one exists):

| Attribute | Source |
|---|---|
| `two_pt_pct` | **Derived** — no league 2-pt-only column exists (`FG_PCT` counts every 3-pt attempt), so 2pt = `FGM−FG3M` ÷ `FGA−FG3A`, then shrunk |
| `three_pt_pct` | League column `FG3_PCT`, shrunk |
| `ft_pct` | League column `FT_PCT`, shrunk |
| `turnover_rate` | **Derived** — the endpoint offers no per-player turnovers-per-possession rate (`TM_TOV_PCT` is *team*-level; player `POSS` is court-time possessions, not ball-handling ones) |
| `usage_rate` | League column `USG_PCT` (as-is) |
| `foul_rate` / `steal_rate` / `block_rate` | **Derived** — no league per-defensive-possession rate exists |
| `rebound_rate` | League column `OREB_PCT` (as-is) |
| `assist_rate` | **Derived** — see §5 (the endpoint's `AST_RATIO` has an opaque definition/scale, LeBron = 26.0, and is not a 0–1 rate) |
| `stamina` | Derived (minutes + age model, §6) |
| `clutch_factor` | Derived from `LeagueDashPlayerClutch` vs season FG% (§6) |

**League context** (computed once, used by several formulas; the 2025-26 game runs hotter than recent seasons — ~89 FG attempts per team per game vs ~45 historically — so these numbers come straight from the endpoint tables, and the player-side and team-side tables agree):

| Quantity | Value (2025-26) | Meaning |
|---|---|---|
| `team_poss_pg` | 113.2 | one team's ball possessions per game = Σ(FGA + 0.44·FTA + TOV) ÷ 2,460 team-games |
| league FGA / team-game | 89.1 | field-goal attempts per team per game (both endpoint tables) |
| league FTA / team-game | 23.5 | free-throw attempts per team per game |
| league TOV / team-game | ≈14 | turnovers per team per game |
| league 2pt% | 0.550 | league-made 2-pointers ÷ league 2-point attempts |
| league 3pt% | 0.360 | league-made 3-pointers ÷ league 3-point attempts |
| league ft% | 0.783 | league free-throws made ÷ free-throws attempted |

The `0.44·FTA` factor is the standard NBA "possessions estimator": not every free throw comes from a new possession, so only ~44% of free-throw **attempts** count as fresh possessions.

**Shrinkage (used by all three shooting stats).** A player with 3 attempts who made 3 has a raw 100% — obviously noise. We shrink every rate toward the league average with 10 pseudo-attempts:

```
shrunken = (made + 10 × league_rate) ÷ (attempted + 10)
```

so a 3-attempt player lands near the league mean, and a 600-attempt star keeps almost exactly his real number.

---

## 2. Shooting

### `two_pt_pct` — 2-point field-goal percentage
- **In the sim:** probability of making a 2-pt shot attempt.
- **Source columns:** `FGM/FGA` (total FG) minus `FG3M/FG3A` (3-pt) → the 2-point portion.
- **Formula:** `2PM = FGM − FG3M`, `2PA = FGA − FG3A`; then `(2PM + 10·0.550) ÷ (2PA + 10)`.
- **Worked example (LeBron):** 2PM = 473−77 = 396, 2PA = 919−243 = 676 → `(396 + 5.5) ÷ 686 = 0.5853`.
- **Caveat:** shooting percentages swing with role/shot quality; shrinkage prevents small samples from producing extremes (e.g., a 1/1 player gets ≈ league average, not 1.0).

### `three_pt_pct` — 3-point field-goal percentage
- **In the sim:** probability of making a 3-pt shot attempt.
- **Source columns:** `FG3_PCT` (the league's own 3-pt percentage) with `FG3A` as the shrinkage weight.
- **Formula:** `(FG3_PCT × FG3A + 10·0.360) ÷ (FG3A + 10)` (= `(FG3M + 10·0.360) ÷ (FG3A + 10)`).
- **Worked example (LeBron):** `(0.3169 × 243 + 3.60) ÷ 253 = 0.3186`.
- **Caveat:** identical to `FG3M/FG3A`; reading the league column just removes our re-computation.

### `ft_pct` — free-throw percentage
- **In the sim:** probability of making a free throw.
- **Source columns:** `FT_PCT` (league column) with `FTA` as the shrinkage weight.
- **Formula:** `(FT_PCT × FTA + 10·0.783) ÷ (FTA + 10)` (= `(FTM + 10·0.783) ÷ (FTA + 10)`).
- **Worked example (LeBron):** `(0.7373 × 316 + 7.83) ÷ 326 = 0.7387`.

---

## 3. Possession handling

### `turnover_rate` — turnovers per used possession
- **In the sim:** probability the possession ends in a turnover (bad pass, travel, offensive foul).
- **Source columns:** `TOV` (turnovers), plus the player's own possessions.
- **Formula:** `TOV ÷ (FGA + 0.44·FTA + TOV)` — the share of this player's possessions he turns over.
- **Worked example (LeBron):** `179 ÷ 1237.0 = 0.1447`.
- **Caveat:** a "turnover" in league stats is a loose category; we use it as-is since the sim just needs a per-possession failure rate.

### `usage_rate` — fraction of team possessions used
- **In the sim:** how much of the offense runs through this player (drives possession selection when the team has the ball).
- **Source columns:** `USG_PCT` from the *Advanced* endpoint (already a 0–1 number).
- **Formula:** used as-is.
- **Worked example (LeBron):** 0.262.

---

## 4. Defense (per defended possession)

**Key idea:** while a player is on the court he defends essentially the whole flow of the opponent's play, so his defensive event rates use the opponent's possession rate scaled by his **share of the game**.

```
min_frac   = minutes_per_game ÷ 48   (regulation minutes; LeBron 33.15/48 = 0.69)
def_poss_pg = team_poss_pg × min_frac  (≈113 × 0.69 = 78.2 for LeBron)
```

Per-season counts are converted to per-game first, then divided by `def_poss_pg`.

### `foul_rate` — fouls committed per defended possession
- **Source columns:** `PF` (personal fouls).
- **Formula:** `(PF ÷ GP) ÷ def_poss_pg`.
- **Worked example (LeBron):** `(81 ÷ 60) ÷ 78.2 = 0.0173` — one of the lowest in the league: he commits a foul roughly once every 58 defensive possessions.
- **Caveat:** `PF` includes offensive fouls too; over a season the mix is stable enough.

### `steal_rate` — steals per defended possession
- **Source columns:** `STL`.
- **Formula:** `(STL ÷ GP) ÷ def_poss_pg`.
- **Worked example (LeBron):** `(72 ÷ 60) ÷ 78.2 = 0.0153`.

### `block_rate` — blocks per defended possession
- **Source columns:** `BLK`.
- **Formula:** `(BLK ÷ GP) ÷ def_poss_pg`.
- **Worked example (LeBron):** `(35 ÷ 60) ÷ 78.2 = 0.0075`.
- **Caveat:** league block counts are noisy (scorer discretion); treat as approximate and tune the scale in the state machine if the sim over- or under-produces blocks.

---

## 5. Rebounding & playmaking

### `rebound_rate` — offensive rebounds per available rebound
- **In the sim:** probability of grabbing the board when his team misses a shot.
- **Source:** **`OREB_PCT`** — the league's own offensive-rebound percentage from the *Advanced* endpoint (offensive rebounds ÷ the team's available rebound opportunities). Used as-is, 0–1.
- **Worked example (LeBron):** `OREB_PCT = 0.023`.
- **Why the endpoint instead of a hand formula:** our original formula (`OREB ÷ (team misses × player minutes share)`) was a guess at the league's denominator; the league already computes this exact concept, chances are their opportunity count is the more correct one (ours differed slightly: 0.0216 vs their 0.023). One consequence: no more minutes-scaling — the league's own rate already reflects how often the player is on the court to grab the board.
- **Caveat:** only *offensive* rebounds are attributed to the player; defensive rebounds (`DREB`) stay a team-level stat, so this is intentionally an offensive-only rate.

### `assist_rate` — assists per teammate-made basket
- **In the sim:** when a teammate scores, how likely this player set it up (drives pass-happy vs. ISO offenses).
- **Source columns:** `AST`, team made-baskets, own made-baskets.
- **Formula:**
  ```
  teammate_makes_pg = team FGM ÷ GP − own FGM ÷ GP   (FGM already includes 3-pointers!)
  assist_rate       = (AST ÷ GP) ÷ teammate_makes_pg
  ```
- **Worked example (LeBron):** LAL makes 42.05 FG/game, LeBron 7.88/game → teammates ≈ 34.2/game; `(432 ÷ 60) ÷ 34.2 = 0.2107` — roughly one assist per 5 teammate baskets.
- **Careful:** `FGM` **includes** 3-point makes (the league's `FG_PCT` = `FGM/FGA` proves it), so teammate makes = `team FGM − own FGM` only. An earlier draft wrongly added `FG3M` again, inflating the denominator ~15% and understating playmakers' rates (LeBron 0.161 → 0.211 after the fix).
- **Why not the endpoint's `AST_RATIO`:** it is the league's own playmaking metric, but its definition is undocumented and its scale isn't 0–1 (LeBron = 26.0), and several candidate formulas failed to reproduce it. The transparent formula above is matched to the sim's needs.

---

## 6. Effort & intangibles

### `stamina` — endurance (0–1, decays during a game)
- **In the sim:** starting energy; decays each possession and gates how long a player can stay effective before substitution.
- **Source columns:** minutes per game, age.
- **Formula:**
  ```
  0.55 + 0.45 × min(min_pg ÷ 38, 1) − age_penalty
  age_penalty = 0.05 × max(0, (age − 34) ÷ 10)   (capped so it can't go negative)
  ```
- **Worked example (LeBron, 41 y/o, 33.15 min/pg):** `0.55 + 0.3926 − 0.035 = 0.9076`.
- **Rationale:** players who log starter-level minutes have shown they can carry a long workload (the 0.45 bonus saturates at 38 min/game); older players get a small durability penalty. All values clamp to [0,1].

### `clutch_factor` — performance boost in close, late-game situations
- **In the sim:** multiplies shooting probability when the game is close in the final minutes.
- **Source columns:** `LeagueDashPlayerClutch` (stats when the game is within 5 points in the last 5 minutes) vs the player's overall season shooting.
- **Formula:**
  ```
  clutch_fg%   = clutch made ÷ clutch attempts        (NaN if no clutch minutes)
  overall_fg%  = total made ÷ total attempts
  delta        = clutch_fg% − overall_fg%             (0 if no clutch data)
  weight       = min(clutch attempts ÷ 50, 1)         (small samples are ignored)
  clutch_factor = clamp(0.5 + 2.0 × delta × weight, 0, 1)
  ```
- **Worked example (LeBron):** 0.5806 — he shoots slightly *better* than his season average in clutch spots.
- **Caveat:** a player with zero clutch minutes gets the neutral 0.5; the weight ensures a 3-attempt "clutch" can't manufacture a 0.99. 413 of 582 players have real clutch minutes.

---

## 7. Positions

The NBA's official roster data (`CommonTeamRoster`) only labels players **G / F / C** (guard, forward, center) — sometimes as combos like `G-F`, `F-C`. The classic **5-position taxonomy (PG, SG, SF, PF, C)** used by the sim is **not** in the official data, so it comes from Basketball-Reference, which lists the classic position for **all** players:

| Field | Contents | Source |
|---|---|---|
| `position` | Official NBA label (e.g. `G`, `F`, `G-F`, `F-C`, `X` if unrostered) | Roster (stats.nba.com) |
| `position5` | Classic taxonomy: **PG / SG / SF / PF / C** | **Basketball-Reference** (single source, every player) |

### 7.1 Basketball-Reference (the source for `position5`)

Basketball-Reference's league totals page lists **every** player with the classic positions in its `Pos` column (`PG`, `SG`, `SF`, `PF`, `C`). It is the **required** source for `position5` — the pipeline fails with instructions if the page isn't available. **The page sits behind a Cloudflare challenge and cannot be fetched by scripts**, so it must be saved locally once:

1. Open <https://www.basketball-reference.com/leagues/NBA_2026_totals.html> in a browser.
2. Save the page (**Ctrl+S / ⌘S → "Webpage, HTML Only"**) as:
   `data/raw/2025_26/bballref_nba_2026_totals.html`
3. Re-run the pipeline:
   ```bash
   .venv/bin/python -m src.data_ingestion --no-fetch
   ```

The parser (`src/data_ingestion/bballref.py`, stdlib-only) reads the `Player`/`Pos` columns and joins to our 582 players by normalized name (diacritics stripped, parenthetical suffixes like `(TW)` and generational suffixes like `III`/`Jr.` ignored, initial periods collapsed so `A.J.` = `AJ`). A tiny explicit alias map covers the remaining nickname/extras variants (`Trevon Scott`→`Tre Scott`, `Ronald Holland II`→`Ron Holland`, `Adama Bal`→`Adama Alpha Bal`). The parse result is cached to `data/raw/2025_26/bballref_positions.json` so offline re-derives never need the HTML again. **All 582 players currently match (0 missing).**

## 8. Starters vs bench

`is_starter` is a boolean in `players.json`. It's **not** in the official roster data, but stats.nba.com splits every player's minutes into starter vs bench games, so:

```
is_starter = starter minutes ≥ bench minutes
```

- LeBron: 1,989 starter / 0 bench → starter ✓
- Stephen Curry: 1,278 / 51 → starter ✓
- A 10-man rotation player with 800 starter + 900 bench minutes → bench.

2025-26 result: **216 starters, 366 bench players**. This gives the simulator a realistic starting five (or rotation) when building matchups for the user's team.

## 9. Assumption summary (things to know before calibrating the engine)

1. **Endpoint-first, hand-formula only where needed.** `three_pt_pct`, `ft_pct`, `rebound_rate`, and `usage_rate` read the league's own computed columns; `two_pt_pct`, `turnover_rate`, the defensive rates, `assist_rate`, `stamina`, `clutch_factor` are derived because no suitable league rate exists (mapping table in §1).
2. **League aggregates are verified against two independent endpoint tables** (player-side and team-side totals agree: FGA 89.1, FTA 23.5, possessions 113.2 per team-game). The 2025-26 game has roughly double the FG attempts of recent seasons — the league-context numbers above are the real ones for this season, not historical defaults.
3. `FGM` **includes** 3-point makes (`FG_PCT == FGM/FGA` — verified). Any formula that starts from `FGM` must **not** add `FG3M` back. This was a real bug in an earlier draft of `assist_rate` and is now corrected & documented.
4. Defense is assumed to be "whole-flow": a defender's on-court minutes gate his possession denominator (`def_poss_pg = 113.2 × min_frac`). This slightly **understates** elite on-ball defenders and **overstates** off-ball helpers; the engine's defensive rating (off/def ratings in `teams.json`) can rebalance it.
5. All rates use **season totals** and standard NBA possession math (`FGA + 0.44·FTA + TOV`), not per-play-by-play possession events — good enough to be 0–1 probabilities; true possession counts would come from play-by-play (Phase D scope).
6. `clutch_factor`, `stamina`, and `position5` cleanly separate from the purely statistical rates — recalibrate those two directly in the simulator without touching the data pipeline (position5 is data-sourced).
7. Raw (un-shrunken) rates live in `attributes_table.csv` (`two_pt_pct_raw`, `three_pt_pct_raw`, `ft_pct_raw`, plus every endpoint column) if you ever want the true percentages for league-average simulations.