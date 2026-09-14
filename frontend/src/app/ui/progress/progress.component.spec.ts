import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ProgressComponent } from './progress.component';

describe('ProgressComponent', () => {
  it('zeigt den Fortschritt als Balken', async () => {
    const { container } = await render(ProgressComponent, { inputs: { value: 62 } });

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '62');
    expect(container.querySelector('.progress__fill')).toHaveStyle({ inlineSize: '62%' });
    await noViolations(container);
  });

  it('kappt den Wert auf 0 bis 100', async () => {
    await render(ProgressComponent, { inputs: { value: 140 } });

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('kappt einen negativen Wert auf 0', async () => {
    await render(ProgressComponent, { inputs: { value: -5 } });

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(ProgressComponent, {
      inputs: { value: 40 },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
