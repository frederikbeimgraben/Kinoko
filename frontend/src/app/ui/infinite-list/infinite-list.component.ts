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
import { SKELETON_PRESETS, SkeletonComponent, type SkeletonPresetName } from '../skeleton/skeleton.component';

export type PageSize = 40 | 50;

/** A paged list. It loads the next page on scroll and keeps the scroll position. */
@Component({
  selector: 'app-infinite-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScrollFadeDirective, SkeletonComponent],
  templateUrl: './infinite-list.component.html',
  styleUrl: './infinite-list.component.scss',
})
export class InfiniteListComponent implements OnDestroy {
  readonly pageSize = input<PageSize>(40);
  /** True when a next page exists. Without one, the sentinel stays silent. */
  readonly hasMore = input(true);
  /** True while a page loads. This prevents a second request. */
  readonly pending = input(false);
  /** A card frame: the border and the radius stay, only the rows scroll in it. */
  readonly framed = input(false);

  /** The rows of the skeleton while a page loads. They have the shape of the rows of the list. */
  readonly skeleton = input<SkeletonPresetName>('species');

  readonly more = output();

  protected readonly skeletonCount = computed(() => Math.min(3, this.pageSize()));
  protected readonly preset = computed(() => SKELETON_PRESETS[this.skeleton()]);

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
