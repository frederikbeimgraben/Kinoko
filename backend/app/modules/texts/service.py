"""Der Textkatalog: Vorgabe aus der Datei, Änderungen in der Tabelle."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import TYPE_CHECKING, Any, Final

from sqlalchemy import select

from app.core.errors import NotFound, set_titles
from app.models import TextEntry, now
from app.shared.enums import Area

if TYPE_CHECKING:
    from collections.abc import Mapping, Sequence
    from uuid import UUID

    from sqlalchemy.ext.asyncio import AsyncSession

SOURCE: Final = Path(__file__).resolve().parents[3] / "daten" / "texte.json"
ERROR_PREFIX: Final = "error."
DEFAULT_LOCALE: Final = "de"
AREA: Final = Area.INTERFACE


def defaults() -> dict[str, dict[str, str]]:
    """Liest die Vorgabe aus ``daten/texte.json``."""
    if not SOURCE.is_file():
        return {}
    raw: dict[str, dict[str, str]] = json.loads(SOURCE.read_text(encoding="utf-8"))
    return raw


async def sync(db: AsyncSession) -> int:
    """Schreibt fehlende Schlüssel nach. Geänderte Texte bleiben stehen."""
    known = {(row.key, row.locale) for row in (await db.execute(select(TextEntry))).scalars()}
    added = 0
    for locale, entries in defaults().items():
        for key, value in entries.items():
            if (key, locale) in known:
                continue
            db.add(TextEntry(key=key, locale=locale, value=value, changed=False))
            added += 1
    if added:
        await db.commit()
    return added


async def load_titles(db: AsyncSession) -> None:
    """Füllt die Titel der Fehler aus dem Katalog."""
    query = select(TextEntry).where(
        TextEntry.locale == DEFAULT_LOCALE,
        TextEntry.key.startswith(ERROR_PREFIX),
    )
    set_titles({row.key: row.value for row in (await db.execute(query)).scalars()})


async def entries(db: AsyncSession) -> Sequence[TextEntry]:
    """Liest alle Texte, nach Schlüssel geordnet."""
    query = select(TextEntry).order_by(TextEntry.key, TextEntry.locale)
    return list((await db.execute(query)).scalars())


def revision(rows: Sequence[TextEntry]) -> str:
    """Ein Fingerabdruck über den Bestand, für ETag und Abgleich."""
    stamp = max((row.updated_at for row in rows), default=None)
    raw = f"{len(rows)}:{stamp.isoformat() if stamp else ''}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def catalogue(rows: Sequence[TextEntry]) -> dict[str, Any]:
    """Baut den Katalog in der Form des Vertrags."""
    values: dict[str, dict[str, str]] = {}
    changed: dict[str, bool] = {}
    stamps: dict[str, str] = {}
    for row in rows:
        values.setdefault(row.key, {})[row.locale] = row.value
        changed[row.key] = changed.get(row.key, False) or row.changed
        stamps[row.key] = max(stamps.get(row.key, ""), row.updated_at.isoformat())
    return {
        "revision": revision(rows),
        "locales": sorted({row.locale for row in rows}),
        "entries": [
            {
                "key": key,
                "values": values[key],
                "changed": changed[key],
                "updatedAt": stamps[key],
            }
            for key in sorted(values)
        ],
    }


def entry_of(rows: Sequence[TextEntry], key: str) -> dict[str, Any]:
    """Baut einen Eintrag des Katalogs."""
    mine = [row for row in rows if row.key == key]
    if not mine:
        raise NotFound
    return {
        "key": key,
        "values": {row.locale: row.value for row in mine},
        "changed": any(row.changed for row in mine),
        "updatedAt": max(row.updated_at for row in mine).isoformat(),
    }


async def change(
    db: AsyncSession,
    key: str,
    locale: str,
    value: str,
    user_id: UUID,
) -> dict[str, Any]:
    """Setzt einen Text. Ein neuer Schlüssel entsteht hier nicht."""
    rows = await entries(db)
    if not any(row.key == key for row in rows):
        raise NotFound
    found = next((row for row in rows if row.key == key and row.locale == locale), None)
    if found is None:
        found = TextEntry(key=key, locale=locale, value=value)
        db.add(found)
    found.value = value
    found.changed = True
    found.updated_at = now()
    found.updated_by_id = user_id
    await db.commit()
    return entry_of(await entries(db), key)


async def reset(db: AsyncSession, key: str, locale: str) -> None:
    """Setzt einen Text auf die Vorgabe zurück."""
    query = select(TextEntry).where(TextEntry.key == key, TextEntry.locale == locale)
    found = (await db.execute(query)).scalars().first()
    if found is None:
        raise NotFound
    fallback = defaults().get(locale, {}).get(key)
    if fallback is None:
        await db.delete(found)
    else:
        found.value = fallback
        found.changed = False
        found.updated_at = now()
    await db.commit()


def fingerprint(catalogue_body: Mapping[str, Any]) -> str:
    """Der ETag zum Katalog."""
    return f'W/"{catalogue_body["revision"]}"'
