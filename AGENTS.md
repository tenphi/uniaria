# AGENTS.md — Sous

Sous is a framework-agnostic headless UI library. Component behavior (state,
keyboard, focus, ARIA, dismissal, selection) is written once in plain
TypeScript; thin adapters bind it to React and to light-DOM custom elements.
Internal state changes never re-render a framework component: they go straight
to the DOM, and a component re-renders only for state it reads explicitly.
This is the reason Sous exists.
Styling is out of scope: every part exposes `data-scope`, `data-part` and state
attributes for the design system to target. The only CSS Sous ships is
behavioral: `dom/` adopts `touch-action: pan-x pan-y pinch-zoom` for pressable
parts.

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
| `@tenphi/sous-react`       | `packages/sous-react`    | Generic `useComponent(definition, props)` and `useComponentState(instance, selector)`; peer `react` ≥ 18                    | Yes       |
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

| Command                                          | Description                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `pnpm install`                                   | Install. Versions younger than 14 days are refused on purpose.                             |
| `pnpm build`                                     | Build every published package with tsdown (ESM, `.d.ts`, sourcemaps).                      |
| `pnpm test`                                      | All tests: `node` project, then `browser` (Chromium, Firefox, WebKit).                     |
| `pnpm test:node`                                 | Only the DOM-free tests.                                                                   |
| `pnpm test:browser`                              | Only the browser tests.                                                                    |
| `pnpm vitest run --project "browser (chromium)"` | One browser engine.                                                                        |
| `pnpm test:setup`                                | Install the Playwright browsers.                                                           |
| `pnpm typecheck`                                 | Type-check every package, including the DOM-free core config.                              |
| `pnpm lint` / `pnpm lint:fix`                    | ESLint, including architecture boundaries.                                                 |
| `pnpm format` / `pnpm format:check`              | Prettier.                                                                                  |
| `pnpm hygiene`                                   | Lint, format check and typecheck in one go.                                                |
| `pnpm check:conformance`                         | Check that no unpushed commit changes both conformance and implementation. CI runs it too. |
| `pnpm references [name ...]`                     | Clone or update the reference repos (see Reference repos).                                 |
| `pnpm changeset`                                 | Create a changeset entry. Not used until the first release.                                |

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
- **Versioning:** Changesets with `@changesets/changelog-github`, from the
  first release on. Until then there are no changesets and no version bumps.
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

### No re-renders for internal state

- Adapters render each part once with its current part props (correct server
  HTML and first paint) plus a `ref`. After mount, the DOM binder in `dom/`,
  shared by both adapters, subscribes to the store, re-runs `connect()` after
  each flush and writes only the changed attributes to the part elements. No
  framework render happens.
- State reaches React only on demand: `useComponentState(instance, selector,
isEqual?)` reads one selected value through `useSyncExternalStore` and
  re-renders only when it changes (`Object.is` by default). Per-component
  sugar looks like `useButtonState(button, (s) => s.isPressed)`. Never
  subscribe a component to the whole store.
- Controlled props still arrive through normal renders (`setProps()`, then
  `sync()`).
- Handlers are passed as stable wrappers (same identity on every render) that
  call the handler from the latest `connect()`.
- The binder owns state attributes (ARIA state, `data-state` and other state
  attributes). Consumers don't pass them; adapters warn in development if
  they do.
- Every render reads current state, so a parent re-render writes the values
  the binder already set.
- Changing the rendered tree by state (other content, lazy mounting) needs a
  selector. Overlays use the top layer and stay mounted, so opening one
  renders nothing.

### Behavior lives in definitions

- Every component is one
  `defineComponent({ name, parts, props, setup, expose, connect })`
  definition in `packages/sous/src/components/<name>/`.
- Adapters are generic over definitions. `sous-react` and `sous-elements`
  contain no component-specific behavior, only optional thin sugar
  (`sous-elements` also has one registering entry per component).
- Composite components compose definitions with `ctx.use(def, props)`. Select
  is Listbox + Popover + trigger and ComboBox is Listbox + Popover + input, so
  there is exactly one Listbox implementation. Separate instances that work
  together (a field and its control, a radio group and its radios) link
  through `ctx.owner(def)` instead (see Composition between instances).
- `setup(ctx)` runs once per instance and returns actions. `connect()` is a
  pure function of current state that returns part props; the DOM binder runs
  it after every store flush, so keep it cheap. `expose()` returns the public
  state selectors read (`isOpen`, `isPressed`, …); it is public API, and the
  spec documents it.

### Controlled and uncontrolled values

- Every stateful value is a bindable, declared in the props schema
  (`bindable(default, { event })`).
- Uncontrolled: the core commits the change. Controlled: the core only calls
  `onChange` and reads the value back from props on the next render. Never
  assume a requested change took effect.
- The core reads props only through getters and never keeps a copy.

### Composition between instances

- A child instance (a radio, a field's control) resolves its owner (the radio
  group, the field) in this order:
  1. **Explicit link** for parts that sit apart: an id-reference attribute on
     elements, like HTML's `for` (`<sous-radio group="plan">`), resolved in
     the instance's root node; the instance itself in an `owner` prop in
     React.
  2. **React instance context.** `useComponent` provides its instance through
     a context that holds only the stable instance, so first render and SSR
     know the owner. React context crosses portals.
  3. **Nearest DOM ancestor.** The child dispatches a bubbling request event
     on connect, following the Context Community Protocol's shape
     (`references/community-protocols/proposals/context.md`). An owner that
     connects later announces itself and waiting children ask again.
- React contexts carry instances, never state. A context value that changes
  is a bug.
- State flows between stores: `ctx.owner(def)` returns the owner's actions
  and exposed state and subscribes the child's binder to the owner's store.
  It is `undefined` until the owner is resolved; resolving it triggers a
  flush.
- Request events are not `composed`; lookup stops at shadow roots.
- Collections stay data. Owner links are for composed components, not for
  collection items.
- Lookup code lives in `dom/`; the DOM-free runtime only sees `ctx.owner()`.
- Tests cover each path: nested, consumer portal (React), another branch,
  React child inside a custom-element owner, and an owner that connects late.

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

One component per task, small commits, in this order:

1. **Spec.** Copy `docs/component-spec-template.md` to
   `packages/sous/src/components/<name>/spec.md` and fill it in. Commit the
   spec on its own and ask the owner to review it. Do not go further until
   the owner sets its status to `approved`.
2. **Conformance scenarios.** Written from the approved spec in
   `conformance/src/<name>/`, in commits of their own, including
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

First scope, in roadmap order: Button, ToggleButton, Field, TextInput,
TextArea, Checkbox, CheckboxGroup, Switch, RadioGroup → Popover, NumberInput →
Listbox, Select, ComboBox. Button also covers navigation (link mode with
`href`); there is no separate Link component.

## Conformance

- Conformance scenarios are the oracle. An agent never edits a scenario to
  make an implementation pass.
- Scenarios and implementation never change in the same commit or pull
  request. `scripts/check-conformance-separation.mjs` fails any commit pushed
  to `main` (and any pull request) that touches both `conformance/` and
  non-test files under `packages/*/src/`. Run `pnpm check:conformance` before
  pushing. Only the owner may override it, and only on a pull request, with
  the `conformance-approved` label.
- If a scenario looks wrong, stop and describe the problem to the owner; do
  not work around it.

### The mount contract

Scenarios depend only on `@tenphi/sous-testing`; adapters implement one
function. Source: `packages/sous-testing/src/conformance/`.

- **Suites** are data: `defineConformance<Props, State>('button', ({ scenario,
group }) => …)` in `conformance/src/<name>/`. They name the component by
  string and never import a definition, so they exist before the
  implementation does. `Props` and `State` types in the suite come from the
  spec.
- **Templates** describe the consumer's markup adapter-neutrally:
  `h('button', { part: 'root', class: 'x' }, 'Save')`. `part` names the Sous
  part; every other key is a consumer-owned attribute.
- **Adapters** implement `mount(request)`: render the template (React spreads
  part props onto it; custom elements wrap it in `<sous-<name>>`), apply props
  the way their consumers do, call `record()` for component events, and
  return `setProps`, `state` (what `expose()` returns), `renderCount` (React
  renders of the owning component; 0 for elements) and `unmount`. Attribute
  changes must be visible as soon as the interaction that caused them
  resolves.
- **Events** are camelCase in scenarios (`pressStart`); the DOM event is
  lowercase (`pressstart`) and the React prop is `onPressStart`.
- **Scenarios** get `mount`, real `pointer` and `keyboard` input through
  Playwright (they can hold a button or key), and `spoken()` for the virtual
  screen reader. `mounted.part(name)` finds
  `[data-scope][data-part]` and fails loudly when either is missing.
- **Phases.** A scenario declares the roadmap phase whose features it needs
  (`{ phase: 2 }`); an adapter run declares the phase it has reached
  (`runConformance(adapter, suites, { phase: 1 })`) and later scenarios are
  skipped, not failed.

## Testing

- Tests live next to the code: `*.test.ts(x)` runs in Node with no DOM;
  `*.browser.test.ts(x)` runs in Chromium, Firefox and WebKit.
- Import test functions explicitly from `vitest`; there are no globals.
- Interactions are tested in real browsers, not in a simulated DOM.
- React tests count renders: an internal interaction (hover, press, focus,
  highlight, opening an overlay) re-renders the owning component zero times.
- Spoken output is checked with `@guidepup/virtual-screen-reader` in CI on
  every push. Real screen readers (VoiceOver, NVDA through Guidepup) run in
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

Before any of these, stop and ask the owner in the conversation:

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

| Folder                    | Repository                                                                                      | License                   | Look at                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cube-ui-kit`             | [cube-js/cube-ui-kit](https://github.com/cube-js/cube-ui-kit)                                   | MIT                       | The owner's React design system and Sous's first consumer. `src/components/` (fields, overlays, collections) shows the APIs Sous has to serve.                                                                                                                                                                   |
| `react-spectrum`          | [adobe/react-spectrum](https://github.com/adobe/react-spectrum)                                 | Apache 2.0                | `packages/react-aria/src/<area>` (interactions, focus, button, overlays, selection, listbox, combobox, numberfield), `packages/react-stately/src/<area>` and `packages/react-aria/test`: interaction edge cases, mobile screen readers, and their tests. `packages/@react-aria/*` are only re-export shells now. |
| `zag`                     | [chakra-ui/zag](https://github.com/chakra-ui/zag)                                               | MIT                       | `packages/machines/*` for framework-agnostic component logic, `packages/core` and `packages/store` for runtime ideas, `packages/frameworks/*` for adapters.                                                                                                                                                      |
| `virtual`                 | [TanStack/virtual](https://github.com/TanStack/virtual)                                         | MIT                       | `packages/virtual-core`, the virtualization candidate (see Collections).                                                                                                                                                                                                                                         |
| `floating-ui`             | [floating-ui/floating-ui](https://github.com/floating-ui/floating-ui)                           | MIT                       | `packages/dom`, the positioning fallback.                                                                                                                                                                                                                                                                        |
| `aria-practices`          | [w3c/aria-practices](https://github.com/w3c/aria-practices)                                     | W3C Software and Document | `content/patterns/<pattern>/`: the APG pattern text and its working examples, which each spec follows.                                                                                                                                                                                                           |
| `virtual-screen-reader`   | [guidepup/virtual-screen-reader](https://github.com/guidepup/virtual-screen-reader)             | MIT                       | `src/`, to understand the spoken output that pull-request tests assert.                                                                                                                                                                                                                                          |
| `community-protocols`     | [webcomponents-cg/community-protocols](https://github.com/webcomponents-cg/community-protocols) | None stated               | `proposals/context.md`: the Context Community Protocol, where a child finds its nearest provider through a DOM event, including providers that connect later.                                                                                                                                                    |
| `lit`                     | [lit/lit](https://github.com/lit/lit)                                                           | BSD 3-Clause              | `packages/context`, the reference implementation of that protocol. Patterns only: Lit is not a dependency.                                                                                                                                                                                                       |
| `lion`                    | [ing-bank/lion](https://github.com/ing-bank/lion)                                               | MIT                       | `packages/ui/components/form-core/src/registration/`: children register with their parent through DOM events, and `FormRegistrarPortalMixin` covers children rendered in another branch. Also fieldsets and choice groups.                                                                                       |
| `spectrum-web-components` | [adobe/spectrum-web-components](https://github.com/adobe/spectrum-web-components)               | Apache 2.0                | `1st-gen/packages/overlay`, where `<sp-overlay trigger="id@click">` links a trigger in another branch by id, and `1st-gen/tools/reactive-controllers` (roving tabindex, focus groups).                                                                                                                           |
| `catalyst`                | [github/catalyst](https://github.com/github/catalyst)                                           | MIT                       | `src/`: GitHub's light-DOM elements, which wire children and events with `data-target` and `data-action` instead of shadow DOM.                                                                                                                                                                                  |
| `auto-complete-element`   | [github/auto-complete-element](https://github.com/github/auto-complete-element)                 | MIT                       | `src/`: a light-DOM element linked to its popup list by id (`for`), the id-reference pattern for parts in another branch.                                                                                                                                                                                        |

- Read them for behavior, edge cases and test ideas, then write Sous code
  from the approved spec. Never import from `references/`, add it to a
  tsconfig or build config, or copy files wholesale.
- Code adapted from a reference keeps its license notice in the file header
  (Apache 2.0 for React Spectrum and Spectrum Web Components, BSD for Lit,
  MIT for the others).
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

Until the first release, work goes straight to `main`: no branches, pull
requests or changesets. Follow
[`.cursor/commands/submit-changes.md`](.cursor/commands/submit-changes.md). At
minimum:

1. `pnpm hygiene` — lint, format check, typecheck. Fix errors before going on.
2. `pnpm test` — all projects pass.
3. **Commit** with Conventional Commits (`feat`, `fix`, `refactor`, `test`,
   `docs`, `chore`, `perf`, `ci`); scope is the component or layer
   (`feat(checkbox): …`, `fix(runtime): …`). Conformance scenarios and
   implementation go in separate commits.
4. `pnpm check:conformance` — no unpushed commit touches both.
5. **Push** to `main` and make sure CI passes; fix a failure in a follow-up
   commit.
