import { fireEvent, render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { RangeSliderComponent } from './range-slider.component';

describe('RangeSliderComponent', () => {
  it('führt zwei beschriftete Griffe', async () => {
    const { container } = await render(RangeSliderComponent, {
      inputs: { min: 0, max: 240, from: 80, to: 200 },
    });

    expect(screen.getByRole('slider', { name: 'Untere Grenze' })).toHaveValue('80');
    expect(screen.getByRole('slider', { name: 'Obere Grenze' })).toHaveValue('200');
    await noViolations(container);
  });

  it('lässt die Griffe einander nicht überholen', async () => {
    const { fixture } = await render(RangeSliderComponent, {
      inputs: { min: 0, max: 240, from: 80, to: 200 },
    });
    const bottom: number[] = [];
    const top: number[] = [];
    fixture.componentInstance.fromChange.subscribe((value) => bottom.push(value));
    fixture.componentInstance.toChange.subscribe((value) => top.push(value));

    fireEvent.input(screen.getByRole('slider', { name: 'Untere Grenze' }), { target: { value: '230' } });
    fireEvent.input(screen.getByRole('slider', { name: 'Obere Grenze' }), { target: { value: '10' } });

    expect(bottom).toEqual([200]);
    expect(top).toEqual([80]);
  });

  it('zeichnet die gewählte Spanne über der Spur', async () => {
    const { container } = await render(RangeSliderComponent, {
      inputs: { min: 0, max: 100, from: 25, to: 75 },
    });

    const span = container.querySelector<HTMLElement>('.rangeslider__chosen');
    expect(span?.style.insetInlineStart).toBe('25%');
  });

  it('teilt nicht durch eine leere Spanne', async () => {
    const { container } = await render(RangeSliderComponent, {
      inputs: { min: 5, max: 5, from: 5, to: 5 },
    });

    expect(container.querySelector<HTMLElement>('.rangeslider__chosen')?.style.insetInlineStart).toBe('0%');
  });

  it('zeigt bei handles "from" nur den unteren Griff, die Grenze fest am Rand', async () => {
    await render(RangeSliderComponent, {
      inputs: { min: 0, max: 100, from: 40, to: 100, handles: 'from' as const },
    });

    expect(screen.getByRole('slider', { name: 'Untere Grenze' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Obere Grenze' })).toBeNull();
  });

  it('zeigt bei handles "to" nur den oberen Griff', async () => {
    await render(RangeSliderComponent, {
      inputs: { min: 0, max: 100, from: 0, to: 60, handles: 'to' as const },
    });

    expect(screen.queryByRole('slider', { name: 'Untere Grenze' })).toBeNull();
    expect(screen.getByRole('slider', { name: 'Obere Grenze' })).toBeInTheDocument();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(RangeSliderComponent, {
      inputs: { min: 0, max: 100, from: 10, to: 20 },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
