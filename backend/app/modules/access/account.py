"""Die Endpunkte des eigenen Kontos, ``/me*``."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, status

from app.core.auth import CurrentUser, CurrentViewer, Db
from app.core.errors import Unauthorized
from app.modules.access.schemas import Me
from app.modules.access.service import AccessService

router = APIRouter(tags=["account"])


@router.get("/me")
def get_me(user: CurrentUser) -> Any:  # noqa: ANN401
    """Liefert das angemeldete Konto."""
    return Me(id=user.id, sub=user.sub, email=user.email, name=user.name).dumped()


@router.get("/me/permissions")
def get_my_permissions(who: CurrentViewer) -> Any:  # noqa: ANN401
    """Liefert die Rechte des angemeldeten Kontos."""
    if not who.sub:
        raise Unauthorized
    return {"permissions": sorted(who.rights)}


@router.get("/me/export")
async def export_my_data(db: Db, user: CurrentUser) -> Any:  # noqa: ANN401
    """Liefert das Konto mit allen eigenen Funden, Objekten und Fotos."""
    return await AccessService(db).export_own(user)


@router.delete("/me/data", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_data(db: Db, user: CurrentUser) -> None:
    """Löscht alle eigenen Daten. Das Konto selbst bleibt."""
    await AccessService(db).delete_own(user)
