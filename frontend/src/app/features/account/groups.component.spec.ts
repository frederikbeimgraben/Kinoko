import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { GroupsApiDouble, groupsApiProvider } from '../../testing/groups-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { GroupsComponent } from './groups.component';

async function build(api = new GroupsApiDouble()): Promise<{
  container: Element;
  api: GroupsApiDouble;
  router: Router;
}> {
  const { container } = await render(GroupsComponent, {
    providers: [provideRouter(ANY_ROUTE), groupsApiProvider(api)],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('GroupsComponent', () => {
  it('zeigt jede Gruppe mit der Zahl ihrer Mitglieder', async () => {
    const { container } = await build();

    expect(screen.getByText('2 Mitglieder')).toBeInTheDocument();
    expect(screen.getByText('1 Mitglied')).toBeInTheDocument();
    await noViolations(container);
  });

  it('führt von einer Zeile in die Gruppe', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: /Familie/ }));

    expect(navigate).toHaveBeenCalledWith(['/konto/gruppen', 'gruppe-zwei']);
  });

  it('legt eine Gruppe über das Blatt an', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Gruppe anlegen' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Aa');
    await userEvent.click(screen.getByRole('button', { name: /^Anlegen$/ }));

    expect(api.created).toEqual(['Aa']);
    expect(screen.queryByRole('button', { name: /^Anlegen$/ })).not.toBeInTheDocument();
  });

  it('legt ohne Namen nichts an', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Gruppe anlegen' }));
    await userEvent.click(screen.getByRole('button', { name: /^Anlegen$/ }));

    expect(api.created).toEqual([]);
  });

  it('tritt einer Gruppe über den Code bei', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Code eingeben' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Code' }), 'PILZ-7F3K');
    await userEvent.click(screen.getByRole('button', { name: /^Beitreten$/ }));

    expect(api.joined).toEqual(['PILZ-7F3K']);
  });

  it('tritt ohne Code nirgends bei und bricht ab', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Code eingeben' }));
    await userEvent.click(screen.getByRole('button', { name: /^Beitreten$/ }));
    expect(api.joined).toEqual([]);

    const sheet = screen.getByRole('dialog');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Schließen' }));
    expect(screen.queryByRole('button', { name: /^Beitreten$/ })).not.toBeInTheDocument();
  });

  it('führt zurück auf das Konto', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(navigate).toHaveBeenCalledWith('/konto');
  });
});
