import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { NEVER } from 'rxjs';
import { AccountStore } from '../../core/access/account.store';
import { noViolations } from '../../testing/axe';
import {
  GroupsApiDouble,
  KARLSRUHE,
  MEMBER_ID,
  OWNER_ID,
  groupsApiProvider,
} from '../../testing/groups-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { GroupComponent } from './group.component';

async function build(
  who: string,
  id: string = KARLSRUHE.id,
  api = new GroupsApiDouble(),
): Promise<{ container: Element; api: GroupsApiDouble; router: Router }> {
  const { container } = await render(GroupComponent, {
    inputs: { id },
    providers: [
      provideRouter(ANY_ROUTE),
      groupsApiProvider(api),
      { provide: AccountStore, useValue: { owns: (one: string | null) => one === who, userId: () => who } },
    ],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('GroupComponent', () => {
  it('shows the code and the members with the day they joined', async () => {
    const { container } = await build(OWNER_ID);

    expect(screen.getByText('PILZ-7F3K')).toBeInTheDocument();
    expect(screen.getByText('Eigentümer · seit 3. Sept.')).toBeInTheDocument();
    expect(screen.getByText('seit 5. Sept.')).toBeInTheDocument();
    await noViolations(container);
  });

  it('shows a skeleton and not "not found" while the groups load', async () => {
    const api = new GroupsApiDouble();
    vi.spyOn(api, 'list').mockReturnValue(NEVER);
    const { container } = await build(OWNER_ID, KARLSRUHE.id, api);

    expect(screen.queryByText('Gruppe nicht gefunden')).not.toBeInTheDocument();
    expect(container.querySelector('app-row-group-skeleton')).not.toBeNull();
  });

  it('gives the owner the remove and the delete action', async () => {
    const { api } = await build(OWNER_ID);

    await userEvent.click(screen.getByRole('button', { name: 'Mitglied entfernen' }));

    await vi.waitFor(() => {
      expect(api.dropped).toEqual([{ id: KARLSRUHE.id, userId: MEMBER_ID }]);
    });
    expect(screen.getByRole('button', { name: 'Gruppe löschen' })).toBeInTheDocument();
  });

  it('gives a member only the leave action', async () => {
    await build(MEMBER_ID);

    expect(screen.queryByRole('button', { name: 'Mitglied entfernen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verlassen' })).toBeInTheDocument();
  });

  it('deletes the group after the question', async () => {
    const { api, router } = await build(OWNER_ID);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Gruppe löschen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledWith('/konto/gruppen');
    });
    expect(api.removed).toEqual([KARLSRUHE.id]);
  });

  it('leaves the group after the question', async () => {
    const { api } = await build(MEMBER_ID);

    await userEvent.click(screen.getByRole('button', { name: 'Verlassen' }));
    const both = screen.getAllByRole('button', { name: 'Verlassen' });
    await userEvent.click(both[both.length - 1]);

    await vi.waitFor(() => {
      expect(api.dropped).toEqual([{ id: KARLSRUHE.id, userId: MEMBER_ID }]);
    });
  });

  it('tells about a group that is not there', async () => {
    await build(OWNER_ID, 'missing');

    expect(screen.getByText('Gruppe nicht gefunden')).toBeInTheDocument();
  });

  it('copies the code without a share sheet', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await build(OWNER_ID);

    await userEvent.click(screen.getByRole('button', { name: 'Code teilen' }));

    expect(writeText).toHaveBeenCalledWith('PILZ-7F3K');
  });
});
