---
title: Overlays
description: The top layer, dismissal, nesting, focus and positioning for dialogs, popovers and tooltips.
---

[Dialog](../components/dialog.mdx), [Popover](../components/popover.mdx) and
[Tooltip](../components/tooltip.mdx), and the popups of
[Select](../components/select.mdx) and [Combobox](../components/combobox.mdx),
share one model for opening, closing, stacking and placing.

## The top layer, without portals

Overlays open in the browser's top layer: a dialog is a native `<dialog>`
opened with `showModal()`, and a popover's root gets `popover="manual"` and
opens with `showPopover()`. The top layer sits above
everything else on the page, whatever its `z-index` or `overflow`, so UniAria
never moves your elements into a portal. An overlay's markup stays where you
wrote it, next to its trigger, which keeps the tab order, React context and
CSS inheritance intact.

Overlays stay mounted while closed. Opening one changes attributes, not your
component tree, so it renders nothing in React. To mount expensive content
only while open, select `isOpen` with
[`useComponentState`](./state.md#reading-state).

The Popover API is Baseline only since January 2025. In browsers without it,
popovers open in place: `hidden` while closed, `position: fixed` while open.
Give them a `z-index` for those browsers.

## Opening and closing

`isOpen` is a [bindable value](./state.md#values-the-user-changes): leave it
to the component with `defaultOpen`, or control it with `isOpen` and
`onOpenChange`. When controlled, every way of closing (Escape, an outside
press, the close button) only asks; the overlay stays open until you set
`isOpen` to `false`.

Each overlay closes:

- with **Escape**, if it is dismissable and `isKeyboardDismissDisabled` isn't
  set;
- with a **press outside** it (a modal dialog: on its backdrop), if it is
  dismissable;
- when its **trigger** is pressed again (popovers);
- when its **close** part is pressed, if it has one.

`isDismissable: false` turns off Escape and outside presses; the trigger, the
close part and your code still close it. A `dismiss` event before each close
says why: `'escape'`, `'outside'`, `'trigger'`, `'close'`, `'browser'` (removed
from the page while open), and for popovers also `'blur'` (focus left a
non-modal one), `'scroll'` and `'parent'` (the popover it was opened from
closed).

### One click outside does two things

A press outside a popover closes it _and_ acts on what it hit, so a single
click on another button closes the menu and presses that button. (React Aria
needs a second click.) A modal dialog is different: the page outside it is
inert, so a press outside only dismisses the dialog.

Use `shouldCloseOnInteractOutside` to keep a popover open for chosen targets,
such as a toast or a related panel.

### Nested overlays

Overlays form one stack per page. A press closes every overlay it is outside
of, from the top down, stopping at one that contains it or at a modal dialog.
Closing an overlay closes the overlays opened from inside it. Escape closes
only the top one.

A dialog opened from inside a popover stacks above it and leaves it open; a
popover used inside a modal dialog must be inside the dialog's element (it is,
when its markup is), since everything outside a modal dialog is inert.

## Focus

- **On open**, focus moves to the first element inside marked `autofocus` (or
  `data-autofocus`), else to the overlay itself, so a screen reader reads its
  name first and no action is focused by surprise.
- **While open**, Tab stays inside a dialog and a popover. A non-modal popover
  (`isNonModal`) lets Tab move in and out, and closes when focus leaves it.
- **On close**, after its exit animations, focus returns to the trigger, else
  to what had focus before, unless the user already moved it elsewhere (a
  press outside a popover leaves focus where the press put it).
- **Tooltips** never take focus. They open on hover after a delay, at once on
  keyboard focus, and close on Escape, a press, or the pointer and focus
  leaving.

While a modal dialog is open, the page behind it is inert and can't scroll.
While a modal popover is open, the page outside it is hidden from assistive
technology (`aria-hidden`) but stays interactive, so one click can close the
popover and act.

## Positioning

Popover, Tooltip, and the popups of Select and Combobox are placed against an
anchor: their `anchor` part if you render one, else the trigger. Their
options are CSS Anchor Positioning's own:

| Prop                   | Like CSS                 | Example                                             |
| ---------------------- | ------------------------ | --------------------------------------------------- |
| `positionArea`         | `position-area`          | `'bottom'`, `'bottom span-right'`, `'top'`          |
| `positionTryFallbacks` | `position-try-fallbacks` | `'flip-block, flip-inline'` (the default), `'none'` |

The gap between the overlay and its anchor is the overlay's `margin` in your
CSS: the margin facing the anchor is the gap, and the others keep it off the
viewport's edges. `data-placement` says which side it landed on after
fallbacks, so an arrow or an animation can follow it.

### Script mode and CSS mode

The page picks one of two modes, once:

```ts
import { configure } from '@uniaria/core/dom';

configure({ positioning: 'css' });
```

- **Script mode** (`'script'`, the default) works in every browser. UniAria
  places the overlay by CSS anchor positioning's rules, with
  `position: fixed` and the `inset` properties, and checks every frame while
  it is open.
- **CSS mode** (`'css'`) leaves placing to your CSS anchor positioning.
  UniAria only links the overlay to its anchor (`position-anchor`) and reads
  back the side for `data-placement`; `positionArea` and
  `positionTryFallbacks` are ignored, and so is any browser without anchor
  positioning (UniAria warns about it in development).

```css
/* CSS mode */
.menu {
  inset: auto;
  position-area: bottom span-right;
  position-try-fallbacks: flip-block;
  margin: 8px 0;
}
```

With the [default styles](./default-styles.md),
`@uniaria/styles/css/positioning.css` places every overlay this way, on its
default side. Script mode stays the default until anchor positioning is
Baseline widely available. In both modes UniAria writes `--anchor-width`,
`--available-width` and `--available-height` on the overlay's root, and the
arrow's offset along its edge. See [Styling](./styling.md#css-variables).
