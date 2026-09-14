import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { report } from '../../tools/check-selectors.mjs';

const UI_COMPONENT = "@Component({\n  selector: 'app-foo-row',\n})\nexport class FooRowComponent {}\n";
const FEATURE_COMPONENT_COLLIDING =
  "@Component({\n  selector: 'app-bar-row',\n})\nexport class BarRowComponent {}\n";
const FEATURE_COMPONENT_LONE =
  "@Component({\n  selector: 'app-bar-lonely',\n})\nexport class BarLonelyComponent {}\n";

/** Legt eine `ui`- und eine `features`-Komponente unter `src/app` an. */
function fixture(featureComponent: string): { root: string; allowPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'check-selectors-'));
  mkdirSync(join(root, 'src', 'app', 'ui', 'foo-row'), { recursive: true });
  mkdirSync(join(root, 'src', 'app', 'features', 'bar'), { recursive: true });
  writeFileSync(join(root, 'src', 'app', 'ui', 'foo-row', 'foo-row.component.ts'), UI_COMPONENT, 'utf8');
  writeFileSync(
    join(root, 'src', 'app', 'features', 'bar', 'bar-row.component.ts'),
    featureComponent,
    'utf8',
  );
  return { root, allowPath: join(root, 'lint-allow.json') };
}

describe('check-selectors', () => {
  it('meldet einen Verstoss mit Pfad und Grund', () => {
    const { root, allowPath } = fixture(FEATURE_COMPONENT_COLLIDING);
    try {
      const found = report(root, allowPath);

      expect(found).toHaveLength(1);
      expect(found[0].path).toBe('src/app/features/bar/bar-row.component.ts');
      expect(found[0].reason).toContain('ohne Import aus ui/');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lässt einen Verstoss aus der Ausnahmeliste weg', () => {
    const { root, allowPath } = fixture(FEATURE_COMPONENT_COLLIDING);
    try {
      const [violation] = report(root, allowPath);
      writeFileSync(allowPath, JSON.stringify({ selectors: [violation.key] }));

      expect(report(root, allowPath)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('läuft ohne Verstoss durch', () => {
    const { root, allowPath } = fixture(FEATURE_COMPONENT_LONE);
    try {
      expect(report(root, allowPath)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
