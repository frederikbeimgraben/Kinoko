import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { ANISE, FLOUR, OAK, TermsApiDouble, termsApiProvider } from '../../testing/terms-fixture';
import { CategoriesComponent } from './categories.component';

async function build(api = new TermsApiDouble()): Promise<{
  container: Element;
  api: TermsApiDouble;
  router: Router;
}> {
  const { container } = await render(CategoriesComponent, {
    providers: [provideRouter(ANY_ROUTE), termsApiProvider(api)],
  });
  return { container, api, router: TestBed.inject(Router) };
}

/** Die Liste der Ziele im Blatt der Zusammenführung. */
function targets(): HTMLElement {
  return screen.getByRole('group', { name: 'Ziel' });
}

/** Öffnet das Blatt eines Begriffs. */
async function open(name: string): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(name) }));
}

describe('CategoriesComponent', () => {
  it('zeigt die Begriffe der ersten Gattung', async () => {
    const { container } = await build();

    expect(screen.getByRole('button', { name: /Anis/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Eiche/ })).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('wechselt die Gattung', async () => {
    await build();

    await userEvent.click(screen.getByRole('tab', { name: 'Bäume' }));

    expect(screen.getByRole('button', { name: /Eiche/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Anis/ })).not.toBeInTheDocument();
  });

  it('sucht innerhalb der Gattung', async () => {
    await build();

    await userEvent.type(screen.getByRole('textbox', { name: 'Kategorie suchen' }), 'mehl');

    expect(screen.queryByRole('button', { name: /Anis/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mehl/ })).toBeInTheDocument();
  });

  it('legt eine Kategorie an', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Kategorie anlegen' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Zimt');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.created).toEqual([{ kind: 'smell', slug: 'zimt', name: 'Zimt' }]);
  });

  it('benennt eine Kategorie um', async () => {
    const { api } = await build();

    await open('Anis');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Name' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Name' }), 'Zimt');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.patched).toEqual([{ id: ANISE.id, write: { name: 'Zimt' } }]);
  });

  it('löscht erst nach der Bestätigung', async () => {
    const { api } = await build();

    await open('Anis');
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(api.removed).toEqual([]);
    expect(screen.getByRole('heading', { name: 'Anis löschen?' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(api.removed).toEqual([ANISE.id]);
  });

  it('führt zwei Kategorien zusammen', async () => {
    const { api } = await build();

    await open('Anis');
    await userEvent.click(screen.getByRole('button', { name: /Zusammenführen/ }));
    await userEvent.click(within(targets()).getByRole('button', { name: /Mehl/ }));
    expect(api.merged).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Zusammenführen' }));

    expect(api.merged).toEqual([{ id: ANISE.id, into: FLOUR.id }]);
  });

  it('bietet die eigene Kategorie nicht als Ziel an', async () => {
    await build();
    await userEvent.click(screen.getByRole('tab', { name: 'Bäume' }));

    await open('Eiche');
    await userEvent.click(screen.getByRole('button', { name: /Zusammenführen/ }));

    expect(within(targets()).queryAllByRole('button', { name: new RegExp(OAK.name) })).toHaveLength(0);
  });

  it('führt zurück', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(navigate).toHaveBeenCalledWith('/verwaltung');
  });
});
