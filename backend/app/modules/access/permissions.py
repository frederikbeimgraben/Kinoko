"""Die Rechte und die eingebauten Rollen."""

from __future__ import annotations

from typing import Any, Final

from app.shared.enums import Area

BASE_ROLE: Final[str] = "user"

PERMISSIONS: Final[dict[str, Area]] = {
    "species.edit": Area.SPECIES,
    "image.submit": Area.SPECIES,
    "image.review": Area.SPECIES,
    "text.edit": Area.INTERFACE,
    "role.manage": Area.ACCESS,
    "role.assign": Area.ACCESS,
    "find.review": Area.DATA,
    "run.manage": Area.DATA,
}

BUILT_IN: Final[dict[str, tuple[str, tuple[str, ...]]]] = {
    "admin": ("account.role.admin", tuple(PERMISSIONS)),
    BASE_ROLE: ("account.role.user", ("image.submit",)),
    "editorial": (
        "account.role.editorial",
        ("species.edit", "text.edit", "image.review", "image.submit"),
    ),
    "reviewer": ("account.role.reviewer", ("image.review", "find.review")),
}


def permission_entries() -> dict[str, Any]:
    """Liefert alle bekannten Rechte mit ihrem Bereich."""
    return {"items": [{"key": key, "area": area} for key, area in PERMISSIONS.items()]}
