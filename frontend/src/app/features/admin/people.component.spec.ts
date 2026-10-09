import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ANY_ROUTE } from '../../testing/routes';
import userEvent from '@testing-library/user-event';
import { AccessApiDouble, accessApiProvider, person, problem } from '../../testing/access-fixture';
import { noViolations } from '../../testing/axe';
import { PeopleComponent } from './people.component';

async function build(api = new AccessApiDouble()): Promise<{
  container: Element;
  api: AccessApiDouble;
  refresh: () => void;
}> {
  const { container, detectChanges } = await render(PeopleComponent, {
    providers: [provideRouter(ANY_ROUTE), accessApiProvider(api)],
  });
  return { container, api, refresh: detectChanges };
}

/** Puts the fragment in a `main`, as the app shell does. */
function inMain(container: Element): Element {
  const main = document.createElement('main');
  main.append(container);
  document.body.append(main);
  return main;
}

describe('PeopleComponent', () => {
  it('zeigt die Konten mit ihren Rollen', async () => {
    const { container } = await build();

    expect(screen.getByRole('button', { name: /Frederik/ })).toHaveTextContent('Admin');
    expect(screen.getByRole('button', { name: /Jonas/ })).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt die Verwaltung aus der Anmeldung als feste, gewählte Rolle', async () => {
    const api = new AccessApiDouble();
    api.peopleList = [person({ id: 'person-sso', sub: 'sub-sso', name: 'Sso', groupAdmin: true })];
    const { refresh } = await build(api);

    expect(screen.getByRole('button', { name: /Sso/ })).toHaveTextContent('Admin');
    await userEvent.click(screen.getByRole('button', { name: /Sso/ }));
    refresh();

    const box = screen.getByRole('checkbox', { name: /Admin/ });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(screen.getByText('Über die Anmeldung (SSO)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(api.assigned).toEqual([{ id: 'person-sso', roles: [] }]);
  });

  it('fragt den Dienst nach dem, was jemand eintippt', async () => {
    const { api } = await build();

    await userEvent.type(screen.getByRole('textbox', { name: 'Person suchen' }), 'jonas');

    expect(api.searches.at(-1)).toBe('jonas');
  });

  it('öffnet die Rollen einer Person ohne die feste Rolle Nutzer', async () => {
    const { container, refresh } = await build();

    await userEvent.click(screen.getByRole('button', { name: /Jonas/ }));
    refresh();

    expect(screen.getByRole('dialog', { name: 'Rollen zuweisen' })).toHaveTextContent('jonas@example.test');
    expect(screen.getByRole('checkbox', { name: /Pilzberater/ })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /^Nutzer/ })).not.toBeInTheDocument();
    // The toolbar and the sheet each have a `header`. In the app, both are in the shell `main`.
    // Thus they are not banners. This test adds the `main` for the same result.
    await noViolations(inMain(container));
  });

  it('schickt die gewählten Rollen und schließt das Blatt', async () => {
    const { api, refresh } = await build();

    await userEvent.click(screen.getByRole('button', { name: /Jonas/ }));
    refresh();
    await userEvent.click(screen.getByRole('checkbox', { name: /Pilzberater/ }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    refresh();

    expect(api.assigned).toEqual([{ id: 'person-jonas', roles: ['rolle-berater'] }]);
    expect(screen.queryByRole('dialog', { name: 'Rollen zuweisen' })).not.toBeInTheDocument();
  });

  it('lässt das Blatt offen, wenn der Dienst die Zuweisung abweist', async () => {
    const { api, refresh } = await build();
    // The service gives this answer when the change removes the last Admin role.
    api.rejectWith = problem(409, 'Das ist die letzte Person mit der Rolle Admin.');

    await userEvent.click(screen.getByRole('button', { name: /Frederik/ }));
    refresh();
    await userEvent.click(screen.getByRole('checkbox', { name: /Admin/ }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    refresh();

    expect(screen.getByRole('dialog', { name: 'Rollen zuweisen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Übernehmen' })).toBeEnabled();
  });

  it('schließt das Blatt über den Scrim, ohne etwas zu schicken', async () => {
    const { api, container, refresh } = await build();

    await userEvent.click(screen.getByRole('button', { name: /Jonas/ }));
    refresh();
    const scrim = container.querySelector<HTMLElement>('.overlay__scrim');
    scrim?.click();
    refresh();

    expect(api.assigned).toEqual([]);
    expect(screen.queryByRole('dialog', { name: 'Rollen zuweisen' })).not.toBeInTheDocument();
  });
});
