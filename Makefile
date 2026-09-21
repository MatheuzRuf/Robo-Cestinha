.PHONY: bootstrap dev migrate reset-db format format-check

bootstrap:
	cd backend && ./scripts/bootstrap.sh

dev:
	cd backend && ./scripts/dev.sh

migrate:
	cd backend && ./scripts/migrate.sh

reset-db:
	cd backend && ./scripts/reset-db.sh

format:
	uv run --extra dev ruff format backend

format-check:
	uv run --extra dev ruff format --check backend

stop:
	cd backend && docker compose down
	pkill -f "uvicorn app.api.main:app --reload" || true
