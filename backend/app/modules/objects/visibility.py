"""Die Sichtbarkeit eines Eintrags: privat, oder geteilt an genau eine Gruppe."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.core.errors import Invalid
from app.modules.access.group_service import GroupService
from app.shared.enums import Visibility

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import User


async def group_of(
    db: AsyncSession,
    user: User,
    visibility: Visibility,
    group_id: uuid.UUID | None,
) -> uuid.UUID | None:
    """Prüft die Gruppe eines Eintrags. Ein privater Eintrag trägt keine."""
    if visibility != Visibility.SHARED:
        return None
    if group_id is None or group_id not in await GroupService(db).my_ids(user):
        raise Invalid(errors=[{"field": "groupId", "code": "group"}])
    return group_id
