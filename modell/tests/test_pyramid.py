"""The tile pyramid: the zoom span of a source, and the average up the levels."""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from pyramid import (
    ZOOM_BASE,
    ZOOM_CAP,
    block_box,
    block_grid,
    class_shares,
    coarsen,
    finest_zoom,
    from_byte,
    halve,
    have_up_to,
    read_tile,
    to_byte,
    to_mercator,
    write_tile,
)


def test_feinster_zoom_folgt_der_aufloesung():
    assert finest_zoom(10) == 14
    assert finest_zoom(25) == 13
    assert finest_zoom(30) == 13
    assert finest_zoom(90) == 12
    assert finest_zoom(250) == 10
    assert finest_zoom(500) == 9
    assert finest_zoom(5000) == 6


def test_deckel_und_boden_greifen():
    assert finest_zoom(1, cap=12) == 12
    assert finest_zoom(10, cap=ZOOM_CAP) == ZOOM_CAP
    assert finest_zoom(100_000) == ZOOM_BASE


def test_byte_null_heisst_ohne_daten():
    code = to_byte(np.array([np.nan, 0.0, 0.5, 1.0], dtype="float32"))
    assert code.dtype == np.uint8
    assert code[0] == 0
    assert code[1] == 1
    assert code[3] == 255
    back = from_byte(code)
    assert np.isnan(back[0])
    assert back[1] == pytest.approx(0.0)
    assert back[2] == pytest.approx(0.5, abs=1.0 / 254)
    assert back[3] == pytest.approx(1.0)


def test_mittel_ueber_vier_kinder():
    fein = to_byte(np.array([[0.0, 1.0], [1.0, 1.0]], dtype="float32"))
    grob = halve(fein)
    assert grob.shape == (1, 1)
    assert from_byte(grob)[0, 0] == pytest.approx(0.75, abs=1.0 / 254)


def test_kind_ohne_daten_zaehlt_nicht_mit():
    fein = to_byte(np.array([[np.nan, 1.0], [np.nan, 0.0]], dtype="float32"))
    grob = halve(fein)
    assert from_byte(grob)[0, 0] == pytest.approx(0.5, abs=1.0 / 254)


def test_vier_kinder_ohne_daten_geben_keine_daten():
    fein = np.zeros((2, 2), dtype="uint8")
    assert halve(fein)[0, 0] == 0


def test_naht_haelt_das_flaechenmittel():
    rng = np.random.default_rng(7)
    fein = to_byte(rng.random((512, 512)).astype("float32"))
    z13 = halve(fein)
    z12 = halve(z13)
    mittel = [float(np.nanmean(from_byte(stufe))) for stufe in (fein, z13, z12)]
    assert mittel[1] == pytest.approx(mittel[0], abs=2.0 / 254)
    assert mittel[2] == pytest.approx(mittel[0], abs=2.0 / 254)


def test_naht_haelt_das_mittel_mit_luecken():
    rng = np.random.default_rng(11)
    werte = rng.random((512, 512)).astype("float32")
    werte[rng.random(werte.shape) < 0.6] = np.nan
    fein = to_byte(werte)
    grob = halve(fein)
    assert float(np.nanmean(from_byte(grob))) == pytest.approx(
        float(np.nanmean(from_byte(fein))), abs=0.02)


def test_klassenanteil_aus_einem_rasterblock():
    block = np.array([[8, 3], [0, 9]], dtype="uint8")
    anteile = class_shares(block, {"fichte": (8,), "nadelholz": (8, 9, 10)})
    assert np.isnan(anteile["fichte"][1, 0])
    assert anteile["fichte"][0, 0] == 1.0
    assert anteile["fichte"][0, 1] == 0.0
    assert anteile["nadelholz"][1, 1] == 1.0


def test_kachel_schreiben_und_lesen(tmp_path):
    code = to_byte(np.full((256, 256), 0.25, dtype="float32"))
    assert write_tile(tmp_path, 14, 3, 5, code) is True
    datei = tmp_path / "14" / "3" / "5.png"
    assert datei.exists()
    assert np.array_equal(read_tile(tmp_path, 14, 3, 5), code)
    assert read_tile(tmp_path, 14, 3, 6) is None


def test_leere_kachel_wird_nicht_geschrieben(tmp_path):
    assert write_tile(tmp_path, 14, 1, 1, np.zeros((256, 256), dtype="uint8")) is False
    assert not (tmp_path / "14").exists()


def test_coarsen_baut_die_stufen_darunter(tmp_path):
    for x, y in ((8, 10), (9, 10), (8, 11)):
        write_tile(tmp_path, 12, x, y, to_byte(np.full((256, 256), 1.0, dtype="float32")))
    geschrieben = coarsen(tmp_path, 12, 10)
    assert sorted(geschrieben) == [(10, 2, 2), (11, 4, 5)]
    eltern = from_byte(read_tile(tmp_path, 11, 4, 5))
    assert eltern[0, 0] == pytest.approx(1.0)
    # Das vierte Kind fehlt. Sein Viertel der Elternkachel bleibt ohne Daten.
    assert np.isnan(eltern[255, 255])


def test_coarsen_laesst_leere_gebiete_aus(tmp_path):
    write_tile(tmp_path, 12, 100, 100, to_byte(np.full((256, 256), 0.5, dtype="float32")))
    write_tile(tmp_path, 12, 400, 400, to_byte(np.full((256, 256), 0.5, dtype="float32")))
    geschrieben = coarsen(tmp_path, 12, 11)
    assert sorted(geschrieben) == [(11, 50, 50), (11, 200, 200)]


def test_geschriebene_kachel_ist_ein_graubild(tmp_path):
    write_tile(tmp_path, 14, 0, 0, to_byte(np.full((256, 256), 0.5, dtype="float32")))
    with Image.open(tmp_path / "14" / "0" / "0.png") as bild:
        assert bild.mode == "L"
        assert bild.size == (256, 256)


def test_mercator_trifft_den_nullpunkt_und_die_ecke():
    assert to_mercator(0.0, 0.0) == pytest.approx((0.0, 0.0), abs=1e-6)
    x, y = to_mercator(180.0, 85.051129)
    assert x == pytest.approx(20037508.34, abs=1.0)
    assert y == pytest.approx(20037508.34, abs=1.0)


def test_bloecke_decken_den_ausschnitt_mit_ganzen_kacheln():
    kasten = (9.0, 48.5, 9.2, 48.7)
    bloecke = block_grid(kasten, 14, 16)
    assert len(bloecke) >= 1
    west, south = to_mercator(kasten[0], kasten[1])
    east, north = to_mercator(kasten[2], kasten[3])
    raender = [block_box(bx, by, 14, 16) for bx, by in bloecke]
    assert min(r[0] for r in raender) <= west
    assert min(r[1] for r in raender) <= south
    assert max(r[2] for r in raender) >= east
    assert max(r[3] for r in raender) >= north


def test_blockrand_ist_der_rand_ganzer_kacheln():
    from tiles import kachelbox

    assert block_box(3, 7, 14, 16) == kachelbox(48, 112, 63, 127, 14)


def test_have_endet_an_der_kappe():
    gefuellt = [(9, 1, 1), (10, 2, 2), (11, 4, 4), (14, 30, 30)]
    assert have_up_to(gefuellt, 10) == {"9": ["1/1"], "10": ["2/2"]}
