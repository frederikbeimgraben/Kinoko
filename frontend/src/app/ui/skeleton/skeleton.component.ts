import { ChangeDetectionStrategy, Component, computed, input, signal, type OnDestroy } from '@angular/core';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** `rows`, `tiles` and `block` per `Skeleton.dc.html`, `line` per `.skel.line`, `map` per `.skmap`. */
export type SkeletonKind = 'rows' | 'tiles' | 'block' | 'line' | 'map';

/** The part before the lines of a row: a 44 px thumb, a 40 px circle, a 24 px icon or nothing. */
export type SkeletonLead = 'thumb' | 'circle' | 'icon' | 'none';

/** The part after the lines of a row: a badge pill, a dim chevron or a short value line. */
export type SkeletonTrail = 'none' | 'badge' | 'chevron' | 'value';

/** `plain` is the kit `.skrow`, `item` is a 72 px `.item`, `row` is a 56 px `.row` card in a group. */
export type SkeletonShape = 'plain' | 'item' | 'row';

/** One row: the widths of its lines. */
export interface SkeletonRow {
  readonly lines: readonly string[];
}

/** A group of rows. A section with a label starts with a `.lbl` line. */
export interface SkeletonSection {
  readonly label: boolean;
  readonly rows: readonly SkeletonRow[];
}

/** The row options of a list preset. */
export interface SkeletonPreset {
  readonly lead: SkeletonLead;
  readonly trail: SkeletonTrail;
  readonly shape: SkeletonShape;
  readonly lines: 1 | 2 | 3;
}

/** The name of a list preset: species rows, entry items or a group of plain rows. */
export type SkeletonPresetName = 'species' | 'entries' | 'rows';

/** The rows of each list preset. Each preset has the shape of the rows of its list. */
export const SKELETON_PRESETS: Readonly<Record<SkeletonPresetName, SkeletonPreset>> = {
  species: { lead: 'thumb', trail: 'none', shape: 'plain', lines: 2 },
  entries: { lead: 'thumb', trail: 'chevron', shape: 'item', lines: 2 },
  rows: { lead: 'none', trail: 'none', shape: 'row', lines: 1 },
};

const DELAY_MS = 300;

/** The line widths in percent per row index. The widths change from row to row, as in real text. */
const WIDTHS: readonly ((index: number) => number)[] = [
  (index) => 45 + ((index * 17) % 35),
  (index) => 30 + ((index * 11) % 25),
  (index) => 55 + ((index * 13) % 30),
];

/** The single line of a `row` shape is a label: it is shorter. */
const LABEL_WIDTH = (index: number): number => 30 + ((index * 7) % 15);

/** Splits the rows at each label index into sections. */
export function skeletonSections(
  count: number,
  labels: readonly number[],
  row: (index: number) => SkeletonRow,
): SkeletonSection[] {
  const starts = [...new Set([0, ...labels.filter((at) => at > 0 && at < count)])].sort((a, b) => a - b);
  return starts.map((start, part) => {
    const end = starts[part + 1] ?? count;
    return {
      label: labels.includes(start),
      rows: Array.from({ length: Math.max(0, end - start) }, (_, offset) => row(start + offset)),
    };
  });
}

/**
 * A placeholder in the shape of the content. It shows after 300 ms and shimmers unless motion is reduced.
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  host: { 'aria-hidden': 'true', '[class.skeleton--map]': "kind() === 'map'" },
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.scss',
})
export class SkeletonComponent implements OnDestroy {
  readonly kind = input<SkeletonKind>('rows');
  readonly count = input(1);
  readonly lead = input<SkeletonLead>('thumb');
  readonly trail = input<SkeletonTrail>('none');
  readonly shape = input<SkeletonShape>('plain');
  /** The row indexes where a section with a `.lbl` line starts. */
  readonly labels = input<readonly number[]>([]);
  /** The number of text lines in each row. */
  readonly lines = input<1 | 2 | 3>(2);
  /** The number of columns of `tiles`. */
  readonly cols = input(3);
  /** A CSS width for `line` and `block`. */
  readonly width = input<string>();
  /** A CSS height for `line`, `block` and each tile of `tiles`. */
  readonly height = input<string>();
  /** A CSS radius for `block`, for example the radius of a hero. */
  readonly radius = input<string>();

  protected readonly visible = signal(false);
  protected readonly bars = computed(() =>
    Array.from({ length: Math.max(1, this.count()) }, (_, index) => index),
  );
  protected readonly sections = computed(() => {
    const single = this.shape() === 'row' && this.lines() === 1;
    return skeletonSections(Math.max(1, this.count()), this.labels(), (index) => ({
      lines: single
        ? [`${LABEL_WIDTH(index)}%`]
        : WIDTHS.slice(0, this.lines()).map((width) => `${width(index)}%`),
    }));
  });

  private readonly timer = setTimeout(() => {
    this.visible.set(true);
  }, DELAY_MS);

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
