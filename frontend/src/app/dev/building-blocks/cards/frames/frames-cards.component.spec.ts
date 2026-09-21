import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { FramesCardsComponent } from './frames-cards.component';

const SIZES: Record<string, { width: string; height: string }> = {
  TopBar: { width: '390px', height: '72px' },
  DetailBar: { width: '390px', height: '72px' },
  SearchBar: { width: '390px', height: '72px' },
  Nav: { width: '390px', height: '80px' },
  NavTab: { width: '124px', height: '68px' },
  Rail: { width: '96px', height: '900px' },
  Surface: { width: '340px', height: '200px' },
  Pane: { width: '420px', height: '900px' },
  Column: { width: '300px', height: '200px' },
  Columns: { width: '640px', height: '200px' },
  Split: { width: '640px', height: '200px' },
  Scroll: { width: '390px', height: '400px' },
};

describe('FramesCardsComponent', () => {
  it('zeigt jede Karte der D2-Rahmen', async () => {
    const { container } = await render(FramesCardsComponent, {
      providers: [provideRouter([])],
    });

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual(Object.keys(SIZES));
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const { container } = await render(FramesCardsComponent, {
      providers: [provideRouter([])],
    });

    for (const [name, size] of Object.entries(SIZES)) {
      expect(container.querySelector<HTMLElement>(`[data-block="${name}"]`)).toHaveStyle(size);
    }
  });
});
