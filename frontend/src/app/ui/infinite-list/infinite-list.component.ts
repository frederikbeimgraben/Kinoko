import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  input,
  output,
  viewChild,
  type OnDestroy,
} from '@angular/core';
import { ScrollFadeDirective } from '../scroll-fade/scroll-fade.directive';
import { SkeletonComponent } from '../skeleton/skeleton.component';

export type PageSize = 40 | 50;

/** Liste mit Seiten. Sie lädt beim Scrollen nach und merkt die Position. */
@Component({
  selector: 'app-infinite-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollFadeDirective, SkeletonComponent],
  templateUrl: './infinite-list.component.html',
  styleUrl: './infinite-list.component.scss',
})
export class InfiniteListComponent implements OnDestroy {
  readonly pageSize = input<PageSize>(40);
  /** Ob eine weitere Seite existiert. Ohne sie bleibt der Fühler stumm. */
  readonly hasMore = input(true);
  /** Ob gerade eine Seite lädt. Verhindert doppelte Anfragen. */
  readonly pending = input(false);
  /** Kartenrahmen: Rand und Radius stehen fest, nur die Zeilen scrollen darin. */
  readonly framed = input(false);

  readonly more = output();

  protected readonly skeletonCount = computed(() => Math.min(3, this.pageSize()));

  private readonly sentinel = viewChild.required<ElementRef<HTMLElement>>('sentinel');
  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => {
      this.observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && this.hasMore() && !this.pending()) {
          this.more.emit();
        }
      });
      this.observer.observe(this.sentinel().nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
