"""The forecast horizons: which column is knowable, and which model a week takes."""

from __future__ import annotations

from datetime import date

import pytest
from horizons import (HORIZONS, activity_names, forecast_weeks, horizon_for,
                      knowable, shared_horizon)


def test_die_kette_traegt_die_horizonte_null_bis_vier():
    assert HORIZONS == (0, 1, 2, 3, 4)


def test_horizont_null_kennt_jede_spalte():
    for name in ("pr_lag0", "pr_sum4", "tas_anom", "tas_drop_2w", "n_records"):
        assert knowable(name, 0) is True


def test_ein_lag_gilt_ab_seinem_eigenen_abstand():
    assert knowable("pr_lag2", 2) is True
    assert knowable("pr_lag2", 3) is False
    assert knowable("tasmin_lag8", 4) is True
    assert knowable("tas_lag0", 1) is False


def test_fenster_anomalie_und_sturz_reichen_in_die_zukunft():
    for name in ("pr_sum4", "tas_mean2", "pr_sum8_anom", "tas_drop_4w"):
        assert knowable(name, 1) is False


def test_eine_spalte_ohne_wetter_bleibt_bekannt():
    for name in ("n_records", "iso_week", "tree_spruce_1km", "prior_rate_cell"):
        assert knowable(name, 4) is True


def test_die_zahl_der_wetterspalten_faellt_mit_dem_horizont():
    spalten = [f"{v}_lag{k}" for v in ("pr", "tas", "tasmin")
               for k in (0, 1, 2, 3, 4, 6, 8)]
    zahl = [sum(knowable(c, h) for c in spalten) for h in HORIZONS]
    assert zahl == [21, 18, 15, 12, 9]


def test_aktivitaet_traegt_den_horizont_im_namen():
    assert activity_names(0) == ["activity_rate_7d", "activity_rate_14d",
                                 "activity_rate_21d"]
    assert activity_names(3) == ["activity_rate_7d_h3", "activity_rate_14d_h3",
                                 "activity_rate_21d_h3"]


def test_eine_ist_woche_nimmt_horizont_null():
    assert horizon_for(week_id=1000, observed_last=1000, available=(0, 2)) == 0
    assert horizon_for(week_id=999, observed_last=1000, available=(0, 2)) == 0


def test_eine_prognosewoche_nimmt_ihren_abstand():
    verfuegbar = (0, 1, 2, 3, 4)
    assert horizon_for(1001, 1000, verfuegbar) == 1
    assert horizon_for(1003, 1000, verfuegbar) == 3
    assert horizon_for(1004, 1000, verfuegbar) == 4


def test_eine_luecke_nimmt_den_naechst_strengeren_horizont():
    # Ein Modell fuer zwei Wochen liest keine Spalte, die der Woche eins
    # voraus fehlt.
    assert horizon_for(1001, 1000, (0, 2)) == 2


def test_ein_fehlender_horizont_bricht_ab():
    with pytest.raises(SystemExit) as fehler:
        horizon_for(1003, 1000, (0, 2))
    assert "3" in str(fehler.value)


def test_ohne_ist_woche_gilt_horizont_null():
    assert horizon_for(1003, None, (0, 2)) == 0


def test_die_zahl_der_prognosewochen_kommt_aus_dem_datum():
    # Montag der KW 38, letzte volle Ist-Woche KW 36: zwei Wochen Rueckstand
    # plus zwei Wochen Vorlauf.
    assert forecast_weeks(date(2026, 9, 19), (2026, 36)) == 4
    assert forecast_weeks(date(2026, 9, 19), (2026, 37)) == 3
    assert forecast_weeks(date(2026, 9, 19), (2026, 38)) == 2


def test_die_prognose_endet_am_groessten_gemeinsamen_horizont():
    assert forecast_weeks(date(2026, 9, 19), (2026, 36), cap=2) == 2
    assert forecast_weeks(date(2026, 9, 19), (2026, 36), cap=4) == 4


def test_die_prognose_ueberspringt_den_jahreswechsel():
    assert forecast_weeks(date(2026, 1, 8), (2025, 52)) == 4


def test_die_prognose_bleibt_bei_null_ohne_ist_woche():
    assert forecast_weeks(date(2026, 9, 19), None) == 0


def test_der_gemeinsame_horizont_ist_der_kleinste_groesste():
    assert shared_horizon([{0, 1, 2, 3, 4}, {0, 1, 2}]) == 2
    assert shared_horizon([{0, 2}]) == 2
    assert shared_horizon([]) == 0


def test_der_gemeinsame_horizont_kennt_keine_luecke():
    assert shared_horizon([{0, 2}, {0, 1, 2, 3}]) == 2
