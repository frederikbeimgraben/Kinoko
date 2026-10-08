import { defaultIfEmpty, firstValueFrom, map, type Observable } from 'rxjs';

/** Sends one write and gives its answer. A failure gives `null`: the `ApiClient` toast tells the user. */
export function settle<T>(request: Observable<T>): Promise<T | null> {
  return firstValueFrom(request).catch(() => null);
}

/** A delete answers without a body. This makes a success `true`, so that `settle` can tell it from a failure. */
export function confirmed(request: Observable<unknown>): Observable<true> {
  return request.pipe(
    map((): true => true),
    defaultIfEmpty<true, true>(true),
  );
}
