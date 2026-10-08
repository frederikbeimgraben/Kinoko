import { render } from '@testing-library/angular';
import { OverlaysCardsComponent } from './overlays-cards.component';

const SIZES: Record<string, { width: string; height: string }> = {
  Grip: { width: '390px', height: '40px' },
  SheetBody: { width: '390px', height: '120px' },
  SheetFoot: { width: '390px', height: '72px' },
  Dialog: { width: '328px', height: '190px' },
  Popover: { width: '264px', height: '200px' },
  PopItem: { width: '240px', height: '48px' },
  SheetHead: { width: '390px', height: '56px' },
  Modal: { width: '560px', height: '480px' },
  Sheet: { width: '390px', height: '480px' },
};

describe('OverlaysCardsComponent', () => {
  it('shows the cards of the sheets and overlays', async () => {
    const { container } = await render(OverlaysCardsComponent);

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual(Object.keys(SIZES));
  });

  it('gives each card the size from the list', async () => {
    const { container } = await render(OverlaysCardsComponent);

    for (const [name, size] of Object.entries(SIZES)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
