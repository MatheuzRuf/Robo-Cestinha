from dataclasses import dataclass

from app.core.secrets import secrets


@dataclass(frozen=True)
class Settings:
    database_url: str


settings = Settings(
    database_url=secrets.get(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:postgres@localhost:5432/robo_cestinha",
    )
    or "postgresql+psycopg://postgres:postgres@localhost:5432/robo_cestinha"
)
