import { render } from '@testing-library/angular';
import { FinishCardsComponent } from './finish-cards.component';

describe('FinishCardsComponent', () => {
  it('zeigt die Karten in der Reihenfolge von blocks-cards.json', async () => {
    const { container } = await render(FinishCardsComponent);

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual(['Progress', 'Slider']);
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const { container } = await render(FinishCardsComponent);

    const sizes: Record<string, { width: string; height: string }> = {
      Progress: { width: '358px', height: '8px' },
      Slider: { width: '358px', height: '28px' },
    };
    for (const [name, size] of Object.entries(sizes)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
