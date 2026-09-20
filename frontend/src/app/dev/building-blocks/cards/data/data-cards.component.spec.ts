import { render } from '@testing-library/angular';
import { DataCardsComponent } from './data-cards.component';

describe('DataCardsComponent', () => {
  it('zeigt die Karten in der Reihenfolge von blocks-cards.json', async () => {
    const { container } = await render(DataCardsComponent);

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual([
      'Banner',
      'ColourRow',
      'FoldSection',
      'Histogram',
      'SeasonCurve',
      'Thumb',
      'ToneGrid',
      'WeekCell',
    ]);
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const { container } = await render(DataCardsComponent);

    const sizes: Record<string, { width: string; height: string }> = {
      Banner: { width: '390px', height: '56px' },
      ColourRow: { width: '358px', height: '56px' },
      FoldSection: { width: '358px', height: '120px' },
      Histogram: { width: '358px', height: '72px' },
      SeasonCurve: { width: '358px', height: '100px' },
      Thumb: { width: '44px', height: '44px' },
      ToneGrid: { width: '334px', height: '66px' },
      WeekCell: { width: '48px', height: '64px' },
    };
    for (const [name, size] of Object.entries(sizes)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
