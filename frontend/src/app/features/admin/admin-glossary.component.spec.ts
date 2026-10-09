import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { GlossaryApiDouble, HYMENIUM, glossaryApiProvider } from '../../testing/glossary-fixture';
import { I18nService } from '../../core/i18n/i18n.service';
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

  it('zeigt ohne Begriffe einen leeren Zustand', async () => {
    const api = new GlossaryApiDouble();
    api.entryList = [];
    await build(api);

    expect(screen.getByText('Noch keine Begriffe')).toBeInTheDocument();
  });

  it('legt einen Begriff über das Blatt an', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Begriff anlegen' }));
    expect(screen.getByRole('dialog', { name: 'Begriff anlegen' })).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Begriff' }), 'Velum');
    await userEvent.type(screen.getByRole('textbox', { name: 'Begriff (Englisch)' }), 'Veil');
    await userEvent.type(screen.getByRole('textbox', { name: 'Deutsch' }), 'Hülle.');
    await userEvent.type(screen.getByRole('textbox', { name: 'English' }), 'Veil.');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.created).toEqual([
      { term: 'Velum', termEn: 'Veil', definition: 'Hülle.', definitionEn: 'Veil.' },
    ]);
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
    expect(screen.getByRole('dialog', { name: 'Glossareintrag' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'English' })).toHaveValue('The spore-bearing layer.');
    await userEvent.clear(screen.getByRole('textbox', { name: 'Deutsch' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Deutsch' }), 'Neu.');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(api.updated).toEqual([
      {
        id: HYMENIUM.id,
        write: {
          term: 'Hymenium',
          termEn: 'Hymenium',
          definition: 'Neu.',
          definitionEn: 'The spore-bearing layer.',
        },
      },
    ]);
  });

  it('löscht einen Begriff', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: /Hymenium/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Entfernen' }));

    expect(api.removed).toEqual([HYMENIUM.id]);
  });

  it('bietet beim Anlegen kein Entfernen an', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Begriff anlegen' }));

    expect(screen.queryByRole('button', { name: 'Entfernen' })).not.toBeInTheDocument();
    expect(api.removed).toEqual([]);
  });

  it('zeigt die englische Erklärung in Englisch, sonst die deutsche', async () => {
    await build();
    const i18n = TestBed.inject(I18nService);
    i18n.setLocale('en');
    await screen.findByText('The spore-bearing layer.');

    expect(screen.getByText('Blattartige Strukturen unter dem Hut.')).toBeInTheDocument();
    i18n.setLocale('de');
  });

  it('sucht und führt zurück', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.type(screen.getByRole('textbox', { name: 'Begriff suchen' }), 'zzz');
    expect(screen.queryByRole('button', { name: /Hymenium/ })).not.toBeInTheDocument();
    expect(screen.getByText('Begriff nicht gefunden')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(navigate).toHaveBeenCalledWith('/verwaltung');
  });
});
