import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { RippleDirective } from './ripple.directive';

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

function press(host: Element): void {
  vi.spyOn(host, 'getBoundingClientRect').mockReturnValue({
    x: 10,
    y: 20,
    left: 10,
    top: 20,
    width: 40,
    height: 40,
    right: 50,
    bottom: 60,
    toJSON: () => undefined,
  });
  host.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 30, clientY: 40 }));
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
    expect(dot.style.left).toBe('-24px');
    expect(dot.style.top).toBe('-24px');
    expect(dot.style.width).toBe('88px');
    expect(dot.style.height).toBe('88px');
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
