"""Die zwölf Standardfarben und die Zuordnung über den Farbabstand."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

CUBE_ROOT: Final = 1.0 / 3.0
GAMMA_CUT: Final = 0.04045
WEIGHTS: Final = (1.0, 2.0, 2.0)


@dataclass(frozen=True, slots=True)
class StandardColour:
    """Eine Standardfarbe des Filters."""

    key: str
    hex: str


#: Die zwölf Farben des Bretts `FilterColour`, in seiner Reihenfolge.
STANDARD: Final[tuple[StandardColour, ...]] = (
    StandardColour("white", "#f3efe6"),
    StandardColour("cream", "#e8d9b5"),
    StandardColour("yellow", "#e0b446"),
    StandardColour("orange", "#d1832f"),
    StandardColour("redBrown", "#a0522d"),
    StandardColour("brown", "#6b4423"),
    StandardColour("darkBrown", "#3e2a17"),
    StandardColour("olive", "#7f8a3a"),
    StandardColour("green", "#4f7a3a"),
    StandardColour("red", "#b8322a"),
    StandardColour("violet", "#7a3b6a"),
    StandardColour("grey", "#8a8f8a"),
)

KEYS: Final = frozenset(colour.key for colour in STANDARD)
HEXES: Final = frozenset(colour.hex for colour in STANDARD)


def channels(value: str) -> tuple[float, float, float]:
    """Zerlegt ``#rrggbb`` in drei Werte im Bereich null zu eins."""
    raw = value.lstrip("#")
    return tuple(int(raw[at : at + 2], 16) / 255.0 for at in (0, 2, 4))  # type: ignore[return-value]


def linear(value: float) -> float:
    """Nimmt die Gammakorrektur aus einem Kanal."""
    return value / 12.92 if value <= GAMMA_CUT else ((value + 0.055) / 1.055) ** 2.4


def oklab(value: str) -> tuple[float, float, float]:
    """Rechnet eine Farbe in den Oklab-Raum."""
    red, green, blue = (linear(part) for part in channels(value))
    long = 0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue
    medium = 0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue
    short = 0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue
    long_, medium_, short_ = (part**CUBE_ROOT for part in (long, medium, short))
    return (
        0.2104542553 * long_ + 0.7936177850 * medium_ - 0.0040720468 * short_,
        1.9779984951 * long_ - 2.4285922050 * medium_ + 0.4505937099 * short_,
        0.0259040371 * long_ + 0.7827717662 * medium_ - 0.8086757660 * short_,
    )


def distance(first: str, second: str) -> float:
    """Der Abstand zweier Farben im Oklab-Raum, Buntheit doppelt gewichtet."""
    left = oklab(first)
    right = oklab(second)
    parts = zip(left, right, WEIGHTS, strict=True)
    return sum(((one - other) * weight) ** 2 for one, other, weight in parts) ** 0.5


def nearest_colour(value: str) -> StandardColour:
    """Die nächste Standardfarbe zu einer Katalogfarbe."""
    return min(STANDARD, key=lambda colour: distance(value, colour.hex))


def palette() -> list[dict[str, str]]:
    """Die Standardfarben in der Form des Bündels."""
    return [{"key": colour.key, "hex": colour.hex} for colour in STANDARD]
