import { readFileSync } from 'node:fs';
import { RELEASE_TAG, content, describe as stamp, label } from '../../tools/stamp-version.mjs';

describe('stamp-version', () => {
  it('shows the Git version without the commit hash, as the board does', () => {
    expect(label('v2026-10-08-01-3-g65dd41a')).toBe('v2026-10-08-01-3');
    expect(label('v2026-10-08-01')).toBe('v2026-10-08-01');
  });

  it('keeps the commit of a Nix build, as config.Label in the service does', () => {
    expect(label('v2026-10-09+5896dc4')).toBe('v2026-10-09+5896dc4');
    expect(stamp({ KINOKO_VERSION: 'v2026-10-09+5896dc4' }, () => null)).toBe('v2026-10-09+5896dc4');
  });

  it('gives a release tag without v the v', () => {
    expect(label('2026-10-08-01')).toBe('v2026-10-08-01');
    expect(label('2026-10-08-01-3-g65dd41a')).toBe('v2026-10-08-01-3');
  });

  it('keeps a bare commit hash and falls back to dev', () => {
    expect(label('f2ac945')).toBe('f2ac945');
    expect(label('5896dc4')).toBe('5896dc4');
    expect(label('')).toBe('dev');
    expect(label(null)).toBe('dev');
  });

  it('prefers the version of the Nix build to Git', () => {
    expect(stamp({ KINOKO_VERSION: 'v2026-10-09+5896dc4' }, () => 'v2026-10-08-01-3-g65dd41a')).toBe('v2026-10-09+5896dc4');
    expect(stamp({}, () => 'v2026-10-08-01-3-g65dd41a')).toBe('v2026-10-08-01-3');
    expect(stamp({}, () => null)).toBe('dev');
  });

  it('writes a TypeScript constant', () => {
    expect(content('v2026-10-08-01-3')).toBe("export const APP_VERSION = 'v2026-10-08-01-3';\n");
  });

  it('nimmt nur ein Release-Tag, wie das Bauskript des Dienstes', () => {
    const build = readFileSync('../backend/build.sh', 'utf8');
    expect(build).toContain(`release_tag='${RELEASE_TAG}'`);
    expect(RELEASE_TAG).toBe('v[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-[0-9]*');
  });
});
