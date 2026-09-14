"""Der Textkatalog: Vorgabe aus der Datei, Änderungen in der Tabelle."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final

from sqlalchemy import select

from app.core.errors import NotFound, set_titles
from app.models import TextEntry, now
from app.modules.texts.seed import TextSeed

if TYPE_CHECKING:
    from collections.abc import Sequence
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

ERROR_PREFIX: Final = "error."
DEFAULT_LOCALE: Final = "de"


@dataclass(frozen=True)
class Snapshot:
    """Der Katalog mit seinem ETag. Zum bekannten ETag bleibt ``body`` leer."""

    etag: str
    body: dict[str, Any] | None


class TextService:
    """Liest und schreibt die Texte der Oberfläche."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.seed = TextSeed()

    async def catalogue(self, etag: str | None = None) -> Snapshot:
        """Der ganze Bestand mit seinem ETag."""
        body = self.body_of(await self.entries())
        tag = f'W/"{body["revision"]}"'
        return Snapshot(tag, None if etag == tag else body)

    async def change(self, key: str, locale: str, value: str, user_id: UUID) -> dict[str, Any]:
        """Setzt einen Text. Ein neuer Schlüssel entsteht hier nicht."""
        rows = await self.entries()
        if not any(row.key == key for row in rows):
            raise NotFound
        found = next((row for row in rows if row.key == key and row.locale == locale), None)
        if found is None:
            found = TextEntry(key=key, locale=locale, value=value)
            self.db.add(found)
        found.value = value
        found.updated_at = now()
        found.updated_by_id = user_id
        await self.db.commit()
        return self.entry_of(await self.entries(), key)

    async def reset(self, key: str, locale: str) -> None:
        """Holt die Vorgabe eines Textes zurück."""
        query = select(TextEntry).where(TextEntry.key == key, TextEntry.locale == locale)
        found = (await self.db.execute(query)).scalars().first()
        if found is None:
            raise NotFound
        fallback = self.seed.value_of(key, locale)
        if fallback is None:
            await self.db.delete(found)
        else:
            found.value = fallback
            found.updated_by_id = None
            found.updated_at = now()
        await self.db.commit()

    async def load_titles(self) -> None:
        """Gibt den Fehlern ihre Titel aus dem Katalog."""
        query = select(TextEntry).where(
            TextEntry.locale == DEFAULT_LOCALE,
            TextEntry.key.startswith(ERROR_PREFIX),
        )
        set_titles({row.key: row.value for row in (await self.db.execute(query)).scalars()})

    async def entries(self) -> Sequence[TextEntry]:
        """Alle Texte, nach Schlüssel und Sprache geordnet."""
        query = select(TextEntry).order_by(TextEntry.key, TextEntry.locale)
        return list((await self.db.execute(query)).scalars())

    def body_of(self, rows: Sequence[TextEntry]) -> dict[str, Any]:
        """Der Katalog in der Form des Vertrags."""
        return {
            "revision": self.revision(rows),
            "locales": sorted({row.locale for row in rows}),
            "entries": [self.shape(key, mine) for key, mine in self.by_key(rows).items()],
        }

    def entry_of(self, rows: Sequence[TextEntry], key: str) -> dict[str, Any]:
        """Ein Eintrag des Katalogs, mit allen seinen Sprachen."""
        mine = self.by_key(rows).get(key)
        if not mine:
            raise NotFound
        return self.shape(key, mine)

    def by_key(self, rows: Sequence[TextEntry]) -> dict[str, list[TextEntry]]:
        """Die Zeilen nach Schlüssel, in der Reihenfolge der Abfrage."""
        found: dict[str, list[TextEntry]] = {}
        for row in rows:
            found.setdefault(row.key, []).append(row)
        return found

    def shape(self, key: str, mine: Sequence[TextEntry]) -> dict[str, Any]:
        """Ein Schlüssel mit seinen Sprachen, wie der Vertrag ihn erwartet."""
        return {
            "key": key,
            "values": {row.locale: row.value for row in mine},
            "changed": any(row.updated_by_id is not None for row in mine),
            "updatedAt": max(row.updated_at for row in mine).isoformat(),
        }

    def revision(self, rows: Sequence[TextEntry]) -> str:
        """Ein Fingerabdruck über den Bestand, für ETag und Abgleich."""
        stamp = max((row.updated_at for row in rows), default=None)
        raw = f"{len(rows)}:{stamp.isoformat() if stamp else ''}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]
