---
title: Testing
description: Node and browser tests, conformance scenarios, render counts, and spoken output from virtual and real screen readers.
---

Behavior is tested in real browsers, not in a simulated DOM. Logic that
needs no DOM is tested in Node. Every component has conformance scenarios
that every adapter must pass (TextInput, which has no element, through
TextField's), and they check what a screen reader says as well as what the
DOM holds.

The rules are in the
[root `AGENTS.md`](https://github.com/tenphi/uniaria/blob/main/AGENTS.md)
(Conformance, Testing) and in
[`packages/testing/AGENTS.md`](https://github.com/tenphi/uniaria/blob/main/packages/testing/AGENTS.md).

## Where tests live

Tests sit next to the code they test, and the file name picks the Vitest
project that runs them (`vitest.config.ts`):

| File name                    | Project          | Runs in                                                                                               |
| ---------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `*.test.ts(x)`               | `node`           | Node, with no DOM: a DOM access fails with `document is not defined`.                                 |
| `*.browser.test.ts(x)`       | `browser`        | Real Chromium, Firefox and WebKit through Playwright, headless.                                       |
| `*.screen-reader.test.ts(x)` | `screen-readers` | Headed Chromium with VoiceOver or NVDA. The project exists only when `UNIARIA_SCREEN_READERS` is set. |

The `node` and `browser` projects pick up files under `packages/*/src/` and
`conformance/src/`; the `screen-readers` project, files under
`packages/*/src/`. Import test functions from `vitest` explicitly; there are
no globals. Workspace packages resolve each other's sources, so no build is
needed first.

- **Node:** the runtime, collections, behavior definitions driven through
  `createInstance` (call actions and part handlers, read `attrs` and
  `getState()`), server rendering with `renderToString`, and the
  `ssr-safety.test.ts` files of `@uniaria/core` and the adapters, which
  import every entry without a DOM.
- **Browser:** anything that renders, touches the DOM, moves focus or
  listens to a screen reader. The interactions in `dom/` have their own
  `*.browser.test.ts` files, and the adapters have theirs: render counts,
  StrictMode in React, `<KeepAlive>`, `<Teleport>` and compiled templates in
  Vue, hydration, owner lookup, and custom elements mounted inside React and
  Vue to prove they never fight over nodes.

## Running tests

```sh
pnpm test                                        # node, then browser
pnpm test:node                                   # only the DOM-free tests
pnpm test:browser                                # all three engines
pnpm vitest run --project "browser (chromium)"   # one engine
pnpm test:watch                                  # watch mode
```

Vitest's own arguments narrow a run further: a file path, or `-t` with part
of a test's name. Conformance tests are named after the suite and the
adapter, such as `checkbox (react)`:

```sh
pnpm vitest run --project "browser (webkit)" packages/react/src/conformance.browser.test.ts -t "checkbox (react)"
```

If one engine fails to launch on your machine, run the others by project
name (`browser (chromium)`, `browser (firefox)`, `browser (webkit)`) and rely
on CI for the rest.

## Conformance

Conformance scenarios in `conformance/src/<name>/` describe a component's
behavior once, and every adapter must pass them: the DOM, keyboard behavior,
focus movement, events, public state, render counts and spoken output.

### Scenarios are the oracle

An agent never edits a scenario to make an implementation pass. Scenarios
come from an approved spec, and every change to `conformance/` needs the
owner's approval. If a scenario looks wrong, stop and describe the problem to
the owner; don't work around it.

### The separation check

Scenarios and implementation never change in the same commit or pull
request, so a failing test can't be made to pass by editing the test.
`scripts/check-conformance-separation.mjs` fails any commit that touches both
`conformance/` and non-test files under `packages/*/src/`; test files
(`*.test.ts(x)`) don't count as implementation.

- `pnpm check:conformance` checks your unpushed commits
  (`origin/main..HEAD`). Run it before pushing.
- CI checks every commit a push to `main` adds, and a pull request's whole
  diff. Only the owner can override it, only on a pull request, with the
  `conformance-approved` label.

### The mount contract

Scenarios depend only on `@uniaria/testing`, and each adapter implements one
function. The source is `packages/testing/src/conformance/`.

- **Suites are data.** `defineConformance<Props, State>('button', ({ scenario, group }) => …)`
  names the component by string and never imports a definition, so it exists
  before the implementation does. `Props` and `State` come from the spec, in
  the suite's `types.ts`.
- **Templates** describe the consumer's markup without a framework:
  `h('button', { part: 'root', class: 'x' }, 'Save')`. `part` names the
  UniAria part; every other key is an attribute the consumer owns.
  `nested('checkbox', { value: 'email' }, …)` puts another component inside,
  and `rows()` renders a virtualized list's rows from its state.
- **Adapters implement `mount(request)`.** They render the template, apply
  props the way their consumers do, call `record()` for the component's own
  events, and return `setProps`, `state` (what `expose()` returns),
  `renderCount` and `unmount`. Attribute changes must be visible as soon as
  the interaction that caused them resolves.
- **Scenarios get a context:** `mount`, real `pointer` and `keyboard` input
  through Playwright (they can hold a button or a key), `touch`, `spoken()`
  and `listen()` for the virtual screen reader, and `screenReader` for a real
  one. `mounted.part(name)` finds the root by `data-uni`, a part outside
  the root by `data-uni-part` and any other part by `data-element` inside
  the root (`partSelector()`), and fails loudly when the marker is missing.
- **Events** are camelCase in scenarios (`pressStart`); the DOM event is
  lowercase (`pressstart`) and the React prop is `onPressStart`.

Real input goes through Playwright commands (`uniCommands`, registered in the
`browser` project), never through a synthetic `dispatchEvent`, so scenarios
see the browser's own event sequences. Touch goes through DevTools, which
only Chromium takes: scenarios that touch declare `needs: ['touch']` and are
skipped elsewhere. Don't turn on Playwright's `hasTouch`, which would make
every test run as on a touch device.

The runner checks itself: `packages/testing/src/conformance/run.browser.test.ts`
runs it against a plain-DOM fixture adapter in every browser.

### Phases

A scenario declares the roadmap phase whose features it needs
(`{ phase: 2 }`; 1 by default). An adapter's run declares the phase it has
reached, `runConformance(adapter, suites, { phase: 5 })`, and later scenarios
are reported as skipped, not failed. Raise the phase in the adapter's
`conformance.browser.test.ts` as the roadmap advances.

### Every adapter

`packages/react/src/conformance.browser.test.ts`,
`packages/vue/src/conformance.browser.test.ts` and
`packages/elements/src/conformance.browser.test.ts` run every suite:

- **React** renders the template inside StrictMode, so every scenario also
  runs through a double mount, spreading `ui.parts.<name>` onto the part
  elements. A nested component renders with its own `useBehavior()` inside
  its owner's `OwnerProvider`.
- **Vue** renders the template with `h()` in a harness component, binding
  `ui.parts.<name>` onto the part elements as `v-bind` does. A nested
  component renders with its own `useBehavior()`, which finds the component
  around it as its owner.
- **Custom elements** render the template as plain DOM, wrap the parts in
  the component's host, `<uni-<name>>`, and set props as properties. A nested
  component's children are wrapped in its own host.

Some behavior has two paths, and scenarios cover both. Popover and Tooltip
scenarios force the fallback for browsers without the Popover API through
the development switch (`Symbol.for('@uniaria/fallbacks/v1')`), and
scenarios that place a part run in both positioning modes, `'script'` and
`'css'`.

## Render counts

An internal interaction re-renders the owning React or Vue component zero
times: hover, press, focus, highlight, opening an overlay. Conformance
scenarios check it through `renderCount()`. The React and Vue adapters count
every render of the component that owns the instance; the elements adapter
returns `0`. A
scenario reads the count, interacts, and expects the same count:

```ts
const renders = mounted.renderCount();
await keyboard.tab();
await keyboard.press('Enter');
expect(mounted.renderCount()).toBe(renders);
```

The hook tests in `packages/react/src/use-behavior.browser.test.tsx` count
renders exactly, outside StrictMode where they need to: a selector
re-renders only when its selected value changes, and a prop change renders
once. `packages/vue/src/use-behavior.browser.test.ts` does the same for
Vue.

`packages/react/src/compare/compare.browser.test.tsx` compares Button with
React Aria's: at every step of one real-input script it requires the same
state attributes and presses, and no UniAria render for interactions.
`pnpm bench` times both in a production build.

## Spoken output

Spoken output is checked with
[`@guidepup/virtual-screen-reader`](https://github.com/guidepup/virtual-screen-reader),
a simulated screen reader that reads the accessibility tree the browser
exposes. The checks are part of the `browser` project, so CI runs them on
every push to `main` and every pull request.

- `spoken()` reads the whole document and returns every phrase, from
  `document` to `end of document`, in the library's format:
  `button, Save, disabled`.
- `listen()` starts hearing live regions and returns a function that gives
  what they announced since, each phrase prefixed with its politeness:
  `assertive: Saved`. `spoken()` can't run while listening.

The spec's "Expected spoken output" section is where these checks come
from.

## Screenshots

`packages/styles/src/screenshots.browser.test.ts` compares each component
with the default styles, in every scheme and in forced colors, with
reference images in `packages/styles/src/__references__/`. Text renders
differently on every engine and OS, so the references are Chromium's on
Linux, as CI runs it, and the test skips anywhere else. A change to how a
component looks fails it in CI until the references change too; the failed
run's `failed-screenshots` artifact holds each actual image and its diff.
Remake them in Playwright's Docker image, then review the changed images and
commit them with the change:

```sh
pnpm -C packages/styles screenshots
```

The script needs Docker. It copies the working tree into the image, with
your uncommitted changes, and rewrites only the references that no longer
match. When you remove a gallery, delete its references by hand.

## Real screen readers

`.github/workflows/screen-readers.yml` runs the scenarios that need a real
screen reader: VoiceOver on macOS and NVDA on Windows, both with headed
Chromium, driven through `@guidepup/guidepup`. A scenario opts in with
`needs: ['screenReader']`; those scenarios run only in this workflow, and
only they run there. Each adapter has a `conformance.screen-reader.test.ts`
that runs them with `{ phase: 5, screenReader: true }`.

- **When.** Nightly at 03:00 UTC, and on demand from the Actions tab or with
  `gh workflow run screen-readers.yml`. A night with no new commit on `main`
  in the last day skips the run, since macOS and Windows runners cost more.
- **How.** Each job prepares the runner with `@guidepup/setup` (permissions
  and settings on macOS, NVDA's configuration on Windows), installs the
  screen reader, then runs `pnpm test:screen-readers` with
  `UNIARIA_SCREEN_READERS` set, with VoiceOver's hints turned off. The
  project runs one file at a time, retries a failed test once, and gives
  each test two minutes.
- **What a scenario can do.** `screenReader.startFrom(element)` clicks an
  element before the component and forgets what was said; `press(key)` and
  `type(text)` go through the operating system, as a user's keys would, and
  wait after each key until the reader stops speaking;
  `next()` moves the reader's own cursor; `spoken()` returns what it said
  since; `readFocus()` returns what it holds for the focused element, for
  checks where the speech on arrival is cut short. VoiceOver and NVDA word
  things differently (`checkbox` and `check box`), so scenarios match what
  they need to hear, not whole phrases.
- **Writing a new scenario.** Run the workflow by hand with its `discover`
  input turned on. It sets `UNIARIA_SCREEN_READERS=discover`, and the run
  logs what the screen reader holds for the focus after each key.

**Never run it locally.** Preparing a machine for Guidepup changes its
privacy and screen-reader settings, and a run takes over the machine's
screen reader and keyboard. Check a change with a manual run of the workflow
instead.
