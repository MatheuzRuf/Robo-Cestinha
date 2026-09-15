# AGENTS.md — Backend

## Structure
Layer by responsibility, not by type-per-model-file dumped together.

```
backend/src/app/
├── core/        # config, secrets — cross-cutting, no business logic
├── db/          # SQLAlchemy engine/session + models (one file per model)
├── domain/      # business logic, framework-agnostic (no FastAPI/SQLAlchemy imports beyond calling db/)
├── api/         # FastAPI only — routers + Pydantic schemas, thin, no business logic inline
├── engine/      # match simulation — untouched by API/domain concerns
└── data_ingestion/  # one-off data-prep scripts
```

## Rules
- **Secrets:** never call `os.environ`/`os.getenv` outside `core/secrets.py`. All secret access goes through `SecretsProvider`. `core/config.py` builds `Settings` from `SecretsProvider`, not from direct env reads.
- **Routers are thin:** a router parses the request and calls a `domain/` service function. No DB queries, no business rules written directly inside a router.
- **`domain/` has no FastAPI or Pydantic imports.** It takes/returns plain Python objects or SQLAlchemy models, so it can be unit-tested without spinning up the API.
- **Pydantic schemas (`api/schemas/`) are separate from SQLAlchemy models (`db/models/`).** Never return a SQLAlchemy model directly from a route — map it to a schema. Changing the DB shape should not silently change the API contract.
- **`engine/` and `data_ingestion/` know nothing about sessions, users, or the API.** `domain/` calls into `engine/`, never the reverse.
- **Migrations:** every model change ships with an Alembic migration in the same change. Never hand-edit the DB schema outside a migration.
- **Before adding a new table or endpoint:** check if an existing model/router already covers it. Extending > duplicating.
- **Comments:** Avoid using comments in the code. Docstrings are acceptable, but the code should be self explainable.
- **Docstrings:** every class, every function/method in domain/, db/, and core/, and every route handler gets a Google-style docstring (Args/Returns/Raises). Skip only trivial one-liners with nothing to add beyond the signature. Should not be too verbose.