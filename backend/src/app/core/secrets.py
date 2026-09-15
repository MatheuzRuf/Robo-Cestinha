import os

from dotenv import load_dotenv


load_dotenv()


class SecretsProvider:
    def get(self, key: str, default: str | None = None) -> str:
        value = os.getenv(key, default)
        if value is None:
            raise RuntimeError(f"Missing required secret: {key}")
        return value


secrets = SecretsProvider()
