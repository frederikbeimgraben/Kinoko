"""Einstellungen aus der Umgebung. Jede Variable trägt den Präfix ``PILZE_``."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

VERSION = "2.0.0"


class Settings(BaseSettings):
    """Die Werte, die der Dienst beim Start liest."""

    model_config = SettingsConfigDict(
        env_prefix="PILZE_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    db: str = "sqlite+aiosqlite:///./var/pilze.sqlite"
    # Der Name der Variablen ist ein Vertrag zum NixOS-Modul.
    photos: Path = Field(default=Path("./var/fotos"), validation_alias="PILZE_FOTOS")
    maps: Path = Path("./var/maps")
    oidc_issuer: str = "https://sso.beimgraben.net/application/o/pilze/"
    oidc_client_id: str = "pilze"
    origin: str = "http://localhost:4200"
    # Wer diese Gruppe im Token traegt, ist Admin, auch ohne Zeile in der
    # Datenbank.
    admin_group: str = "pilze-admins"
    internal_token: str = "intern"  # noqa: S105
    max_photo_bytes: int = 12 * 1024 * 1024
    # Der Arbeiter der Kette spricht den Dienst am Port des Rechners an.
    api: str = "http://127.0.0.1:8111/api"
    chain: Path = Path("./var/modell")
    run_logs: Path = Path("./var/runs")

    @field_validator("oidc_issuer")
    @classmethod
    def _trailing_slash(cls, value: str) -> str:
        # Discovery und JWKS haengen als Pfad direkt am Issuer.
        return value if value.endswith("/") else value + "/"

    @property
    def discovery_url(self) -> str:
        """URL des OpenID-Configuration-Dokuments."""
        return f"{self.oidc_issuer}.well-known/openid-configuration"

    @property
    def jwks_url(self) -> str:
        """URL der Signaturschlüssel, falls die Discovery keine nennt."""
        return f"{self.oidc_issuer}jwks/"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Liefert die Einstellungen des Prozesses."""
    return Settings()
