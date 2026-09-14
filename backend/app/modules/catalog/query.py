"""Baut die Filterwahl der Artenliste aus den Anfrageparametern."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from app.core.errors import Invalid
from app.modules.catalog.facets import Selection
from app.shared.enums import BodyPart, Dimension

if TYPE_CHECKING:
    from uuid import UUID

    from starlette.datastructures import QueryParams

    from app.shared.enums import CapShape, Edibility, HymeniumType

SIZE_KEY = re.compile(r"^size\[(?P<part>[a-z_]+)\.(?P<dimension>[a-z_]+)\]$")
RANGE = re.compile(r"^([0-9.]*)-([0-9.]*)$")
HEX_COLOUR = re.compile(r"^#[0-9a-f]{6}$")

COLOUR_PARAMS: dict[BodyPart, str] = {
    BodyPart.CAP: "cap",
    BodyPart.STEM: "stem",
    BodyPart.GILLS: "gills",
    BodyPart.FLESH: "flesh",
    BodyPart.SPORE_PRINT: "sporePrint",
    BodyPart.TUBES: "tubes",
    BodyPart.PORES: "pores",
}


def parse_sizes(
    params: QueryParams,
) -> dict[tuple[BodyPart, Dimension], tuple[float | None, float | None]]:
    """Liest ``size[part.dimension]=min-max`` aus den rohen Anfrageparametern."""
    found: dict[tuple[BodyPart, Dimension], tuple[float | None, float | None]] = {}
    for key, value in params.multi_items():
        key_match = SIZE_KEY.match(key)
        if key_match is None:
            continue
        try:
            part = BodyPart(key_match.group("part"))
            dimension = Dimension(key_match.group("dimension"))
        except ValueError as broken:
            raise Invalid(errors=[{"field": key, "code": "size"}]) from broken
        range_match = RANGE.match(value)
        if range_match is None:
            raise Invalid(errors=[{"field": key, "code": "size"}])
        low, high = range_match.groups()
        found[(part, dimension)] = (float(low) if low else None, float(high) if high else None)
    return found


def parse_colours(params: QueryParams) -> dict[BodyPart, str]:
    """Liest ``colour[part]`` aus den rohen Anfrageparametern."""
    found: dict[BodyPart, str] = {}
    for part, key in COLOUR_PARAMS.items():
        query_key = f"colour[{key}]"
        value = params.get(query_key)
        if not value:
            continue
        if not HEX_COLOUR.match(value):
            raise Invalid(errors=[{"field": query_key, "code": "pattern"}])
        found[part] = value
    return found


def build_selection(  # noqa: PLR0913
    *,
    edibility: list[Edibility],
    hymenium: list[HymeniumType],
    cap_shape: list[CapShape],
    terms: list[UUID],
    months: list[int],
    params: QueryParams,
) -> Selection:
    """Baut die Filterwahl aus Achsen und rohen Parametern."""
    return Selection(
        edibility=frozenset(edibility),
        hymenium=frozenset(hymenium),
        cap_shape=frozenset(cap_shape),
        terms=frozenset(terms),
        months=frozenset(months),
        colours=parse_colours(params),
        sizes=parse_sizes(params),
    )
