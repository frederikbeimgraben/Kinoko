"""Blättern mit ``limit`` und ``cursor``, Antwort als ``{items, nextCursor}``."""

from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass
from typing import TYPE_CHECKING, Annotated, Any

from fastapi import Depends, Query
from sqlalchemy import Select, func, select

from app.core.errors import Invalid
from app.shared.schema import Schema

if TYPE_CHECKING:
    from collections.abc import Callable, Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

MAX_LIMIT = 50


@dataclass(frozen=True, slots=True)
class Paging:
    """Eine Seite: wie viele, und ab wo."""

    limit: int
    offset: int


def encode(offset: int) -> str:
    """Macht aus einer Stelle einen undurchsichtigen Zeiger."""
    return base64.urlsafe_b64encode(str(offset).encode()).decode().rstrip("=")


def decode(cursor: str) -> int:
    """Liest die Stelle aus einem Zeiger."""
    padded = cursor + "=" * (-len(cursor) % 4)
    try:
        value = int(base64.urlsafe_b64decode(padded.encode()).decode())
    except (binascii.Error, UnicodeDecodeError, ValueError) as broken:
        raise Invalid(errors=[{"field": "cursor", "code": "cursor"}]) from broken
    if value < 0:
        raise Invalid(errors=[{"field": "cursor", "code": "cursor"}])
    return value


def paging_params(
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = MAX_LIMIT,
    cursor: Annotated[str | None, Query()] = None,
) -> Paging:
    """Dependency: die Seite aus der Abfrage."""
    return Paging(limit=limit, offset=decode(cursor) if cursor else 0)


def small_paging_params(
    limit: Annotated[int, Query(ge=1, le=40)] = 40,
    cursor: Annotated[str | None, Query()] = None,
) -> Paging:
    """Dependency: die Seite der Artenliste, höchstens vierzig Zeilen."""
    return Paging(limit=limit, offset=decode(cursor) if cursor else 0)


Page = Annotated[Paging, Depends(paging_params)]
SmallPage = Annotated[Paging, Depends(small_paging_params)]


async def rows[T](db: AsyncSession, query: Select[tuple[T]], paging: Paging) -> Sequence[T]:
    """Liest eine Seite Zeilen, eine mehr als nötig."""
    found = await db.execute(query.offset(paging.offset).limit(paging.limit + 1))
    return list(found.scalars())


def wrap[T, S: Schema](found: Sequence[T], paging: Paging, out: Callable[[T], S]) -> dict[str, Any]:
    """Baut die Antwort aus einer Seite Zeilen."""
    more = len(found) > paging.limit
    items = list(found[: paging.limit])
    return {
        "items": [out(item).dumped() for item in items],
        "nextCursor": encode(paging.offset + len(items)) if more else None,
    }


async def page[T, S: Schema](
    db: AsyncSession,
    query: Select[tuple[T]],
    paging: Paging,
    out: Callable[[T], S],
) -> dict[str, Any]:
    """Liest eine Seite und gibt sie in der Form des Vertrags ab."""
    return wrap(await rows(db, query, paging), paging, out)


async def count(db: AsyncSession, query: Select[tuple[Any]]) -> int:
    """Zählt die Zeilen einer Abfrage."""
    return (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
