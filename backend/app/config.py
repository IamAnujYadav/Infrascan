"""Application settings. Values come from the .env file (see .env.example)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./infrascan.db"
    secret_key: str = "change-this-to-a-long-random-string"
    access_token_expire_minutes: int = 60
    cors_origins: str = "*"              # comma separated list, or * for everything (development only)
    storage_dir: str = "storage"
    max_upload_mb: int = 20

    # first administrator, created at startup when it does not exist yet
    admin_email: str = ""
    admin_password: str = ""

    # False = /api/analyze stays open (while the frontend is being connected). True = login needed.
    require_login: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self):
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


settings = Settings()