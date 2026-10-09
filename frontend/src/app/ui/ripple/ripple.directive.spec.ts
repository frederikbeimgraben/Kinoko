import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { RippleDirective, farthestCorner } from './ripple.directive';

@Component({
  imports: [RippleDirective],
  template: `<button appRipple style="width: 40px; height: 40px">x</button>`,
})
class HostComponent {}

@Component({
  imports: [RippleDirective],
  template: `<button appRipple style="position: absolute">x</button>`,
})
class PositionedHostComponent {}

@Component({
  imports: [RippleDirective],
  template: `<a appRipple [rippleIn]="pill"><span #pill class="pill">i</span>Karte</a>`,
})
class InnerTargetComponent {}

function stubMotion(reduce: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: reduce && query.includes('reduce'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }) as MediaQueryList,
  );
}

const BOX = {
  x: 10,
  y: 20,
  left: 10,
  top: 20,
  width: 40,
  height: 40,
  right: 50,
  bottom: 60,
  toJSON: () => undefined,
};

function press(host: Element, at: { x: number; y: number } = { x: 30, y: 40 }): void {
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue(BOX);
  host.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: at.x, clientY: at.y }));
}

function px(value: string): number {
  return Number.parseFloat(value);
}

describe('RippleDirective', () => {
  it('setzt einen Kreis am Berührungspunkt', async () => {
    stubMotion(false);
    const { container } = await render(HostComponent);
    const host = container.querySelector('button');
    if (host === null) throw new Error('kein Wirt');

    press(host);

    const dot = host.querySelector<HTMLElement>('.ripple');
    if (dot === null) throw new Error('kein Kreis');
    const radius = Math.hypot(20, 20);
    expect(px(dot.style.width)).toBeCloseTo(2 * radius);
    expect(px(dot.style.height)).toBeCloseTo(2 * radius);
    expect(px(dot.style.left)).toBeCloseTo(20 - radius);
    expect(px(dot.style.top)).toBeCloseTo(20 - radius);
  });

  it('endet an der fernsten Ecke, damit der Kreis in einer breiten Zeile rund bleibt', () => {
    const row = { ...BOX, left: 0, top: 0, right: 360, bottom: 56, width: 360, height: 56 } as DOMRect;

    expect(farthestCorner(row, 10, 28)).toBeCloseTo(Math.hypot(350, 28));
    expect(farthestCorner(row, 350, 0)).toBeCloseTo(Math.hypot(350, 56));
  });

  it('beginnt einen Druck außerhalb des Ziels in dessen Mitte', async () => {
    stubMotion(false);
    const { container } = await render(HostComponent);
    const host = container.querySelector('button');
    if (host === null) throw new Error('kein Wirt');

    press(host, { x: 0, y: 40 });

    const dot = host.querySelector<HTMLElement>('.ripple');
    const radius = Math.hypot(20, 20);
    expect(px(dot?.style.left ?? '')).toBeCloseTo(20 - radius);
    expect(px(dot?.style.top ?? '')).toBeCloseTo(20 - radius);
    expect(px(dot?.style.width ?? '')).toBeCloseTo(2 * radius);
  });

  it('zeigt den Kreis im Ziel, wenn die Form ein Kind des Wirts ist', async () => {
    stubMotion(false);
    const { container } = await render(InnerTargetComponent);
    const host = container.querySelector<HTMLElement>('a');
    const pill = container.querySelector<HTMLElement>('.pill');
    if (host === null || pill === null) throw new Error('kein Wirt');

    vi.spyOn(pill, 'getBoundingClientRect').mockReturnValue(BOX);
    host.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 30, clientY: 40 }));

    expect(pill.querySelector('.ripple-frame .ripple')).toBeInTheDocument();
    expect(host.querySelector(':scope > .ripple-frame')).not.toBeInTheDocument();
    expect(pill.style.position).toBe('relative');
  });

  it('nimmt den Wirt aus dem Fluss, wenn er noch keine Lage hat', async () => {
    stubMotion(false);
    const { container } = await render(HostComponent);
    const host = container.querySelector<HTMLElement>('button');
    if (host === null) throw new Error('kein Wirt');

    press(host);

    expect(host.style.position).toBe('relative');
    expect(host.style.overflow).toBe('');
  });

  it('setzt den Kreis in einen Rahmen, der ihn auf den Wirt beschneidet', async () => {
    stubMotion(false);
    const { container } = await render(PositionedHostComponent);
    const host = container.querySelector<HTMLElement>('button');
    if (host === null) throw new Error('kein Wirt');

    press(host);

    const frame = host.querySelector<HTMLElement>('.ripple-frame');
    expect(frame?.querySelector('.ripple')).toBeInTheDocument();
  });

  it('lässt einen schon platzierten Wirt unberührt', async () => {
    stubMotion(false);
    const { container } = await render(PositionedHostComponent);
    const host = container.querySelector<HTMLElement>('button');
    if (host === null) throw new Error('kein Wirt');

    press(host);

    expect(host.style.overflow).toBe('');
  });

  it('entfernt den Kreis, wenn die Bewegung endet', async () => {
    stubMotion(false);
    const { container } = await render(HostComponent);
    const host = container.querySelector<HTMLElement>('button');
    if (host === null) throw new Error('kein Wirt');

    press(host);
    const dot = host.querySelector('.ripple');
    if (dot === null) throw new Error('kein Kreis');

    dot.dispatchEvent(new Event('animationend'));

    expect(host.querySelector('.ripple-frame')).not.toBeInTheDocument();
  });

  it('setzt keinen Kreis, wenn der Rechner weniger Bewegung wünscht', async () => {
    stubMotion(true);
    const { container } = await render(HostComponent);
    const host = container.querySelector<HTMLElement>('button');
    if (host === null) throw new Error('kein Wirt');

    press(host);

    expect(host.querySelector('.ripple')).not.toBeInTheDocument();
  });
});
