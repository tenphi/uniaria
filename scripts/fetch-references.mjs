/**
 * Shallow-clones the reference repositories into `references/` (gitignored),
 * or resets the ones already there to their latest default branch. Agents read
 * them for patterns and edge cases; nothing in the build, lint or tests
 * touches them. They are read-only mirrors: updating discards local changes.
 *
 * Usage: pnpm references [name ...]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** What each one is for is documented in AGENTS.md → Reference repos. */
const REFERENCES = [
  { name: 'cube-ui-kit', repo: 'cube-js/cube-ui-kit' },
  { name: 'react-spectrum', repo: 'adobe/react-spectrum' },
  { name: 'zag', repo: 'chakra-ui/zag' },
  { name: 'virtual', repo: 'TanStack/virtual' },
  { name: 'floating-ui', repo: 'floating-ui/floating-ui' },
  { name: 'aria-practices', repo: 'w3c/aria-practices' },
  { name: 'virtual-screen-reader', repo: 'guidepup/virtual-screen-reader' },
];

const root = join(import.meta.dirname, '..', 'references');
const requested = process.argv.slice(2);
const unknown = requested.filter(
  (name) => !REFERENCES.some((ref) => ref.name === name),
);

if (unknown.length > 0) {
  console.error(`Unknown reference: ${unknown.join(', ')}`);
  console.error(`Known: ${REFERENCES.map((ref) => ref.name).join(', ')}`);
  process.exit(1);
}

const selected =
  requested.length > 0
    ? REFERENCES.filter((ref) => requested.includes(ref.name))
    : REFERENCES;

mkdirSync(root, { recursive: true });

for (const { name, repo } of selected) {
  const dir = join(root, name);
  const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });

  if (existsSync(join(dir, '.git'))) {
    console.log(`\nUpdating references/${name}`);
    git('-C', dir, 'fetch', '--depth', '1', 'origin', 'HEAD');
    git('-C', dir, 'reset', '--hard', '--quiet', 'FETCH_HEAD');
  } else {
    console.log(`\nCloning ${repo} into references/${name}`);
    git(
      'clone',
      '--depth',
      '1',
      '--single-branch',
      '--quiet',
      `https://github.com/${repo}.git`,
      dir,
    );
  }
}
