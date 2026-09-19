"""Die Endpunkte des Moduls access: Rechte, Rollen, Personen, eigenes Konto."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Path, Query, status

from app.core.auth import CurrentUser, CurrentViewer, Db, requires
from app.core.errors import Forbidden, Invalid, Unauthorized
from app.modules.access.account import router as account_router
from app.modules.access.group_service import GroupService
from app.modules.access.groups import router as groups_router
from app.modules.access.permissions import permission_entries
from app.modules.access.schemas import PersonName, RoleCreate, RoleUpdate, SetPersonRoles
from app.modules.access.service import AccessService
from app.modules.access.summary import SummaryService
from app.modules.catalog.service import SpeciesService
from app.shared.paging import Page

router = APIRouter(tags=["access"])
router.include_router(account_router)
router.include_router(groups_router)

RoleId = Annotated[uuid.UUID, Path(alias="id")]
MAX_NAME_IDS = 50
PersonId = Annotated[uuid.UUID, Path(alias="id")]


@router.get("/admin/summary")
async def get_admin_summary(db: Db, who: CurrentViewer) -> Any:  # noqa: ANN401
    """Liefert die Zähler der Übersicht, je Punkt hinter seinem Recht."""
    if not who.sub:
        raise Unauthorized
    if not who.rights:
        raise Forbidden
    return await SummaryService(db).counts(who.rights)


@router.get("/admin/species-counts", dependencies=[requires("species.edit")])
async def get_admin_species_counts(db: Db) -> Any:  # noqa: ANN401
    """Liefert die Zahlen jeder Art für die Artenverwaltung."""
    return await SpeciesService(db).counts_entries()


@router.get("/permissions", dependencies=[requires("role.manage")])
def list_permissions() -> Any:  # noqa: ANN401
    """Liefert alle bekannten Rechte mit ihrem Bereich."""
    return permission_entries()


@router.get("/roles", dependencies=[requires("role.manage")])
async def list_roles(db: Db, paging: Page) -> Any:  # noqa: ANN401
    """Liefert eine Seite Rollen."""
    return await AccessService(db).list_roles(paging)


@router.post(
    "/roles",
    status_code=status.HTTP_201_CREATED,
    dependencies=[requires("role.manage")],
)
async def create_role(db: Db, body: RoleCreate) -> Any:  # noqa: ANN401
    """Legt eine Rolle an."""
    service = AccessService(db)
    return await service.create_role(body.slug, body.name, body.description, body.permissions)


@router.get("/roles/{id}", dependencies=[requires("role.manage")])  # noqa: FAST003
async def get_role(db: Db, role_id: RoleId) -> Any:  # noqa: ANN401
    """Liest eine Rolle."""
    return await AccessService(db).get_role(role_id)


@router.patch("/roles/{id}", dependencies=[requires("role.manage")])  # noqa: FAST003
async def update_role(db: Db, role_id: RoleId, body: RoleUpdate) -> Any:  # noqa: ANN401
    """Ändert eine Rolle."""
    patch = body.model_dump(exclude_unset=True)
    return await AccessService(db).update_role(role_id, patch)


@router.delete(
    "/roles/{id}",  # noqa: FAST003
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[requires("role.manage")],
)
async def delete_role(db: Db, role_id: RoleId) -> None:
    """Löscht eine Rolle."""
    await AccessService(db).delete_role(role_id)


@router.get("/people", dependencies=[requires("role.assign")])
async def list_people(
    db: Db,
    paging: Page,
    q: Annotated[str | None, Query()] = None,
) -> Any:  # noqa: ANN401
    """Liefert eine Seite Personen."""
    return await AccessService(db).list_people(q, paging)


def _parse_ids(raw: str) -> list[uuid.UUID]:
    parts = [part.strip() for part in raw.split(",") if part.strip()]
    if not parts or len(parts) > MAX_NAME_IDS:
        raise Invalid(errors=[{"field": "ids", "code": "ids"}])
    try:
        return [uuid.UUID(part) for part in parts]
    except ValueError as broken:
        raise Invalid(errors=[{"field": "ids", "code": "ids"}]) from broken


@router.get("/people/names")
async def resolve_person_names(
    db: Db,
    user: CurrentUser,
    ids: Annotated[str, Query()],
) -> Any:  # noqa: ANN401
    """Liefert die Namen zu Kennungen, mit denen das Konto eine Gruppe teilt."""
    requested = _parse_ids(ids)
    visible = await GroupService(db).shared_with(user, requested)
    names = await GroupService(db).names(visible)
    return [
        PersonName(id=person_id, name=names[person_id]).dumped()
        for person_id in requested
        if person_id in names
    ]


@router.get("/people/{id}", dependencies=[requires("role.assign")])  # noqa: FAST003
async def get_person(db: Db, person_id: PersonId) -> Any:  # noqa: ANN401
    """Liest eine Person."""
    return await AccessService(db).get_person(person_id)


@router.delete(
    "/people/{id}",  # noqa: FAST003
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[requires("role.assign")],
)
async def delete_person(db: Db, person_id: PersonId) -> None:
    """Löscht eine Person."""
    await AccessService(db).delete_person(person_id)


@router.put("/people/{id}/roles", dependencies=[requires("role.assign")])  # noqa: FAST003
async def set_person_roles(db: Db, person_id: PersonId, body: SetPersonRoles) -> Any:  # noqa: ANN401
    """Setzt die Rollen einer Person neu."""
    return await AccessService(db).set_person_roles(person_id, body.role_ids)
