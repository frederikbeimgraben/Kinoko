import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, waitFor, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { SectionSeasonComponent } from './section-season.component';
import { SpeciesEditorStore } from './species-editor.store';
import { SECTION_SPECIES } from './section.testing';

function routeFor(): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap({ slug: 'boletus-edulis' });
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

/** Finds a row of the peak sheet by its label. A role query over the 53 rows of the sheet takes seconds in jsdom. */
function row(sheet: HTMLElement, label: string): HTMLElement {
  const found = within(sheet).getByText(label).closest('button');
  if (found === null) throw new Error(`no row ${label}`);
  return found;
}

async function build(): Promise<{ container: Element; http: HttpTestingController }> {
  TestBed.resetTestingModule();
  const { container } = await render(SectionSeasonComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/species/boletus-edulis').flush(SECTION_SPECIES);
  http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });
  return { container, http };
}

describe('SectionSeasonComponent', () => {
  beforeEach(() => {
    TestBed.inject(SpeciesEditorStore).load('');
  });

  it('nennt die Monate des Zeitraums', async () => {
    const { container } = await build();

    expect(await screen.findByText('Juni')).toBeInTheDocument();
    expect(screen.getByText('Oktober')).toBeInTheDocument();
    await noViolations(container);
  });

  it('schreibt den gezogenen Zeitraum an den Vertrag', async () => {
    const { http } = await build();
    await screen.findByText('Juni');

    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual(expect.objectContaining({ periodStartMonth: 6, periodEndMonth: 10 }));
  });

  it('wählt einen Höhepunkt und nimmt ihn wieder heraus', async () => {
    const { http } = await build();
    await screen.findByText('Juni');

    await userEvent.click(screen.getByRole('button', { name: '–' }));
    const sheet = await screen.findByRole('dialog', { name: 'Höhepunkt' });
    expect(row(sheet, '–')).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(row(sheet, 'KW 38'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'KW 38' }));
    const again = await screen.findByRole('dialog', { name: 'Höhepunkt' });
    await userEvent.click(row(again, '–'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.body).toEqual(
      expect.objectContaining({ periodPeakMonth: null, periodPeakWeek: null }),
    );
  });

  it('schreibt die Woche des Höhepunkts und ihren Monat', async () => {
    const { http } = await build();
    await screen.findByText('Juni');

    await userEvent.click(screen.getByRole('button', { name: '–' }));
    const sheet = await screen.findByRole('dialog', { name: 'Höhepunkt' });
    await userEvent.click(row(sheet, 'KW 38'));
    await userEvent.click(await screen.findByRole('button', { name: 'Übernehmen' }));

    const call = http.expectOne('/api/species/boletus-edulis');
    expect(call.request.body).toEqual(expect.objectContaining({ periodPeakWeek: 38, periodPeakMonth: 9 }));
  });

  it('zeigt die Kurve mit den Monaten der Achse', async () => {
    await build();
    await screen.findByText('Juni');

    expect(screen.getByRole('img', { name: 'Zeitraum' })).toBeInTheDocument();
    expect(['Jan', 'Apr', 'Jul', 'Okt', 'Dez'].every((month) => screen.queryByText(month) !== null)).toBe(
      true,
    );
  });

  it('zeigt einen Höhepunkt aus dem Katalog ohne Woche als Monat', async () => {
    TestBed.resetTestingModule();
    await render(SectionSeasonComponent, {
      providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting(), routeFor()],
    });
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/species/boletus-edulis').flush({ ...SECTION_SPECIES, periodPeakMonth: 9 });
    http.expectOne('/api/species/boletus-edulis/counts').flush({ records: 1, finds: 0, photos: 0 });

    expect(await screen.findByRole('button', { name: 'September' })).toBeInTheDocument();
  });
});
