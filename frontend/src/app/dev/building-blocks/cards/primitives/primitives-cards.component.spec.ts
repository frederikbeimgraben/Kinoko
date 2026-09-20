import { render } from '@testing-library/angular';
import { PrimitivesCardsComponent } from './primitives-cards.component';

describe('PrimitivesCardsComponent', () => {
  it('zeigt die Karten in der Reihenfolge von blocks-cards.json', async () => {
    const { container } = await render(PrimitivesCardsComponent);

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual(['Badge', 'Field', 'Group', 'Icon', 'Section', 'Segment']);
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const { container } = await render(PrimitivesCardsComponent);

    const sizes: Record<string, { width: string; height: string }> = {
      Badge: { width: '120px', height: '24px' },
      Field: { width: '358px', height: '84px' },
      Group: { width: '358px', height: '120px' },
      Icon: { width: '24px', height: '24px' },
      Section: { width: '358px', height: '160px' },
      Segment: { width: '358px', height: '48px' },
    };
    for (const [name, size] of Object.entries(sizes)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
