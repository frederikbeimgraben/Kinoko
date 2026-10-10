import { computed, signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpTestingController } from '@angular/common/http/testing';
import { noViolations } from '../../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../../testing/catalogue-double';
import { I18nService } from '../../../core/i18n/i18n.service';
import { photo } from '../../../testing/photos-fixture';
import { ANY_ROUTE } from '../../../testing/routes';
import type { Photo } from '../../../core/api/models';
import { ImagesStore } from '../../images/images.store';
import { SpeciesLeadComponent } from './species-lead.component';

function imagesDouble(lead: Photo | null): Partial<ImagesStore> {
  return {
    photos: signal([]).asReadonly(),
    lead: computed(() => lead),
    positionOf: () => (lead === null ? 0 : 1),
    load: (() => ({ destroy: () => undefined })) as unknown as ImagesStore['load'],
  };
}

async function build(lead: Photo | null): Promise<Element> {
  const result = await render(SpeciesLeadComponent, {
    providers: [
      ...catalogueProviders(),
      provideRouter(ANY_ROUTE),
      { provide: ImagesStore, useValue: imagesDouble(lead) },
    ],
    inputs: { slug: 'steinpilz' },
  });
  await catalogueReady();
  result.detectChanges();
  // The image loads through a resource: its request starts after a turn of the event loop.
  await new Promise((done) => setTimeout(done));
  const http = TestBed.inject(HttpTestingController);
  for (const request of http.match((req) => req.url.startsWith('/api/photos/'))) {
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));
  }
  await new Promise((done) => setTimeout(done));
  result.detectChanges();
  return result.container;
}

describe('SpeciesLeadComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:eins', revokeObjectURL: () => undefined });
  });

  it('zeigt das Titelbild mit seiner Herkunft', async () => {
    const container = await build(photo({ id: 'bild-eins', caption: 'Junges Exemplar' }));

    expect(screen.getByRole('img', { name: 'Junges Exemplar' })).toBeInTheDocument();
    expect(container.querySelector('.credit')?.textContent.replace(/\s+/g, ' ').trim()).toBe(
      'Foto: Marie Weber · CC BY-SA 4.0',
    );
    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      'https://creativecommons.org/licenses/by-sa/4.0/',
    );
    await noViolations(container);
  });

  it('nimmt in Englisch die englische Bildunterschrift', async () => {
    await build(photo({ id: 'bild-eins', caption: 'Junges Exemplar', captionEn: 'Young specimen' }));
    const i18n = TestBed.inject(I18nService);
    // The English catalogue loads as a module, and the module loader needs the real URL.
    vi.unstubAllGlobals();
    i18n.setLocale('en');

    expect(await screen.findByRole('img', { name: 'Young specimen' })).toBeInTheDocument();
    i18n.setLocale('de');
  });

  it('nimmt ohne Bildunterschrift den Namen der Art', async () => {
    await build(photo({ id: 'bild-eins', caption: null }));

    expect(screen.getByRole('img', { name: 'Steinpilz' })).toBeInTheDocument();
  });

  it('führt zur Bildansicht', async () => {
    await build(photo({ id: 'bild-eins' }));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    await userEvent.click(screen.getByRole('button', { name: 'Steinpilz' }));

    expect(navigate).toHaveBeenCalledWith(['/arten', 'steinpilz', 'bilder', 'bild-eins']);
  });

  it('zeigt ohne Titelbild den Platzhalter statt zu verschwinden', async () => {
    const container = await build(null);

    expect(container.querySelector('app-hero')).not.toBeNull();
    expect(container.querySelector('button')).toBeNull();
  });
});
