import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ANY_ROUTE } from '../../testing/routes';
import userEvent from '@testing-library/user-event';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { noViolations } from '../../testing/axe';
import { RolesComponent } from './roles.component';

async function build(api = new AccessApiDouble()): Promise<{
  container: Element;
  api: AccessApiDouble;
  router: Router;
}> {
  const { container } = await render(RolesComponent, {
    providers: [provideRouter(ANY_ROUTE), accessApiProvider(api)],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('RolesComponent', () => {
  it('zeigt jede Rolle mit ihrer Beschreibung und ihren Personen', async () => {
    const { container } = await build();

    expect(screen.getByText('Trägt jedes Recht, auch jedes neu eingeführte. · 1 Person')).toBeInTheDocument();
    expect(screen.getByText('Hat jede angemeldete Person.')).toBeInTheDocument();
    expect(screen.getByText('Arten und Bilder pflegen. · 3 Personen')).toBeInTheDocument();
    await noViolations(container);
  });

  it('gibt nur den festen Rollen ein Schloss', async () => {
    await build();

    expect(screen.getAllByLabelText('Feste Rolle')).toHaveLength(2);
  });

  it('führt von einer Zeile auf die Rolle', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: /Pilzberater/ }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung/rollen', 'rolle-berater']);
  });

  it('legt über die letzte Zeile eine neue Rolle an', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung/rollen', 'neu']);
  });
});
