import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { DeferBlockState, type ComponentFixture } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { App } from './app';
import { routes } from './app.routes';
import { mapWithDoubles, answerManifest } from './testing/map-doubles';

/** Löst den `@defer`-Block der Karte in der Hülle aus. */
async function renderMap(fixture: ComponentFixture<unknown>): Promise<void> {
  const blocks = await fixture.getDeferBlocks();
  for (const block of blocks) await block.render(DeferBlockState.Complete);
}

async function app() {
  answerManifest();
  mapWithDoubles();
  // Die Hülle hängt über den Avatar am Konto und damit an der API; im Test
  // antwortet dort niemand.
  return render(App, {
    providers: [
      provideRouter(routes),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideServiceWorker('ngsw-worker.js', { enabled: false }),
    ],
  });
}

describe('App', () => {
  it('zeigt beim Start die Karte in der Hülle', async () => {
    const { fixture } = await app();
    await fixture.whenStable();
    await renderMap(fixture);

    expect(await screen.findByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Hauptbereiche' })).toBeInTheDocument();
  });

  it('führt jeden Reiter auf seine Seite', async () => {
    const { navigate } = await app();

    for (const [path, titel] of [
      ['/arten', 'Arten'],
      ['/eintraege', 'Einträge'],
      ['/konto', 'Einstellungen'],
    ]) {
      await navigate(path);
      // Die Kopfleiste der Seite ist die einzige H1; „Konto“ steht auf dem
      // Konto-Screen auch als Abschnitt darunter.
      expect(await screen.findByRole('heading', { name: titel, level: 1 })).toBeInTheDocument();
    }
  });

  it('führt einen unbekannten Pfad auf die Karte', async () => {
    const { navigate, fixture } = await app();

    await navigate('/gibtesnicht');
    await renderMap(fixture);

    expect(await screen.findByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
  });

  // Die Werkstattseite hängt an `dev.routes.e2e.ts`; diese Hülle lädt `dev.routes.ts`, eine leere Liste.
});
