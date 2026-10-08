/** The kit pane in the desktop column: `panel` 420, `middle` 640 and `list` 520 px.
 * `own` keeps the base width for a section that draws its own columns. */
export type DeskPane = 'panel' | 'middle' | 'list' | 'own';

/** The desktop frame of a section. */
export interface DeskFrame {
  readonly pane: DeskPane;
  /** True when the route fills the column and the map area and draws its own detail pane. */
  readonly full: boolean;
}

const FRAMES: Readonly<Record<string, DeskFrame>> = {
  '/karte': { pane: 'panel', full: false },
  '/arten': { pane: 'middle', full: true },
  '/taxonomie': { pane: 'middle', full: false },
  '/eintraege': { pane: 'list', full: false },
  '/konto': { pane: 'list', full: true },
  '/verwaltung': { pane: 'own', full: true },
};

const OTHER: DeskFrame = { pane: 'list', full: false };

/** The value of `--size-column` for each pane; `null` keeps the base value of `tokens.scss`. */
const PANE_WIDTH: Readonly<Record<DeskPane, string | null>> = {
  panel: 'var(--w-pane-panel)',
  middle: 'var(--w-pane-middle)',
  list: 'var(--w-pane-list)',
  own: null,
};

/** The desktop frame for the first part of the path, for example `/arten`. */
export function deskFrame(section: string): DeskFrame {
  return FRAMES[section] ?? OTHER;
}

/** The column width of a pane as a CSS value, or `null` for the base width. */
export function paneWidth(pane: DeskPane): string | null {
  return PANE_WIDTH[pane];
}
