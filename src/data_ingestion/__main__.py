"""CLI: python -m src.data_ingestion [--refresh] [--no-fetch]

  --refresh   force re-fetch of every raw dataset from stats.nba.com
  --no-fetch  derive only, from the local raw cache (fails if cache missing)
"""

import argparse
import sys

from . import config
from .derive import derive
from .fetch import fetch_all, load_raw_from_disk


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="re-fetch every raw dataset")
    parser.add_argument("--no-fetch", action="store_true", help="derive from local raw cache only")
    args = parser.parse_args(argv)

    if args.refresh and args.no_fetch:
        parser.error("--refresh and --no-fetch are mutually exclusive")

    if args.no_fetch:
        raw = load_raw_from_disk()
    else:
        raw = fetch_all(refresh=args.refresh)

    derive(raw)
    print(f"[ok] outputs under {config.PROCESSED_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())