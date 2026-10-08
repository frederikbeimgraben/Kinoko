import type { DataSourceDetail, DataSourceVersion } from '../../../core/api/models';
import { joined } from '../../../core/i18n/numbers';
import type { Translate } from '../runs.rows';
import { bytesText, metaValue, momentText } from './format';
import { KIND_TEXT, META_TEXT, ORIGIN_TEXT, STATE_TEXT, USE_TEXT } from './labels';

/** A label and a value. */
export interface Fact {
  readonly key: string;
  readonly title: string;
  readonly value: string;
}

/** The active version of one species of a model bundle. */
export interface SpeciesRow {
  readonly speciesId: string;
  readonly title: string;
  readonly subline: string;
}

const present = (facts: readonly Fact[]): Fact[] => facts.filter((fact) => fact.value !== '');

/** The accepted format and the role of a data source. */
export function formatFacts(detail: DataSourceDetail, text: Translate, locale: string): Fact[] {
  return present([
    {
      key: 'types',
      title: text('admin.dataSources.accept.extensions'),
      value: detail.accept.extensions.join(', '),
    },
    {
      key: 'max',
      title: text('admin.dataSources.accept.maxBytes'),
      value: bytesText(detail.accept.maxBytes, locale),
    },
    {
      key: 'required',
      title: text('admin.dataSources.required'),
      value: text(detail.required ? 'admin.dataSources.requiredYes' : 'admin.dataSources.requiredNo'),
    },
    {
      key: 'uses',
      title: text('admin.dataSources.usedBy'),
      value: joined(detail.usedBy.map((use) => text(USE_TEXT[use]))),
    },
    {
      key: 'covered',
      title: text('admin.dataSources.satisfiedByTitle'),
      value: detail.satisfiedBy === null ? '' : text(KIND_TEXT[detail.satisfiedBy]),
    },
  ]);
}

/** The metadata of a version. A field with a name in the catalogue shows that name. */
export function metaFacts(version: DataSourceVersion, text: Translate, locale: string): Fact[] {
  return present(
    Object.entries(version.metadata).map(([key, value]) => ({
      key,
      title: key in META_TEXT ? text(META_TEXT[key]) : key,
      value: metaValue(value, locale),
    })),
  );
}

/** Each fact of one version for its sheet. */
export function versionFacts(
  version: DataSourceVersion,
  all: readonly DataSourceVersion[],
  text: Translate,
  locale: string,
): Fact[] {
  const source = all.find((one) => one.id === version.derivedFromId);
  return present([
    { key: 'state', title: text('admin.dataSources.stateTitle'), value: text(STATE_TEXT[version.state]) },
    { key: 'origin', title: text('admin.dataSources.originTitle'), value: text(ORIGIN_TEXT[version.origin]) },
    {
      key: 'derived',
      title: text('admin.dataSources.derivedFromTitle'),
      value: source === undefined ? '' : text('admin.dataSources.version', { nummer: source.version }),
    },
    { key: 'file', title: text('admin.dataSources.file'), value: version.fileName ?? '' },
    {
      key: 'size',
      title: text('admin.dataSources.size'),
      value: version.sizeBytes === null ? '' : bytesText(version.sizeBytes, locale),
    },
    { key: 'sha', title: 'SHA-256', value: version.sha256 ?? '' },
    { key: 'by', title: text('admin.dataSources.createdBy'), value: version.createdBy?.name ?? '' },
    {
      key: 'created',
      title: text('admin.dataSources.createdAt'),
      value: momentText(version.createdAt, locale),
    },
    {
      key: 'processed',
      title: text('admin.dataSources.processedAt'),
      value: momentText(version.processedAt, locale),
    },
    {
      key: 'activated',
      title: text('admin.dataSources.activatedAt'),
      value: momentText(version.activatedAt, locale),
    },
    {
      key: 'error',
      title: text('admin.dataSources.error'),
      value: joined([version.error?.code, version.error?.detail]),
    },
  ]);
}

/** The active version of each species of a model bundle, with the Brier score of a training version. */
export function speciesRows(
  versions: readonly DataSourceVersion[],
  nameOf: (speciesId: string) => string,
  text: Translate,
  locale: string,
): SpeciesRow[] {
  return versions
    .filter((one) => one.active && one.speciesId !== null)
    .map((one) => {
      const brier = one.metadata['brier'];
      return {
        speciesId: one.speciesId ?? '',
        title: nameOf(one.speciesId ?? ''),
        subline: joined([
          text('admin.dataSources.version', { nummer: one.version }),
          text(ORIGIN_TEXT[one.origin]),
          one.origin === 'training' && typeof brier === 'number'
            ? text('admin.run.brier', { wert: metaValue(brier, locale) })
            : null,
          momentText(one.activatedAt ?? one.createdAt, locale),
        ]),
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
