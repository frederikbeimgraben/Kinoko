import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import type { OpenFind } from '../../core/api/models';
import {
  FindPhotosApiDouble,
  FindsApiDouble,
  findPhotosApiProvider,
  findsApiProvider,
} from '../../testing/open-finds-fixture';
import { withoutAccepted } from './find-queue.bulk';
import { FindQueueStore, redone, restored } from './find-queue.store';

function build(): { store: FindQueueStore; api: FindsApiDouble; photos: FindPhotosApiDouble } {
  const api = new FindsApiDouble();
  const photos = new FindPhotosApiDouble();
  TestBed.configureTestingModule({
    providers: [findsApiProvider(api), findPhotosApiProvider(photos)],
  });
  return { store: TestBed.inject(FindQueueStore), api, photos };
}

describe('FindQueueStore', () => {
  it('gets the open finds', () => {
    const { store } = build();

    expect(store.loaded()).toBe(false);
    store.load();

    expect(store.open().map((one) => one.id)).toEqual(['fund-eins', 'fund-zwei']);
    expect(store.loaded()).toBe(true);
  });

  it('gets the photos of a find only once', () => {
    const { store, photos } = build();

    store.loadPhotos('fund-eins');
    store.loadPhotos('fund-eins');

    expect(photos.asked).toEqual(['fund-eins']);
    expect(store.photos()['fund-eins'].map((one) => one.id)).toEqual(['bild-fund']);
  });

  it('gets the photos of the next cards without a call', () => {
    const { store, photos } = build();

    store.load();
    TestBed.tick();

    expect(photos.asked).toEqual(['fund-eins', 'fund-zwei']);
  });

  it('counts a decision and keeps the stack', () => {
    const { store, api } = build();
    store.load();

    store.review({ id: 'fund-eins', decision: 'rejected' });

    expect(api.reviewed).toEqual([{ id: 'fund-eins', decision: 'rejected' }]);
    expect(store.open().map((one) => one.id)).toEqual(['fund-zwei']);
    expect(store.stack()?.length).toBe(2);

    store.undo();

    expect(store.decided()).toBe(0);
    expect(api.reopened).toEqual(['fund-eins']);
  });

  it('sends no undo without a decision', () => {
    const { store, api } = build();
    store.load();

    store.undo();

    expect(api.reopened).toEqual([]);
  });

  it('takes the card away again when the undo fails', () => {
    const { store, api } = build();
    store.load();
    store.review({ id: 'fund-eins', decision: 'accepted' });
    vi.spyOn(api, 'reopen').mockReturnValueOnce(throwError(() => new Error('offline')));

    store.undo();

    expect(store.open().map((one) => one.id)).toEqual(['fund-zwei']);
  });

  it('keeps the count when the undone card is no longer next', () => {
    const finds = ['a', 'b'].map((id) => ({ id }) as OpenFind);

    expect(redone(finds, 0, 'a')?.decided).toBe(1);
    expect(redone(finds, 1, 'a')).toBeNull();
  });

  it('puts the find back as the next open card when the decision fails', () => {
    const { store, api } = build();
    store.load();
    vi.spyOn(api, 'review').mockReturnValueOnce(throwError(() => new Error('offline')));

    store.review({ id: 'fund-eins', decision: 'accepted' });

    expect(store.decided()).toBe(0);
    expect(store.open().map((one) => one.id)).toEqual(['fund-eins', 'fund-zwei']);
  });

  it('keeps the other decisions when an earlier decision fails', () => {
    const finds = ['a', 'b', 'c', 'd'].map((id) => ({ id }) as OpenFind);

    expect(restored(finds, 3, 'a')?.stack?.map((one) => one.id)).toEqual(['b', 'c', 'a', 'd']);
    expect(restored(finds, 3, 'a')?.decided).toBe(2);
    expect(restored(finds, 1, 'c')).toBeNull();
  });

  it('accepts each open find and gives the result', () => {
    const { store, api } = build();
    const onDone = vi.fn();
    store.load();

    store.acceptAll({ onDone });

    expect(api.reviewed.map((one) => one.decision)).toEqual(['accepted', 'accepted']);
    expect(store.open()).toEqual([]);
    expect(store.accepting()).toBe(false);
    expect(onDone).toHaveBeenCalledExactlyOnceWith({ accepted: 2, failed: 0 });
  });

  it('keeps a find open when its acceptance fails', () => {
    const { store, api } = build();
    const onDone = vi.fn();
    api.failing.add('fund-eins');
    store.load();

    store.acceptAll({ onDone });

    expect(store.open().map((one) => one.id)).toEqual(['fund-eins']);
    expect(onDone).toHaveBeenCalledExactlyOnceWith({ accepted: 1, failed: 1 });
  });

  it('sends no decision again for a card with a decision', () => {
    const { store, api } = build();
    store.load();
    store.review({ id: 'fund-eins', decision: 'rejected' });

    store.acceptAll({});

    expect(api.reviewed).toEqual([
      { id: 'fund-eins', decision: 'rejected' },
      { id: 'fund-zwei', decision: 'accepted' },
    ]);
    expect(store.decided()).toBe(1);
    expect(store.stack()?.map((one) => one.id)).toEqual(['fund-eins']);
  });

  it('keeps the cards with a decision in the stack', () => {
    const finds = ['a', 'b', 'c'].map((id) => ({ id }) as OpenFind);

    expect(withoutAccepted(finds, 1, new Set(['a', 'b']))?.map((one) => one.id)).toEqual(['a', 'c']);
    expect(withoutAccepted(null, 0, new Set(['a']))).toBeNull();
  });
});
