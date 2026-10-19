---
title: Introduction
description: What UniAria is, what it does for you, and the ideas behind it.
---

UniAria is a library of accessible component behavior. It gives a button, a
checkbox, a dialog or a combo box everything except its look: keyboard
handling, focus management, ARIA roles and states, dismissal, selection,
positioning and the small browser fixes that real users need. You bring the
markup and the CSS.

Each component's behavior is written once, in plain TypeScript, as a
_definition_. Two small adapters bind every definition to a framework:

- [`@uniaria/react`](../api/react.md): `useComponent(definition, props)`
  returns props to spread onto your elements.
- [`@uniaria/elements`](../api/elements.md): every component is also a
  light-DOM custom element, such as `<uni-button>`, that wraps your markup. It
  works in plain HTML and in any framework that renders HTML: Vue, Svelte,
  Angular, server templates.

Both adapters run the same definition, and the same conformance tests check
both.

## Principles

**Behavior once, for every framework.** A design system that serves React and
something else today maintains two implementations of every widget, and
their accessibility drifts apart. With UniAria, a fix lands in one place.

**Your markup, your CSS.** UniAria adds no elements to your markup, with two
exceptions: a live region for announcements, and the options of Select's
hidden native `<select>`. It writes attributes to the elements you mark as
parts: ARIA attributes, `data-scope` and `data-element`, and state attributes
such as `data-pressed` or `data-open`. Your CSS targets those and the root's
`uni-<name>` class. See [Styling](./styling.md).

**No re-renders for internal state.** Hovering a button, pressing it, moving
the highlight through a long list or opening a popover changes no React state
of yours. UniAria writes the change straight to the DOM. A component renders
again only for state it asks for, through a selector. See
[State](./state.md#reading-state).

**Native elements first.** A real `<button>`, `<input type="checkbox">` or
`<dialog>` sits under each component wherever HTML has one, so forms,
autofill, browser extensions and assistive technology get what they expect.
Overlays open in the browser's top layer with the Popover API and `<dialog>`,
so nothing is moved into a portal.

**Accessibility that is checked, not claimed.** Each component follows its
[WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/)
pattern, and React Aria is the reference for browser and screen-reader edge
cases. Conformance scenarios drive real mouse, touch and keyboard input in
Chromium, Firefox and WebKit, check what a screen reader would say, and run
nightly against VoiceOver and NVDA. See [Accessibility](./accessibility.md).

**Small and dependency-light.** Small utilities are written in-house. The only
runtime dependencies are `@internationalized/number` for NumberField's
locale-aware numbers, and TanStack Virtual, bundled into the optional
`@uniaria/core/virtual` entry.

## What UniAria is not

- **Not a styling library.** There are no themes and no default look. UniAria
  sets a style only where a behavior can't work without it, such as
  `touch-action` on pressable elements, and such rules yield to yours.
- **Not a form library.** Fields show validation state you give them; they
  don't validate. See [Forms](./forms.md).
- **Not a set of framework components.** In React you get hooks that return
  props, not `<Button>` components, so your design system decides the
  component API.

## Components

The first release covers Button (with link mode), ToggleButton, Field,
TextField (inputs and text areas), NumberField, Checkbox, CheckboxGroup,
Switch, RadioGroup, Dialog, Popover, Tooltip, Listbox, Select and Combobox.
See [Components](../components/index.mdx).

## Status

UniAria is pre-alpha and nothing is published yet. It is built by AI agents
and reviewed by its author, [@tenphi](https://github.com/tenphi), who also
made [Tasty](https://tasty.style) and [Glaze](https://glaze.tenphi.me). Its
first consumer is [Cube UI Kit](https://github.com/cube-js/cube-ui-kit). See [Contributing](../contributing/index.md)
for how the work is organized.
