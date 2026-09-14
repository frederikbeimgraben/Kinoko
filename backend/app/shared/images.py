"""Eine Bildstrecke für jedes Foto: prüfen, Metadaten entfernen, ablegen."""

from __future__ import annotations

import io
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final

from PIL import Image, UnidentifiedImageError

from app.core.errors import Invalid, TooLarge
from app.shared.enums import PhotoSize

if TYPE_CHECKING:
    from collections.abc import Mapping

MEDIA_TYPES: Final = frozenset({"image/jpeg", "image/png", "image/webp"})
SIZES: Final[Mapping[PhotoSize, int]] = {
    PhotoSize.THUMB: 88,
    PhotoSize.LIST: 320,
    PhotoSize.FULL: 1600,
}
QUALITY: Final = 85


@dataclass(frozen=True, slots=True)
class Rendered:
    """Ein Bild in allen Größen, mit seinen Maßen."""

    width: int
    height: int
    files: Mapping[PhotoSize, bytes]


def strip_metadata(image: Image.Image) -> Image.Image:
    """Gibt das Bild ohne EXIF, GPS und Farbprofil zurück."""
    clean = Image.new(image.mode, image.size)
    clean.paste(image)
    return clean


def scaled(image: Image.Image, edge: int) -> bytes:
    """Skaliert auf die längste Kante und schreibt JPEG."""
    copy = image.copy()
    copy.thumbnail((edge, edge))
    buffer = io.BytesIO()
    copy.save(buffer, format="JPEG", quality=QUALITY, optimize=True)
    return buffer.getvalue()


def accept(raw: bytes, media_type: str | None, limit: int) -> Rendered:
    """Prüft und wandelt ein hochgeladenes Bild."""
    if media_type not in MEDIA_TYPES:
        raise Invalid(errors=[{"field": "file", "code": "media_type"}])
    if len(raw) > limit:
        raise TooLarge
    try:
        opened = Image.open(io.BytesIO(raw))
        opened.load()
    except (UnidentifiedImageError, OSError) as broken:
        raise Invalid(errors=[{"field": "file", "code": "image"}]) from broken
    clean = strip_metadata(opened.convert("RGB"))
    return Rendered(
        width=clean.width,
        height=clean.height,
        files={size: scaled(clean, edge) for size, edge in SIZES.items()},
    )


def folder_of(root: Path, photo_id: uuid.UUID) -> Path:
    """Der Ordner eines Fotos."""
    return root / str(photo_id)


def write(root: Path, photo_id: uuid.UUID, rendered: Rendered) -> None:
    """Legt alle Größen eines Fotos ab."""
    folder = folder_of(root, photo_id)
    folder.mkdir(parents=True, exist_ok=True)
    for size, data in rendered.files.items():
        (folder / f"{size.value}.jpg").write_bytes(data)


def read(root: Path, photo_id: uuid.UUID, size: PhotoSize) -> bytes | None:
    """Liest eine Größe eines Fotos, oder nichts."""
    file = folder_of(root, photo_id) / f"{size.value}.jpg"
    return file.read_bytes() if file.is_file() else None


def remove(root: Path, photo_id: uuid.UUID) -> None:
    """Löscht alle Größen eines Fotos."""
    folder = folder_of(root, photo_id)
    if not folder.is_dir():
        return
    for file in folder.iterdir():
        file.unlink()
    folder.rmdir()
