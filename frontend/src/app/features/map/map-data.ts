/** The load state of one manifest. */
export type ManifestState = 'data' | 'missing' | 'failed' | 'pending';

/** What the map can show from the states of its manifests. */
export interface MapData {
  /** No manifest is there yet, and at least one load runs: the map shows its skeleton. */
  loading: boolean;
  /** No manifest arrived, and the origin did not reply for at least one: the map offers a new try. */
  failed: boolean;
  /** The origin has no manifest: no forecast map exists yet. */
  empty: boolean;
}

export function manifestState(present: boolean, missing: boolean, failed: boolean): ManifestState {
  if (present) return 'data';
  if (missing) return 'missing';
  return failed ? 'failed' : 'pending';
}

export function mapData(states: readonly ManifestState[]): MapData {
  const some = (state: ManifestState): boolean => states.includes(state);
  return {
    loading: some('pending') && !some('data'),
    failed: some('failed') && !some('data') && !some('pending'),
    empty: states.every((state) => state === 'missing'),
  };
}
