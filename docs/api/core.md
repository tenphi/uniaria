---
title: Runtime
description: '@uniaria/core: definitions, props, bindables, events and instances.'
---

`@uniaria/core` is the runtime every component is built on. A component's
behavior is one _definition_, made with `defineBehavior`: its parts, its props
and events, and the logic that turns state into attributes. The adapters are
generic over definitions, so the same object renders in React, in Vue and as a
custom element.

You need this entry to write your own component (see
[Custom components](../guide/custom-components.md)), to test a definition
without a framework or a DOM, and for the types the components use. The
components themselves come from their own subpaths, such as
`@uniaria/core/button`.

```ts
import {
  bindable,
  createInstance,
  defineBehavior,
  event,
  prop,
} from '@uniaria/core';
```

The runtime has no DOM types and touches no browser globals, so it also runs
in Node. Interactions that need the DOM live in
[`@uniaria/core/dom`](./dom.md).

## defineBehavior

`defineBehavior(config)` checks a config and returns the definition the
adapters take.

```ts
import { bindable, defineBehavior } from '@uniaria/core';

export const disclosure = defineBehavior({
  name: 'disclosure',
  parts: ['trigger', 'panel'],
  props: {
    isExpanded: bindable(false),
  },
  setup(ctx) {
    const { isExpanded } = ctx.props;
    return { toggle: () => isExpanded.set(!isExpanded.get()) };
  },
  expose: ({ props }) => ({ isExpanded: props.isExpanded.get() }),
  connect: ({ props, ids, api }) => ({
    trigger: {
      attrs: {
        'aria-expanded': String(props.isExpanded.get()),
        'aria-controls': ids.panel,
      },
      on: { click: api.toggle },
    },
    panel: {
      attrs: { id: ids.panel, hidden: props.isExpanded.get() ? undefined : '' },
    },
  }),
});
```

### Config

| Field          | Type                                | Description                                                                                                                                                                                                                                   |
| -------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`         | `string`                            | Required. Kebab case (`checkbox-group`). The root part gets `data-uni="<name>"`, and each of `outsideParts` `data-uni-part="<name>-<part>"`; the custom element is named after it (`<uni-checkbox-group>`).                                   |
| `parts`        | `readonly string[]`                 | Required. The named parts, in camelCase. `connect()` returns props for each one; the consumer renders the ones it needs. Each part but `root` and `outsideParts` gets its name capitalized as `data-element` (`hiddenInput` → `HiddenInput`). |
| `outsideParts` | `readonly string[]`                 | Parts rendered outside the root, as an overlay's trigger and anchor are: each is marked `data-uni-part="<name>-<part>"` (`popover-trigger`), so styles reach it without the root.                                                             |
| `props`        | `Record<string, prop \| bindable>`  | Required. The [props schema](#props-schema): the one source for React props, element attributes and properties.                                                                                                                               |
| `events`       | `Record<string, event>`             | What the component reports, by camelCase name. See [`event`](#event).                                                                                                                                                                         |
| `setup`        | `(ctx) => Api`                      | Required. Runs once per instance with the [setup context](#setup-context). Returns the definition's internal API: the functions and readers its `expose()` and `connect()` use.                                                               |
| `expose`       | `(view) => State`                   | Required. The public state: what selectors and `getState()` read. See [expose and connect](#expose-and-connect).                                                                                                                              |
| `connect`      | `(view) => Record<Part, PartProps>` | Required. [Part props](#part-props) for every part, from current state.                                                                                                                                                                       |
| `actions`      | `readonly string[]`                 | Members of `setup()`'s result that consumers may call, such as an overlay's `open` and `close`. See [actions](#actions).                                                                                                                      |
| `itemParts`    | `readonly string[]`                 | Parts repeated once per item of a collection, keyed by the item's key (a Listbox's `option`). Needs `connectItem`. See [item parts](#item-parts).                                                                                             |
| `connectItem`  | `(view, part, key) => PartProps`    | Part props for one item part of one item.                                                                                                                                                                                                     |
| `owner`        | `{ definition, attribute }`         | The component this one works inside, such as a checkbox's group. See [owners and links](#owners-and-links).                                                                                                                                   |
| `links`        | `readonly LinkKey[]`                | Links this component takes, each through a prop named after the key, such as `tooltip`.                                                                                                                                                       |
| `provides`     | `readonly LinkKey[]`                | Links this component answers, such as Tooltip's `tooltipLink`.                                                                                                                                                                                |

`defineBehavior` throws when:

- the name isn't kebab case (`/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`);
- two of the names it derives collide: a prop, a bindable's `default<Name>`
  prop, an `on<Event>` callback, `owner`, a link's prop, or an action;
- `itemParts` is set without `connectItem`, or a name is both a part and an
  item part;
- an outside part is `root` or not one of `parts`.

The definition it returns is the config, with `events` defaulted to `{}`,
plus `schema`: every prop resolved to its attribute, type, default prop and
change event, and the full list of events. Adapters read `schema`; you
rarely need it.

## Props schema

Each key of `props` is a `prop()` or a `bindable()`. Events go in `events`.

### prop

```ts
prop<T>(defaultValue: T, options?: PropOptions): PropSpec<T>
```

A plain value the consumer owns, such as `isDisabled` or `href`. In
`setup()` it reads as a function, `ctx.props.isDisabled()`, which returns the
default while the consumer passes `undefined` or `null`.

### bindable

```ts
bindable<T>(defaultValue: T, options?: BindableOptions): BindableSpec<T>
```

A stateful value that is controlled when the consumer passes it and
uncontrolled otherwise, like a form control's `value`. The schema derives two
more names from it:

- `default<Name>`, which seeds the uncontrolled value: `defaultOpen` for
  `isOpen`, `defaultValue` for `value`. It applies until the first
  uncontrolled change, so a default that arrives late (an element attribute
  set after the element connected) still seeds it, and again after a
  [reset](#resetting-a-bindable).
- The change event `<name>Change` (`openChange`, `valueChange`), which the
  consumer receives as `onOpenChange` in React and `openchange` on an element.

Any value other than `undefined` controls a bindable, `null` included.
See [bindables in setup](#bindables-in-setup) for how changes flow, and
[State](../guide/state.md) for the consumer's side.

### event

```ts
event<Detail = void>(): EventSpec<Detail>
```

Declares an event the component reports, under `events`, by camelCase name:
`press: event<PressEvent>()`. `setup()` reports it with
`ctx.emit('press', detail)`. Change events of bindables are declared for you.

### Options

| Option      | For             | Type                                          | Description                                                                                                                                                               |
| ----------- | --------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attribute` | both            | `string \| false`                             | The element attribute. Defaults to a [derived name](#naming-conventions). `false` makes the prop a property only, for values an attribute can't hold (functions, arrays). |
| `type`      | both            | `'boolean' \| 'string' \| 'number' \| 'json'` | How the element converts the attribute. Inferred from the default; set it when the default is `undefined` and the value isn't a string.                                   |
| `adopt`     | both            | `PropAdoption`                                | Where the custom element reads the prop when the consumer leaves it unset (below).                                                                                        |
| `idOf`      | `prop` only     | `string`                                      | The part whose id this string prop sets, such as Field's `controlId`. A part's id is the one its element carries, else this prop, else the generated one.                 |
| `event`     | `bindable` only | `string`                                      | The change event's camelCase name, instead of `<name>Change`.                                                                                                             |

`adopt` lets a custom element take a value from the consumer's markup, so
server-rendered HTML works before JavaScript runs. It applies only in the
custom element, only to parts it finds, and only while the consumer hasn't set
the prop. A bindable adopts into its `default<Name>`, so it stays
uncontrolled.

| `adopt`                         | Reads                                                                                                                                                                           | Used by                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `{ part, tag: true }`           | The part's tag name                                                                                                                                                             | Button's `elementType`                                   |
| `{ part, attribute }`           | An attribute of the part                                                                                                                                                        | Button's `href`                                          |
| `{ part, property }`            | A live DOM property of the part, which may hold input made before the element upgraded                                                                                          | TextField's `value`, Checkbox's `isSelected` (`checked`) |
| `{ items: { item, section? } }` | A collection from item parts in the markup: `{ key, textValue }` per `item` part from its `data-key` and its `data-text-value` or text, and `{ key, items }` per `section` part | Listbox's `items`                                        |

### Naming conventions

The schema names everything else. With these props and events:

```ts
props: {
  isDisabled: prop(false),
  shouldCloseOnBlur: prop(true),
  hasArrow: prop(false),
  isOpen: bindable(false),
  value: bindable<readonly string[]>([], { attribute: false }),
},
events: { pressStart: event<PressEvent>() },
```

| Schema entry        | React props                              | Element attribute | Element properties      | DOM event     |
| ------------------- | ---------------------------------------- | ----------------- | ----------------------- | ------------- |
| `isDisabled`        | `isDisabled`                             | `disabled`        | `isDisabled`            |               |
| `shouldCloseOnBlur` | `shouldCloseOnBlur`                      | `close-on-blur`   | `shouldCloseOnBlur`     |               |
| `hasArrow`          | `hasArrow`                               | `has-arrow`       | `hasArrow`              |               |
| `isOpen`            | `isOpen`, `defaultOpen`, `onOpenChange`  | `default-open`    | `isOpen`, `defaultOpen` | `openchange`  |
| `value`             | `value`, `defaultValue`, `onValueChange` | none              | `value`, `defaultValue` | `valuechange` |
| `pressStart`        | `onPressStart`                           |                   |                         | `pressstart`  |

- **Attributes** are the key in kebab case, without an `is` or `should`
  prefix. Other prefixes (`has`, `allows`, `can`) stay. A bindable's
  attribute is `default-` plus its name without `is`, since the attribute
  only seeds the value.
- **Bindables** drop `is` in derived names: `isOpen` is seeded by
  `defaultOpen` and reports `openChange`.
- **Events** are camelCase in the schema. The DOM event is the lowercase name
  (`pressstart`), and the React callback is `on` plus the capitalized name
  (`onPressStart`).
- **Booleans** read as predicates: `is…` for states (`isDisabled`,
  `isOpen`), `should…`, `has…`, `allows…` or `can…` for behavior.

The element converts an attribute by the prop's type:

| Type      | Inferred from                     | Conversion                                                                                                           |
| --------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `boolean` | a `boolean` default               | Present is `true`, as in HTML. `"false"` is `false` only for a prop that defaults to `true` (`dismissable="false"`). |
| `number`  | a `number` default                | `Number(value)`                                                                                                      |
| `string`  | a `string` or `undefined` default | As written                                                                                                           |
| `json`    | any other default                 | `JSON.parse(value)` (`disabled-keys='["cherry"]'`)                                                                   |

A removed attribute leaves the prop unset, so it reads as its default.

## Setup context

`setup(ctx)` runs once per instance, on the server too. It creates state,
wires interactions and returns the definition's internal API: the functions
and readers that its own `expose()` and `connect()` use, and that a composing
definition (`ctx.use()`) or an owned component (`ctx.owner()`) reads. It
isn't public: consumers read the public state and change it through props
and the few members the definition lists as [actions](#actions). Everything
`setup()` needs from the outside comes through `ctx`:

| Member                             | Description                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `props`                            | One reader per prop: a function for a `prop()`, a [`Bindable`](#bindables-in-setup) for a `bindable()`. Read props here every time; never copy them.          |
| `ids`                              | Each part's id now: the id its element carries, else its `idOf` prop, else `<instance id>-<part>`. Read it where you use it.                                  |
| `env`                              | Host objects from the adapter. `env.document` is the element's document in the custom-element adapter; React passes none.                                     |
| `state(initial)`                   | A `Cell<T>` of internal state: `get()` and `set(value)`. Setting a different value (`Object.is`) notifies.                                                    |
| `memo(deps, compute)`              | A getter that calls `compute(...deps())` again only when a dependency changes (`Object.is`).                                                                  |
| `effect(fn)`                       | Runs `fn` when the instance starts, and the cleanup it returns when it stops. Never on the server.                                                            |
| `watch(read, callback)`            | After each flush, calls `callback(value, previous)` when `read()` changed (`Object.is`). Only while started.                                                  |
| `emit(name, detail)`               | Reports one of the definition's events: React calls `on<Name>`, the element dispatches the DOM event.                                                         |
| `element(part)`                    | The element rendered for a part, or `null`. Typed `unknown`: read it with [`partElement`](./dom.md#parts-and-effects).                                        |
| `itemElement(part, key)`           | The element rendered for an item part and key, or `null`.                                                                                                     |
| `itemEffect(part, effect)`         | Runs `effect(key, element)` for each element of an item part as it attaches, while started; its cleanup runs when the element detaches or the instance stops. |
| `invalidateItems(keys?)`           | Marks the items whose `connectItem()` props changed for a reason other than props, so only they are written again. With no keys, every item.                  |
| `batch(fn)`                        | Runs `fn` and flushes once at the end. Part handlers are batched already; batch listeners you add to the document yourself.                                   |
| `afterFlush(fn)`                   | Runs `fn` once the flush under way has called every watcher and the adapter's binder, so the DOM shows the change; at once when nothing is flushing.          |
| `use(definition, props, options?)` | Composes another definition into this instance. See [composition](#composition).                                                                              |
| `owner(definition)`                | The owner instance, or `undefined`. See [owners and links](#owners-and-links).                                                                                |
| `link(key)`                        | The linked instance, or `undefined`.                                                                                                                          |

### Bindables in setup

A bindable reads as `{ get(), set(value), isControlled(), reset(options?) }`.

- **Uncontrolled**, `set()` commits the value, notifies, and calls the
  consumer's change callback.
- **Controlled**, `set()` only calls the callback. The value changes when
  the consumer passes a new one. Never assume a requested change took effect:
  read `get()` again.
- `set()` with the current value does nothing.

```ts
setup(ctx) {
  const { isOpen } = ctx.props;
  return {
    open: () => isOpen.set(true),
    close: () => isOpen.set(false),
  };
},
```

### Resetting a bindable

`reset(options?)` puts the value back as a form's reset does a native
control's, and returns the value it goes back to. Call it from a form's
`reset` listener.

- **Uncontrolled**, the value follows `default<Name>` again, as before its
  first change, and goes on following it: a default set after the reset
  applies too. Without `default<Name>`, the schema's default.
- **Controlled**, the value stays the consumer's; the callback asks for
  `default<Name>`, or without one `options.fallback`, typically the value the
  component mounted with.
- Either way, the change callback gets the value it goes back to, unless
  that is the value now.

| Option         | Type                      | Description                                                                                                                                                           |
| -------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fallback`     | `T`                       | What a controlled value without `default<Name>` goes back to. Without it, the schema's default.                                                                       |
| `isEqual`      | `(a: T, b: T) => boolean` | Whether the value now and the value it goes back to are the same, so nothing is reported. `Object.is` by default; pass one for arrays.                                |
| `beforeReport` | `(value: T) => void`      | Runs right before the change callback with the value it gets: write a hidden form field here, so a change listener's `FormData` already holds it.                     |
| `readDefault`  | `(value: T) => T`         | How the component reads a default, when not as it is: a number field parses text taken from the markup. Applied to the value it goes back to and to an unchanged one. |

```ts
setup(ctx) {
  const { value } = ctx.props;
  let mounted: string | undefined;
  partEffect(ctx, 'input', (input) => {
    mounted ??= value.get();
    const form = (input as HTMLInputElement).form;
    const onReset = (event: Event) => {
      if (!event.defaultPrevented) value.reset({ fallback: mounted });
    };
    form?.addEventListener('reset', onReset);
    return () => form?.removeEventListener('reset', onReset);
  });
  // …
},
```

### Effects, watchers and the lifecycle

An instance is created, then started when it is live in a document (React
mounts it, an element connects) and stopped when it leaves. `effect()` and
`watch()` run only in between. `setup()` also runs on the server, so it must
not touch the DOM: do that in effects. Start and stop are idempotent and can
repeat: React's StrictMode mounts twice.

Every handler a part returns runs in a batch, so one user action notifies
once. After each flush, watchers run first, then the adapters write the new
part props. A watcher that changes state causes another pass; a store that
still changes after 100 passes in a row logs an error and stops.

A custom element connects before the parser adds its children, so its parts
often arrive after `start()`. Anything that needs a part's element should go
through [`partEffect`](./dom.md#parts-and-effects), which runs again when the
element changes, rather than reading the element once in `effect()`.

### Composition

`ctx.use(definition, props, options?)` runs another definition's `setup()` on
this instance: the same store, lifecycle and elements. This is how
ToggleButton is Button plus selection, and Select is Listbox, Popover and
Field.

```ts
setup(ctx) {
  const { props } = ctx;
  const inner = ctx.use(button, () => ({
    isDisabled: props.isDisabled(),
    onPress: () => props.isSelected.set(!props.isSelected.get()),
  }));
  return { button: inner };
},
expose: ({ props, api }) => ({
  ...api.button.state(),
  isSelected: props.isSelected.get(),
}),
connect: ({ props, api }) => {
  const { root } = api.button.connect();
  const isSelected = props.isSelected.get();
  return {
    root: {
      ...root,
      attrs: { ...root.attrs, 'aria-pressed': String(isSelected) },
    },
  };
},
```

- `props` is a function, read on every access. Pass this component's props
  and callbacks through it to receive the composed one's events.
- The composed definition renders on this component's parts of the same
  name. `options.parts` maps them instead: `{ parts: { root: 'trigger' } }`.
  `null` leaves a part out; it still gets an id, and the composed definition
  sees no element for it. A mapping to a part this component doesn't have
  throws.
- It returns `{ api, state(), connect(), connectItem(part, key) }`. Fold
  `state()` into `expose()` and `connect()` into `connect()`. Its part props
  come keyed by its own part names, without the part markers.
- Call it during `setup()` only.

### Owners and links

Separate instances that work together find each other at runtime instead of
composing. For how consumers connect them, see
[Composition](../guide/composition.md).

**Owners.** A checkbox inside a checkbox group, or a radio inside a radio
group, names its owner's definition and the element attribute that refers to
the owner's host by id:

```ts
owner: { definition: checkboxGroup, attribute: 'group' },
```

`ctx.owner(checkboxGroup)` returns `{ instance, api, state() }`: the owner's
instance, what its `setup()` returned, and its `expose()` now. It is
`undefined` until an adapter finds the owner, which happens after mount for a
DOM lookup, so read it where it is used (in `connect()`, `expose()` or a
watch), never once in `setup()`. While started, the owner's changes re-run
this instance's `connect()`, `expose()` and watchers. Declaring an owner adds
an `owner` prop that takes the owner's instance directly.

**Links.** A link is named by a small key instead of a definition, so the
component that takes it doesn't bundle the one it links to. Button takes a
tooltip this way, without importing Tooltip:

```ts
import type { LinkKey } from '@uniaria/core';

export const tooltipLink: LinkKey<'tooltip', TooltipLinkApi> = {
  name: 'tooltip',
};
```

The taking definition lists the key in `links`; the answering one lists it
in `provides`. `ctx.link(tooltipLink)` returns `{ instance, api }`, or
`undefined`. The key's name is the prop that takes the instance in React
(`useBehavior(button, { tooltip: hint.instance })`) and the element
attribute that names the host by id (`<uni-button tooltip="hint">`); without
the attribute, an element links to the UniAria host it sits in directly. A
key can name another attribute (`attribute: 'option-tooltip'`) and come only
from it (`isAttributeOnly: true`): a Select inside a `<uni-tooltip>` takes
that tooltip for its trigger, and its options' tooltip only by id.
`ctx.link()` is always `undefined` in a composed definition: links belong to
the instance.

How each adapter resolves owners and links:
[React](./react.md#owners-and-links), [custom elements](./elements.md#owners-and-links).

## expose and connect

Both receive the same view: `{ props, ids, api }`, where `api` is what
`setup()` returned.

**`expose(view)`** returns the public state, the object consumers read with
`useBehaviorState` and `instance.getState()`. It is public API, so keep it
small and stable: `isOpen`, `isPressed`, `value`. The instance caches it
until state or props change.

**`connect(view)`** returns part props for every part in `parts`. It is a
pure function of current state, re-run after every flush, so keep it cheap.
The instance caches its result until state or props change, and adds the
part markers to `attrs` (`partMarker()`): `data-uni` to the root,
`data-uni-part` to each outside part, and `data-element` to every other
part.

### Part props

```ts
interface PartProps {
  attrs: Record<string, string | undefined>;
  on?: Record<string, (event: never) => void>;
  style?: Record<string, string | undefined>;
  properties?: Record<string, string | number | boolean | undefined>;
}
```

| Field        | Description                                                                                                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `attrs`      | Attributes by DOM name. Values are strings: `'true'` and `'false'` for ARIA, `''` for a boolean attribute or a state attribute that is on (`data-pressed=""`). `undefined` removes the attribute. UniAria owns every attribute a part has ever returned here.                                |
| `on`         | Handlers by DOM event name: `click`, `keydown`, `focusin`, `focusout`, `input`. Each receives the native event, never a framework's, and runs in a batch. Use `focusin` and `focusout` for focus entering or leaving a subtree.                                                              |
| `style`      | CSS custom properties (`--anchor-width`), and the kebab-case properties a definition lays its parts out with (a virtualized row's `translate`). `undefined` removes one.                                                                                                                     |
| `properties` | Live DOM properties no attribute holds once the user acts: an input's `value`, a checkbox's `checked` and `indeterminate`. Each is set only when it differs from the element; `undefined` leaves it alone. React renders `value` and `checked` once, as `defaultValue` and `defaultChecked`. |

The runtime types handlers as `(event: never) => void` because it has no DOM
types. Write definitions with `DomPartProps` from
[`@uniaria/core/dom`](./dom.md#parts-and-effects), which types each handler
with its event. The consumer owns everything not in `attrs`: content, `class`, and other
attributes.

### Item parts

A collection's rows are item parts: `itemParts: ['option']` with
`connectItem(view, part, key)`. Adapters call it lazily, only for the items
they render (React's `getItemProps(part, key)`, elements' `data-key`), and the
instance caches each result until:

- `ctx.invalidateItems()` names the key, or names none;
- props change, which invalidates every item;
- an element of one of the key's item parts attaches or detaches.

After a flush, only the invalidated items are written again, so moving the
highlight in a long list rewrites two rows. Item ids come from
`itemId(base, part, key)`: `<base>-<part>-<encoded key>`.

## Actions

Most changes come from the user or from props. A few are commands a consumer
gives from outside the component, such as opening a dialog from a menu. A
definition makes those public by listing members of `setup()`'s result in
`actions`:

```ts
import { bindable, defineBehavior } from '@uniaria/core';

export const sheet = defineBehavior({
  name: 'sheet',
  parts: ['root'],
  props: { isOpen: bindable(false) },
  actions: ['open', 'close'],
  setup(ctx) {
    const { isOpen } = ctx.props;
    return {
      open: () => isOpen.set(true),
      close: () => isOpen.set(false),
      isAnimating: () => false, // Not listed, so internal.
    };
  },
  expose: ({ props }) => ({ isOpen: props.isOpen.get() }),
  connect: ({ props }) => ({
    root: { attrs: { hidden: props.isOpen.get() ? undefined : '' } },
  }),
});
```

Consumers call them as `instance.actions.open()`, as
[`actions.open()` on the React handle](./react.md#the-handle), and as
[`element.open()` on the custom element](./elements.md#actions). The overlays
(Dialog, Popover, Tooltip, Select and Combobox) list `open` and `close`.

- **Only listed members are public.** `ActionsOf<D>` picks them from the
  setup result's type; everything else stays internal.
- **Each action runs in a batch**, so it notifies once, however many changes
  it makes. Arguments and the return value pass through.
- **An action changes state the way the user would.** Setting a bindable
  while it is controlled only calls its change callback (`onOpenChange`), so
  a controlled sheet opens when the consumer passes the new value.
- **Names are checked.** `defineBehavior` throws when an action is named like
  a prop or callback, `createInstance` throws when `setup()` doesn't return a
  function under that name, and `defineElement` throws when the name would
  shadow an element member such as `focus` or `click`.

## createInstance

```ts
createInstance<D>(definition: D, options?: InstanceOptions<D>): Instance<D>
```

Creates one running component: its props, state, internal API and actions. Both
adapters drive one per rendered component, and tests use it directly.

| Option  | Type         | Description                                                          |
| ------- | ------------ | -------------------------------------------------------------------- |
| `props` | `PropsOf<D>` | The starting props, as in React: values, `default<Name>`, callbacks. |
| `id`    | `string`     | Base for the part ids. Defaults to `uni-<n>`, a counter.             |
| `env`   | `Env`        | Host objects: `{ document }`.                                        |

### Instance

| Member                                                     | Description                                                                                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `definition`, `id`, `ids`                                  | The definition, the id base and the id of each part now.                                                                          |
| `actions`                                                  | The definition's public [actions](#actions), each run in a batch.                                                                 |
| `api`                                                      | Internal: what `setup()` returned, for adapters, composing definitions and owned components. Consumers call `actions` instead.    |
| `getState()`                                               | What `expose()` returns, cached until state or props change.                                                                      |
| `connect()`                                                | Part props for every part, with the part markers, every handler batched; cached until state or props change.                      |
| `getProps()`                                               | The current props.                                                                                                                |
| `getValue(key)`                                            | A bindable's current value: the consumer's while controlled, else the instance's own. A custom element's property reads it.       |
| `setProps(props)`                                          | Replaces the props without notifying. Call `sync()` once they are committed. Changing only callbacks doesn't count as a change.   |
| `sync()`                                                   | Notifies for props changed since the last sync, so watchers and adapters run.                                                     |
| `start()`, `stop()`, `isStarted()`                         | The live period: effects and watchers run only between `start()` and `stop()`. Both are idempotent.                               |
| `subscribe(listener)`, `getSnapshot()`                     | The store: `listener` runs after each flush, and the snapshot is a version number that changes once per flush.                    |
| `batch(fn)`                                                | Groups changes into one flush.                                                                                                    |
| `attach(part, element)`, `element(part)`                   | Registers the element of a part (`null` removes it) and reads it back. Adapters call `attach`.                                    |
| `adoptId(part, id)`                                        | Keeps the id the consumer gave a part's element; `undefined` gives the part its own back. The binder calls it.                    |
| `connectItem(part, key)`                                   | Part props for one item part of one item, cached.                                                                                 |
| `attachItem(part, key, element)`, `itemElement(part, key)` | Registers and reads an item part's element.                                                                                       |
| `subscribeItems(listener)`                                 | Hears which item keys were invalidated (`null` for all), so an adapter rewrites only those.                                       |
| `link(owner, key?)`                                        | Links the owner the adapter found, or with `key` one of the definition's links; `undefined` unlinks. Silent: call `sync()` after. |
| `owner()`, `linked(key)`                                   | The owner or linked instance now: the prop wins over the adapter's link.                                                          |

### Testing a definition in Node

An instance works without a framework and without a DOM. Set props, call a
part's handler from `connect()` as the browser would, then check the part
props and the state:

```ts
import { createInstance } from '@uniaria/core';
import { expect, it, vi } from 'vitest';

import { disclosure } from './disclosure';

it('opens uncontrolled and reports the change', () => {
  const onExpandedChange = vi.fn();
  const instance = createInstance(disclosure, {
    props: { onExpandedChange },
    id: 'shipping',
  });

  // This handler ignores its event.
  instance.connect().trigger.on?.click?.({} as never);

  expect(instance.getState().isExpanded).toBe(true);
  expect(instance.connect().panel.attrs.hidden).toBeUndefined();
  expect(instance.connect().trigger.attrs['aria-controls']).toBe(
    'shipping-panel',
  );
  expect(onExpandedChange).toHaveBeenCalledWith(true);
});
```

Interactions from `@uniaria/core/dom` need real elements, so test those in a
browser. See [Testing](./testing.md).

## Types

| Type                                            | Description                                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PropsOf<D>`                                    | The props an adapter accepts for a definition: values, `default<Name>`, callbacks, `owner` and link props. |
| `StateOf<D>`                                    | What `expose()` returns.                                                                                   |
| `ApiOf<D>`                                      | What `setup()` returns: the definition's internal API.                                                     |
| `ActionsOf<D>`                                  | The public [actions](#actions): the members of `ApiOf<D>` listed in `actions`.                             |
| `PartOf<D>`, `ItemPartOf<D>`                    | The part and item-part names.                                                                              |
| `Instance<D>`                                   | A running component. See [Instance](#instance).                                                            |
| `Definition`, `AnyDefinition`                   | A definition; `AnyDefinition` for code generic over definitions.                                           |
| `PartProps`                                     | Framework-neutral part props.                                                                              |
| `SetupContext`, `ViewContext`                   | What `setup()` and `expose()` or `connect()` receive.                                                      |
| `Bindable<T>`, `Cell<T>`                        | A bindable as `setup()` reads it, and a piece of internal state.                                           |
| `BindableKeyOf<D>`                              | The keys of a definition's bindables, which `getValue()` takes.                                            |
| `ResetOptions<T>`                               | The options of a bindable's [`reset()`](#resetting-a-bindable).                                            |
| `LinkKey<Name, Api>`, `Linked<Api>`, `Owned<D>` | A link key, and what `ctx.link()` and `ctx.owner()` return.                                                |

Each component subpath also exports `<Name>Props` and `<Name>State`, which are
`PropsOf` and `StateOf` of its definition.

### For adapter authors

The entry also exports what the two adapters are built from:
`createStore` (the per-instance store), `partMarker(name, part, isOutside)`
(the attribute and value that mark a part), the naming helpers `callbackName`
(`pressStart` → `onPressStart`), `domEventName` (`pressStart` →
`pressstart`), `kebabCase` and `capitalize`, and `answers` and
`isOwnerDefinition`, which tell whether an instance answers an owner or link
lookup. See [the adapter pieces](./dom.md#for-adapter-authors) in the DOM
layer.
