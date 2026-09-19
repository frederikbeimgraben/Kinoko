import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { GlossaryApiDouble, glossaryApiProvider } from '../../testing/glossary-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { GlossaryComponent } from './glossary.component';

async function build(): Promise<{ container: Element; router: Router }> {
  const { container } = await render(GlossaryComponent, {
    providers: [provideRouter(ANY_ROUTE), glossaryApiProvider(new GlossaryApiDouble())],
  });
  return { container, router: TestBed.inject(Router) };
}

describe('GlossaryComponent', () => {
  it('zeigt jeden Begriff mit seiner Erklärung', async () => {
    const { container } = await build();

    expect(screen.getByText('Hymenium')).toBeInTheDocument();
    expect(screen.getByText('Die sporenbildende Schicht der Fruchtschicht.')).toBeInTheDocument();
    await noViolations(container);
  });

  it('sucht im Begriff', async () => {
    await build();

    await userEvent.type(screen.getByRole('textbox', { name: 'Begriff suchen' }), 'lam');

    expect(screen.queryByText('Hymenium')).not.toBeInTheDocument();
    expect(screen.getByText('Lamellen')).toBeInTheDocument();
  });

  it('führt zurück auf das Konto', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(navigate).toHaveBeenCalledWith('/konto');
  });
});
