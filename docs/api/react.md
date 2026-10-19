---
title: React
description: '@uniaria/react: useComponent, useComponentState and OwnerProvider.'
---

`@uniaria/react` renders any UniAria definition in React with one hook. It has
no component-specific code: every component on this site works through the
same three exports.

```ts
import { OwnerProvider, useComponent, useComponentState } from '@uniaria/react';
```

It needs React 18 or 19 (`react` is a peer dependency) and nothing else.

Internal state never renders your component again. Each part renders once with
its current props, and after mount UniAria writes every change (hover, press,
focus, an opening popover, the highlighted option) straight to the elements.
Your component renders again only for props you pass and for state you
[select](#usecomponentstate). See [State](../guide/state.md).

## useComponent

```ts
useComponent<D>(definition: D, props: PropsOf<D>): ComponentHandle<D>
```

Creates an instance of `definition` for this component and returns props to
spread onto each part.

```tsx
import { toggleSwitch } from '@uniaria/core/switch';
import { useComponent } from '@uniaria/react';

export function WifiSwitch() {
  const wifi = useComponent(toggleSwitch, {
    defaultSelected: true,
    labelElementType: 'span',
    onSelectedChange: (isSelected) => console.log(isSelected),
  });
  return (
    <label
      {...wifi.parts.root}
      className={`${wifi.parts.root.className} switch`}
    >
      <input {...wifi.parts.input} name="wifi" />
      <span {...wifi.parts.indicator} />
      <span {...wifi.parts.label}>Wi-Fi</span>
    </label>
  );
}
```

`props` are the component's props as its page lists them, typed from its
definition: values, `default<Name>` for uncontrolled values, `on<Event>`
callbacks, an `owner` for components that have one, and link props such as
`tooltip`. Attributes you own (`id`, `name`, `aria-label`) go in the JSX,
next to the spread. `parts.root` has a `className`, the root's `uni-<name>`
class: keep it when you add classes of your own, as above.

- **Every render** stores the new props without notifying, and syncs them
  after commit in a layout effect, so watchers run once per change and React
  never sees an update during render. Callbacks may be inline: UniAria calls
  the latest ones.
- **One instance** per component, created on the first render. A different
  `definition` creates a new one, so keep definitions at module scope.
- **Ids** come from `useId`, so server and client agree.

### The handle

| Member                    | Description                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `instance`                | The stable [`Instance`](./core.md#instance). Pass it to `useComponentState`, to `OwnerProvider`, or as another component's `owner` or link prop. `instance.getState()` reads state without subscribing. |
| `actions`                 | The component's public [actions](./core.md#actions), such as an overlay's `open()` and `close()`. Stable across renders.                                                                                |
| `parts`                   | Props for each part, from this render: `parts.root`, `parts.input`. Spread them onto the part's element.                                                                                                |
| `getItemProps(part, key)` | Props for one item part of one item, for collections: `getItemProps('option', item.key)`. See [item parts](#item-parts).                                                                                |

Render the parts you need: each component's page says which parts are
optional.

Actions are for commands from outside the component, such as opening a dialog
when a save fails. Call them from handlers and effects, never during render.
For a controlled component, an action only calls the change callback
(`onOpenChange`), as a user's click would.

```tsx
const conflict = useComponent(dialog, {});

async function save(draft: string) {
  const response = await fetch('/api/draft', { method: 'PUT', body: draft });
  if (response.status === 409) conflict.actions.open();
}
```

## Part props in React

`parts.<name>` is a plain object of React props: attributes, event handlers, a
`style` object when the part has one, and a `ref`. UniAria converts its
[part props](./core.md#part-props) to React's names:

| Part props                                                                                             | React                                                                                                          |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `class`, `for`, `tabindex`, `readonly`, `autocomplete`, `inputmode`, `maxlength`, `contenteditable`, … | `className`, `htmlFor`, `tabIndex`, `readOnly`, `autoComplete`, `inputMode`, `maxLength`, `contentEditable`, … |
| `''` on a boolean attribute (`disabled`, `hidden`, `checked`, `required`, `readonly`, `inert`, …)      | `true`                                                                                                         |
| `aria-*`, `data-*`, `id`, `role`, `type`                                                               | Unchanged, as strings                                                                                          |
| `focusin`, `focusout`                                                                                  | `onFocus`, `onBlur` (React's bubble, like `focusin` and `focusout`)                                            |
| `input`                                                                                                | `onInput`                                                                                                      |
| `dblclick`                                                                                             | `onDoubleClick`                                                                                                |
| Other events: `click`, `keydown`, `pointerdown`, …                                                     | `onClick`, `onKeyDown`, `onPointerDown`, …                                                                     |
| `style` custom properties (`--anchor-width`)                                                           | Kept as they are in `style`                                                                                    |
| Other `style` properties (`inset-block-start`)                                                         | camelCase in `style` (`insetBlockStart`)                                                                       |
| `properties.value`, `properties.checked`                                                               | `defaultValue`, `defaultChecked`, from the first render only                                                   |

- **Handlers** are stable: each keeps its identity across renders and calls
  the handler from the latest state with `event.nativeEvent`. Definitions
  never see React's synthetic events.
- **The root's class.** `parts.root.className` is `uni-<name>`
  (`uni-switch`), the class your CSS and Tasty select the root by. A
  `className` after the spread replaces it, so join yours to it. In
  development, UniAria warns when the rendered root lacks it. The other
  parts get `data-scope` and `data-element` instead. See
  [Styling](../guide/styling.md#parts).
- **Your own handlers** go next to the spread as usual. If you pass the same
  prop (`onKeyDown`) after the spread, it replaces UniAria's; call both
  yourself if you need both.
- **Live values.** An input's `value` and a checkbox's `checked` are never
  controlled by React. React renders the starting value once, as
  `defaultValue` or `defaultChecked`, so the server HTML shows it, and UniAria
  sets the DOM property after that. Control the value through the component's
  props (`value`, `isSelected`), not through the element. Other live
  properties, such as a checkbox's `indeterminate`, are set after mount.

### Refs

Each part's props include a `ref`, a stable callback that hands the element to
UniAria. Keep it on the element: a `ref` written after the spread replaces it,
and the part stops working. To get the element yourself, read
`instance.element(part)` after mount, or wrap UniAria's ref in a stable
callback of your own:

```tsx
const save = useComponent(button, {});
const own = useRef<HTMLButtonElement | null>(null);
const ref = useCallback(
  (element: HTMLButtonElement | null) => {
    save.parts.root.ref(element);
    own.current = element;
  },
  [save.parts.root.ref],
);
return (
  <button {...save.parts.root} ref={ref}>
    Save
  </button>
);
```

### Item parts

Collections (Listbox, Select, Combobox) repeat item parts per item. Spread
`getItemProps(part, key)` onto each item's element, with the item's key as
React's `key`:

```tsx
const ui = useComponent(listbox, { items });
return (
  <ul {...ui.parts.list}>
    {items.map((item) => (
      <li key={item.key} {...ui.getItemProps('option', item.key)}>
        {item.textValue}
      </li>
    ))}
  </ul>
);
```

Item props are computed lazily, only for the items you render, and later
changes reach each row's element directly, so moving the highlight renders
nothing. One handler per part and event serves every item.

## useComponentState

```ts
useComponentState<D, T>(
  source: Instance<D> | ComponentHandle<D>,
  selector: (state: StateOf<D>) => T,
  isEqual?: (a: T, b: T) => boolean,
): T
```

Reads one value of a component's public state and renders again only when that
value changes: `Object.is` by default, or `isEqual`. The state is what the
component's page lists under State.

```tsx
import { dialog } from '@uniaria/core/dialog';

const confirm = useComponent(dialog, {});
const isOpen = useComponentState(confirm, (state) => state.isOpen);
```

- Select what the render needs, not the whole state: a selector that returns
  the state object renders on every change.
- A selector returning a new object or array each time needs an `isEqual`,
  such as a shallow comparison.
- The selector may be inline. A prop change that the selected value already
  shows doesn't cause a second render.
- It works in any component that has the instance or the handle, so a child
  can render from its parent's state without rendering the parent.

## Owners and links

Some components work inside another instance: a checkbox in its checkbox
group, a radio in its radio group, a control in its field. A component finds
its owner in this order:

1. **The `owner` prop**, an instance:
   `useComponent(checkbox, { value: 'sms', owner: group.instance })`. For
   parts that sit apart.
2. **`OwnerProvider`**, the nearest one whose instance has the owner's
   definition. It holds only the stable instance, so it renders nothing when
   state changes, and it crosses portals. The first render, and the server
   HTML, already have the owner's state.
3. **The DOM**, after mount: the nearest ancestor element that provides an
   owner, such as a `<uni-checkbox-group>` or a React group's part.

```tsx
import { checkbox } from '@uniaria/core/checkbox';
import { checkboxGroup } from '@uniaria/core/checkbox-group';
import { OwnerProvider, useComponent } from '@uniaria/react';
import type { ReactNode } from 'react';

function Option(props: { value: string; children: ReactNode }) {
  const ui = useComponent(checkbox, {
    value: props.value,
    labelElementType: 'span',
  });
  return (
    <label {...ui.parts.root}>
      <input {...ui.parts.input} />
      <span {...ui.parts.label}>{props.children}</span>
    </label>
  );
}

function Contact() {
  const group = useComponent(checkboxGroup, { defaultValue: ['email'] });
  return (
    <div {...group.parts.root}>
      <span {...group.parts.label}>Contact me by</span>
      <OwnerProvider owner={group}>
        <Option value="email">Email</Option>
        <Option value="sms">SMS</Option>
      </OwnerProvider>
    </div>
  );
}
```

`OwnerProvider` takes `owner`, an instance or the handle `useComponent`
returned, and `children`. Providers nest; each component takes the nearest
owner of the definition it needs.

**Links** go through a prop named after the link: a component that takes a
tooltip gets the tooltip's instance as `tooltip`:

```tsx
const hint = useComponent(tooltip, {});
const save = useComponent(button, { tooltip: hint.instance });
```

React components also answer lookups from the DOM: a custom element inside a
React checkbox group's part finds that group. See
[Composition](../guide/composition.md).

## Attributes UniAria owns

UniAria owns every attribute a part's props contain: ARIA state, `data-scope`,
`data-element`, state attributes such as `data-pressed`, and the ids and
references it writes, plus the root's `uni-<name>` class. The rest of the
element, other classes included, is yours.

In development, the first time each part element mounts, UniAria compares its
attributes with the part props React just rendered. When you wrote one of its
attributes yourself (a `type`, a `data-pressed`, an `aria-expanded` after the
spread), it warns:

```
[uniaria] button: "type" on the root part is written by UniAria, but the element has "submit". Pass it as a prop, or drop it from the JSX.
```

Pass the value as the component's prop instead (`type: 'submit'`), or remove
it. Some components add warnings of their own, such as Button's when the
rendered tag doesn't match `elementType`. Warnings are on while
`process.env.NODE_ENV` isn't `'production'`.

## StrictMode

UniAria works under `StrictMode`. Starting and stopping an instance is
idempotent and can repeat, so the double mount attaches one set of listeners,
and effects that restore focus or unlock scrolling don't act on the simulated
unmount.

## Server rendering

`useComponent` renders complete HTML on the server: ids, ARIA attributes,
state attributes, the root's `uni-<name>` class, `data-scope` and
`data-element`, starting values of inputs and checkboxes, and state you
select with `useComponentState`. Owners found
through `OwnerProvider` are part of it. Effects never run on the server, so
no listener, focus change or measurement happens there, and layout effects
fall back to plain effects so React doesn't warn. On the client, React
hydrates the same markup, and UniAria attaches to the elements without a
second render.

In React Server Components frameworks, `useComponent` is a hook like any
other: call it from a client component (`'use client'`). See
[Server rendering](../guide/server-rendering.md).

## Types

| Type                    | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `ComponentHandle<D>`    | What `useComponent` returns.                                 |
| `ReactPartProps`        | Props for one part: attributes, handlers, `style` and `ref`. |
| `OwnerProviderProps<D>` | `owner` (an instance or a handle) and `children`.            |

Component props and state types come from each component's subpath:
`ButtonProps` and `ButtonState` from `@uniaria/core/button`.
