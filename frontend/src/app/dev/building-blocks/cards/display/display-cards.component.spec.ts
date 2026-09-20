import { render } from '@testing-library/angular';
import { DisplayCardsComponent } from './display-cards.component';

describe('DisplayCardsComponent', () => {
  it('zeigt die Karten in der Reihenfolge von blocks-cards.json', async () => {
    const { container } = await render(DisplayCardsComponent);

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual([
      'Avatar',
      'Crosshair',
      'Legend',
      'Mono',
      'Skeleton',
      'StatTiles',
      'Swatch',
      'ToneDot',
    ]);
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const { container } = await render(DisplayCardsComponent);

    const sizes: Record<string, { width: string; height: string }> = {
      Avatar: { width: '40px', height: '40px' },
      Crosshair: { width: '40px', height: '40px' },
      Legend: { width: '358px', height: '64px' },
      Mono: { width: '358px', height: '120px' },
      Skeleton: { width: '390px', height: '320px' },
      StatTiles: { width: '358px', height: '140px' },
      Swatch: { width: '88px', height: '40px' },
      ToneDot: { width: '40px', height: '40px' },
    };
    for (const [name, size] of Object.entries(sizes)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
