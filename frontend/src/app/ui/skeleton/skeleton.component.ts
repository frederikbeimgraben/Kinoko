import { ChangeDetectionStrategy, Component, computed, input, signal, type OnDestroy } from '@angular/core';

export type SkeletonKind = 'row' | 'tile' | 'card' | 'block' | 'grid' | 'line' | 'rows' | 'tiles';

/** One `rows` entry: a leading circle, then two lines of a set width. */
export interface SkeletonRow {
  readonly lineA: string;
  readonly lineB: string;
}

const DELAY_MS = 300;

/** Platzhalterbalken. Er erscheint erst nach 300 ms, sonst flackert er. */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.skeleton--grid]': "kind() === 'grid'" },
  templateUrl: './skeleton.component.html',
  styleUrl: './skeleton.component.scss',
})
export class SkeletonComponent implements OnDestroy {
  readonly kind = input<SkeletonKind>('row');
  readonly count = input(1);
  /** Freie Breite und Höhe eines Balkens, wo eine Zeile ihr eigenes Maß hat. */
  readonly width = input<string>();
  readonly height = input<string>();

  protected readonly visible = signal(false);
  protected readonly bars = computed(() =>
    Array.from({ length: Math.max(1, this.count()) }, (_, index) => index),
  );
  protected readonly rows = computed<readonly SkeletonRow[]>(() =>
    this.bars().map((index) => ({
      lineA: `${45 + ((index * 17) % 35)}%`,
      lineB: `${30 + ((index * 11) % 25)}%`,
    })),
  );

  private readonly timer = setTimeout(() => {
    this.visible.set(true);
  }, DELAY_MS);

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
