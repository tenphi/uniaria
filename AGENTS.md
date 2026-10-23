# AGENTS.md — UniAria

UniAria is a framework-agnostic headless UI library. Component behavior (state,
keyboard, focus, ARIA, dismissal, selection) is written once in plain
TypeScript; thin adapters bind it to React, to Vue and to light-DOM custom
elements.
Internal state changes never re-render a framework component: they go straight
to the DOM, and a component re-renders only for state it reads explicitly.
This is the reason UniAria exists.
Styling is out of scope: every part exposes its part markers and state
attributes for the design system to target. UniAria is not a styling library:
the consumer's CSS comes separately and binds to the tokens UniAria provides
(state attributes, CSS variables, public state), so it can change with state.
Specs list those tokens, never a look (owner, 2026-10-16). UniAria ships CSS
only where a behavior can't work without it, and as little as possible.
Per-element rules go inline and yield to an inline value the consumer set
(press sets `touch-action: pan-x pan-y pinch-zoom` on pressable parts). A rule
that must be global is adopted as a constructed stylesheet inside an anonymous
`@layer`, so any consumer CSS wins, and only while the behavior is active.
The optional `@uniaria/styles` package (owner, 2026-10-19) gives every
component a default look, written against those same tokens; no other package
depends on it, and specs still list no look.

UniAria is built by AI agents. The owner, **@tenphi**, approves specs and reviews
APIs at phase gates. Manual screen-reader testing is deferred until the
approach proves viable (owner, 2026-10-15): no gate waits on it. Read this
whole file before changing anything; it is the binding summary of the design.

## Design source

- The full design doc lives in the owner's Claude Docs. A local snapshot may
  exist at `specs/design.md`. `specs/` is gitignored, so it may be missing in
  your checkout; never commit anything under it.
- This file is the contract for agents. If it and the design doc disagree, stop
  and ask the owner.

## Packages

| Package                | Path                | Contents                                                                                                                                                          | Published |
| ---------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| `@uniaria/core`        | `packages/core`     | Runtime (`.`), the DOM binder and interactions (`./dom`), collections (`./collections`), the virtualizer (`./virtual`), one subpath per component (`./button`, …) | Yes       |
| `@uniaria/react`       | `packages/react`    | Generic `useBehavior(definition, props)` and `useBehaviorState(instance, selector)`; peer `react` ≥ 18                                                            | Yes       |
| `@uniaria/vue`         | `packages/vue`      | The same two composables for Vue, called in `setup()`; peer `vue` ≥ 3.5; its own `spec.md`                                                                        | Yes       |
| `@uniaria/elements`    | `packages/elements` | Generic `defineElement(definition, options)`; light DOM, `uni-` prefix by default; one registering entry per component (`./button`)                               | Yes       |
| `@uniaria/testing`     | `packages/testing`  | The mount contract, the conformance runner, virtual and real screen-reader helpers; development only                                                              | Yes       |
| `@uniaria/styles`      | `packages/styles`   | Optional default styles: prebuilt CSS (`./css`), a Tasty style object per component (`./button`), the palette; its own `spec.md`                                  | Yes       |
| `@uniaria/conformance` | `conformance`       | Adapter-agnostic scenarios every adapter must pass                                                                                                                | No        |

All published packages share one version (Changesets `fixed` group). Each
package has its own short `AGENTS.md` with local rules.

## Project structure

```
uniaria/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── index.ts            Runtime public API (re-exports runtime/)
│   │   │   ├── runtime/            Store, bindables, defineBehavior, instances — DOM-free
│   │   │   ├── collections/        Keys, navigation, selection, typeahead — DOM-free
│   │   │   ├── dom/                Interaction layer and positioning
│   │   │   └── components/<name>/  spec.md, definition, tests (created per component)
│   │   ├── types/host.d.ts         Host globals the DOM-free core may use
│   │   ├── tsconfig.json           Whole package, with DOM lib
│   │   ├── tsconfig.core.json      runtime/ + collections/ without DOM lib
│   │   └── tsdown.config.ts
│   ├── react/
│   ├── vue/                        Vue adapter; spec.md there
│   ├── elements/
│   ├── testing/
│   └── styles/                     Optional default styles; spec.md there
├── conformance/                    Scenarios; owner approval required (see Conformance)
├── apps/docs/                      The documentation site (Cookbook); see Documentation
├── docs/                           The site's pages (Markdown and MDX)
│   └── _internal/                  Not published: the spec template, and
│                                   interaction-layer.md (what dom/ must do; status)
├── scripts/                        Repo checks run by CI
├── specs/                          Owner's local design notes (gitignored)
├── references/                     Read-only clones of related repos (gitignored)
├── eslint.config.js                Includes the architecture boundary rules
├── vitest.config.ts                `node` and `browser` projects
├── .size-limit.js                  Bundle sizes per entry point (`pnpm size`)
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
| `pnpm size`                                      | Build, then report each entry point's bundle size (size-limit, `.size-limit.js`).          |
| `pnpm references [name ...]`                     | Clone or update the reference repos (see Reference repos).                                 |
| `pnpm changeset`                                 | Create a changeset for a user-visible package change (Before pushing changes).             |
| `pnpm -C apps/docs dev`                          | The documentation site with live reload (see Documentation).                               |
| `pnpm -C apps/docs validate`                     | Type check, Cookbook's checks, the production build and its output checks. CI runs it.     |

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
- **Versioning:** Changesets with `@changesets/changelog-github`. Every
  user-visible change to a published package carries a changeset (Before
  pushing changes); the owner releases them in batches (Releasing).
- **Package manager:** pnpm 11 workspaces. Node ≥ 22.

Workspace packages resolve each other's `src/` through the `uniaria-source`
export condition (set in `tsconfig.base.json` and `vitest.config.ts`), so
typechecking and tests never need a build.

## Architecture rules

These are design decisions, not preferences. Changing any of them needs the
owner's approval.

### Layers

```
@uniaria/react, @uniaria/vue, @uniaria/elements  →  components/  →  dom/  →  runtime/, collections/
```

An arrow means "may import". Nothing imports upward. `runtime/` and
`collections/` compile without the DOM lib (`tsconfig.core.json`): no
`document`, `window`, `Event` or element types, as values or as types. The only
host globals allowed there are listed in `types/host.d.ts`; everything else
reaches the core through `ctx.env`. Framework imports never appear in
`@uniaria/core`. ESLint enforces the import rules.

### No re-renders for internal state

- Adapters render each part once with its current part props (correct server
  HTML and first paint) plus a `ref`. After mount, the DOM binder in `dom/`,
  shared by every adapter, subscribes to the store, re-runs `connect()` after
  each flush and writes only the changed attributes to the part elements. No
  framework render happens.
- State reaches React only on demand: `useBehaviorState(instance, selector,
isEqual?)` reads one selected value through `useSyncExternalStore` and
  re-renders only when it changes (`Object.is` by default). Per-component
  sugar looks like `useButtonState(button, (s) => s.isPressed)`. Never
  subscribe a component to the whole store. Vue's `useBehaviorState`
  returns a ref that triggers only when the selected value changes.
- Controlled props still arrive through normal renders (`setProps()`, then
  `sync()`).
- Handlers are passed as stable wrappers (same identity on every render) that
  call the handler from the latest `connect()`.
- The binder owns state attributes (ARIA state, `data-state` and other state
  attributes). Consumers don't pass them; adapters warn in development if
  they do. A part's `id` is the exception (DOM, lifecycle and SSR).
- When an element stops being a part (another element takes the part, or
  none: a nested element defined later, a renamed `data-element`, an
  unmount), the binder removes the attributes and styles it wrote there that
  still hold what it wrote, unless another part bound to the element writes
  them too. It never removes what it didn't write: the consumer's markers
  (`data-uni`, `data-uni-part`, `data-element`, `data-key`), the consumer's
  id, and
  what React or Vue rendered from the part props.
- Every render reads current state, so a parent re-render writes the values
  the binder already set.
- Changing the rendered tree by state (other content, lazy mounting) needs a
  selector. Overlays use the top layer and stay mounted, so opening one
  renders nothing.

### Behavior lives in definitions

- Every component is one
  `defineBehavior({ name, parts, props, events, setup, expose, connect })`
  definition in `packages/core/src/components/<name>/`. Its API says
  behavior, not component (owner, 2026-10-23): in React and Vue a component
  is what renders, and a definition renders nothing, so the names for it and
  for what runs it (`defineBehavior`, `useBehavior`, `BehaviorHandle`) never
  say component.
- The schema is the one source for adapter props, element attributes and
  events: `prop(default, options?)` for plain values, `bindable(default,
{ event? })` for stateful ones, and `event<Detail>()` under `events` for
  what the component reports. Options: `attribute` (the element attribute;
  `false` for a property only), `type` (attribute conversion, inferred from
  the default), `adopt` (an element reads an unset prop from a part's tag,
  attribute or live DOM property, like Button's `elementType` and `href` and
  TextField's input `value`; a bindable adopts into its `default<Key>`) and
  `idOf` (the part whose id a plain prop sets, like Field's `controlId`; see
  DOM, lifecycle and SSR).
- Event names are camelCase (`pressStart`, `openChange`): the DOM event is
  lowercase (`pressstart`) and the callback prop is `onPressStart`. A
  bindable's change event defaults to `<name>Change`, where the name drops an
  `is` prefix (`isOpen` → `openChange`, seeded by `defaultOpen`).
- Adapters are generic over definitions. `@uniaria/react`, `@uniaria/vue` and
  `@uniaria/elements` contain no component-specific behavior, only optional thin sugar
  (`@uniaria/elements` also has one registering entry per component).
- Composite components compose definitions with `ctx.use(def, props)`. Select
  is Listbox + Popover + trigger and Combobox is Listbox + Popover + input, so
  there is exactly one Listbox implementation. ToggleButton is Button plus
  selection. The composed definition runs on the same instance (store,
  lifecycle, elements), reads its props from the `props` function on every
  access (pass callbacks through to receive its events), and renders on the
  composing component's parts of the same name, or as `{ parts }` maps them.
  `expose()` and `connect()` fold in its `state()` and `connect()`. Separate instances that work
  together (a field and its control, a radio group and its radios) link
  through `ctx.owner(def)` instead (see Composition between instances).
- `setup(ctx)` runs once per instance and returns the definition's internal
  API: actions and readers that `expose()`, `connect()`, composing definitions
  and owned components receive as `api`. It is never public (owner,
  2026-10-19): `instance.api` exists for definitions, adapters and tests only.
  `connect()` is a pure function of current state that returns part props;
  the DOM binder runs it after every store flush, so keep it cheap.
  `expose()` returns the public state selectors read (`isOpen`, `isPressed`,
  …); it is public API, and the spec documents it.
- `actions` lists the members of `api` consumers may call, each run in a
  batch: `instance.actions`, the React and Vue handles' `actions`, and one method per
  action on the custom element (`element.open()`). Only the overlays have any:
  `open` and `close` on Dialog, Popover, Tooltip, Select and Combobox (owner,
  2026-10-19). An action is public API, and its spec's Actions section
  documents it.
- `createInstance(definition, { props, id, env })` in the runtime is the
  instance every adapter drives. Node tests use it directly: call part
  handlers from `instance.connect()` and read `attrs` and `getState()`
  without a framework or a DOM.
- Interactions (`createPress`, `createFocus`) live in `dom/` and take the
  `setup()` context. Definitions type part props with `DomPartProps` and read
  part elements with `partElement(ctx, part)`. Development warnings go
  through `warn()` from `dom/`.

### Controlled and uncontrolled values

- Every stateful value is a bindable, declared in the props schema
  (`bindable(default, { event })`). The consumer seeds it with
  `default<Name>` (`defaultOpen` for `isOpen`), which applies until the first
  uncontrolled change, like a form control's `value` attribute.
- Uncontrolled: the core commits the change. Controlled: the core only calls
  `onChange` and reads the value back from props on the next render. Never
  assume a requested change took effect.
- `null` (owner decision, 2026-10-19): only `undefined` leaves a bindable
  uncontrolled; `null` is a controlled value (a Select's `value: null`
  selects nothing). A plain prop reads `undefined` and `null` alike, as its
  default.
- Form reset (owner decision, 2026-10-19) goes through the bindable's
  `reset()`, in every form component, as a native reset does: uncontrolled,
  the first change is forgotten, so the value follows `default<Name>` again,
  one set after mount included; controlled, the change callback asks for
  `default<Name>`, or without one the value the component mounted with.
  Either way the change callback reports the value unless it is the value
  now. Never restore a value captured at mount on an uncontrolled bindable:
  a custom element's default often arrives as a property after it connects.
- The core reads props only through getters and never keeps a copy.

### Composition between instances

- A child instance (a radio, a field's control) resolves its owner (the radio
  group, the field) in this order:
  1. **Explicit link** for parts that sit apart: an id-reference attribute on
     elements, like HTML's `for` (`<uni-radio group="plan">`), resolved in
     the instance's root node; the instance itself in an `owner` prop in
     React and Vue.
  2. **React instance context.** `OwnerProvider` provides an instance (or
     the handle `useBehavior` returned) through a context that holds only
     the stable instance, so first render and SSR know the owner. React
     context crosses portals. In Vue every `useBehavior` provides its
     instance (`provide()`) and a child injects the nearest during setup,
     which crosses `<Teleport>` (Vue adapter spec).
  3. **Nearest DOM ancestor.** The child dispatches a bubbling request event
     on connect, following the Context Community Protocol's shape
     (`references/community-protocols/proposals/context.md`). An owner that
     connects later announces itself and waiting children ask again.
- React contexts and Vue's provides carry instances, never state. A context value that changes
  is a bug.
- State flows between stores: `ctx.owner(def)` returns the owner's actions
  and exposed state and subscribes the child's binder to the owner's store.
  It is `undefined` until the owner is resolved; resolving it triggers a
  flush.
- Request events are `composed` (owner decision, 2026-10-19): a child in a
  wrapper's shadow root finds the owner its wrapper sits in. Lookup by id
  stays in the child's root node.
- Collections stay data. Owner links are for composed components, not for
  collection items.
- Lookup code lives in `dom/`; the DOM-free runtime only sees `ctx.owner()`
  and `ctx.link()`.
- A link (Tooltip spec, Resolved questions 2) names a small key (`LinkKey`)
  instead of a definition, so the linking component doesn't bundle the one
  it links to: a definition takes it in `links`, the one answering lists it
  in `provides`, and `ctx.link(key)` reads it as `ctx.owner()` does. It comes
  from the prop of the key's name in React and Vue (`tooltip`), else on elements from
  the attribute of that name (an id) or the UniAria host the element sits in
  directly, never through another host. A key may name another attribute
  (`attribute: 'option-tooltip'`) and come only from it (`isAttributeOnly`),
  so a component with two keys for one kind (a Select's `tooltip` and
  `optionTooltip`) inside one host takes the host for the first only (owner,
  2026-10-22, the items spec).
- Tests cover each path: nested, consumer portal (React) or `<Teleport>`
  (Vue), another branch, a React or Vue child inside a custom-element owner,
  and an owner that connects late.

### Store

- One store per instance (`createStore` in `runtime/store.ts`). The snapshot
  is a version counter. There is no fine-grained tracking.
- `setProps()` is silent: it stores props and never notifies, because
  notifying during a React render triggers React's update-while-rendering
  warning. Adapters call `service.sync()` afterwards (React: layout effect
  after commit; Vue: after the patch; elements: `attributeChangedCallback`), which runs watchers for
  whatever props changed.
- Every handler returned by `connect()` runs inside `store.batch()`, so one
  action notifies once.
- `ctx.watch(read, cb)` compares with `Object.is` after each flush.
  `ctx.memo(deps, compute)` caches by explicit dependencies.
- `ctx.effect()` and `ctx.watch()` run only between `start()` and `stop()`,
  never on the server. `start()` and `stop()` are idempotent and restartable
  (React StrictMode mounts twice; Vue's `<KeepAlive>` stops and starts).

### Part props

`connect()` returns framework-neutral part props:

```ts
type PartProps = {
  attrs: Record<string, string | undefined>; // ARIA values as strings; undefined removes
  on?: Partial<Record<keyof HTMLElementEventMap, (event: Event) => void>>; // DOM event names
  style?: Record<string, string | undefined>; // CSS custom properties, and layout a definition owns (virtual rows)
  properties?: Record<string, string | number | boolean | undefined>; // live DOM properties
};
```

The DOM-free runtime types handlers as `(event: never) => void`, so it needs
no DOM types; definitions use `DomPartProps` from `dom/`, which types each
handler with its event.

- ARIA values are always strings: `'true'`/`'false'`, never booleans.
- Event names are DOM names: `click`, `keydown`, `focusin`, `focusout`,
  `input`. Use `focusin`/`focusout` for focus entering or leaving a subtree.
- Handlers read only native events. The React adapter passes
  `event.nativeEvent` and maps names (`focusin` → `onFocus`, `click` →
  `onClick`, `input` → `onInput`, `class` → `className`, `for` → `htmlFor`,
  `tabindex` → `tabIndex`). The Vue adapter passes the native event and keeps
  DOM names, events as `on` and the capitalized name (`onKeydown`,
  `onFocusin`).
- Every part carries its part markers (below) and its state attributes
  (`data-state`, `data-disabled`, …).
- `properties` are live DOM properties no attribute holds once the user acts
  (an input's `value`, a checkbox's `checked` and `indeterminate`). The binder
  sets each only when it differs from the element; `undefined` leaves it
  alone. React renders `value` and `checked` once, from the first render, as
  `defaultValue` and `defaultChecked`, so React never controls the element
  and server HTML shows the starting value. Vue renders them once as
  `^value` and `^checked`, attributes only, for the same reason.

### Part markers

Decided by the owner on 2026-10-19, so Tasty's sub-elements and plain CSS
target parts the same way in every adapter. They are attributes (owner,
2026-10-19), so React keeps them through any `className` and CSS tells a
nested root apart exactly (`runtime/define.ts`: `partMarker()`):

- **The root** (the part named `root`) carries `data-uni="<name>"`, the
  definition's name as in its element tag (`data-uni="checkbox"`), and no
  `data-element`. In Tasty, the root is the component itself.
- **A part outside the root**, one of the definition's `outsideParts` (an
  overlay's trigger and anchor), carries `data-uni-part="<name>-<part>"`
  with the part's name in kebab case (`data-uni-part="popover-trigger"`), so
  styles reach it without the root.
- **Every other part**, item parts included, carries `data-element` with the
  part's name capitalized (`trigger` → `Trigger`), which is how Tasty names
  a sub-element. Part names in code don't change (`parts.trigger`).
- Markers are attributes in the part props, so React and Vue bind them with
  the rest and warn when the markup replaces one. A custom element finds its parts
  by them, so the consumer's markup has them. Nothing writes `class`: it is
  the consumer's. There is no `data-scope` (dropped by the owner on
  2026-10-19).
- **The root is the outermost element** of a component, around every other
  part (owner, 2026-10-19), so a Tasty component or a `[data-uni="<name>"]`
  style reaches them all. An inner box is a `wrapper` part: TextField's and
  NumberField's box and the `label` area of Checkbox, Switch and Radio (the
  hovered area; without a wrapper, the root is). Groups keep their label,
  description and error inside the root. Overlays are the exception: the
  panel is the root, and the trigger and the anchor sit outside it. A
  button's `frame` and `extras` are the second (owner, 2026-10-22, the items
  spec): the frame goes around the root and the extras, which sit beside it,
  so Button's and ToggleButton's, and the triggers' of Popover and Dialog,
  are outside parts, marked `data-uni-part` and styled on their own.
- **Styles need the root** (owner, 2026-10-19). Most roots are optional, but
  nothing else ties a part to its component in CSS, so a root-less
  component gets no component styles. The testing helpers count a part no
  root is around as the component's.
- A composed definition's parts take the outer definition's markers:
  Select's panel is `data-element="Popover"`, ToggleButton's root is
  `data-uni="toggle-button"` only.

### DOM, lifecycle and SSR

- Nothing touches `document` or `window` at module scope. Every entry has a
  Node import test (`ssr-safety.test.ts`).
- ARIA relationships use stable ids from the adapter (`useId` in React and
  Vue).
  Consumers can override every id, except an item part's, which is made from
  its component's id and the item's key and moves with them (Listbox spec,
  Resolved questions 1).
- **A part keeps an id already on its element** (owner, 2026-10-19), in
  every adapter, and every reference to the part (`for`, `aria-labelledby`,
  `aria-describedby`, `aria-controls`, `aria-activedescendant`, item ids made
  from a list's id) follows it. A part's id is, in order: the id its element
  carries, its `idOf` prop (`controlId`, `inputId`, `listId`, `triggerId`),
  then `<instance id>-<part>`. The binder writes an id only on a part whose
  element has none. It reads the element's id as the element attaches,
  before every write and on a change (a mutation observer while started),
  and hands it to the instance (`instance.adoptId()`), so `ctx.ids` is live:
  read it where it is used. An id the consumer changes is followed; one they
  remove gives the part back its own. An id equal to the part's own, or one
  the binder wrote, isn't the consumer's. Item parts never adopt.
- In React the consumer's id goes after the part spread
  (`<label {...ui.parts.label} id="email-label">`), in Vue after `v-bind`. The first render can't
  see the element, so server HTML references the id the part has without
  one (its `idOf` prop, else generated) until hydration attaches the parts;
  an `idOf` prop gives the right id before then. React keeps an id it once
  adopted while the JSX drops it, since the part props then render it, as
  React Aria's `mergeIds` does. A custom element no longer copies a part's
  id into the `*Id` prop: the part keeps it, and the prop stays the
  consumer's.
- A composed component's part (Popover's trigger on Button, NumberField's
  steppers, Combobox's button) writes its id only where the element has
  none, so Button's "the consumer owns `id`" holds. Two instances bound to
  one element (a nested component's root that is also the outer's part)
  agree on whichever id the element carries: the second adopts the first's.
- Document, window and root node come from the part elements
  (`ownerDocument`, `defaultView`, `getRootNode()`), and before any element
  from `ctx.env.document`, so components work in shadow roots and iframes.
- Global singletons (layer stack, focus-visible modality) are keyed on
  `Symbol.for('@uniaria/…')` so duplicate installs share one instance.
  The modality tracker wraps `HTMLElement.prototype.focus` once per window,
  as React Aria does, so a script's `focus()` call isn't taken for a screen
  reader moving focus. iOS scroll lock wraps it once per window too, the
  first time it locks, and passes calls through while unlocked. A wrapper
  is never removed, since that would drop any wrapper installed after it.

### Overlays and positioning

- Overlays use the top layer (Popover API, `<dialog>`); nothing moves nodes
  into a portal. The Popover API is Baseline only since January 2025 (widely
  available from July 2027), so popovers detect it (`dom/support.ts`) and,
  without it, open in place: `hidden` while closed, `position: fixed` while
  open (Popover spec).
- One click outside a popover both closes it and acts on what it hit, as in
  Cube UI Kit (owner decision; React Aria needs a second click). Popovers
  never make the outside inert or put an underlay over it; they may hide it
  from assistive technology with `dom/` `hideOutside` (`aria-hidden`). A
  press on a popover's own trigger closes it without reopening, and
  `shouldCloseOnInteractOutside` keeps it open for chosen targets. A modal
  `<dialog>` makes the outside inert natively, so a press outside a dialog
  only dismisses it.
- Nested overlays coordinate through the global layer stack: a press closes
  every layer it is outside of, top down, stopping at one that holds it or a
  modal dialog, and closing a layer closes the layers opened from inside it.
  Never call `stopPropagation` or `stopImmediatePropagation` in components
  (ESLint enforces it).
- Positioning goes through one wrapper in `dom/` whose options are CSS
  Anchor Positioning's own (`positionArea`, `positionTryFallbacks`; gaps are
  the consumer's margins), in one of two modes the page picks with
  `configure({ positioning })` (`dom/settings.ts`; owner, 2026-10-16), not
  by detection. Script mode, the default, places the part in every browser
  by CSS's rules, in-house (replacing `@floating-ui/dom`). CSS mode, opt-in,
  leaves placing it to the consumer's anchor positioning: UniAria links the
  part to its anchor and reads back the side. The default changes to CSS mode
  once anchor positioning is Baseline widely available. Scenarios that place
  a part run in both modes.

### Collections

- Items are data: `items` plus `getKey`, `getTextValue`, `isItemDisabled`
  (and `disabledKeys`). Never derive collections from children in the core;
  a custom element may read its items from its markup, as it adopts props
  (Listbox spec, Resolved questions 2 and 3).
- Item parts repeat per item: a definition's `itemParts` get their props from
  `connectItem(part, key)`, computed lazily per rendered item (React and Vue
  `getItemProps(part, key)`), never for every row at once. After a flush only
  the keys the definition invalidates are rewritten. Custom elements find
  them by `data-element` and the consumer's `data-key`.
- Virtualization is opt-in through the `virtualizer` prop (Listbox
  virtualization spec): `@uniaria/core/virtual` wraps `@tanstack/virtual-core`
  behind the `Virtualizer` interface in `dom/virtual.ts`, so only lists that
  virtualize load it. The consumer renders the `renderedKeys` and
  `renderedSections` state, never every item; the core positions rows with
  styles through the binder. A custom element takes `items` as a property and
  renders on `renderedkeyschange`.

### Custom elements (light DOM)

- No shadow DOM, no Lit. `defineElement` creates element classes inside the
  call, never at module scope.
- The element never creates, moves or removes nodes it did not create.
  Anything it must create (a live region) goes outside the consumer's tree;
  the one exception is the live announcer, which an open modal dialog hosts
  because the page outside it is inert.
- Attribute ownership is per part: the element owns ARIA state, `data-state`
  and the part markers; the consumer owns content, `class` and every other
  attribute, `id` included: UniAria
  writes an id only on a part that has none.
  A part can be declared element-owned: the consumer leaves it empty and
  UniAria writes its content, in every adapter. Select's displayed value
  (its text), its hidden `<select>` (its `<option>`s) and Tooltip's `text`
  (the text it shows) are the three (Select spec, Resolved questions 10 and
  11; the items spec, Resolved questions 5).
- Parts are found by a query that stops at nested UniAria elements of any
  kind (a nested element can still be a part itself), plus a
  `MutationObserver` for parts added later. Listeners are delegated from the
  host's root (the document or a shadow root), as React delegates from its
  root container: in the bubble phase for events that bubble, so the
  consumer's listeners on the path run first, and in the capture phase for
  those that don't. A bubbling event reaches every part on its path,
  innermost first; one that doesn't bubble (`pointerenter`) reaches only the
  part it targets. Never a listener on the host: NVDA reads an element with
  a `click` or `mousedown` listener as clickable.
- State goes in through properties and out through events: the `isOpen`
  property means controlled, the `default-open` attribute means uncontrolled,
  and changes come out as `openchange` with the value in `detail`.
- A bindable's property reads the current value, controlled or not, like a
  native input's `value` or `checked` (owner decision, 2026-10-19), as the
  instance's state has it (NumberField's number, a group's value adopted
  from its controls), else `getValue()`. Setting it still makes the value
  controlled, and
  setting `undefined` uncontrolled again, so `el.value = el.value` controls
  an uncontrolled element. `default<Name>` properties read what was set.
  Attributes drop the `is` and `should` prefixes (`disabled`,
  `prevent-focus-on-press`); properties keep the prop names. A boolean
  attribute is true when present, except `"false"` on a prop that defaults
  to true (`dismissable="false"`).
- Properties set before upgrade are re-applied on upgrade. Registration is
  skipped when the name is already defined.
- A host never sits between `<table>` and `<tr>`, inside `<ul>` or inside
  `<select>`.

### Dependencies

Small utilities are built in-house; only large, domain-heavy packages are
reused. The approved runtime dependencies are:

| Package                     | Used for                                                 |
| --------------------------- | -------------------------------------------------------- |
| `@internationalized/number` | Locale-aware number parsing and formatting (NumberField) |
| `@internationalized/date`   | Calendars and date math (later date components)          |
| `@tanstack/virtual-core`    | Virtualization (see Collections)                         |

`@tanstack/virtual-core` is a development dependency bundled into
`@uniaria/core/virtual`, with `process.env.NODE_ENV` compiled out of its
files only, and pinned to one exact version (3.19.6). Upgrade it by hand
once a newer release passes the 14-day release-age policy and the
virtualization scenarios. 3.19.6 itself was a one-time owner exception to
that policy (2026-10-18): its `minimumReleaseAgeExclude` entry in
`pnpm-workspace.yaml` goes once it is 14 days old, on 2026-10-30.

The documentation site's (owner, 2026-10-19): `@tenphi/cookbook`, `astro`
and `vite` in `apps/docs`, and `@tenphi/eslint-plugin-tasty` at the root.
`@uniaria/styles`' (owner, 2026-10-19): `@tenphi/tasty` and `@tenphi/glaze`,
as optional peers and development dependencies. `@uniaria/vue`'s (owner,
2026-10-21): `vue`, a peer (`^3.5.0`) and a development dependency. The
owner's own `@tenphi/*` packages are exempt from the 14-day release age
(`minimumReleaseAgeExclude` in `pnpm-workspace.yaml`).

Approved development dependencies for testing: `@guidepup/virtual-screen-reader`,
`@guidepup/guidepup`, `@guidepup/playwright`, and `react-aria` in
`@uniaria/react` for the comparison with React Aria only (owner request,
2026-10-15). **Any other dependency needs the
owner's approval**, including small utility packages, Lit, state libraries
(nanostores, signals) and Zag.js packages.

Dependabot's pull requests wait for now (owner, 2026-10-21): leave them
open. When they resume, agents review them: land updates on `main` once CI
passes, and fix what they break (run `pnpm dedupe` when a workspace package
keeps the old version as a peer). Dependabot skips major versions of the
packages that set what we support (owner, 2026-10-15): `@types/node`, which
follows the oldest Node in `engines`; React and its types (@uniaria/react's
peer range); TypeScript (consumers' declarations, typescript-eslint support); and
Vitest (@uniaria/testing's peer range). Raise those by hand only for a concrete
need, since the packages must keep working with older toolchains, SSR on older
React and Node included. Other major versions come as pull requests: take them
when CI passes after the fixes they need.

## Component workflow

One component per task, small commits, in this order:

1. **Spec.** Copy `docs/_internal/component-spec-template.md` to
   `packages/core/src/components/<name>/spec.md` and fill it in. Commit the
   spec on its own and ask the owner to review it. Do not go further until
   the owner sets its status to `approved`.

   Complex components (overlays and collections: Dialog, Popover, Tooltip,
   Listbox, Select, Combobox) start from Cube UI Kit, not React Aria (owner, 2026-10-15). UI
   Kit replaced React Aria patterns that hurt its users: its ComboBox is its
   own implementation, and one click outside a popover acts. Read the
   component's source, tests and docs in `references/cube-ui-kit`, and list
   in the spec every place it differs from React Aria or the APG, with the
   reason. The owner decides each one. React Aria stays the reference for
   browser and assistive-technology edge cases.

2. **Conformance scenarios.** Written from the approved spec in
   `conformance/src/<name>/`, in commits of their own, including
   spoken-output checks with the virtual screen reader.
3. **Definition.** `packages/core/src/components/<name>/`, iterated until the
   scenarios pass in every adapter. Register the subpath in three places:
   `tsdown.config.ts` entry, `package.json` `exports`, and
   `src/ssr-safety.test.ts`.
4. **Adapters and docs.** Element registering entry, React or Vue sugar only
   if needed, and the component's page in `docs/components/` with a live demo
   (see Documentation).

Naming: folder and subpath in kebab-case (`checkbox-group`,
`@uniaria/core/checkbox-group`); definition export in camelCase
(`checkboxGroup`); `name: 'checkbox-group'`; element `<uni-checkbox-group>`.
A reserved word gets a descriptive export instead: `toggleSwitch` for
`name: 'switch'` (owner, 2026-10-16). The brand stays out of APIs: they get
descriptive names.

First scope, in roadmap order: Button, ToggleButton, Field, TextField,
Checkbox, CheckboxGroup, Switch, RadioGroup → Dialog, Popover, Tooltip,
NumberField → Listbox, Select, Combobox. Dialog and Tooltip joined on
2026-10-16 (owner): Dialog first, since it needs no positioning and settles
the overlay contract Popover reuses; Tooltip after Popover, whose
positioning and top-layer fallback it reuses.

Button also covers navigation (link mode with `href`); there is no separate
Link component. Field plus a text control is `<Name>Field` (TextField,
NumberField); TextField covers `<textarea>` too, so there is no separate
TextArea.

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

Scenarios depend only on `@uniaria/testing`; adapters implement one
function. Source: `packages/testing/src/conformance/`.

- **Suites** are data: `defineConformance<Props, State>('button', ({ scenario,
group }) => …)` in `conformance/src/<name>/`. They name the component by
  string and never import a definition, so they exist before the
  implementation does. `Props` and `State` types in the suite come from the
  spec.
- **Templates** describe the consumer's markup adapter-neutrally:
  `h('button', { part: 'root', class: 'x' }, 'Save')`. `part` names the UniAria
  part; every other key is a consumer-owned attribute.
  `nested('checkbox', { value: 'email' }, …)` puts another component inside:
  React renders it with its own `useBehavior()` inside its owner's
  `OwnerProvider`, Vue with its own `useBehavior()`, which injects its
  owner, custom elements wrap its children in `<uni-checkbox>`.
- **Adapters** implement `mount(request)`: render the template (React spreads
  part props onto it, Vue binds them as `v-bind` does; custom elements wrap
  it in `<uni-<name>>`), apply props
  the way their consumers do, call `record()` for the component's own events
  (not a nested component's, which bubble through a custom element), and
  return `setProps`, `state` (what `expose()` returns), `renderCount` (React
  or Vue renders of the owning component; 0 for elements) and `unmount`. Attribute
  changes must be visible as soon as the interaction that caused them
  resolves.
- **Events** are camelCase in scenarios (`pressStart`); the DOM event is
  lowercase (`pressstart`) and the React and Vue prop is `onPressStart`.
- **Scenarios** get `mount`, real `pointer` and `keyboard` input through
  Playwright (they can hold a button or key), `spoken()` for the virtual
  screen reader, `listen()` to hear what live regions announce, and
  `screenReader` for a real one in scenarios that declare
  `needs: ['screenReader']`. `mounted.part(name)` finds the part by its
  markers (`partSelector()`: the root by `data-uni`, a part outside it by
  `data-uni-part`, others by `data-element` inside the root) and fails
  loudly unless exactly one matches.
- **Phases.** A scenario declares the roadmap phase whose features it needs
  (`{ phase: 2 }`); an adapter run declares the phase it has reached
  (`runConformance(adapter, suites, { phase: 1 })`) and later scenarios are
  skipped, not failed.

## Testing

- Tests live next to the code: `*.test.ts(x)` runs in Node with no DOM;
  `*.browser.test.ts(x)` runs in Chromium, Firefox and WebKit.
- Import test functions explicitly from `vitest`; there are no globals.
- Interactions are tested in real browsers, not in a simulated DOM.
- React and Vue tests count renders: an internal interaction (hover, press, focus,
  highlight, opening an overlay) re-renders the owning component zero times.
- Spoken output is checked with `@guidepup/virtual-screen-reader` in CI on
  every push. Real screen readers run nightly
  (`.github/workflows/screen-readers.yml`): VoiceOver on macOS and NVDA on
  Windows, both with Chromium, driven through `@guidepup/guidepup` in the
  `screen-readers` Vitest project, which exists only when
  `UNIARIA_SCREEN_READERS` is set. It runs the scenarios that declare
  `needs: ['screenReader']`, and only those. Running it locally would change
  the machine's privacy settings, so check a change with a manual run of the
  workflow; its `discover` input logs what the reader holds for the focus
  after each key, for writing a new scenario. A night with no new commit on
  `main` skips it.
- If one engine fails to launch locally, run the others by project name
  (`browser (chromium)`, `browser (webkit)`) and rely on CI for the rest.

## Code conventions

- Booleans read as predicates, in public API and inside the code alike:
  `is…` for states (`isDisabled`, `isOpen`, `isPressed`), `should…`,
  `has…`, `allows…` or `can…` for behavior (`shouldPreventFocusOnPress`,
  `hasArrow`). This covers props, public state, options, variables,
  parameters and functions that return booleans. DOM-defined names stay as
  the DOM has them (`shiftKey`, the `disabled` attribute).
- Use only web platform features that are Baseline widely available. A newer
  feature is allowed only behind feature detection, with a fallback that
  keeps the behavior working, or behind a page-wide setting the consumer
  opts into (`dom/settings.ts`, such as CSS mode for positioning; owner,
  2026-10-16). Check with the `web-features` development
  dependency:
  `node -e "import('web-features').then(({features: f}) => console.log(f['<id>'].status))"`.
  `baseline: 'high'` is widely available; `low` and `false` need the
  fallback. A feature's `status.by_compat_key` covers its single APIs, which
  can lag the feature (`api.KeyboardEvent.isComposing`, under
  `keyboard-events`, is only `low`).
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
- Changing the runtime contract (`defineBehavior`, bindables, store, part
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

| Folder                    | Repository                                                                                      | License                   | Look at                                                                                                                                                                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cube-ui-kit`             | [cube-js/cube-ui-kit](https://github.com/cube-js/cube-ui-kit)                                   | MIT                       | The owner's React design system and UniAria's first consumer. `src/components/` (fields, overlays, collections) shows the APIs UniAria has to serve, and the behavior complex components start from (Component workflow). `src/tokens/` and `src/data/item-themes.ts` are the reference for `@uniaria/styles`' look. |
| `react-spectrum`          | [adobe/react-spectrum](https://github.com/adobe/react-spectrum)                                 | Apache 2.0                | `packages/react-aria/src/<area>` (interactions, focus, button, overlays, selection, listbox, combobox, numberfield), `packages/react-stately/src/<area>` and `packages/react-aria/test`: interaction edge cases, mobile screen readers, and their tests. `packages/@react-aria/*` are only re-export shells now.     |
| `zag`                     | [chakra-ui/zag](https://github.com/chakra-ui/zag)                                               | MIT                       | `packages/machines/*` for framework-agnostic component logic, `packages/core` and `packages/store` for runtime ideas, `packages/frameworks/*` for adapters.                                                                                                                                                          |
| `virtual`                 | [TanStack/virtual](https://github.com/TanStack/virtual)                                         | MIT                       | `packages/virtual-core`, the virtualization candidate (see Collections).                                                                                                                                                                                                                                             |
| `floating-ui`             | [floating-ui/floating-ui](https://github.com/floating-ui/floating-ui)                           | MIT                       | `packages/react`: `useHover`, `safePolygon`, `useFocus`, `useDismiss` for overlay interactions.                                                                                                                                                                                                                      |
| `aria-practices`          | [w3c/aria-practices](https://github.com/w3c/aria-practices)                                     | W3C Software and Document | `content/patterns/<pattern>/`: the APG pattern text and its working examples, which each spec follows.                                                                                                                                                                                                               |
| `virtual-screen-reader`   | [guidepup/virtual-screen-reader](https://github.com/guidepup/virtual-screen-reader)             | MIT                       | `src/`, to understand the spoken output that pull-request tests assert.                                                                                                                                                                                                                                              |
| `community-protocols`     | [webcomponents-cg/community-protocols](https://github.com/webcomponents-cg/community-protocols) | None stated               | `proposals/context.md`: the Context Community Protocol, where a child finds its nearest provider through a DOM event, including providers that connect later.                                                                                                                                                        |
| `lit`                     | [lit/lit](https://github.com/lit/lit)                                                           | BSD 3-Clause              | `packages/context`, the reference implementation of that protocol. Patterns only: Lit is not a dependency.                                                                                                                                                                                                           |
| `lion`                    | [ing-bank/lion](https://github.com/ing-bank/lion)                                               | MIT                       | `packages/ui/components/form-core/src/registration/`: children register with their parent through DOM events, and `FormRegistrarPortalMixin` covers children rendered in another branch. Also fieldsets and choice groups.                                                                                           |
| `spectrum-web-components` | [adobe/spectrum-web-components](https://github.com/adobe/spectrum-web-components)               | Apache 2.0                | `1st-gen/packages/overlay`, where `<sp-overlay trigger="id@click">` links a trigger in another branch by id, and `1st-gen/tools/reactive-controllers` (roving tabindex, focus groups).                                                                                                                               |
| `catalyst`                | [github/catalyst](https://github.com/github/catalyst)                                           | MIT                       | `src/`: GitHub's light-DOM elements, which wire children and events with `data-target` and `data-action` instead of shadow DOM.                                                                                                                                                                                      |
| `auto-complete-element`   | [github/auto-complete-element](https://github.com/github/auto-complete-element)                 | MIT                       | `src/`: a light-DOM element linked to its popup list by id (`for`), the id-reference pattern for parts in another branch.                                                                                                                                                                                            |

- Read them for behavior, edge cases and test ideas, then write UniAria code
  from the approved spec. Never import from `references/`, add it to a
  tsconfig or build config, or copy files wholesale.
- Code adapted from a reference keeps its license notice in the file header
  (Apache 2.0 for React Spectrum and Spectrum Web Components, BSD for Lit,
  MIT for the others).
- The clones track default branches, not the versions UniAria installs. For the
  exact behavior of a dependency, read it in `node_modules`.
- To add a repository, add it to `scripts/fetch-references.mjs` and this
  table, with the owner's approval.

## Documentation

The site is built by `apps/docs` with [Cookbook](https://cookbook.tenphi.me),
an Astro toolkit, from the pages in `docs/` (owner, 2026-10-19). CI
validates and builds it; the owner publishes it to https://uniaria.tenphi.me
by hand (`.github/workflows/pages.yml`, on `main`). `docs/contributing/` is the
readable overview of this file for people; this file stays the binding one.

- **Pages.** `docs/guide/`, `docs/components/<name>.mdx` (one per component,
  in the order and shape of `docs/components/button.mdx`), `docs/api/` and
  `docs/contributing/`. Navigation tabs are in `apps/docs/docs.config.ts`.
  Folders starting with `_` aren't published: `docs/_internal/` holds what
  agents need and readers don't.
- **Accuracy.** Pages are written for people using UniAria, from the code
  first and the spec second; no "Resolved questions", owner decisions or
  internal names outside `docs/contributing/`. A change to a component's
  behavior or API updates its page in the same commit.
- **Live demos** run the custom elements: `docs/components/demos/<page>.html`,
  `.css` and `.js`, imported with `?raw` into Cookbook's `<Preview>`, whose
  `scripts` prop inlines `/demo/<page>.js` into the sandboxed frame.
  `apps/docs/demo/<page>.ts` imports the elements a page's demos register;
  `apps/docs/scripts/build-demo.mjs` bundles each from the workspace sources
  into `apps/docs/public/demo/` (gitignored) before `dev` and `build`. A
  demo of a component with default styles (Button and Checkbox so far)
  imports `uniaria-styles:<name>,…`, which the script builds with
  `@uniaria/styles`' `buildCss()`, and its CSS holds only the page's layout.
  The others' CSS uses system colors and the state attributes until theirs
  land.
- **The site's own styling** is Tasty only: Cookbook's build rejects any other
  CSS. `eslint.config.js` lints `apps/docs` with the Tasty plugin's strict
  rules, against the tokens, states and presets `apps/docs/tasty.config.ts`
  reads from the theme.

## Not set up yet

Planned by the design, added when the owner asks: public API reports (API
Extractor), size limits that fail a check (`pnpm size` reports the sizes
per entry point, without limits) and Custom Elements Manifest generation.

## Releasing

Only the owner releases. `.github/workflows/release.yml` runs by hand, never
on a push (`gh workflow run release.yml` on `main`, once its CI passed). With
changesets in `.changeset/`, a run opens or updates the "chore: version
packages" pull request; once it is merged, the next run checks the commit
again, publishes the new versions to npm with trusted publishing, and creates
the GitHub release. The published packages share one version, the `fixed`
group in `.changeset/config.json`. The documentation site deploys on its own,
also by hand (`gh workflow run pages.yml` on `main`).

## Before pushing changes

Since the first release (owner, 2026-10-21), work lands through pull
requests, and bigger ones: a branch per piece of work, carrying all of it
(a spec's implementation, its tests, docs and changeset) rather than a pull
request per commit. The owner merges and releases. Follow
[`.cursor/commands/submit-changes.md`](.cursor/commands/submit-changes.md).
At minimum:

1. **Branch** from an up-to-date `main`.
2. `pnpm hygiene` — lint, format check, typecheck. Fix errors before going on.
3. `pnpm test` — all projects pass.
4. **Commit** with Conventional Commits (`feat`, `fix`, `refactor`, `test`,
   `docs`, `chore`, `perf`, `ci`); scope is the component or layer
   (`feat(checkbox): …`, `fix(runtime): …`). Conformance scenarios and
   implementation go in separate commits, and separate pull requests
   (Conformance).
5. **Changeset.** `pnpm changeset` for every user-visible change to a
   published package: `minor` for a feature or a breaking change while
   versions are 0.x, `patch` for the rest. Tests, docs and tooling need
   none.
6. `pnpm check:conformance` — no commit on the branch touches both.
7. **Push** the branch and open a pull request against `main` with
   `gh pr create`. Make sure its CI passes, fixing a failure in a follow-up
   commit, and leave the merge to the owner.
