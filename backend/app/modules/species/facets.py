"""Der Merkmalskatalog: was sich filtern laesst, und was es kostet.

Zwei Zahlen stehen an jeder Gruppe, bevor jemand waehlt.

  Die Abdeckung sagt, fuer wie viele Arten die Quelle das Merkmal ueberhaupt
  nennt. "Hutform, 94 von 306" heisst: wer danach filtert, schliesst 212 Arten
  aus, weil die Angabe fehlt, und nicht weil sie nicht passen.

  Die Zahl am Wert sagt, wie viele Arten der Wert trifft. Sie ist absolut ueber
  den ganzen Katalog und haengt nicht am uebrigen Filter. Nur so laesst sich
  vor der Wahl sehen, was eine Wahl kostet; was danach uebrig bleibt, steht im
  Fuss der Auswahl und kommt aus der Liste.

Was eine Art in einer Gruppe traegt, steht in ``traits.py``. Diese Datei zaehlt
nur, die Liste filtert mit derselben Auskunft.

Die Gruppen stehen nach Abdeckung, die dichteste zuerst. Wer nach unten liest,
sieht an den Zahlen selbst, dass es duenner wird.
"""

from collections.abc import Sequence

from app.modules.species.catalog import Catalog
from app.modules.species.schemas import (
    FacetCatalogue,
    FacetGroup,
    FacetKey,
    FacetKind,
    FacetPart,
    FacetValue,
    Profile,
    Tier,
)
from app.modules.species.traits import FACETS, Facet, Slice, values_of


def _tier_counts(catalog: Catalog) -> dict[str, int]:
    """Die Stufe steht nicht im Profil: sie faellt aus Datenlage und Karte."""
    counted = dict.fromkeys(values_of(Tier), 0)
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
