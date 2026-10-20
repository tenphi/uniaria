---
title: Styling
description: Style every part with your own CSS, through part markers, state attributes and a few CSS variables.
---

UniAria has no look. You write the markup and the CSS; UniAria marks your
elements so the CSS can follow the component's state. Any styling approach
works: plain CSS, CSS modules, Tailwind, a CSS-in-JS library, or
[Tasty](https://tasty.style).

To start from a look rather than a blank page, the optional
[default styles](./default-styles.md) style every component the way this page
describes, and [Theming](./theming.mdx) changes their colors and sizes.

## Parts

Every element a component manages is a _part_, and UniAria marks each one
with an attribute so your CSS can find it:

| Part                    | Marker                                                                  | Example                           |
| ----------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| The root                | `data-uni` with the component's name, in kebab case                     | `data-uni="checkbox"`             |
| A part outside the root | `data-uni-part` with the component's name and the part's, in kebab case | `data-uni-part="popover-trigger"` |
| Every other part        | `data-element` with the part's name, capitalized                        | `data-element="Indicator"`        |

Each component page lists its parts by name; a part named `hiddenSelect` is
`data-element="HiddenSelect"`, and stays `parts.hiddenSelect` in JavaScript.
Item parts, such as options, also carry their `data-key`.

The root is the component's outermost element, so a style on it reaches
every part, a field's label and messages included. A box inside it, such as
a text field's around its input or a checkbox's `label`, is the `wrapper`
part. Overlays are the exception: their root is the panel, and the trigger
and the anchor sit outside it, which is why they carry `data-uni-part`.

Many components work without their root, but then nothing ties their parts
to them: a root-less checkbox's input is a `[data-element='Input']` like any
other. Render the root to style a component, or style its parts by your own
classes.

The markers are attributes, so `class` is all yours. In React, spreading the
part props is enough, and any `className` you pass sits beside them; UniAria
warns in development when your JSX replaces a marker. With the custom
elements, you write the markers in your markup, where the element finds its
parts by them.

Your own elements inside a component take `data-element` too, such as a
switch's thumb: `<span data-element="Thumb">`. CSS and Tasty then treat them
like parts (in Tasty, as sub-elements). Pick a name that isn't one of the
component's parts, which UniAria would take as that part. UniAria leaves
your elements alone, with no state attributes, so style them from the state
of the part or root around them.

### Plain CSS

Select the root by `data-uni` and the other parts by `data-element` inside
it, and a part outside the root by `data-uni-part`:

```css
[data-uni='switch'] {
  display: flex;
  gap: 1rem;
}
[data-uni='switch'] [data-element='Indicator'] {
  inline-size: 2.5rem;
  block-size: 1.5rem;
  border-radius: 999px;
}
[data-uni='switch'] [data-element='Indicator'][data-selected] {
  background: var(--accent);
}
[data-uni-part='popover-trigger'][data-open] {
  background: var(--active);
}
```

A component inside another one has parts of its own, which a descendant
selector reaches too: the label of a checkbox in a CheckboxGroup matches
`[data-uni='checkbox-group'] [data-element='Label']`. Leave out what is
inside a nested root:

```css
[data-uni='checkbox-group']
  [data-element='Label']:not(
    [data-uni='checkbox-group'] [data-uni]:not([data-uni='checkbox-group']) *
  ) {
  font-weight: 600;
}
```

### Tasty

With [Tasty](https://tasty.style), the root is the Tasty component itself:
spread `parts.root` on it, and it keeps `data-uni` next to its own class.
The other parts are sub-elements, styled under capitalized keys. A state in
a sub-element's styles is the root's; `@own()` reads the part's own:

```tsx
import { tasty } from '@tenphi/tasty';
import { checkbox } from '@uniaria/core/checkbox';
import { useComponent } from '@uniaria/react';

const CheckboxRoot = tasty({
  as: 'label',
  styles: {
    display: 'inline-flex',
    gap: '1x',
    Indicator: {
      fill: { '': '#surface', '@own(hovered)': '#hover', selected: '#accent' },
    },
  },
});

export function Terms() {
  const terms = useComponent(checkbox, { labelElementType: 'span' });
  return (
    <CheckboxRoot {...terms.parts.root}>
      <input {...terms.parts.input} name="terms" />
      <span {...terms.parts.indicator} />
      <span {...terms.parts.label}>Accept the terms</span>
    </CheckboxRoot>
  );
}
```

A parent styles a component inside it through its root, with Tasty's `$`
selector affix, and a part through the root it is in:

```tsx
const Settings = tasty({
  styles: {
    display: 'grid',
    gap: '2x',
    // Every checkbox inside, by its root.
    Checkbox: { $: '[data-uni="checkbox"]', padding: '1x 0' },
    // A Select's options, not a Listbox's.
    Option: { $: '[data-uni="select"] @', radius: true },
  },
});
```

## State attributes

UniAria writes a component's state to its parts as attributes and keeps them
current. Most are present or absent (`data-pressed=""`), never `"false"`;
a few carry a value. The common ones:

| Attribute                        | Present when                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `data-hovered`                   | A mouse or pen is over the part. Never from touch.                              |
| `data-pressed`                   | A pointer or key is pressing the part.                                          |
| `data-focused`                   | The part has focus.                                                             |
| `data-focus-visible`             | The part has focus from a keyboard or a screen reader, not a pointer.           |
| `data-focus-within`              | Focus is on the part or inside it.                                              |
| `data-disabled`                  | The component, or this item, is disabled.                                       |
| `data-readonly`                  | The value can't be changed.                                                     |
| `data-required`, `data-invalid`  | The field is required, or marked invalid.                                       |
| `data-selected`                  | A checkbox, switch, radio, toggle button or option is selected.                 |
| `data-indeterminate`             | A checkbox is in the mixed state.                                               |
| `data-open`                      | An overlay or a select's popup is open.                                         |
| `data-entering`, `data-exiting`  | An overlay is opening (its first frames) or closing (until its animations end). |
| `data-placement="top"`           | A positioned overlay landed on this side, after fallbacks.                      |
| `data-orientation="vertical"`    | A list or group's orientation.                                                  |
| `data-placeholder`, `data-empty` | A select has no value; a list has no options.                                   |

Each component page lists exactly which attributes go on which part. Because
state is written on every part, you can style a label or an icon from the
component's state without reading it in JavaScript.

### Why not `:hover`, `:active` and `:focus-visible`?

Use them if they work for you; the attributes fix what they get wrong for
components:

- `:hover` sticks on touch screens after a tap. `data-hovered` comes only from
  a mouse or pen.
- `:active` follows Space on a native button but not Enter, never follows a
  custom widget's keys, and stays on while the pointer is dragged off.
  `data-pressed` follows every input and ends as soon as releasing would no
  longer activate.
- `:focus-visible` follows each browser's own heuristics, which differ for
  focus moved by a script. `data-focus-visible` follows one rule everywhere:
  focus is visible after a keyboard or screen-reader interaction.
- A custom widget's state (an option's highlight, a list's orientation) has no
  pseudo-class at all.

ARIA attributes such as `[aria-checked]` or `[aria-expanded]` are also
selectable, but they differ between a native element and a custom one. The
`data-*` attributes are the same on both.

## Animating overlays

Overlays (Dialog, Popover, Tooltip, and the popups of Select and Combobox)
stay mounted and move through three phases you can animate:

- `data-entering` is present for the first frames after opening. Transition
  from it, with no transition while it is present:

  ```css
  [data-uni='popover'] {
    transition:
      opacity 150ms,
      translate 150ms;
  }
  [data-uni='popover'][data-entering] {
    opacity: 0;
    translate: 0 -4px;
    transition: none;
  }
  ```

  The browser can compute an overlay's style as it shows, before
  `data-entering` lands: a dialog moving focus in, a popover being measured.
  A transition into the hidden look would then start from the shown one and
  turn back, and the opening would barely show.

- `data-exiting` is present after closing until the animations running on the
  part and inside it finish, `::backdrop` included. UniAria reads them from
  the page with `getAnimations()`, so durations stay in your CSS and nothing
  waits a fixed time.
- `data-open` is present while open. A tooltip opened without its delay also
  gets `data-instant`, so it can skip the entrance.

## CSS variables

Positioned overlays (Popover, Tooltip, and the popups of Select and Combobox)
get three variables on their root part, which is the `popover` part in Select
and Combobox:

| Variable             | Value                                                                |
| -------------------- | -------------------------------------------------------------------- |
| `--anchor-width`     | The trigger's width in pixels, for `min-width: var(--anchor-width)`. |
| `--available-width`  | The most room the overlay could take horizontally, in pixels.        |
| `--available-height` | The most room it could take vertically, for `max-height`.            |

Nothing caps an overlay's size unless your CSS uses them. They resolve on that
part only, so use them there, not in its children.

## Styles UniAria sets

UniAria sets a style only where a behavior can't work without it, and as an
inline style (which your own inline style wins over) or inside an anonymous
`@layer` (which any of your rules wins over):

| Style                                           | Where                                                                                                                                                       | Why                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `touch-action: pan-x pan-y pinch-zoom`          | Pressable parts: buttons, triggers, options                                                                                                                 | Removes the double-tap delay on touch screens and lets a scroll cancel a press.                                         |
| `position`, `inset` and the variables above     | Positioned overlays, while open                                                                                                                             | Places the overlay against its trigger. In CSS mode, only `position-anchor`. See [Overlays](./overlays.md#positioning). |
| `hidden` attribute                              | A field's error while not shown, filtered-out options, a list's empty message while it has options, and closed popovers in browsers without the Popover API | Hides what isn't shown.                                                                                                 |
| Visually hidden styles                          | Select's hidden native `<select>`                                                                                                                           | Keeps it out of sight but available to autofill and forms.                                                              |
| `overflow: hidden` on `<html>`, and more on iOS | While a modal dialog is open                                                                                                                                | Stops the page from scrolling behind it, without the layout shifting when the scrollbar goes.                           |

Everything else is yours, including hiding the native input of a checkbox,
switch or radio. A common recipe lays the input over its `label`, the
`wrapper` part or a `label` root, invisible but still clickable and
focusable:

```css
label.uni-checkbox,
[data-uni='checkbox'] [data-element='Wrapper'] {
  position: relative;
}
[data-uni='checkbox'] [data-element='Input'] {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: inherit;
}
```

## State in your framework

When a style can't come from an attribute, such as a different icon for an
open popover, read the state in your framework: `useComponentState` in React,
or the element's events and `instance.getState()`. See [State](./state.md).
