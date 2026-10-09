import { DestroyRef, Directive, ElementRef, Renderer2, inject, input } from '@angular/core';

const REDUCE_MOTION = '(prefers-reduced-motion: reduce)';

/** The distance from a point in the box to the corner that is farthest away. */
export function farthestCorner(box: DOMRect, x: number, y: number): number {
  return Math.hypot(Math.max(x - box.left, box.right - x), Math.max(y - box.top, box.bottom - y));
}

/** A ripple from the touch point, per `kit.css` `.ripple`, in the shape of the host or of `rippleIn`. */
@Directive({ selector: '[appRipple]' })
export class RippleDirective {
  /** The element that shows the ripple. Without it, the host shows the ripple. */
  readonly rippleIn = input<HTMLElement | undefined>(undefined);

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

    const target = this.rippleIn() ?? this.host;
    const position = getComputedStyle(target).position;
    if (position === 'static' || position === '') {
      this.renderer.setStyle(target, 'position', 'relative');
    }

    // A press outside the target (the label below a pill) starts at the centre of the target.
    const box = target.getBoundingClientRect();
    const inside =
      event.clientX >= box.left &&
      event.clientX <= box.right &&
      event.clientY >= box.top &&
      event.clientY <= box.bottom;
    const x = inside ? event.clientX : box.left + box.width / 2;
    const y = inside ? event.clientY : box.top + box.height / 2;
    // The circle ends at the farthest corner. A larger circle has an almost straight edge in a wide row.
    const size = 2 * farthestCorner(box, x, y);
    const dot = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(dot, 'ripple');
    this.renderer.setStyle(dot, 'width', `${size}px`);
    this.renderer.setStyle(dot, 'height', `${size}px`);
    this.renderer.setStyle(dot, 'left', `${x - box.left - size / 2}px`);
    this.renderer.setStyle(dot, 'top', `${y - box.top - size / 2}px`);
    const frame = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(frame, 'ripple-frame');
    this.renderer.appendChild(frame, dot);
    dot.addEventListener('animationend', () => {
      this.renderer.removeChild(target, frame);
    });
    this.renderer.appendChild(target, frame);
  }
}
