import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Species } from '../../core/api/models';
import { GALLENROEHRLING, STEINPILZ } from '../../testing/species-fixture';
import { noViolations } from '../../testing/axe';
import { ComparisonComponent } from './comparison.component';

@Component({ template: '' })
class OtherComponent {}

const ROUTES = [{ path: 'arten/:slug', component: OtherComponent }];

interface Setup {
  container: Element;
  router: Router;
  refresh: () => void;
}

async function build(arten: readonly (Species | 'fehlt')[] = [STEINPILZ, GALLENROEHRLING]): Promise<Setup> {
  const slugs = ['steinpilz', 'gallenroehrling'];
  const { container, detectChanges } = await render(ComparisonComponent, {
    inputs: { slug: slugs[0], andere: slugs[1] },
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(ROUTES)],
  });
  const http = TestBed.inject(HttpTestingController);
  slugs.forEach((slug, index) => {
    const request = http.expectOne(`/api/arten/${slug}`);
    const art = arten[index];
    if (art === 'fehlt') {
      request.flush(
        { type: 'about:blank', title: 'Nicht gefunden', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    } else {
      request.flush(art);
    }
  });
  detectChanges();
  return { container, router: TestBed.inject(Router), refresh: detectChanges };
}

describe('ComparisonComponent', () => {
  it('stellt beide Arten nebeneinander', async () => {
    const setup = await build();

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Gallenröhrling')).toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('nennt die Zeilen in der Reihenfolge der Artseite', async () => {
    const setup = await build();

    const labels = [...setup.container.querySelectorAll('.kv__key')]
      .map((key) => key.textContent.trim())
      .filter((text) => text !== '');
    expect(labels).toEqual([
      'Speisewert',
      'Hut',
      'Hut',
      'Sporenlager',
      'Auf Druck oder im Schnitt',
      'Stiel',
      'Geschmack',
      'Wachstum',
    ]);
  });

  it('führt zurück zur Art, von der der Vergleich kam', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    await vi.waitFor(() => {
      expect(setup.router.url).toBe('/arten/steinpilz');
    });
  });

  it('sagt es, wenn eine der beiden Arten fehlt', async () => {
    await build([STEINPILZ, 'fehlt']);

    expect(screen.getByText('Eine der beiden Arten gibt es nicht.')).toBeInTheDocument();
  });
});
