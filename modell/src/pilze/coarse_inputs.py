#!/usr/bin/env python3
"""Put a coarse input raster on the fine grid of the map.

The weather comes on 5 km cells and the visit prior on 5 km cells and 25 km
blocks. The map works on 500 m cells. A lookup by cell key gives every fine
cell of a block the same value, so the picture shows the block and not the
place.

`CoarseSampler` filters the coarse field with a Gaussian kernel and reads it
at the fine cell centers with bilinear interpolation. The filter counts the
weight of the cells that hold a value. A missing cell adds no weight, and a
point below `MIN_WEIGHT` stays missing. The border of the array counts as
missing too, so the filter does not mirror land into the sea. A point outside
the coarse raster stays missing.

`COARSE_INPUTS` names every source that passes through here, with the cell
size of its raster. A sharp input, such as the forest share, the height or a
count of visits, is not in the list and keeps its own value.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence

import numpy as np
from scipy.ndimage import gaussian_filter

# source -> cell size of its raster, in meters
COARSE_INPUTS: dict[str, int] = {
    "weather": 5_000,
    "prior_cell": 5_000,
    "prior_block": 25_000,
}
# Columns of a coarse source that keep their own value. A count of visits is
# not a field: the model reads zero as "nobody looked here".
SHARP_COLUMNS: frozenset[str] = frozenset({"prior_n_cell", "prior_n_block"})
# The kernel width, in cells of the source. Half a cell.
SIGMA_CELLS = 0.5
MIN_WEIGHT = 0.3


def smoothed_columns(columns: Iterable[str]) -> list[str]:
    """The columns of a coarse source that the sampler smooths."""
    return [c for c in columns if c not in SHARP_COLUMNS]


def split_keys(keys: Sequence[str]) -> tuple[np.ndarray, np.ndarray]:
    """Split cell keys of the form ``"<x>_<y>"`` into two index arrays."""
    pairs = [k.split("_") for k in np.asarray(keys, dtype=str)]
    return (np.array([int(p[0]) for p in pairs], dtype="int64"),
            np.array([int(p[1]) for p in pairs], dtype="int64"))


class CoarseSampler:
    """Read a coarse field at fine points, after a Gaussian filter."""

    def __init__(self, cell_x: np.ndarray, cell_y: np.ndarray,
                 x: np.ndarray, y: np.ndarray, cell_m: int,
                 sigma_cells: float = SIGMA_CELLS,
                 min_weight: float = MIN_WEIGHT) -> None:
        cell_x = np.asarray(cell_x, dtype="int64")
        cell_y = np.asarray(cell_y, dtype="int64")
        if len(cell_x) != len(cell_y):
            raise ValueError("cell_x and cell_y must have the same length")
        self.cell_m = int(cell_m)
        self.sigma = float(sigma_cells)
        self.min_weight = float(min_weight)
        self.x0, self.y0 = int(cell_x.min()), int(cell_y.min())
        ny = int(cell_y.max()) - self.y0 + 1
        nx = int(cell_x.max()) - self.x0 + 1
        self.shape = (ny, nx)
        self.iy = cell_y - self.y0
        self.ix = cell_x - self.x0
        # A cell covers [i, i + 1) in cell units, so its center reads index i.
        row = np.asarray(y, dtype="float64") / self.cell_m - self.y0 - 0.5
        col = np.asarray(x, dtype="float64") / self.cell_m - self.x0 - 0.5
        self.n_points = len(row)
        inside = ((row >= -0.5) & (row <= ny - 0.5)
                  & (col >= -0.5) & (col <= nx - 0.5))
        self._corners, self._weights = self._plan(row, col, inside)

    def _plan(self, row: np.ndarray, col: np.ndarray, inside: np.ndarray):
        """Flat indices and weights of the four cells around every point."""
        ny, nx = self.shape
        r = np.clip(row, 0.0, ny - 1.0)
        c = np.clip(col, 0.0, nx - 1.0)
        r0, c0 = np.floor(r).astype("int64"), np.floor(c).astype("int64")
        r1, c1 = np.minimum(r0 + 1, ny - 1), np.minimum(c0 + 1, nx - 1)
        dr, dc = (r - r0).astype("float32"), (c - c0).astype("float32")
        corners = np.stack([r0 * nx + c0, r0 * nx + c1,
                            r1 * nx + c0, r1 * nx + c1]).astype("int32")
        share = np.stack([(1 - dr) * (1 - dc), (1 - dr) * dc,
                          dr * (1 - dc), dr * dc])
        return corners, np.where(inside, share, 0.0).astype("float32")

    @classmethod
    def from_keys(cls, keys: Sequence[str], x: np.ndarray, y: np.ndarray,
                  cell_m: int, **options) -> "CoarseSampler":
        cell_x, cell_y = split_keys(keys)
        return cls(cell_x, cell_y, x, y, cell_m, **options)

    def sample(self, values: np.ndarray) -> np.ndarray:
        """Values at the fine points, one row per point.

        `values` holds one row per coarse cell, in the order of the keys the
        sampler was built with. A one-dimensional input gives a
        one-dimensional result.
        """
        values = np.asarray(values, dtype="float32")
        flat = values.ndim == 1
        block = values[:, None] if flat else values
        if len(block) != len(self.ix):
            raise ValueError("values and cells must have the same length")
        out = np.empty((self.n_points, block.shape[1]), dtype="float32")
        for j in range(block.shape[1]):
            out[:, j] = self._column(block[:, j])
        return out[:, 0] if flat else out

    def _read(self, field: np.ndarray) -> np.ndarray:
        flat = field.ravel()
        return sum(flat[self._corners[k]] * self._weights[k] for k in range(4))

    def _column(self, column: np.ndarray) -> np.ndarray:
        field = np.full(self.shape, np.nan, dtype="float32")
        field[self.iy, self.ix] = column
        known = np.isfinite(field)
        total = gaussian_filter(np.where(known, field, 0.0), self.sigma,
                                mode="constant", cval=0.0)
        weight = gaussian_filter(known.astype("float32"), self.sigma,
                                 mode="constant", cval=0.0)
        at_weight = self._read(weight)
        return np.where(at_weight > self.min_weight,
                        self._read(total) / np.maximum(at_weight, 1e-6),
                        np.nan).astype("float32")
