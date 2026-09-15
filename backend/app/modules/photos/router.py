"""Die Endpunkte des Moduls photos."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, File, Form, Path, Query, UploadFile, status
from fastapi.responses import FileResponse

from app.core.auth import CurrentUser, CurrentViewer, Db, requires
from app.core.settings import get_settings
from app.modules.photos import service, uploads
from app.modules.photos.repository import PhotoRepository
from app.modules.photos.schemas import RejectionWrite
from app.shared.enums import Licence, PhotoSize, PhotoState
from app.shared.paging import Page

CACHE_CONTROL = "public, max-age=31536000, immutable"

router = APIRouter(tags=["photos"])


@router.get("/photos")
async def list_photos(  # noqa: PLR0913, PLR0917
    db: Db,
    viewer: CurrentViewer,
    paging: Page,
    state: Annotated[PhotoState | None, Query()] = None,
    species_id: Annotated[uuid.UUID | None, Query(alias="speciesId")] = None,
    find_id: Annotated[uuid.UUID | None, Query(alias="findId")] = None,
    mine: Annotated[bool, Query()] = False,  # noqa: FBT002
) -> Any:  # noqa: ANN401
    """Blättert durch Fotos, nach der Sicht des Aufrufers."""
    repo = PhotoRepository(db)
    return await service.list_photos(db, repo, viewer, paging, state, species_id, find_id, mine)


@router.post("/photos", status_code=status.HTTP_201_CREATED)
async def create_photo(  # noqa: PLR0913, PLR0917
    db: Db,
    user: CurrentUser,
    file: Annotated[UploadFile, File()],
    photographer: Annotated[str, Form(min_length=1, max_length=120)],
    licence: Annotated[Licence, Form()],
    species_id: Annotated[uuid.UUID | None, Form(alias="speciesId")] = None,
    find_id: Annotated[uuid.UUID | None, Form(alias="findId")] = None,
    caption: Annotated[str | None, Form(max_length=200)] = None,
    source: Annotated[str | None, Form(max_length=200)] = None,
    taken_on: Annotated[date | None, Form(alias="takenOn")] = None,
) -> Any:  # noqa: ANN401
    """Nimmt ein Foto an: an einen Fund, an eine Art, oder für sich."""
    arrival = uploads.Arrival(
        raw=await file.read(),
        media_type=file.content_type,
        photographer=photographer,
        licence=licence,
        caption=caption,
        source=source,
        taken_on=taken_on,
        species_id=species_id,
        find_id=find_id,
    )
    photo = await uploads.create(db, get_settings().photos, user, arrival)
    return service.out(photo)


@router.get("/photos/{id}")
async def get_photo(
    db: Db,
    viewer: CurrentViewer,
    photo_id: Annotated[uuid.UUID, Path(alias="id")],
) -> Any:  # noqa: ANN401
    """Liest ein Foto, sofern es für den Aufrufer sichtbar ist."""
    repo = PhotoRepository(db)
    photo = await service.visible_or_404(repo, photo_id, viewer)
    return service.out(photo)


@router.delete("/photos/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_photo(
    db: Db,
    user: CurrentUser,
    viewer: CurrentViewer,
    photo_id: Annotated[uuid.UUID, Path(alias="id")],
) -> None:
    """Löscht ein Foto: die Zeile und seine Dateien."""
    _ = user
    repo = PhotoRepository(db)
    await service.delete(db, get_settings().photos, repo, photo_id, viewer)


@router.get("/photos/{id}/{size}")
async def get_photo_file(
    db: Db,
    viewer: CurrentViewer,
    photo_id: Annotated[uuid.UUID, Path(alias="id")],
    size: PhotoSize,
) -> FileResponse:
    """Liefert eine Größe eines Fotos als JPEG."""
    found = await service.file(PhotoRepository(db), photo_id, viewer, size)
    return FileResponse(
        found,
        media_type="image/jpeg",
        headers={"Cache-Control": CACHE_CONTROL},
    )


@router.post("/photos/{id}/approval", dependencies=[requires("image.review")])
async def approve_photo(
    db: Db,
    user: CurrentUser,
    photo_id: Annotated[uuid.UUID, Path(alias="id")],
) -> Any:  # noqa: ANN401
    """Gibt ein Foto frei."""
    repo = PhotoRepository(db)
    photo = await service.approve(db, repo, photo_id, user)
    return service.out(photo)


@router.post("/photos/{id}/rejection", dependencies=[requires("image.review")])
async def reject_photo(
    db: Db,
    user: CurrentUser,
    photo_id: Annotated[uuid.UUID, Path(alias="id")],
    body: RejectionWrite,
) -> Any:  # noqa: ANN401
    """Lehnt ein Foto ab, mit Grund."""
    repo = PhotoRepository(db)
    photo = await service.reject(db, repo, photo_id, user, body.reason)
    return service.out(photo)


@router.put("/photos/{id}/lead")
async def set_lead_photo(
    db: Db,
    user: CurrentUser,
    viewer: CurrentViewer,
    photo_id: Annotated[uuid.UUID, Path(alias="id")],
) -> Any:  # noqa: ANN401
    """Macht ein Foto zum Titelbild seiner Art."""
    _ = user
    repo = PhotoRepository(db)
    photo = await service.set_lead(db, repo, photo_id, viewer)
    return service.out(photo)
