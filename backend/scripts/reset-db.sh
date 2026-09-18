#!/usr/bin/env bash
set -euo pipefail

docker compose down -v
docker compose up -d db
uv run alembic upgrade head
