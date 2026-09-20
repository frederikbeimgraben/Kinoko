import { render } from '@testing-library/angular';
import { BlockCardComponent } from './block-card.component';

describe('BlockCardComponent', () => {
  it('trägt die Größe und den Namen des Boards', async () => {
    const { container } = await render(
      `<app-block-card block="Icon" [width]="24" [height]="24">Inhalt</app-block-card>`,
      { imports: [BlockCardComponent] },
    );

    const card = container.querySelector<HTMLElement>('[data-block="Icon"]');
    expect(card).toHaveStyle({ width: '24px', height: '24px' });
    expect(card).toHaveTextContent('Inhalt');
  });
});
