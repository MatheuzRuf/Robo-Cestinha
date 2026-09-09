"""Backward-compatible entry point for the data ingestion pipeline.

Usage:  python -m src.data_ingestion.ingest_data [--refresh] [--no-fetch]

(Previously a one-off script; the pipeline now lives in this package — see
docs/statistics.md.)
"""

import sys

from .__main__ import main

if __name__ == "__main__":
    sys.exit(main())