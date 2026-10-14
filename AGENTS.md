# AGENTS.md — Sous

Sous is a framework-agnostic headless UI library. Component behavior (state,
keyboard, focus, ARIA, dismissal, selection) is written once in plain
TypeScript; thin adapters bind it to React and to light-DOM custom elements.
Styling is out of scope: every part exposes `data-scope`, `data-part` and state
attributes for the design system to target.

Sous is built by AI agents. The owner, **@tenphi**, approves specs, reviews APIs
at phase gates and runs the manual screen-reader pass. Read this whole file
before changing anything; it is the binding summary of the design.

## Design source

- The full design doc lives in the owner's Claude Docs. A local snapshot may
  exist at `specs/design.md`. `specs/` is gitignored, so it may be missing in
  your checkout; never commit anything under it.
- This file is the contract for agents. If it and the design doc disagree, stop
  and ask the owner.

## Packages

| Package                    | Path                     | Contents                                                                                                                    | Published |
| -------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------- |
| `@tenphi/sous`             | `packages/sous`          | Runtime (`.`), interactions (`./dom`), collections (`./collections`), one subpath per component (`./button`, `./select`, …) | Yes       |
| `@tenphi/sous-react`       | `packages/sous-react`    | Generic `useComponent(definition, props)`; peer `react` ≥ 18                                                                | Yes       |
| `@tenphi/sous-elements`    | `packages/sous-elements` | Generic `defineElement(definition, options)`; light DOM, `sous-` prefix by default; one registering entry per component     | Yes       |
| `@tenphi/sous-testing`     | `packages/sous-testing`  | `createInstance`, the conformance runner, virtual and real screen-reader helpers; development only                          | Yes       |
| `@tenphi/sous-conformance` | `conformance`            | Adapter-agnostic scenarios every adapter must pass                                                                          | No        |

All published packages share one version (Changesets `fixed` group). Each
package has its own short `AGENTS.md` with local rules.

## Project structure

```
sous/
├── packages/
│   ├── sous/
│   │   ├── src/
│   │   │   ├── index.ts            Runtime public API (re-exports runtime/)
│   │   │   ├── runtime/            Store, bindables, defineComponent, machine — DOM-free
│   │   │   ├── collections/        Keys, navigation, selection, typeahead — DOM-free
│   │   │   ├── dom/                Interaction layer and positioning
│   │   │   └── components/<name>/  spec.md, definition, tests (created per component)
│   │   ├── types/host.d.ts         Host globals the DOM-free core may use
│   │   ├── tsconfig.json           Whole package, with DOM lib
│   │   ├── tsconfig.core.json      runtime/ + collections/ without DOM lib
│   │   └── tsdown.config.ts
│   ├── sous-react/
│   ├── sous-elements/
│   └── sous-testing/
├── conformance/                    Scenarios; owner approval required (see Conformance)
├── docs/component-spec-template.md
├── scripts/                        Repo checks run by CI
├── specs/                          Owner's local design notes (gitignored)
├── references/                     Read-only clones of related repos (gitignored)
├── eslint.config.js                Includes the architecture boundary rules
├── vitest.config.ts                `node` and `browser` projects
├── tsconfig.base.json
└── pnpm-workspace.yaml             Workspace + 14-day minimum release age
```

## Commands

| Command                                          | Description                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| `pnpm install`                                   | Install. Versions younger than 14 days are refused on purpose.         |
| `pnpm build`                                     | Build every published package with tsdown (ESM, `.d.ts`, sourcemaps).  |
| `pnpm test`                                      | All tests: `node` project, then `browser` (Chromium, Firefox, WebKit). |
| `pnpm test:node`                                 | Only the DOM-free tests.                                               |
| `pnpm test:browser`                              | Only the browser tests.                                                |
| `pnpm vitest run --project "browser (chromium)"` | One browser engine.                                                    |
| `pnpm test:setup`                                | Install the Playwright browsers.                                       |
| `pnpm typecheck`                                 | Type-check every package, including the DOM-free core config.          |
| `pnpm lint` / `pnpm lint:fix`                    | ESLint, including architecture boundaries.                             |
| `pnpm format` / `pnpm format:check`              | Prettier.                                                              |
| `pnpm hygiene`                                   | Lint, format check and typecheck in one go.                            |
| `pnpm check:conformance`                         | The conformance-separation check CI runs on pull requests.             |
| `pnpm references [name ...]`                     | Clone or update the reference repos (see Reference repos).             |
| `pnpm changeset`                                 | Create a changeset entry.                                              |

## Stack

- **Language:** TypeScript 6 (strict, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`). Not TypeScript 7 yet: typescript-eslint supports
  only `<6.1`.
- **Build:** [tsdown](https://tsdown.dev) per package — ESM only, `.d.ts`,
  sourcemaps.
- **Test:** Vitest 5. `node` project for pure logic, `browser` project in real
  Chromium, Firefox and WebKit through Playwright.
- **Lint:** ESLint 10 flat config + typescript-eslint + `eslint-config-prettier`.
- **Format:** Prettier — single quotes, semicolons, trailing commas, 80 cols.
- **Versioning:** Changesets with `@changesets/changelog-github`.
- **Package manager:** pnpm 11 workspaces. Node ≥ 22.

Workspace packages resolve each other's `src/` through the `sous-source`
export condition (set in `tsconfig.base.json` and `vitest.config.ts`), so
typechecking and tests never need a build.

## Architecture rules

These are design decisions, not preferences. Changing any of them needs the
owner's approval.

### Layers

```
sous-react, sous-elements  →  components/  →  dom/  →  runtime/, collections/
```

An arrow means "may import". Nothing imports upward. `runtime/` and
`collections/` compile without the DOM lib (`tsconfig.core.json`): no
`document`, `window`, `Event` or element types, as values or as types. The only
host globals allowed there are listed in `types/host.d.ts`; everything else
reaches the core through `ctx.env`. Framework imports never appear in
`@tenphi/sous`. ESLint enforces the import rules.

### Behavior lives in definitions

- Every component is one `defineComponent({ name, parts, props, setup, connect })`
  definition in `packages/sous/src/components/<name>/`.
- Adapters are generic over definitions. `sous-react` and `sous-elements`
  contain no component-specific behavior, only optional thin sugar
  (`sous-elements` also has one registering entry per component).
- Composite components compose definitions with `ctx.use(def, props)`. Select
  is Listbox + Popover + trigger and ComboBox is Listbox + Popover + input, so
  there is exactly one Listbox implementation.
- `setup(ctx)` runs once per instance and returns actions. `connect()` is a
  pure function of current state that returns part props; it runs on every
  change, so keep it cheap.

### Controlled and uncontrolled values

- Every stateful value is a bindable, declared in the props schema
  (`bindable(default, { event })`).
- Uncontrolled: the core commits the change. Controlled: the core only calls
  `onChange` and reads the value back from props on the next render. Never
  assume a requested change took effect.
- The core reads props only through getters and never keeps a copy.

### Store

- One store per instance (`createStore` in `runtime/store.ts`). The snapshot
  is a version counter. There is no fine-grained tracking.
- `setProps()` is silent: it stores props and never notifies, because
  notifying during a React render triggers React's update-while-rendering
  warning. Adapters call `service.sync()` afterwards (React: layout effect
  after commit; elements: `attributeChangedCallback`), which runs watchers for
  whatever props changed.
- Every handler returned by `connect()` runs inside `store.batch()`, so one
  action notifies once.
- `ctx.watch(read, cb)` compares with `Object.is` after each flush.
  `ctx.memo(deps, compute)` caches by explicit dependencies.
- `ctx.effect()` and `ctx.watch()` run only between `start()` and `stop()`,
  never on the server. `start()` and `stop()` are idempotent and restartable
  (React StrictMode mounts twice).

### Part props

`connect()` returns framework-neutral part props:

```ts
type PartProps = {
  attrs: Record<string, string | undefined>; // ARIA values as strings; undefined removes
  on?: Partial<Record<keyof HTMLElementEventMap, (event: Event) => void>>; // DOM event names
  style?: Record<`--${string}`, string>; // CSS custom properties only
};
```

The DOM-free runtime defines this type without DOM types (generic over the
event type); the DOM-typed version lives in `dom/`.

- ARIA values are always strings: `'true'`/`'false'`, never booleans.
- Event names are DOM names: `click`, `keydown`, `focusin`, `focusout`,
  `input`. Use `focusin`/`focusout` for focus entering or leaving a subtree.
- Handlers read only native events. The React adapter passes
  `event.nativeEvent` and maps names (`focusin` → `onFocus`, `click` →
  `onClick`, `input` → `onChange`, `class` → `className`, `for` → `htmlFor`,
  `tabindex` → `tabIndex`).
- Every part carries `data-scope` (component name), `data-part` and its state
  attributes (`data-state`, `data-disabled`, …).

### DOM, lifecycle and SSR

- Nothing touches `document` or `window` at module scope. Every entry has a
  Node import test (`ssr-safety.test.ts`).
- ARIA relationships use stable ids from the adapter (`useId` in React).
  Consumers can override every id.
- Document, window and root node come from `ctx.env`, so components work in
  shadow roots and iframes.
- Global singletons (layer stack, focus-visible modality) are keyed on
  `Symbol.for('@tenphi/sous/…')` so duplicate installs share one instance.

### Overlays and positioning

- Overlays use the top layer (Popover API, `<dialog>`); nothing moves nodes
  into a portal.
- Nested overlays coordinate through the global layer stack. Never call
  `stopPropagation` or `stopImmediatePropagation` in components (ESLint
  enforces it).
- Positioning uses CSS anchor positioning where the browser supports it, with
  `@floating-ui/dom` as the fallback behind one wrapper in `dom/`. The fallback
  is removed once anchor positioning is Baseline widely available.

### Collections

- Items are data: `items` plus `getKey`, `getTextValue`, `isDisabled`. Never
  derive collections from children in the core.
- Item part props are computed lazily per item (`getItemProps(key)`), never
  for every row at once.
- Virtualization reuses `@tanstack/virtual-core` if it works with lazy item
  props in both adapters; otherwise ask the owner before building one.

### Custom elements (light DOM)

- No shadow DOM, no Lit. `defineElement` creates element classes inside the
  call, never at module scope.
- The element never creates, moves or removes nodes it did not create.
  Anything it must create (a live region) goes outside the consumer's tree.
- Attribute ownership is per part: the element owns ARIA state and
  `data-state`; the consumer owns content, classes and every other attribute.
  A part can be declared element-owned (Select's displayed value): the
  consumer leaves it empty and the element writes its text.
- Parts are resolved by event delegation (`event.target.closest('[data-part]')`),
  a query that stops at nested instances, and a `MutationObserver` for parts
  added later.
- State goes in through properties and out through events: the `open`
  property means controlled, the `default-open` attribute means uncontrolled,
  and changes come out as `openchange` with the value in `detail`.
- Properties set before upgrade are re-applied on upgrade. Registration is
  skipped when the name is already defined.
- A host never sits between `<table>` and `<tr>`, inside `<ul>` or inside
  `<select>`.

### Dependencies

Small utilities are built in-house; only large, domain-heavy packages are
reused. The approved runtime dependencies are:

| Package                     | Used for                                                 |
| --------------------------- | -------------------------------------------------------- |
| `@internationalized/number` | Locale-aware number parsing and formatting (NumberInput) |
| `@internationalized/date`   | Calendars and date math (later date components)          |
| `@floating-ui/dom`          | Positioning fallback, behind the `dom/` wrapper only     |
| `@tanstack/virtual-core`    | Virtualization, if it fits (see Collections)             |

Approved development dependencies for testing: `@guidepup/virtual-screen-reader`,
`@guidepup/guidepup`, `@guidepup/playwright`. **Any other dependency needs the
owner's approval**, including small utility packages, Lit, state libraries
(nanostores, signals) and Zag.js packages.

## Component workflow

One component per task, small pull requests, in this order:

1. **Spec.** Copy `docs/component-spec-template.md` to
   `packages/sous/src/components/<name>/spec.md` and fill it in. Open a pull
   request with only the spec. Do not go further until the owner sets its
   status to `approved`.
2. **Conformance scenarios.** Written from the approved spec in
   `conformance/src/<name>/`, in a pull request of their own, including
   spoken-output checks with the virtual screen reader.
3. **Definition.** `packages/sous/src/components/<name>/`, iterated until the
   scenarios pass in both adapters. Register the subpath in three places:
   `tsdown.config.ts` entry, `package.json` `exports`, and
   `src/ssr-safety.test.ts`.
4. **Adapters and docs.** Element registering entry, React sugar only if
   needed, docs and a demo per adapter.

Naming: folder and subpath in kebab-case (`checkbox-group`,
`@tenphi/sous/checkbox-group`); definition export in camelCase
(`checkboxGroup`); `name: 'checkbox-group'`; element `<sous-checkbox-group>`.
The cuisine theme stays in the brand only — APIs get descriptive names.

First scope, in roadmap order: Button, Field, TextInput, TextArea, Checkbox,
CheckboxGroup, Switch, RadioGroup → Popover, NumberInput → Listbox, Select,
ComboBox.

## Conformance

- Conformance scenarios are the oracle. An agent never edits a scenario to
  make an implementation pass.
- Scenarios and implementation never change in the same pull request. CI
  (`scripts/check-conformance-separation.mjs`) fails a pull request that
  touches both `conformance/` and non-test files under `packages/*/src/`. Only
  the owner may override it, with the `conformance-approved` label.
- If a scenario looks wrong, stop and describe the problem to the owner; do
  not work around it.

## Testing

- Tests live next to the code: `*.test.ts(x)` runs in Node with no DOM;
  `*.browser.test.ts(x)` runs in Chromium, Firefox and WebKit.
- Import test functions explicitly from `vitest`; there are no globals.
- Interactions are tested in real browsers, not in a simulated DOM.
- Spoken output is checked with `@guidepup/virtual-screen-reader` on every
  pull request. Real screen readers (VoiceOver, NVDA through Guidepup) run in
  a nightly workflow that is not set up yet.
- If one engine fails to launch locally, run the others by project name
  (`browser (chromium)`, `browser (webkit)`) and rely on CI for the rest.

## Code conventions

- Each module starts with a JSDoc block stating its responsibility (and the
  design decision it implements, if any). Keep it in sync with behavior.
- Functional style: factories and plain objects. The only classes are custom
  element classes created inside `defineElement`.
- `consistent-type-imports`; extensionless relative imports.
- Unused variables prefixed with `_` are allowed.
- Comments explain why, not what.
- Public exports are deliberate: export from an entry's `index.ts` only what
  consumers need.

## Stop and ask the owner

Before any of these, stop and ask in the pull request or the conversation:

- Starting a component without an approved spec.
- Any change to `conformance/`.
- Changing the runtime contract (`defineComponent`, bindables, store, part
  props) or the custom-element contract.
- Adding a dependency not in the approved list.
- Changing `eslint.config.js` boundary rules, `tsconfig.core.json`,
  `types/host.d.ts`, `pnpm-workspace.yaml` or anything in `scripts/` and
  `.github/`.
- Deviating from the WAI-ARIA Authoring Practices pattern for a component.
- Anything that contradicts this file.

## Reference material

- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/) —
  the pattern each component follows.
- [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/),
  [HTML-AAM](https://www.w3.org/TR/html-aam-1.0/),
  [Accessible Name Computation](https://www.w3.org/TR/accname-1.2/).
- [Guidepup](https://www.guidepup.dev) for screen-reader testing.

### Reference repos

`references/` holds shallow clones of related projects so agents can read
their source and tests locally. It is gitignored and nothing in the build,
lint or tests touches it. Run `pnpm references` to clone or update all of
them, or `pnpm references zag virtual` for some. Updating resets each clone to
its latest default branch and discards local changes, so never edit them.

| Folder                  | Repository                                                                          | License                   | Look at                                                                                                                                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cube-ui-kit`           | [cube-js/cube-ui-kit](https://github.com/cube-js/cube-ui-kit)                       | MIT                       | The owner's React design system and Sous's first consumer. `src/components/` (fields, overlays, collections) shows the APIs Sous has to serve.                                                       |
| `react-spectrum`        | [adobe/react-spectrum](https://github.com/adobe/react-spectrum)                     | Apache 2.0                | `packages/@react-aria/*` (interactions, focus, overlays, selection, listbox, combobox, numberfield) and `packages/@react-stately/*`: interaction edge cases, mobile screen readers, and their tests. |
| `zag`                   | [chakra-ui/zag](https://github.com/chakra-ui/zag)                                   | MIT                       | `packages/machines/*` for framework-agnostic component logic, `packages/core` and `packages/store` for runtime ideas, `packages/frameworks/*` for adapters.                                          |
| `virtual`               | [TanStack/virtual](https://github.com/TanStack/virtual)                             | MIT                       | `packages/virtual-core`, the virtualization candidate (see Collections).                                                                                                                             |
| `floating-ui`           | [floating-ui/floating-ui](https://github.com/floating-ui/floating-ui)               | MIT                       | `packages/dom`, the positioning fallback.                                                                                                                                                            |
| `aria-practices`        | [w3c/aria-practices](https://github.com/w3c/aria-practices)                         | W3C Software and Document | `content/patterns/<pattern>/`: the APG pattern text and its working examples, which each spec follows.                                                                                               |
| `virtual-screen-reader` | [guidepup/virtual-screen-reader](https://github.com/guidepup/virtual-screen-reader) | MIT                       | `src/`, to understand the spoken output that pull-request tests assert.                                                                                                                              |

- Read them for behavior, edge cases and test ideas, then write Sous code
  from the approved spec. Never import from `references/`, add it to a
  tsconfig or build config, or copy files wholesale.
- Code adapted from a reference keeps its license notice in the file header
  (Apache 2.0 for React Aria, the MIT notice for the others).
- The clones track default branches, not the versions Sous installs. For the
  exact behavior of a dependency, read it in `node_modules`.
- To add a repository, add it to `scripts/fetch-references.mjs` and this
  table, with the owner's approval.

## Not set up yet

Planned by the design, added when the owner asks: public API reports (API
Extractor), size budgets per subpath (size-limit), the release workflow (npm
trusted publishing), the nightly real-screen-reader workflow, Custom Elements
Manifest generation, and demo pages.

## Before pushing changes

Follow [`.cursor/commands/submit-changes.md`](.cursor/commands/submit-changes.md).
At minimum:

1. `pnpm hygiene` — lint, format check, typecheck. Fix errors before going on.
2. `pnpm test` — all projects pass.
3. **Changeset** for any user-visible change to a published package.
4. **Commit** with Conventional Commits (`feat`, `fix`, `refactor`, `test`,
   `docs`, `chore`, `perf`, `ci`); scope is the component or layer
   (`feat(checkbox): …`, `fix(runtime): …`).
5. **Push** — never to `main`. Work on a branch and open a pull request with
   `gh pr create`.
