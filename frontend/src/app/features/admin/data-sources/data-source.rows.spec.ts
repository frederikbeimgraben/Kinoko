import type { DataSourceDetail, DataSourceVersion } from '../../../core/api/models';
import { formatFacts, metaFacts, speciesRows, versionFacts, type Fact } from './data-source.rows';
import { sourceOf, versionOf } from './data-sources.testing';

function text(key: string, values: Record<string, string | number> = {}): string {
  const shown = Object.entries(values).map(([name, value]) => `${name}=${value}`);
  return shown.length === 0 ? key : `${key}(${shown.join(',')})`;
}

const valueOf = (facts: readonly Fact[], key: string): string | undefined =>
  facts.find((fact) => fact.key === key)?.value;

function detailOf(change: Partial<DataSourceDetail> = {}): DataSourceDetail {
  return {
    ...sourceOf('trees-grid'),
    versions: [],
    nextCursor: null,
    openUpload: null,
    ...change,
  } as DataSourceDetail;
}

describe('data source rows', () => {
  it('shows the format facts of a required source and its uses', () => {
    const facts = formatFacts(detailOf({ usedBy: ['render', 'training'] }), text, 'en');

    expect(facts.map((fact) => fact.key)).toEqual(['types', 'max', 'required', 'uses']);
    expect(valueOf(facts, 'types')).toBe('.parquet');
    expect(valueOf(facts, 'required')).toBe('admin.dataSources.requiredYes');
    expect(valueOf(facts, 'uses')).toContain('admin.dataSources.use.training');
  });

  it('shows an optional source, the kind that covers it, and drops empty facts', () => {
    const facts = formatFacts(
      detailOf({
        required: false,
        usedBy: [],
        satisfiedBy: 'site-grid',
        accept: { extensions: [], mediaTypes: [], maxBytes: 10 },
      }),
      text,
      'en',
    );

    expect(valueOf(facts, 'required')).toBe('admin.dataSources.requiredNo');
    expect(valueOf(facts, 'covered')).toBe('admin.dataSources.kind.site-grid');
    expect(valueOf(facts, 'types')).toBeUndefined();
    expect(valueOf(facts, 'uses')).toBeUndefined();
  });

  it('names known metadata fields and keeps the key of other fields', () => {
    const version: DataSourceVersion = {
      ...versionOf('v-1', 1),
      metadata: { crs: 'EPSG:3035', custom: 'x', empty: null },
    };

    const facts = metaFacts(version, text, 'en');

    expect(facts).toEqual([
      { key: 'crs', title: 'admin.dataSources.meta.crs', value: 'EPSG:3035' },
      { key: 'custom', title: 'custom', value: 'x' },
    ]);
  });

  it('shows every fact of a full version', () => {
    const source = versionOf('v-1', 1);
    const version: DataSourceVersion = {
      ...versionOf('v-2', 2, 'failed'),
      origin: 'derived',
      derivedFromId: 'v-1',
      processedAt: '2026-10-01T11:00:00Z',
      activatedAt: '2026-10-01T12:00:00Z',
      error: { code: 'bad_crs', detail: 'EPSG:4326' },
    };

    const facts = versionFacts(version, [source, version], text, 'en');

    expect(valueOf(facts, 'state')).toBe('admin.dataSources.state.failed');
    expect(valueOf(facts, 'origin')).toBe('admin.dataSources.origin.derived');
    expect(valueOf(facts, 'derived')).toBe('admin.dataSources.version(nummer=1)');
    expect(valueOf(facts, 'file')).toBe('trees-v2.parquet');
    expect(valueOf(facts, 'size')).toBe('1 MB');
    expect(valueOf(facts, 'by')).toBe('Frederik');
    expect(valueOf(facts, 'processed')).not.toBe('');
    expect(valueOf(facts, 'activated')).not.toBe('');
    expect(valueOf(facts, 'error')).toContain('bad_crs');
  });

  it('drops the facts of a version without file, size, person or source', () => {
    const version: DataSourceVersion = {
      ...versionOf('v-3', 3),
      derivedFromId: 'gone',
      fileName: null,
      sizeBytes: null,
      sha256: null,
      createdBy: null,
    };

    const keys = versionFacts(version, [version], text, 'en').map((fact) => fact.key);

    expect(keys).toEqual(['state', 'origin', 'created']);
  });

  it('lists the active species versions by name with the Brier score of a training', () => {
    const versions: DataSourceVersion[] = [
      {
        ...versionOf('m-1', 4),
        active: true,
        speciesId: 'boletus',
        origin: 'training',
        metadata: { brier: 0.123 },
        activatedAt: '2026-10-02T10:00:00Z',
      },
      { ...versionOf('m-2', 2), active: true, speciesId: 'amanita', metadata: { brier: 0.2 } },
      { ...versionOf('m-3', 3), active: false, speciesId: 'cantharellus' },
      { ...versionOf('m-4', 1), active: true, speciesId: null },
      { ...versionOf('m-5', 5), active: true, speciesId: 'russula', origin: 'training', metadata: {} },
    ];
    const names: Record<string, string> = { boletus: 'Bolete', amanita: 'Amanita', russula: 'Russula' };

    const rows = speciesRows(versions, (id) => names[id] ?? id, text, 'en');

    expect(rows.map((row) => row.speciesId)).toEqual(['amanita', 'boletus', 'russula']);
    expect(rows[1].subline).toContain('admin.run.brier(wert=0.123)');
    expect(rows[0].subline).not.toContain('admin.run.brier');
    expect(rows[2].subline).not.toContain('admin.run.brier');
  });
});
