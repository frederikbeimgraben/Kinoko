import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Find } from '../../core/api/models';
import { SpeciesState } from '../species/species.state';
import { SPECIES_BUNDLE } from '../../testing/species-fixture';
import { noViolations } from '../../testing/axe';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { FIND } from '../../testing/entries-fixture';
import { MapState } from '../map/map.state';
import { FindFormComponent, type FindSubmission } from './find-form.component';

/** Der Ort, auf dem das Formular ohne vorhandenen Fund steht. */
const LOCATION: readonly [number, number] = [9.0511, 48.5203];

interface Extra {
  start?: Find;
  withPhotos?: boolean;
  editing?: boolean;
  busy?: boolean;
}

interface Setup {
  container: Element;
  submissions: FindSubmission[];
  toasts: ToastSpy;
}

async function build(
  extra: Extra = {},
  bundle: { items: readonly unknown[] } = SPECIES_BUNDLE,
): Promise<Setup> {
  const start = extra.start;
  const { container, detectChanges, fixture } = await render(FindFormComponent, {
    inputs: {
      location: start === undefined ? LOCATION : ([start.lon, start.lat] as readonly [number, number]),
      ...extra,
    },
    providers: [provideHttpClient(), provideHttpClientTesting()],
  });
  TestBed.inject(MapState).species.set('steinpilz');
  await vi.waitFor(() => {
    TestBed.inject(HttpTestingController).expectOne('/api/species/bundle').flush(bundle);
  });
  // Der Katalog landet über den Speicher im Zustand, nicht mit dem Aufruf.
  const catalogue = TestBed.inject(SpeciesState);
  await vi.waitFor(() => {
    expect(catalogue.species()).toHaveLength(bundle.items.length);
  });
  detectChanges();
  const submissions: FindSubmission[] = [];
  fixture.componentInstance.submitted.subscribe((submission) => submissions.push(submission));
  return { container, submissions, toasts: toastSpy() };
}

/** Das X im Kopf des Blatts der Artwahl. */
function sheetClose(container: Element): HTMLElement {
  const close = container.querySelector<HTMLElement>('.sheet__close');
  if (close === null) throw new Error('Das Blatt trägt kein X.');
  return close;
}

describe('FundFormularComponent', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 8, 10, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt die Vorgabe-Art und das heutige Datum', async () => {
    const setup = await build();

    expect(screen.getByRole('button', { name: 'Steinpilz' })).toBeInTheDocument();
    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-10');
    expect(screen.getByText('10. 9. 2026')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('gibt Art, Datum, Anzahl, Notiz und Sichtbarkeit ab', async () => {
    const setup = await build();

    await userEvent.type(screen.getByLabelText('Anzahl'), '3');
    await userEvent.type(screen.getByLabelText('Notiz'), 'Unter Fichten');
    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input).toEqual({
      speciesId: 'steinpilz',
      lat: 48.5203,
      lon: 9.0511,
      foundOn: '2026-09-10',
      count: 3,
      note: 'Unter Fichten',
      visibility: 'shared',
      groupId: null,
      forTraining: false,
    });
  });

  it('lässt Anzahl und Notiz weg, wenn nichts dasteht', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input.count).toBeNull();
    expect(setup.submissions[0].input.note).toBeNull();
  });

  it('wechselt die Art über die Auswahl aus dem Katalog', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));
    await userEvent.click(screen.getByRole('button', { name: /Semmelstoppelpilz/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input.speciesId).toBe('semmelstoppelpilz');
  });

  it('stellt die Artauswahl als eigenes Blatt mit Titel', async () => {
    await build();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));

    expect(screen.getByRole('heading', { name: 'Art wählen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument();
  });

  it('schließt die Artauswahl über das X, ohne die Art zu wechseln', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));
    await userEvent.click(sheetClose(setup.container));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input.speciesId).toBe('steinpilz');
  });

  it('weist ein Datum in der Zukunft zurück', async () => {
    const setup = await build();

    await userEvent.clear(screen.getByLabelText('Datum'));
    await userEvent.type(screen.getByLabelText('Datum'), '2027-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions).toHaveLength(0);
    expect(setup.toasts.failure).toEqual(['Das Datum liegt in der Zukunft.']);
  });

  it('weist eine Anzahl unter eins zurück', async () => {
    const setup = await build();

    await userEvent.type(screen.getByLabelText('Anzahl'), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions).toHaveLength(0);
    expect(setup.toasts.failure).toEqual(['Die Anzahl ist eine ganze Zahl ab 1.']);
  });

  it('trägt weder eigenen Kopf noch Abbrechen-Knopf', async () => {
    const setup = await build();

    expect(setup.container.querySelector('.form__head')).toBeNull();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument();
  });

  it('sperrt das Speichern, solange es läuft', async () => {
    const setup = await build({ busy: true });

    expect(setup.container.querySelector('.btn.primary')).toBeDisabled();
  });

  it('dimmt und sperrt die Felder, solange das Speichern läuft', async () => {
    const setup = await build({ busy: true });

    expect(setup.container.querySelector('.form__fields')).toHaveClass('form__fields--busy');
    expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument();
  });

  it('lässt die Felder frei, solange nichts läuft', async () => {
    const setup = await build();

    expect(setup.container.querySelector('.form__fields')).not.toHaveClass('form__fields--busy');
  });

  it('füllt sich aus einem vorhandenen Fund, lässt die Fotos weg und behält die Freigabe', async () => {
    const setup = await build({ start: FIND, withPhotos: false, editing: true });

    expect(screen.getByLabelText('Datum')).toHaveValue('2026-09-06');
    expect(screen.getByLabelText('Anzahl')).toHaveValue(3);
    expect(screen.queryByText('Fotos')).not.toBeInTheDocument();
    expect(setup.container.querySelector('.field__trail')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input.forTraining).toBe(true);
  });

  it('schaltet die Freigabe für das Training um', async () => {
    const setup = await build({ start: FIND, withPhotos: false, editing: true });

    await userEvent.click(screen.getByRole('switch', { name: 'Für Training freigeben' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions[0].input.forTraining).toBe(false);
  });

  it('lässt die Anzahl leer, wenn der Fund keine trägt', async () => {
    await build({ start: { ...FIND, count: null } });

    expect(screen.getByLabelText('Anzahl')).toHaveValue(null);
  });

  it('meldet, wenn der Katalog keine Art zur Karte kennt', async () => {
    const setup = await build({}, { items: [] });

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.submissions).toHaveLength(0);
    expect(setup.toasts.failure).toEqual(['Wähle eine Art.']);
  });
});
