from pathlib import Path

from pydantic import PostgresDsn, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Backend configuration, loaded from environment variables.

    Values are read from the process environment first, then from
    `backend/.env.local` (as written by `vercel env pull`) for local development.
    Env var names are case-insensitive, so `DATABASE_URL` populates `database_url`.
    """

    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env.local",
        env_file_encoding="utf-8",
        # .env.local also holds vars meant for other consumers (e.g. the frontend's
        # WORKOS_COOKIE_PASSWORD), so don't fail on keys we don't declare here.
        extra="ignore",
    )

    database_url: PostgresDsn

    workos_api_key: SecretStr
    workos_client_id: str

    # Shared secret that trusted server-side callers (the frontend's Vercel Blob upload callback)
    # use to HMAC-sign requests to /api/internal/* endpoints.
    hmac_secret: SecretStr


settings = Settings()  # pyright: ignore[reportCallIssue]  # fields are populated from the environment
