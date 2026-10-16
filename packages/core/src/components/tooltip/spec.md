# Tooltip spec

Status: approved by @tenphi on 2026-10-16

## Summary

A tooltip: a short text that describes a control, shown when the pointer
rests on it and when it takes keyboard focus. Cube UI Kit's `TooltipTrigger`
and `TooltipProvider` are the model (its Button, Checkbox, Radio and Item
`tooltip` props). UniAria shows the tooltip in the top layer as a manual
popover, as Popover does, and places it next to its trigger with the
positioning wrapper. The tooltip never takes focus and holds no interactive
content. Only one tooltip is open at a time, and once one has shown, the
next opens without waiting.

One definition, `tooltip`, holds an optional trigger, an optional anchor, the
tooltip and an optional arrow. A UniAria component can be the trigger
instead of the trigger part (Resolved questions 2).

- **WAI-ARIA pattern:** [Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/),
  still marked work in progress with no example
  (`references/aria-practices/content/patterns/tooltip/tooltip-pattern.html`):
  `role="tooltip"`, `aria-describedby` on the trigger, Escape dismisses it,
  focus stays on the trigger, and it stays open while the pointer is over the
  trigger or the tooltip.
- **Builds on:** `createPosition`, `createPresence`, `supportsPopover` and the
  modality tracker from `dom/`. New in `dom/`: the tooltip registry (warm-up
  and one at a time; Warm-up), the link components use to take a tooltip
  (Resolved questions 2), and the CSS-shaped positioning props (Resolved questions 1).
  No layer stack and no focus scope (Resolved questions 6).
- **Owner:** none. It is an owner for the component it describes (Resolved
  questions 2).
- **Custom element:** yes, `<uni-tooltip>`, wrapping the trigger and the
  tooltip, which hosts consumer markup.

Not part of Tooltip:

- **Interactive content.** A tooltip with a link or a button in it is a
  non-modal Popover (the APG: "a non-modal dialog"; UI Kit's ContextualHelp
  and InfoBadge popovers).
- **Detecting truncated text** (UI Kit's automatic tooltips): the design
  system measures and sets `isDisabled` while the text fits, as UI Kit keeps
  its provider disabled.
- **Touch** (Resolved questions 11).
- **Looks.** UniAria provides tokens (Styling tokens), not styles: UI Kit's
  `isLight`, width, gap and arrow shape are the design system's CSS, which can
  bind to those tokens.
- **Hover cards and previews** (React Aria's PreviewTrigger).

## Anatomy

| Part    | Element                                                                   | Attributes UniAria owns                                                                                          | Notes                                                                                                                                         |
| ------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| trigger | a focusable element that isn't another component's part; usually `button` | `aria-describedby` (`aria-labelledby` with `relation="label"`) while enabled                                     | Optional. A UniAria component linked to the tooltip takes its place (Resolved questions 2). Hover, focus and presses on it drive the tooltip. |
| anchor  | any                                                                       | none                                                                                                             | Optional. The tooltip is placed against it instead of the trigger (UI Kit's `targetRef`).                                                     |
| root    | any; usually `div`                                                        | `id`, `popover="manual"`, `role="tooltip"`, `data-placement`; state attributes; positioning styles (Positioning) | Hidden while closed. Text only: development warns when it holds a focusable element.                                                          |
| arrow   | any                                                                       | `aria-hidden="true"`, `data-placement`, state attributes; its offset along the edge (Positioning)                | Optional, as Popover's.                                                                                                                       |

State attributes on the root and the arrow: `data-open` while open,
`data-entering` for the first frame after opening, `data-exiting` while
closing, as Popover, and `data-instant` while it is open after opening
without its delay (Warm-up). The trigger gets none: when it is another
component's part, its attributes are that component's, and a tooltip's state
belongs to the tooltip.

Render the root always; it is hidden while closed. Render it next to the
trigger: inside a modal Dialog or a modal Popover it must be inside their
element, or it is inert or hidden from assistive technology.

## Props

| Prop                 | Type                       | Default                     | Bindable | Change event | Notes                                                                                                               |
| -------------------- | -------------------------- | --------------------------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| isOpen               | `boolean`                  | `false`                     | yes      | `openChange` |                                                                                                                     |
| isDisabled           | `boolean`                  | `false`                     | no       | —            | Never opens, closes when open, and takes the relation off the trigger. For a tooltip with nothing to say.           |
| delay                | `number`                   | `250`                       | no       | —            | Milliseconds the pointer rests on the trigger before it opens, while no tooltip is warm (Warm-up).                  |
| closeDelay           | `number`                   | `500`                       | no       | —            | Milliseconds after the pointer leaves the trigger and the tooltip before it closes.                                 |
| trigger              | `'hover' \| 'focus'`       | `'hover'`                   | no       | —            | `'focus'`: keyboard focus only, as UI Kit and React Aria.                                                           |
| relation             | `'description' \| 'label'` | `'description'`             | no       | —            | `'label'`: the tooltip names the trigger through `aria-labelledby`, for an icon-only button (Resolved questions 4). |
| positionArea         | `PositionArea`             | `'top'`                     | no       | —            | CSS `position-area`: a side, optionally an alignment span (Positioning).                                            |
| positionTryFallbacks | `string`                   | `'flip-block, flip-inline'` | no       | —            | CSS `position-try-fallbacks` (Positioning).                                                                         |

## Events

| Event        | Detail    | When                                                                                          |
| ------------ | --------- | --------------------------------------------------------------------------------------------- |
| `openChange` | `boolean` | Hover, focus, Escape, a press, scrolling or another tooltip opening asks to open or close it. |

No `dismiss` event: a tooltip closes for too many ordinary reasons, like the
pointer moving on, for a reason to be useful.

## Public state

| Field      | Type                                                  | Meaning                                                                       |
| ---------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| isOpen     | `boolean`                                             | The current value.                                                            |
| isEntering | `boolean`                                             | The first frame after opening, for enter animations.                          |
| isExiting  | `boolean`                                             | Closed, but still shown until its exit animations end.                        |
| isInstant  | `boolean`                                             | Open after opening without its delay (Warm-up), so CSS can skip the entrance. |
| placement  | `'top' \| 'bottom' \| 'left' \| 'right' \| undefined` | The side it was placed on, after fallbacks; `undefined` while it isn't shown. |

## Opening and closing

The tooltip is open while the pointer is over the trigger or the tooltip, or
while the trigger has visible keyboard focus: either keeps it open (the APG;
Resolved questions 9).

- **Hover** (mouse and pen) on the trigger opens it after `delay`, or at once
  while warm. Leaving before then cancels it. Leaving the trigger and the
  tooltip closes it after `closeDelay`; coming back before then keeps it.
- **Focus** opens it at once, when the focus is visible: the last input was a
  key, or a screen reader moved focus (Resolved questions 8). Focus from a pointer
  press doesn't open it, nor focus that a UniAria overlay restores as it
  closes (UI Kit), nor focus coming back when the window regains it. Blur
  closes it at once unless the pointer still holds it.
- **Escape** closes it from anywhere while it is open (Keyboard; Resolved
  questions 5).
- **A press on the trigger** closes it at once: a pointer down, or any key but
  a lone modifier, Tab or Escape (React Aria; UI Kit always).
- **After Escape or a press** it stays closed until the pointer leaves the
  trigger and the tooltip and comes back, or focus leaves and comes back.
- **Scrolling.** It follows the trigger (Positioning), and closes once the
  trigger has been scrolled out of view, as Popover (Resolved questions 9).
- **Another tooltip opening** closes it at once, without its closing phase,
  so two never show together (Warm-up).
- **Removing the trigger, or setting `isDisabled`,** closes it. A disabled
  trigger is not a disabled tooltip (Pointer and touch).
- **Controlled.** Every close only reports `openChange(false)`; the tooltip
  stays open until the consumer sets `isOpen` to `false`. A controlled
  tooltip that stays open doesn't count for one at a time.
- **The native popover.** The root carries `popover="manual"` and UniAria calls
  `showPopover()` and `hidePopover()`, as Popover, without a `source`: the
  tooltip takes no focus, so the Tab order doesn't matter, and the
  positioning wrapper names the anchor itself. `popover="hint"` and interest
  invokers would do part of this natively, but neither is Baseline
  (`web-features`: `hint` in Chrome 151 and Firefox 153, interest invokers
  in Chrome 142 only).
- **Closing phase**, as Popover: `data-exiting` until its animations end,
  then `hidePopover()`. Reopening cancels it.
- **Server rendering.** The root with `popover="manual"`, hidden where the
  Popover API exists, and the relation on the trigger (Resolved questions 3).
- **Without the Popover API**, as Popover: in place, `hidden` while closed,
  `position: fixed` while open, and the consumer gives it a `z-index`.
- **With a modal Dialog**, as Popover: a tooltip outside the dialog's element
  is inert while it is open; development warns when one opens then.

## Warm-up

A per-window registry, shared by every copy of UniAria on the page through
`Symbol.for('@uniaria/tooltips/v1')`, as React Stately's module state does for
UI Kit:

- **One at a time.** A tooltip that opens closes the one that is open, at
  once and without its closing phase.
- **Warm.** Once a tooltip has shown, the page is warm while one is open, and
  for `max(500, closeDelay)` milliseconds after the last one started closing
  (React Stately's cooldown). While warm, hover opens a tooltip at once, and
  it gets `data-instant` (`isInstant`) so CSS can skip its entrance, as React
  Aria, Zag and Floating UI do.
- **Cold.** The first hover waits `delay`. Moving to another trigger while
  waiting starts the wait again, for that one.
- Focus always opens at once and makes the page warm.

## Keyboard

| Key                               | Where                     | Behavior                                                                                                                                                                                                        |
| --------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab, Shift+Tab                    | onto the trigger          | Opens it at once (visible focus).                                                                                                                                                                               |
| Tab, Shift+Tab                    | off the trigger           | Closes it, unless the pointer is over the trigger or the tooltip.                                                                                                                                               |
| Escape                            | anywhere, while it's open | Closes it and prevents the key's default, so a Popover or Dialog it sits in stays open (they leave a prevented Escape alone). It doesn't stop propagation. Ignored while composing text (Resolved questions 5). |
| any other key but a lone modifier | trigger                   | Closes it (a press).                                                                                                                                                                                            |

## ARIA and state attributes per state

| State              | Part    | Attributes                                                                             |
| ------------------ | ------- | -------------------------------------------------------------------------------------- |
| enabled, closed    | trigger | `aria-describedby` = the root's id (`aria-labelledby` with `relation="label"`)         |
| enabled, closed    | root    | `id`, `popover="manual"`, `role="tooltip"`; hidden                                     |
| open               | root    | + `data-open`, `data-placement`; positioning styles; `:popover-open`, in the top layer |
| open               | arrow   | + `data-open`, `data-placement`                                                        |
| open after warm-up | root    | + `data-instant`                                                                       |
| first frame        | root    | + `data-entering`                                                                      |
| closing            | root    | − `data-open`, + `data-exiting`                                                        |
| disabled (tooltip) | trigger | no relation                                                                            |

The trigger gets no `aria-expanded`, `aria-haspopup` or `aria-controls`: a
tooltip isn't a popup the user opens (the APG, React Aria, UI Kit). The root
gets no `tabindex`.

## Focus

The tooltip never moves focus and can't take it: no `tabindex`, no focus
scope, and the APG sends interactive content to a non-modal dialog.
Development warns when the root holds a focusable element. Focus stays on the
trigger the whole time.

## Pointer and touch

- **Hover** counts for a mouse and a pen, over the trigger and the tooltip.
  Touch never opens it, and the mouse events iOS emulates after a tap are
  ignored (the modality tracker), as React Aria (Resolved questions 11).
- **Hovering the tooltip** keeps it open, so the pointer can reach it (WCAG
  1.4.13 Hoverable; the APG). The root takes pointer events; `closeDelay`
  covers the gap between the trigger and the tooltip, with no safe-area
  polygon (Resolved questions 10).
- **A pointer down on the trigger** closes it (Opening and closing).
- **A disabled trigger.** The tooltip ignores the trigger's disabled state:
  a tooltip that says why a button is disabled is the common case. Chromium
  153, WebKit 26.6 and Firefox 155 all dispatch pointer and mouse hover events
  to a natively disabled control (probed with `button[disabled]`,
  `input[type=checkbox][disabled]` and a disabled `fieldset`), so hover works.
  A disabled control can't take focus, so keyboard users need it focusable:
  Button, ToggleButton and Radio have `isFocusableWhenDisabled`, and Checkbox
  and Switch would get it (Resolved questions 12).
- **A trigger that can't take focus** (a truncated label) gets the tooltip on
  hover only, as UI Kit's automatic tooltips on text.

## Positioning

The positioning wrapper places the root against the anchor part, else the
trigger, as Popover's, in the mode the page picks (Popover spec, Positioning):
script mode, the default, places it from the props in every browser; CSS
mode, opt-in with `configure({ positioning: 'css' })`, leaves it to the
consumer's CSS anchor positioning and ignores the props. The props follow
CSS Anchor Positioning (owner, 2026-10-16; Resolved questions 1):

- **`positionArea`** is a CSS `position-area` value that puts the tooltip on
  one side of the anchor: a side keyword, physical (`top`, `bottom`, `left`,
  `right`), logical (`block-start`, `block-end`, `inline-start`,
  `inline-end`) or self-logical (`self-block-start`, …), optionally with the
  other axis's `center` or a `span-*` keyword: `top` centers it above,
  `top span-right` puts it above with the left edges aligned. Keywords mean
  what they mean in CSS: plain logical ones follow the page's writing mode
  (the top layer's containing block), `self-` ones the tooltip's own. Corners
  and areas over the anchor aren't supported: the arrow needs a side.
- **`positionTryFallbacks`** is a CSS `position-try-fallbacks` value: `none`,
  or a list of try tactics (`flip-block`, `flip-inline`, `flip-start`, and
  combinations) and `position-area` values of the same form. The default,
  `flip-block, flip-inline`, tries the opposite side on either axis. The
  last option that fit stays while it fits, as the browsers keep it.
- **Gaps are the root's `margin`**, from the consumer's CSS, as in CSS: the
  margin facing the anchor is the gap, the others keep the tooltip off the
  viewport's edges, and a fallback flips them with the area (try tactics swap
  margins). Script mode reads the computed margins, so margins that depend
  on state work in both modes.
- **Styles UniAria writes on the root**, only what placing it needs:
  `position` and the `inset` longhands in script mode, `position-anchor` in
  CSS mode (with a name added to the anchor's `anchor-name`), and the
  variables in both. Everything else is the consumer's.
- **The arrow**, as Popover's: UniAria writes its offset along the edge, and
  the consumer's CSS puts it on the side `data-placement` names.
- **In CSS mode** the tooltip's CSS gives it `inset: auto` (a popover's own
  is 0), its `position-area` and its fallbacks, as Popover's. UniAria reads
  the side the browser applied back from the computed `position-area`.

## Styling tokens

UniAria is not a styling library: the consumer's CSS comes separately and binds
to these tokens, so it can change with state. UniAria sets no look.

| Token                                                         | On                                 | Meaning                                                                      |
| ------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------- |
| `data-scope="tooltip"`, `data-part`                           | its parts                          | Which part an element is.                                                    |
| `data-open`, `data-entering`, `data-exiting`                  | root, arrow                        | Open; the first frame after opening; closing until its animations end.       |
| `data-instant`                                                | root, arrow                        | Open after opening without its delay (Warm-up): skip the entrance.           |
| `data-placement`                                              | root, arrow                        | The side it was placed on, after fallbacks.                                  |
| `--anchor-width`                                              | root                               | The anchor's width, in pixels.                                               |
| `--available-width`, `--available-height`                     | root                               | The most room it could take, in pixels, on the larger side when it may flip. |
| `isOpen`, `isEntering`, `isExiting`, `isInstant`, `placement` | public state (`useComponentState`) | The same, for a framework's own bindings.                                    |

The variables are written in both modes. CSS's own `anchor-size()` and
percentage sizes against the area work only in CSS mode.

## Expected spoken output

Probed with `@guidepup/virtual-screen-reader` for a button "Save"
with the tooltip "Saves the file"; the scenarios confirm it in both engines.

| State                                                      | Spoken phrase                                |
| ---------------------------------------------------------- | -------------------------------------------- |
| focus on the trigger, tooltip closed or open               | `button, Save, Saves the file`               |
| browsing past the open tooltip                             | `tooltip, Saves the file`                    |
| `relation="label"`, an icon-only button, tooltip "Edit"    | `button, Edit`                               |
| a focusable disabled trigger, tooltip "No changes to save" | `button, Save, No changes to save, disabled` |

A closed tooltip still describes its trigger: a hidden element that
`aria-describedby` references is still read (probed; Resolved questions 3).

## Adapter surface

A UniAria component links to the tooltip (Resolved questions 2):

```tsx
// React
const hint = useComponent(tooltip, { positionArea: 'top' });
const save = useComponent(button, { onPress, tooltip: hint.instance });
return (
  <>
    <button {...save.parts.root}>Save</button>
    <div {...hint.parts.root}>
      Saves the file
      <div {...hint.parts.arrow} />
    </div>
  </>
);

// A plain element as the trigger
<button {...hint.parts.trigger}>Save</button>;
```

```html
<!-- Custom element: a UniAria component inside links itself -->
<uni-tooltip position-area="top">
  <uni-button><button data-part="root">Save</button></uni-button>
  <div data-part="root">
    Saves the file
    <div data-part="arrow"></div>
  </div>
</uni-tooltip>

<!-- A plain element as the trigger -->
<uni-tooltip>
  <button data-part="trigger">Save</button>
  <div data-part="root">Saves the file</div>
</uni-tooltip>
```

Element attributes: `default-open`, `disabled`, `delay`, `close-delay`,
`trigger`, `relation`, `position-area`, `position-try-fallbacks`. Properties:
those by prop name, and `isOpen` (controlled). Events: `openchange`. A
component outside `<uni-tooltip>` links with a `tooltip` attribute naming
its id, as a checkbox names its group.

## Mapping from Cube UI Kit

| UI Kit                                                                 | UniAria                                                                           |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `TooltipTrigger` + `Tooltip`; `TooltipProvider title`                  | One `tooltip`: a linked component or a trigger part, and a root with the text.    |
| Button, Checkbox and Radio `tooltip` props                             | The component's link to a tooltip (Resolved questions 2).                         |
| `FocusableProvider`, function children, deprecated `activeWrap`        | The link, or the trigger part.                                                    |
| split trigger props (Checkbox: hover on the label, focus on the input) | The linked component routes hover from its visible part and focus from its input. |
| `targetRef`                                                            | The anchor part.                                                                  |
| `delay` 250, `closeDelay` 500                                          | The same.                                                                         |
| `trigger="focus"`                                                      | `trigger: 'focus'`.                                                               |
| `isDisabled`                                                           | The same; it also takes the relation off the trigger.                             |
| `isOpen`, `defaultOpen`, `onOpenChange`                                | The same.                                                                         |
| `placement` (`'top'`), `offset` 8, `crossOffset` 0                     | `positionArea` (`'top'`) and the root's `margin` (Positioning).                   |
| `shouldFlip` (declared, never passed)                                  | `positionTryFallbacks`.                                                           |
| `shouldCloseOnPress` (documented, always on)                           | Always on.                                                                        |
| the arrow, always rendered; `tipStyles`                                | The arrow part.                                                                   |
| `isMaterial` (hoverable); `pointer-events: none` by default            | Always hoverable (Resolved questions 10).                                         |
| `isLight`, width                                                       | Styles.                                                                           |
| disabled with an active tooltip turns `aria-disabled` (`keepEvents`)   | `isFocusableWhenDisabled` on the component (Resolved questions 12).               |
| automatic tooltips for truncated text                                  | The design system measures and sets `isDisabled`.                                 |
| no tooltip on focus restoration (CUB-4839)                             | The same, for focus a UniAria overlay restores.                                   |
| `aria-describedby` only while open                                     | While enabled (Resolved questions 3).                                             |
| Escape swallowed with `stopPropagation`                                | Prevented, not stopped (Resolved questions 5).                                    |
| no close on scroll                                                     | Closes when the trigger leaves view (Resolved questions 9).                       |
| `DisplayTransition` and the `open` mod                                 | `data-open`, `data-entering`, `data-exiting`, `data-instant`.                     |
| a portal into `Root`, `z-index: 100000`                                | The top layer.                                                                    |
| `qa`                                                                   | The consumer's attributes on the root.                                            |

## Differences from React Aria, Zag and native behavior

Each row was a choice for the owner, approved with the resolved questions as
recommended in the last column.

| #   | Topic                     | Cube UI Kit                                    | React Aria                                         | Zag, Floating UI, SWC, native                                          | Decided                                                   |
| --- | ------------------------- | ---------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Positioning props         | React Aria's `placement`, `offset`             | `placement`, `offset`, `crossOffset`, `shouldFlip` | Zag, Floating UI: placement strings; native: `position-area`           | CSS's own (Q1)                                            |
| 2   | Attaching to a component  | The component's `tooltip` prop                 | The component reads `FocusableContext`             | Zag: `mergeProps`; SWC: a `for` id; Lion: a slot                       | The component links to the tooltip (Q2)                   |
| 3   | Relation while closed     | Removed                                        | Removed                                            | Zag, Floating UI: removed; Lion, SWC 1st-gen: kept                     | Kept (Q3)                                                 |
| 4   | Tooltip as the name       | Only ItemAction, ItemBadge                     | No                                                 | Floating UI `useRole('label')`, Lion `invokerRelation`, SWC `labeling` | `relation="label"` (Q4)                                   |
| 5   | Escape                    | `stopPropagation`, from anywhere               | The same                                           | Zag: the same; SWC gen2: `preventDefault`; Lion: on the trigger only   | `preventDefault`, from anywhere (Q5)                      |
| 6   | Layer stack               | No                                             | No                                                 | SWC 1st-gen: in its overlay stack                                      | No (Q6)                                                   |
| 7   | Delays                    | 250 / 500                                      | 1500 / 500                                         | Zag 400 / 150; Lion 300 / 300; Floating UI 0 / 0; SWC 1500 / 300       | 250 / 500 (Q7)                                            |
| 8   | Focus                     | Visible focus; not on restored focus           | Visible focus                                      | Zag, Floating UI: visible; Lion: any focus                             | Visible focus; not on restored focus or window focus (Q8) |
| 9   | Hover ends, focus remains | Closes                                         | Closes                                             | Lion, the APG: stays                                                   | Stays (Q9)                                                |
| 10  | Scroll                    | Stays, doesn't follow                          | Closes on any ancestor scroll                      | Zag: closes; native: follows                                           | Follows; closes when the trigger leaves view (Q9)         |
| 11  | Hoverable                 | Only `isMaterial`                              | Yes                                                | Zag: `interactive`; Floating UI: opt-in; Lion, SWC, the APG: yes       | Yes (Q10)                                                 |
| 12  | Touch                     | No                                             | No                                                 | Zag, SWC gen2: no; Lion: long press; `interestfor`: long press         | No (Q11)                                                  |
| 13  | Disabled trigger          | Button and Radio stay focusable with a tooltip | No tooltip                                         | Lion: no tooltip; Floating UI: advises `aria-disabled`                 | Shown; `isFocusableWhenDisabled` for keyboard (Q12)       |

## Deviations from the WAI-ARIA pattern

None. The APG's pattern has no example and no task force consensus; UniAria
follows what it states (Escape, focus on the trigger, hoverable,
`aria-describedby`). `relation="label"` is an addition the pattern doesn't
cover.

## Resolved questions

Decided by @tenphi on 2026-10-16, each as recommended.

1. **Positioning props shaped like CSS Anchor Positioning** (owner,
   2026-10-16). Proposed (Positioning): `positionArea` and
   `positionTryFallbacks` take CSS values and are written as they are; the
   gap and the distance from the viewport's edges are the root's `margin` in
   the consumer's CSS, flipped with the area as CSS flips it; `--trigger-width`
   becomes `--anchor-width`. The Floating UI path parses the same values and
   reads the margins. Popover changes the same way, before Tooltip is
   built: `placement`, `offset`, `crossOffset`, `containerPadding` and
   `shouldFlip` give way to the two props and `margin`, its spec and
   scenarios with it (the scenario changes go to the owner). Its default stays
   `bottom`, with `flip-block, flip-inline`. What changes for consumers:
   React Aria's `'bottom start'` is `bottom span-right` (or
   `block-end span-inline-end`, which follows the page's direction), and UI
   Kit's offset 8 and padding 12 become margins in the design system's CSS.
   Decided: yes, as proposed. Amended 2026-10-16 (owner): `@floating-ui/dom`
   gave way to UniAria's own placement, and detection to two modes the page
   picks, script (the default, from these props) and CSS (the consumer's
   anchor positioning); see the Popover spec's Resolved questions 3.
2. **Attaching to a trigger another component owns.** A tooltip's trigger is
   usually a Button, a Popover's trigger or a Checkbox. One element can't be
   two components' parts today: both binders write `data-scope`, `data-part`
   and the attributes they own, and `<uni-tooltip>` can't see parts inside a
   nested `<uni-button>`. Options:
   - (a) **The component links to the tooltip**, as UI Kit's components take
     a `tooltip` prop and React Aria's read `FocusableContext`. The link works
     like a checkbox's link to its group: a `tooltip` prop with the instance
     in React, the nearest `<uni-tooltip>` or a `tooltip` id attribute on
     elements. The component routes hover from its visible part (Checkbox's
     root), focus and presses from its focusable part (Checkbox's input), adds
     the tooltip's id to its own `aria-describedby` (so it is in the server
     HTML), and is the anchor. Plain elements use the trigger part. Costs: a
     runtime change, since a component gets a second owner link besides its
     group or field; the link names a small key rather than the Tooltip
     definition, so Button's bundle doesn't carry Tooltip; and Button,
     ToggleButton, Checkbox, Switch, Radio, TextField and the triggers of
     Popover and Dialog each take the link, with spec and scenario updates. A
     tooltip takes one component: a second one that links is refused with a
     development warning.
   - (b) **One element, two components** (Zag's `mergeProps`, SWC 1st-gen):
     a trigger part may share its element with another component's part. It
     writes no `data-scope`, `data-part` or state attributes there, binders
     own `aria-describedby` and `aria-labelledby` id by id instead of whole,
     and React gets `mergeParts(save.parts.root, hint.parts.trigger)`. Costs: a
     runtime change to the binder and both adapters; the consumer picks the
     right element of a split control; custom elements still can't mark a
     part inside a nested host, so they need (c) as well.
   - (c) **A reference by id** (SWC gen2, Web Awesome, `<label for>`):
     `<uni-tooltip for="save">`, and the tooltip adds listeners and its id to
     that element itself. Costs: writes to an element it doesn't own, which
     needs the binder change from (b) and a watch for React rewriting the
     attribute; no relation in the server HTML; the anchor of a split control
     needs its own reference.

   Decided: (a). It gets split controls right by construction, writes no
   attribute another component owns, and matches UI Kit.

3. **When the trigger carries the relation.** React Aria, UI Kit, Zag and
   Floating UI set `aria-describedby` only while the tooltip is open; Lion and
   SWC 1st-gen keep it. A closed tooltip is still read as the description
   (probed: `button, Save, Saves the file`), so keeping it gives screen
   reader users the text however they reach the trigger, including by
   browsing, and puts it in the server HTML. Decided: while the tooltip
   is enabled; `isDisabled` removes it.
4. **The tooltip as the name of an icon-only button.** Floating UI, Lion and
   SWC offer it; UI Kit derives `aria-label` from the tooltip only in
   ItemAction and ItemBadge. Otherwise the name repeats as a description
   (React Aria's own example: `aria-label="Edit"` and the tooltip "Edit").
   Decided: `relation: 'label'`, which writes `aria-labelledby` instead
   and keeps `role="tooltip"` (Lion; probed: `button, Edit`).
5. **Escape.** WCAG 1.4.13 needs the tooltip dismissable without moving the
   pointer or focus, so Escape closes it from anywhere: a document capture
   `keydown` listener while it is open. React Aria, UI Kit and Zag then stop
   propagation, so nothing else on the page sees that Escape; UI Kit's
   bug list shows what that breaks. Decided: prevent its default instead
   (SWC gen2), which Popover's and Dialog's layers already respect, so the
   first Escape closes the tooltip and the second the popover around it.
6. **Not on the layer stack.** A tooltip on the stack above a modal popover
   would make presses on the popover count as outside presses for it, and
   take Escape away from the popover. Decided: tooltips stay off the
   stack. They handle Escape themselves (question 5); presses on a tooltip
   rendered inside a popover's element are inside it already; and the
   positioning is the same.
7. **Delays and warm-up.** UI Kit 250 / 500 ms, React Aria 1500 / 500, Zag
   400 / 150, Lion 300 / 300, SWC 1500 / 300. Decided: UI Kit's, with
   React Stately's warm-up (the registry, the cooldown of
   `max(500, closeDelay)`) and `data-instant` while warm.
8. **What focus opens it.** Visible focus only (React Aria, UI Kit, Zag,
   Floating UI); Lion opens on any focus, so a click shows it.
   Decided: visible focus, at once; not for focus a UniAria overlay
   restores as it closes (UI Kit, CUB-4839: a popover closing with Escape
   would otherwise pop the tooltip of its trigger), and not for focus coming
   back with the window (Floating UI).
9. **Closing rules.** (a) Hover and focus each hold it open, as the APG and
   Lion: a keyboard user's tooltip doesn't close because the mouse moved
   across the trigger. React Aria and UI Kit close it when either ends. (b) A
   press on the trigger closes it, as React Aria and UI Kit always do, but a
   lone modifier key doesn't. (c) Scrolling: it follows the trigger and
   closes when the trigger leaves view, as Popover's resolved question 10.
   React Aria closes on any ancestor scroll; UI Kit neither closes nor
   follows. Decided: all three as stated.
10. **Hoverable.** WCAG 1.4.13 needs the pointer to reach the tooltip
    without it closing. UI Kit's tooltips ignore the pointer unless
    `isMaterial`; React Aria, Lion, SWC and the APG keep them open while
    hovered. Decided: always hoverable, with `closeDelay` covering the
    gap and no safe-area polygon.
11. **Touch.** Long press (Lion, interest invokers) or nothing (React Aria,
    UI Kit, Zag, SWC gen2, which sends touch to a popover). Decided:
    nothing. A long press competes with the platform's own (text selection,
    context menus), and a description that matters on touch belongs in a
    Popover.
12. **Disabled triggers and `isFocusableWhenDisabled` for Checkbox and
    Switch** (from their review). Hover works on natively disabled controls
    in all three engines (probed), so a tooltip shows for the mouse; the
    keyboard needs the control focusable. Button, ToggleButton and Radio have
    `isFocusableWhenDisabled`. Decided: add it to Checkbox and Switch, as
    Radio's (`aria-disabled` instead of `disabled`, the toggle cancelled,
    not submitted), with their spec and scenario updates in this work. And
    no automatic switch when a tooltip links (UI Kit's `keepEvents` does it
    for Button and Radio): the design system sets the prop, so a control's
    tab order doesn't change with its tooltip.

## Open questions

None.
