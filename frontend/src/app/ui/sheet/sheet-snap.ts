/** The three detents of a sheet, from bottom to top. */
export type Detent = 0 | 1 | 2;

/** One pointer position during a drag: time in ms and the sheet height in px. */
export interface DragSample {
  readonly time: number;
  readonly height: number;
}

/** A drag of the sheet: the start, the detent sizes in px measured at the start, and the samples. */
export interface Drag {
  readonly pointer: number;
  readonly startY: number;
  readonly startX: number;
  readonly startHeight: number;
  sizes: readonly [number, number, number];
  samples: DragSample[];
  moved: boolean;
  captured: boolean;
}

/** Above this speed in px/ms, a release goes to the next detent in its direction. */
export const FLING_SPEED = 0.5;

/** The speed comes from the samples of this last time span in ms. */
export const VELOCITY_WINDOW = 80;

/** Above the top detent, the sheet follows the finger with this share of the movement. */
export const RUBBER_BAND = 0.3;

// Below this movement in px, a release keeps the detent: a small wobble is no drag.
const DRAG_THRESHOLD = 24;

const DETENTS: readonly Detent[] = [0, 1, 2];

/** The speed in px/ms of the samples in the window before the release time. A positive value moves the sheet up. */
export function releaseVelocity(samples: readonly DragSample[], now: number): number {
  const recent = samples.filter((sample) => now - sample.time <= VELOCITY_WINDOW);
  const first = recent.at(0);
  const last = recent.at(-1);
  if (first === undefined || last === undefined) return 0;
  const span = last.time - first.time;
  return span > 0 ? (last.height - first.height) / span : 0;
}

/** The height the sheet shows for a finger height: above `top`, it resists. */
export function rubberBand(height: number, top: number): number {
  return height <= top ? height : top + (height - top) * RUBBER_BAND;
}

/** The detent nearest to the height. Under the threshold, the current detent stays. */
export function nearestDetent(sizes: readonly number[], current: Detent, height: number): Detent {
  if (Math.abs(height - sizes[current]) < DRAG_THRESHOLD) return current;
  return closest(DETENTS, sizes, current, height);
}

/** The detent after a release. A fling goes to the next size in its direction, a slow release to the nearest.
 * `null` means a fling down below the lowest size. */
export function releaseDetent(
  sizes: readonly number[],
  current: Detent,
  height: number,
  velocity: number,
): Detent | null {
  if (Math.abs(velocity) <= FLING_SPEED) return nearestDetent(sizes, current, height);
  const up = velocity > 0;
  const ahead = DETENTS.filter((candidate) => (up ? sizes[candidate] > height : sizes[candidate] < height));
  if (ahead.length === 0) return up ? closest(DETENTS, sizes, current, Math.max(...sizes)) : null;
  return closest(ahead, sizes, current, height);
}

// On a tie the current detent wins, so a sheet with equal sizes keeps its detent.
function closest(
  candidates: readonly Detent[],
  sizes: readonly number[],
  current: Detent,
  height: number,
): Detent {
  const distance = (detent: Detent): number => Math.abs(sizes[detent] - height);
  const start = candidates.includes(current) ? current : candidates[0];
  return candidates.reduce(
    (best, candidate) => (distance(candidate) < distance(best) ? candidate : best),
    start,
  );
}
