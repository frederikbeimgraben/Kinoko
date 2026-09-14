import { ChangeDetectionStrategy, Component, computed, input, signal, type OnDestroy } from '@angular/core';

export type SkeletonKind = 'row' | 'tile' | 'card' | 'block' | 'grid' | 'line';

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

  private readonly timer = setTimeout(() => {
    this.visible.set(true);
  }, DELAY_MS);

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }
}
