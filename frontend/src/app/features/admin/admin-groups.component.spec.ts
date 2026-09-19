import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { GroupsApiDouble, groupsApiProvider } from '../../testing/groups-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { AdminGroupsComponent } from './admin-groups.component';

async function build(api = new GroupsApiDouble()): Promise<{
  container: Element;
  api: GroupsApiDouble;
  router: Router;
}> {
  const { container } = await render(AdminGroupsComponent, {
    providers: [provideRouter(ANY_ROUTE), groupsApiProvider(api)],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('AdminGroupsComponent', () => {
  it('holt alle Gruppen und nennt Eigentümer und Zahl', async () => {
    const { container, api } = await build();

    expect(api.calls).toEqual([true]);
    expect(screen.getByText('Eigentümer Frederik · 2 Mitglieder')).toBeInTheDocument();
    await noViolations(container);
  });

  it('sucht im Namen', async () => {
    await build();

    await userEvent.type(screen.getByRole('textbox', { name: 'Gruppe suchen' }), 'fami');

    expect(screen.queryByText('Pilzgruppe Karlsruhe')).not.toBeInTheDocument();
    expect(screen.getByText('Familie')).toBeInTheDocument();
  });

  it('führt in die Gruppe und zurück', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');
    const byUrl = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: /Familie/ }));
    expect(navigate).toHaveBeenCalledWith(['/verwaltung/gruppen', 'gruppe-zwei']);

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(byUrl).toHaveBeenCalledWith('/verwaltung');
  });
});
