import { signal } from '@angular/core';
import { render } from '@testing-library/angular';
import { ThemeStore } from '../../core/theme/theme.store';
import { BuildingBlocksComponent } from './building-blocks.component';

// The app starts the theme store before any page. A stub keeps its first paint out of this test.
const THEME = { provide: ThemeStore, useValue: { effective: signal('dunkel'), choice: signal('dunkel') } };

describe('BuildingBlocksComponent', () => {
  it('sets the page to the dark theme and gives the theme back on leave', async () => {
    document.documentElement.setAttribute('data-theme', 'light');

    const { fixture } = await render(BuildingBlocksComponent, { providers: [THEME] });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    fixture.destroy();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
