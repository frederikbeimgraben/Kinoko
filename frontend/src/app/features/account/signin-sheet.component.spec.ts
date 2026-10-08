import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AuthService } from '../../core/auth';
import { ManagerDouble, authProvider, oidcUser } from '../../testing/auth-double';
import { noViolations } from '../../testing/axe';
import { SignInSheetComponent } from './signin-sheet.component';

interface Setup {
  container: Element;
  auth: AuthService;
  manager: ManagerDouble;
  refresh: () => void;
}

async function build(): Promise<Setup> {
  const manager = new ManagerDouble();
  const { container, detectChanges } = await render(SignInSheetComponent, {
    providers: [provideRouter([]), ...authProvider(manager)],
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

    const dialog = screen.getByRole('dialog', { name: 'Anmelden mit beimgraben.net' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Später' })).toBeInTheDocument();
    await noViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden mit beimgraben.net' }));

    expect(manager.redirects).toHaveLength(1);
    // The question stays open: the page leaves the app for the SSO and comes back through /anmeldung.
    expect(auth.sheetOpen()).toBe(true);
    manager.returnValue = oidcUser();
    await auth.completeSignIn();
    expect(await ask).toBe(true);
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
