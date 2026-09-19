"""Tests des Moduls photos."""

from __future__ import annotations

import io
import uuid
from datetime import UTC, date, datetime
from typing import TYPE_CHECKING

import pytest
from PIL import Image

from app.core.auth import Viewer
from app.core.errors import Conflict
from app.core.settings import get_settings
from app.models import Find, Photo, Species
from app.modules.photos import service, uploads
from app.modules.photos.repository import PhotoRepository
from app.shared.enums import Edibility, Group, Licence, PhotoState, Protection
from app.shared.paging import Paging
from tests.conftest import app_of, make_user, sign_in, sign_out

if TYPE_CHECKING:
    import httpx
    from sqlalchemy.ext.asyncio import AsyncSession

JPEG = "image/jpeg"


def image_bytes(size: tuple[int, int] = (40, 40)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, (120, 60, 10)).save(buffer, format="JPEG")
    return buffer.getvalue()


async def make_species(
    session: AsyncSession,
    *,
    protection: Protection = Protection.NONE,
    slug: str = "boletus-edulis",
) -> Species:
    made = Species(
        slug=slug,
        name=slug,
        latin_name=slug,
        group_key=Group.BOLETE,
        edibility=Edibility.EDIBLE,
        protection=protection,
    )
    session.add(made)
    await session.commit()
    await session.refresh(made)
    return made


async def make_find(
    session: AsyncSession,
    user: object,
    *,
    species_id: uuid.UUID | None = None,
    lat: float = 52.523,
    lon: float = 13.411,
) -> Find:
    made = Find(
        owner_id=user.id,  # type: ignore[attr-defined]
        species_id=species_id,
        lat=lat,
        lon=lon,
        found_on=date(2026, 9, 1),
    )
    session.add(made)
    await session.commit()
    await session.refresh(made)
    return made


def form(**overrides: str) -> dict[str, str]:
    base = {"photographer": "Frederik", "licence": Licence.OWN.value}
    base.update(overrides)
    return base


async def upload(client: httpx.AsyncClient, **overrides: str) -> httpx.Response:
    return await client.post(
        "/photos",
        data=form(**overrides),
        files={"file": ("photo.jpg", image_bytes(), JPEG)},
    )


async def test_create_private_photo_without_context(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    response = await upload(api)
    assert response.status_code == 201
    body = response.json()
    assert body["state"] == PhotoState.PRIVATE.value
    assert body["speciesId"] is None
    assert body["findId"] is None
    assert body["lat"] is None


async def test_create_keeps_source_and_names_the_uploader(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    response = await upload(api, source="123pilzsuche.de")
    assert response.status_code == 201
    body = response.json()
    assert body["source"] == "123pilzsuche.de"
    assert body["ownerName"] == user.name


async def test_photo_without_owner_name_falls_back_to_photographer(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    user.name = None
    await session.commit()
    sign_in(app_of(api), user, "image.submit")
    response = await upload(api)
    assert response.json()["ownerName"] == "Frederik"


async def test_create_requires_signed_in_account(api: httpx.AsyncClient) -> None:
    response = await upload(api)
    assert response.status_code == 401


async def test_create_requires_image_submit_right(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user)
    response = await upload(api)
    assert response.status_code == 403


async def test_create_requires_photographer_and_licence(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    response = await api.post("/photos", data={}, files={"file": ("a.jpg", image_bytes(), JPEG)})
    assert response.status_code == 422


async def test_create_rejects_wrong_media_type(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    response = await api.post(
        "/photos",
        data=form(),
        files={"file": ("a.txt", b"not-an-image", "text/plain")},
    )
    assert response.status_code == 422


async def test_create_rejects_too_large_body(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    get_settings().max_photo_bytes = 10
    response = await upload(api)
    assert response.status_code == 413


async def test_create_accepts_caption_and_taken_on(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    response = await upload(api, caption="Fund im Wald", takenOn="2026-09-01")
    body = response.json()
    assert body["caption"] == "Fund im Wald"
    assert body["takenOn"] == "2026-09-01"


async def test_create_attach_to_own_find_rounds_protected_location(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    species = await make_species(session, protection=Protection.STRICT)
    find = await make_find(session, user, species_id=species.id)
    sign_in(app_of(api), user, "image.submit")
    response = await upload(api, findId=str(find.id))
    assert response.status_code == 201
    body = response.json()
    assert body["state"] == PhotoState.PRIVATE.value
    assert body["findId"] == str(find.id)
    assert body["lat"] is not None
    assert body["lat"] != find.lat


async def test_create_attach_to_unprotected_species_has_no_location(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    species = await make_species(session, protection=Protection.NONE, slug="agaricus-bisporus")
    find = await make_find(session, user, species_id=species.id)
    sign_in(app_of(api), user, "image.submit")
    response = await upload(api, findId=str(find.id))
    body = response.json()
    assert body["lat"] is None
    assert body["lon"] is None


async def test_create_attach_to_find_without_species_has_no_location(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    find = await make_find(session, user)
    sign_in(app_of(api), user, "image.submit")
    response = await upload(api, findId=str(find.id))
    body = response.json()
    assert body["lat"] is None
    assert body["lon"] is None


async def test_create_attach_to_foreign_find_is_not_found(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session, sub="owner")
    other = await make_user(session, sub="other")
    find = await make_find(session, owner)
    sign_in(app_of(api), other, "image.submit")
    response = await upload(api, findId=str(find.id))
    assert response.status_code == 404


async def test_create_submit_to_species(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), user, "image.submit")
    response = await upload(api, speciesId=str(species.id))
    assert response.status_code == 201
    body = response.json()
    assert body["state"] == PhotoState.SUBMITTED.value
    assert body["speciesId"] == str(species.id)
    assert body["lat"] is None


async def test_create_submit_to_unknown_species_is_not_found(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    response = await upload(api, speciesId=str(uuid.uuid4()))
    assert response.status_code == 404


async def test_approval_sets_state_and_reviewer(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session, sub="owner")
    reviewer = await make_user(session, sub="reviewer")
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    sign_in(app_of(api), reviewer, "image.review")
    response = await api.post(f"/photos/{created['id']}/approval")
    assert response.status_code == 200
    body = response.json()
    assert body["state"] == PhotoState.APPROVED.value
    assert body["reviewedById"] == str(reviewer.id)


async def test_approval_without_right_is_forbidden(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), user, "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    response = await api.post(f"/photos/{created['id']}/approval")
    assert response.status_code == 403


async def test_rejection_requires_reason(api: httpx.AsyncClient, session: AsyncSession) -> None:
    owner = await make_user(session, sub="owner")
    reviewer = await make_user(session, sub="reviewer")
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    sign_in(app_of(api), reviewer, "image.review")
    response = await api.post(f"/photos/{created['id']}/rejection", json={"reason": ""})
    assert response.status_code == 422


async def test_rejection_and_resubmission_reuses_same_photo(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    owner = await make_user(session, sub="owner")
    reviewer = await make_user(session, sub="reviewer")
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    sign_in(app_of(api), reviewer, "image.review")
    rejected = await api.post(f"/photos/{created['id']}/rejection", json={"reason": "unscharf"})
    assert rejected.status_code == 200
    assert rejected.json()["state"] == PhotoState.REJECTED.value
    sign_in(app_of(api), owner, "image.submit")
    resubmitted = (await upload(api, speciesId=str(species.id))).json()
    assert resubmitted["id"] == created["id"]
    assert resubmitted["state"] == PhotoState.SUBMITTED.value
    assert resubmitted["rejectReason"] is None


async def test_resubmit_service_resets_state(session: AsyncSession) -> None:
    user = await make_user(session)
    species = await make_species(session)
    photo = Photo(
        owner_id=user.id,
        species_id=species.id,
        width=10,
        height=10,
        photographer="x",
        licence=Licence.OWN,
        state=PhotoState.REJECTED,
        reject_reason="nope",
    )
    session.add(photo)
    await session.commit()
    updated = await uploads.resubmit(session, photo, user)
    assert updated.state == PhotoState.SUBMITTED
    assert updated.reject_reason is None


async def test_resubmit_rejects_wrong_state(session: AsyncSession) -> None:
    user = await make_user(session)
    photo = Photo(
        owner_id=user.id,
        width=1,
        height=1,
        photographer="x",
        licence=Licence.OWN,
        state=PhotoState.PRIVATE,
    )
    session.add(photo)
    await session.commit()
    with pytest.raises(Conflict):
        await uploads.resubmit(session, photo, user)


async def test_set_lead_replaces_previous(api: httpx.AsyncClient, session: AsyncSession) -> None:
    owner = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    first = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{first['id']}/approval")
    second = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{second['id']}/approval")
    lead1 = await api.put(f"/photos/{first['id']}/lead")
    assert lead1.status_code == 200
    assert lead1.json()["lead"] is True
    lead2 = await api.put(f"/photos/{second['id']}/lead")
    assert lead2.json()["lead"] is True
    refreshed_first = await api.get(f"/photos/{first['id']}")
    assert refreshed_first.json()["lead"] is False


async def test_set_lead_requires_approved_state(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), user, "image.review", "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    response = await api.put(f"/photos/{created['id']}/lead")
    assert response.status_code == 409


async def test_set_lead_forbidden_for_non_owner(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session, sub="owner")
    stranger = await make_user(session, sub="stranger")
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{created['id']}/approval")
    sign_in(app_of(api), stranger)
    response = await api.put(f"/photos/{created['id']}/lead")
    assert response.status_code == 403


async def test_set_lead_forbidden_for_owner_without_review_right(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{created['id']}/approval")
    sign_in(app_of(api), owner)
    response = await api.put(f"/photos/{created['id']}/lead")
    assert response.status_code == 403


async def _bundle_lead_photo_id(api: httpx.AsyncClient, species: Species) -> str | None:
    response = await api.get("/species/bundle")
    item = next(row for row in response.json()["items"] if row["slug"] == species.slug)
    return item["leadPhotoId"]


async def test_approval_becomes_lead_photo_without_explicit_call(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    approved = await api.post(f"/photos/{created['id']}/approval")
    assert approved.json()["lead"] is True
    assert await _bundle_lead_photo_id(api, species) == created["id"]


async def test_approval_keeps_the_first_lead_photo(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    first = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{first['id']}/approval")
    second = (await upload(api, speciesId=str(species.id))).json()
    approved_second = await api.post(f"/photos/{second['id']}/approval")
    assert approved_second.json()["lead"] is False
    assert await _bundle_lead_photo_id(api, species) == first["id"]


async def test_explicit_lead_wins_over_first_approved_photo(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    first = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{first['id']}/approval")
    second = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{second['id']}/approval")
    await api.put(f"/photos/{second['id']}/lead")
    assert await _bundle_lead_photo_id(api, species) == second["id"]


async def test_rejected_photo_never_becomes_lead_photo(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{created['id']}/rejection", json={"reason": "unscharf"})
    assert await _bundle_lead_photo_id(api, species) is None


async def test_deleting_lead_photo_falls_back_to_remaining_approved_photo(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    first = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{first['id']}/approval")
    second = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{second['id']}/approval")
    await api.delete(f"/photos/{first['id']}")
    assert await _bundle_lead_photo_id(api, species) == second["id"]


async def test_list_without_sign_in_shows_only_approved_species_photos(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    owner = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    approved = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{approved['id']}/approval")
    private = (await upload(api)).json()
    sign_out(app_of(api))
    response = await api.get("/photos")
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert approved["id"] in ids
    assert private["id"] not in ids


async def test_list_mine_requires_sign_in(api: httpx.AsyncClient) -> None:
    response = await api.get("/photos", params={"mine": "true"})
    assert response.status_code == 401


async def test_list_mine_returns_own(api: httpx.AsyncClient, session: AsyncSession) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    created = (await upload(api)).json()
    response = await api.get("/photos", params={"mine": "true"})
    ids = {item["id"] for item in response.json()["items"]}
    assert created["id"] in ids


async def test_list_submitted_without_review_right_shows_only_own(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    owner = await make_user(session, sub="owner")
    other = await make_user(session, sub="other")
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.submit")
    mine = (await upload(api, speciesId=str(species.id))).json()
    sign_in(app_of(api), other, "image.submit")
    theirs = (await upload(api, speciesId=str(species.id))).json()
    response = await api.get("/photos", params={"state": "submitted"})
    ids = {item["id"] for item in response.json()["items"]}
    assert theirs["id"] in ids
    assert mine["id"] not in ids


async def test_get_photo_not_found_for_invisible(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session, sub="owner")
    stranger = await make_user(session, sub="stranger")
    sign_in(app_of(api), owner, "image.submit")
    created = (await upload(api)).json()
    sign_in(app_of(api), stranger)
    response = await api.get(f"/photos/{created['id']}")
    assert response.status_code == 404


async def test_get_photo_unknown_id_is_not_found(api: httpx.AsyncClient) -> None:
    response = await api.get(f"/photos/{uuid.uuid4()}")
    assert response.status_code == 404


async def test_photo_file_returns_jpeg_with_cache_header(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    created = (await upload(api)).json()
    response = await api.get(f"/photos/{created['id']}/thumb")
    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert response.content[:2] == b"\xff\xd8"


async def test_photo_file_missing_on_disk_is_not_found(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    created = (await upload(api)).json()
    folder = get_settings().photos / created["id"]
    for file in folder.iterdir():
        file.unlink()
    response = await api.get(f"/photos/{created['id']}/thumb")
    assert response.status_code == 404


async def test_delete_by_owner_removes_row_and_files(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.submit")
    created = (await upload(api)).json()
    folder = get_settings().photos / created["id"]
    assert folder.is_dir()
    response = await api.delete(f"/photos/{created['id']}")
    assert response.status_code == 204
    assert not folder.is_dir()
    assert (await api.get(f"/photos/{created['id']}")).status_code == 404


async def test_delete_private_by_stranger_is_not_found(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session, sub="owner")
    stranger = await make_user(session, sub="stranger")
    sign_in(app_of(api), owner, "image.submit")
    created = (await upload(api)).json()
    sign_in(app_of(api), stranger)
    response = await api.delete(f"/photos/{created['id']}")
    assert response.status_code == 404


async def test_delete_public_photo_by_non_owner_is_forbidden(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    owner = await make_user(session, sub="owner")
    stranger = await make_user(session, sub="stranger")
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{created['id']}/approval")
    sign_in(app_of(api), stranger)
    response = await api.delete(f"/photos/{created['id']}")
    assert response.status_code == 403


async def test_delete_by_reviewer_allowed_for_others_photo(
    api: httpx.AsyncClient,
    session: AsyncSession,
) -> None:
    owner = await make_user(session, sub="owner")
    reviewer = await make_user(session, sub="reviewer")
    sign_in(app_of(api), owner, "image.submit")
    created = (await upload(api)).json()
    sign_in(app_of(api), reviewer, "image.review")
    response = await api.delete(f"/photos/{created['id']}")
    assert response.status_code == 204


async def test_visible_public_approved_species_photo() -> None:
    photo = Photo(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        species_id=uuid.uuid4(),
        state=PhotoState.APPROVED,
        width=1,
        height=1,
        photographer="x",
        licence=Licence.OWN,
    )
    anonymous = Viewer(None, frozenset())
    assert service.visible(photo, anonymous) is True


async def test_visible_find_photo_for_find_reviewer(session: AsyncSession) -> None:
    owner = await make_user(session, sub="owner")
    reviewer = await make_user(session, sub="reviewer")
    find = await make_find(session, owner)
    photo = Photo(
        id=uuid.uuid4(),
        owner_id=owner.id,
        find_id=find.id,
        state=PhotoState.PRIVATE,
        width=1,
        height=1,
        photographer="x",
        licence=Licence.OWN,
    )
    viewer = Viewer(reviewer, frozenset({"find.review"}))
    assert service.visible(photo, viewer) is True


async def test_invisible_find_photo_without_find_review(session: AsyncSession) -> None:
    owner = await make_user(session, sub="owner")
    stranger = await make_user(session, sub="stranger")
    find = await make_find(session, owner)
    photo = Photo(
        id=uuid.uuid4(),
        owner_id=owner.id,
        find_id=find.id,
        state=PhotoState.PRIVATE,
        width=1,
        height=1,
        photographer="x",
        licence=Licence.OWN,
    )
    viewer = Viewer(stranger, frozenset())
    assert service.visible(photo, viewer) is False


async def test_repository_leads_maps_species_to_lead_photo(session: AsyncSession) -> None:
    user = await make_user(session)
    species = await make_species(session)
    photo = Photo(
        owner_id=user.id,
        species_id=species.id,
        width=1,
        height=1,
        photographer="x",
        licence=Licence.OWN,
        state=PhotoState.APPROVED,
        lead=True,
    )
    session.add(photo)
    await session.commit()
    repo = PhotoRepository(session)
    leads = await repo.leads([species.id])
    assert leads[species.id] == photo.id
    assert await repo.leads([]) == {}


async def test_repository_leads_falls_back_to_oldest_approved_photo(
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    species = await make_species(session)
    older = Photo(
        owner_id=user.id,
        species_id=species.id,
        width=1,
        height=1,
        photographer="x",
        licence=Licence.OWN,
        state=PhotoState.APPROVED,
        created_at=datetime(2026, 1, 1, tzinfo=UTC),
    )
    newer = Photo(
        owner_id=user.id,
        species_id=species.id,
        width=1,
        height=1,
        photographer="x",
        licence=Licence.OWN,
        state=PhotoState.APPROVED,
        created_at=datetime(2026, 2, 1, tzinfo=UTC),
    )
    session.add_all([older, newer])
    await session.commit()
    repo = PhotoRepository(session)
    leads = await repo.leads([species.id])
    assert leads[species.id] == older.id


async def test_repository_leads_ignores_rejected_photo_with_stale_lead_flag(
    session: AsyncSession,
) -> None:
    user = await make_user(session)
    species = await make_species(session)
    rejected = Photo(
        owner_id=user.id,
        species_id=species.id,
        width=1,
        height=1,
        photographer="x",
        licence=Licence.OWN,
        state=PhotoState.REJECTED,
        lead=True,
    )
    session.add(rejected)
    await session.commit()
    repo = PhotoRepository(session)
    assert await repo.leads([species.id]) == {}


async def test_repository_submissions_returns_state_page(session: AsyncSession) -> None:
    user = await make_user(session)
    species = await make_species(session)
    photo = Photo(
        owner_id=user.id,
        species_id=species.id,
        width=1,
        height=1,
        photographer="x",
        licence=Licence.OWN,
        state=PhotoState.SUBMITTED,
    )
    session.add(photo)
    await session.commit()
    repo = PhotoRepository(session)
    found = await repo.submissions(PhotoState.SUBMITTED, Paging(limit=10, offset=0))
    assert photo.id in {row.id for row in found}


async def test_set_lead_unknown_photo_is_not_found(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    sign_in(app_of(api), user, "image.review")
    response = await api.put(f"/photos/{uuid.uuid4()}/lead")
    assert response.status_code == 404


async def test_set_lead_requires_sign_in(api: httpx.AsyncClient, session: AsyncSession) -> None:
    owner = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{created['id']}/approval")
    sign_out(app_of(api))
    response = await api.put(f"/photos/{created['id']}/lead")
    assert response.status_code == 401


async def test_delete_requires_sign_in(api: httpx.AsyncClient, session: AsyncSession) -> None:
    owner = await make_user(session)
    species = await make_species(session)
    sign_in(app_of(api), owner, "image.review", "image.submit")
    created = (await upload(api, speciesId=str(species.id))).json()
    await api.post(f"/photos/{created['id']}/approval")
    sign_out(app_of(api))
    response = await api.delete(f"/photos/{created['id']}")
    assert response.status_code == 401


async def test_list_reviewer_sees_all_without_mine(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session, sub="owner")
    reviewer = await make_user(session, sub="reviewer")
    sign_in(app_of(api), owner, "image.submit")
    private = (await upload(api)).json()
    sign_in(app_of(api), reviewer, "image.review")
    response = await api.get("/photos")
    ids = {item["id"] for item in response.json()["items"]}
    assert private["id"] in ids


async def test_list_filters_by_species_and_find(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    user = await make_user(session)
    species_a = await make_species(session, slug="species-a")
    species_b = await make_species(session, slug="species-b")
    find = await make_find(session, user, species_id=species_a.id)
    sign_in(app_of(api), user, "image.review", "image.submit")
    at_find = (await upload(api, findId=str(find.id))).json()
    at_species_a = (await upload(api, speciesId=str(species_a.id))).json()
    at_species_b = (await upload(api, speciesId=str(species_b.id))).json()
    by_species = await api.get("/photos", params={"speciesId": str(species_a.id)})
    species_ids = {item["id"] for item in by_species.json()["items"]}
    assert species_ids == {at_species_a["id"]}
    by_find = await api.get("/photos", params={"findId": str(find.id)})
    find_ids = {item["id"] for item in by_find.json()["items"]}
    assert find_ids == {at_find["id"]}
    assert at_species_b["id"] not in find_ids


async def test_list_by_find_visible_with_find_review_only(
    api: httpx.AsyncClient, session: AsyncSession
) -> None:
    owner = await make_user(session, sub="owner")
    reviewer = await make_user(session, sub="reviewer")
    find = await make_find(session, owner)
    sign_in(app_of(api), owner, "image.submit")
    at_find = (await upload(api, findId=str(find.id))).json()
    private = (await upload(api)).json()
    sign_in(app_of(api), reviewer, "find.review")
    response = await api.get("/photos", params={"findId": str(find.id)})
    assert response.status_code == 200
    ids = {item["id"] for item in response.json()["items"]}
    assert ids == {at_find["id"]}
    assert private["id"] not in ids


async def test_get_photo_by_find_review_only(api: httpx.AsyncClient, session: AsyncSession) -> None:
    owner = await make_user(session, sub="owner")
    reviewer = await make_user(session, sub="reviewer")
    find = await make_find(session, owner)
    sign_in(app_of(api), owner, "image.submit")
    at_find = (await upload(api, findId=str(find.id))).json()
    sign_in(app_of(api), reviewer, "find.review")
    response = await api.get(f"/photos/{at_find['id']}")
    assert response.status_code == 200
