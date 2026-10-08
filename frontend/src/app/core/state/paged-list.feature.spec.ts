import { TestBed } from '@angular/core/testing';
import { signalStore } from '@ngrx/signals';
import { Subject, of, throwError, type Observable } from 'rxjs';
import type { Page } from '../api/models';
import { DEFAULT_PAGE_SIZE, withPagedList, type PageSource } from './paged-list.feature';

function page(entries: string[], total: number, offset: number): Page<string> {
  return { eintraege: entries, gesamt: total, limit: DEFAULT_PAGE_SIZE, offset };
}

function start(source: PageSource<string>) {
  const Store = signalStore(
    { providedIn: 'root' },
    withPagedList(() => source),
  );
  return TestBed.inject(Store);
}

describe('withPagedList', () => {
  it('gets the first page and tells that more rows exist', () => {
    const store = start((offset) => of(page(['a', 'b'], 5, offset)));

    expect(store.loaded()).toBe(false);
    store.restart();

    expect(store.entries()).toEqual(['a', 'b']);
    expect(store.total()).toBe(5);
    expect(store.more()).toBe(true);
    expect(store.busy()).toBe(false);
  });

  it('adds the next page after the rows in memory', () => {
    const calls: number[] = [];
    const store = start((offset, limit) => {
      calls.push(offset, limit);
      return of(page(offset === 0 ? ['a', 'b'] : ['c'], 3, offset));
    });

    store.restart();
    store.next();

    expect(calls).toEqual([0, DEFAULT_PAGE_SIZE, 2, DEFAULT_PAGE_SIZE]);
    expect(store.entries()).toEqual(['a', 'b', 'c']);
    expect(store.more()).toBe(false);
  });

  it('ignores next while a page is pending', () => {
    const answer = new Subject<Page<string>>();
    const calls: number[] = [];
    const store = start((offset) => {
      calls.push(offset);
      return answer;
    });

    store.next();
    store.next();
    expect(store.busy()).toBe(true);
    answer.next(page(['a'], 1, 0));

    expect(calls).toEqual([0]);
    expect(store.entries()).toEqual(['a']);
  });

  it('cancels a pending page on restart and can change the source', () => {
    const slow = new Subject<Page<string>>();
    const store = start(() => slow);

    store.next();
    store.restart((offset) => of(page(['x'], 1, offset)));
    slow.next(page(['old'], 9, 0));

    expect(store.entries()).toEqual(['x']);
    expect(store.total()).toBe(1);
  });

  it('keeps the rows in memory when a page fails', () => {
    const store = start((offset): Observable<Page<string>> =>
      offset === 0 ? of(page(['a'], 3, offset)) : throwError(() => new Error('offline')),
    );

    store.restart();
    store.next();

    expect(store.entries()).toEqual(['a']);
    expect(store.busy()).toBe(false);
    expect(store.loaded()).toBe(true);
  });

  it('removes rows and lowers the total without a new request', () => {
    let calls = 0;
    const store = start((offset) => {
      calls += 1;
      return of(page(['a', 'b', 'c'], 7, offset));
    });

    store.withoutEntry((entry) => entry === 'a');
    expect(store.loaded()).toBe(false);

    store.restart();
    store.withoutEntry((entry) => entry !== 'b');

    expect(store.entries()).toEqual(['b']);
    expect(store.total()).toBe(5);
    expect(calls).toBe(1);
  });
});
