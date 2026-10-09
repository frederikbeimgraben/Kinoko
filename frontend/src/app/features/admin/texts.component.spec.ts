import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { TextCatalogue, TextEntry } from '../../core/api/models';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { TextsComponent } from './texts.component';

const LEGEND: TextEntry = {
  key: 'karte.legende',
  values: { de: 'Fundwahrscheinlichkeit je Begehung', en: 'Probability of a find per visit' },
  changed: false,
  updatedAt: '2026-09-12T08:00:00+00:00',
};

const CHIP: TextEntry = {
  key: 'arten.chip.mitVorhersage',
  values: { de: 'Mit Vorhersage', en: 'With forecast' },
  changed: true,
  updatedAt: '2026-09-12T09:00:00+00:00',
};

const COUNT: TextEntry = {
  key: 'konto.zaehler',
  values: { de: '{finds, plural, one {# Fund} other {# Funde}} · {markers} Marker', en: '' },
  changed: false,
  updatedAt: '2026-09-12T09:00:00+00:00',
};

const CATALOGUE: TextCatalogue = {
  revision: 'W/"4-1"',
  locales: ['de', 'en'],
  entries: [LEGEND, CHIP, COUNT],
};

interface Setup {
  container: Element;
  http: HttpTestingController;
  toasts: ToastSpy;
}

async function build(): Promise<Setup> {
  localStorage.clear();
  const { container } = await render(TextsComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/texts').flush(CATALOGUE);
  return { container, http, toasts: toastSpy() };
}

describe('TextsComponent', () => {
  it('zeigt jeden Text in der Sprache der Oberfläche mit seinem Schlüssel', async () => {
    const setup = await build();

    expect(await screen.findByText('karte.legende')).toBeInTheDocument();
    expect(screen.getByText('Fundwahrscheinlichkeit je Begehung')).toBeInTheDocument();
    expect(screen.queryByText('Probability of a find per visit')).not.toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('zeigt eine ICU-Vorlage als lesbaren Titel', async () => {
    await build();

    expect(await screen.findByText('… Funde · … Marker')).toBeInTheDocument();
    expect(screen.queryByText(/plural/)).not.toBeInTheDocument();
  });

  it('markiert einen geänderten Text', async () => {
    await build();

    expect(await screen.findByText('geändert')).toBeInTheDocument();
  });

  it('sucht in Schlüssel und Text', async () => {
    await build();
    await screen.findByText('karte.legende');

    await userEvent.type(screen.getByLabelText('Text suchen'), 'forecast');

    expect(screen.queryByText('karte.legende')).not.toBeInTheDocument();
    expect(screen.getByText('arten.chip.mitVorhersage')).toBeInTheDocument();
  });

  it('sucht auch nach dem Bereich eines Schlüssels', async () => {
    await build();
    await screen.findByText('karte.legende');

    await userEvent.type(screen.getByLabelText('Text suchen'), 'karte.');

    expect(screen.getByText('karte.legende')).toBeInTheDocument();
    expect(screen.queryByText('arten.chip.mitVorhersage')).not.toBeInTheDocument();
  });

  it('zeigt nur die geänderten Einträge', async () => {
    await build();
    await screen.findByText('karte.legende');

    await userEvent.click(screen.getByRole('tab', { name: 'Geändert' }));

    expect(screen.queryByText('karte.legende')).not.toBeInTheDocument();
    expect(screen.getByText('arten.chip.mitVorhersage')).toBeInTheDocument();
  });

  it('speichert eine Änderung und schließt das Blatt', async () => {
    const setup = await build();
    await screen.findByText('karte.legende');

    await userEvent.click(screen.getByText('karte.legende'));
    const field = await screen.findByLabelText('Deutsch');
    await userEvent.clear(field);
    await userEvent.type(field, 'Trefferquote');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    const request = await vi.waitFor(() => setup.http.expectOne('/api/texts/karte.legende'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ locale: 'de', value: 'Trefferquote' });
    request.flush({ ...LEGEND, values: { ...LEGEND.values, de: 'Trefferquote' }, changed: true });

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Der Text ist gespeichert.']);
    });
    expect(screen.getByText('Trefferquote')).toBeInTheDocument();
  });

  it('bietet das Zurücksetzen nur bei einem geänderten Text an', async () => {
    await build();
    await screen.findByText('karte.legende');

    await userEvent.click(screen.getByText('karte.legende'));
    await screen.findByRole('button', { name: 'Speichern' });
    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByText('arten.chip.mitVorhersage'));

    expect(await screen.findByRole('button', { name: 'Zurücksetzen' })).toBeInTheDocument();
  });

  it('holt die Vorgabe in beiden Sprachen zurück, lädt neu und schließt das Blatt', async () => {
    const setup = await build();
    await screen.findByText('karte.legende');

    await userEvent.click(screen.getByText('arten.chip.mitVorhersage'));
    await userEvent.click(await screen.findByRole('button', { name: 'Zurücksetzen' }));

    for (const locale of ['de', 'en']) {
      const request = await vi.waitFor(() =>
        setup.http.expectOne(`/api/texts/arten.chip.mitVorhersage?locale=${locale}`),
      );
      expect(request.request.method).toBe('DELETE');
      request.flush(null, { status: 204, statusText: 'No Content' });
    }
    const fresh = { ...CATALOGUE, entries: [LEGEND, { ...CHIP, changed: false }] };
    await vi.waitFor(() => {
      setup.http.expectOne('/api/texts').flush(fresh);
    });

    await vi.waitFor(() => {
      expect(setup.toasts.success).toEqual(['Der Text ist wieder der Standardtext.']);
    });
    expect(screen.queryByRole('button', { name: 'Zurücksetzen' })).not.toBeInTheDocument();
    expect(screen.queryByText('geändert')).not.toBeInTheDocument();
  });

  it('zeigt keine Zeile, wenn nichts zur Suche passt', async () => {
    await build();
    await screen.findByText('karte.legende');

    await userEvent.type(screen.getByLabelText('Text suchen'), 'zzz');

    expect(screen.queryByText('karte.legende')).not.toBeInTheDocument();
    expect(screen.queryByText('arten.chip.mitVorhersage')).not.toBeInTheDocument();
  });
});
