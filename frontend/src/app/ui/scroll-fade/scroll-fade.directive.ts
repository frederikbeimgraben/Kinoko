import {
  DestroyRef,
  Directive,
  ElementRef,
  Renderer2,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

/** The one scroll area of a page or a sheet body. It fades only where more content continues. */
@Directive({ selector: '[appScrollFade]' })
export class ScrollFadeDirective {
  private readonly renderer = inject(Renderer2);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private readonly topVisible = signal(false);
  private readonly bottomVisible = signal(false);

  /** The open edges as a word. The style sheet makes the fade from it. */
  private readonly edges = computed(() => {
    if (this.topVisible() && this.bottomVisible()) return 'both';
    if (this.topVisible()) return 'top';
    if (this.bottomVisible()) return 'bottom';
    return 'none';
  });

  constructor() {
    this.renderer.addClass(this.host, 'scroll');
    effect(() => {
      this.renderer.setAttribute(this.host, 'data-fade', this.edges());
    });

    const size = new ResizeObserver(this.measure);
    // The rows are in a card, a child of the host, not in the host itself.
    const rows = new MutationObserver(this.measure);
    size.observe(this.host);
    rows.observe(this.host, { childList: true, subtree: true });
    this.host.addEventListener('scroll', this.measure, { passive: true });
    this.measure();

    inject(DestroyRef).onDestroy(() => {
      size.disconnect();
      rows.disconnect();
      this.host.removeEventListener('scroll', this.measure);
    });
  }

  private readonly measure = (): void => {
    const { scrollTop, clientHeight, scrollHeight } = this.host;
    this.topVisible.set(scrollTop > 0);
    // Round up, because a fractional position can show a wrong edge.
    this.bottomVisible.set(Math.ceil(scrollTop + clientHeight) < scrollHeight);
  };
}
