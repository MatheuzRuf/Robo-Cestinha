"""Basketball-Reference classic position data (PG/SG/SF/PF/C).

stats.nba.com only publishes G/F/C (and combos). Basketball-Reference's league
totals page (https://www.basketball-reference.com/leagues/NBA_2026_totals.html)
lists every player with the classic 5-position taxonomy (e.g. 'PG', 'SG-PF')
and is the single source for the `position5` field in players.json.

The page sits behind a Cloudflare challenge, so it cannot be fetched scripted.
**Save it once from a browser** (File > Save As / Ctrl+S) as
`data/raw/2025_26/bballref_nba_2026_totals.html`, then the pipeline parses it
offline; the parse is cached to bballref_positions.json for offline re-derives.
Players not matched by name get position5 = "X" and are counted in
`position5_missing` in data_quality.json.
"""

import json
import re
from html.parser import HTMLParser
from pathlib import Path

from . import config
from .normalize import ascii_slug

CLASSIC_FIVE = {"PG", "SG", "SF", "PF", "C"}


# ── Parsing (stdlib only, no lxml/bs4 dependency) ───────────────────────────

class _TableScanner(HTMLParser):
    """Collects the cells of every <tr> in the first <table> of the page."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables_seen = 0
        self.active = False
        self.rows: list[list[str]] = []
        self.current_row: list[str] | None = None
        self.current_cell: list[str] | None = None

    def handle_starttag(self, tag, attrs):
        if tag == "table":
            if self.tables_seen == 0:
                self.active = True
                self.rows = []
            self.tables_seen += 1
        elif self.active and tag == "tr":
            self.current_row = []
        elif self.active and tag in ("td", "th"):
            self.current_cell = []

    def handle_data(self, data):
        if self.current_cell is not None:
            self.current_cell.append(data)

    def handle_endtag(self, tag):
        if not self.active:
            return
        if tag in ("td", "th") and self.current_cell is not None:
            text = " ".join("".join(self.current_cell).split())
            if self.current_row is not None:
                self.current_row.append(text)
            self.current_cell = None
        elif tag == "tr" and self.current_row is not None:
            self.rows.append(self.current_row)
            self.current_row = None
        elif tag == "table":
            self.active = False


SUFFIX_RE = re.compile(r"_(jr|sr|ii|iii|iv)$")

# Explicit aliases for the few players whose bball-ref display name differs
# beyond generic normalization (nicknames / extra middle names).
# Key = our normalized name (as in players.json) -> bball-ref normalized name.
NAME_ALIASES = {
    "trevon_scott": "tre_scott",
    "ronald_holland": "ron_holland",
    "adama_bal": "adama_alpha_bal",
}


def normalize_name(name: str) -> str:
    """Normalize a display name for joining with stats.nba.com names.

    Strips parenthetical suffixes bball-ref appends (e.g. 'Jalen Hood-Schifino (TW)')
    and generational suffixes that bball-ref drops but stats.nba.com keeps
    ('Jimmy Butler III' -> 'jimmy_butler', matching bball-ref's 'Jimmy Butler').
    Periods in initials ('A.J. Green') are removed so both spellings collapse
    to the same slug.
    """
    cleaned = re.sub(r"\s*\([^)]*\)\s*$", "", name)
    slug = ascii_slug(cleaned.replace(".", ""))
    return SUFFIX_RE.sub("", slug)


def _primary_position(raw_pos: str) -> str | None:
    """Take the primary classic role out of a bball-ref 'Pos' cell.

    'SF-PF' -> 'SF', 'PG' -> 'PG'. Returns None if the cell isn't one of the
    classic five (defensive: the player is then left unmatched -> position5 'X').
    """
    for token in re.split(r"[-/\s]+", raw_pos.strip().upper()):
        if token in CLASSIC_FIVE:
            return token
    return None


def parse_positions(html: str) -> dict[str, dict]:
    """Parse the bball-ref totals page -> {normalized_name: entry}.

    entry = {"name_display": str, "position5": str (primary), "raw_pos": str}
    """
    scanner = _TableScanner()
    scanner.feed(html)

    # Locate the header row containing both a Player and a Pos column.
    header = None
    pos_col = player_col = None
    for row in scanner.rows:
        lowered = [c.lower() for c in row]
        try:
            player_col = next(
                i for i, c in enumerate(lowered) if c.startswith("player")
            )
            pos_col = next(
                i for i, c in enumerate(lowered) if c in ("pos", "position")
            )
            header = row
            break
        except StopIteration:
            continue
    if header is None:
        return {}

    out: dict[str, dict] = {}
    for row in scanner.rows:
        if row is header or len(row) <= max(player_col, pos_col):
            continue
        name = row[player_col].strip()
        norm = normalize_name(name)
        if not norm or not row[pos_col].strip():
            continue
        primary = _primary_position(row[pos_col])
        if primary is None:
            continue
        out[norm] = {
            "name_display": name,
            "position5": primary,
            "raw_pos": row[pos_col].strip().upper(),
        }
    return out


# ── Fetch + cache handling ──────────────────────────────────────────────────

def fetch_positions_html(refresh: bool = False) -> Path | None:
    """Return a local copy of the bball-ref page, or None.

    Prefers the manually-saved file. Tries the network as a best effort
    (the page is Cloudflare-protected and will usually fail with 403).
    """
    target = config.RAW_DIR / config.BBALLREF_HTML_NAME
    if target.exists() and not refresh:
        return target
    try:
        import requests

        resp = requests.get(
            config.BBALLREF_URL, headers=config.BBALLREF_HEADERS, timeout=15
        )
        if resp.status_code == 200 and "Just a moment" not in resp.text[:2000]:
            target.write_bytes(resp.content)
            print(f"  saved          -> {target.relative_to(config.ROOT)}")
            return target
        print(f"  ! bball-ref returned HTTP {resp.status_code} (Cloudflare block)")
    except Exception as err:  # noqa: BLE001 - network failure is expected
        print(f"  ! bball-ref fetch failed: {err}")
    print(
        "  ! To use Basketball-Reference positions, save the page once in a "
        "browser (Ctrl+S, full page) as:\n"
        f"      {target.relative_to(config.ROOT)}\n"
        "    see docs/statistics.md §7. Derive will refuse to run without it."
    )
    return None


def load(refresh: bool = False) -> dict[str, dict]:
    """Positions dict {normalized_name: entry} or {} when unavailable.

    Parses the local HTML page and caches the result as JSON so offline
    re-derives never need the HTML again.
    """
    cache = config.RAW_DIR / config.BBALLREF_CACHE_NAME
    if cache.exists() and not refresh:
        return json.loads(cache.read_text())
    html_path = fetch_positions_html(refresh=refresh)
    if html_path is None:
        return {}
    positions = parse_positions(html_path.read_text(encoding="utf-8", errors="replace"))
    cache.write_text(json.dumps(positions, indent=1, ensure_ascii=False))
    print(
        f"[bballref] parsed {len(positions)} players from "
        f"{html_path.relative_to(config.ROOT)} -> cached mapping"
    )
    return positions