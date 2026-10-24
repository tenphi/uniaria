---
title: Custom elements
description: '@uniaria/elements: defineElement and the registering entries.'
---

`@uniaria/elements` turns any UniAria definition into a light-DOM custom
element. The element wraps markup you write, finds its parts by their
markers, and writes attributes to them. It has no shadow root and renders
nothing, so your elements stay yours and your CSS styles them directly.
Elements work in plain HTML, server templates, and any framework that renders
HTML.

```html
<uni-switch default-selected>
  <label data-uni="switch">
    <input data-element="Input" type="checkbox" name="wifi" />
    <span data-element="Indicator"></span>
    <span data-element="Label">Wi-Fi</span>
  </label>
</uni-switch>

<script type="module">
  import '@uniaria/elements/switch';

  document
    .querySelector('uni-switch')
    .addEventListener('selectedchange', (event) => console.log(event.detail));
</script>
```

## Registering entries

Each component but TextInput has an entry that defines its element when
imported, with the `uni-` prefix. TextInput has no element: a
`<uni-text-field>` that renders only its input is the input on its own.

| Entry                              | Element                | Class export       |
| ---------------------------------- | ---------------------- | ------------------ |
| `@uniaria/elements/button`         | `<uni-button>`         | `UniButton`        |
| `@uniaria/elements/toggle-button`  | `<uni-toggle-button>`  | `UniToggleButton`  |
| `@uniaria/elements/field`          | `<uni-field>`          | `UniField`         |
| `@uniaria/elements/text-field`     | `<uni-text-field>`     | `UniTextField`     |
| `@uniaria/elements/number-field`   | `<uni-number-field>`   | `UniNumberField`   |
| `@uniaria/elements/checkbox`       | `<uni-checkbox>`       | `UniCheckbox`      |
| `@uniaria/elements/checkbox-group` | `<uni-checkbox-group>` | `UniCheckboxGroup` |
| `@uniaria/elements/switch`         | `<uni-switch>`         | `UniSwitch`        |
| `@uniaria/elements/radio-group`    | `<uni-radio-group>`    | `UniRadioGroup`    |
| `@uniaria/elements/radio`          | `<uni-radio>`          | `UniRadio`         |
| `@uniaria/elements/dialog`         | `<uni-dialog>`         | `UniDialog`        |
| `@uniaria/elements/popover`        | `<uni-popover>`        | `UniPopover`       |
| `@uniaria/elements/tooltip`        | `<uni-tooltip>`        | `UniTooltip`       |
| `@uniaria/elements/listbox`        | `<uni-listbox>`        | `UniListbox`       |
| `@uniaria/elements/select`         | `<uni-select>`         | `UniSelect`        |
| `@uniaria/elements/combobox`       | `<uni-combobox>`       | `UniCombobox`      |
| `@uniaria/elements/autocomplete`   | `<uni-autocomplete>`   | `UniAutocomplete`  |

Import an entry once, anywhere on the page; importing it again does nothing.
Each also exports the element's class (`undefined` on the server) and its
type, such as `UniSwitchElement`. A component that composes another, such as
Select, needs only its own entry; elements you nest, such as a `<uni-button>`
inside a `<uni-tooltip>`, need theirs.

## defineElement

```ts
defineElement<D>(
  definition: D,
  options?: DefineElementOptions,
): UniElementConstructor<D> | undefined
```

Defines a custom element for any definition, yours included, and returns its
class.

| Option   | Type     | Default | Description                                  |
| -------- | -------- | ------- | -------------------------------------------- |
| `prefix` | `string` | `'uni'` | The element is `<prefix>-<definition name>`. |
| `name`   | `string` |         | The full element name. Overrides `prefix`.   |

```ts
import { button } from '@uniaria/core/button';
import { defineElement } from '@uniaria/elements';

defineElement(button, { prefix: 'acme' }); // <acme-button>
defineElement(button, { name: 'save-button' }); // <save-button>
```

- When the name is already defined, it defines nothing and returns the
  existing class, so calling it twice is harmless.
- Where there is no `customElements` (Node, a server render), it returns
  `undefined`. The class is created inside the call, never at module scope,
  so the package imports on a server.
- It throws when a prop's property or an [action](#actions) would shadow a
  member of `HTMLElement.prototype` (such as `title`, `hidden` or `focus`) or
  `instance`.

The same definition can be registered under several names; each name is its
own element.

## Props, attributes and events

The element maps the definition's [props schema](./core.md#props-schema) to
the DOM. State goes in through attributes and properties and comes out
through events:

| Schema                       | Attribute                     | Property                            | Event                             |
| ---------------------------- | ----------------------------- | ----------------------------------- | --------------------------------- |
| `isDisabled: prop(false)`    | `disabled`                    | `isDisabled`                        |                                   |
| `isOpen: bindable(false)`    | `default-open` (uncontrolled) | `isOpen` (the value), `defaultOpen` | `openchange`, value in `detail`   |
| `press: event<PressEvent>()` |                               |                                     | `press`, `PressEvent` in `detail` |

- **Attributes** are the prop name in kebab case without an `is` or `should`
  prefix: `isDisabled` is `disabled`, `shouldPreventFocusOnPress` is
  `prevent-focus-on-press`. Props that an attribute can't hold, such as
  functions, arrays of items or a `virtualizer`, are properties only. Each
  component's page lists its attributes.
- **Conversion** follows the prop's type. A boolean attribute is true when
  present, as in HTML; `"false"` turns off a prop that defaults to true
  (`dismissable="false"`), since presence alone can't. Numbers are parsed
  with `Number`, JSON props with `JSON.parse` (`disabled-keys='["cherry"]'`).
  Removing an attribute returns the prop to its default.
- **Properties** have the prop's own name: `element.isDisabled`,
  `element.positionArea`. An attribute and its property set the same prop,
  and the last write wins. Reading a plain prop's property gives its value or
  default; reading a bindable's gives its current value (see below).
- **Events** are the lowercase event name (`pressstart`, `openchange`,
  `valuechange`): a `CustomEvent` that bubbles, with the value in `detail`.
  It isn't `composed`, so it doesn't leave a shadow root you put the element
  in. The `on<Event>` callbacks of the React API don't exist on elements.

### Controlled and uncontrolled

A bindable value, such as `isOpen` or `value`, is uncontrolled unless you set
its property:

- **Uncontrolled.** `default-open` (or the `defaultOpen` property) seeds the
  value, and the element changes it as the user acts, reporting each change
  with `openchange`. The markup can seed it too: a checkbox's `checked`, an
  input's `value`, a link's `href`, read when the element upgrades.
- **Controlled.** Setting `element.isOpen` makes the element only request
  changes: it dispatches `openchange` with the requested value and keeps the
  old one until you set the property again. Setting it to `undefined`
  returns to uncontrolled.

```js
const dialog = document.querySelector('uni-dialog');
dialog.isOpen = false; // controlled from now on
dialog.addEventListener('openchange', (event) => {
  if (event.detail || confirm('Discard your changes?')) {
    dialog.isOpen = event.detail;
  }
});
```

Reading the property gives the current value, controlled or not, as a native
input's `value` and `checked` do: `dialog.isOpen` is `true` while the dialog
is open, whoever opened it. It reads the value as the component shows it,
the same as `instance.getState()`: a group's value taken from the controls
checked in its markup, NumberField's number parsed from its text.
`defaultOpen` reads back what you set.

Writing a property always controls the value, even with the value it already
has: `element.value = element.value` turns an uncontrolled element into a
controlled one. A framework that compares the element's property with the
value it wants before setting it (Lit's `live()` directive) may skip that
write, and leave the element uncontrolled.

### Actions

Each of the definition's public [actions](./core.md#actions) is a method on
the element: an overlay's `open()` and `close()`. Use them for commands from
outside the component, such as opening a dialog when a save fails:

```js
const conflict = document.querySelector('uni-dialog');

async function save(draft) {
  const response = await fetch('/api/draft', { method: 'PUT', body: draft });
  if (response.status === 409) conflict.open();
}
```

An action changes state as the user would, so on a controlled element it
only dispatches the change event (`openchange`). The methods exist once the
element is defined; if your script may run before the entry is imported,
wait for `customElements.whenDefined('uni-dialog')`.

### Instance and state

`element.instance` is the [`Instance`](./core.md#instance) behind the
element, the same kind React's `useBehavior` creates:

- `element.instance.getState()` reads the public state each component's page
  lists.
- `element.instance.subscribe(listener)` calls `listener` after every change.

Change state through attributes, properties and actions, not through the
instance.

## Parts

Mark the root part with `data-uni="<name>"` (`data-uni="checkbox"`), a part
outside the root with `data-uni-part="<name>-<part>"` (an overlay's
`data-uni-part="popover-trigger"`), and every other part with
`data-element`, its name capitalized (`Input`, `HiddenSelect`). The element finds the first element for each part inside it,
then keeps watching its subtree with a `MutationObserver`, so parts added,
removed or renamed later are picked up. Parts can sit at any depth and in any
order.

- **Nested components.** A part inside another UniAria element (of any kind)
  or inside another host of the same tag belongs to that element, not to the
  outer one. A nested UniAria element can itself be a part of the outer one.
- **Item parts** of collections (a Listbox's `option`, `group`) are every
  element with that `data-element` and a `data-key`, keyed by it. An item
  part without a `data-key`, or with a key an earlier one has, is left alone,
  with a warning in development.
- **Items from markup.** A Listbox, Select or Combobox without an `items`
  property reads its items from its option parts: the key from `data-key`,
  the text from `data-text-value` or the element's own text, and groups from
  its group parts. It reads them again when the markup changes. Setting
  `items` stops that.
- **Values from markup.** Some props the element reads from a part when you
  haven't set them: Button's `elementType` from the root's tag and `href`
  from the link, an input's `value` or `checked` (including what the user
  typed or clicked before the element upgraded).
- **Ids.** Every part keeps the `id` in your markup, and the element points
  every reference at it, now and when you change it; it writes an id only on
  a part that has none (see [Ids](../guide/accessibility.md#ids)). Option
  ids are made from the list's id and the key.

The element writes only what it owns on each part: ARIA attributes, the
part's marker, state attributes, the references it needs, and an id where a
part has none. When an element stops being a part (you rename its
`data-element`, or a nested element defined later takes it), the element
removes what it wrote there. It never writes `class`. Content, classes and
every other attribute stay yours.

Event listeners for parts are delegated from the element's root node (the
document, or the shadow root it sits in), never added to the host element.
For events that bubble they run in the bubble phase, so your own listeners
on the path run first and can call `preventDefault()`.

## Owners and links

Some elements work inside another: a `<uni-checkbox>` in its
`<uni-checkbox-group>`, a `<uni-radio>` in its `<uni-radio-group>`, a
`<uni-button>` described by a `<uni-tooltip>`. An element finds its owner:

1. through the **`owner` property**, an instance, which wins over the rest;
2. through its **owner attribute**, which names the owner's element by id, in
   the same document or shadow root, like a `<label for>`:
   `<uni-checkbox group="contact">`;
3. else from the **nearest owner around it**: an ancestor element, or a React
   component's part, that provides one.

```html
<uni-checkbox-group id="contact">
  <div data-uni="checkbox-group">
    <span data-element="Label">Contact me by</span>
  </div>
</uni-checkbox-group>

<!-- Elsewhere on the page -->
<uni-checkbox group="contact" value="email">
  <label data-uni="checkbox">
    <input data-element="Input" type="checkbox" />
    <span data-element="Label">Email</span>
  </label>
</uni-checkbox>
```

Order doesn't matter: an owner that connects after its children, or an
element that upgrades later, links them when it does. A child moved out of
its owner, or whose owner leaves, unlinks and looks again.

**Links** work the same way through an attribute named after the link: a
component that takes a tooltip links to the `<uni-tooltip>` whose id its
`tooltip` attribute names, or else to the UniAria element it sits in directly
(not through another one).

```html
<uni-tooltip id="save-hint">…</uni-tooltip>
<uni-button tooltip="save-hint">
  <button data-uni="button">Save</button>
</uni-button>
```

See [Composition](../guide/composition.md).

## Properties set before upgrade

A framework, or your own script, may set properties on an element before its
entry is imported. The element moves those values onto its own properties
when it upgrades, so nothing set early is lost. Attributes are read on
upgrade as usual.

## Lifecycle

- **Connected**: the element finds its parts, links to its owners, and starts:
  effects run and attributes are written.
- **Disconnected**: it stops: its effects end, so its listeners are removed
  and page-wide effects such as a scroll lock are released. It unlinks from
  its owners.
- **Connected again**: it starts again with the same state.

## Light DOM rules

- **The element never creates, moves or removes your nodes.** It writes
  attributes, a few inline styles where a behavior needs them, and live
  properties such as an input's `value`. Select writes content into two
  parts you leave empty: its `value` part (the text) and its hidden
  `<select>` (the `<option>`s). The live announcer's region is
  created outside your tree, at the start of `<body>`, or inside an open
  modal dialog while one is open.
- **The host is an ordinary element** with no role, no tab stop and no
  styles. Style it like any other element if its default inline display gets
  in the way.
- **Where hosts can go.** The HTML parser moves or drops unknown elements in
  some places, and some elements require direct children. Never put a host
  between a `<table>` and its rows, directly inside a `<ul>` or `<ol>`, or
  inside a `<select>`. Wrap the whole table or list instead.

## TypeScript

Each registering entry adds its element to `HTMLElementTagNameMap`, so
`querySelector` and `createElement` return typed elements:

```ts
import '@uniaria/elements/switch';

const wifi = document.querySelector('uni-switch');
// UniSwitchElement | null: wifi.isSelected, wifi.defaultSelected, wifi.instance
```

For an element you define yourself, declare it the same way with
`UniElement`:

```ts
import { button } from '@uniaria/core/button';
import { defineElement } from '@uniaria/elements';
import type { UniElement } from '@uniaria/elements';

defineElement(button, { prefix: 'acme' });

declare global {
  interface HTMLElementTagNameMap {
    'acme-button': UniElement<typeof button>;
  }
}
```

| Type                       | Description                                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `UniElement<D>`            | `HTMLElement` plus a property per prop (without the `on…` callbacks), a method per action, and `instance`. |
| `ElementProperties<D>`     | Just the prop properties.                                                                                  |
| `UniElementConstructor<D>` | The class `defineElement` returns.                                                                         |
| `DefineElementOptions`     | `prefix` and `name`.                                                                                       |

## In other frameworks

Tell your framework that the tags are custom elements if it asks (Vue's
`compilerOptions.isCustomElement`, Angular's `CUSTOM_ELEMENTS_SCHEMA`), set
controlled values and non-string props as properties, and listen for the
lowercase events. See [Getting started](../guide/getting-started.mdx#in-other-frameworks).

Mixing with React works both ways: a React component can render inside a
custom element's owner, and a custom element inside a React owner's part
finds that owner.
