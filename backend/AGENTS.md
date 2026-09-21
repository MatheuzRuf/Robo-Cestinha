# AGENTS.md — Backend

## Structure
Layer by responsibility, not by type-per-model-file dumped together.

```
backend/src/app/
├── core/        # config, secrets — cross-cutting, no business logic
├── db/          # SQLAlchemy engine/session + models (one file per model)
├── domain/      # services + repositories grouped by business area
├── api/         # FastAPI only — routers, schemas, and service composition
├── engine/      # match simulation — untouched by API/domain concerns
└── data_ingestion/  # one-off data-prep scripts
```

## Rules
- **Secrets:** never call `os.environ`/`os.getenv` outside `core/secrets.py`. All secret access goes through `SecretsProvider`. `core/config.py` builds `Settings` from `SecretsProvider`, not from direct env reads.
- **Routers are thin:** a router parses the request and calls a `domain/` service function. No DB queries, no business rules written directly inside a router.
- **Repositories own persistence:** repositories live beside the services for the domain area they support and are the only domain components that directly use `AsyncSession` or issue SQLAlchemy queries.
- **Repository reuse:** all repositories inherit from `domain/base_repository.py` for shared session and transaction operations. Concrete repositories contain only domain-specific queries and persistence methods.
- **Async persistence API:** repository methods are async and callers must await them. SQLAlchemy's `AsyncSession.add()` and `add_all()` are synchronous staging operations by design; they must remain internal to repository implementations, while database I/O uses awaited `flush()`, `execute()`, `commit()`, and `refresh()` calls.
- **Services own business workflows:** services depend on repositories and other services, never on `AsyncSession`. They must not perform direct database operations.
- **Request-scoped service construction:** `api/factories.py` is the composition root for application services. `ServiceFactory` and every repository/service it creates are request-scoped when they hold a database session. Do not create module-level instances that retain request state.
- **`domain/` has no FastAPI or Pydantic imports.** Repositories may use SQLAlchemy models and sessions; services should contain business workflows and remain unit-testable without spinning up the API.
- **Pydantic schemas (`api/schemas/`) are separate from SQLAlchemy models (`db/models/`).** Never return a SQLAlchemy model directly from a route — map it to a schema. Changing the DB shape should not silently change the API contract.
- **`engine/` and `data_ingestion/` know nothing about sessions, users, or the API.** `domain/` calls into `engine/`, never the reverse.
- **Migrations:** every model change ships with an Alembic migration in the same change. Never hand-edit the DB schema outside a migration.
- **Before adding a new table or endpoint:** check if an existing model/router already covers it. Extending > duplicating.
- **Comments:** Avoid using comments in the code. Docstrings are acceptable, but the code should be self explainable.
- **Docstrings:** every class, every function/method in domain/, db/, and core/, and every route handler gets a Google-style docstring (Args/Returns/Raises). Skip only trivial one-liners with nothing to add beyond the signature. Should not be too verbose.
