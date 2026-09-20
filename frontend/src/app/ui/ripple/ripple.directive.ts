import { DestroyRef, Directive, ElementRef, Renderer2, inject } from '@angular/core';

const REDUCE_MOTION = '(prefers-reduced-motion: reduce)';
/** The circle grows past every corner from any touch point on the host. */
const SPREAD = 2.2;

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

    const box = this.host.getBoundingClientRect();
    const size = Math.max(box.width, box.height) * SPREAD;
    const dot = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(dot, 'ripple');
    this.renderer.setStyle(dot, 'width', `${size}px`);
    this.renderer.setStyle(dot, 'height', `${size}px`);
    this.renderer.setStyle(dot, 'left', `${event.clientX - box.left - size / 2}px`);
    this.renderer.setStyle(dot, 'top', `${event.clientY - box.top - size / 2}px`);
    const frame = this.renderer.createElement('span') as HTMLElement;
    this.renderer.addClass(frame, 'ripple-frame');
    this.renderer.appendChild(frame, dot);
    dot.addEventListener('animationend', () => {
      this.renderer.removeChild(this.host, frame);
    });
    this.renderer.appendChild(this.host, frame);
  }
}
