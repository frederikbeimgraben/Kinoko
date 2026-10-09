import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { throwError } from 'rxjs';
import { ViewportService } from '../../core/layout/viewport.service';
import { noViolations } from '../../testing/axe';
import { GlossaryApiDouble, glossaryApiProvider } from '../../testing/glossary-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { GlossaryComponent } from './glossary.component';

async function build(
  wide = false,
  api = new GlossaryApiDouble(),
): Promise<{ container: Element; router: Router }> {
  const { container } = await render(GlossaryComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      glossaryApiProvider(api),
      { provide: ViewportService, useValue: { wide: signal(wide) } },
    ],
  });
  return { container, router: TestBed.inject(Router) };
}

describe('GlossaryComponent', () => {
  it('shows each term with its definition', async () => {
    const { container } = await build();

    expect(screen.getByText('Hymenium')).toBeInTheDocument();
    expect(screen.getByText('Die sporenbildende Schicht der Fruchtschicht.')).toBeInTheDocument();
    await noViolations(container);
  });

  it('searches in the term', async () => {
    await build();

    await userEvent.type(screen.getByRole('textbox', { name: 'Begriff suchen' }), 'lam');

    expect(screen.queryByText('Hymenium')).not.toBeInTheDocument();
    expect(screen.getByText('Lamellen')).toBeInTheDocument();
  });

  it('says that the glossary has no terms yet, not that a search found nothing', async () => {
    const api = new GlossaryApiDouble();
    api.entryList = [];
    await build(false, api);

    expect(screen.getByText('Noch keine Begriffe')).toBeInTheDocument();
    expect(screen.queryByText('Begriff nicht gefunden')).not.toBeInTheDocument();
  });

  it('says "not found" only for a search without a hit', async () => {
    await build();

    await userEvent.type(screen.getByRole('textbox', { name: 'Begriff suchen' }), 'xyz');

    expect(screen.getByText('Begriff nicht gefunden')).toBeInTheDocument();
  });

  it('shows a load error with a way to try again', async () => {
    const api = new GlossaryApiDouble();
    const list = vi.spyOn(api, 'list').mockReturnValueOnce(throwError(() => new Error('offline')));
    await build(false, api);

    expect(screen.getByText('Laden fehlgeschlagen')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(list).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Hymenium')).toBeInTheDocument();
  });

  it('goes back to the account', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(navigate).toHaveBeenCalledWith('/konto');
  });

  it('has a title and no way back in the desktop detail pane', async () => {
    await build(true);

    expect(screen.getByRole('heading', { name: 'Glossar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zurück' })).not.toBeInTheDocument();
  });
});
