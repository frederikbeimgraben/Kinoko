import { render } from '@testing-library/angular';
import { RowsCardsComponent } from './rows-cards.component';

describe('RowsCardsComponent', () => {
  it('zeigt jede Karte der D1-Zeilenbausteine', async () => {
    const { container } = await render(RowsCardsComponent);

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual([
      'Row',
      'Chip',
      'ChipRow',
      'ChipSet',
      'EntryRow',
      'EntryList',
      'AccountTile',
      'ExpandRow',
    ]);
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const { container } = await render(RowsCardsComponent);

    const sizes: Record<string, { width: string; height: string }> = {
      Row: { width: '358px', height: '56px' },
      Chip: { width: '160px', height: '36px' },
      ChipRow: { width: '390px', height: '44px' },
      ChipSet: { width: '272px', height: '120px' },
      EntryRow: { width: '374px', height: '84px' },
      EntryList: { width: '390px', height: '520px' },
      AccountTile: { width: '358px', height: '72px' },
      ExpandRow: { width: '358px', height: '120px' },
    };
    for (const [name, size] of Object.entries(sizes)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
