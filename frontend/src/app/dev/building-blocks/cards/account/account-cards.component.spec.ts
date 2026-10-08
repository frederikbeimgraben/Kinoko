import { render } from '@testing-library/angular';
import { AccountCardsComponent } from './account-cards.component';

describe('AccountCardsComponent', () => {
  it('shows the cards in the order of blocks-cards.json', async () => {
    const { container } = await render(AccountCardsComponent);

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual([
      'GroupCreateBody',
      'GroupJoinBody',
      'DataExportBody',
      'DataExportGpxBody',
      'EntriesFilterBody',
    ]);
  });

  it('gives each card the size of the manifest', async () => {
    const { container } = await render(AccountCardsComponent);

    for (const name of ['GroupCreateBody', 'DataExportBody', 'EntriesFilterBody']) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle({ width: '358px', height: '400px' });
    }
  });
});
