"""Die Signaturschlüssel des Issuers, mit Zwischenspeicher."""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Final

import httpx
import jwt

from app.core.settings import get_settings

POSITIVE_TTL: Final = 3600.0
NEGATIVE_TTL: Final = 60.0


def net_client() -> httpx.AsyncClient:
    """Der Klient gegen den Issuer. Tests hängen sich hier ein."""
    return httpx.AsyncClient(timeout=5.0)


@dataclass
class JwksCache:
    """Hält die Schlüssel und merkt sich auch unbekannte Kennungen."""

    keys: dict[str, Any] = field(default_factory=dict[str, Any])
    loaded_at: float = 0.0
    unknown: dict[str, float] = field(default_factory=dict[str, float])

    def fresh(self, at: float) -> bool:
        """Sagt, ob der Bestand noch gilt."""
        return bool(self.keys) and at - self.loaded_at < POSITIVE_TTL

    def blocked(self, kid: str, at: float) -> bool:
        """Sagt, ob diese Kennung erst kürzlich fehlte."""
        until = self.unknown.get(kid)
        return until is not None and at < until

    def put(self, keys: dict[str, Any], at: float) -> None:
        """Übernimmt einen frischen Bestand."""
        self.keys = keys
        self.loaded_at = at
        self.unknown.clear()

    def miss(self, kid: str, at: float) -> None:
        """Merkt sich eine Kennung, die der Issuer nicht führt."""
        self.unknown[kid] = at + NEGATIVE_TTL

    async def key(self, kid: str) -> Any | None:  # noqa: ANN401
        """Liefert den Schlüssel zur Kennung, oder nichts."""
        at = time.monotonic()
        if self.blocked(kid, at):
            return None
        if self.fresh(at) and kid in self.keys:
            return self.keys[kid]
        if not self.fresh(at):
            self.put(await fetch_keys(), at)
        if kid in self.keys:
            return self.keys[kid]
        self.miss(kid, at)
        return None


async def jwks_url(client: httpx.AsyncClient) -> str:
    """Liest die JWKS-URL aus der Discovery, sonst die Vorgabe."""
    settings = get_settings()
    try:
        answer = await client.get(settings.discovery_url)
        if answer.is_success:
            found = answer.json().get("jwks_uri")
            if isinstance(found, str):
                return found
    except httpx.HTTPError:
        return settings.jwks_url
    return settings.jwks_url


async def fetch_keys() -> dict[str, Any]:
    """Holt die Schlüssel des Issuers, nach Kennung sortiert."""
    async with net_client() as client:
        answer = await client.get(await jwks_url(client))
        answer.raise_for_status()
        found: dict[str, Any] = {}
        for entry in answer.json().get("keys", []):
            kid = entry.get("kid")
            if not kid:
                continue
            found[kid] = jwt.PyJWK(entry).key
        return found


_cache = JwksCache()


def cache() -> JwksCache:
    """Liefert den Zwischenspeicher des Prozesses."""
    return _cache
