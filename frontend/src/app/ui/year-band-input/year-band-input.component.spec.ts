import { fireEvent, render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { YearBandInputComponent } from './year-band-input.component';

describe('YearBandInputComponent', () => {
  it('führt zwei beschriftete Griffe für die Monate', async () => {
    const { container } = await render(YearBandInputComponent, {
      inputs: { from: 6, to: 10, label: 'Wachstumszeit' },
    });

    expect(screen.getByRole('slider', { name: 'Untere Grenze' })).toHaveValue('6');
    expect(screen.getByRole('slider', { name: 'Obere Grenze' })).toHaveValue('10');
    expect(container.querySelectorAll('.yearband__marks span')).toHaveLength(4);
    await noViolations(container);
  });

  it('lässt die Griffe einander nicht überholen', async () => {
    const { fixture } = await render(YearBandInputComponent, {
      inputs: { from: 6, to: 10, label: 'Wachstumszeit' },
    });
    const bottom: number[] = [];
    const top: number[] = [];
    fixture.componentInstance.fromChange.subscribe((value) => bottom.push(value));
    fixture.componentInstance.toChange.subscribe((value) => top.push(value));

    fireEvent.input(screen.getByRole('slider', { name: 'Untere Grenze' }), { target: { value: '11' } });
    fireEvent.input(screen.getByRole('slider', { name: 'Obere Grenze' }), { target: { value: '2' } });

    expect(bottom).toEqual([10]);
    expect(top).toEqual([6]);
  });

  it('zeichnet den gewählten Zeitraum über der Bahn', async () => {
    const { container } = await render(YearBandInputComponent, {
      inputs: { from: 1, to: 12, label: 'Wachstumszeit' },
    });

    const span = container.querySelector<HTMLElement>('.yearband__chosen');
    expect(span?.style.insetInlineStart).toBe('0%');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(YearBandInputComponent, {
      inputs: { from: 3, to: 5, label: 'period' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
