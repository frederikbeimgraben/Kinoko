import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AccountStore } from '../../core/access/account.store';
import { noViolations } from '../../testing/axe';
import { GroupsApiDouble, OWNER_ID, groupsApiProvider } from '../../testing/groups-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { GroupsComponent } from './groups.component';

async function build(api = new GroupsApiDouble()): Promise<{
  container: Element;
  api: GroupsApiDouble;
  router: Router;
}> {
  const { container } = await render(GroupsComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      groupsApiProvider(api),
      {
        provide: AccountStore,
        useValue: { owns: (one: string | null) => one === OWNER_ID, userId: () => OWNER_ID },
      },
    ],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('GroupsComponent', () => {
  it('shows each group with its members and the own role', async () => {
    const { container } = await build();

    expect(screen.getByText('2 Mitglieder · Eigentümer')).toBeInTheDocument();
    expect(screen.getByText('1 Mitglied · Eigentümer')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gruppe beitreten' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('opens a group from its row', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: /Familie/ }));

    expect(navigate).toHaveBeenCalledWith(['/konto/gruppen', 'gruppe-zwei']);
  });

  it('creates a group in the sheet of the floating button', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Gruppe anlegen' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Aa');
    await userEvent.click(screen.getByRole('button', { name: /^Anlegen$/ }));

    await vi.waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Anlegen$/ })).not.toBeInTheDocument();
    });
    expect(api.created).toEqual(['Aa']);
  });

  it('creates nothing without a name', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Gruppe anlegen' }));
    await userEvent.click(screen.getByRole('button', { name: /^Anlegen$/ }));

    expect(api.created).toEqual([]);
  });

  it('joins a group with a code', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Gruppe beitreten' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Einladungscode' }), 'PILZ-7F3K');
    await userEvent.click(screen.getByRole('button', { name: /^Beitreten$/ }));

    await vi.waitFor(() => {
      expect(api.joined).toEqual(['PILZ-7F3K']);
    });
  });

  it('joins nothing without a code and closes', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Gruppe beitreten' }));
    await userEvent.click(screen.getByRole('button', { name: /^Beitreten$/ }));
    expect(api.joined).toEqual([]);

    const sheet = screen.getByRole('dialog');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('button', { name: /^Beitreten$/ })).not.toBeInTheDocument();
  });

  it('goes back to the account', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(navigate).toHaveBeenCalledWith('/konto');
  });
});
