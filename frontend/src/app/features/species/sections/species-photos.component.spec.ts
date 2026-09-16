import { computed, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import type { Photo } from '../../../core/api/models';
import { ImagesState } from '../../images/images.state';
import { AuthStub, authStubProviders } from '../../../testing/auth-stub';
import { catalogueProviders } from '../../../testing/catalogue-double';
import { photo } from '../../../testing/photos-fixture';
import { ANY_ROUTE } from '../../../testing/routes';
import { SpeciesPhotosComponent } from './species-photos.component';

const PHOTOS: readonly Photo[] = [photo({ id: 'eins', lead: false }), photo({ id: 'zwei', lead: true })];

function imagesDouble(items: readonly Photo[]): Partial<ImagesState> {
  const photos = signal(items);
  return {
    photos: photos.asReadonly(),
    lead: computed(() => photos().find((one) => one.lead) ?? photos().at(0) ?? null),
  };
}

async function build(items: readonly Photo[] = PHOTOS): Promise<Element> {
  const stub = new AuthStub();
  stub.user.set(null);
  const { container } = await render(SpeciesPhotosComponent, {
    providers: [
      ...catalogueProviders(),
      ...authStubProviders(stub),
      provideRouter(ANY_ROUTE),
      { provide: ImagesState, useValue: imagesDouble(items) },
    ],
    inputs: { slug: 'boletus-edulis' },
  });
  return container;
}

describe('SpeciesPhotosComponent', () => {
  it('trägt die Marke auf der Kachel des Titelbildes', async () => {
    const container = await build();

    const tiles = [...container.querySelectorAll('.photos__tile')];
    expect(tiles[0].querySelector('.photos__badge')).toBeNull();
    expect(tiles[1].querySelector('.photos__badge')).not.toBeNull();
  });

  it('nimmt ohne eigenes Titelbild die erste Kachel', async () => {
    const container = await build([photo({ id: 'eins', lead: false })]);

    expect(container.querySelector('.photos__tile .photos__badge')).not.toBeNull();
  });
});
