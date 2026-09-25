# Ingestion Slides — Explained

**Deck:** `slideshow/full-repo/` (project architecture deck, MC 857)
**Ingestion section:** slide **14** + sub-slides **14a–14d** (deck footers label them *10 · Ingestão* → *14 · Ingestão*), plus appendix **A.1** (shrinkage). Files: `slides/14-ingestion.html`, `14a-fetch.html`, `14b-positions.html`, `14c-derive.html`, `14d-contract.html`, `a1-shrinkage.html`.
**Companion references:** [`data_ingestion_deep_dive.md`](data_ingestion_deep_dive.md) (full code study guide), [`statistics.md`](statistics.md) (formulas), [`data_ingestion.md`](data_ingestion.md) (failure modes) — this document explains *what each slide says and means*, nothing more.

The slides build one narrative arc in five steps:

```
14  overview:  what ingestion is and its headline numbers
 └─ 14a fetch:      how raw data is collected (network → disk)
 └─ 14b positions:  the one manual source and why
 └─ 14c derive:     how raw numbers become the 12 attributes
 └─ 14d contract:   how the output is protected and reported
     ├─ A.1:        shrinkage worked example (supports 14c)
```

---

## Slide 14 — «Ingestão de dados» (big picture)

**What's on screen:** a two-stage pipeline diagram — *Stage 1 "Coletar e armazenar dados brutos (com rede)"* pulls from **NBA Stats** into a raw cache (`data/raw/`) and from **Basketball-Reference** via a manual step (positions); *Stage 2 "Derivar e validar"* is an offline reprocess (master table → attributes → schemas) producing `players.json`, `teams.json`, and a quality report. Headline stats: **582 players · 30 teams · 12 attributes per player · 0–1 scale**.

**What it really means:**

- The pipeline is deliberately split so that **only Stage 1 touches the network**. Once the raw data is on disk, everything else ("reprocessamento offline") is a local computation. That's why Stage 1 to Stage 2 is labeled "reprocessamento offline" — re-deriving the catalog never costs another API call.
- The speaker note says the numbers come from the **versioned processed dataset in the repo**, not a live update. This is an important honesty point: the catalog is a season snapshot prepared once, not a real-time feed.
- **Basketball-Reference appears in Stage 1 but as "etapa manual"** — a deliberately different lane from NBA Stats, because it's the only source that can't be fetched by script (slide 14b explains why).

**Numbers to quote:** 582 / 30 / 12 / 0–1.

---

## Slide 14a — «Coleta de dados brutos» (raw fetching)

**What's on screen:** two cards. Left = *request discipline*: **39 calls** (all players · 30 rosters · per-player totals base+advanced · clutch · starters × bench · team totals), **0.7 s** between calls, up to **4 attempts** with exponential backoff and **30 s** timeout, responses saved **verbatim as CSV**; callout "tolerante a falhas — um elenco que falha não derruba os outros 29". Right = *sources & paths*: 39 calls → `data/raw/2025_26/`, rosters as `rosters/{ABV}.csv`, Baseball-Reference saved separately; reprocessing never touches the network; `--no-fetch` fails fast listing what's missing; `--refresh` discards the cache and re-collects. Bottom callout: **"Reprodutibilidade: a rede é paga uma vez por temporada"** — all derivation runs offline on the cache.

**What it really means:**

- **"39 calls"** is the mixed total: **38 throttled NBA API calls** (1 all-players list + 30 team rosters + 2 player-stat measure types (base/advanced) + 1 clutch split + 2 starter/bench splits + 2 team-stat measure types) **+ 1 best-effort GET to Basketball-Reference** that usually fails (403, Cloudflare) — a detail the speaker notes clarify.
- The **0.7 s / 4 retries / 30 s timeout** policy exists because stats.nba.com will throttle or ban aggressive clients; exponential backoff (2 s, 4 s, 8 s…) absorbs transient 429/504s. Sleeping *before* each request keeps the cadence even across retries.
- **"Respostas salvas sem transformação — CSV puro"** is the key reproducibility idea: the raw files are the archive. If the derivation formulas change, you re-derive from the same CSVs; if a CSV is lost, only that file must be re-fetched.
- **Tolerância a falhas**: `fetch_team_rosters` catches per-team failures, reports them, and continues — one failed roster doesn't abort the other 29.
- **The two flags** are the operational contract: `--no-fetch` = offline-only derive (fails fast, listing exactly which files are missing), `--refresh` = throw away the cache and re-collect. They are mutually exclusive.

**Number to quote:** ~39 total requests, of which 38 are throttled NBA API calls; ≈0.7 s pacing.

---

## Slide 14b — «Posições clássicas» (classic positions)

**What's on screen:** a flow `G · F · C ← a API não publica as 5 posições → PG · SG · SF · PF · C`, and a card explaining that the Basketball-Reference page is behind **Cloudflare** (script can't fetch it), so you **save it once in a browser** as `bballref_nba_2026_totals.html`, parse it with the **standard-library `HTMLParser`**, and cache the result to `bballref_positions.json` for offline derivation. Playcall: compound cells like `SF-PF` → primary position `SF`. Callout: **`--refresh` re-parses the saved page and rebuilds the cache — it never tries to download again.**

**What it really means:**

- **Why two position fields exist:** the official NBA API only classifies players as Guard / Forward / Center (plus combos like `G-F`, `F-C`). The simulator's lineup logic wants the classic five — PG, SG, SF, PF, C — which only Basketball-Reference publishes per player.
- **Why the manual step:** the page sits behind a Cloudflare challenge, so a scripted download returns HTTP 403. The workaround is a one-time human action (Ctrl+S in a browser). The slide is explicit that this is the *only* manual step in the whole pipeline.
- **Why stdlib `HTMLParser`:** no third-party scraping dependency (no lxml/bs4) — the parser scans the first table, finds the `Player` + `Pos` header columns, and extracts rows.
- **The join problem** (in speaker notes): NBA and Basketball-Reference spell names differently, so matching is by **normalized name** — parenthetical suffixes (`(TW)`) stripped, generational suffixes (`Jr`, `III`) dropped, initials (`A.J.`) and accents collapsed — plus **3 manual aliases** for nickname variants. The quality report confirms **0 of 582 players** end up without a classic position.
- **Refresh semantics nuance:** `--refresh` here means "re-parse the locally saved HTML and rebuild the JSON cache", *not* "re-download" — the only time a download is attempted is when no local copy exists at all.

**Number to quote:** 582/582 players matched (0 missing).

---

## Slide 14c — «Derivação: tabela mestra → atributos» (derivation)

**What's on screen:** a two-column layout. Left = the **master table** (one row per player) built from 7 raw sets: season totals (deduped by id, max minutes), identity (name/slug/team), position & height (from rosters), classic position (Basketball-Reference), starter × bench minutes, clutch split (last 5 min · margin ≤ 5), advanced stats (USG% · OREB% · official rates). Playcall: **"sem minutos = fora da pipeline"** · canonical team = the club he played for. Right = the **12 attributes in 6 groups**, each group with its one-line formula. Bottom callout: `config.py` holds all parameters — tweak a formula and run `--no-fetch` to compare.

**What it really means (per group):**

1. **Arremesso (2PT · 3PT · FT) com shrinkage** — the formula shown is `(acertos + 10 × média) ÷ (tentativas + 10)`: every player gets 10 pseudo-attempts at the league average, so a 6/6 small sample doesn't look like a 100% shooter, while a 600-attempt star keeps almost exactly his real rate. (Worked example in appendix A.1.)
2. **Controle e defesa (turnover · steal · block · foul)** — these are expressed **per defended possession**, estimated as `FGA + 0.44·FTA + TOV` (the 0.44 is the standard NBA free-throw possession constant). The slide's demarche: a rate is only meaningful if divided by the events the player actually defended — scaled by his share of the game (minutes/48), so bench players aren't over-penalized or inflated.
3. **Rebote e criação (rebound · assist)** — the rebound rate is taken from the **official `OREB%`** column rather than hand-derived (the league's own opportunity denominator is more correct); assists are derived as *assists per teammate made basket*.
4. **Fôlego (stamina)** — a model: grows with minutes per game, with an **age penalty after 34** (0.5% per year above 34).
5. **Clutch** — compares a player's shooting in the last 5 minutes of close games vs his **season average**, weighted by sample size (a 3-attempt "clutch" can't swing him from 0 to 1).
6. **Uso (usage)** — the league's own **USG%**, normalized (clipped to 0–1).

**What it really means (master table):**

- **Dedupe by max minutes** matters because traded players appear once per team in the stats endpoint — keeping the row with the most minutes keeps one row per player for the season.
- **"Sem minutos = fora da pipeline"**: players who never logged a minute (injured/two-way) get no attributes and never appear in the catalog.
- **"Time canônico = clube em que atuou"**: the team attached to a player is the club he *played* for (from the stats table), not his current roster — this is what keeps rosters consistent for waived/traded players (see −5/+57 on slide 14d).
- **Why `config.py` deserves the callout:** all formula knobs (shrinkage K, stamina constants, clutch spread, etc.) live in one file, so experimenting is "edit one constant → `--no-fetch` → diff `players.json`" — no network, no code archaeology.

**Formula to quote:** shrinkage `(made + 10 × league_rate) ÷ (attempts + 10)`; defensive denominator `FGA + 0.44·FTA + TOV`.

---

## Slide 14d — «Contrato de saída e relatório de qualidade» (contract & quality)

**What's on screen:** three panels. (1) The **gate**: `validate_processed_output()` runs **before writing any file**; it checks out-of-range values (e.g. `two_pt_pct = 1.42`), duplicate ids, missing teams, rosters pointing at missing players — and on failure lists **all** problems at once, exits with code 1, and **preserves the last valid dataset**. Playcall: "melhor interromper do que gravar dados inválidos". (2) **Two policies** that make referential integrity hold *by construction*: **−5** zero-minute players excluded from every roster; **+57** waived players stay with the team they played for. (3) **`data_quality.json`**: 582 players, **216 starters**, **76 small samples**, **0 missing positions**, plus per-attribute min/mean/max distributions and coverage alerts. Bottom: the **three run commands** (`python -m app.data_ingestion`, `--no-fetch`, `--refresh`).

**What it really means:**

- **Why the gate is "before the write":** a batch derivation can easily produce thousands of bad rows at once (one broken join). Validating *in memory* first means a bad run fails loudly and the **last known-good `players.json`/`teams.json` stay untouched** — a broken pipeline is preferable to silently corrupting the catalog every consumer reads.
- **The four failure classes** on screen map directly to the Pydantic contract: range violations (all attributes must be 0–1), unique ids, referential integrity team-side, and referential integrity roster-side.
- **The −5 / +57 policies are the slide's punchline** because they're *why* the file pair agrees by construction: roster entries in `teams.json` are built *from* `players.json`, so every roster entry is a real player and every player belongs to exactly one roster. The two numbers (5 zero-minute players dropped, 57 waived players kept with their season team) reconcile the difference between "current roster" and "played this season".
- **`data_quality.json` is the human-checkable contract at a glance**: counts of players/teams, starters vs bench, small-sample flags (players under 10 GP whose rates are shrinkage-heavy), position coverage, and per-attribute min/mean/max as a quick range sanity sweep.
- **The three commands** are the whole operational surface: collect+derive, derive offline from cache, or force a fresh collection. The speaker notes add the constraint: `--refresh` and `--no-fetch` are mutually exclusive.

**Numbers to quote:** 582 players · 216 starters · 76 small samples · 0 missing positions · −5 zero-minute · +57 waived.

---

## Appendix A.1 — «Como a amostra afeta o aproveitamento» (shrinkage example)

**What's on screen:** the formula `(acertos + k × média da liga) ÷ (tentativas + k)` and the worked example: **6/6 with k=10 and league 2PT rate 0.55 → 0.72**, i.e. `(6 + 10 × 0.55) ÷ (6 + 10) = 11.5/16 ≈ 0.72`.

**What it really means:** this is the appendix that backs slide 14c's shrinkage claim with a concrete number. It shows *why* shrinkage exists: 6 attempts tell you almost nothing, so the player is pulled hard toward the league mean (0.72, not 1.00); a star with 600 attempts would remain ≈ his observed rate because 10 pseudo-attempts become negligible. The k=10 lives in `config.py` as `SHRINKAGE_K`.

**Number to quote:** `(6 + 10×0.55)/(6+10) ≈ 0.72` instead of 1.00.

---

## How this section connects to the rest of the deck

- **Slide 03 (system)** places ingestion as an **offline catalog preparation** box that feeds the database (via seed) — explicitly *not* part of the per-match runtime.
- **Slide 04 (flows)** confirms the catalog path is implemented up to the JSON files, with two current consumers: **DB seed** and the **engine's standalone demo**.
- **Slide 08 (model)** shows where the catalog lands in PostgreSQL: `TEAM` and `PLAYER` rows, with `PLAYER.attributes` stored as a **JSON blob** — so the file schema and the database agree without a migration.
- **Slides 10–12 (engine/heuristics)** consume exactly the 0–1 attributes slide 14 produces: `two_pt_pct`/`three_pt_pct` become shot-conversion probabilities, `usage_rate` drives who handles the ball, `steal_rate`/`turnover_rate` drive turnovers, `stamina` decays each possession, `clutch_factor` boosts close-game shots. The **0–1 scale is the contract bridge**: the data scale *is* the engine's probability scale.

---

## Slide → code → docs map (for questions)

| Slide | Code | Detail doc |
|---|---|---|
| 14 overview | `data_ingestion/__init__.py`, `config.py` (paths/season) | `data_ingestion_deep_dive.md` §0–§3 |
| 14a fetch | `fetch.py` (`_call`, `fetch_all`, `load_raw_from_disk`) | deep dive §4 |
| 14b positions | `bballref.py` (`_TableScanner`, `parse_positions`, `normalize_name`) | deep dive §7 |
| 14c derive | `derive.py` (`_build_master`, `_derive_attributes`) | deep dive §6; formulas in `statistics.md` §2–§6 |
| 14d contract | `schemas.py`, CLI in `__main__.py` | deep dive §8–§9, §11 |
| A.1 shrinkage | `config.SHRINKAGE_K` + the `np.where(...)` shooting formulas | `statistics.md` §1 (shrinkage) |

**One-line takeaway for the presentation:** *the ingestion section is the story of turning messy, two-source, season-long NBA data into two validated JSON files whose 0–1 attributes are, literally, the probabilities the simulator rolls against — with every step cached offline and a validation gate between "derived" and "written".*