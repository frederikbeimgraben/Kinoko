import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { WeekButtonComponent } from './week-button.component';

/** A week of the manifest. `share` is `mean` divided by the peak. */
export interface TimelineWeek {
  year: number;
  week: number;
  share: number;
  forecast: boolean;
}

interface ShownWeek extends TimelineWeek {
  yearMark: boolean;
  key: string;
}

/** The scroll position of the strip and the hidden content on each side. */
interface ScrollState {
  left: number;
  width: number;
  scrollWidth: number;
}

const REST: ScrollState = { left: 0, width: 0, scrollWidth: 0 };

/** The weeks in a row with one tab stop. `align="end"` puts the slack and the fade only at the start. */
@Component({
  selector: 'app-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WeekButtonComponent, IconButtonComponent, TranslatePipe],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.scss',
})
export class TimelineComponent implements AfterViewInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly buttons = viewChildren(WeekButtonComponent);
  private readonly bar = viewChild.required<ElementRef<HTMLElement>>('bar');

  readonly weeks = input.required<readonly TimelineWeek[]>();
  readonly active = input<{ year: number; week: number } | null>(null);
  readonly label = input.required<string>();
  /** Dim and without a choice, for a fixed layer without a week. */
  readonly dimmed = input(false);
  /** Without a manifest, the strip shows a row of placeholders. */
  readonly loading = input(false);
  /** Where the slack of the strip goes: to both sides, or only to the start. */
  readonly align = input<'centre' | 'end'>('centre');

  /** Eight buttons, as many as a usual manifest has. */
  protected readonly placeholders = [0, 1, 2, 3, 4, 5, 6, 7];

  readonly chosen = output<TimelineWeek>();

  protected readonly shown = computed<ShownWeek[]>(() =>
    this.weeks().map((week, i, all) => ({
      ...week,
      yearMark: i > 0 && all[i - 1].year !== week.year,
      key: `${week.year}-${week.week}`,
    })),
  );

  protected readonly activeIndex = computed(() => {
    const active = this.active();
    if (!active) return 0;
    const index = this.weeks().findIndex((w) => w.year === active.year && w.week === active.week);
    return index < 0 ? 0 : index;
  });

  private readonly scroll = signal<ScrollState>(REST);

  /** More weeks are hidden at the start. */
  protected readonly canScrollBack = computed(() => this.scroll().left > 1);

  /** More weeks are hidden at the end. */
  protected readonly canScrollForward = computed(() => {
    const state = this.scroll();
    return state.left + state.width < state.scrollWidth - 1;
  });

  constructor() {
    // The chosen week must be visible, also after a deep link or a far step of the arrows.
    // The buttons exist only after the render, so the scroll waits for it.
    afterRenderEffect(() => {
      this.bringIntoView(this.activeIndex(), false, this.buttons().length);
    });
  }

  ngAfterViewInit(): void {
    const bar = this.bar().nativeElement;
    // New or removed weeks and a new sheet width change the hidden part of the strip.
    const size = new ResizeObserver(this.measure);
    const rows = new MutationObserver(this.measure);
    size.observe(bar);
    rows.observe(bar, { childList: true, subtree: true });
    bar.addEventListener('scroll', this.measure, { passive: true });
    this.measure();

    this.destroyRef.onDestroy(() => {
      size.disconnect();
      rows.disconnect();
      bar.removeEventListener('scroll', this.measure);
    });
  }

  protected isActive(week: TimelineWeek): boolean {
    const active = this.active();
    return active !== null && active.year === week.year && active.week === week.week;
  }

  protected onKey(event: KeyboardEvent): void {
    const weeks = this.weeks();
    if (this.dimmed() || weeks.length === 0) return;
    const target = this.targetIndex(event.key, weeks.length);
    if (target === null) return;
    event.preventDefault();
    this.chosen.emit(weeks[target]);
    this.bringIntoView(target, true);
  }

  /** An arrow button moves the strip by its visible width minus one tile. */
  protected scrollByPage(direction: 1 | -1): void {
    const bar = this.bar().nativeElement;
    const tile = (this.buttons()[0] as WeekButtonComponent | undefined)?.element();
    const width = tile ? tile.offsetWidth : 0;
    const step = Math.max(bar.clientWidth - width, width);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    bar.scrollBy({ left: direction * step, behavior: reduced ? 'auto' : 'smooth' });
  }

  private readonly measure = (): void => {
    const bar = this.bar().nativeElement;
    this.scroll.set({ left: bar.scrollLeft, width: bar.clientWidth, scrollWidth: bar.scrollWidth });
  };

  /** Moves the week to the middle of the whole tiles that fit, or to the end for `align="end"`. */
  private bringIntoView(index: number, withFocus: boolean, count = this.buttons().length): void {
    const button = (this.buttons()[index] as WeekButtonComponent | undefined)?.element();
    const bar = this.bar().nativeElement;
    if (!button || count === 0) return;
    const tile = button.offsetWidth;
    const gap = Number.parseFloat(getComputedStyle(bar).columnGap) || 0;
    const fits = Math.max(1, Math.floor((bar.clientWidth + gap) / (tile + gap)));
    const slack = bar.clientWidth - (fits * tile + (fits - 1) * gap);
    const before = Math.floor((fits - 1) / 2);
    const lead = this.align() === 'end' ? slack : Math.round(slack / 2);
    const first = button.offsetLeft - before * (tile + gap);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    bar.scrollTo({ left: Math.max(first - lead, 0), behavior: withFocus && !reduced ? 'smooth' : 'instant' });
    if (withFocus) button.focus();
  }

  private targetIndex(key: string, count: number): number | null {
    const current = this.activeIndex();
    if (key === 'ArrowRight') return Math.min(count - 1, current + 1);
    if (key === 'ArrowLeft') return Math.max(0, current - 1);
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    return null;
  }
}
