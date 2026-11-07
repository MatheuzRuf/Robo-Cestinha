from dataclasses import dataclass

from app.core.secrets import secrets

_DEFAULT_MAX_SIMULATION_ITERATIONS = 1000


@dataclass(frozen=True)
class Settings:
    """Application settings loaded from secrets."""

    database_url: str
    api_cors_origins: list[str]
    max_simulation_iterations: int


def load_settings() -> Settings:
    """Load runtime settings from the configured secret source."""

    return Settings(
        database_url=secrets.get("DATABASE_URL"),
        api_cors_origins=secrets.get("API_CORS_ORIGINS", "http://localhost:5173").split(
            ","
        ),
        max_simulation_iterations=int(
            secrets.get(
                "MAX_SIMULATION_ITERATIONS",
                _DEFAULT_MAX_SIMULATION_ITERATIONS,
            )
        ),
    )


settings = load_settings()
