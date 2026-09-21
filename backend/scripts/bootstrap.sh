#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."
unset VIRTUAL_ENV
export PYTHONPYCACHEPREFIX="$SCRIPT_DIR/../__pycache__"

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

uv sync
docker compose up -d db
until docker compose exec -T db pg_isready -U app -d app >/dev/null 2>&1; do
  sleep 1
done
uv run alembic upgrade head
