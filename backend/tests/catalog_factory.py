"""Testhilfen des Moduls catalog: Taxa, Begriffe und Arten von Hand."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from app.models import (
    Photo,
    Species,
    SpeciesColour,
    SpeciesColourChange,
    SpeciesColourChangeTrigger,
    SpeciesColourRange,
    SpeciesLookalike,
    SpeciesMeasurement,
    SpeciesName,
    SpeciesPartFeature,
    SpeciesSeason,
    SpeciesSource,
    SpeciesTerm,
    SpeciesTrait,
    Taxon,
    Term,
)
from app.shared.enums import Edibility, Group, Licence, PhotoState, Protection, Unit

if TYPE_CHECKING:
    from datetime import date

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.shared.enums import (
        BodyPart,
        ColourMode,
        Dimension,
        NameKind,
        PartFeature,
        Phase,
        Season,
        SourceScope,
        Speed,
        TaxonRank,
        TermKind,
        TriggerGroup,
    )


async def make_taxon(
    session: AsyncSession,
    *,
    rank: TaxonRank,
    slug: str,
    name: str | None = None,
    parent: Taxon | None = None,
) -> Taxon:
    """Legt ein Taxon an."""
    made = Taxon(
        id=uuid.uuid4(),
        rank=rank,
        slug=slug,
        name=name or slug,
        latin_name=name or slug,
        parent_id=parent.id if parent else None,
    )
    session.add(made)
    await session.commit()
    return made


async def make_term(
    session: AsyncSession,
    *,
    kind: TermKind,
    slug: str,
    name: str | None = None,
    group: TriggerGroup | None = None,
    position: int = 0,
) -> Term:
    """Legt einen Begriff an."""
    made = Term(
        id=uuid.uuid4(), kind=kind, group_key=group, slug=slug, name=name or slug, position=position
    )
    session.add(made)
    await session.commit()
    return made


async def make_species(
    session: AsyncSession,
    *,
    slug: str,
    name: str | None = None,
    latin_name: str | None = None,
    taxon: Taxon | None = None,
    group: Group = Group.BOLETE,
    edibility: Edibility = Edibility.EDIBLE,
    protection: Protection = Protection.NONE,
    **extra: Any,  # noqa: ANN401
) -> Species:
    """Legt eine Art mit ihren Kopffeldern an."""
    made = Species(
        id=uuid.uuid4(),
        slug=slug,
        name=name or slug,
        latin_name=latin_name or name or slug,
        taxon_id=taxon.id if taxon else None,
        group_key=group,
        edibility=edibility,
        protection=protection,
        **extra,
    )
    session.add(made)
    await session.commit()
    return made


async def add_name(
    session: AsyncSession, species: Species, position: int, name: str, kind: NameKind
) -> None:
    """Fügt einen weiteren Namen an."""
    session.add(SpeciesName(species_id=species.id, position=position, name=name, kind=kind))
    await session.commit()


async def add_measurement(
    session: AsyncSession,
    species: Species,
    *,
    part: BodyPart,
    dimension: Dimension,
    low: float,
    high: float,
    unit: Unit = Unit.CM,
) -> None:
    """Fügt ein Maß an."""
    session.add(
        SpeciesMeasurement(
            species_id=species.id, part=part, dimension=dimension, low=low, high=high, unit=unit
        ),
    )
    await session.commit()


async def add_colours(
    session: AsyncSession,
    species: Species,
    *,
    part: BodyPart,
    mode: ColourMode,
    colours: list[tuple[str, str]],
) -> None:
    """Fügt einen Farbbereich mit seinen Farben an."""
    session.add(SpeciesColourRange(species_id=species.id, part=part, mode=mode))
    await session.flush()
    for position, (name, hex_value) in enumerate(colours):
        session.add(
            SpeciesColour(
                species_id=species.id, part=part, position=position, name=name, hex=hex_value
            )
        )
    await session.commit()


async def add_colour_change(
    session: AsyncSession,
    species: Species,
    *,
    position: int,
    part: BodyPart,
    to_name: str,
    to_hex: str,
    from_name: str | None = None,
    from_hex: str | None = None,
    speed: Speed | None = None,
    triggers: list[Term] = (),  # type: ignore[assignment]
) -> None:
    """Fügt eine Verfärbung mit ihren Auslösern an."""
    session.add(
        SpeciesColourChange(
            species_id=species.id,
            position=position,
            part=part,
            from_name=from_name,
            from_hex=from_hex,
            to_name=to_name,
            to_hex=to_hex,
            speed=speed,
        ),
    )
    await session.flush()
    for term in triggers:
        session.add(
            SpeciesColourChangeTrigger(species_id=species.id, position=position, term_id=term.id)
        )
    await session.commit()


async def add_part_feature(
    session: AsyncSession, species: Species, *, part: BodyPart, feature: PartFeature, phase: Phase
) -> None:
    """Fügt ein Merkmal eines Körperteils an."""
    session.add(SpeciesPartFeature(species_id=species.id, part=part, feature=feature, phase=phase))
    await session.commit()


async def add_trait(session: AsyncSession, species: Species, key: Any, text: str) -> None:  # noqa: ANN401
    """Fügt einen Abschnitt der Merkmalsprosa an."""
    session.add(SpeciesTrait(species_id=species.id, key=key, body=text))
    await session.commit()


async def add_source(
    session: AsyncSession,
    species: Species,
    *,
    position: int,
    scope: SourceScope,
    title: str,
    url: str,
    checked_on: date,
) -> None:
    """Fügt eine Quelle an."""
    session.add(
        SpeciesSource(
            species_id=species.id,
            position=position,
            scope=scope,
            title=title,
            url=url,
            checked_on=checked_on,
        ),
    )
    await session.commit()


async def add_season(session: AsyncSession, species: Species, season: Season) -> None:
    """Fügt eine Jahreszeit an."""
    session.add(SpeciesSeason(species_id=species.id, season=season))
    await session.commit()


async def add_term(
    session: AsyncSession, species: Species, term: Term, *, from_experience: bool = False
) -> None:
    """Fügt einen Begriff an."""
    session.add(
        SpeciesTerm(species_id=species.id, term_id=term.id, from_experience=from_experience)
    )
    await session.commit()


async def add_lookalike(
    session: AsyncSession,
    species_a: Species,
    species_b: Species,
    *,
    difference_a: str | None = None,
    difference_b: str | None = None,
) -> None:
    """Fügt ein Verwechslungspaar an, in der richtigen Reihenfolge."""
    a_id, b_id = species_a.id, species_b.id
    if a_id > b_id:
        a_id, b_id, difference_a, difference_b = b_id, a_id, difference_b, difference_a
    session.add(
        SpeciesLookalike(
            species_a_id=a_id,
            species_b_id=b_id,
            difference_a=difference_a,
            difference_b=difference_b,
        ),
    )
    await session.commit()


async def add_lead_photo(session: AsyncSession, species: Species) -> Photo:
    """Fügt ein Leitfoto an."""
    made = Photo(
        id=uuid.uuid4(),
        species_id=species.id,
        width=10,
        height=10,
        photographer="tester",
        licence=Licence.OWN,
        lead=True,
        state=PhotoState.APPROVED,
    )
    session.add(made)
    await session.commit()
    return made
