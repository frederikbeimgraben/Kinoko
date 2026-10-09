import { DestroyRef, Directive, ElementRef, Renderer2, inject } from '@angular/core';

const REDUCE_MOTION = '(prefers-reduced-motion: reduce)';

/** The radius that reaches the farthest corner of the box from the touch point. */
export function reach(width: number, height: number, x: number, y: number): number {
  return Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
}

/** A ripple from the touch point, per `kit.css` `.ripple`. */
@Directive({ selector: '[appRipple]' })
export class RippleDirective {
  private readonly renderer = inject(Renderer2);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    const onPointerDown = (event: PointerEvent): void => {
      this.spawn(event);
    };
    this.host.addEventListener('pointerdown', onPointerDown);
    inject(DestroyRef).onDestroy(() => {
      this.host.removeEventListener('pointerdown', onPointerDown);
    });
  }

  private spawn(event: PointerEvent): void {
    if (window.matchMedia(REDUCE_MOTION).matches) return;

    const position = getComputedStyle(this.host).position;
    if (position === 'static' || position === '') {
      this.renderer.setStyle(this.host, 'position', 'relative');
    }

    // A circle larger than the box shows only its flat middle in a low row, which looks like a box.
    const box = this.host.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const size = 2 * reach(box.width, box.height, x, y);
    const dot = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(dot, 'ripple');
    this.renderer.setStyle(dot, 'width', `${size}px`);
    this.renderer.setStyle(dot, 'height', `${size}px`);
    this.renderer.setStyle(dot, 'left', `${x - size / 2}px`);
    this.renderer.setStyle(dot, 'top', `${y - size / 2}px`);
    const frame = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(frame, 'ripple-frame');
    this.renderer.appendChild(frame, dot);
    dot.addEventListener('animationend', () => {
      this.renderer.removeChild(this.host, frame);
    });
    this.renderer.appendChild(this.host, frame);
  }
}
