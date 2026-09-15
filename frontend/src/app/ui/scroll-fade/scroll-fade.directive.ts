import {
  DestroyRef,
  Directive,
  ElementRef,
  Renderer2,
  RendererStyleFlags2,
  afterNextRender,
  effect,
  inject,
  signal,
} from '@angular/core';

const SIZE = '24px';

// Der Rand nimmt keinen Platz: er zieht seine Höhe und den Abstand zurück.
const PULL = `calc(-1 * (${SIZE} + var(--scroll-fade-gap, 0px)))`;

const EDGE_STYLE: [string, string][] = [
  ['position', 'sticky'],
  ['flex', 'none'],
  ['block-size', SIZE],
  ['pointer-events', 'none'],
  ['z-index', '2'],
];

/** Weicher Rand einer Liste: er steht an jeder Kante, an der Inhalt weitergeht. */
@Directive({ selector: '[appScrollFade]' })
export class ScrollFadeDirective {
  private readonly renderer = inject(Renderer2);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private readonly topVisible = signal(false);
  private readonly bottomVisible = signal(false);

  private readonly top = this.edge('top', 'to bottom');
  private readonly bottom = this.edge('bottom', 'to top');

  constructor() {
    this.renderer.insertBefore(this.host, this.top, this.host.firstChild);
    // Der Wirt füllt sich erst nach dem Bau; der untere Rand gehört ans Ende.
    afterNextRender(() => {
      this.renderer.appendChild(this.host, this.bottom);
    });
    effect(() => {
      this.renderer.setProperty(this.top, 'hidden', !this.topVisible());
      this.renderer.setProperty(this.bottom, 'hidden', !this.bottomVisible());
    });

    const size = new ResizeObserver(this.measure);
    // Zeilen kommen und gehen, ohne dass der Wirt seine Größe ändert.
    const rows = new MutationObserver(this.measure);
    size.observe(this.host);
    rows.observe(this.host, { childList: true });
    this.host.addEventListener('scroll', this.measure, { passive: true });
    this.measure();

    inject(DestroyRef).onDestroy(() => {
      size.disconnect();
      rows.disconnect();
      this.host.removeEventListener('scroll', this.measure);
      this.renderer.removeChild(this.host, this.top);
      this.renderer.removeChild(this.host, this.bottom);
    });
  }

  private readonly measure = (): void => {
    const { scrollTop, clientHeight, scrollHeight } = this.host;
    this.topVisible.set(scrollTop > 0);
    // Aufgerundet, weil ein gebrochener Stand sonst eine Kante vortäuscht.
    this.bottomVisible.set(Math.ceil(scrollTop + clientHeight) < scrollHeight);
  };

  private edge(side: 'top' | 'bottom', direction: string): HTMLElement {
    const node = this.renderer.createElement('div') as HTMLElement;
    this.renderer.addClass(node, 'scroll-fade');
    this.renderer.addClass(node, `scroll-fade--${side}`);
    this.renderer.setAttribute(node, 'aria-hidden', 'true');
    this.renderer.setProperty(node, 'hidden', true);
    for (const [name, value] of EDGE_STYLE) {
      this.renderer.setStyle(node, name, value, RendererStyleFlags2.DashCase);
    }
    this.renderer.setStyle(node, side, '0');
    const pull = side === 'top' ? 'margin-block-end' : 'margin-block-start';
    this.renderer.setStyle(node, pull, PULL, RendererStyleFlags2.DashCase);
    this.renderer.setStyle(
      node,
      'background',
      `linear-gradient(${direction}, var(--color-surface), transparent)`,
    );
    return node;
  }
}
