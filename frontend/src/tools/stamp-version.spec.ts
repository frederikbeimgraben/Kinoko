import { content, describe as stamp, label } from '../../tools/stamp-version.mjs';

describe('stamp-version', () => {
  it('shows the Git version without the commit hash, as the board does', () => {
    expect(label('v0.1.0-14-gf2ac945')).toBe('v0.1.0-14');
    expect(label('v0.1.0')).toBe('v0.1.0');
  });

  it('gives a plain release number the v', () => {
    expect(label('3.0.0')).toBe('v3.0.0');
  });

  it('keeps a bare commit hash and falls back to dev', () => {
    expect(label('f2ac945')).toBe('f2ac945');
    expect(label('')).toBe('dev');
    expect(label(null)).toBe('dev');
  });

  it('prefers the version of the Nix build to Git', () => {
    expect(stamp({ KINOKO_VERSION: '3.0.0' }, () => 'v0.1.0-14-gf2ac945')).toBe('v3.0.0');
    expect(stamp({}, () => 'v0.1.0-14-gf2ac945')).toBe('v0.1.0-14');
    expect(stamp({}, () => null)).toBe('dev');
  });

  it('writes a TypeScript constant', () => {
    expect(content('v0.1.0-14')).toBe("export const APP_VERSION = 'v0.1.0-14';\n");
  });
});
