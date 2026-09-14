import pytest

from app.modules.catalog import colours


def test_twelve_standard_colours() -> None:
    assert len(colours.STANDARD) == 12
    assert len({colour.key for colour in colours.STANDARD}) == 12
    assert len({colour.hex for colour in colours.STANDARD}) == 12


@pytest.mark.parametrize(
    ("value", "key"),
    [
        ("#ffffff", "white"),
        ("#000000", "black"),
        ("#7a5230", "brown"),
        ("#6f8438", "green"),
        ("#e8c33a", "yellow"),
        ("#c0392b", "red"),
        ("#6e6435", "brown"),
        ("#f5f0d8", "cream"),
        ("#b0b0b0", "grey"),
        ("#8a4b9c", "violet"),
        ("#2f6fb0", "blue"),
        ("#f0a8c0", "pink"),
        ("#d97b1f", "orange"),
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
    assert palette[0] == {"key": "white", "hex": "#ffffff"}
    assert len(palette) == 12
