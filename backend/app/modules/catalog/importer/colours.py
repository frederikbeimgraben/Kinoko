"""Baut Maße, Farben und Farbwandel einer Art."""

from __future__ import annotations

from app.models import (
    SpeciesColour,
    SpeciesColourChange,
    SpeciesColourChangeTrigger,
    SpeciesColourRange,
    SpeciesMeasurement,
)
from app.modules.catalog.importer.context import BuildContext, optional_lookup
from app.modules.catalog.importer.fields import COLOUR_PARTS, HYMENIUM_BODY_PARTS, MEASUREMENTS
from app.shared.enums import BodyPart, ColourMode, TermKind
from tools import catalog_vocabulary as vocab


def measurement_rows(ctx: BuildContext) -> list[SpeciesMeasurement]:
    """Baut die Maße einer Art."""
    rows: list[SpeciesMeasurement] = []
    for key, span in ctx.profile.get("masse", {}).items():
        target = MEASUREMENTS.get(key)
        if target is None:
            ctx.report.skip("measurement_ohne_koerperteil")
            continue
        part, dimension = target
        rows.append(
            SpeciesMeasurement(
                species_id=ctx.species_id,
                part=part,
                dimension=dimension,
                low=span["von"],
                high=span["bis"],
                rare_low=span.get("seltenVon"),
                rare_high=span.get("seltenBis"),
                unit=vocab.lookup(vocab.UNIT, span["einheit"], field="einheit", source=ctx.stem),
            ),
        )
    return rows


def colour_rows(
    ctx: BuildContext, hymenium_type: str | None
) -> tuple[list[SpeciesColourRange], list[SpeciesColour]]:
    """Baut die Farbbereiche und Farben einer Art."""
    ranges: list[SpeciesColourRange] = []
    colours: list[SpeciesColour] = []
    for key, entries in ctx.profile.get("farben", {}).items():
        if key == "verfaerbung" or not entries:
            continue
        if key == "sporenlager":
            part = HYMENIUM_BODY_PARTS.get(hymenium_type or "")
            if part is None:
                ctx.report.skip("colour_ohne_koerperteil")
                continue
        else:
            part = COLOUR_PARTS[key]
        mode = ColourMode.SINGLE if len(entries) == 1 else ColourMode.DISTINCT
        ranges.append(SpeciesColourRange(species_id=ctx.species_id, part=part, mode=mode))
        colours += [
            SpeciesColour(
                species_id=ctx.species_id, part=part, position=i, name=e["name"], hex=e["hex"]
            )
            for i, e in enumerate(entries)
        ]
    return ranges, colours


def _mechanical_change_rows(
    ctx: BuildContext,
) -> tuple[list[SpeciesColourChange], list[SpeciesColourChangeTrigger]]:
    change = ctx.profile.get("farben", {}).get("verfaerbung")
    if not change:
        return [], []
    speed = optional_lookup(vocab.SPEED, change.get("dauer"), "farben.verfaerbung.dauer", ctx.stem)
    trigger_id = ctx.terms.id_for(TermKind.TRIGGER, vocab.CUT_TRIGGER_SLUG)
    changes: list[SpeciesColourChange] = []
    triggers: list[SpeciesColourChangeTrigger] = []
    for position, colour in enumerate(change.get("nach", [])):
        changes.append(
            SpeciesColourChange(
                species_id=ctx.species_id,
                position=position,
                part=BodyPart.FLESH,
                from_name=None,
                from_hex=None,
                to_name=colour["name"],
                to_hex=colour["hex"],
                speed=speed,
            ),
        )
        triggers.append(
            SpeciesColourChangeTrigger(
                species_id=ctx.species_id, position=position, term_id=trigger_id
            )
        )
    return changes, triggers


def _reagent_change_rows(
    ctx: BuildContext, position_start: int
) -> tuple[list[SpeciesColourChange], list[SpeciesColourChangeTrigger]]:
    changes: list[SpeciesColourChange] = []
    triggers: list[SpeciesColourChangeTrigger] = []
    position = position_start
    for entry in ctx.profile.get("reagenzien", []):
        found = vocab.find_colour(entry["reaktion"], ctx.colours)
        if found is None:
            ctx.report.skip("reagenz_ohne_zielfarbe")
            continue
        name, hex_code = found
        slug = vocab.lookup(vocab.REAGENT_SLUG, entry["reagenz"], field="reagenz", source=ctx.stem)
        trigger_id = ctx.terms.id_for(TermKind.TRIGGER, slug)
        changes.append(
            SpeciesColourChange(
                species_id=ctx.species_id,
                position=position,
                part=BodyPart.FLESH,
                from_name=None,
                from_hex=None,
                to_name=name,
                to_hex=hex_code,
                speed=None,
            ),
        )
        triggers.append(
            SpeciesColourChangeTrigger(
                species_id=ctx.species_id, position=position, term_id=trigger_id
            )
        )
        position += 1
    return changes, triggers


def colour_change_rows(
    ctx: BuildContext,
) -> tuple[list[SpeciesColourChange], list[SpeciesColourChangeTrigger]]:
    """Baut die Reaktionen einer Art: mechanisch, dann je Reagenz."""
    mech_changes, mech_triggers = _mechanical_change_rows(ctx)
    reagent_changes, reagent_triggers = _reagent_change_rows(ctx, len(mech_changes))
    return mech_changes + reagent_changes, mech_triggers + reagent_triggers
