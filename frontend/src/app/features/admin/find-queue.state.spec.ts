import { TestBed } from '@angular/core/testing';
import {
  FindPhotosApiDouble,
  FindsApiDouble,
  findPhotosApiProvider,
  findsApiProvider,
} from '../../testing/open-finds-fixture';
import { FindQueueState } from './find-queue.state';

function build(): { state: FindQueueState; api: FindsApiDouble; photos: FindPhotosApiDouble } {
  const api = new FindsApiDouble();
  const photos = new FindPhotosApiDouble();
  TestBed.configureTestingModule({
    providers: [findsApiProvider(api), findPhotosApiProvider(photos)],
  });
  return { state: TestBed.inject(FindQueueState), api, photos };
}

describe('FindQueueState', () => {
  it('holt die offenen Funde', () => {
    const { state } = build();

    state.load();

    expect(state.open().map((one) => one.id)).toEqual(['fund-eins', 'fund-zwei']);
  });

  it('holt die Fotos eines Fundes nur einmal', () => {
    const { state, photos } = build();

    state.loadPhotos('fund-eins');
    state.loadPhotos('fund-eins');

    expect(photos.asked).toEqual(['fund-eins']);
    expect(state.photos()['fund-eins']?.map((one) => one.id)).toEqual(['bild-fund']);
  });

  it('nimmt einen entschiedenen Fund aus der Liste', () => {
    const { state, api } = build();
    state.load();

    state.review('fund-eins', 'rejected');

    expect(api.reviewed).toEqual([{ id: 'fund-eins', decision: 'rejected' }]);
    expect(state.open().map((one) => one.id)).toEqual(['fund-zwei']);
  });

  it('leert die Liste, wenn alle angenommen sind', () => {
    const { state, api } = build();
    state.load();

    state.acceptAll().subscribe();

    expect(api.accepted).toBe(1);
    expect(state.open()).toEqual([]);
  });
});
