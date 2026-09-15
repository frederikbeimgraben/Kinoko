import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { ANY_ROUTE } from '../../testing/routes';
import userEvent from '@testing-library/user-event';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { noViolations } from '../../testing/axe';
import type { Permission } from '../../core/api/models';
import { AdminComponent } from './admin.component';

interface Setup {
  container: Element;
  api: AccessApiDouble;
  router: Router;
}

async function build(held: Permission[]): Promise<Setup> {
  const api = new AccessApiDouble();
  api.mineAnswer = held;
  const { container, detectChanges } = await render(AdminComponent, {
    providers: [provideRouter(ANY_ROUTE), ...authStubProviders(new AuthStub()), accessApiProvider(api)],
  });
  TestBed.inject(ApplicationRef).tick();
  detectChanges();
  return { container, api, router: TestBed.inject(Router) };
}

describe('AdminComponent', () => {
  it('zeigt nur die Punkte, zu denen ein Recht gehört', async () => {
    const { container } = await build(['text.edit', 'role.assign']);

    expect(screen.getByText('Texte')).toBeInTheDocument();
    expect(screen.getByText('Personen')).toBeInTheDocument();
    expect(screen.queryByText('Rollen')).not.toBeInTheDocument();
    expect(screen.queryByText('Bilder')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('schreibt die Tausender der Zähler mit Leerzeichen', async () => {
    await build(['text.edit']);

    expect(screen.getByText('1 284')).toBeInTheDocument();
  });

  it('setzt zwei Zähler einer Zeile mit einem Punkt zusammen', async () => {
    await build(['image.review']);

    expect(screen.getByText('312 · 4')).toBeInTheDocument();
  });

  it('führt von der Zeile Texte auf die Texte', async () => {
    const { router } = await build(['text.edit']);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: /Texte/ }));

    expect(navigate).toHaveBeenCalledWith('/verwaltung/texte');
  });

  it('führt mit dem Recht zu prüfen in den Eingang der Bilder', async () => {
    const { router } = await build(['image.review']);
    const navigate = vi.spyOn(router, 'navigateByUrl');

    await userEvent.click(screen.getByRole('button', { name: /Bilder/ }));

    expect(navigate).toHaveBeenCalledWith('/verwaltung/bilder');
  });

  it('trägt den Block Betrieb mit Funden und Läufen', async () => {
    await build(['find.review', 'run.manage']);

    expect(screen.getByText('Betrieb')).toBeInTheDocument();
    expect(screen.getByText('382 · 14')).toBeInTheDocument();
    expect(screen.getByText('4 · 1')).toBeInTheDocument();
  });

  it('lässt einen Block ohne Zeile weg', async () => {
    await build(['text.edit']);

    expect(screen.queryByText('Zugang')).not.toBeInTheDocument();
    expect(screen.queryByText('Betrieb')).not.toBeInTheDocument();
  });
});
