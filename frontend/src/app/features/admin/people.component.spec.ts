import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ANY_ROUTE } from '../../testing/routes';
import userEvent from '@testing-library/user-event';
import { AccessApiDouble, accessApiProvider, problem } from '../../testing/access-fixture';
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

/** Legt den Ausschnitt in ein `main`, so wie die Hülle es tut. */
function inMain(container: Element): Element {
  const main = document.createElement('main');
  main.append(container);
  document.body.append(main);
  return main;
}

describe('PeopleComponent', () => {
  it('zeigt die Konten mit ihren Rollen', async () => {
    const { container } = await build();

    expect(screen.getByText('frederik@beimgraben.net')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    await noViolations(container);
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

    expect(screen.getByRole('dialog', { name: 'Jonas' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Pilzberater/ })).not.toBeChecked();
    expect(screen.queryByRole('checkbox', { name: /^Nutzer/ })).not.toBeInTheDocument();
    // Kopfleiste und Blatt tragen je ein `header`. In der App liegen beide im
    // `main` der Hülle und sind darum keine Banner; hier steht das `main` mit.
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
    expect(screen.queryByRole('dialog', { name: 'Jonas' })).not.toBeInTheDocument();
  });

  it('lässt das Blatt offen, wenn der Dienst die Zuweisung abweist', async () => {
    const { api, refresh } = await build();
    // So antwortet der Dienst, wenn der letzten Person die Rolle Admin fehlte.
    api.rejectWith = problem(409, 'Das ist die letzte Person mit der Rolle Admin.');

    await userEvent.click(screen.getByRole('button', { name: /Frederik/ }));
    refresh();
    await userEvent.click(screen.getByRole('checkbox', { name: /Admin/ }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));
    refresh();

    expect(screen.getByRole('dialog', { name: 'Frederik' })).toBeInTheDocument();
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
    expect(screen.queryByRole('dialog', { name: 'Jonas' })).not.toBeInTheDocument();
  });
});
