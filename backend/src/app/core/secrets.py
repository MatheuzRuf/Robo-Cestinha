import os

from dotenv import load_dotenv


load_dotenv()


class SecretsProvider:
    """Read secrets from process environment variables."""

    def get(self, key: str, default: str | None = None) -> str:
        """Return a secret value or raise if it is missing.

        Args:
            key: Environment variable name to read.
            default: Fallback value when the variable is unset.

        Returns:
            The resolved secret value.

        Raises:
            RuntimeError: If the secret is missing and no default was provided.
        """

        value = os.getenv(key, default)
        if value is None:
            raise RuntimeError(f"Missing required secret: {key}")
        return value


secrets = SecretsProvider()
