"""Die Vorgabe der Oberflächentexte aus ``daten/texte.json``."""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING, ClassVar

from sqlalchemy import select

from app.models import TextEntry

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


class TextSeed:
    """Trägt fehlende Schlüssel nach. Ein geänderter Text bleibt stehen."""

    SOURCE: ClassVar[Path] = Path(__file__).resolve().parents[3] / "daten" / "texte.json"

    def defaults(self) -> dict[str, dict[str, str]]:
        """Die Vorgabe je Sprache. Ohne Datei bleibt der Katalog leer."""
        if not self.SOURCE.is_file():
            return {}
        raw: dict[str, dict[str, str]] = json.loads(self.SOURCE.read_text(encoding="utf-8"))
        return raw

    def value_of(self, key: str, locale: str) -> str | None:
        """Der vorgegebene Text zu einem Schlüssel."""
        return self.defaults().get(locale, {}).get(key)

    async def sync(self, db: AsyncSession) -> int:
        """Schreibt die fehlenden Schlüssel und meldet ihre Zahl."""
        known = {(row.key, row.locale) for row in (await db.execute(select(TextEntry))).scalars()}
        added = 0
        for locale, entries in self.defaults().items():
            for key, value in entries.items():
                if (key, locale) in known:
                    continue
                db.add(TextEntry(key=key, locale=locale, value=value))
                added += 1
        if added:
            await db.commit()
        return added
