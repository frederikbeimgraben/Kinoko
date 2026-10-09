import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthService } from '../../core/auth';
import type { AppConfig } from '../../core/config/config.store';
import { CONFIG, ManagerDouble, authProvider } from '../../testing/auth-double';
import { ToastService } from '../../ui/toast/toast.service';
import { noViolations } from '../../testing/axe';
import { SignInSheetComponent } from './signin-sheet.component';

interface Setup {
  container: Element;
  auth: AuthService;
  manager: ManagerDouble;
  refresh: () => void;
}

async function build(configuration: AppConfig = CONFIG): Promise<Setup> {
  const manager = new ManagerDouble();
  const { container, detectChanges } = await render(SignInSheetComponent, {
    providers: [provideRouter([]), ...authProvider(manager, configuration)],
  });
  return { container, auth: TestBed.inject(AuthService), manager, refresh: detectChanges };
}

describe('SignInSheetComponent', () => {
  it('stays closed while nothing is to be saved', async () => {
    await build();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the stacked dialog of the board and goes to the SSO', async () => {
    const { auth, manager, refresh, container } = await build();

    const ask = auth.requestSignIn();
    refresh();

    const dialog = screen.getByRole('dialog', { name: 'Anmelden mit Example SSO' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Später' })).toBeInTheDocument();
    await noViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden mit Example SSO' }));

    expect(manager.redirects).toHaveLength(1);
    // The sheet stays with a busy button: the page leaves the app for the SSO.
    expect(auth.sheetOpen()).toBe(true);
    refresh();
    expect(screen.getAllByRole('button')[0]).toHaveAttribute('aria-busy', 'true');
    // The entry went on the device, so the return from the SSO sends it.
    expect(await ask).toBe(false);
  });

  it('shows a toast when the SSO cannot be reached', async () => {
    const { auth, manager, refresh } = await build();
    manager.redirectError = new TypeError('Failed to fetch');

    void auth.requestSignIn();
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Anmelden mit Example SSO' }));
    refresh();

    expect(TestBed.inject(ToastService).toasts()).toMatchObject([
      { message: 'Die Anmeldung ist fehlgeschlagen. Versuche es noch einmal.', variant: 'danger' },
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('turns the button off and tells why when the server has no SSO', async () => {
    const { auth, refresh } = await build({ ...CONFIG, oidcIssuer: '', oidcName: '' });

    void auth.requestSignIn();
    refresh();

    expect(screen.getByRole('button', { name: 'Anmelden' })).toBeDisabled();
    expect(screen.getByText('Auf diesem Server ist keine Anmeldung eingerichtet.')).toBeInTheDocument();
  });

  it('keeps the entry on the device when the person signs in later', async () => {
    const { auth, refresh } = await build();

    const ask = auth.requestSignIn();
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Später' }));

    expect(await ask).toBe(false);
    refresh();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
