import pytest

from app.modules.catalog import colours

#: Die zwölf des Bretts `FilterColour`, in seiner Reihenfolge.
BOARD = [
    ("white", "#f3efe6"),
    ("cream", "#e8d9b5"),
    ("yellow", "#e0b446"),
    ("orange", "#d1832f"),
    ("redBrown", "#a0522d"),
    ("brown", "#6b4423"),
    ("darkBrown", "#3e2a17"),
    ("olive", "#7f8a3a"),
    ("green", "#4f7a3a"),
    ("red", "#b8322a"),
    ("violet", "#7a3b6a"),
    ("grey", "#8a8f8a"),
]


def test_the_palette_is_the_one_of_the_board() -> None:
    assert [(colour.key, colour.hex) for colour in colours.STANDARD] == BOARD


@pytest.mark.parametrize(
    ("value", "key"),
    [
        ("#6b4423", "brown"),
        ("#5e3d22", "brown"),
        ("#7a5230", "brown"),
        ("#8a4e2b", "redBrown"),
        ("#4a3220", "darkBrown"),
        ("#e8d9b5", "cream"),
        ("#f3efe6", "white"),
        ("#8a9a5a", "olive"),
        ("#4a5a3a", "green"),
        ("#b8322a", "red"),
        ("#8a8f8a", "grey"),
        ("#7a3b6a", "violet"),
    ],
)
def test_nearest_colour(value: str, key: str) -> None:
    assert colours.nearest_colour(value).key == key


def test_a_standard_colour_maps_to_itself() -> None:
    for colour in colours.STANDARD:
        assert colours.nearest_colour(colour.hex).key == colour.key


def test_distance_is_zero_for_the_same_colour() -> None:
    assert colours.distance("#123456", "#123456") == 0.0


def test_palette_is_the_bundle_form() -> None:
    palette = colours.palette()
    assert palette[0] == {"key": "white", "hex": "#f3efe6"}
    assert len(palette) == 12
