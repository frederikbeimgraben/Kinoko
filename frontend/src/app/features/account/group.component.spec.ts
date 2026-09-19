import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AccountService } from '../../core/access/account.service';
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
      { provide: AccountService, useValue: { owns: (one: string | null) => one === who, userId: () => who } },
    ],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('GroupComponent', () => {
  it('zeigt Code und Mitglieder mit ihrem Eintrittstag', async () => {
    const { container } = await build(OWNER_ID);

    expect(screen.getByText('PILZ-7F3K')).toBeInTheDocument();
    expect(screen.getByText('Eigentümer')).toBeInTheDocument();
    expect(screen.getByText('seit 5. Sept.')).toBeInTheDocument();
    await noViolations(container);
  });

  it('gibt dem Eigentümer das Entfernen und das Löschen', async () => {
    const { api } = await build(OWNER_ID);

    await userEvent.click(screen.getByRole('button', { name: 'Mitglied entfernen' }));

    expect(api.dropped).toEqual([{ id: KARLSRUHE.id, userId: MEMBER_ID }]);
    expect(screen.getByRole('button', { name: 'Gruppe löschen' })).toBeInTheDocument();
  });

  it('gibt einem Mitglied nur das Verlassen', async () => {
    await build(MEMBER_ID);

    expect(screen.queryByRole('button', { name: 'Mitglied entfernen' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verlassen' })).toBeInTheDocument();
  });

  it('löscht die Gruppe nach der Rückfrage', async () => {
    const { api, router } = await build(OWNER_ID);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Gruppe löschen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(api.removed).toEqual([KARLSRUHE.id]);
    expect(navigate).toHaveBeenCalledWith('/konto/gruppen');
  });

  it('verlässt die Gruppe nach der Rückfrage', async () => {
    const { api } = await build(MEMBER_ID);

    await userEvent.click(screen.getByRole('button', { name: 'Verlassen' }));
    const both = screen.getAllByRole('button', { name: 'Verlassen' });
    await userEvent.click(both[both.length - 1]);

    expect(api.dropped).toEqual([{ id: KARLSRUHE.id, userId: MEMBER_ID }]);
  });

  it('meldet eine unbekannte Gruppe', async () => {
    await build(OWNER_ID, 'fehlt');

    expect(screen.getByText('Gruppe nicht gefunden')).toBeInTheDocument();
  });

  it('legt den Code in die Zwischenablage', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    await build(OWNER_ID);

    await userEvent.click(screen.getByRole('button', { name: 'Code teilen' }));

    expect(writeText).toHaveBeenCalledWith('PILZ-7F3K');
  });
});
