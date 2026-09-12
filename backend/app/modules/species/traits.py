"""Was eine Art ueber eine Filtergruppe sagt.

Eine Stelle, zwei Verwender: der Merkmalskatalog zaehlt damit, und die Liste
filtert damit. Beide fragen dasselbe -- welche Werte traegt diese Art in dieser
Gruppe -- und bekommen dieselbe Antwort. Eine leere Antwort heisst nicht "kein
Wert trifft zu", sondern "die Quelle sagt nichts". Der Unterschied entscheidet,
ob eine Art aus dem Ergebnis faellt oder unter den Treffern als nicht
beurteilbar steht.
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Final

from app.modules.species.schemas import (
    MONTHS,
    CapFeature,
    CapMargin,
    CapShape,
    Edibility,
    FacetKey,
    FacetKind,
    Frequency,
    GillAttachment,
    GillEdge,
    GillSpacing,
    HymenophoreKind,
    Measurements,
    Profile,
    ProtectionStatus,
    RedListStatus,
    StemFeature,
    Tier,
    TreeSpecies,
)

# Die Wertigkeit von 123pilzsuche laeuft von 1 bis 6. Sie ist eine Zahl und
# kein Enum, darum steht ihre Reihenfolge hier.
RATINGS: Final = tuple(str(step) for step in range(1, 7))


def values_of(enumeration: type[StrEnum]) -> tuple[str, ...]:
    """Die Werte einer Aufzaehlung in ihrer Reihenfolge."""
    return tuple(str(member.value) for member in enumeration)


def _months_of(profile: Profile) -> tuple[str, ...]:
    """Die Monate, ueber die der Zeitraum einer Art laeuft, ueber den Jahreswechsel hinweg."""
    period = profile.period
    if period is None:
        return ()
    length = (period.end_month - period.start_month) % MONTHS + 1
    return tuple(str((period.start_month - 1 + step) % MONTHS + 1) for step in range(length))


def _trees_of(profile: Profile) -> tuple[str, ...]:
    trees = list(profile.trees)
    if profile.trees_from_experience:
        trees += [tree for tree in profile.trees_from_experience.trees if tree not in trees]
    return tuple(str(tree) for tree in trees)


def _cap_shapes_of(profile: Profile) -> tuple[str, ...]:
    shape = profile.cap_shape
    if shape is None:
        return ()
    return tuple(dict.fromkeys(str(step) for step in (shape.start, shape.end) if step))


def _cap_margins_of(profile: Profile) -> tuple[str, ...]:
    margin = profile.cap_margin
    if margin is None:
        return ()
    return tuple(dict.fromkeys(str(step) for step in [*margin.start, *(margin.end or [])]))


def _colours_of(part: str) -> Callable[[Profile], tuple[str, ...]]:
    def read(profile: Profile) -> tuple[str, ...]:
        return tuple(dict.fromkeys(colour.name for colour in getattr(profile.colours, part)))

    return read


def _nothing(profile: Profile) -> tuple[str, ...]:  # noqa: ARG001
    """Ein Teil ohne waehlbare Werte."""
    return ()


@dataclass(frozen=True)
class Slice:
    """Ein Teil einer Gruppe: ein Koerperteil, ein Sinn, ein Mass.

    ``order`` gibt die feste Reihenfolge der Werte. Bleibt sie leer, ordnet die
    Zahl: die Werte kommen aus den Profilen und haben keine Reihenfolge, die
    jemand festgelegt haette.
    """

    key: str
    # Ein Mass hat keine Werte, nur Grenzen. Dann bleibt der Leser leer.
    read: Callable[[Profile], Sequence[str]] = _nothing
    order: Sequence[str] = ()
    unit: str | None = None


@dataclass(frozen=True)
class Facet:
    """Eine Gruppe im Filterblatt."""

    key: FacetKey
    kind: FacetKind
    slices: Sequence[Slice] = field(default_factory=tuple)


def _one(read: Callable[[Profile], Sequence[str]], order: Sequence[str] = ()) -> tuple[Slice]:
    """Eine Gruppe ohne Teile: ein einziger Schnitt ohne eigenen Namen."""
    return (Slice(key="", read=read, order=order),)


COLOUR_PARTS: Final = ("cap", "hymenium", "stem", "flesh", "spore_print")

FACETS: Final[tuple[Facet, ...]] = (
    Facet(
        FacetKey.EDIBILITY,
        FacetKind.VALUES,
        _one(lambda p: (str(p.edibility),), values_of(Edibility)),
    ),
    Facet(
        FacetKey.PROTECTION,
        FacetKind.VALUES,
        _one(lambda p: (str(p.protection.status),), values_of(ProtectionStatus)),
    ),
    # Die Stufe ist die einzige Gruppe, die nicht im Profil steht.
    Facet(FacetKey.TIER, FacetKind.VALUES, (Slice("", order=values_of(Tier)),)),
    Facet(
        FacetKey.COLLECTABLE,
        FacetKind.SWITCH,
        _one(lambda p: ("ja" if p.collectable else "nein",), ("ja", "nein")),
    ),
    Facet(
        FacetKey.SENSES,
        FacetKind.PARTS,
        (
            Slice("geruch", lambda p: tuple(p.smell.tags)),
            Slice("geschmack", lambda p: tuple(p.taste.tags)),
        ),
    ),
    Facet(
        FacetKey.COLOUR,
        FacetKind.COLOUR,
        tuple(Slice(part, _colours_of(part)) for part in COLOUR_PARTS),
    ),
    Facet(
        FacetKey.MEASUREMENTS,
        FacetKind.SPAN,
        tuple(
            Slice(name, unit="cm" if name.endswith("_cm") else "um")
            for name in Measurements.model_fields
        ),
    ),
    Facet(FacetKey.PERIOD, FacetKind.PERIOD, _one(_months_of, tuple(str(m) for m in range(1, 13)))),
    Facet(
        FacetKey.HYMENOPHORE,
        FacetKind.PARTS,
        (
            Slice(
                "art",
                lambda p: (str(p.hymenophore.kind),) if p.hymenophore else (),
                values_of(HymenophoreKind),
            ),
            Slice(
                "ansatz",
                lambda p: (
                    (str(p.hymenophore.attachment),)
                    if p.hymenophore and p.hymenophore.attachment
                    else ()
                ),
                values_of(GillAttachment),
            ),
            Slice(
                "stand",
                lambda p: (
                    (str(p.hymenophore.spacing),) if p.hymenophore and p.hymenophore.spacing else ()
                ),
                values_of(GillSpacing),
            ),
            Slice(
                "schneide",
                lambda p: (
                    (str(p.hymenophore.edge),) if p.hymenophore and p.hymenophore.edge else ()
                ),
                values_of(GillEdge),
            ),
        ),
    ),
    Facet(
        FacetKey.STEM,
        FacetKind.VALUES,
        _one(lambda p: tuple(str(one) for one in p.stem_features), values_of(StemFeature)),
    ),
    Facet(FacetKey.TREES, FacetKind.VALUES, _one(_trees_of, values_of(TreeSpecies))),
    Facet(
        FacetKey.RATING,
        FacetKind.VALUES,
        _one(lambda p: (str(p.rating),) if p.rating else (), RATINGS),
    ),
    Facet(FacetKey.CAP_MARGIN, FacetKind.VALUES, _one(_cap_margins_of, values_of(CapMargin))),
    Facet(
        FacetKey.FREQUENCY,
        FacetKind.VALUES,
        _one(lambda p: (str(p.frequency),) if p.frequency else (), values_of(Frequency)),
    ),
    Facet(FacetKey.CAP_SHAPE, FacetKind.VALUES, _one(_cap_shapes_of, values_of(CapShape))),
    Facet(
        FacetKey.CAP_FEATURES,
        FacetKind.VALUES,
        _one(lambda p: tuple(str(one) for one in p.cap_features), values_of(CapFeature)),
    ),
    Facet(
        FacetKey.REAGENTS,
        FacetKind.VALUES,
        _one(lambda p: tuple(str(entry.reagent) for entry in p.reagents)),
    ),
    Facet(
        FacetKey.RED_LIST,
        FacetKind.VALUES,
        _one(lambda p: (str(p.red_list),) if p.red_list else (), values_of(RedListStatus)),
    ),
)


FACET_BY_KEY: Final[dict[FacetKey, Facet]] = {facet.key: facet for facet in FACETS}


def said_about(facet: Facet, profile: Profile) -> set[str]:
    """Was eine Art in dieser Gruppe traegt. Leer heisst: die Quelle sagt nichts."""
    said: set[str] = set()
    for part in facet.slices:
        said |= set(part.read(profile))
    return said
