import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError, type Observable } from 'rxjs';
import { PhotosApi, type PhotoPage, type PhotoQuery } from '../../core/api/photos.api';
import { AuthStub, authStubProviders } from '../../testing/auth-stub';
import { photo } from '../../testing/photos-fixture';
import { MyImagesStore } from './my-images.store';

/** A double that gives the queued answers in order. */
class PhotosApiDouble {
  readonly queries: PhotoQuery[] = [];
  answers: (() => Observable<PhotoPage>)[] = [];

  list(query: PhotoQuery): Observable<PhotoPage> {
    this.queries.push(query);
    return this.answers.shift()?.() ?? NEVER;
  }
}

function build(
  api = new PhotosApiDouble(),
  auth = new AuthStub(),
): { store: MyImagesStore; api: PhotosApiDouble; auth: AuthStub } {
  TestBed.configureTestingModule({
    providers: [{ provide: PhotosApi, useValue: api }, ...authStubProviders(auth)],
  });
  return { store: TestBed.inject(MyImagesStore), api, auth };
}

describe('MyImagesStore', () => {
  it('loads the pages one after the other and collects the finds with a photo', () => {
    const api = new PhotosApiDouble();
    api.answers = [
      () => of({ items: [photo({ id: 'a', findId: 'find-1' }), photo({ id: 'b' })], nextCursor: 'c2' }),
      () => of({ items: [photo({ id: 'c', findId: 'find-2' })], nextCursor: null }),
    ];
    const { store } = build(api);
    expect(store.loaded()).toBe(false);

    store.load();
    expect(store.more()).toBe(true);
    store.next();

    expect(api.queries).toEqual([
      { mine: true, cursor: undefined },
      { mine: true, cursor: 'c2' },
    ]);
    expect(store.photos()?.map((one) => one.id)).toEqual(['a', 'b', 'c']);
    expect([...store.findIds()]).toEqual(['find-1', 'find-2']);
    expect(store.more()).toBe(false);
  });

  it('takes the lead photo of a find as its thumb, else the first photo of the list', () => {
    const api = new PhotosApiDouble();
    api.answers = [
      () =>
        of({
          items: [
            photo({ id: 'a', findId: 'find-1', lead: false }),
            photo({ id: 'b', findId: 'find-1', lead: false }),
            photo({ id: 'c', findId: 'find-2', lead: false }),
            photo({ id: 'd', findId: 'find-2', lead: true }),
            photo({ id: 'e', findId: null }),
          ],
          nextCursor: null,
        }),
    ];
    const { store } = build(api);

    store.load();

    expect(Object.fromEntries(store.findThumbs())).toEqual({
      'find-1': '/photos/a/list',
      'find-2': '/photos/d/list',
    });
  });

  it('asks for no page after the last one', () => {
    const { store, api } = build();
    api.answers = [() => of({ items: [], nextCursor: null })];

    store.load();
    store.next();

    expect(api.queries).toHaveLength(1);
  });

  it('shows an empty list after a failed first page and keeps the photos after a failed next page', () => {
    const { store, api } = build();
    api.answers = [() => throwError(() => new Error('offline'))];
    store.load();
    expect(store.photos()).toEqual([]);
    expect(store.busy()).toBe(false);

    api.answers = [
      () => of({ items: [photo({ id: 'a' })], nextCursor: 'c2' }),
      () => throwError(() => new Error('offline')),
    ];
    store.load();
    store.next();

    expect(store.photos()?.map((one) => one.id)).toEqual(['a']);
    expect(store.more()).toBe(true);
  });

  it('ignores a next page while a page loads, and a fresh load replaces the pending one', () => {
    const { store, api } = build();
    api.answers = [
      () => of({ items: [photo({ id: 'a' })], nextCursor: 'c2' }),
      () => NEVER,
      () => of({ items: [photo({ id: 'b' })], nextCursor: null }),
    ];

    store.load();
    store.next();
    store.next();
    expect(api.queries).toHaveLength(2);
    expect(store.busy()).toBe(true);

    store.load();

    expect(api.queries).toHaveLength(3);
    expect(store.busy()).toBe(false);
    expect(store.photos()?.map((one) => one.id)).toEqual(['b']);
  });

  it('loads the photos again when the sign-in arrives after the first request', () => {
    const auth = new AuthStub();
    auth.user.set(null);
    const { store, api } = build(new PhotosApiDouble(), auth);
    api.answers = [() => NEVER, () => of({ items: [photo({ id: 'a' })], nextCursor: null })];
    TestBed.tick();
    store.load();

    auth.user.set({ sub: 'sub-eins', name: 'Frederik', email: 'frederik@beimgraben.net' });
    TestBed.tick();

    expect(api.queries).toHaveLength(2);
    expect(store.photos()?.map((one) => one.id)).toEqual(['a']);
  });

  it('asks for nothing on an account change when no page asked for the photos', () => {
    const { api, auth } = build();
    TestBed.tick();

    auth.user.set({ sub: 'sub-zwei', name: 'Anna', email: 'anna@example.invalid' });
    TestBed.tick();

    expect(api.queries).toHaveLength(0);
  });

  it('forgets the photos of the last person after a sign-out', () => {
    const { store, api, auth } = build();
    api.answers = [() => of({ items: [photo({ id: 'a', findId: 'find-1' })], nextCursor: 'c2' })];
    TestBed.tick();
    store.load();
    expect(store.loaded()).toBe(true);

    auth.user.set(null);
    TestBed.tick();

    expect(store.photos()).toBeNull();
    expect(store.more()).toBe(false);
    expect(store.findIds().size).toBe(0);
  });
});
