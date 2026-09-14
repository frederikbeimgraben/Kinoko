"""Die Rechte und die eingebauten Rollen."""

from __future__ import annotations

from typing import Any, Final

from app.shared.enums import Area

PERMISSIONS: Final[dict[str, Area]] = {
    "species.edit": Area.SPECIES,
    "image.review": Area.DATA,
    "find.review": Area.DATA,
    "run.manage": Area.DATA,
    "role.manage": Area.ACCESS,
    "role.assign": Area.ACCESS,
    "text.edit": Area.INTERFACE,
}

BUILT_IN: Final[dict[str, tuple[str, tuple[str, ...]]]] = {
    "admin": ("account.role.admin", tuple(PERMISSIONS)),
    "editorial": (
        "account.role.editorial",
        ("species.edit", "text.edit", "image.review"),
    ),
    "reviewer": ("account.role.reviewer", ("image.review", "find.review")),
}


def permission_entries() -> dict[str, Any]:
    """Liefert alle bekannten Rechte mit ihrem Bereich."""
    return {"items": [{"key": key, "area": area} for key, area in PERMISSIONS.items()]}
