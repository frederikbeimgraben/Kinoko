import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  it('shows the state view with icon and title and no button', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Keine Art passt zur Suche.' },
    });

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
    expect(container.querySelector('app-state-view .state__blob svg')).not.toBeNull();
    expect(container.querySelector('.state--error')).toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('reports the tonal action', async () => {
    const { fixture } = await render(EmptyStateComponent, {
      inputs: { text: 'Nicht angemeldet', icon: 'entries', action: 'Anmelden' },
    });
    let calls = 0;
    fixture.componentInstance.actionClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(calls).toBe(1);
  });

  it('has no German text with an empty catalogue', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'no match', action: 'reset' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
