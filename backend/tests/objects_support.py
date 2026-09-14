"""Testhilfen des Moduls objects: eine minimale Art anlegen."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.models import Species
from app.shared.enums import Edibility, Group, Protection

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


async def make_species(
    session: AsyncSession,
    slug: str = "boletus-edulis",
    protection: Protection = Protection.NONE,
) -> Species:
    """Legt eine minimale Art an."""
    made = Species(
        id=uuid.uuid4(),
        slug=slug,
        name=slug,
        latin_name=slug,
        group_key=Group.BOLETE,
        edibility=Edibility.EDIBLE,
        protection=protection,
    )
    session.add(made)
    await session.commit()
    return made
