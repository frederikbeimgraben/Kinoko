# Shared store features

This folder holds the `@ngrx/signals` store features that all stores share.
Import them from `core/state` (the folder has an `index.ts`).

Installed versions: `@ngrx/signals` 22.0.1 and `@ngrx/operators` 22.0.1.

## `withResource`

The installed `@ngrx/signals` does not export `withResource`.
For a plain read, put an `httpResource` or a `resource` into the store with `withProps`.
The entry point `@ngrx/signals/resource` exists. It exports only `extendResource`
and its extensions (for example `withPreviousValueOnLoading`). These are experimental.

## Features

### `withLoadState()`

- State: `status: 'idle' | 'loading' | 'loaded' | 'error'`.
- Computed: `loading`, `loaded`, `failed`.
- Updaters for `patchState`: `setLoading()`, `setLoaded()`, `setFailed()`.

```ts
patchState(store, setLoading());
```

### `withStorageSync<State, Saved>(config)`

Reads the saved state when the store starts. Writes each change of the selected part back.

- `key`: the storage key.
- `select(state) => Saved | null`: the part to save. `null` removes the key.
- `restore(stored: unknown) => Partial<State> | null`: checks the stored value. Return `null` for a bad shape.
- `debounceMs` (default `0`): the time between the last change and the write. A destroyed store writes a waiting value at once.
- `storage` (default `() => localStorage`).

A blocked or full storage is not an error. The state then stays for this session only.
Put the feature after the `withState` that it saves.

### `plainTextStorage(base?)`

A `storage` for `withStorageSync` that keeps a string value as bare text, not as JSON.
Use it for a key that older builds wrote as bare text (`pilzkarte.theme`, `pilzkarte.kartenApp`).

### `withSearchableList<T extends { id: string }>({ matches, sortKey })`

- State: `items: readonly T[] | null` (`null` while pending), `search: string`.
- Computed: `found` (the items that match the trimmed, lower-case search).
- Methods: `setSearch(text)`, `one(id)`, `setItems(items | null)`, `put(item)`, `drop(id)`.
- The list stays sorted by `sortKey`.

### `withPagedList<E>(source, pageSize = DEFAULT_PAGE_SIZE)`

- `source: () => PageSource<E>` runs in the injection context, so it can call `inject`.
  `PageSource<E>` is `(offset, limit) => Observable<Page<E>>`.
- State: `total`, `busy`, and the private `_held`.
- Computed: `entries` (never `null`), `loaded`, `more`.
- Methods: `restart(source?)`, `next()`, `withoutEntry(matches)`.
- `restart` cancels a pending page. `next` has no effect while a page is pending.
- A failed page keeps the rows in memory. The `ApiClient` toast tells the user.

## Conventions

- Write a store as `signalStore({ providedIn: 'root' }, withState(...), withComputed(...), withMethods(...), withHooks(...))`.
- Give a store file the name `*.store.ts` and a store class the name `XStore`.
- Change state only with `patchState`. Make new arrays, maps and sets. Do not change old values: in dev mode the state is frozen.
- For a request, use `rxMethod` (`@ngrx/signals/rxjs-interop`) with `switchMap` or `exhaustMap`, and `tapResponse` (`@ngrx/operators`).
- Keep the old public names (`loading`, `failed`, `items` and so on), so that the templates change little.
- Start a member name with `_` to make it private to the store.
- In a test, use `unprotected(store)` from `@ngrx/signals/testing` to call `patchState` from outside.
- A component reads store signals and calls store methods. It does not call `.subscribe`. It does not write state in an `effect`.

## Motion and tokens

- The kit tokens are in `src/styles/tokens.scss` (see the comment at the top).
- The enter and leave classes are in `src/styles/_motion.scss`:
  `motion-sheet-in/out`, `motion-fade-in/out`, `motion-pop-in/out`, `motion-list-in`, `motion-shimmer`.
  Use them with `animate.enter` and `animate.leave`.
