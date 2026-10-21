---
title: Accessibility
description: What UniAria guarantees, how it is tested, what screen readers do, and what stays your job.
---

Every UniAria component follows its pattern in the
[WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/patterns/)
(APG), with React Aria as the reference for the browser and screen-reader
edge cases the patterns don't cover. Where a component deliberately differs
from the APG, its page says so and why.

## What UniAria handles

- **Roles, states and relationships**: `role`, `aria-checked`,
  `aria-expanded`, `aria-activedescendant`, labels and descriptions linked
  by id, and the rest, kept current as state changes. UniAria never writes
  `aria-disabled="false"` or `aria-invalid="false"`, which screen readers read
  aloud as "not disabled".
- **Keyboard support** as the APG describes, plus the details that make it
  work across browsers: Space and Enter timing, typeahead, focus wrapping,
  right-to-left arrows.
- **Focus management**: where focus goes when an overlay opens and closes,
  focus kept inside a modal dialog, a single tab stop for groups and lists,
  and a `data-focus-visible` attribute that is consistent across browsers.
- **Input from every device**: one press event for mouse, pen, touch, keyboard
  and screen-reader clicks; hover that ignores touch; presses that a scroll
  cancels.
- **Announcements**: a field's error when it appears, and other changes a
  screen reader wouldn't otherwise report, through one shared live region.
  While a modal dialog is open, the region moves inside it, since the page
  outside is inert.
- **Mobile quirks**: iOS scroll locking, emulated mouse events after a touch,
  dropped clicks after a long press, text selection during a touch press.

## Ids

Every part another part refers to gets an id: a label that names a control,
a description, a dialog's title, the list a combo box controls. A part keeps
an id you give it, and everything that refers to the part follows: the
label's `for`, `aria-labelledby`, `aria-describedby`, `aria-controls`,
`aria-activedescendant`. UniAria writes an id only on a part that has none,
and an id you change or remove later is followed too.

```html
<uni-text-field>
  <label data-element="Label" id="email-label">Email</label>
  <input data-element="Input" id="email" />
</uni-text-field>
```

In React, write the id after the part spread, so it wins over the part's
own: `<label {...ui.parts.label} id="email-label">`; in Vue, after `v-bind`:
`<label v-bind="ui.parts.label" id="email-label">`. The first render can't
see the element, so until hydration the server HTML refers to the part's
own id. Where that matters, as for a label's `for` before JavaScript runs,
name the control's id through the component's prop instead (`inputId`,
`controlId`, `triggerId`, `listId`): the server render uses it.

Without either, ids are generated from the component's id (`useId` in React
and Vue).
Options and the other repeated parts of a list always get ids made from the
list's id and their key, `<list id>-option-<key>`, since a combo box refers
to the highlighted option by its key.

## How it is tested

Each component has conformance scenarios, written from its approved
specification before its implementation. The same scenarios run:

| Run                   | When        | What                                                                                                                                                             |
| --------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browsers              | Every push  | Real mouse, touch and keyboard input through Playwright, in Chromium, Firefox and WebKit, through the React and Vue adapters and the custom elements.            |
| Virtual screen reader | Every push  | What a screen reader would say for each state, with [Guidepup's virtual screen reader](https://www.guidepup.dev/docs/virtual).                                   |
| VoiceOver and NVDA    | Every night | VoiceOver on macOS and NVDA on Windows, with Chromium, driven through [Guidepup](https://www.guidepup.dev), for scenarios whose speech only a real reader shows. |
| Render counts         | Every push  | In React and Vue, hovering, pressing, focusing, highlighting and opening an overlay render the owning component zero times.                                      |

Manual testing with screen readers, on mobile screen readers in particular,
hasn't been done yet.

## What real screen readers do

The nightly runs found behavior that comes from the screen readers and
browsers themselves, the same with plain HTML:

- **NVDA reads the page again** whenever anything in the top layer closes: a
  dialog, a popover, even a plain `<dialog>`. Its focus report then names the
  element focus returned to.
- **VoiceOver is sometimes silent** the first time a dialog opens on a page,
  also with a plain `<dialog>`.
- **A combo box's highlight** moving through the options isn't reliably
  captured from either reader's speech, so those scenarios check what the
  reader reports as focused, which names each option.

They also found one UniAria bug, now fixed: NVDA said "clickable" before every
control inside a custom element, because the element had click listeners on
itself. Custom elements now listen from the document (or shadow root) instead,
as React does.

## What stays your job

UniAria can't decide everything a page needs:

- **Names.** Give every control a label part, a visible label it can
  reference, or an `aria-label`. UniAria warns in development when a list has
  no name. Icon-only buttons need an `aria-label`.
- **Visible focus.** Style `data-focus-visible` (or `:focus-visible`) on every
  focusable part, with enough contrast.
- **Contrast, sizes and motion.** Colors, target sizes, and respecting
  `prefers-reduced-motion` in your transitions are in your CSS.
- **Required marks.** Mark a visual `*` with `aria-hidden="true"`; the control
  already says "required".
- **Content.** Error messages that say how to fix the problem, dialog titles,
  link text that makes sense on its own.
