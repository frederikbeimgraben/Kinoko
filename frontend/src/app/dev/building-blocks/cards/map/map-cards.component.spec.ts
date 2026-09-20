import { render } from '@testing-library/angular';
import { MapCardsComponent } from './map-cards.component';

describe('MapCardsComponent', () => {
  it('zeigt die Karten in der Reihenfolge des Boards', async () => {
    const { container } = await render(MapCardsComponent);

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual([
      'MapPin',
      'ZoneShape',
      'MapControls',
      'StepBar',
      'ObjectTitle',
      'QueueCard',
      'StateView',
    ]);
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const { container } = await render(MapCardsComponent);

    const sizes: Record<string, { width: string; height: string }> = {
      MapPin: { width: '40px', height: '40px' },
      ZoneShape: { width: '390px', height: '400px' },
      MapControls: { width: '390px', height: '200px' },
      StepBar: { width: '358px', height: '56px' },
      ObjectTitle: { width: '358px', height: '56px' },
      QueueCard: { width: '358px', height: '300px' },
      StateView: { width: '390px', height: '360px' },
    };
    for (const [name, size] of Object.entries(sizes)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
