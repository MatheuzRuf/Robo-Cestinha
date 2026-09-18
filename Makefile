.PHONY: bootstrap dev migrate reset-db

bootstrap:
	cd backend && ./scripts/bootstrap.sh

dev:
	cd backend && ./scripts/dev.sh

migrate:
	cd backend && ./scripts/migrate.sh

reset-db:
	cd backend && ./scripts/reset-db.sh

stop:
	cd backend && docker compose down
	pkill -f "uvicorn app.api.main:app --reload" || true
