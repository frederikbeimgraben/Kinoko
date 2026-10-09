import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import {
  FindPhotosApiDouble,
  FindsApiDouble,
  findPhotosApiProvider,
  findsApiProvider,
} from '../../testing/open-finds-fixture';
import { ANY_ROUTE } from '../../testing/routes';
import { speciesEntry } from '../../testing/species-fixture';
import { ToastService } from '../../ui/toast/toast.service';
import { SpeciesStore } from '../species/species.store';
import { FindQueueComponent } from './find-queue.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
});

function speciesStub(): unknown {
  return { loadBundle: () => Promise.resolve(), species: signal([STONE]) };
}

async function build(api = new FindsApiDouble()): Promise<{
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
      { provide: SpeciesStore, useValue: speciesStub() },
    ],
  });
  return { container, api, router: TestBed.inject(Router) };
}

describe('FindQueueComponent', () => {
  it('shows the species, the note and the rows of the top card, per the board FindQueue', async () => {
    const { container } = await build();

    expect(screen.getByText('2 offene Funde')).toBeInTheDocument();
    expect(screen.getAllByText('Steinpilz').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Am Wegrand').length).toBeGreaterThan(0);
    const rows = [...container.querySelectorAll('.queue__card--top app-list-row')].map(
      (row) =>
        `${row.querySelector('.row__title')?.textContent.trim()} ${row.querySelector('.row__plain')?.textContent.trim()}`,
    );
    expect(rows).toEqual(['Melder Frederik', 'Datum 6. September', 'Ort 48,5203 · 9,0511', 'Anzahl 3 Stück']);
    expect(container.textContent).not.toContain('person-eins');
    await noViolations(container);
  });

  it('leaves out the count row of a find without a count', async () => {
    const { container } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));

    const labels = [...container.querySelectorAll('.queue__card--top app-list-row .row__title')].map(
      (title) => title.textContent.trim(),
    );
    expect(labels).toEqual(['Melder', 'Datum', 'Ort']);
  });

  it('nimmt mit dem Haken an und zählt weiter', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));

    expect(api.reviewed).toEqual([{ id: 'fund-eins', decision: 'accepted' }]);
    expect(screen.getByText('1 offener Fund')).toBeInTheDocument();
  });

  it('lehnt mit dem Kreuz ab', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));

    expect(api.reviewed).toEqual([{ id: 'fund-eins', decision: 'rejected' }]);
  });

  it('zählt nach dem Rückgängig zurück und öffnet den Fund auf dem Server wieder', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    await userEvent.click(screen.getByRole('button', { name: 'Rückgängig' }));

    expect(screen.getByText('2 offene Funde')).toBeInTheDocument();
    expect(api.reopened).toEqual(['fund-eins']);
  });

  it('nimmt erst nach der Bestätigung jeden offenen Fund an und meldet das Ergebnis', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Alle annehmen' }));
    expect(api.reviewed).toEqual([]);

    const buttons = screen.getAllByRole('button', { name: 'Alle annehmen' });
    await userEvent.click(buttons[buttons.length - 1]);

    expect(api.reviewed).toEqual([
      { id: 'fund-eins', decision: 'accepted' },
      { id: 'fund-zwei', decision: 'accepted' },
    ]);
    expect(screen.getByText('Keine Funde offen')).toBeInTheDocument();
    expect(
      TestBed.inject(ToastService)
        .toasts()
        .map((toast) => toast.message),
    ).toEqual(['2 Funde angenommen']);
  });

  it('lässt einen Fund mit Fehler offen und nennt die Zahl im Toast', async () => {
    const api = new FindsApiDouble();
    api.failing.add('fund-zwei');
    await build(api);

    await userEvent.click(screen.getByRole('button', { name: 'Alle annehmen' }));
    const buttons = screen.getAllByRole('button', { name: 'Alle annehmen' });
    await userEvent.click(buttons[buttons.length - 1]);

    expect(screen.getByText('1 offener Fund')).toBeInTheDocument();
    const toasts = TestBed.inject(ToastService).toasts();
    expect(toasts.map((toast) => [toast.variant, toast.message])).toEqual([
      ['danger', 'Nicht angenommen: 1 von 2. Diese Funde bleiben offen.'],
    ]);
  });

  it('nimmt nach dem Abbrechen keinen Fund an', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Alle annehmen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(api.reviewed).toEqual([]);
    expect(screen.getByText('2 offene Funde')).toBeInTheDocument();
  });

  it('zeigt „Alle annehmen“ erst ab zwei offenen Funden', async () => {
    await build();

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));

    expect(screen.queryByRole('button', { name: 'Alle annehmen' })).toBeNull();
  });

  it('zeigt ohne offenen Fund den Leerzustand', async () => {
    const api = new FindsApiDouble();
    api.findList = [];

    const { container } = await build(api);

    expect(screen.getByText('Keine Funde offen')).toBeInTheDocument();
    await noViolations(container);
  });

  it('führt zurück', async () => {
    const { router } = await build();
    const navigate = vi.spyOn(router, 'navigate');

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung']);
  });
});
