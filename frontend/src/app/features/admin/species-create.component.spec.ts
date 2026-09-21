import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SpeciesCreateComponent } from './species-create.component';

async function build(): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SpeciesCreateComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting()],
  });
  return { container, http: TestBed.inject(HttpTestingController) };
}

// Das Blatt trägt viele Knöpfe; unter Last braucht die Suche nach Rolle länger.
describe('SpeciesCreateComponent', { timeout: 20_000 }, () => {
  it('nennt die drei Abschnitte und die Vorgaben der Einordnung', async () => {
    const { container } = await build();

    expect(screen.getByRole('heading', { name: 'Art anlegen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Einordnung' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Röhrling' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'essbar' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('wählt eine andere Gattungsgruppe im Blatt', async () => {
    await build();

    await userEvent.click(screen.getByRole('button', { name: 'Röhrling' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tintling' }));

    expect(screen.getByRole('button', { name: 'Tintling' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('wählt einen anderen Speisewert im Blatt', async () => {
    await build();

    await userEvent.click(screen.getByRole('button', { name: 'essbar' }));
    await userEvent.click(screen.getByRole('button', { name: 'giftig' }));

    expect(screen.getByRole('button', { name: 'giftig' })).toBeInTheDocument();
  });

  it('schickt Name, Einordnung, Namen und Quelle an den Vertrag', async () => {
    const { http } = await build();

    await userEvent.type(screen.getByLabelText('Name'), 'Schopftintling');
    await userEvent.type(screen.getByLabelText('Wissenschaftlicher Name'), 'Coprinus comatus');
    await userEvent.type(screen.getByLabelText('Weitere Namen'), 'Spargelpilz');
    await userEvent.type(screen.getByLabelText('Quelle'), 'https://123pilzsuche.de/a.htm');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Nach BArtSchV geschützt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Anlegen und Merkmale prüfen' }));

    const call = http.expectOne('/api/species');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual({
      name: 'Schopftintling',
      scientificName: 'Coprinus comatus',
      group: 'bolete',
      edibility: 'edible',
      protection: 'personal_use',
      names: [{ name: 'Spargelpilz', kind: 'synonym' }],
      sources: [
        {
          scope: 'profile',
          title: '123pilzsuche.de',
          url: 'https://123pilzsuche.de/a.htm',
          checkedOn: new Date().toISOString().slice(0, 10),
        },
      ],
    });
    call.flush({ slug: 'coprinus-comatus' });
  });

  it('gibt den Fuß wieder frei, wenn das Anlegen scheitert', async () => {
    const { http } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Anlegen und Merkmale prüfen' }));
    http.expectOne('/api/species').flush('', { status: 422, statusText: 'Unprocessable' });

    expect(await screen.findByRole('button', { name: 'Anlegen und Merkmale prüfen' })).toBeEnabled();
  });
});
