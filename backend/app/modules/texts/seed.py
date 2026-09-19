"""Die Vorgabe der Oberflächentexte aus ``daten/texte.json``."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, ClassVar

from sqlalchemy import select

from app.models import TextEntry, now

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class SeedReport:
    """Was ein Abgleich an der Tabelle getan hat."""

    added: int = 0
    updated: int = 0
    removed: int = 0

    @property
    def touched(self) -> int:
        """Die Zahl aller Zeilen, die der Abgleich angefasst hat."""
        return self.added + self.updated + self.removed


class TextSeed:
    """Gleicht die Tabelle mit der Vorgabe ab. Eine Handänderung bleibt."""

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

    async def sync(self, db: AsyncSession) -> SeedReport:
        """Schreibt die Vorgabe in die Tabelle und meldet, was sie tat."""
        rows = {
            (row.key, row.locale): row for row in (await db.execute(select(TextEntry))).scalars()
        }
        defaults = self.defaults()
        added, updated = self._write(db, rows, defaults)
        removed = await self._sweep(db, rows, defaults)
        report = SeedReport(added, updated, removed)
        if report.touched:
            await db.commit()
        return report

    def _write(
        self,
        db: AsyncSession,
        rows: dict[tuple[str, str], TextEntry],
        defaults: dict[str, dict[str, str]],
    ) -> tuple[int, int]:
        """Legt fehlende Zeilen an und zieht unberührte Zeilen nach."""
        added = 0
        updated = 0
        for locale, entries in defaults.items():
            for key, value in entries.items():
                found = rows.get((key, locale))
                if found is None:
                    db.add(TextEntry(key=key, locale=locale, value=value))
                    added += 1
                elif found.updated_by_id is None and found.value != value:
                    found.value = value
                    found.updated_at = now()
                    updated += 1
        return added, updated

    async def _sweep(
        self,
        db: AsyncSession,
        rows: dict[tuple[str, str], TextEntry],
        defaults: dict[str, dict[str, str]],
    ) -> int:
        """Löscht Zeilen ohne Vorgabe. Eine Handänderung bleibt stehen."""
        removed = 0
        for (key, locale), row in rows.items():
            if key in defaults.get(locale, {}) or row.updated_by_id is not None:
                continue
            await db.delete(row)
            removed += 1
        return removed
