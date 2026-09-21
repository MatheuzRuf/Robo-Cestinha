#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
unset VIRTUAL_ENV
export PYTHONPYCACHEPREFIX="$SCRIPT_DIR/../__pycache__"

uv run alembic upgrade head
