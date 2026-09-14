import base64
import io
import math

import pytest
from PIL import Image

from app.core.errors import Invalid, TooLarge
from app.shared import geometry, images, paging
from app.shared.enums import PhotoSize
from app.shared.schema import Schema


class Example(Schema):
    long_name: str
    count: int


def test_schema_speaks_camel_case() -> None:
    assert Example(long_name="a", count=1).dumped() == {"longName": "a", "count": 1}
    assert Example.model_validate({"longName": "b", "count": 2}).long_name == "b"


def test_cursor_round_trip() -> None:
    assert paging.decode(paging.encode(40)) == 40
    assert paging.decode(paging.encode(0)) == 0


def test_broken_cursor_is_invalid() -> None:
    with pytest.raises(Invalid):
        paging.decode("nicht-base64!")
    with pytest.raises(Invalid):
        paging.decode(base64.urlsafe_b64encode(b"-3").decode())


def test_paging_params_read_the_query() -> None:
    assert paging.paging_params(limit=10, cursor=None) == paging.Paging(10, 0)
    assert paging.paging_params(limit=10, cursor=paging.encode(20)).offset == 20
    assert paging.small_paging_params().limit == 40
    assert paging.small_paging_params(limit=5, cursor=paging.encode(5)).offset == 5


def test_wrap_reports_the_next_cursor() -> None:
    page = paging.wrap(
        [Example(long_name=str(at), count=at) for at in range(3)],
        paging.Paging(2, 0),
        lambda item: item,
    )
    assert len(page["items"]) == 2
    assert paging.decode(page["nextCursor"]) == 2
    last = paging.wrap([], paging.Paging(2, 2), lambda item: item)
    assert last["nextCursor"] is None


SQUARE = [(10.0, 50.0), (10.01, 50.0), (10.01, 50.01), (10.0, 50.01), (10.0, 50.0)]


def test_area_of_a_square() -> None:
    assert math.isclose(geometry.area_ha(SQUARE), 79.5, rel_tol=0.05)
    assert geometry.area_ha([(0.0, 0.0)]) == 0.0


def test_point_in_polygon() -> None:
    assert geometry.point_in_polygon((10.005, 50.005), SQUARE)
    assert not geometry.point_in_polygon((11.0, 50.005), SQUARE)


def test_coarse_rounds_to_a_grid() -> None:
    assert geometry.coarse((10.0004, 50.0004)) == geometry.coarse((10.0, 50.0))
    far = geometry.coarse((10.05, 50.05))
    assert far != geometry.coarse((10.0, 50.0))


def test_bounds_and_bbox() -> None:
    assert geometry.bounds(SQUARE) == (10.0, 50.0, 10.01, 50.01)
    assert geometry.parse_bbox("10,50,11,51") == (10.0, 50.0, 11.0, 51.0)
    assert geometry.parse_bbox("10,50,11") is None
    assert geometry.parse_bbox("a,b,c,d") is None
    assert geometry.parse_bbox("11,50,10,51") is None


def a_photo(size: tuple[int, int] = (40, 30)) -> bytes:
    made = Image.new("RGB", size, (120, 80, 40))
    buffer = io.BytesIO()
    made.save(buffer, format="JPEG")
    return buffer.getvalue()


def test_accept_renders_three_sizes() -> None:
    rendered = images.accept(a_photo(), "image/jpeg", 1 << 20)
    assert rendered.width == 40
    assert set(rendered.files) == set(PhotoSize)


def test_accept_refuses_wrong_type_and_size() -> None:
    with pytest.raises(Invalid):
        images.accept(a_photo(), "text/plain", 1 << 20)
    with pytest.raises(TooLarge):
        images.accept(a_photo(), "image/jpeg", 10)
    with pytest.raises(Invalid):
        images.accept(b"kein Bild", "image/jpeg", 1 << 20)


def test_write_read_remove(tmp_path: object) -> None:
    import uuid
    from pathlib import Path

    root = Path(str(tmp_path))
    photo_id = uuid.uuid4()
    rendered = images.accept(a_photo(), "image/jpeg", 1 << 20)
    images.write(root, photo_id, rendered)
    assert images.read(root, photo_id, PhotoSize.THUMB)
    images.remove(root, photo_id)
    assert images.read(root, photo_id, PhotoSize.FULL) is None
    images.remove(root, photo_id)


def test_strip_metadata_drops_exif() -> None:
    made = Image.new("RGB", (8, 8), (1, 2, 3))
    made.info["exif"] = b"etwas"
    clean = images.strip_metadata(made)
    assert "exif" not in clean.info
    assert clean.size == made.size
