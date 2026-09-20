import { computed, signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { HttpTestingController } from '@angular/common/http/testing';
import { noViolations } from '../../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../../testing/catalogue-double';
import { photo } from '../../../testing/photos-fixture';
import { ANY_ROUTE } from '../../../testing/routes';
import type { Photo } from '../../../core/api/models';
import { ImagesState } from '../../images/images.state';
import { SpeciesLeadComponent } from './species-lead.component';

function imagesDouble(lead: Photo | null): Partial<ImagesState> {
  return { photos: signal([]).asReadonly(), lead: computed(() => lead), load: () => undefined };
}

async function build(lead: Photo | null): Promise<Element> {
  const result = await render(SpeciesLeadComponent, {
    providers: [
      ...catalogueProviders(),
      provideRouter(ANY_ROUTE),
      { provide: ImagesState, useValue: imagesDouble(lead) },
    ],
    inputs: { slug: 'steinpilz' },
  });
  await catalogueReady();
  result.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  for (const request of http.match((req) => req.url.startsWith('/api/photos/'))) {
    request.flush(new Blob(['x'], { type: 'image/jpeg' }));
  }
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
    expect(screen.getByText('Foto: Marie Weber · CC BY-SA 4.0')).toBeInTheDocument();
    await noViolations(container);
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
