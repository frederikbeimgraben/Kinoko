import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ErrorStateComponent } from './error-state.component';

describe('ErrorStateComponent', () => {
  it('shows the state view in the error tone with a retry button', async () => {
    const { container } = await render(ErrorStateComponent, {
      inputs: { text: 'Keine Verbindung' },
    });

    expect(screen.getByText('Keine Verbindung')).toBeInTheDocument();
    expect(container.querySelector('.state--error .state__blob svg')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('reports the retry', async () => {
    const { fixture } = await render(ErrorStateComponent, {
      inputs: { text: 'Keine Verbindung', icon: 'lock' },
    });
    let calls = 0;
    fixture.componentInstance.retry.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(calls).toBe(1);
  });

  it('has no German text with an empty catalogue', async () => {
    const { container } = await render(ErrorStateComponent, {
      inputs: { text: 'loading failed' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
