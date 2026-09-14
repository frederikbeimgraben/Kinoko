import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { HistogramComponent } from './histogram.component';

describe('HistogramComponent', () => {
  it('zeichnet je Klasse einen Balken', async () => {
    const { container } = await render(HistogramComponent, {
      inputs: { anteile: [1, 2, 3, 4], label: 'Niederschlag über Deutschland' },
    });

    expect(container.querySelectorAll('.histogram__bar')).toHaveLength(4);
    expect(screen.getByRole('img', { name: 'Niederschlag über Deutschland' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('hebt nur die Klassen innerhalb der Bedingung hervor', async () => {
    const { container } = await render(HistogramComponent, {
      inputs: { anteile: [1, 1, 1, 1], label: 'Verteilung', von: 0.5, bis: 1 },
    });

    expect(container.querySelectorAll('.histogram__bar--inside')).toHaveLength(2);
  });

  it('kommt ohne Klassen aus', async () => {
    const { container } = await render(HistogramComponent, {
      inputs: { anteile: [], label: 'Verteilung' },
    });

    expect(container.querySelectorAll('.histogram__bar')).toHaveLength(0);
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(HistogramComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { anteile: [1, 2, 3], label: 'Precipitation across Germany' },
    });

    noGermanText(container);
  });
});
