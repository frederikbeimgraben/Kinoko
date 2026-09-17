"""The coarse-input sampler, on grids whose answer is known by hand.

A coarse grid of 5 km cells feeds a fine grid of 500 m cells, the two
resolutions the chain uses.
"""

from __future__ import annotations

import numpy as np
import pytest
from coarse_inputs import (COARSE_INPUTS, MIN_WEIGHT, SHARP_COLUMNS,
                           CoarseSampler, smoothed_columns, split_keys)

COARSE_M, FINE_M = 5_000, 500
SIDE = 12


def coarse_grid(side: int = SIDE):
    """Cell indices of a square coarse grid, row by row."""
    cy, cx = np.mgrid[0:side, 0:side]
    return cx.ravel(), cy.ravel()


def fine_points(side: int = SIDE):
    """Centers of the fine cells that cover the coarse grid."""
    n = side * COARSE_M // FINE_M
    j, i = np.mgrid[0:n, 0:n]
    x = (i.ravel() + 0.5) * FINE_M
    y = (j.ravel() + 0.5) * FINE_M
    return x, y, (n, n)


def sampler(side: int = SIDE, **options) -> tuple[CoarseSampler, tuple[int, int]]:
    cx, cy = coarse_grid(side)
    x, y, shape = fine_points(side)
    return CoarseSampler(cx, cy, x, y, COARSE_M, **options), shape


def step_ratio(field: np.ndarray) -> float:
    """Jump at a coarse cell border against the jump inside a cell.

    A field that carries the coarse grid steps only at the border, so the
    ratio is large. A field without cell steps gives about one.
    """
    per_cell = COARSE_M // FINE_M
    jump = np.abs(np.diff(field, axis=1))
    edge = (np.arange(field.shape[1] - 1) + 1) % per_cell == 0
    inside = float(np.nanmean(jump[:, ~edge]))
    return float(np.nanmean(jump[:, edge]) / max(inside, 1e-12))


def test_a_constant_field_keeps_its_value():
    fine, _ = sampler()
    out = fine.sample(np.full(SIDE * SIDE, 3.5, dtype="float32"))
    assert np.allclose(out, 3.5, atol=1e-5)


def test_the_mean_survives_the_filter():
    fine, _ = sampler()
    rng = np.random.default_rng(3)
    values = rng.normal(10.0, 2.0, SIDE * SIDE).astype("float32")
    out = fine.sample(values)
    assert np.nanmean(out) == pytest.approx(float(values.mean()), rel=0.02)


def test_the_cell_steps_disappear():
    rng = np.random.default_rng(5)
    values = rng.normal(0.0, 1.0, SIDE * SIDE).astype("float32")
    fine, shape = sampler()
    blocky = np.repeat(np.repeat(values.reshape(SIDE, SIDE),
                                 COARSE_M // FINE_M, axis=0),
                       COARSE_M // FINE_M, axis=1)
    assert step_ratio(blocky) > 50.0
    assert step_ratio(fine.sample(values).reshape(shape)) < 1.5


def test_the_result_matches_the_fine_grid():
    fine, shape = sampler()
    out = fine.sample(np.zeros(SIDE * SIDE, dtype="float32"))
    assert out.shape == (shape[0] * shape[1],)
    assert fine.n_points == shape[0] * shape[1]


def test_a_ramp_keeps_its_slope():
    # Der Gauss-Filter und die bilineare Ablesung sind beide linear, ein
    # Anstieg kommt also unveraendert an. Der Rand zieht nach innen, bis
    # drei grobe Zellen weit.
    cx, cy = coarse_grid()
    fine, shape = sampler()
    out = fine.sample((cx * 2.0).astype("float32")).reshape(shape)
    rand = 3 * COARSE_M // FINE_M
    inner = out[rand:-rand, rand:-rand]
    x = (np.arange(shape[1])[None, :] + 0.5) * FINE_M / COARSE_M - 0.5
    want = (2.0 * x)[:, rand:-rand]
    assert np.allclose(inner, np.broadcast_to(want, inner.shape), atol=1e-4)


def test_a_point_without_cover_stays_empty():
    cx, cy = coarse_grid()
    values = np.where(cx < 4, 1.0, np.nan).astype("float32")
    fine, shape = sampler()
    out = fine.sample(values).reshape(shape)
    assert np.isfinite(out[:, :30]).all()
    assert np.isnan(out[:, 60:]).all()


def test_a_point_outside_the_raster_stays_empty():
    cx, cy = coarse_grid()
    far = np.array([SIDE * COARSE_M * 2.0, -COARSE_M * 2.0])
    fine = CoarseSampler(cx, cy, far, far, COARSE_M)
    assert np.isnan(fine.sample(np.ones(SIDE * SIDE, dtype="float32"))).all()


def test_many_columns_match_one_column():
    fine, _ = sampler()
    rng = np.random.default_rng(11)
    block = rng.normal(0.0, 1.0, (SIDE * SIDE, 3)).astype("float32")
    many = fine.sample(block)
    assert many.shape == (fine.n_points, 3)
    for j in range(3):
        assert np.allclose(many[:, j], fine.sample(block[:, j]), equal_nan=True)


def test_a_count_of_visits_stays_sharp():
    assert SHARP_COLUMNS == {"prior_n_cell", "prior_n_block"}
    columns = ["prior_rate_cell", "prior_n_cell", "prior_rate_block", "prior_n_block"]
    assert smoothed_columns(columns) == ["prior_rate_cell", "prior_rate_block"]


def test_only_the_named_sources_are_coarse():
    assert set(COARSE_INPUTS) == {"weather", "prior_cell", "prior_block"}
    assert COARSE_INPUTS["weather"] == 5_000
    assert COARSE_INPUTS["prior_block"] == 25_000


def test_the_keys_of_the_chain_split_into_indices():
    cx, cy = split_keys(["807_567", "-3_-4", "0_0"])
    assert cx.tolist() == [807, -3, 0]
    assert cy.tolist() == [567, -4, 0]


def test_the_weight_threshold_holds_a_lone_cell():
    # Eine einzelne Zelle traegt ihre Umgebung nur, solange das Gewicht ueber
    # MIN_WEIGHT liegt. Weiter draussen bleibt die Karte leer.
    cx, cy = coarse_grid()
    values = np.where((cx == 6) & (cy == 6), 1.0, np.nan).astype("float32")
    fine, shape = sampler()
    out = fine.sample(values).reshape(shape)
    assert np.isfinite(out).any()
    assert np.allclose(out[np.isfinite(out)], 1.0, atol=1e-5)
    assert np.isnan(out[0, 0])
    assert MIN_WEIGHT > 0.0
