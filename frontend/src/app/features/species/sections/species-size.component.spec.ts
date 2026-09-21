import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import type { MeasurementGroup, PartNote } from '../../../core/api/models';
import { SpeciesSizeComponent } from './species-size.component';

const GROUPS: readonly MeasurementGroup[] = [
  { part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }] },
  {
    part: 'stem',
    measurements: [
      { dimension: 'height', unit: 'cm', low: 5, high: 15 },
      { dimension: 'thickness', unit: 'cm', low: 2, high: 6 },
    ],
  },
];

describe('SpeciesSizeComponent', () => {
  it('zeigt je Körperteil eine Karte mit seinen Strecken', async () => {
    const { container } = await render(SpeciesSizeComponent, { inputs: { groups: GROUPS } });

    expect(container.querySelectorAll('app-measurement-group')).toHaveLength(2);
    expect(screen.getByText('Hut')).toBeInTheDocument();
    expect(screen.getByText('Breite')).toBeInTheDocument();
    expect(screen.getByText('Dicke')).toBeInTheDocument();
    await noViolations(container);
  });

  it('stellt Beschreibung und Kommentar unter das Teil', async () => {
    const notes: readonly PartNote[] = [
      { part: 'cap', description: 'Halbkugelig', comment: 'Selten bis 30 cm' },
    ];

    await render(SpeciesSizeComponent, { inputs: { groups: [GROUPS[0]], notes } });

    expect(screen.getByText('Halbkugelig')).toBeInTheDocument();
    expect(screen.getByText('Selten bis 30 cm')).toBeInTheDocument();
  });

  it('zeigt ohne Maß keine Karte', async () => {
    const { container } = await render(SpeciesSizeComponent, { inputs: { groups: [] } });

    expect(container.querySelectorAll('app-measurement-group')).toHaveLength(0);
    expect(container.querySelector('.section__title')).toBeNull();
  });
});
