/**
 * Guardrail: conformance scenarios and implementation never change together,
 * so an agent cannot make a failing test pass by editing the test (AGENTS.md
 * → Conformance).
 *
 * - Commits (default): no commit in COMMIT_RANGE may touch both. The default
 *   range, `origin/main..HEAD`, is the commits not pushed yet; CI passes the
 *   range each push to `main` adds. There is no override: split the commit.
 * - Pull requests (PR_BASE set): the whole diff against PR_BASE may not touch
 *   both, unless PR_LABELS includes `conformance-approved`, which only the
 *   owner adds.
 *
 * Env: COMMIT_RANGE, PR_BASE, PR_LABELS (comma-separated).
 */
import { execFileSync } from 'node:child_process';

const APPROVAL_LABEL = 'conformance-approved';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const lines = (output) => output.split('\n').filter(Boolean);

function classify(files) {
  return {
    conformance: files.filter((file) => file.startsWith('conformance/')),
    implementation: files.filter(
      (file) =>
        /^packages\/[^/]+\/src\//.test(file) && !/\.test\.tsx?$/.test(file),
    ),
  };
}

function isMixed({ conformance, implementation }) {
  return conformance.length > 0 && implementation.length > 0;
}

function report(subject, { conformance, implementation }) {
  console.error(
    [
      `${subject} changes both conformance scenarios and implementation.`,
      'Split it: land the conformance change first (owner approval), then the implementation.',
      '',
      'Conformance:',
      ...conformance.map((file) => `  ${file}`),
      'Implementation:',
      ...implementation.map((file) => `  ${file}`),
      '',
    ].join('\n'),
  );
}

function commitExists(ref) {
  try {
    execFileSync('git', ['cat-file', '-e', `${ref}^{commit}`], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * A push that creates a branch reports an all-zero `before`, and a force push
 * can report one that was never fetched; then only the tip is checked.
 */
function listCommits(range) {
  const [from, to = 'HEAD'] = range.split('..');

  if (!from || !commitExists(from)) {
    return lines(git('rev-parse', to));
  }

  return lines(git('rev-list', '--reverse', `${from}..${to}`));
}

function checkPullRequest(base) {
  const labels = (process.env.PR_LABELS || '')
    .split(',')
    .map((label) => label.trim());

  if (labels.includes(APPROVAL_LABEL)) {
    console.log(`"${APPROVAL_LABEL}" label present; skipping the check.`);
    return true;
  }

  const changes = classify(lines(git('diff', '--name-only', `${base}...HEAD`)));

  if (isMixed(changes)) {
    report('This pull request', changes);
    return false;
  }

  return true;
}

function checkCommits(range) {
  const commits = listCommits(range);
  let ok = true;

  for (const sha of commits) {
    const changes = classify(
      lines(
        git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha),
      ),
    );

    if (isMixed(changes)) {
      report(
        `Commit ${git('log', '-1', '--format=%h "%s"', sha).trim()}`,
        changes,
      );
      ok = false;
    }
  }

  if (ok) {
    console.log(`Checked ${commits.length} commit(s) in ${range}.`);
  }

  return ok;
}

const ok = process.env.PR_BASE
  ? checkPullRequest(process.env.PR_BASE)
  : checkCommits(process.env.COMMIT_RANGE || 'origin/main..HEAD');

if (!ok) {
  process.exit(1);
}

console.log('Conformance and implementation changes are separate.');
