"""Der Merkmalskatalog: was sich filtern laesst, und was es kostet.

Zwei Zahlen stehen an jeder Gruppe, bevor jemand waehlt.

  Die Abdeckung sagt, fuer wie viele Arten die Quelle das Merkmal ueberhaupt
  nennt. "Hutform, 94 von 306" heisst: wer danach filtert, schliesst 212 Arten
  aus, weil die Angabe fehlt, und nicht weil sie nicht passen.

  Die Zahl am Wert sagt, wie viele Arten der Wert trifft. Sie ist absolut ueber
  den ganzen Katalog und haengt nicht am uebrigen Filter. Nur so laesst sich
  vor der Wahl sehen, was eine Wahl kostet; was danach uebrig bleibt, steht im
  Fuss der Auswahl und kommt aus der Liste.

Beides steht fest, solange die Profile feststehen. Der Katalog wird darum
einmal je Prozess gebaut und danach nur gelesen.

Die Gruppen stehen nach Abdeckung, die dichteste zuerst. Wer nach unten liest,
sieht an den Zahlen selbst, dass es duenner wird.
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Final

from app.modules.species.catalog import Catalog
from app.modules.species.schemas import (
    MONTHS,
    CapFeature,
    CapMargin,
    CapShape,
    Edibility,
    FacetCatalogue,
    FacetGroup,
    FacetKey,
    FacetKind,
    FacetPart,
    FacetValue,
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


def _values(enumeration: type[StrEnum]) -> tuple[str, ...]:
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
        _one(lambda p: (str(p.edibility),), _values(Edibility)),
    ),
    Facet(
        FacetKey.PROTECTION,
        FacetKind.VALUES,
        _one(lambda p: (str(p.protection.status),), _values(ProtectionStatus)),
    ),
    # Die Stufe ist die einzige Gruppe, die nicht im Profil steht.
    Facet(FacetKey.TIER, FacetKind.VALUES, (Slice("", order=_values(Tier)),)),
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
                _values(HymenophoreKind),
            ),
            Slice(
                "ansatz",
                lambda p: (
                    (str(p.hymenophore.attachment),)
                    if p.hymenophore and p.hymenophore.attachment
                    else ()
                ),
                _values(GillAttachment),
            ),
            Slice(
                "stand",
                lambda p: (
                    (str(p.hymenophore.spacing),) if p.hymenophore and p.hymenophore.spacing else ()
                ),
                _values(GillSpacing),
            ),
            Slice(
                "schneide",
                lambda p: (
                    (str(p.hymenophore.edge),) if p.hymenophore and p.hymenophore.edge else ()
                ),
                _values(GillEdge),
            ),
        ),
    ),
    Facet(
        FacetKey.STEM,
        FacetKind.VALUES,
        _one(lambda p: tuple(str(one) for one in p.stem_features), _values(StemFeature)),
    ),
    Facet(FacetKey.TREES, FacetKind.VALUES, _one(_trees_of, _values(TreeSpecies))),
    Facet(
        FacetKey.RATING,
        FacetKind.VALUES,
        _one(lambda p: (str(p.rating),) if p.rating else (), RATINGS),
    ),
    Facet(FacetKey.CAP_MARGIN, FacetKind.VALUES, _one(_cap_margins_of, _values(CapMargin))),
    Facet(
        FacetKey.FREQUENCY,
        FacetKind.VALUES,
        _one(lambda p: (str(p.frequency),) if p.frequency else (), _values(Frequency)),
    ),
    Facet(FacetKey.CAP_SHAPE, FacetKind.VALUES, _one(_cap_shapes_of, _values(CapShape))),
    Facet(
        FacetKey.CAP_FEATURES,
        FacetKind.VALUES,
        _one(lambda p: tuple(str(one) for one in p.cap_features), _values(CapFeature)),
    ),
    Facet(
        FacetKey.REAGENTS,
        FacetKind.VALUES,
        _one(lambda p: tuple(str(entry.reagent) for entry in p.reagents)),
    ),
    Facet(
        FacetKey.RED_LIST,
        FacetKind.VALUES,
        _one(lambda p: (str(p.red_list),) if p.red_list else (), _values(RedListStatus)),
    ),
)


def _tier_counts(catalog: Catalog) -> dict[str, int]:
    """Die Stufe steht nicht im Profil: sie faellt aus Datenlage und Karte."""
    counted = dict.fromkeys(_values(Tier), 0)
    for entry in catalog.listing(only_collectable=None).species:
        counted[str(entry.tier)] += 1
    return counted


def _tally(part: Slice, profiles: Sequence[Profile]) -> tuple[dict[str, int], int]:
    """Zaehlt je Wert und zaehlt die Arten, ueber die der Teil etwas sagt."""
    counted: dict[str, int] = dict.fromkeys(part.order, 0)
    described = 0
    for profile in profiles:
        seen = part.read(profile)
        if not seen:
            continue
        described += 1
        for value in seen:
            counted[value] = counted.get(value, 0) + 1
    return counted, described


def _part_of(part: Slice, profiles: Sequence[Profile]) -> FacetPart:
    """Ein Teil mit seiner Abdeckung und der Zahl je Wert."""
    counted, described = _tally(part, profiles)
    values = [FacetValue(value=value, count=count) for value, count in counted.items()]
    # Ohne feste Reihenfolge ordnet die Zahl: die Werte kommen aus den Profilen
    # und niemand hat ihnen eine Reihenfolge gegeben.
    if not part.order:
        values.sort(key=lambda entry: (-entry.count, entry.value))
    return FacetPart(key=part.key, described=described, values=values, unit=part.unit)


def _span_of(part: Slice, profiles: Sequence[Profile]) -> FacetPart:
    """Ein Mass mit seinen Grenzen. Ohne eine einzige Angabe bleiben sie leer."""
    known = [
        span
        for span in (getattr(profile.measurements, part.key) for profile in profiles)
        if span is not None
    ]
    return FacetPart(
        key=part.key,
        described=len(known),
        values=[],
        unit=part.unit,
        minimum=min(span.start for span in known) if known else None,
        maximum=max(span.end for span in known) if known else None,
    )


def _described(facet: Facet, profiles: Sequence[Profile]) -> int:
    """Eine Art zaehlt fuer die Gruppe, sobald ein Teil etwas ueber sie sagt."""
    if facet.kind is FacetKind.SPAN:
        return sum(
            1
            for profile in profiles
            if any(getattr(profile.measurements, part.key) for part in facet.slices)
        )
    return sum(1 for profile in profiles if any(part.read(profile) for part in facet.slices))


def _group_of(facet: Facet, catalog: Catalog) -> FacetGroup:
    profiles = list(catalog.profiles.values())
    if facet.key is FacetKey.TIER:
        counted = _tier_counts(catalog)
        return FacetGroup(
            key=facet.key,
            kind=facet.kind,
            described=len(profiles),
            values=[FacetValue(value=tier, count=count) for tier, count in counted.items()],
            parts=[],
        )
    if facet.kind is FacetKind.SPAN:
        parts = [_span_of(part, profiles) for part in facet.slices]
    else:
        parts = [_part_of(part, profiles) for part in facet.slices]
    plain = len(facet.slices) == 1 and not facet.slices[0].key
    return FacetGroup(
        key=facet.key,
        kind=facet.kind,
        described=_described(facet, profiles),
        values=parts[0].values if plain else [],
        parts=[] if plain else parts,
    )


def facet_catalogue(catalog: Catalog) -> FacetCatalogue:
    """Alle Gruppen mit Abdeckung und Wertzahlen, die dichteste zuerst.

    Der Katalog steht fest, solange die Profile feststehen; gerechnet wird
    trotzdem bei jedem Aufruf. Dreihundert Profile mal neunzehn Gruppen sind
    ein paar tausend Schritte, und ein Zwischenspeicher waere eine Wette auf
    eine Last, die es nicht gibt.
    """
    groups = [_group_of(facet, catalog) for facet in FACETS]
    groups.sort(key=lambda group: (-group.described, group.key.value))
    return FacetCatalogue(species=len(catalog.profiles), groups=groups)
