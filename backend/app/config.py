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

    # Shared secret that trusted server-side callers (the frontend's Vercel Blob upload callback and
    # the eve agent's result webhook) use to HMAC-sign requests to /api/internal/* endpoints.
    hmac_secret: SecretStr

    # The deployment's public origin, where the eve agent (/eve/v1/*) and the backend's public
    # routes (/api/*) are served. Optional override; see `public_url`.
    app_url: str | None = None
    # Vercel system environment variables (unset outside Vercel and under `vercel dev`).
    vercel_env: str | None = None
    vercel_url: str | None = None
    vercel_project_production_url: str | None = None
    # Lets server-to-server calls through Deployment Protection on preview deployments.
    vercel_automation_bypass_secret: SecretStr | None = None

    @property
    def public_url(self) -> str:
        """The origin to reach this deployment's public routes from server-side code.

        The frontend calls the backend over a private service binding, so an incoming request's
        host isn't the public one; derive it from the environment instead.
        """
        if self.app_url:
            return self.app_url.rstrip("/")
        if self.vercel_env == "production" and self.vercel_project_production_url:
            return f"https://{self.vercel_project_production_url}"
        if self.vercel_env == "preview" and self.vercel_url:
            return f"https://{self.vercel_url}"
        # `vercel dev --local` serves the whole service graph here.
        return "http://localhost:3000"


settings = Settings()  # pyright: ignore[reportCallIssue]  # fields are populated from the environment
