---
title: Contributing
description: How UniAria is built, and how to work in the repository.
---

UniAria is built by AI agents. They write the component specs, the
conformance scenarios, the code, the tests and this site. The owner,
[@tenphi](https://github.com/tenphi), approves every spec before work on a
component starts and reviews the APIs at each phase gate.

The binding rules live in `AGENTS.md` files. The
[root `AGENTS.md`](https://github.com/tenphi/uniaria/blob/main/AGENTS.md)
summarizes the design, the architecture rules, the component workflow and
every command; read it in full before you change anything. Each package adds
a short file with its local rules:
[`@uniaria/core`](https://github.com/tenphi/uniaria/blob/main/packages/core/AGENTS.md),
[`@uniaria/react`](https://github.com/tenphi/uniaria/blob/main/packages/react/AGENTS.md),
[`@uniaria/vue`](https://github.com/tenphi/uniaria/blob/main/packages/vue/AGENTS.md),
[`@uniaria/elements`](https://github.com/tenphi/uniaria/blob/main/packages/elements/AGENTS.md),
[`@uniaria/testing`](https://github.com/tenphi/uniaria/blob/main/packages/testing/AGENTS.md)
and [`conformance`](https://github.com/tenphi/uniaria/blob/main/conformance/AGENTS.md).
The owner's full design doc stands behind them; when it and `AGENTS.md`
disagree, ask the owner.

This section is the readable overview. It explains how the pieces fit and
links to the rules rather than repeating each one. If a page here and an
`AGENTS.md` disagree, the `AGENTS.md` wins.

- [Architecture](./architecture.md): the layers, the runtime and its store,
  the DOM binder, the adapters, owners, overlays and custom elements.
- [Component workflow](./component-workflow.md): spec, conformance scenarios,
  definition, adapters and docs, in that order.
- [Testing](./testing.md): Node and browser tests, conformance, render counts
  and screen readers.
- [Documentation](./documentation.md): how this site is built, and how to
  write a component page with a live demo.

## Repository layout

| Path                | Contents                                                                                                                                                      | Published            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `packages/core`     | `@uniaria/core`: the runtime, `dom/` (the binder, interactions, overlays, positioning), collections, the virtualizer and one subpath per component            | Yes                  |
| `packages/react`    | `@uniaria/react`: `useBehavior`, `useBehaviorState` and `OwnerProvider`                                                                                       | Yes                  |
| `packages/vue`      | `@uniaria/vue`: `useBehavior` and `useBehaviorState`; its spec in `spec.md`                                                                                   | Yes                  |
| `packages/elements` | `@uniaria/elements`: `defineElement` and one registering entry per component element                                                                          | Yes                  |
| `packages/testing`  | `@uniaria/testing`: the mount contract, the conformance runner, real input and screen-reader helpers                                                          | Yes, for development |
| `conformance`       | `@uniaria/conformance`: the scenarios every adapter must pass, one folder per component with a suite                                                          | No                   |
| `apps/docs`         | This site, built with Cookbook                                                                                                                                | No                   |
| `docs`              | The site's pages. `docs/_internal/` holds the component spec template and `interaction-layer.md`, the catalogue of what `dom/` must do; it is never published | No                   |
| `scripts`           | Repository checks CI runs, and the script that fetches the reference repos                                                                                    | No                   |
| `.github`           | The CI workflow, the nightly screen-reader workflow and the Dependabot configuration                                                                          | No                   |
| `references`        | Read-only clones of related projects, for reading their source and tests (gitignored)                                                                         | No                   |
| `specs`             | The owner's local design notes (gitignored; never commit anything here)                                                                                       | No                   |

All published packages share one version, a Changesets `fixed` group. Inside
`packages/core/src`, `runtime/` and `collections/` are DOM-free, `dom/` holds
what every adapter shares, and `components/<name>/` holds each component's
spec, definition and tests. See [Architecture](./architecture.md#layers).

## Setup

You need Node 22 or later (22.19 or later for the documentation site) and
pnpm 11; the root `package.json` pins the exact pnpm version in
`packageManager`.

```sh
pnpm install
pnpm test:setup
pnpm test
```

- **`pnpm install`** refuses any package version published less than 14 days
  ago. The policy is `minimumReleaseAge` in `pnpm-workspace.yaml`, a guard
  against compromised releases. Its exceptions are listed there too: a pinned
  `@tanstack/virtual-core` release until it turns 14 days old, and the owner's
  own `@tenphi/*` packages (Cookbook, Tasty and Glaze, which build this site).
  Install scripts run only for packages `allowBuilds` enables, and it enables
  none.
- **`pnpm test:setup`** installs the Playwright builds of Chromium, Firefox
  and WebKit that the browser tests run in.
- **`pnpm references`** is optional. It clones the related projects listed in
  the root `AGENTS.md` (Reference repos) into `references/`, or updates them;
  pass names to fetch only some (`pnpm references zag virtual`). Read them,
  never edit or import them.

Workspace packages resolve each other's `src/` through the `uniaria-source`
export condition, so tests and type checks never need a build first.

## Commands

| Command                                          | What it does                                                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                                   | Installs the workspace. Versions younger than 14 days are refused on purpose.                                                                      |
| `pnpm test:setup`                                | Installs the Playwright browsers.                                                                                                                  |
| `pnpm test`                                      | The `node` project, then the `browser` project (Chromium, Firefox, WebKit).                                                                        |
| `pnpm test:node`                                 | Only the DOM-free tests.                                                                                                                           |
| `pnpm test:browser`                              | Only the browser tests, in all three engines.                                                                                                      |
| `pnpm vitest run --project "browser (chromium)"` | One browser engine.                                                                                                                                |
| `pnpm test:watch`                                | Vitest in watch mode.                                                                                                                              |
| `pnpm test:screen-readers`                       | The real screen-reader project. It exists only in the nightly workflow; see [Testing](./testing.md#real-screen-readers).                           |
| `pnpm build`                                     | Builds every published package with tsdown: ESM, `.d.ts` files and sourcemaps.                                                                     |
| `pnpm typecheck`                                 | Type-checks every workspace package, including the DOM-free core configuration.                                                                    |
| `pnpm lint` / `pnpm lint:fix`                    | ESLint, including the architecture boundaries and the Tasty rules for the site.                                                                    |
| `pnpm format` / `pnpm format:check`              | Prettier: single quotes, semicolons, trailing commas, 80 columns.                                                                                  |
| `pnpm hygiene` / `pnpm hygiene:fix`              | Lint, format check and type check in one go; the `:fix` variant fixes lint and formats first.                                                      |
| `pnpm check:conformance`                         | Fails when an unpushed commit changes both conformance scenarios and implementation.                                                               |
| `pnpm bench`                                     | Times UniAria's Button, React Aria's and a plain one in a production build; rewrites `packages/react/bench/results.md`.                            |
| `pnpm size`                                      | Builds, then reports the brotlied size of each entry point with each adapter, and of the prebuilt CSS (`.size-limit.js`). There are no limits yet. |
| `pnpm references [name …]`                       | Clones or updates the reference repos.                                                                                                             |
| `pnpm changeset`                                 | Creates a changeset for a user-visible package change (see [How changes land](#how-changes-land)).                                                 |

The site has its own commands; see [Documentation](./documentation.md#commands).

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org):
`type(scope): short description`.

- **Types:** `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`,
  `ci`.
- **Scope:** the component or the layer: `feat(checkbox): …`,
  `fix(runtime): …`, `test(listbox): …`, `docs(select): …`.
- **Small and in order.** A component's spec, its conformance scenarios and
  its implementation land in separate commits (see
  [Component workflow](./component-workflow.md)).
- **Conformance alone.** A commit that changes `conformance/` changes no
  implementation under `packages/*/src/`, and the reverse. CI checks it.
- **Never** commit anything under `specs/` or `references/`.
- Commit `packages/react/bench/results.md` only after a run on a quiet
  machine.

## How changes land

Since the first release, work lands through pull requests, and big ones: a
branch carries a whole piece of work (the implementation, its tests, docs
and changeset), not one commit. The owner merges and releases.

1. Branch from an up-to-date `main`.
2. `pnpm hygiene`, and fix what it reports.
3. `pnpm test`: every project passes.
4. `pnpm format`, then commit.
5. `pnpm changeset` for every user-visible change to a published package:
   `minor` for a feature or a breaking change while versions are 0.x,
   `patch` for the rest. Tests, docs and tooling need none.
6. `pnpm check:conformance`: no commit on the branch touches both
   conformance and implementation. Split a commit that does; scenarios and
   implementation also go in separate pull requests.
7. Push the branch and open a pull request against `main`
   (`gh pr create`); a draft while it waits for a spec's approval.
8. Watch CI (`gh pr checks --watch`) and fix a failure in a follow-up
   commit.

The same steps are in `.cursor/commands/submit-changes.md`.

### CI

`.github/workflows/ci.yml` runs on every push to `main` and on every pull
request, on Ubuntu with Node 22. Its jobs run side by side, and a new push
to a pull request cancels the run for the previous one:

- **`checks`:** `pnpm install --frozen-lockfile`, then `pnpm lint`,
  `pnpm format:check`, `pnpm typecheck`, `pnpm build` and `pnpm test:node`.
- **`browser`:** the `browser` project, one job per engine, each with its
  own Playwright browser (cached per lockfile). That runs the conformance
  scenarios in three engines and every adapter, spoken-output checks
  included; only the scenarios that need a real screen reader wait for the
  nightly run. Firefox runs its files one at a time, so it is split in four
  jobs: each adapter's conformance file, and the rest. A pull request that
  changes only `docs/`, Markdown or `.changeset/` skips these jobs, since no
  test reads those files.
- **`docs`:** `pnpm -C apps/docs validate` (see
  [Documentation](./documentation.md)).
- **`conformance-separation`:** `scripts/check-conformance-separation.mjs`
  checks each pushed commit, or a pull request's whole diff, for changes to
  both `conformance/` and non-test files under `packages/*/src/`. On a pull
  request only the owner's `conformance-approved` label overrides it; on a
  push nothing does.

Real screen readers run nightly in a separate workflow; see
[Testing](./testing.md#real-screen-readers).

### Dependency updates

Dependabot opens grouped update pull requests weekly, for releases at least
14 days old. They wait for now (owner, 2026-10-21); when they resume, agents
review them: an update lands on `main` once CI passes, with fixes for
whatever it breaks. Dependabot skips major versions
of the packages that set what UniAria supports: `@types/node`, React and its
types, TypeScript and Vitest. Those are raised by hand, only for a concrete
need. Adding a dependency is a different matter; see
[Component workflow](./component-workflow.md#dependencies).
