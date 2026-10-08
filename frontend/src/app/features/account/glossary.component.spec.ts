import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ViewportService } from '../../core/layout/viewport.service';
import { noViolations } from '../../testing/axe';
import { GlossaryApiDouble, glossaryApiProvider } from '../../testing/glossary-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { GlossaryComponent } from './glossary.component';

async function build(wide = false): Promise<{ container: Element; router: Router }> {
  const { container } = await render(GlossaryComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      glossaryApiProvider(new GlossaryApiDouble()),
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
