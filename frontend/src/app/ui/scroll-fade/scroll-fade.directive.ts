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

/** Der eine Scroll-Bereich einer Seite. Er blendet nur aus, wo Inhalt weitergeht. */
@Directive({ selector: '[appScrollFade]' })
export class ScrollFadeDirective {
  private readonly renderer = inject(Renderer2);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private readonly topVisible = signal(false);
  private readonly bottomVisible = signal(false);

  /** Die offenen Kanten als Wort. Das Stilblatt setzt daraus die Blende. */
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
    // Zeilen stecken in einer Karte, einem Kind des Wirts, nicht im Wirt selbst.
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
    // Aufgerundet, weil ein gebrochener Stand sonst eine Kante vortäuscht.
    this.bottomVisible.set(Math.ceil(scrollTop + clientHeight) < scrollHeight);
  };
}
