import type { DataSource, DataSourceVersion, RemoteSource } from '../../../core/api/models';
import { joined } from '../../../core/i18n/numbers';
import type { BadgeKind } from '../../../ui/level-pill/level-pill.component';
import type { Translate } from '../runs.rows';
import { bytesText, momentText, shortSha } from './format';
import {
  KIND_TEXT,
  ORIGIN_TEXT,
  REMOTE_STATE_TEXT,
  REMOTE_STATE_TONE,
  REMOTE_TEXT,
  STATE_TEXT,
  STATE_TONE,
  USE_TEXT,
} from './labels';
import type { Need, RunInput } from './preconditions';

/** A row of an uploaded kind in the overview. */
export interface UploadRow {
  readonly kind: DataSource['kind'];
  readonly title: string;
  readonly subline: string;
  readonly state: string;
  readonly tone: BadgeKind;
  readonly uses: readonly string[];
  /** The sub-line with the uses as text, for the phone: it has no room for the use badges. */
  readonly sublineWithUses: string;
}

/** A row of a remote source in the overview. */
export interface RemoteRow {
  readonly source: RemoteSource['source'];
  readonly title: string;
  readonly subline: string;
  readonly state: string;
  readonly tone: BadgeKind;
}

/** A row of the version history. */
export interface VersionRow {
  readonly id: string;
  readonly title: string;
  readonly subline: string;
  readonly state: string;
  readonly tone: BadgeKind;
  readonly active: boolean;
}

/** The version number, the size and the day of a version. */
function versionFacts(version: DataSourceVersion, text: Translate, locale: string): string {
  return joined([
    text('admin.dataSources.version', { nummer: version.version }),
    version.sizeBytes === null ? null : bytesText(version.sizeBytes, locale),
    momentText(version.activatedAt ?? version.createdAt, locale),
  ]);
}

export function uploadRow(source: DataSource, text: Translate, locale: string): UploadRow {
  const version = source.activeVersion ?? source.latestVersion;
  const covered =
    source.satisfiedBy === null
      ? null
      : text('admin.dataSources.satisfiedBy', { name: text(KIND_TEXT[source.satisfiedBy]) });
  const subline =
    covered ?? (version === null ? text('admin.dataSources.noVersion') : versionFacts(version, text, locale));
  const uses = source.usedBy.map((use) => text(USE_TEXT[use]));
  return {
    kind: source.kind,
    title: text(KIND_TEXT[source.kind]),
    subline,
    state: text(STATE_TEXT[source.state]),
    tone: STATE_TONE[source.state],
    uses,
    sublineWithUses: joined([subline, ...uses]),
  };
}

export function remoteRow(remote: RemoteSource, text: Translate, locale: string): RemoteRow {
  return {
    source: remote.source,
    title: text(REMOTE_TEXT[remote.source]),
    subline: joined([
      text('admin.dataSources.files', { zahl: remote.files }),
      bytesText(remote.sizeBytes, locale),
      remote.lastCheckedAt
        ? text('admin.dataSources.checked', { datum: momentText(remote.lastCheckedAt, locale) })
        : null,
    ]),
    state: text(REMOTE_STATE_TEXT[remote.state]),
    tone: REMOTE_STATE_TONE[remote.state],
  };
}

export function versionRow(version: DataSourceVersion, text: Translate, locale: string): VersionRow {
  return {
    id: version.id,
    title: version.fileName ?? text('admin.dataSources.version', { nummer: version.version }),
    subline: joined([
      versionFacts(version, text, locale),
      shortSha(version.sha256),
      text(ORIGIN_TEXT[version.origin]),
      version.createdBy?.name ? text('admin.dataSources.by', { name: version.createdBy.name }) : null,
    ]),
    state: version.active ? text('admin.dataSources.active') : text(STATE_TEXT[version.state]),
    tone: version.active ? 'ok' : STATE_TONE[version.state],
    active: version.active,
  };
}

/** The name of one input of a run. */
export function inputName(input: RunInput, text: Translate): string {
  return 'remote' in input ? text(REMOTE_TEXT[input.remote]) : text(KIND_TEXT[input.upload]);
}

/** A need as one line: the inputs of an alternative with "and", the alternatives with "or". */
export function needText(need: Need, text: Translate): string {
  return need
    .map((inputs) => inputs.map((input) => inputName(input, text)).join(' + '))
    .reduce((all, next) => text('admin.dataSources.needs.or', { a: all, b: next }));
}
