"""Die Signaturschlüssel und Gruppen des Issuers, mit Zwischenspeicher."""

from __future__ import annotations

import hashlib
import time
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Final, cast

import httpx
import jwt

from app.core.settings import get_settings

POSITIVE_TTL: Final = 3600.0
NEGATIVE_TTL: Final = 60.0
GROUP_CLAIM: Final = "groups"


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


@dataclass
class DiscoveryCache:
    """Hält das Discovery-Dokument des Issuers."""

    document: dict[str, Any] | None = None
    loaded_at: float = 0.0

    def fresh(self, at: float) -> bool:
        """Sagt, ob das Dokument noch gilt."""
        return self.document is not None and at - self.loaded_at < POSITIVE_TTL

    def put(self, document: dict[str, Any], at: float) -> None:
        """Übernimmt ein frisches Dokument."""
        self.document = document
        self.loaded_at = at


@dataclass
class GroupsCache:
    """Hält Gruppen von Userinfo, je Token für dessen Laufzeit."""

    entries: dict[str, tuple[list[object], float]] = field(default_factory=dict)

    def get(self, key: str, at: float) -> list[object] | None:
        """Liefert die Gruppen zum Schlüssel, wenn sie noch gelten."""
        found = self.entries.get(key)
        if found is None or at >= found[1]:
            return None
        return found[0]

    def put(self, key: str, groups: list[object], expires_at: float) -> None:
        """Merkt sich Gruppen für die Laufzeit des Tokens."""
        self.entries[key] = (groups, expires_at)


async def discovery_document(client: httpx.AsyncClient) -> dict[str, Any]:
    """Liest das Discovery-Dokument, zwischengespeichert."""
    at = time.monotonic()
    cached = discovery_cache()
    if cached.fresh(at):
        return cast("dict[str, Any]", cached.document)
    try:
        answer = await client.get(get_settings().discovery_url)
    except httpx.HTTPError:
        return {}
    if not answer.is_success:
        return {}
    document = cast("dict[str, Any]", answer.json())
    cached.put(document, at)
    return document


async def jwks_url(client: httpx.AsyncClient) -> str:
    """Liest die JWKS-URL aus der Discovery, sonst die Vorgabe."""
    found = (await discovery_document(client)).get("jwks_uri")
    return found if isinstance(found, str) else get_settings().jwks_url


async def userinfo_url(client: httpx.AsyncClient) -> str | None:
    """Liest die Userinfo-URL aus der Discovery, sonst nichts."""
    found = (await discovery_document(client)).get("userinfo_endpoint")
    return found if isinstance(found, str) else None


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


async def fetch_groups(token: str) -> list[object] | None:
    """Holt die Gruppen des Kontos von Userinfo, sonst nichts."""
    async with net_client() as client:
        url = await userinfo_url(client)
        if url is None:
            return None
        try:
            answer = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            answer.raise_for_status()
        except httpx.HTTPError:
            return None
        groups = answer.json().get(GROUP_CLAIM)
        return cast("list[object]", groups) if isinstance(groups, list) else None


def token_key(token: str, claims: Mapping[str, Any]) -> str:
    """Baut den Zwischenspeicher-Schlüssel eines Tokens: seine Kennung, sonst ein Hash."""
    jti = claims.get("jti")
    if isinstance(jti, str) and jti:
        return jti
    return hashlib.sha256(token.encode()).hexdigest()


async def groups_of(token: str, claims: Mapping[str, Any]) -> list[object] | None:
    """Liefert die Gruppen aus dem Token, sonst gecacht von Userinfo."""
    found = claims.get(GROUP_CLAIM)
    if isinstance(found, list):
        return cast("list[object]", found)
    key = token_key(token, claims)
    at = time.time()
    cached = groups_cache().get(key, at)
    if cached is not None:
        return cached
    groups = await fetch_groups(token)
    if groups is None:
        return None
    exp = claims.get("exp")
    expires_at = float(exp) if isinstance(exp, int | float) else at + POSITIVE_TTL
    groups_cache().put(key, groups, expires_at)
    return groups


_cache = JwksCache()
_discovery_cache = DiscoveryCache()
_groups_cache = GroupsCache()


def cache() -> JwksCache:
    """Liefert den Zwischenspeicher der Schlüssel."""
    return _cache


def discovery_cache() -> DiscoveryCache:
    """Liefert den Zwischenspeicher des Discovery-Dokuments."""
    return _discovery_cache


def groups_cache() -> GroupsCache:
    """Liefert den Zwischenspeicher der Gruppen."""
    return _groups_cache
