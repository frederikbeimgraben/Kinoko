"""The layers that come from a source finer than the map grid."""

from __future__ import annotations

import numpy as np
import pytest

from fine_layers import (RASTERS, TREES, WALD, layer_value, layer_zoom,
                         scale_field, tree_fields)
from pyramid import ZOOM_CAP, finest_zoom, from_byte, to_byte


def test_jede_ebene_nennt_eine_aufloesung():
    for name, layer in {**TREES, **RASTERS}.items():
        assert layer.resolution > 0, name
        assert layer.low < layer.high, name
        assert layer.label, name


def test_zoom_folgt_der_quelle_je_ebene():
    assert layer_zoom(TREES["fichte"]) == 13
    assert layer_zoom(RASTERS["hoehe"]) == 12
    assert layer_zoom(RASTERS["hangneigung"]) == 12
    assert layer_zoom(RASTERS["boden_ph"]) == 10
    assert layer_zoom(TREES["fichte"], cap=11) == 11


def test_deckel_gilt_fuer_jede_ebene():
    for layer in {**TREES, **RASTERS}.values():
        assert layer_zoom(layer) <= ZOOM_CAP
        assert layer_zoom(layer) == finest_zoom(layer.resolution)


def test_baumart_ist_der_anteil_an_der_waldflaeche():
    block = np.array([[8, 3], [0, 9]], dtype="uint8")
    fields = tree_fields(block, np.ones(block.shape, dtype="uint8"))
    assert fields["fichte"][0, 0] == 1.0
    assert fields["fichte"][0, 1] == 0.0
    assert np.isnan(fields["fichte"][1, 0])
    assert fields["nadelholz"][1, 1] == 1.0


def test_wald_zaehlt_den_boden_mit_und_endet_an_der_grenze():
    block = np.array([[8, 0], [0, 9]], dtype="uint8")
    inland = np.array([[1, 1], [0, 1]], dtype="uint8")
    fields = tree_fields(block, inland)
    assert fields[WALD][0, 0] == 1.0
    # Kein Wald, aber Deutschland: der Waldanteil ist null.
    assert fields[WALD][0, 1] == 0.0
    # Ausserhalb Deutschlands steht kein Wert.
    assert np.isnan(fields[WALD][1, 0])
    assert fields[WALD][1, 1] == 1.0


def test_baumart_bleibt_ohne_wert_wo_kein_wald_steht():
    block = np.array([[0, 0]], dtype="uint8")
    fields = tree_fields(block, np.ones(block.shape, dtype="uint8"))
    assert np.isnan(fields["fichte"]).all()


def test_skala_legt_ein_rasterfeld_auf_null_bis_eins():
    layer = RASTERS["hoehe"]
    feld = np.array([layer.low, (layer.low + layer.high) / 2, layer.high,
                     np.nan], dtype="float32")
    anteil = scale_field(feld, layer)
    assert anteil[0] == pytest.approx(0.0)
    assert anteil[1] == pytest.approx(0.5, abs=0.01)
    assert anteil[2] == pytest.approx(1.0)
    assert np.isnan(anteil[3])


def test_skala_und_byte_geben_den_wert_zurueck():
    layer = RASTERS["hoehe"]
    werte = np.array([100.0, 600.0, 1200.0], dtype="float32")
    zurueck = layer_value(from_byte(to_byte(scale_field(werte, layer))), layer)
    assert zurueck == pytest.approx(werte, abs=(layer.high - layer.low) / 254)


def test_einheit_der_quelle_wird_die_einheit_der_ebene():
    layer = RASTERS["boden_ph"]
    # SoilGrids speichert den pH mal zehn.
    anteil = scale_field(np.array([65.0], dtype="float32"), layer)
    assert layer_value(anteil, layer)[0] == pytest.approx(
        6.5, abs=(layer.high - layer.low) / 254)


def test_nodata_der_quelle_wird_kein_wert():
    layer = RASTERS["boden_ph"]
    feld = np.array([layer.nodata, 65.0], dtype="float32")
    anteil = scale_field(feld, layer)
    assert np.isnan(anteil[0])
    assert not np.isnan(anteil[1])
