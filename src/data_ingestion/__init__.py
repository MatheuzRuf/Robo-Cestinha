"""Data ingestion for the Robo Cestinha Basketball Simulator.

Ingests complete NBA 2025-26 season data (rosters + season statistics) from
stats.nba.com via nba-api, derives the 12 per-player simulator attributes, and
saves everything locally. See docs/statistics.md.
"""

__version__ = "0.2.0"