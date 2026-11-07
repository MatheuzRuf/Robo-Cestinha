.PHONY: bootstrap dev migrate reset-db format format-check

bootstrap:
	cd backend && ./scripts/bootstrap.sh

dev: SHELL := /bin/bash
dev:
	@set +e; \
	(cd backend && ./scripts/dev.sh) & backend_pid=$$!; \
	(cd frontend && npm run dev) & frontend_pid=$$!; \
	trap 'kill "$$backend_pid" "$$frontend_pid" 2>/dev/null || true' INT TERM EXIT; \
	wait -n "$$backend_pid" "$$frontend_pid"; status=$$?; \
	kill "$$backend_pid" "$$frontend_pid" 2>/dev/null || true; \
	wait "$$backend_pid" "$$frontend_pid" 2>/dev/null || true; \
	exit "$$status"

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
