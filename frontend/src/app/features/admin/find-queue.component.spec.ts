import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { AccessApiDouble, accessApiProvider } from '../../testing/access-fixture';
import { noViolations } from '../../testing/axe';
import {
  FindPhotosApiDouble,
  FindsApiDouble,
  findPhotosApiProvider,
  findsApiProvider,
} from '../../testing/open-finds-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { speciesEntry } from '../../testing/species-fixture';
import { SpeciesState } from '../species/species.state';
import { FindQueueComponent } from './find-queue.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
});

function speciesStub(): unknown {
  return { loadBundle: () => Promise.resolve(), species: signal([STONE]) };
}

async function build(
  api = new FindsApiDouble(),
  access = new AccessApiDouble(),
): Promise<{
  container: Element;
  api: FindsApiDouble;
  router: Router;
}> {
  const photos = new FindPhotosApiDouble();
  photos.photoList = [];
  const { container } = await render(FindQueueComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      findsApiProvider(api),
      findPhotosApiProvider(photos),
      accessApiProvider(access),
      { provide: SpeciesState, useValue: speciesStub() },
    ],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('FindQueueComponent', () => {
  it('zeigt Art, Zeile und Ort der obersten Karte, ohne Kennung des Melders', async () => {
    const { container } = await build();

    expect(screen.getByText('1 von 2')).toBeInTheDocument();
    expect(screen.getAllByText('Steinpilz').length).toBeGreaterThan(0);
    expect(screen.getByText('6. Sept. · 3 Stück')).toBeInTheDocument();
    expect(screen.queryByText(/person-eins/)).not.toBeInTheDocument();
    expect(screen.getByText('48,5203 · 9,0511')).toBeInTheDocument();
    expect(screen.getByText('Am Wegrand')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt eine Karte ohne Anzahl die Anzahl weg', async () => {
    await build();

    expect(screen.getByText('6. Sept.')).toBeInTheDocument();
  });

  it('nennt den Melder, wenn eine gemeinsame Gruppe ihn auflöst', async () => {
    const access = new AccessApiDouble();
    access.personNamesAnswer = [{ id: 'person-eins', name: 'Melderin Eins' }];

    await build(new FindsApiDouble(), access);

    expect(await screen.findByText('6. Sept. · 3 Stück · Melderin Eins')).toBeInTheDocument();
  });

  it('nimmt mit dem Haken an und zählt weiter', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));

    expect(api.reviewed).toEqual([{ id: 'fund-eins', decision: 'accepted' }]);
    expect(screen.getByText('2 von 2')).toBeInTheDocument();
  });

  it('lehnt mit dem Kreuz ab', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));

    expect(api.reviewed).toEqual([{ id: 'fund-eins', decision: 'rejected' }]);
  });

  it('zählt nach dem Rückgängig zurück', async () => {
    await build();

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));

    expect(screen.getByText('1 von 2')).toBeInTheDocument();
  });

  it('nimmt erst nach der Bestätigung alle an', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Alle annehmen' }));
    expect(api.accepted).toBe(0);

    const buttons = screen.getAllByRole('button', { name: 'Alle annehmen' });
    await userEvent.click(buttons[buttons.length - 1]);

    expect(api.accepted).toBe(1);
    expect(screen.getByText('Nichts zu prüfen')).toBeInTheDocument();
  });

  it('zeigt ohne offenen Fund den Leerzustand', async () => {
    const api = new FindsApiDouble();
    api.findList = [];

    const { container } = await build(api);

    expect(screen.getByText('Nichts zu prüfen')).toBeInTheDocument();
    await noViolations(container);
  });

  it('führt zurück', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung']);
  });
});
