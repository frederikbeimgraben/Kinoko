import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { NavComponent } from './nav.component';

describe('NavComponent', () => {
  it('renders the three tabs with minimal inputs', async () => {
    const { container } = await render(NavComponent, {
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(3);
    await noViolations(container);
  });

  it('marks the active tab as current', async () => {
    await render(NavComponent, {
      inputs: { active: '/karte' },
      providers: [provideRouter([])],
    });

    expect(screen.getByRole('link', { name: /karte/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /arten/i })).not.toHaveAttribute('aria-current');
  });

  it('marks nothing while no tab is active', async () => {
    await render(NavComponent, { providers: [provideRouter([])] });

    for (const link of screen.getAllByRole('link')) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('renders as the bottom bar by default', async () => {
    const { container } = await render(NavComponent, { providers: [provideRouter([])] });

    expect(container.querySelector('.nav--rail')).toBeNull();
  });

  it('renders as a rail with a slot for the avatar', async () => {
    const { container } = await render(NavComponent, {
      inputs: { variant: 'rail' },
      providers: [provideRouter([])],
    });

    expect(container.querySelector('.nav--rail')).not.toBeNull();
    expect(container.querySelector('.nav__slot')).not.toBeNull();
  });

  it('leaves out the avatar slot on the bottom bar', async () => {
    const { container } = await render(NavComponent, { providers: [provideRouter([])] });

    expect(container.querySelector('.nav__slot')).toBeNull();
  });

  it('marks every tab as a tap target with a press state', async () => {
    const { container } = await render(NavComponent, { providers: [provideRouter([])] });

    const tabs = container.querySelectorAll('.nav__tab');
    expect(tabs).toHaveLength(3);
    for (const tab of Array.from(tabs)) {
      expect(tab).toHaveClass('tap');
      expect(tab).toHaveAttribute('data-press', 'tint');
    }
  });

  it('renders without German text against an empty catalogue', async () => {
    const { container } = await render(NavComponent, {
      providers: [provideRouter([]), EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
