import type { DataSourceDetail } from '../../../core/api/models';
import { withFirstPage, withPage, without } from './data-sources.calls';
import { sourceOf, versionOf } from './data-sources.testing';

const detailOf = (ids: readonly string[], nextCursor: string | null): DataSourceDetail => ({
  ...sourceOf('trees-grid'),
  versions: ids.map((id, at) => versionOf(id, ids.length - at)),
  nextCursor,
  openUpload: null,
});

const idsOf = (detail: DataSourceDetail | null): string[] => detail?.versions.map((one) => one.id) ?? [];

describe('withFirstPage', () => {
  it('keeps the older pages after a new first page', () => {
    const held = detailOf(['v-3', 'v-2', 'v-1', 'v-0'], null);

    const merged = withFirstPage(held, detailOf(['v-4', 'v-3'], '2'));

    expect(idsOf(merged)).toEqual(['v-4', 'v-3', 'v-2', 'v-1', 'v-0']);
    expect(merged.nextCursor).toBeNull();
  });

  it('takes the first page as it is without a held page, for another kind or for a full list', () => {
    const first = detailOf(['v-2', 'v-1'], '2');

    expect(withFirstPage(null, first)).toBe(first);
    expect(withFirstPage({ ...first, kind: 'dem' }, first)).toBe(first);
    const full = detailOf(['v-2', 'v-1'], null);
    expect(withFirstPage(detailOf(['v-2', 'v-1', 'v-0'], null), full)).toBe(full);
  });

  it('takes the first page when its last version is not held', () => {
    const first = detailOf(['v-3', 'v-1'], '2');

    expect(withFirstPage(detailOf(['v-3', 'v-2'], '2'), first)).toBe(first);
  });
});

describe('withPage', () => {
  it('adds an older page without the versions that the detail holds already', () => {
    const merged = withPage(detailOf(['v-3', 'v-2'], '2'), detailOf(['v-2', 'v-1'], null));

    expect(idsOf(merged)).toEqual(['v-3', 'v-2', 'v-1']);
    expect(merged.nextCursor).toBeNull();
  });
});

describe('without', () => {
  it('takes a removed version out of the detail', () => {
    expect(idsOf(without(detailOf(['v-2', 'v-1'], null), 'v-1'))).toEqual(['v-2']);
    expect(without(null, 'v-1')).toBeNull();
  });
});
