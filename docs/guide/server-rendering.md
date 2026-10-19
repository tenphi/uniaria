---
title: Server rendering
description: What server-rendered HTML contains, and what changes when the page hydrates or the elements upgrade.
---

Every UniAria entry imports safely on a server: nothing touches `document` or
`window` when a module loads, and each entry is checked by importing it in
Node. Effects, timers and listeners start only in the browser.

## React

`useComponent` renders each part with its current props on the first render,
so the server HTML already has the roles, ARIA states, ids and state
attributes a component starts with: a selected checkbox's `checked`, a
disabled button's `disabled`, a listbox's selected options.

- **Ids** come from React's `useId`, so they match between the server and the
  client. An id you write on a part after the spread is in the server HTML,
  but references to the part (a label's `for`) name its own id until
  hydration, when UniAria finds yours. Pass the id through the component's
  prop (`inputId`, `listId` and similar) for references that are right
  before hydration (see [Ids](./accessibility.md#ids)).
- **Live values** such as an input's `value` and a checkbox's `checked` render
  once, as `defaultValue` and `defaultChecked`, so the server HTML shows them
  and React never controls the element afterwards.
- **Owners** found through [`OwnerProvider`](./composition.md#in-react)
  resolve during the first render, so a radio's `checked` from its group's
  value is in the server HTML. A child that finds its owner through the DOM
  links after hydration instead.
- **References to optional parts**, such as a field's `aria-describedby`
  pointing at its description, are added once the part is in the DOM, in a
  layout effect before the first paint. The server HTML has every `id` and the
  label's `for`.
- **Overlays** are in the HTML, closed: a popover's root has
  `popover="manual"`, which hides it, and a dialog isn't `open`. One with
  `defaultOpen` opens after hydration, since opening a modal `<dialog>` needs a
  browser.

## Custom elements

On the server, a custom element is just your markup. It works as HTML until
the element upgrades in the browser: a button submits its form, a link
navigates, a checkbox toggles and submits, a `<dialog>` stays closed.

When it upgrades, the element reads its starting state from that markup where
HTML has it: a checkbox's `checked`, a text field's `value`, a link's `href`,
each part's `id`, a list's options and the label's tag. Then it writes the
rest: roles that HTML can't express (`role="switch"`), ARIA links between
parts, state attributes and keyboard handling.

Elements upgrade in any order. A child that connects before its owner (a
radio before its group) waits, and links when the owner connects.

## Hydration and the first paint

Everything UniAria writes after the first render goes straight to the DOM,
without a render. Style the state attributes, not framework state, and the
page looks right from the first paint after hydration.
