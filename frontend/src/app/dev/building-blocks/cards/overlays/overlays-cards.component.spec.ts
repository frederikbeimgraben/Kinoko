import { render } from '@testing-library/angular';
import { OverlaysCardsComponent } from './overlays-cards.component';

describe('OverlaysCardsComponent', () => {
  it('zeigt die Karten in der Reihenfolge von blocks-cards.json', async () => {
    const { container } = await render(OverlaysCardsComponent);

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual(['Dialog', 'Popover', 'PopItem']);
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const { container } = await render(OverlaysCardsComponent);

    const sizes: Record<string, { width: string; height: string }> = {
      Dialog: { width: '328px', height: '190px' },
      Popover: { width: '264px', height: '200px' },
      PopItem: { width: '240px', height: '48px' },
    };
    for (const [name, size] of Object.entries(sizes)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
