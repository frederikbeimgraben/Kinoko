"""Gesundheit und die Werte, die das Frontend beim Start braucht."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.settings import VERSION, get_settings

router = APIRouter(tags=["system"])


@router.get("/health")
async def get_health() -> dict[str, Any]:
    """Sagt, dass der Dienst antwortet."""
    return {"status": "ok"}


@router.get("/config")
async def get_config() -> dict[str, Any]:
    """Liefert Issuer, Klient, Ursprung und Version."""
    settings = get_settings()
    return {
        "oidcIssuer": settings.oidc_issuer,
        "oidcClientId": settings.oidc_client_id,
        "origin": settings.origin,
        "version": VERSION,
    }
