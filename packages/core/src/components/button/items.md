# Items spec

Status: draft

## Summary

Cube UI Kit builds every row-like control on one `Item`: a button, a menu
item, an option, a Select or Picker trigger and a tab each have an icon, a
label, a description, a suffix and actions beside them, and the label is cut
to one line with a tooltip that shows the whole text once it's cut off
(`Item`, `ItemButton`, `TextItem`; research:
`scratchpad/items-spec/ui-kit.md`, and other libraries in
`scratchpad/items-spec/prior-art.md`). UniAria's buttons, triggers and options
can already hold all of this as content. Three things need UniAria: a name
that leaves the description and the hints out, actions beside a button (a
button can't hold buttons), and a tooltip that opens only while text is cut
off. This spec adds them to the components that exist, and the shared look to
`@uniaria/styles`:

1. **Label and description parts** on Button and ToggleButton, and on the
   triggers built on Button. With a label part, the label alone names the
   button, so a description, a badge or a shortcut hint inside it stays out
   of the name: `button, Save, Saves the file` instead of
   `button, SaveSaves the file⌘S` (probed).
2. **Extras:** a `frame` around a button and an `extras` part beside it, for
   buttons, badges and counts that belong to the button but can't be inside
   it: UI Kit's actions, named extras because they include badges (owner,
   2026-10-22). Options get **non-interactive extras**, which describe them.
3. **The overflow tooltip.** A tooltip can open only while its trigger's text
   is cut off (`shouldOpenOnlyWhenTruncated`), stay out of the accessibility
   tree (`relation: 'none'`), and show the cut-off text in a `text` part
   UniAria fills. A component links it as any tooltip; a list links one for
   all its options (`optionTooltip`).
4. **The item look** in `@uniaria/styles`: one grid for buttons with a label,
   frames and options, with labels cut to one line.

UI Kit's lessons decide how. Nothing wraps or unwraps the row: UI Kit's
tooltip provider remounted rows, which most of its auto-tooltip code works
around. Nothing is measured until a tooltip would open: UI Kit measures every
row as it mounts, which cost 122 ms of layout in one Cloud profile and, with
the state it sets, crashed a Cloud list (React's update depth limit,
CUB-5055). The overflow tooltip doesn't repeat the name to screen readers,
which UI Kit's does. The frame carries every state of its button, where UI
Kit projects three onto its wrapper and misses hover and selection. And the
layout is logical, so it mirrors in right-to-left text, where UI Kit pins its
actions to the physical right.

- **WAI-ARIA patterns:** [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  (the name comes from the content, or from `aria-labelledby`),
  [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/) (an option's
  children are presentational, so its extras can't be interactive: "that is a
  grid", Listbox spec) and
  [Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/).
- **Builds on:** Button, ToggleButton, Tooltip, Popover, Dialog, Select,
  Listbox and Combobox, which gain the parts, props and links below;
  Field's rule that only rendered parts are referenced; `createHover` from
  `dom/`. New in `dom/`: `isTruncated()` (Measuring). New beside Tooltip:
  the `optionTooltip` link key and a way for a list to drive one tooltip for
  many options. No change to the runtime's API; one to the custom-element
  contract and one to link keys (Runtime and harness changes).
- **Owner:** none. Links: `tooltip`, which Select now takes too, and
  `optionTooltip` (Listbox, Select, Combobox).
- **Custom element:** yes, in every component it touches.

Not part of this spec:

- **Interactive extras in options and menu items:** the Menu spec (extras as
  menu items) and then a grid mode for lists (extras as cells), in that order
  (owner, 2026-10-22).
- **Keyboard shortcuts and match highlighting:** with Menu and Combobox.
- **Hiding extras until hover** (UI Kit's `autoHideActions`): the consumer's
  CSS, from the state attributes on the extras.
- **Truncating in script** (middle truncation, a character count): the text
  stays whole in the DOM, and CSS cuts it.
- **Touch** gets no tooltip, as with every tooltip (Tooltip spec, Resolved
  questions 11).
- **A heading inside a button** (UI Kit's `type="header"` items): invalid
  content, and the heading role is lost. An accordion is a heading around a
  button (APG).
- **More ids** in a button's `aria-labelledby` and `aria-describedby`
  (Field's `labelledBy` and `describedBy` props): later, if a design system
  needs a button described by something outside it.
- **Re-measuring an open tooltip:** it isn't closed when its text grows to
  fit; it closes as any tooltip does.

## How it works

A button with an icon, a label, a description and two extras, and an
overflow tooltip:

```html
<uni-tooltip open-only-when-truncated relation="none">
  <uni-button>
    <div data-uni-part="button-frame">
      <button data-uni="button">
        <svg aria-hidden="true">…</svg>
        <span data-element="Label">Quarterly report, final version</span>
        <span data-element="Description">Edited 2 hours ago</span>
      </button>
      <span data-uni-part="button-extras">
        <uni-button>
          <button data-uni="button" aria-label="Share Quarterly report">
            …
          </button>
        </uni-button>
        <span>3</span>
      </span>
    </div>
  </uni-button>
  <div data-uni="tooltip"><span data-element="Text"></span></div>
</uni-tooltip>
```

- The label names the button and the description describes it
  (`aria-labelledby`, `aria-describedby`), so the icon and anything else in
  the button stay out of the name.
- The frame holds the button and its extras. The button is hovered while the
  pointer is anywhere over the frame, and its states are on the frame and the
  extras too, so the whole row looks like one thing in every state.
- The share button is a Button of its own beside the first, never inside it:
  its presses are its own, and it is a Tab stop after it.
- The tooltip measures the label and the description when the pointer
  arrives or keyboard focus does, and again as it opens. It opens only if one is cut off, writes
  the cut-off text into `Text`, and stays out of the accessibility tree: the
  whole text is in the button already.

## Label and description

### Anatomy

Button and ToggleButton gain two parts:

| Part        | Element                              | Attributes UniAria owns  | Notes                                                                                                                                                                      |
| ----------- | ------------------------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| label       | any, inside the root; usually `span` | `id` (unless it has one) | Optional. While rendered, the root's `aria-labelledby` is its id: it alone names the button, and an icon, a description, a badge or a shortcut hint stays out of the name. |
| description | any, inside the root; usually `span` | `id` (unless it has one) | Optional. While rendered, it describes the button: the root's `aria-describedby` starts with its id, before the tooltip's.                                                 |

- **Whole attributes.** UniAria writes the root's `aria-labelledby` while the
  label is rendered, and its `aria-describedby` while the description is
  rendered or a tooltip describes the button. Otherwise the consumer's own
  stay, as with a tooltip today (Button spec, Summary).
- **Rendered parts only,** as Field references its label and description:
  the references come once the elements exist, so they aren't in the server
  HTML, and until the adapter runs the button is named by its content.
- A consumer's `aria-label` loses to the label part's `aria-labelledby`, as
  in any browser.

### Triggers built on Button

Each component that composes Button maps the two parts:

| Component                                          | label          | description          |
| -------------------------------------------------- | -------------- | -------------------- |
| ToggleButton                                       | `label`        | `description`        |
| Popover, Dialog: the trigger                       | `triggerLabel` | `triggerDescription` |
| Popover, Dialog: the close button                  | none           | none                 |
| Select's trigger, Combobox's button, NumberField's | none           | none                 |

Popover's and Dialog's trigger parts sit outside the overlay, as the trigger
does: `data-uni-part="popover-trigger-label"`. Select's trigger is named by
the field's label and its value (Select spec) and has neither part.

## Extras

### Anatomy

Button and ToggleButton gain two parts outside the root (Runtime and harness
changes 1):

| Part   | Element                               | Attributes UniAria owns                                                                       | Notes                                                                                                                                                                                     |
| ------ | ------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| frame  | any; usually `div`                    | `data-uni-part="button-frame"`; the root's state attributes; its hover counts as the button's | Optional. Around the root and the extras: development warns when it doesn't hold the root. No role: the button and each extra are named on their own.                                     |
| extras | any, inside the frame; usually `span` | `data-uni-part="button-extras"`; the root's state attributes                                  | Optional. Beside the root, never inside it: the consumer's buttons (each a Button of its own), badges, counts and icons, in reading order. Any number of elements; the part is their box. |

ToggleButton's are `toggle-button-frame` and `toggle-button-extras`. The
triggers:

| Component | Frame                                                                                                                             | Extras                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Popover   | `triggerFrame` (`popover-trigger-frame`), outside the overlay                                                                     | `triggerExtras` (`popover-trigger-extras`)       |
| Dialog    | `triggerFrame` (`dialog-trigger-frame`), outside the dialog                                                                       | `triggerExtras` (`dialog-trigger-extras`)        |
| Select    | `triggerFrame`, inside the root (`data-element="TriggerFrame"`)                                                                   | `triggerExtras` (`data-element="TriggerExtras"`) |
| Combobox  | none: its `anchor` already holds the input and the button, and extras go in it, as a prefix or suffix goes in TextField's wrapper | none                                             |

A popup is placed against its trigger's frame when there is no anchor part:
the anchor part, else the frame, else the trigger. So a popup sized from
`--anchor-width` is as wide as the trigger with its extras (UI Kit's Picker).

### Behavior

- **States.** The frame and the extras carry the root's state attributes:
  Button's `data-pressed`, `data-focused`, `data-focus-visible` and
  `data-disabled`, ToggleButton's `data-selected`, and the composer's own,
  such as Popover's `data-open` and Select's `data-invalid`. Every part of a
  Checkbox carries its state the same way. CSS can paint extras for any state
  of their button, and show them only on hover or focus.
- **Hover counts over the frame.** With a frame, the button is hovered while
  the pointer is over the frame: over the button, an extra or a gap between
  them (`isHovered`, `data-hovered` on every part). Checkbox's wrapper is its
  hovered area in the same way. Without a frame, hover counts over the root,
  as today. A tooltip linked to the button still counts hover over the root
  alone, so an extra's own tooltip doesn't open the button's as well.
- **Presses.** An extra is a sibling of the button, so a press on it is the
  extra's and never the button's. No nested-pressable rule is involved, and
  nothing stops propagation.
- **Overlays.** A press on an extra is outside the trigger: an open popover
  closes and the extra acts, in one press, as for any control outside it
  (root AGENTS.md → Overlays; Open questions 4). Focus stays on the extra,
  since the popover hands focus off instead of restoring it. A modal popover
  keeps Tab inside it, so the extras are reached once it closes. A non-modal
  one closes when focus moves to an extra, as when focus moves anywhere else.
- **Keyboard.** Each extra is a Tab stop of its own after the button, in DOM
  order. `shouldExcludeFromTabOrder` takes one out (UI Kit's
  `disableActionsFocus`); the consumer then owes keyboard users another way
  to it.
- **Names.** Extras are not part of the button's name or description. Each
  extra names itself in its context: "Clear Fruit", "Remove Apple", never a
  bare "Close" repeated on every row (UI Kit's tags and tree rows). Text that
  should describe the button, such as a badge, goes in the description part,
  inside the button.
- **Disabled.** The frame and the extras show their button's disabled state.
  Extras are components of their own: disable each with the button when it
  acts on what the button does. UI Kit passes `isDisabled` through a context;
  UniAria has no context between components that aren't linked.

### Option extras

Listbox, Select and Combobox gain one item part:

| Part         | Element                                | Attributes UniAria owns | Notes                                                                                                                                                                                                                                                                |
| ------------ | -------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| optionExtras | any, inside the option; usually `span` | `id`                    | Optional item part, keyed by `data-key` as the others. Non-interactive: badges, counts, icons; development warns when it holds a focusable element. While rendered, it describes the option after its description: `option, Apple, Red and sweet New, not selected`. |

The option's `aria-describedby` lists the description's id and then the
extras' id, each while rendered. Hide decorative extras from assistive
technology with `aria-hidden`. Interactive extras need a grid (Not part of
this spec).

## The overflow tooltip

### Props and parts

Tooltip gains a prop, a relation and a part:

| Prop                        | Type                                 | Default         | Bindable | Change event | Notes                                                                                                                                                                                                                       |
| --------------------------- | ------------------------------------ | --------------- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| shouldOpenOnlyWhenTruncated | `boolean`                            | `false`         | no       | —            | Opens only while its trigger's text is cut off (Measuring): for a tooltip that shows text the trigger already holds. Attribute `open-only-when-truncated`.                                                                  |
| relation                    | `'description' \| 'label' \| 'none'` | `'description'` | no       | —            | New: `'none'`. Nothing references the tooltip, and its root is hidden from assistive technology (`aria-hidden="true"`), for text the trigger already holds (Fluent's `inaccessible`, Workday's `muted`, Primer's tooltips). |

| Part | Element                                     | Attributes UniAria owns  | Notes                                                                                                                                                                                                                                                   |
| ---- | ------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| text | any, inside the root; usually `span`, empty | its text (element-owned) | Optional. While open, the text of the trigger's text elements: those cut off with `shouldOpenOnlyWhenTruncated`, all of them without. One per line, separated by `\n`, which `white-space: pre-line` shows. Leave it out to write the content yourself. |

The text is each element's rendered text (`innerText`), read as the tooltip
opens: the whole text, not what the ellipsis left, without what CSS hides.
UniAria writes the `text` part as it writes Select's value, so a list's one
tooltip changes its text with no render (Runtime and harness changes 2).

### The trigger's text

What a tooltip measures and copies, by what triggers it:

| Trigger                                      | Text elements                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| the trigger part                             | the trigger                                                                               |
| Button, ToggleButton                         | the label and the description while rendered, else the root                               |
| Popover's or Dialog's trigger                | `triggerLabel` and `triggerDescription` while rendered, else the trigger                  |
| Select's trigger                             | the value part while rendered, else the trigger                                           |
| Checkbox, Switch, Radio                      | the label and the description while rendered                                              |
| TextField, NumberField                       | none: an input scrolls its text instead of cutting it, so an overflow tooltip never opens |
| an option, through its list's option tooltip | `optionLabel` and `optionDescription` while rendered, else the option                     |

A linked component names its text elements to the tooltip with the elements
it already hands over (Runtime and harness changes 4).

### Measuring

An element's text is cut off when the element clips what overflows it (its
`overflow` isn't `visible`) and:

- **its content is wider than its box:** `scrollWidth > clientWidth`, or a
  Range around its contents wider than its content box, beyond a small
  tolerance. The integers are rounded, so they miss an overflow under a
  pixel: probed in Chromium and WebKit, a label 0.2 px too wide shows its
  ellipsis while both read 161. Metabase and Element Plus moved to a Range
  for this; Element Plus allows 0.03 px, and antd's exact comparison misfires
  at 90% zoom (antd#59488). The tolerance is set during implementation, from
  probes at fractional zoom.
- **or it wraps and its content is taller than its box by more than a
  pixel:** a line clamp. Text that doesn't wrap (`white-space: nowrap`)
  can't be clamped, and Chromium reads a single line at `line-height: 1` a
  pixel taller than its box (probed: 15 against 14).

`isTruncated(element)` in `dom/` does this, and a tooltip asks it about each
text element:

- **when hover starts,** before the delay: text that fits starts no timer and
  doesn't warm the page up;
- **again when it opens,** after the delay, on focus, while warm and from the
  `open()` action, since the layout can change while it waits.

Nothing else measures: nothing on mount, nothing per row and no observers, so
a list of thousands of rows costs nothing until a pointer or focus arrives.
antd moved its measuring to `mouseenter` for this reason (3,000 items mounted
in 542 ms instead of 2,525 ms, antd PR #58806), and Fluent's `overflowMode`,
Workday's `OverflowTooltip` and MUI X's recipe measure the same way.

- **Controlled,** an overflow tooltip asks to open (`openChange(true)`) only
  while the text is cut off. An `isOpen` the consumer sets shows it anyway.
- **`open()`** does nothing while the text fits.
- **A disabled trigger.** An overflow tooltip never makes a disabled button
  focusable, which in UI Kit made a disabled button a Tab stop or not
  depending on the window's width. `isFocusableWhenDisabled` stays the
  consumer's (Tooltip spec, Resolved questions 12).
- **Safari** shows a tooltip of its own over text cut off with an ellipsis
  (an embedder setting with no opt-out for pages: WebKit bug 114304), so
  Safari users can see both. This needs checking in Safari during
  implementation: the styles may suppress it with the reported workaround
  if it holds.

### Option tooltips

Listbox, Select and Combobox take a second tooltip link, `optionTooltip`: one
tooltip for all their options. Options get no link of their own (root
AGENTS.md → Composition: collections stay data).

- **The list drives it.** Hover over an option, as Listbox counts hover (mouse
  and pen, not the mouse events iOS emulates after a tap), is hover over a
  trigger. Visible focus on an option (Listbox, Select) or the visible
  highlight (Combobox) is keyboard focus on one. The option is the anchor,
  and its text is measured and copied (The trigger's text).
- **Moving on.** Moving to another option while it's open moves it there at
  once if that option's text is cut off (the page is warm), and closes it
  otherwise.
- **Presses and typing.** A press on an option closes it, as a press on a
  trigger does, until the pointer leaves that option. Typing (typeahead, or
  Combobox's input) closes it until focus or the highlight moves with a
  navigation key: Arrow keys, Home, End, Page Up or Page Down.
- **Never a description.** The list writes no relation for it: give it
  `relation: 'none'`, or development warns. It is usually an overflow
  tooltip as well; without `shouldOpenOnlyWhenTruncated` it opens on every
  option.
- **Where it's rendered.** Inside the list's popup for Select and Combobox,
  beside the list, never inside an option: an option's name comes from its
  content. Inside the popup it isn't inert in a modal Dialog, and a press
  on it isn't a press outside the popup. On elements, the list names
  it with `option-tooltip="<id>"`; it isn't found through the host, so a
  `<uni-select>` inside a `<uni-tooltip>` takes that tooltip for its trigger
  only (Runtime and harness changes 3).
- **Virtualized lists.** An option that leaves the rendered set closes it, as
  a removed trigger does.
- **Placement** is any tooltip's, against the option. UI Kit puts option
  tooltips beside the list (`positionArea: 'right'`).

### Select's trigger tooltip

Select takes `tooltip` as well, which it couldn't until now (its spec already
says a tooltip on the trigger doesn't open for restored focus). Hover and
focus count on the trigger, the tooltip is placed against it, and its
relation follows Field's references in the trigger's `aria-describedby`, as
on a Checkbox's input. Its text is the value, so a cut-off value gets an
overflow tooltip (UI Kit's Select). Combobox doesn't take one: its input
scrolls.

## The item look

Changes to the `@uniaria/styles` spec, which land with it:

- **A shared `item` fragment** (`src/shared/item.ts`) for a Button or
  ToggleButton with a label part, Popover's and Dialog's triggers with a
  `triggerLabel`, and options. It is a grid of named columns: `icon`,
  `label`, `suffix`, and `extras` in a frame. The label takes the first row
  of `label` and the description the row under it; elements before the
  label go in `icon` and elements after it in `suffix`, found with `:has()`
  and sibling selectors, so the consumer adds no attribute. Paddings, gaps
  and sizes stay each component's (UI Kit's).
- **One line.** The label and the description take one line each and end in
  an ellipsis (Open questions 8). They are blocks with no inline padding:
  an ellipsis needs a block container (a flex label shows none), and
  padding puts the cut where the measuring least expects it. Clamping to
  more lines isn't Baseline (`line-clamp`), so it stays the consumer's CSS.
- **Frames.** The frame is the grid. The button spans all its columns and
  lays out on them as a subgrid, and the extras sit over the button in the
  `extras` column. The button's box (fill, border, radius, focus ring) is
  therefore under its extras in every state, with nothing projected and
  nothing measured. A framed button needs a label part, which takes the
  `label` column; without one, nothing keeps its content clear of the
  extras. Probed in Chromium and WebKit, left to right and right to
  left: labels end before the extras, and the gaps and padding between
  extras press the button. The extras take no pointer events except their
  direct children that act: buttons, links, UniAria roots and tooltip
  triggers. A badge doesn't block a press on its row (a UI Kit bug). The
  frame takes its button's text color in every state, variant included (read
  from the root's `data-variant` with `:has()`, so the consumer writes it
  once), so extras drawn in `currentcolor` match their button.
- **Triggers.** Select's chevron comes after its extras, as UI Kit's caret
  comes after its actions.
- **Quiet buttons** mix their hover and press fills from `currentcolor`, as
  UI Kit's `current` theme does, so a quiet extra reads on any fill,
  including a selected row's accent (Open questions 9).
- **Option extras** come after the suffix and before the selected check.
- **Tooltip text** keeps its line breaks (`white-space: pre-line`).
- **No new attribute.** The only attribute the styles ask of the consumer
  stays `data-variant` on Button and ToggleButton roots (styles spec,
  Resolved questions 10). `:has()` and
  subgrid are widely available (since 2026-06-19 and 2026-03-15,
  `web-features`), so the Web platform baseline lists them as allowed.
- **Screenshots:** galleries for buttons with labels and descriptions,
  frames with extras in every state and both directions, option extras and
  an overflow tooltip. Quiet buttons and cut-off option labels change their
  look, which is a minor release (styles spec, Resolved questions 13).

## New API

| Component                 | Prop or link                | Type                                                                       | Default | Notes                         |
| ------------------------- | --------------------------- | -------------------------------------------------------------------------- | ------- | ----------------------------- |
| Tooltip                   | shouldOpenOnlyWhenTruncated | `boolean`                                                                  | `false` | The overflow tooltip.         |
| Tooltip                   | relation                    | adds `'none'`                                                              | —       | Visual only.                  |
| Listbox, Select, Combobox | optionTooltip (link)        | a Tooltip instance (React, Vue); `option-tooltip`, an id (custom elements) | —       | One tooltip for every option. |
| Select                    | tooltip (link)              | as Button's                                                                | —       | The trigger's tooltip.        |

New parts: Button's and ToggleButton's `label`, `description`, `frame` and
`extras`; Popover's and Dialog's `triggerLabel`, `triggerDescription`,
`triggerFrame` and `triggerExtras`; Select's `triggerFrame` and
`triggerExtras`; the `optionExtras` item part of Listbox, Select and
Combobox; Tooltip's `text`.

No new events. No new public state: Button's and ToggleButton's `isHovered`
counts over the frame while one is rendered.

## Keyboard

Nothing new for buttons: Tab moves from a button to each of its extras in
DOM order. Option tooltips follow focus and the highlight (Option tooltips).
An overflow tooltip takes the keys any tooltip does: Escape closes it, and
any other key but a lone modifier or Tab closes it as a press.

## ARIA and state attributes per state

| State                                | Part                 | Attributes                                                                       |
| ------------------------------------ | -------------------- | -------------------------------------------------------------------------------- |
| label rendered                       | Button's root        | `aria-labelledby` = the label's id                                               |
| description rendered                 | Button's root        | `aria-describedby` = the description's id, then the tooltip's while it describes |
| neither, no describing tooltip       | Button's root        | the consumer's own `aria-labelledby` and `aria-describedby`                      |
| frame rendered                       | frame, extras        | the root's state attributes                                                      |
| pointer over an extra or a gap       | root, frame, extras  | `data-hovered`                                                                   |
| `relation: 'none'`                   | trigger              | no relation                                                                      |
| `relation: 'none'`                   | tooltip's root       | `aria-hidden="true"`; `role="tooltip"` kept                                      |
| overflow tooltip, text fits          | tooltip's root       | closed: no `data-open`                                                           |
| overflow tooltip, text cut off, open | tooltip's root, text | `data-open` and the rest as any tooltip; `text` holds the cut-off text           |
| optionExtras rendered                | option               | `aria-describedby` = the description's id while rendered, then the extras' id    |

## Focus

- An extra takes focus as any control does; the button keeps its own focus
  rules.
- A popover closed by a press on an extra doesn't restore focus to its
  trigger: focus went to the extra (Popover's handed-off focus).
- An overflow tooltip never moves focus, and opens on visible focus only, not
  on focus a UniAria overlay restores (Tooltip spec).

## Pointer and touch

- Hover over the frame is the button's hover (Extras). Touch never hovers.
- A press on an extra is the extra's, and outside its trigger's popover.
- The extras' box lets presses through to the button; the controls inside
  it take them (The item look).
- Touch opens no tooltip, overflow or not.

## Styling tokens

| Token                                                                                                   | On                                     | Meaning                                                      |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `data-element="Label"`, `data-element="Description"`                                                    | Button's label, description            | Which part an element is.                                    |
| `data-uni-part="button-frame"`, `data-uni-part="button-extras"`                                         | frame, extras                          | Which part an element is: they sit outside the root.         |
| `data-uni-part="popover-trigger-frame"`, `…-trigger-extras`, `…-trigger-label`, `…-trigger-description` | Popover's (and Dialog's) trigger parts | The same, outside the overlay.                               |
| `data-element="TriggerFrame"`, `data-element="TriggerExtras"`                                           | Select's                               | The same, inside its root.                                   |
| `data-element="OptionExtras"`                                                                           | an option's extras                     | Which part an element is.                                    |
| `data-element="Text"`                                                                                   | Tooltip's text                         | Which part an element is.                                    |
| the root's state attributes                                                                             | frame, extras                          | Their button's state, `data-hovered` counted over the frame. |
| `aria-hidden="true"`                                                                                    | tooltip's root                         | `relation: 'none'`.                                          |

## Expected spoken output

Probed with `@guidepup/virtual-screen-reader` in Chromium and WebKit, on the
markup this spec describes (written by hand, since nothing is built yet).
The conformance scenarios confirm it on the components.

| Markup and state                                                                    | Spoken phrase                                                                   |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| a button with a label "Save", a description "Saves the file" and a hint "⌘S" inside | `button, Save, Saves the file`                                                  |
| the same without the label and description parts                                    | `button, SaveSaves the file⌘S`                                                  |
| a label and a hint, no description                                                  | `button, Save`                                                                  |
| a label, a description and a tooltip "Ctrl+S"                                       | `button, Save, Saves the file Ctrl+S`; browsing past it open: `tooltip, Ctrl+S` |
| a cut-off label with its overflow tooltip open (`relation: 'none'`)                 | `button, Save the quarterly report`, and nothing for the tooltip                |
| a popover trigger with a `triggerLabel` "Fruit" and a `triggerDescription` "Apple"  | `button, Fruit, Apple, not expanded`                                            |
| a frame: a button "Fruit", an extra button "Clear Fruit" and a count "3"            | `button, Fruit`, then `button, Clear Fruit`, then `3`                           |
| Select's cut-off value with its overflow tooltip open                               | `combobox, Fruit A very long apple name, has popup listbox, not expanded`       |
| an option with `optionExtras` "New"                                                 | `option, Apple, New, not selected, position 1, set size 1`                      |
| an option with a description "Red and sweet" and extras "New"                       | `option, Apple, Red and sweet New, not selected, position 1, set size 1`        |
| an option whose extras are `aria-hidden`                                            | `option, Apple, not selected, position 1, set size 1`                           |

## Adapter surface

```tsx
// React: a button with a description, extras and an overflow tooltip
const full = useComponent(tooltip, {
  shouldOpenOnlyWhenTruncated: true,
  relation: 'none',
});
const report = useComponent(button, { onPress: open, tooltip: full.instance });
const share = useComponent(button, { onPress: shareReport });
return (
  <>
    <div {...report.parts.frame}>
      <button {...report.parts.root}>
        <FileIcon aria-hidden />
        <span {...report.parts.label}>{name}</span>
        <span {...report.parts.description}>{edited}</span>
      </button>
      <span {...report.parts.extras}>
        <button {...share.parts.root} aria-label={`Share ${name}`}>
          <ShareIcon aria-hidden />
        </button>
      </span>
    </div>
    <div {...full.parts.root}>
      <span {...full.parts.text} />
    </div>
  </>
);

// One tooltip for every option of a Select, rendered inside its popup
const full = useComponent(tooltip, {
  shouldOpenOnlyWhenTruncated: true,
  relation: 'none',
  positionArea: 'right',
});
const fruit = useComponent(select, { optionTooltip: full.instance });
// <div {...fruit.parts.popover}>
//   <ul {...fruit.parts.list}>…</ul>
//   <div {...full.parts.root}><span {...full.parts.text} /></div>
// </div>
```

```html
<!-- Custom elements: the option tooltip, named by id -->
<uni-select option-tooltip="fruit-full">
  …
  <div data-element="Popover">
    <ul data-element="List">
      <li data-element="Option" data-key="apple">
        <span data-element="OptionLabel" data-key="apple">Apple</span>
        <span data-element="OptionExtras" data-key="apple">New</span>
      </li>
    </ul>
    <uni-tooltip
      id="fruit-full"
      open-only-when-truncated
      relation="none"
      position-area="right"
    >
      <div data-uni="tooltip"><span data-element="Text"></span></div>
    </uni-tooltip>
  </div>
</uni-select>
```

Vue binds the same parts with `v-bind`, as for every component.

## Runtime and harness changes

To approve with this spec (root AGENTS.md: architecture rules, the runtime
and custom-element contracts, `conformance/`):

1. **Parts outside the root.** Root AGENTS.md → Part markers says the root is
   the outermost element, with overlays as the exception. A button's frame
   and extras become a second exception: Button's and ToggleButton's `frame`
   and `extras`, and Popover's and Dialog's trigger parts, which already sit
   outside, are `outsideParts`, marked `data-uni-part` and styled on their
   own (Open questions 2). The runtime already supports outside parts.
2. **A third element-owned part,** Tooltip's `text`, beside Select's value
   and hidden `<select>` (root AGENTS.md → DOM, lifecycle and SSR; Open
   questions 5).
3. **A link key found only by its attribute.** On custom elements a link
   comes from the attribute of its key's name or from the host the element
   sits in directly. `optionTooltip` comes only from its attribute, so a
   component with two tooltip keys inside one `<uni-tooltip>` takes it for
   the trigger only. A field on `LinkKey` that the elements adapter reads
   (Open questions 7).
4. **Tooltip's link contract** (`tooltip/link.ts`, internal): the target a
   component hands over gains its text elements, and a list gets a driven
   mode, in which it reports hover and focus as they start and end, each
   with an anchor and text elements, instead of handing over elements the
   tooltip listens to. A tooltip still takes one component.
5. **`dom/`:** `isTruncated(element)` (Measuring).
6. **Conformance,** in its own pull request after approval, for both
   adapters and custom elements:
   - Button and ToggleButton: the label names the button and the
     description describes it, only while rendered; the consumer's
     attributes otherwise; the frame and extras carry the states; hover over
     an extra hovers the button; a press on an extra doesn't press it; Tab
     order; spoken output.
   - Popover, Dialog and Select: the trigger's label, description, frame and
     extras; a popup placed against the frame; a press on an extra while
     open closes the popup and runs the extra.
   - Tooltip: an overflow tooltip opens only while the text is cut off, by
     hover, focus and `open()`; text that fits starts no delay; the `text`
     part holds only the cut-off text; `relation: 'none'` writes no relation
     and hides the root; spoken output.
   - Listbox, Select and Combobox: option extras describe the option; the
     option tooltip follows hover, focus and the highlight, moves between
     cut-off options, closes on a press and on typing, and is linked by id
     on elements.
   - No render for any of it in React and Vue.
7. **Harness:** nothing new is expected. Templates cut text with a `style`
   attribute the consumer owns, and Playwright's pointer hovers.
8. **AGENTS.md** with 1 to 3, and the docs pages of every component touched,
   the Styling guide and the Default styles page, in the implementation's
   commits.

### Changes to approved specs

Made on approval, each marked "Changed on <date> (owner)" in place:

- **Tooltip:** "Detecting truncated text" leaves Not part of Tooltip; the
  prop, the relation, the `text` part, Measuring and option tooltips are
  added; its UI Kit mapping row for automatic tooltips and its spoken output
  change.
- **Button and ToggleButton:** the four parts; the Summary's ownership of
  `aria-labelledby` and `aria-describedby`; hover over the frame; the custom
  element's markup; spoken output.
- **Popover and Dialog:** the four trigger parts; placement against the
  frame.
- **Select:** the trigger's frame and extras, the two links, option extras;
  its UI Kit mapping row for `isClearable`, `actions` and `tooltip`.
- **Listbox and Combobox:** option extras and the option tooltip.
- **`@uniaria/styles`:** The item look.

## Mapping from Cube UI Kit

Cube UI Kit at `references/cube-ui-kit` 27a92974 (research:
`scratchpad/items-spec/ui-kit.md`):

| UI Kit                                                                                              | UniAria                                                                                                          |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Item` and `ItemButton` slots: icon, prefix, label, description, suffix, right icon, actions        | The label and description parts; icons, prefixes and suffixes are the consumer's elements; actions are extras    |
| `tooltip` on by default on every Item                                                               | Opt-in: an overflow tooltip linked to the component, or one per list                                             |
| `tooltip: 'text'` or `{ title }`                                                                    | A tooltip                                                                                                        |
| `{ title, auto: true }`                                                                             | `shouldOpenOnlyWhenTruncated` with the consumer's content                                                        |
| The auto title: only the cut-off parts, label and description                                       | The `text` part: the text of the cut-off elements                                                                |
| Each row measures on mount, with a ResizeObserver, a page-wide microtask and `flushSync`            | Measured when it would open, nothing per row                                                                     |
| `TooltipProvider` wraps the row once it is cut off, which remounts it                               | Nothing wraps: a link never changes the DOM                                                                      |
| The overflow tooltip describes the trigger with its own name (read twice)                           | `relation: 'none'`                                                                                               |
| An overflow tooltip keeps a disabled Item focusable (Tab stops change with the width)               | Never (Tooltip spec, Resolved questions 12)                                                                      |
| `TextItem`: a span that always cuts its text, hover only                                            | A plain element as a tooltip's trigger part with `shouldOpenOnlyWhenTruncated`, hover only (it can't take focus) |
| `ItemActionsWrapper`: a sibling run laid over the row's end, its width measured (`--actions-width`) | The frame: a subgrid, nothing measured                                                                           |
| `data-trigger-action` and `isOwnActionsPress` keep the popup open                                   | A press on an extra is outside: the popup closes and the extra acts                                              |
| `ClearPressResponder` around the run                                                                | Not needed: nothing passes presses down to the extras                                                            |
| Wrapper colors projected for rest, disabled and pressed                                             | Every state on the frame and the extras; the button's box under them                                             |
| The run pinned to the physical right                                                                | Logical grid columns                                                                                             |
| `autoHideActions`, `preserveActionsSpace`                                                           | The consumer's CSS on the extras' state attributes                                                               |
| `disableActionsFocus`                                                                               | `shouldExcludeFromTabOrder` on each extra                                                                        |
| Actions inherit `isDisabled` through a context                                                      | The consumer disables each extra                                                                                 |
| `ItemBadge` (`role="img"`, `aria-description`)                                                      | A badge in the description (buttons) or in the option's extras (options)                                         |
| The hotkey hint inside an ItemButton is in its name                                                 | Out of the name once the label part is rendered; shortcuts themselves are the Menu spec's                        |
| Interactive `actions` inside `role="option"`                                                        | Non-interactive option extras; interactive ones are the grid mode's                                              |
| Select's `triggerDescription`, Picker's `triggerTooltip`                                            | Popover's and Dialog's `triggerDescription`; Select's `tooltip` link                                             |
| Select's `isClearable` and `actions`                                                                | `triggerExtras`                                                                                                  |
| `ItemAction` in the `current` theme                                                                 | A quiet Button, mixing its fills from `currentcolor`                                                             |
| `type="header"`: a heading inside a button                                                          | Not supported                                                                                                    |

## Differences from Cube UI Kit, React Aria and others

| #   | Topic                               | UI Kit                                                    | React Aria                                                                        | Others                                                                                                                                                                                                 | UniAria                                   |
| --- | ----------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| 1   | Overflow tooltip                    | on by default                                             | none                                                                              | Fluent v8 `overflowMode`, Workday `OverflowTooltip`, antd `ellipsis.tooltip`; Primer only in ActionList                                                                                                | opt-in prop (Q1)                          |
| 2   | When it measures                    | on mount, then observed                                   | —                                                                                 | antd, Fluent v8, Workday, MUI X: on pointer enter or focus                                                                                                                                             | when it would open                        |
| 3   | Under a pixel                       | missed                                                    | —                                                                                 | Metabase, Element Plus: a Range                                                                                                                                                                        | a Range, with a tolerance                 |
| 4   | What assistive technology gets      | the name again, as a description                          | —                                                                                 | Fluent `inaccessible`, Workday `muted`, Primer's hidden tooltip                                                                                                                                        | nothing (`relation: 'none'`)              |
| 5   | Name of a button with a description | the whole content                                         | Button: the whole content; ListBoxItem, MenuItem: `label` and `description` slots | MUI ListItemButton: the whole content; Primer ActionList: the label and its trailing visual                                                                                                            | the label part                            |
| 6   | Actions beside a button             | a sibling run laid over the row's end, its width measured | none for buttons; GridList rows hold them as cells                                | Atlassian side-nav items: a grid the button spans, slots on top, non-interactive ones pointer-transparent; MUI `secondaryAction`, Primer `TrailingAction`: siblings, space reserved by a fixed padding | the frame and extras, as Atlassian's (Q2) |
| 7   | Naming                              | `actions`                                                 | —                                                                                 | Fluent `aside` and `actions`, Atlassian `elemAfter` and `actions`, Primer `TrailingVisual` and `TrailingAction`, Ant `extra`                                                                           | `extras`, for both                        |
| 8   | Hover over an action                | the wrapper paints rest, pressed, disabled                | —                                                                                 | Atlassian and Primer: the row paints; MUI, Carbon: the button paints, so the row unhovers                                                                                                              | the button is hovered (Extras)            |
| 9   | A press on an action, popup open    | keeps it open                                             | —                                                                                 | —                                                                                                                                                                                                      | closes it and acts (Q4)                   |
| 10  | Extras in options                   | interactive                                               | none (GridList for interactive rows)                                              | Ant Menu `extra`, Fluent `secondaryContent`: inside, non-interactive                                                                                                                                   | non-interactive, describing it            |
| 11  | Tooltip under virtual focus         | none                                                      | —                                                                                 | none found                                                                                                                                                                                             | follows the highlight                     |

## Deviations from the WAI-ARIA pattern

None. Options keep presentational children, so their extras are never
interactive. An overflow tooltip with `relation: 'none'` is outside the
Tooltip pattern, which assumes the tooltip is the trigger's description;
here the description is already the trigger's own text.

## Open questions

1. **The prop's name.** (a) `shouldOpenOnlyWhenTruncated`, attribute
   `open-only-when-truncated`: a `should…` predicate for behavior, as the
   conventions ask, and plain about what it does. (b) `requiresTruncation`.
   (c) Fluent's `overflowMode`, a string. Recommended: (a).
2. **A frame outside the root.** (a) `frame` and `extras` parts outside
   Button's root, a second exception to "the root is the outermost element"
   after overlays (Runtime and harness changes 1): every button keeps one
   root, and the triggers get the same parts. (b) A new `item` definition
   whose root is the frame, composing Button: no exception, but another
   component and element, and Popover, Dialog and Select would need
   trigger variants that compose it. (c) Nothing in UniAria: the consumer's
   own wrapper. Then hover over an extra can't count as the button's, and
   every design system projects states onto its wrapper, as UI Kit does.
   Recommended: (a).
3. **The triggers' frame.** (a) A `triggerFrame` part on Popover, Dialog and
   Select, with the popup placed against it when there is no anchor. (b)
   Popover's and Select's existing `anchor` part as the frame: one part
   fewer, but an anchor placed elsewhere would take its trigger's hover and
   states. Recommended: (a).
4. **A press on an extra while its trigger's popup is open.** (a) Outside:
   the popup closes and the extra acts, as with any control outside it, and
   no press is lost. (b) UI Kit's: the frame counts as the trigger, so the
   popup stays open and the extra acts. That needs a frame exception in
   Popover's and Select's outside, blur and focus-restore rules.
   Recommended: (a).
5. **The tooltip's `text` part.** (a) A third element-owned part, which
   UniAria fills with the cut-off text. (b) None: the consumer writes the
   tooltip's content. Then one tooltip for many options needs the hovered
   option's key in public state, and a render on every hover in React and
   Vue. Recommended: (a).
6. **Option tooltips in this spec.** (a) Here: the `optionTooltip` link and
   the driven mode. Options are where Cube Cloud's text is cut off most.
   (b) A later spec, with Menu. Recommended: (a).
7. **`optionTooltip` on custom elements.** (a) Linked only by its attribute,
   with a field on `LinkKey` (Runtime and harness changes 3). (b) Through the
   host as well. Then a `<uni-select>` inside a `<uni-tooltip>` links both
   keys to one tooltip, which refuses the second with a warning, and which
   key wins depends on order. Recommended: (a).
8. **Cut-off labels in the default styles.** (a) Labels and descriptions in
   the item look take one line and end in an ellipsis, as in UI Kit. Options
   change from wrapping to cut off, and the docs pair them with an option
   tooltip. (b) They keep wrapping, and cutting them is the consumer's CSS.
   Recommended: (a).
9. **Quiet buttons from `currentcolor`.** (a) Every quiet Button mixes its
   hover and press fills from `currentcolor`, with UI Kit's steps per scheme,
   so it reads on any surface. That changes today's quiet look slightly. (b)
   Only quiet buttons inside extras, which needs a context selector the flat
   specificity rules make awkward. Recommended: (a).
