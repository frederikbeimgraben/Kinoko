import type {
  DataSourceKind,
  DataSourceState,
  DataSourceUse,
  DataSourceVersion,
  RemoteSourceId,
  RemoteSourceState,
  VersionState,
} from '../../../core/api/models';
import type { TranslationKey } from '../../../core/i18n/translations';
import type { BadgeKind } from '../../../ui/level-pill/level-pill.component';

export const KIND_TEXT: Readonly<Record<DataSourceKind, TranslationKey>> = {
  'gbif-archive': 'admin.dataSources.kind.gbif-archive',
  'tree-species-map': 'admin.dataSources.kind.tree-species-map',
  dem: 'admin.dataSources.kind.dem',
  soilgrids: 'admin.dataSources.kind.soilgrids',
  'germany-outline': 'admin.dataSources.kind.germany-outline',
  'trees-grid': 'admin.dataSources.kind.trees-grid',
  'tree-scales': 'admin.dataSources.kind.tree-scales',
  'site-grid': 'admin.dataSources.kind.site-grid',
  'weather-checkpoints': 'admin.dataSources.kind.weather-checkpoints',
  'model-bundle': 'admin.dataSources.kind.model-bundle',
  'static-layers': 'admin.dataSources.kind.static-layers',
};

/** The description of each kind: what it is and what it must contain. */
export const KIND_DESCRIPTION: Readonly<Record<DataSourceKind, TranslationKey>> = {
  'gbif-archive': 'admin.dataSources.about.gbif-archive',
  'tree-species-map': 'admin.dataSources.about.tree-species-map',
  dem: 'admin.dataSources.about.dem',
  soilgrids: 'admin.dataSources.about.soilgrids',
  'germany-outline': 'admin.dataSources.about.germany-outline',
  'trees-grid': 'admin.dataSources.about.trees-grid',
  'tree-scales': 'admin.dataSources.about.tree-scales',
  'site-grid': 'admin.dataSources.about.site-grid',
  'weather-checkpoints': 'admin.dataSources.about.weather-checkpoints',
  'model-bundle': 'admin.dataSources.about.model-bundle',
  'static-layers': 'admin.dataSources.about.static-layers',
};

export const REMOTE_TEXT: Readonly<Record<RemoteSourceId, TranslationKey>> = {
  'dwd-hyras': 'admin.dataSources.remote.dwd-hyras',
  'dwd-soil-moisture': 'admin.dataSources.remote.dwd-soil-moisture',
  'gbif-occurrences': 'admin.dataSources.remote.gbif-occurrences',
};

export const STATE_TEXT: Readonly<Record<DataSourceState | VersionState, TranslationKey>> = {
  missing: 'admin.dataSources.state.missing',
  validating: 'admin.dataSources.state.validating',
  processing: 'admin.dataSources.state.processing',
  ready: 'admin.dataSources.state.ready',
  failed: 'admin.dataSources.state.failed',
  superseded: 'admin.dataSources.state.superseded',
};

export const STATE_TONE: Readonly<Record<DataSourceState | VersionState, BadgeKind>> = {
  missing: 'warn',
  validating: '',
  processing: '',
  ready: 'ok',
  failed: 'bad',
  superseded: '',
};

export const REMOTE_STATE_TEXT: Readonly<Record<RemoteSourceState, TranslationKey>> = {
  empty: 'admin.dataSources.remoteState.empty',
  bootstrapping: 'admin.dataSources.remoteState.bootstrapping',
  ok: 'admin.dataSources.remoteState.ok',
  stale: 'admin.dataSources.remoteState.stale',
  failed: 'admin.dataSources.remoteState.failed',
};

export const REMOTE_STATE_TONE: Readonly<Record<RemoteSourceState, BadgeKind>> = {
  empty: 'warn',
  bootstrapping: '',
  ok: 'ok',
  stale: 'warn',
  failed: 'bad',
};

export const USE_TEXT: Readonly<Record<DataSourceUse, TranslationKey>> = {
  training: 'admin.dataSources.use.training',
  render: 'admin.dataSources.use.render',
  layers: 'admin.dataSources.use.layers',
  occurrences: 'admin.dataSources.use.occurrences',
};

export const ORIGIN_TEXT: Readonly<Record<DataSourceVersion['origin'], TranslationKey>> = {
  upload: 'admin.dataSources.origin.upload',
  derived: 'admin.dataSources.origin.derived',
  training: 'admin.dataSources.origin.training',
};

/** The metadata fields with a name in the catalogue. Other fields show their key. */
export const META_TEXT: Readonly<Record<string, TranslationKey>> = {
  crs: 'admin.dataSources.meta.crs',
  bbox: 'admin.dataSources.meta.bbox',
  pixelM: 'admin.dataSources.meta.pixelM',
  rows: 'admin.dataSources.meta.rows',
  years: 'admin.dataSources.meta.years',
  records: 'admin.dataSources.meta.records',
  recordsDE: 'admin.dataSources.meta.recordsDE',
  cutoff: 'admin.dataSources.meta.cutoff',
  doi: 'admin.dataSources.meta.doi',
  classesSeen: 'admin.dataSources.meta.classesSeen',
  brier: 'admin.dataSources.meta.brier',
};

/** The upload error codes with a text in the catalogue. */
export const UPLOAD_ERROR_TEXT: Readonly<Record<string, TranslationKey>> = {
  upload_open: 'admin.upload.error.upload_open',
  too_large: 'admin.upload.error.too_large',
  disk_full: 'admin.upload.error.disk_full',
  checksum_mismatch: 'admin.upload.error.checksum_mismatch',
  network: 'admin.upload.error.network',
};
