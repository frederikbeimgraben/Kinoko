import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { StatRowComponent } from './stat-row.component';

describe('StatRowComponent', () => {
  it('zeigt jede Kennzahl mit Wert und Name', async () => {
    const { container } = await render(StatRowComponent, {
      inputs: {
        stats: [
          { value: 12, label: 'Funde' },
          { value: 4, label: 'Marker' },
        ],
      },
    });

    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Funde')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Marker')).toBeInTheDocument();
    await noViolations(container);
  });

  it('bleibt ohne Kennzahlen leer', async () => {
    const { container } = await render(StatRowComponent, { inputs: { stats: [] } });

    expect(container.querySelectorAll('.stat').length).toBe(0);
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(StatRowComponent, {
      inputs: { stats: [{ value: 12, label: 'finds' }] },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
