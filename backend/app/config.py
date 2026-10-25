"""Application settings, loaded from the environment / a local .env file.

All variables use the INTRINSIC_ prefix, e.g. INTRINSIC_SECRET_KEY. Defaults are
dev-friendly; override them in production. Never commit a real secret.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="INTRINSIC_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./intrinsic.db"
    secret_key: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
