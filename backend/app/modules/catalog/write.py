"""Schreibt die Kindzeilen einer Art vollständig neu."""

from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import delete, select

from app.core.errors import Invalid
from app.models import (
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
)
from app.shared.enums import BodyPart

if TYPE_CHECKING:
    from collections.abc import Sequence

    from sqlalchemy.ext.asyncio import AsyncSession

    from app.modules.catalog.schemas import LookalikeWrite, SpeciesWrite

CLEARED: tuple[type, ...] = (
    SpeciesName,
    SpeciesMeasurement,
    SpeciesColourRange,
    SpeciesColourChange,
    SpeciesPartFeature,
    SpeciesTrait,
    SpeciesSource,
    SpeciesSeason,
    SpeciesTerm,
)


async def replace_children(db: AsyncSession, species_id: uuid.UUID, body: SpeciesWrite) -> None:
    """Ersetzt alle Kindzeilen einer Art aus dem Schreibkörper."""
    for model in CLEARED:
        await db.execute(delete(model).where(model.species_id == species_id))  # type: ignore[attr-defined]
    for position, entry in enumerate(body.names):
        db.add(
            SpeciesName(species_id=species_id, position=position, name=entry.name, kind=entry.kind)
        )
    for group in body.measurements:
        for measurement in group.measurements:
            db.add(
                SpeciesMeasurement(
                    species_id=species_id,
                    part=group.part,
                    dimension=measurement.dimension,
                    low=measurement.low,
                    high=measurement.high,
                    rare_low=measurement.rare_low,
                    rare_high=measurement.rare_high,
                    unit=measurement.unit,
                ),
            )
    for entry in body.traits:
        db.add(SpeciesTrait(species_id=species_id, key=entry.key, body=entry.text))
    for position, entry in enumerate(body.sources):
        db.add(
            SpeciesSource(
                species_id=species_id,
                position=position,
                scope=entry.scope,
                title=entry.title,
                url=entry.url,
                checked_on=entry.checked_on,
            ),
        )
    for season in body.seasons:
        db.add(SpeciesSeason(species_id=species_id, season=season))
    for entry in body.terms:
        db.add(
            SpeciesTerm(
                species_id=species_id,
                term_id=entry.term.id,
                from_experience=entry.from_experience,
            ),
        )
    _write_part_features(db, species_id, body)
    await db.flush()
    await _write_colours(db, species_id, body)
    await _write_colour_changes(db, species_id, body)
    await _sync_lookalikes(db, species_id, body.lookalikes)


def _write_part_features(db: AsyncSession, species_id: uuid.UUID, body: SpeciesWrite) -> None:
    """Schreibt Hutmerkmale, Hutrandmerkmale und Stielmerkmale."""
    for cap in body.cap_features:
        db.add(
            SpeciesPartFeature(
                species_id=species_id, part=BodyPart.CAP, feature=cap.feature, phase=cap.phase
            ),
        )
    for margin in body.cap_margins:
        db.add(
            SpeciesPartFeature(
                species_id=species_id,
                part=BodyPart.CAP,
                feature=margin.margin,
                phase=margin.phase,
            ),
        )
    for stem in body.stem_features:
        db.add(
            SpeciesPartFeature(
                species_id=species_id,
                part=BodyPart.STEM,
                feature=stem.feature,
                phase=stem.phase,
            ),
        )


async def _write_colours(db: AsyncSession, species_id: uuid.UUID, body: SpeciesWrite) -> None:
    """Schreibt die Farbbereiche und ihre Farben."""
    for group in body.colours:
        db.add(SpeciesColourRange(species_id=species_id, part=group.part, mode=group.mode))
    await db.flush()
    for group in body.colours:
        for position, colour in enumerate(group.colours):
            db.add(
                SpeciesColour(
                    species_id=species_id,
                    part=group.part,
                    position=position,
                    name=colour.name,
                    hex=colour.hex,
                ),
            )


async def _write_colour_changes(
    db: AsyncSession, species_id: uuid.UUID, body: SpeciesWrite
) -> None:
    """Schreibt die Verfärbungen und ihre Auslöser."""
    for position, change in enumerate(body.colour_changes):
        db.add(
            SpeciesColourChange(
                species_id=species_id,
                position=position,
                part=change.part,
                from_name=change.from_.name if change.from_ else None,
                from_hex=change.from_.hex if change.from_ else None,
                to_name=change.to.name,
                to_hex=change.to.hex,
                speed=change.speed,
            ),
        )
    await db.flush()
    for position, change in enumerate(body.colour_changes):
        for trigger in change.triggers:
            db.add(
                SpeciesColourChangeTrigger(
                    species_id=species_id, position=position, term_id=trigger.id
                ),
            )


def _own_field(row: SpeciesLookalike, species_id: uuid.UUID) -> str:
    """Sagt, welches Feld die eigene Art in einem Paar hält."""
    return "difference_a" if row.species_a_id == species_id else "difference_b"


async def _sync_lookalikes(
    db: AsyncSession,
    species_id: uuid.UUID,
    entries: Sequence[LookalikeWrite],
) -> None:
    """Gleicht die verwechselbaren Arten aus der eigenen Sicht ab."""
    wanted: dict[uuid.UUID, str] = {}
    for entry in entries:
        other = (
            await db.execute(select(Species.id).where(Species.slug == entry.slug))
        ).scalar_one_or_none()
        if other is None:
            raise Invalid(errors=[{"field": "lookalikes", "code": "unknown_slug"}])
        wanted[other] = entry.difference
    existing = (
        await db.execute(
            select(SpeciesLookalike).where(
                (SpeciesLookalike.species_a_id == species_id)
                | (SpeciesLookalike.species_b_id == species_id),
            ),
        )
    ).scalars()
    for row in existing:
        other_id = row.species_b_id if row.species_a_id == species_id else row.species_a_id
        shown_field = _own_field(row, other_id)
        if other_id in wanted:
            setattr(row, shown_field, wanted.pop(other_id))
        else:
            setattr(row, shown_field, None)
            if row.difference_a is None and row.difference_b is None:
                await db.delete(row)
    for other_id, text in wanted.items():
        a_id, b_id = sorted((species_id, other_id))
        row = SpeciesLookalike(species_a_id=a_id, species_b_id=b_id)
        setattr(row, _own_field(row, other_id), text)
        db.add(row)
