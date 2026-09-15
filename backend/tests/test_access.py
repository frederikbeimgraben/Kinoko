import json
import uuid
from datetime import UTC, date, datetime

import httpx
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import Conflict
from app.models import (
    Combination,
    Find,
    Marker,
    Photo,
    PipelineRun,
    Role,
    RolePermission,
    User,
    UserRole,
    Zone,
)
from app.modules.access.permissions import PERMISSIONS
from app.modules.access.service import AccessService
from app.shared.enums import (
    Licence,
    MarkerColour,
    PhotoState,
    ReviewState,
    Rule,
    RunKind,
    RunState,
    Visibility,
)
from tests.conftest import app_of, make_user, sign_in, sign_out


async def grant_role(session: AsyncSession, user: User, slug: str) -> Role:
    role = (await session.execute(select(Role).where(Role.slug == slug))).scalar_one()
    session.add(UserRole(user_id=user.id, role_id=role.id))
    await session.commit()
    return role


async def new_role(session: AsyncSession, slug: str, *permissions: str) -> Role:
    role = Role(slug=slug, name=slug)
    session.add(role)
    await session.flush()
    for key in permissions:
        session.add(RolePermission(role_id=role.id, permission_key=key))
    await session.commit()
    await session.refresh(role)
    return role


async def test_me_returns_the_signed_in_account(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, "person-a")
    sign_in(app_of(api), user)
    answer = await api.get("/me")
    assert answer.status_code == 200
    assert answer.json() == {
        "id": str(user.id),
        "sub": "person-a",
        "email": "person-a@example.test",
        "name": "person-a",
    }


async def test_me_needs_a_signed_in_account(api: httpx.AsyncClient) -> None:
    sign_out(app_of(api))
    answer = await api.get("/me")
    assert answer.status_code == 401


async def test_my_permissions_endpoint_needs_a_signed_in_account(api: httpx.AsyncClient) -> None:
    sign_out(app_of(api))
    answer = await api.get("/me/permissions")
    assert answer.status_code == 401


async def test_export_contains_own_objects_and_skips_deleted_ones(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session, "owner")
    other = await make_user(session, "other")
    find = Find(
        owner_id=user.id,
        lat=1.0,
        lon=2.0,
        found_on=date(2026, 6, 1),
        review_state=ReviewState.OPEN,
        visibility=Visibility.PRIVATE,
    )
    gone = Find(owner_id=user.id, lat=0.0, lon=0.0, found_on=date(2026, 6, 1))
    gone.deleted_at = datetime.now(UTC)
    marker = Marker(owner_id=user.id, name="Spot", lat=1.0, lon=2.0, colour=MarkerColour.GREEN)
    polygon = json.dumps({"type": "Polygon", "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 0]]]})
    zone = Zone(owner_id=user.id, name="Wald", polygon=polygon, area_ha=1.5)
    factors = json.dumps([{"source": "temp", "condition": "above", "low": 10.0, "active": True}])
    combination = Combination(
        owner_id=user.id, name="Regel", rule=Rule.INTERSECTION, factors=factors
    )
    photo = Photo(
        owner_id=user.id,
        width=10,
        height=10,
        photographer="Owner",
        licence=Licence.OWN,
    )
    foreign_marker = Marker(owner_id=other.id, name="Fremd", lat=0.0, lon=0.0)
    session.add_all([find, gone, marker, zone, combination, photo, foreign_marker])
    await session.commit()

    sign_in(app_of(api), user)
    answer = await api.get("/me/export")
    assert answer.status_code == 200
    body = answer.json()
    assert body["me"]["sub"] == "owner"
    assert [row["id"] for row in body["finds"]] == [str(find.id)]
    assert [row["id"] for row in body["markers"]] == [str(marker.id)]
    assert body["zones"][0]["polygon"]["coordinates"]
    assert body["combinations"][0]["factors"][0]["source"] == "temp"
    assert [row["id"] for row in body["photos"]] == [str(photo.id)]


async def test_delete_my_data_removes_owned_rows_but_keeps_the_account(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session, "owner")
    marker = Marker(owner_id=user.id, name="Spot", lat=1.0, lon=2.0)
    session.add(marker)
    await session.commit()

    sign_in(app_of(api), user)
    answer = await api.delete("/me/data")
    assert answer.status_code == 204
    left = (await session.execute(select(Marker).where(Marker.owner_id == user.id))).scalars().all()
    assert left == []
    still_there = await session.get(User, user.id)
    assert still_there is not None


async def test_list_permissions_needs_role_manage(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "role.manage")
    answer = await api.get("/permissions")
    assert answer.status_code == 200
    keys = {row["key"] for row in answer.json()["items"]}
    assert "role.manage" in keys


async def test_list_permissions_is_forbidden_without_the_right(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user)
    answer = await api.get("/permissions")
    assert answer.status_code == 403


async def test_create_role_then_read_it_back(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "role.manage")
    answer = await api.post(
        "/roles",
        json={"slug": "scout", "name": "Scout", "permissions": ["find.review"]},
    )
    assert answer.status_code == 201
    body = answer.json()
    assert body["slug"] == "scout"
    assert body["peopleCount"] == 0
    assert body["builtIn"] is False

    read_back = await api.get(f"/roles/{body['id']}")
    assert read_back.status_code == 200
    assert read_back.json()["permissions"] == ["find.review"]


async def test_create_role_rejects_a_taken_slug(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "role.manage")
    await new_role(session, "scout")
    answer = await api.post("/roles", json={"slug": "scout", "name": "Scout"})
    assert answer.status_code == 409
    assert answer.json()["code"] == "slug_taken"


async def test_create_role_rejects_an_unknown_permission(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "role.manage")
    answer = await api.post(
        "/roles", json={"slug": "scout", "name": "Scout", "permissions": ["no.such"]}
    )
    assert answer.status_code == 422


async def test_get_role_is_not_found_for_an_unknown_id(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "role.manage")
    answer = await api.get(f"/roles/{uuid.uuid4()}")
    assert answer.status_code == 404


async def test_list_roles_reports_people_count(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    role = await new_role(session, "scout")
    await grant_role(session, user, "scout")
    sign_in(app_of(api), user, "role.manage")
    answer = await api.get("/roles")
    assert answer.status_code == 200
    found = next(row for row in answer.json()["items"] if row["id"] == str(role.id))
    assert found["peopleCount"] == 1


async def test_update_role_changes_name_and_permissions(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    role = await new_role(session, "scout", "find.review")
    sign_in(app_of(api), user, "role.manage")
    answer = await api.patch(
        f"/roles/{role.id}",
        json={"name": "Späher", "description": "Beobachtet Funde", "permissions": ["image.review"]},
    )
    assert answer.status_code == 200
    body = answer.json()
    assert body["name"] == "Späher"
    assert body["description"] == "Beobachtet Funde"
    assert body["permissions"] == ["image.review"]


async def test_update_role_rejects_an_unknown_permission(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    role = await new_role(session, "scout")
    sign_in(app_of(api), user, "role.manage")
    answer = await api.patch(f"/roles/{role.id}", json={"permissions": ["no.such"]})
    assert answer.status_code == 422


async def test_delete_role_refuses_a_built_in_role(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    admin = (await session.execute(select(Role).where(Role.slug == "admin"))).scalar_one()
    sign_in(app_of(api), user, "role.manage")
    answer = await api.delete(f"/roles/{admin.id}")
    assert answer.status_code == 409
    assert answer.json()["code"] == "in_use"


async def test_delete_role_refuses_a_role_with_people(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    role = await new_role(session, "scout")
    await grant_role(session, user, "scout")
    sign_in(app_of(api), user, "role.manage")
    answer = await api.delete(f"/roles/{role.id}")
    assert answer.status_code == 409
    assert answer.json()["code"] == "in_use"


async def test_delete_role_removes_an_unused_role(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    role = await new_role(session, "scout")
    sign_in(app_of(api), user, "role.manage")
    answer = await api.delete(f"/roles/{role.id}")
    assert answer.status_code == 204
    left = (await session.execute(select(Role).where(Role.id == role.id))).scalar_one_or_none()
    assert left is None


async def test_list_people_searches_by_q(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session)
    await make_user(session, "birke")
    await make_user(session, "fliege")
    sign_in(app_of(api), user, "role.assign")
    answer = await api.get("/people", params={"q": "birke"})
    assert answer.status_code == 200
    subs = {row["sub"] for row in answer.json()["items"]}
    assert subs == {"birke"}


async def test_list_people_without_a_query_lists_everyone(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    await make_user(session, "birke")
    sign_in(app_of(api), user, "role.assign")
    answer = await api.get("/people")
    assert answer.status_code == 200
    subs = {row["sub"] for row in answer.json()["items"]}
    assert subs == {user.sub, "birke"}


async def test_get_person_is_not_found_for_an_unknown_id(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "role.assign")
    answer = await api.get(f"/people/{uuid.uuid4()}")
    assert answer.status_code == 404


async def test_get_person_returns_the_person_with_roles(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    target = await make_user(session, "scout-person")
    await grant_role(session, target, "reviewer")
    sign_in(app_of(api), user, "role.assign")
    answer = await api.get(f"/people/{target.id}")
    assert answer.status_code == 200
    body = answer.json()
    assert body["sub"] == "scout-person"
    assert [row["slug"] for row in body["roles"]] == ["reviewer"]


async def test_delete_person_removes_a_non_admin_account(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    admin = await make_user(session, "admin-person")
    await grant_role(session, admin, "admin")
    target = await make_user(session, "scout-person")
    sign_in(app_of(api), admin, "role.assign")
    answer = await api.delete(f"/people/{target.id}")
    assert answer.status_code == 204
    left = (await session.execute(select(User).where(User.id == target.id))).scalar_one_or_none()
    assert left is None


async def test_delete_person_refuses_to_drop_the_last_admin(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    admin = await make_user(session, "admin-person")
    await grant_role(session, admin, "admin")
    sign_in(app_of(api), admin, "role.assign")
    answer = await api.delete(f"/people/{admin.id}")
    assert answer.status_code == 409
    assert answer.json()["code"] == "last_admin"


async def test_set_person_roles_refuses_an_unknown_role(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    admin = await make_user(session, "admin-person")
    await grant_role(session, admin, "admin")
    target = await make_user(session, "scout-person")
    sign_in(app_of(api), admin, "role.assign")
    answer = await api.put(f"/people/{target.id}/roles", json={"roleIds": [str(uuid.uuid4())]})
    assert answer.status_code == 404


async def test_set_person_roles_refuses_to_drop_the_last_admin(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    admin = await make_user(session, "admin-person")
    await grant_role(session, admin, "admin")
    sign_in(app_of(api), admin, "role.assign")
    answer = await api.put(f"/people/{admin.id}/roles", json={"roleIds": []})
    assert answer.status_code == 409
    assert answer.json()["code"] == "last_admin"


async def test_set_person_roles_replaces_them(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    admin = await make_user(session, "admin-person")
    await grant_role(session, admin, "admin")
    scout = await new_role(session, "scout")
    target = await make_user(session, "scout-person")
    sign_in(app_of(api), admin, "role.assign")
    answer = await api.put(f"/people/{target.id}/roles", json={"roleIds": [str(scout.id)]})
    assert answer.status_code == 200
    assert [row["slug"] for row in answer.json()["roles"]] == ["scout"]


async def test_guard_last_admin_allows_a_second_admin_to_lose_the_role(
    api: httpx.AsyncClient,  # noqa: ARG001
    session: AsyncSession,
) -> None:
    first = await make_user(session, "first-admin")
    second = await make_user(session, "second-admin")
    await grant_role(session, first, "admin")
    await grant_role(session, second, "admin")
    service = AccessService(session)
    await service.guard_last_admin(second, [])


async def test_guard_last_admin_blocks_the_only_admin(
    api: httpx.AsyncClient,  # noqa: ARG001
    session: AsyncSession,
) -> None:
    only = await make_user(session, "only-admin")
    await grant_role(session, only, "admin")
    service = AccessService(session)
    with pytest.raises(Conflict):
        await service.guard_last_admin(only, [])


async def test_guard_last_admin_is_a_no_op_without_an_admin_role(
    api: httpx.AsyncClient,  # noqa: ARG001
    session: AsyncSession,
) -> None:
    admin_role = (await session.execute(select(Role).where(Role.slug == "admin"))).scalar_one()
    await session.delete(admin_role)
    await session.commit()
    someone = await make_user(session, "someone")
    await AccessService(session).guard_last_admin(someone, [])


async def test_summary_counts_only_what_the_viewer_may_see(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, "person-summary")
    session.add(Photo(owner_id=user.id, width=10, height=10, photographer="F", licence=Licence.OWN))
    session.add(
        Photo(
            owner_id=user.id,
            width=10,
            height=10,
            photographer="F",
            licence=Licence.OWN,
            state=PhotoState.SUBMITTED,
        )
    )
    await session.commit()

    sign_in(app_of(api), user, "image.review")
    answer = await api.get("/admin/summary")
    assert answer.status_code == 200
    assert answer.json() == {"photos": 2, "photosPending": 1}


async def test_summary_counts_roles_and_people(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, "person-counts")
    sign_in(app_of(api), user, "role.manage", "role.assign")
    body = (await api.get("/admin/summary")).json()
    assert body["people"] == 1
    assert body["roles"] == len((await session.execute(select(Role))).scalars().all())
    assert body["permissions"] == len(PERMISSIONS)


async def test_summary_counts_finds_and_runs(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session, "person-runs")
    session.add(Find(owner_id=user.id, lat=1.0, lon=1.0, found_on=date(2026, 9, 1)))
    session.add(
        Find(
            owner_id=user.id,
            lat=1.0,
            lon=1.0,
            found_on=date(2026, 9, 2),
            review_state=ReviewState.ACCEPTED,
        )
    )
    session.add(PipelineRun(kind=RunKind.TRAINING, state=RunState.RUNNING))
    session.add(PipelineRun(kind=RunKind.RENDER, state=RunState.FINISHED))
    await session.commit()

    sign_in(app_of(api), user, "find.review", "run.manage")
    body = (await api.get("/admin/summary")).json()
    assert body["finds"] == 2
    assert body["findsPending"] == 1
    assert body["runs"] == 2
    assert body["runsRunning"] == 1


async def test_summary_needs_at_least_one_right(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, "person-plain")
    sign_in(app_of(api), user)
    assert (await api.get("/admin/summary")).status_code == 403
    sign_out(app_of(api))
    assert (await api.get("/admin/summary")).status_code == 401


async def test_species_counts_need_the_right_to_edit_species(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session, "person-arten")
    sign_in(app_of(api), user)
    assert (await api.get("/admin/species-counts")).status_code == 403

    sign_in(app_of(api), user, "species.edit")
    answer = await api.get("/admin/species-counts")
    assert answer.status_code == 200
    assert answer.json() == {"items": []}
