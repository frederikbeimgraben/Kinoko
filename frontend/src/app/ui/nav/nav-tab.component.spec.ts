import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { NavTabComponent } from './nav-tab.component';

describe('NavTabComponent', () => {
  it('shows the label and marks the active tab', async () => {
    const { container } = await render(NavTabComponent, {
      inputs: { icon: 'map', label: 'Karte', path: '/karte', active: true },
      providers: [provideRouter([])],
    });

    const link = screen.getByRole('link', { name: 'Karte' });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveClass('navtab--active');
    await noViolations(container);
  });

  it('leaves the rail width off the bottom bar', async () => {
    const { container } = await render(NavTabComponent, {
      inputs: { icon: 'map', label: 'Karte', path: '/karte' },
      providers: [provideRouter([])],
    });

    expect(container.querySelector('.navtab--rail')).toBeNull();
    expect(screen.getByRole('link', { name: 'Karte' })).not.toHaveAttribute('aria-current');
  });

  it('takes the rail width', async () => {
    const { container } = await render(NavTabComponent, {
      inputs: { icon: 'map', label: 'Karte', path: '/karte', rail: true },
      providers: [provideRouter([])],
    });

    expect(container.querySelector('.navtab--rail')).not.toBeNull();
  });

  it('shows the press only in the pill, as the board shows no box around the tab', async () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList);
    const { container } = await render(NavTabComponent, {
      inputs: { icon: 'map', label: 'Karte', path: '/karte' },
      providers: [provideRouter([])],
    });

    const link = screen.getByRole('link', { name: 'Karte' });
    link.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 4, clientY: 60 }));

    expect(container.querySelector('.navtab__pill > .ripple-frame')).not.toBeNull();
    expect(link.querySelector(':scope > .ripple-frame')).toBeNull();
  });
});
