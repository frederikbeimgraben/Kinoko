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
  it('zeigt jede Rolle mit der Zahl ihrer Personen', async () => {
    const { container } = await build();

    expect(screen.getByRole('button', { name: /Admin/ })).toHaveTextContent('1 Person');
    expect(screen.getByRole('button', { name: /Pilzberater/ })).toHaveTextContent('3 Personen');
    expect(screen.getByText('0 Personen')).toBeInTheDocument();
    expect(screen.queryByText('Arten und Bilder pflegen.')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('führt von einer Zeile auf die Rolle', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: /Pilzberater/ }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung/rollen', 'rolle-berater']);
  });

  it('legt über die schwebende Schaltfläche eine neue Rolle an', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: 'Rolle anlegen' }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung/rollen', 'neu']);
  });
});
