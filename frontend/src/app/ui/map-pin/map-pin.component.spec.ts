import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { MapPinComponent } from './map-pin.component';

describe('MapPinComponent', () => {
  it('zeigt einen runden Punkt von 20 px in seiner Farbe', async () => {
    const { container } = await render(MapPinComponent, { inputs: { colour: '#c8a25a' } });

    const pin = container.querySelector<HTMLElement>('.pin');
    if (pin === null) throw new Error('Der Punkt steht nicht im Baum.');
    const style = getComputedStyle(pin);
    expect(style.width).toBe('20px');
    expect(style.height).toBe('20px');
    expect(style.borderRadius).toBe('50%');
    expect(pin.style.background).toBe('rgb(200, 162, 90)');
    await noViolations(container);
  });

  it('trägt keinen Ring, solange er nicht gewählt ist', async () => {
    const { container } = await render(MapPinComponent);

    const pin = container.querySelector<HTMLElement>('.pin');
    expect(pin?.style.boxShadow).toBe('');
  });

  it('trägt einen doppelten Ring, sobald er gewählt ist', async () => {
    const { container } = await render(MapPinComponent, { inputs: { on: true } });

    const pin = container.querySelector<HTMLElement>('.pin');
    expect(pin?.style.boxShadow).toContain('4px');
    expect(pin?.style.boxShadow).toContain('6px');
  });
});
