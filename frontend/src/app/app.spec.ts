import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { DeferBlockState, type ComponentFixture } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { App } from './app';
import { routes } from './app.routes';
import { mapWithDoubles, answerManifest } from './testing/map-doubles';

/** Triggers the `@defer` block of the map in the shell. */
async function renderMap(fixture: ComponentFixture<unknown>): Promise<void> {
  const blocks = await fixture.getDeferBlocks();
  for (const block of blocks) await block.render(DeferBlockState.Complete);
}

async function app() {
  answerManifest();
  mapWithDoubles();
  // The shell uses the account through the avatar, and so the API. In the
  // test, no server gives an answer.
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

    await navigate('/arten');
    // The species tab opens with its search bar and has no page title.
    expect(await screen.findByRole('textbox', { name: 'Art suchen' })).toBeInTheDocument();

    for (const [path, titel] of [
      ['/eintraege', 'Einträge'],
      ['/konto', 'Einstellungen'],
    ]) {
      await navigate(path);
      // The page header is the only H1. The account screen also shows „Konto“
      // as a section below it.
      expect(await screen.findByRole('heading', { name: titel, level: 1 })).toBeInTheDocument();
    }
  });

  it('führt einen unbekannten Pfad auf die Karte', async () => {
    const { navigate, fixture } = await app();

    await navigate('/gibtesnicht');
    await renderMap(fixture);

    expect(await screen.findByRole('region', { name: 'Karte von Deutschland' })).toBeInTheDocument();
  });

  // The workshop page is in `dev.routes.e2e.ts`. This shell loads `dev.routes.ts`, an empty list.
});
