# submit-changes

Submit changes by committing and pushing to `main`. Until the first release
there are no branches, pull requests or changesets. Follow these steps **in
order**.

## 1. Check

Run `pnpm hygiene` and `pnpm test`. Stop and fix failures before continuing.

## 2. Format

Run `pnpm format` before committing.

## 3. Commit

Use **Conventional Commits**:

```
type(scope): short description
```

- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`.
- Scope is the component or layer (`checkbox`, `runtime`, `dom`, `react`,
  `elements`, `conformance`).
- Keep the message short.
- Conformance scenarios and implementation go in separate commits.
- Never commit anything under `specs/` or `references/`, and do not add
  markdown files that are not in the repo yet unless the user staged them.

## 4. Check conformance separation

Run `pnpm check:conformance`. It fails if an unpushed commit touches both
`conformance/` and implementation under `packages/*/src/`; split that commit
before pushing.

## 5. Push

- Make sure you are on `main` and up to date: `git pull --rebase`.
- Push with `git push`.
- Watch CI with `gh run watch --exit-status` and fix a failure in a follow-up
  commit.
