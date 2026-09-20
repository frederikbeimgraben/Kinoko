import { render } from '@testing-library/angular';
import { BuildingBlocksComponent } from './building-blocks.component';

describe('BuildingBlocksComponent', () => {
  it('stellt die Seite auf das dunkle Thema und gibt es beim Verlassen zurück', async () => {
    document.documentElement.setAttribute('data-theme', 'light');

    const { fixture } = await render(BuildingBlocksComponent);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fixture.destroy();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
