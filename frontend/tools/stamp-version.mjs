#!/usr/bin/env node
/** Writes the build version to `src/app/core/version.generated.ts` before each build, serve and test. */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TARGET = new URL('../src/app/core/version.generated.ts', import.meta.url);
const FALLBACK = 'dev';

/** The form of a release tag: `v`, the day and a number (docs/operations.md). `backend/build.sh` uses the same pattern.
 * Without it, each other tag, for example a test tag, becomes the version. */
export const RELEASE_TAG = 'v[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]-[0-9]*';

/** The Git version after the last release tag, or `null` without a Git directory. */
function fromGit() {
  try {
    const args = ['describe', '--tags', '--match', RELEASE_TAG, '--always'];
    return execFileSync('git', args, { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

/** The version as the about page shows it, per `Account.dc.html`: `v0.1.0-14`.
 * The commit hash goes, and a plain number gets the `v`. `config.Label` in the service agrees. */
export function label(raw) {
  const version = (raw ?? '').trim().replace(/-g[0-9a-f]{7,}$/, '');
  if (version === '') return FALLBACK;
  return /^\d+\.\d+/.test(version) ? `v${version}` : version;
}

/** The Nix build has no Git directory and sets `KINOKO_VERSION` (VERSION file and commit). Local builds use Git. */
export function describe(env = process.env, git = fromGit) {
  return label(env.KINOKO_VERSION || git());
}

export function content(version) {
  return `export const APP_VERSION = '${version}';\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = describe();
  writeFileSync(TARGET, content(version), 'utf8');
  console.log(`Version gestempelt: ${version}`);
}
