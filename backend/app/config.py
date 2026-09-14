"""Application settings, loaded from the environment (and an optional `.env`).

Centralises the handful of knobs the service needs so nothing reads
`os.getenv` ad hoc. Values come from environment variables prefixed with
`INTRINSIC_` (e.g. `INTRINSIC_DATABASE_URL`); a local `.env` file is read for
development convenience but is never committed.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for the Intrinsic API."""

    model_config = SettingsConfigDict(
        env_prefix="INTRINSIC_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # SQLite for now; a file path keeps scenarios across restarts. Tests swap
    # this for a throwaway database via the session dependency override.
    database_url: str = "sqlite:///./intrinsic.db"

    # Comma-separated list of allowed CORS origins for the browser frontend.
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Shared secret for signing tokens. Person 2's auth slice consumes this;
    # the value here is a dev-only placeholder and must be overridden in `.env`
    # / the deployment environment. Never commit a real secret.
    secret_key: str = "dev-insecure-change-me"

    @property
    def cors_origin_list(self) -> list[str]:
        """`cors_origins` split into a clean list for the CORS middleware."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached `Settings` instance (read the environment once)."""
    return Settings()
