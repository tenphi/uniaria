# submit-changes

Submit changes by creating a changeset, committing, and opening a pull request.
Follow these steps **in order**.

## 1. Check

Run `pnpm hygiene` and `pnpm test`. Stop and fix failures before continuing.

## 2. Create a changeset

Skip only for changes that do not affect a published package (CI, repo
tooling, tests with no behavior change, `conformance/`).

- Create a markdown file in `.changeset/` with a random kebab-case name (e.g.
  `.changeset/bright-dogs-fly.md`).
- List the changed published packages. They share one version (a `fixed`
  group), so the highest bump applies to all of them.

```markdown
---
'@tenphi/sous': patch
'@tenphi/sous-react': patch
---

Short description of what changed.
```

- `patch` for fixes and small changes, `minor` for new features or
  non-breaking API changes, `major` for breaking changes. Before 1.0.0, treat
  major changes as minor and minor as patches.
- The description is a concise user-facing summary (what changed, not how).

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
- Keep the message short. Include the changeset in the same commit.
- Never commit anything under `specs/`, and do not add markdown files that are
  not in the repo yet unless the user staged them.

## 5. Push and open a pull request

- **Never push to `main`.** Verify the current branch first; if on `main`,
  stop and warn the user.
- Push with `git push -u origin HEAD`, then `gh pr create`.
- Conformance changes and implementation changes go in separate pull requests.
