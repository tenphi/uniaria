/**
 * Guardrail: conformance tests and implementation never change in the same
 * pull request, so an agent cannot make a failing test pass by editing the
 * test (AGENTS.md → Conformance). The owner can allow an exception by adding
 * the `conformance-approved` label to the pull request.
 *
 * Env: BASE_REF (default `origin/main`), PR_LABELS (comma-separated).
 */
import { execFileSync } from 'node:child_process';

const APPROVAL_LABEL = 'conformance-approved';
const base = process.env.BASE_REF || 'origin/main';
const labels = (process.env.PR_LABELS || '')
  .split(',')
  .map((label) => label.trim());

if (labels.includes(APPROVAL_LABEL)) {
  console.log(`"${APPROVAL_LABEL}" label present; skipping the check.`);
  process.exit(0);
}

const changed = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);

const conformance = changed.filter((file) => file.startsWith('conformance/'));
const implementation = changed.filter(
  (file) => /^packages\/[^/]+\/src\//.test(file) && !/\.test\.tsx?$/.test(file),
);

if (conformance.length > 0 && implementation.length > 0) {
  console.error(
    [
      'This pull request changes both conformance scenarios and implementation.',
      'Split it: land the conformance change first (owner approval), then the implementation.',
      '',
      'Conformance:',
      ...conformance.map((file) => `  ${file}`),
      'Implementation:',
      ...implementation.map((file) => `  ${file}`),
    ].join('\n'),
  );
  process.exit(1);
}

console.log('Conformance and implementation changes are separate.');
