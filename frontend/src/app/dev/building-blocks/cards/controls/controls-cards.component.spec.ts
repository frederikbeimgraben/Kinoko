import { render } from '@testing-library/angular';
import { ControlsCardsComponent } from './controls-cards.component';

describe('ControlsCardsComponent', () => {
  it('zeigt die Karten in der Reihenfolge von blocks-cards.json', async () => {
    const { container } = await render(ControlsCardsComponent);

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual(['RadioRow', 'SwitchRow', 'AddRow', 'Button', 'CheckRow', 'Fab', 'RoundButton']);
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const { container } = await render(ControlsCardsComponent);

    const sizes: Record<string, { width: string; height: string }> = {
      RadioRow: { width: '358px', height: '56px' },
      SwitchRow: { width: '358px', height: '56px' },
      AddRow: { width: '358px', height: '56px' },
      Button: { width: '200px', height: '56px' },
      CheckRow: { width: '358px', height: '56px' },
      Fab: { width: '160px', height: '56px' },
      RoundButton: { width: '44px', height: '44px' },
    };
    for (const [name, size] of Object.entries(sizes)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
