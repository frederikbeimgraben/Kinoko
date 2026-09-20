import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check, designDir, sync } from '../../tools/sync-baselines.mjs';

/** Builds a design package fixture with one board and two components. */
function fixture(): { root: string; design: string } {
  const root = mkdtempSync(join(tmpdir(), 'sync-baselines-'));
  const design = join(root, 'design');
  mkdirSync(join(design, 'bilder'), { recursive: true });
  writeFileSync(
    join(design, 'manifest.json'),
    JSON.stringify({ boards: [{ board: 'Map', platform: 'phone', width: 390, height: 844 }] }),
  );
  writeFileSync(
    join(design, 'components.json'),
    JSON.stringify({
      components: [
        { component: 'Badge', kind: 'component', width: 40, height: 20 },
        { component: 'Sheet', kind: 'standalone', width: 390, height: 600 },
      ],
    }),
  );
  writeFileSync(join(design, 'bilder', 'Map.png'), 'map-image');
  writeFileSync(join(design, 'bilder', 'Badge.png'), 'badge-image');
  writeFileSync(join(design, 'bilder', 'Sheet.png'), 'sheet-image');
  return { root, design };
}

function cleanup(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

describe('sync-baselines', () => {
  it('resolves an explicit design directory', () => {
    const { root, design } = fixture();
    try {
      expect(designDir(root, design)).toBe(design);
    } finally {
      cleanup(root);
    }
  });

  it('raises a clear error when the design directory is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'sync-baselines-'));
    try {
      expect(() => designDir(root, join(root, 'no-such-dir'))).toThrow(/no-such-dir/);
    } finally {
      cleanup(root);
    }
  });

  it('copies board and component baselines, skipping standalone records', () => {
    const { root, design } = fixture();
    try {
      const result = sync(root, design);

      expect(result.missing).toEqual([]);
      expect(readFileSync(join(root, 'e2e/boards/baseline/Map.png'), 'utf8')).toBe('map-image');
      expect(readFileSync(join(root, 'e2e/boards/baseline/blocks/Badge.png'), 'utf8')).toBe('badge-image');
      expect(existsSync(join(root, 'e2e/boards/baseline/blocks/Sheet.png'))).toBe(false);
      expect(existsSync(join(root, 'e2e/boards/baseline/Sheet.png'))).toBe(false);
    } finally {
      cleanup(root);
    }
  });

  it('removes a baseline that the design package no longer lists', () => {
    const { root, design } = fixture();
    try {
      mkdirSync(join(root, 'e2e/boards/baseline/blocks'), { recursive: true });
      writeFileSync(join(root, 'e2e/boards/baseline', 'OldBoard.png'), 'stale');
      writeFileSync(join(root, 'e2e/boards/baseline/blocks', 'OldBlock.png'), 'stale');

      sync(root, design);

      expect(existsSync(join(root, 'e2e/boards/baseline', 'OldBoard.png'))).toBe(false);
      expect(existsSync(join(root, 'e2e/boards/baseline/blocks', 'OldBlock.png'))).toBe(false);
    } finally {
      cleanup(root);
    }
  });

  it('writes SOURCE.json with the sha256 of every copied file', () => {
    const { root, design } = fixture();
    try {
      sync(root, design);
      const recorded = JSON.parse(
        readFileSync(join(root, 'e2e/boards/baseline/SOURCE.json'), 'utf8'),
      ) as Record<string, string>;
      const mapKey = 'Map';
      const badgeKey = 'blocks/Badge';

      expect(recorded[mapKey]).toBe(createHash('sha256').update('map-image').digest('hex'));
      expect(recorded[badgeKey]).toBe(createHash('sha256').update('badge-image').digest('hex'));
    } finally {
      cleanup(root);
    }
  });

  it('reports a board without a source image instead of throwing', () => {
    const { root, design } = fixture();
    try {
      writeFileSync(
        join(design, 'manifest.json'),
        JSON.stringify({
          boards: [{ board: 'Map', platform: 'phone', width: 390, height: 844 }, { board: 'Ghost' }],
        }),
      );

      const result = sync(root, design);

      expect(result.missing).toEqual(['Ghost']);
    } finally {
      cleanup(root);
    }
  });

  it('passes check once the baselines match SOURCE.json', () => {
    const { root, design } = fixture();
    try {
      sync(root, design);

      expect(check(root)).toEqual([]);
    } finally {
      cleanup(root);
    }
  });

  it('fails check when a baseline differs from SOURCE.json', () => {
    const { root, design } = fixture();
    try {
      sync(root, design);
      writeFileSync(join(root, 'e2e/boards/baseline', 'Map.png'), 'rendered-by-the-app');

      expect(check(root)).toEqual(['Map: differs from SOURCE.json']);
    } finally {
      cleanup(root);
    }
  });

  it('fails check on a baseline that SOURCE.json does not list', () => {
    const { root, design } = fixture();
    try {
      sync(root, design);
      writeFileSync(join(root, 'e2e/boards/baseline', 'Extra.png'), 'from-the-app');

      expect(check(root)).toEqual(['Extra: not listed in SOURCE.json']);
    } finally {
      cleanup(root);
    }
  });
});
