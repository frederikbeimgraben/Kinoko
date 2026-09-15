"""Baut Schemata einer Art aus ihrer Zeile und ihren Kindzeilen."""

from __future__ import annotations

import uuid
from collections import defaultdict
from typing import TYPE_CHECKING

from sqlalchemy import select

from app.models import Term
from app.modules.catalog import lookalikes, part_features
from app.modules.catalog.children import load_children
from app.modules.catalog.colour_view import colour_changes, colour_groups, term_ref
from app.modules.catalog.colours import nearest_colour
from app.modules.catalog.facets import SpeciesFacets
from app.modules.catalog.schemas import (
    Measurement,
    MeasurementGroup,
    SourceEntry,
    Species,
    SpeciesNameEntry,
    SpeciesSummary,
    SpeciesTermEntry,
    Trait,
)
from app.modules.catalog.taxon_names import taxon_names
from app.shared.enums import BodyPart, TermKind

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.models import Species as SpeciesRow
    from app.models import SpeciesMeasurement
    from app.modules.catalog.children import ChildRows


#: Geruch und Geschmack stehen im Filter zusammen.
SENSES = (TermKind.SMELL, TermKind.TASTE)


async def term_lookup(db: AsyncSession) -> dict[uuid.UUID, Term]:
    """Lädt alle Begriffe nach Schlüssel."""
    rows = (await db.execute(select(Term))).scalars()
    return {row.id: row for row in rows}


def build_facets(
    species: SpeciesRow,
    child: ChildRows,
    terms: dict[uuid.UUID, Term] | None = None,
    names: tuple[str, str | None] = ("", None),
) -> SpeciesFacets:
    """Baut die Filterachsen einer Art aus ihren Kindzeilen."""
    colour_map: dict[BodyPart, frozenset[str]] = {}
    part_colours = child.colours.get(species.id, [])
    for row in child.colour_ranges.get(species.id, []):
        keys = {nearest_colour(c.hex).key for c in part_colours if c.part == row.part}
        colour_map[row.part] = frozenset(keys)
    measurements = {
        (m.part, m.dimension): (m.low, m.high) for m in child.measurements.get(species.id, [])
    }
    period = None
    if species.period_start_month is not None and species.period_end_month is not None:
        period = (species.period_start_month, species.period_end_month)
    term_ids = frozenset(t.term_id for t in child.terms.get(species.id, []))
    cap_shapes = frozenset(
        s for s in (species.cap_shape_young, species.cap_shape_old) if s is not None
    )
    held = [terms[i] for i in term_ids if terms and i in terms]
    return SpeciesFacets(
        species_id=species.id,
        edibility=species.edibility,
        hymenium=species.hymenium_type,
        cap_shapes=cap_shapes,
        colours=colour_map,
        measurements=measurements,
        period=period,
        term_ids=term_ids,
        protection=species.protection,
        forecast_enabled=species.forecast_enabled,
        genus_name=names[0],
        family_name=names[1],
        senses=frozenset(t.slug for t in held if t.kind in SENSES),
        trees=frozenset(t.slug for t in held if t.kind == TermKind.TREE),
    )


def summary_of(
    species: SpeciesRow,
    lead_photo_id: uuid.UUID | None,
    names: tuple[str, str | None] = ("", None),
) -> SpeciesSummary:
    """Baut die Kurzform einer Art."""
    return SpeciesSummary(
        id=species.id,
        slug=species.slug,
        name=species.name,
        scientific_name=species.latin_name,
        taxon_id=species.taxon_id,
        genus_name=names[0] or species.latin_name.split(" ")[0],
        family_name=names[1],
        group=species.group_key,
        edibility=species.edibility,
        protection=species.protection,
        forecast_enabled=species.forecast_enabled,
        lead_photo_id=lead_photo_id,
        updated_at=species.updated_at,
    )


def _measurement_groups(rows: Sequence[SpeciesMeasurement]) -> list[MeasurementGroup]:
    """Gruppiert Maße je Körperteil."""
    by_part: dict[BodyPart, list[Measurement]] = defaultdict(list)
    for row in rows:
        by_part[row.part].append(
            Measurement(
                dimension=row.dimension,
                unit=row.unit,
                low=row.low,
                high=row.high,
                rare_low=row.rare_low,
                rare_high=row.rare_high,
            ),
        )
    return [MeasurementGroup(part=part, measurements=ms) for part, ms in by_part.items()]


def assemble(
    species: SpeciesRow,
    child: ChildRows,
    terms: dict[uuid.UUID, Term],
    targets: dict[uuid.UUID, lookalikes.LookalikeTarget],
    names: tuple[str, str | None] = ("", None),
) -> Species:
    """Baut das volle Profil einer Art aus ihren Kindzeilen."""
    caps, margins, stems = part_features.split(child.part_features.get(species.id, []))
    return Species(
        **summary_of(species, child.lead_photos.get(species.id), names).model_dump(),
        description=species.description,
        marketable=species.marketable,
        frequency=species.frequency,
        red_list=species.red_list,
        edibility_note=species.edibility_note,
        protection_note=species.protection_note,
        period_start_month=species.period_start_month,
        period_end_month=species.period_end_month,
        period_peak_month=species.period_peak_month,
        smell_text=species.smell_text,
        taste_text=species.taste_text,
        hymenium_type=species.hymenium_type,
        gill_attachment=species.gill_attachment,
        gill_spacing=species.gill_spacing,
        gill_edge=species.gill_edge,
        cap_shape_young=species.cap_shape_young,
        cap_shape_old=species.cap_shape_old,
        names=[SpeciesNameEntry(name=n.name, kind=n.kind) for n in child.names.get(species.id, [])],
        measurements=_measurement_groups(child.measurements.get(species.id, [])),
        colours=colour_groups(species.id, child),
        colour_changes=colour_changes(species.id, child, terms),
        cap_features=caps,
        cap_margins=margins,
        stem_features=stems,
        traits=[Trait(key=t.key, text=t.body) for t in child.traits.get(species.id, [])],
        sources=[
            SourceEntry(scope=s.scope, title=s.title, url=s.url, checked_on=s.checked_on)
            for s in child.sources.get(species.id, [])
        ],
        seasons=[s.season for s in child.seasons.get(species.id, [])],
        terms=[
            SpeciesTermEntry(term=term_ref(terms[t.term_id]), from_experience=t.from_experience)
            for t in child.terms.get(species.id, [])
            if t.term_id in terms
        ],
        lookalikes=lookalikes.build(species.id, child.lookalikes.get(species.id, []), targets),
    )


async def load_one(db: AsyncSession, species: SpeciesRow) -> Species:
    """Lädt das volle Profil einer einzelnen Art."""
    child = await load_children(db, [species.id])
    terms = await term_lookup(db)
    names = await taxon_names(db)
    targets = await lookalikes.load_targets(db, species.id, child.lookalikes.get(species.id, []))
    return assemble(species, child, terms, targets, names.of(species))


async def load_many_with_facets(
    db: AsyncSession,
    species_rows: Sequence[SpeciesRow],
) -> tuple[list[Species], list[SpeciesFacets]]:
    """Lädt das volle Profil und die Filterachsen mehrerer Arten in wenigen Abfragen."""
    ids = [s.id for s in species_rows]
    child = await load_children(db, ids)
    terms = await term_lookup(db)
    names = await taxon_names(db)
    targets = lookalikes.targets_of(species_rows, child)
    assembled = [assemble(s, child, terms, targets, names.of(s)) for s in species_rows]
    matchables = [build_facets(s, child, terms, names.of(s)) for s in species_rows]
    return assembled, matchables
