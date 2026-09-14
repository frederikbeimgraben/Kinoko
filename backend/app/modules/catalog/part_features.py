"""Trennt Hutmerkmale, Hutrandmerkmale und Stielmerkmale aus ``species_part_feature``."""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.modules.catalog.schemas import CapFeatureEntry, CapMarginEntry, StemFeatureEntry
from app.shared.enums import BodyPart, CapFeature, CapMargin

if TYPE_CHECKING:
    from collections.abc import Sequence

    from app.models import SpeciesPartFeature

CAP_FEATURE_VALUES = frozenset(v.value for v in CapFeature)
CAP_MARGIN_VALUES = frozenset(v.value for v in CapMargin)


def split(
    rows: Sequence[SpeciesPartFeature],
) -> tuple[list[CapFeatureEntry], list[CapMarginEntry], list[StemFeatureEntry]]:
    """Trennt die Merkmalszeilen nach Achse und Körperteil."""
    caps: list[CapFeatureEntry] = []
    margins: list[CapMarginEntry] = []
    stems: list[StemFeatureEntry] = []
    for row in rows:
        if row.part == BodyPart.CAP and row.feature in CAP_FEATURE_VALUES:
            caps.append(CapFeatureEntry(feature=CapFeature(row.feature), phase=row.phase))
        elif row.part == BodyPart.CAP and row.feature in CAP_MARGIN_VALUES:
            margins.append(CapMarginEntry(margin=CapMargin(row.feature), phase=row.phase))
        elif row.part == BodyPart.STEM:
            stems.append(StemFeatureEntry(feature=row.feature, phase=row.phase))  # type: ignore[arg-type]
    return caps, margins, stems
