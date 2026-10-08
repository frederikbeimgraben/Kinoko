import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { HistogramComponent } from './histogram.component';

describe('HistogramComponent', () => {
  it('draws one bar per class', async () => {
    const { container } = await render(HistogramComponent, {
      inputs: { shares: [1, 2, 3, 4], label: 'Niederschlag über Deutschland' },
    });

    expect(container.querySelectorAll('.histogram__bar')).toHaveLength(4);
    expect(screen.getByRole('img', { name: 'Niederschlag über Deutschland' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('highlights only the classes inside the condition', async () => {
    const { container } = await render(HistogramComponent, {
      inputs: { shares: [1, 1, 1, 1], label: 'Verteilung', from: 0.5, to: 1 },
    });

    expect(container.querySelectorAll('.histogram__bar--inside')).toHaveLength(2);
  });

  it('works without classes', async () => {
    const { container } = await render(HistogramComponent, {
      inputs: { shares: [], label: 'Verteilung' },
    });

    expect(container.querySelectorAll('.histogram__bar')).toHaveLength(0);
  });

  it('shows no German word with an empty catalogue', async () => {
    const { container } = await render(HistogramComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { shares: [1, 2, 3], label: 'Precipitation across Germany' },
    });

    noGermanText(container);
  });
});
