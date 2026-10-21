# submit-changes

Submit changes through a pull request. Since the first release, every piece
of work lands on its own branch, and pull requests are big: one carries a
whole piece of work (the implementation, its tests, docs and changeset), not
one commit. The owner merges and releases. Follow these steps **in order**.

## 1. Branch

Start from an up-to-date `main` (`git switch main && git pull --rebase`),
then `git switch -c <short-name>`. Keep adding to the same branch until the
work is ready for review.

## 2. Check

Run `pnpm hygiene` and `pnpm test`. Stop and fix failures before continuing.

## 3. Format

Run `pnpm format` before committing.

## 4. Commit

Use **Conventional Commits**:

```
type(scope): short description
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`.
- Scope is the component or layer (`checkbox`, `runtime`, `dom`, `react`,
  `elements`, `conformance`).
- Keep the message short.
- Conformance scenarios and implementation go in separate commits and
  separate pull requests.
- Never commit anything under `specs/` or `references/`, and do not add
  markdown files that are not in the repo yet unless the user staged them.

## 5. Changeset

Run `pnpm changeset` for every user-visible change to a published package:
`minor` for a feature or a breaking change while versions are 0.x, `patch`
for the rest. Tests, docs and tooling need none.

## 6. Check conformance separation

Run `pnpm check:conformance`. It fails if a commit on the branch touches both
`conformance/` and implementation under `packages/*/src/`; split that commit
before pushing.

## 7. Pull request

- Push the branch: `git push -u origin <short-name>`.
- Open a pull request against `main` with `gh pr create`; a draft while it
  waits for a spec's approval.
- Watch CI with `gh pr checks --watch` and fix a failure in a follow-up
  commit. Leave the merge to the owner.
