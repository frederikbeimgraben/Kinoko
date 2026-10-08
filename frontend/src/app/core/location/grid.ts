// The grid for coarse locations. The service rounds before it saves; this file only reads and labels the value.
// Both sides use the same cell size, so the UI and the database agree.

/** Cell size in kilometers, as `shared.geometry.coarse` rounds it. */
export const GRID_KM = 1;

/**
 * Two decimal places are approximately one kilometer. More digits show a false precision.
 */
export const COARSE_DIGITS = 2;
