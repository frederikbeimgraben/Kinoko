import type {
  DataSource,
  DataSourceKind,
  RemoteSource,
  RemoteSourceId,
  RunKind,
} from '../../../core/api/models';

/** One input of a run: an uploaded data source or a remote source. */
export type RunInput = { readonly upload: DataSourceKind } | { readonly remote: RemoteSourceId };

/** A need of a run. Each alternative is a list of inputs that must all be ready. */
export type Need = readonly (readonly RunInput[])[];

/** The unmet needs of one run kind. */
export interface Blocked {
  readonly run: RunKind;
  readonly missing: readonly Need[];
}

const upload = (kind: DataSourceKind): RunInput => ({ upload: kind });
const remote = (source: RemoteSourceId): RunInput => ({ remote: source });
const one = (input: RunInput): Need => [[input]];

/** The weather comes from the two DWD sources, or from the weekly checkpoints. */
const WEATHER: Need = [[remote('dwd-hyras'), remote('dwd-soil-moisture')], [upload('weather-checkpoints')]];

/** The occurrences come from the GBIF API, or from a GBIF archive. */
const OCCURRENCES: Need = [[remote('gbif-occurrences')], [upload('gbif-archive')]];

const TRAINING: readonly Need[] = [one(upload('tree-scales')), WEATHER, OCCURRENCES];

const RENDER: readonly Need[] = [
  one(upload('trees-grid')),
  one(upload('tree-scales')),
  one(upload('site-grid')),
  one(upload('model-bundle')),
  WEATHER,
];

/** The needs of both lists, each need once. */
function union(...lists: readonly (readonly Need[])[]): readonly Need[] {
  const all = lists.flat();
  return all.filter(
    (need, at) => all.findIndex((other) => JSON.stringify(other) === JSON.stringify(need)) === at,
  );
}

/** The needs of each run kind, per the run preconditions of the pipeline plan. A fetch has none. */
export const RUN_NEEDS: Readonly<Record<RunKind, readonly Need[]>> = {
  training: TRAINING,
  render: RENDER,
  full: union(TRAINING, RENDER),
  fetch: [],
};

/** A remote source is complete when its bootstrap is done. A stale cache still has every year. */
function remoteReady(source: RemoteSource | undefined): boolean {
  return source?.state === 'ok' || source?.state === 'stale';
}

/** True when the input is ready in the given lists. */
export function inputReady(
  input: RunInput,
  sources: readonly DataSource[],
  remotes: readonly RemoteSource[],
): boolean {
  if ('remote' in input) return remoteReady(remotes.find((one) => one.source === input.remote));
  return sources.find((one) => one.kind === input.upload)?.state === 'ready';
}

/** The needs of a run that no alternative meets. */
export function missingNeeds(
  run: RunKind,
  sources: readonly DataSource[],
  remotes: readonly RemoteSource[],
): readonly Need[] {
  return RUN_NEEDS[run].filter(
    (need) => !need.some((inputs) => inputs.every((input) => inputReady(input, sources, remotes))),
  );
}

/** The run kinds with unmet needs, in the order of `runs`. */
export function blockedRuns(
  runs: readonly RunKind[],
  sources: readonly DataSource[],
  remotes: readonly RemoteSource[],
): readonly Blocked[] {
  return runs
    .map((run) => ({ run, missing: missingNeeds(run, sources, remotes) }))
    .filter((entry) => entry.missing.length > 0);
}
