---
title: Component workflow
description: From spec to conformance scenarios to definition to adapters and docs, and the rules around them.
---

A component is one task, built in small commits, in this order:

1. **Spec.** What the component does, approved by the owner before anything
   else.
2. **Conformance scenarios.** The tests every adapter must pass, written from
   the spec.
3. **Definition.** The behavior, iterated until the scenarios pass in both
   adapters.
4. **Adapters and docs.** The element entry, React sugar if it is needed, and
   the component's page with a live demo.

The binding version of this workflow is in the
[root `AGENTS.md`](https://github.com/tenphi/uniaria/blob/main/AGENTS.md)
(Component workflow, Conformance, Stop and ask the owner, Dependencies).

## 1. Spec

Copy
[`docs/_internal/component-spec-template.md`](https://github.com/tenphi/uniaria/blob/main/docs/_internal/component-spec-template.md)
to `packages/core/src/components/<name>/spec.md` and fill it in:

| Section                              | What it settles                                                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Summary                              | What the component is for, the native element underneath, the WAI-ARIA pattern, what it builds on (`ctx.use()`, `dom/`), its owner, and whether it gets a custom element. |
| Anatomy                              | The parts, their elements and the attributes UniAria owns on each. Element-owned parts, whose content UniAria writes, are marked.                                         |
| Props                                | Type, default, whether it is bindable and its change event.                                                                                                               |
| Public state                         | What `expose()` returns. Selectors read it, so it is public API: adding a field is a feature, changing one is a breaking change.                                          |
| Keyboard                             | Each key, where it applies, and what it does.                                                                                                                             |
| ARIA and state attributes per state  | The attributes on each part in each state.                                                                                                                                |
| Focus                                | Where focus goes on open, close, selection and dismissal, and what restores it.                                                                                           |
| Pointer and touch                    | Press behavior, press and hold, outside interaction, hover.                                                                                                               |
| Styling tokens                       | What the consumer's CSS can bind to: state attributes, CSS variables and public state. Tokens, never a look; styles UniAria writes only where a behavior needs them.      |
| Expected spoken output               | What the virtual screen reader should announce in the main flows. These become conformance checks.                                                                        |
| Deviations from the WAI-ARIA pattern | None, or each one with its reason.                                                                                                                                        |
| Open questions                       | Questions for the owner.                                                                                                                                                  |

Then:

- **Commit the spec on its own and ask the owner to review it.** Do not go
  further until the owner sets its status line to
  `Status: approved by @tenphi on <date>`. A spec with open questions is not
  approved; the owner's answers go under a Resolved questions section, which
  the code cites by number.
- **Complex components start from Cube UI Kit**, not React Aria: the
  overlays and collections (Dialog, Popover, Tooltip, Listbox, Select,
  Combobox). Cube UI Kit is UniAria's first consumer, and it replaced React
  Aria patterns that hurt its users: its ComboBox is its own implementation,
  and one click outside a popover acts. Read the component's source, tests
  and docs in `references/cube-ui-kit`, and list in the spec every place it
  differs from React Aria or the APG, with the reason. The owner decides each
  one. React Aria stays the reference for browser and assistive-technology
  edge cases.
- **Interactions** have a catalogue: before building or changing one in
  `dom/`, read its section of `docs/_internal/interaction-layer.md` (the
  behaviors, the browser bugs, where UniAria differs) and update the status
  there.

## 2. Conformance scenarios

Scenarios are written from the approved spec in `conformance/src/<name>/`, in
commits of their own:

- `types.ts` declares the suite's `Props` and `State` types from the spec,
  not from a definition, so the suite exists before the implementation does.
- `<name>.conformance.ts` defines the suite with
  `defineConformance<Props, State>('<name>', …)`, mirroring the spec's
  keyboard map and ARIA table, and including spoken-output checks with the
  virtual screen reader.
- `conformance/src/index.ts` exports the suite and adds it to `suites`, which
  every adapter's conformance run reads.

Every change under `conformance/` needs the owner's approval, and no commit
or pull request changes both `conformance/` and implementation under
`packages/*/src/`. Scenarios never import a definition or an adapter. See
[Testing](./testing.md#conformance) for the mount contract, phases and the
checks CI runs.

## 3. Definition

The definition lives in `packages/core/src/components/<name>/`: the
definition module, an `index.ts` that exports it with its `<Name>Props` and
`<Name>State` types (`PropsOf` and `StateOf`), and its unit tests. Each
module starts with a JSDoc block stating its responsibility and the design
decision it implements.

- **Iterate until the scenarios pass in both adapters.** Never edit a
  scenario to make the implementation pass. If a scenario looks wrong, stop
  and describe the problem to the owner.
- **Compose, don't duplicate.** A composite component composes other
  definitions with `ctx.use()`; separate instances link through owners. See
  [Architecture](./architecture.md#composition).
- **Register the subpath in three places:** an entry in
  `packages/core/tsdown.config.ts`, an `exports` entry in
  `packages/core/package.json` with the `uniaria-source` condition first,
  and a line in `packages/core/src/ssr-safety.test.ts`.
- **Make it known to both conformance runs:** add the definition to the
  `definitions` map in `packages/react/src/conformance-adapter.tsx`, and
  import its element entry in `packages/elements/src/conformance-adapter.ts`.
  Each adapter's `conformance.browser.test.ts` runs suites up to the roadmap
  phase it declares; raise it as the roadmap advances.

## 4. Adapters and docs

- **Element entry.** `packages/elements/src/<name>.ts` calls
  `defineElement(definition)` with the default `uni-` prefix, exports the
  class and its element type, and declares the tag in
  `HTMLElementTagNameMap`. Like a core subpath it needs an entry in
  `tsdown.config.ts`, an `exports` entry and a line in
  `src/ssr-safety.test.ts`, plus a place in `sideEffects` in
  `packages/elements/package.json`, because importing it registers the
  element.
- **React sugar** only if it is needed. `@uniaria/react` holds no
  component-specific behavior; sugar may only wrap `useComponent` and
  `useComponentState`.
- **Docs.** A page in `docs/components/<name>.mdx` with a live demo, listed
  in the site's navigation. See [Documentation](./documentation.md).

## Naming

| What                           | Rule                                        | Example                                                         |
| ------------------------------ | ------------------------------------------- | --------------------------------------------------------------- |
| Folder and subpath             | kebab-case                                  | `checkbox-group`, `@uniaria/core/checkbox-group`                |
| Definition export              | camelCase                                   | `checkboxGroup`                                                 |
| Definition `name`              | kebab-case; becomes `data-scope`            | `name: 'checkbox-group'`                                        |
| Element                        | `uni-` plus the name                        | `<uni-checkbox-group>`                                          |
| Root part's class              | `uni-` plus the name                        | `class="uni-checkbox-group"`                                    |
| Part names                     | camelCase; `data-element` capitalizes them  | `hiddenInput`, `data-element="HiddenInput"`                     |
| A name that is a reserved word | A descriptive export instead                | `toggleSwitch` for `name: 'switch'`                             |
| Booleans                       | Predicates                                  | `isDisabled`, `isOpen`, `shouldPreventFocusOnPress`, `hasArrow` |
| Events                         | camelCase; DOM lowercase; React `on` + name | `pressStart`, `pressstart`, `onPressStart`                      |
| Bindable change events         | `<name>Change`, without the `is` prefix     | `isOpen` → `openChange`, seeded by `defaultOpen`                |

- **Booleans read as predicates** everywhere, in public API and inside the
  code: `is…` for states; `should…`, `has…`, `allows…` or `can…` for
  behavior. That covers props, public state, options, variables, parameters
  and functions that return booleans. Names the DOM defines stay as they are
  (`shiftKey`, the `disabled` attribute).
- **The brand stays out of APIs.** Exports get descriptive names.
- **No near-duplicate components.** Button covers links (link mode with
  `href`). A Field plus a text control is `<Name>Field` (TextField,
  NumberField), and TextField covers `<textarea>` too.

## Stop and ask the owner

Before any of these, stop and ask the owner in the conversation:

- Starting a component without an approved spec.
- Any change to `conformance/`.
- Changing the runtime contract (`defineComponent`, bindables, the store,
  part props) or the custom-element contract.
- Adding a dependency that isn't on the approved list.
- Changing the boundary rules in `eslint.config.js`, `tsconfig.core.json`,
  `types/host.d.ts`, `pnpm-workspace.yaml`, or anything in `scripts/` or
  `.github/`.
- Deviating from the WAI-ARIA Authoring Practices pattern for a component.
- Anything that contradicts `AGENTS.md`.

## Dependencies

Small utilities are built in-house; only large, domain-heavy packages are
reused. The approved runtime dependencies:

| Package                     | Used for                                                 |
| --------------------------- | -------------------------------------------------------- |
| `@internationalized/number` | Locale-aware number parsing and formatting (NumberField) |
| `@internationalized/date`   | Calendars and date math, for later date components       |
| `@tanstack/virtual-core`    | Virtualization, bundled into `@uniaria/core/virtual`     |

`@tanstack/virtual-core` is a development dependency, pinned to one exact
version and bundled into `@uniaria/core/virtual` with its development checks
compiled out. Upgrade it by hand once a newer release passes the 14-day
release-age policy and the virtualization scenarios.

The approved development dependencies for testing are
`@guidepup/virtual-screen-reader`, `@guidepup/guidepup`,
`@guidepup/playwright`, and `react-aria` in `@uniaria/react`, used only for
the comparison with React Aria. **Any other dependency needs the owner's
approval**, including small utility packages, Lit, state libraries
(nanostores, signals) and Zag.js packages.

The web platform has a policy too. Use only features that are Baseline
widely available. A newer feature is allowed only behind feature detection
with a fallback that keeps the behavior working, or behind a page-wide
setting the consumer opts into (`configure()`, such as CSS mode for
positioning). Check a feature with the `web-features` development
dependency:

```sh
node -e "import('web-features').then(({features: f}) => console.log(f['popover'].status))"
```

`baseline: 'high'` is widely available; `'low'` and `false` need the
fallback. A feature's `status.by_compat_key` covers its single APIs, which
can lag the feature.
