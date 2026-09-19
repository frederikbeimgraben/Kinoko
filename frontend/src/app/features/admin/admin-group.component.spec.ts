import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { GroupsApiDouble, KARLSRUHE, MEMBER_ID, groupsApiProvider } from '../../testing/groups-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { AdminGroupComponent } from './admin-group.component';

async function build(
  id: string = KARLSRUHE.id,
  api = new GroupsApiDouble(),
): Promise<{ container: Element; api: GroupsApiDouble; router: Router }> {
  const { container } = await render(AdminGroupComponent, {
    inputs: { id },
    providers: [provideRouter(ANY_ROUTE), groupsApiProvider(api)],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('AdminGroupComponent', () => {
  it('legt Name, Code und Mitglieder vor', async () => {
    const { container } = await build();

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Pilzgruppe Karlsruhe');
    expect(screen.getByText('PILZ-7F3K')).toBeInTheDocument();
    expect(screen.getByText('Eigentümer')).toBeInTheDocument();
    await noViolations(container);
  });

  it('benennt die Gruppe um und geht zurück', async () => {
    const { api, router } = await build();
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Neu');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.renamed).toEqual([{ id: KARLSRUHE.id, name: 'Neu' }]);
    expect(navigate).toHaveBeenCalledWith('/verwaltung/gruppen');
  });

  it('speichert ohne Namen nichts', async () => {
    const { api } = await build();

    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.renamed).toEqual([]);
  });

  it('nimmt ein Mitglied heraus', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Mitglied entfernen' }));

    expect(api.dropped).toEqual([{ id: KARLSRUHE.id, userId: MEMBER_ID }]);
  });

  it('löscht die Gruppe nach der Rückfrage', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Gruppe löschen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(api.removed).toEqual([KARLSRUHE.id]);
  });

  it('meldet eine unbekannte Gruppe', async () => {
    await build('fehlt');

    expect(screen.getByText('Gruppe nicht gefunden')).toBeInTheDocument();
  });
});
