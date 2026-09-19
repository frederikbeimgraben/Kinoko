import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { GlossaryApiDouble, HYMENIUM, glossaryApiProvider } from '../../testing/glossary-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { AdminGlossaryComponent } from './admin-glossary.component';

async function build(api = new GlossaryApiDouble()): Promise<{
  container: Element;
  api: GlossaryApiDouble;
  router: Router;
}> {
  const { container } = await render(AdminGlossaryComponent, {
    providers: [provideRouter(ANY_ROUTE), glossaryApiProvider(api)],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('AdminGlossaryComponent', () => {
  it('zeigt jeden Begriff als Zeile', async () => {
    const { container } = await build();

    expect(screen.getByRole('button', { name: /Hymenium/ })).toBeInTheDocument();
    await noViolations(container);
  });

  it('legt einen Begriff über das Blatt an', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Begriff anlegen' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Begriff' }), 'Velum');
    await userEvent.type(screen.getByRole('textbox', { name: 'Erklärung' }), 'Hülle.');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.created).toEqual([{ term: 'Velum', definition: 'Hülle.' }]);
  });

  it('legt ohne Erklärung nichts an', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Begriff anlegen' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Begriff' }), 'Velum');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.created).toEqual([]);
  });

  it('ändert einen Begriff', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: /Hymenium/ }));
    await userEvent.clear(screen.getByRole('textbox', { name: 'Erklärung' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Erklärung' }), 'Neu.');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.updated).toEqual([{ id: HYMENIUM.id, write: { term: 'Hymenium', definition: 'Neu.' } }]);
  });

  it('löscht einen Begriff', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: /Hymenium/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(api.removed).toEqual([HYMENIUM.id]);
  });

  it('lässt einen noch nicht angelegten Begriff einfach fallen', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Begriff anlegen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(api.removed).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Löschen' })).not.toBeInTheDocument();
  });

  it('sucht und führt zurück', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.type(screen.getByRole('textbox', { name: 'Begriff suchen' }), 'lam');
    expect(screen.queryByRole('button', { name: /Hymenium/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(navigate).toHaveBeenCalledWith('/verwaltung');
  });
});
