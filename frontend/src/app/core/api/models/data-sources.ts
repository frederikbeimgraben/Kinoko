/** The types of the data sources and the uploads, from the contract. */

import type { components } from '../contract';

export type DataSourceKind = components['schemas']['DataSourceKind'];
export type DataSourceState = components['schemas']['DataSourceState'];
export type VersionState = components['schemas']['VersionState'];
export type RemoteSourceId = components['schemas']['RemoteSourceId'];
export type DataSourceAccept = components['schemas']['Accept'];
export type DataSource = components['schemas']['DataSource'];
export type DataSourceDetail = components['schemas']['DataSourceDetail'];
export type DataSourceVersion = components['schemas']['DataSourceVersion'];
export type DataSourceArtifact = components['schemas']['DataSourceArtifact'];
export type DataSourceUse = DataSource['usedBy'][number];
export type UploadCreate = components['schemas']['UploadCreate'];
export type UploadSession = components['schemas']['Upload'];
export type RemoteSource = components['schemas']['RemoteSource'];
export type RemoteSourceState = RemoteSource['state'];

/** The optional year range of a refresh of a remote source. */
export interface RefreshRange {
  fromYear?: number;
  toYear?: number;
  force?: boolean;
}

export const DATA_SOURCE_KINDS: readonly DataSourceKind[] = [
  'gbif-archive',
  'tree-species-map',
  'dem',
  'soilgrids',
  'germany-outline',
  'trees-grid',
  'tree-scales',
  'site-grid',
  'weather-checkpoints',
  'model-bundle',
  'static-layers',
];

export const REMOTE_SOURCE_IDS: readonly RemoteSourceId[] = [
  'dwd-hyras',
  'dwd-soil-moisture',
  'gbif-occurrences',
];
