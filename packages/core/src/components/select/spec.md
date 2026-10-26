# Select spec

Status: approved by @tenphi on 2026-10-18

## Summary

A select picks one option, or in multiple mode several, from a list that
opens in a popover under a trigger. It replaces a native `<select>` where the
options need markup, descriptions, groups with headings or a styled popup.
Select is Field, Listbox and Popover composed (`ctx.use`), as root AGENTS.md
says: Field names and describes the trigger, Listbox is the list with its
options, selection, keys and typeahead, and Popover holds the list over the
page, places it, dismisses it and runs the closing phase. Select adds the
trigger: what it says to assistive technology, which keys and presses open
the list and what they do while it is closed, and where focus goes.

Cube UI Kit's Select is the model. It is React Aria's `useSelect`,
`useSelectState` and `HiddenSelect` with UI Kit's own popup, so the trigger's
keys and the selection rules are React Aria's, and the popup's dismissal is
UI Kit's. Where those two disagree with the APG's select-only combobox,
Radix, Zag or the browser's own customizable select, the difference is in
[Differences](#differences-from-react-aria-zag-radix-and-native-behavior) and
the choice is in [Resolved questions](#resolved-questions).

- **WAI-ARIA pattern:** the trigger follows the
  [select-only combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)
  (`references/aria-practices/content/patterns/combobox/examples/combobox-select-only.html`):
  `role="combobox"`, named by the label, with the value as its content; the
  popup follows [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/).
  Focus moves into the list rather than staying on the trigger (Resolved
  questions 1, and [Deviations](#deviations-from-the-wai-aria-pattern)).
- **Builds on:** Field (`ctx.use`, its `control` part as `trigger`); Listbox
  (`ctx.use`: `list`, `empty` and the item parts, with its label,
  description and error left out, since Field's are the trigger's); Popover
  (`ctx.use`: its `root` as `popover`, `anchor`, `arrow` and `close`, without
  its title and description); `createPress`, `createTypeahead` and
  `findByText` for the closed trigger. No runtime change: `ctx.use()` already
  forwards a composed definition's item parts.
- **Owner:** none.
- **Custom element:** yes, `<uni-select>`, hosting consumer markup. As
  `<uni-listbox>`, it reads its items from the options in the popover when
  `items` isn't set. Two parts hold content the element writes: the
  displayed value (root AGENTS.md's element-owned part) and the hidden
  `<select>`'s options (Resolved questions 11).

Not part of Select:

- **Validation.** As in Field: Select shows `isInvalid`, the form decides it.
  Inside a Form, the form checks it, and Select writes the `name` and the
  form's id on its hidden `<select>` (Form spec, Changes to approved specs).
- **Searching or filtering** the options, and typing a value: Combobox's. A
  searchable select (React Aria's Autocomplete in a Select popover) is a
  Combobox use.
- **Picker.** UI Kit's richer picker (a dialog popup with checkboxes, select
  all, a summary renderer, selected options sorted first) is another
  composite. Select's multiple mode (Resolved questions 9) covers the selection
  part.
- **Clear buttons, trigger actions and loading indicators.** UI Kit renders
  them beside the trigger. In UniAria they are the consumer's buttons and
  markup: clearing sets `value` to `[]`, and a loading list is an empty list
  whose empty part says so.
- **Item-aligned placement** (the selected option laid over the trigger, as
  macOS menus and Radix's default). It needs a Popover mode for areas over the
  anchor, which Popover doesn't have. A later addition.
- **A tray on small screens.** A design system's choice (Popover's
  `mobileType`); React Spectrum 2 dropped it.
- **Links in options** (React Aria's `linkBehavior: 'selection'`): an option is
  for selecting (Listbox).
- **Looks.** The chevron, the checkmark on the selected option, sizes, the
  popup's width and height: the design system's, with the tokens in
  [Styling tokens](#styling-tokens).

## Anatomy

| Part         | Element                    | Attributes UniAria owns                                                                                                                                                                                                                                              | Notes                                                                                                                                                                                                                                              |
| ------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root         | any; usually `div`         | state attributes                                                                                                                                                                                                                                                     | Field's root.                                                                                                                                                                                                                                      |
| label        | any; `span` by default     | `id` (unless it has one); state attributes                                                                                                                                                                                                                           | Field's. Names the trigger and the list. A press on it focuses the trigger and shows focus as if from the keyboard, without opening (React Aria). No `for`, even on a `<label>`: activating a label clicks its control, which would open the list. |
| trigger      | `button`                   | Button's (`type="button"`, `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`); `id` (unless it has one), `role="combobox"`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`, Field's control attributes; `disabled`; state attributes | Its text is the combobox's value: the `value` part, plus whatever icon the consumer adds, hidden from assistive technology by the consumer.                                                                                                        |
| value        | any; usually `span`, empty | its text (element-owned); `data-placeholder`; state attributes                                                                                                                                                                                                       | Optional. UniAria writes the selected options' text, or the placeholder (Resolved questions 10). Leave it out to render the value yourself from the state.                                                                                         |
| anchor       | any                        | none                                                                                                                                                                                                                                                                 | Optional. Popover's: the popup is placed against it instead of the trigger (UI Kit's `targetRef`).                                                                                                                                                 |
| popover      | any; usually `div`         | Popover's root attributes except `role`, `tabindex` and the name: `id` (unless it has one), `popover="manual"`, `data-placement`, positioning styles; state attributes                                                                                               | Render it always, after the trigger; it is hidden while closed. Not a dialog: the list inside is the popup (Resolved questions 7).                                                                                                                 |
| arrow        | any                        | Popover's                                                                                                                                                                                                                                                            | Optional.                                                                                                                                                                                                                                          |
| list         | any; usually `ul` or `div` | Listbox's list attributes, with `aria-labelledby` = the label (or `labelledBy`) and no Field attributes of its own                                                                                                                                                   | Inside the popover.                                                                                                                                                                                                                                |
| empty        | any                        | Listbox's                                                                                                                                                                                                                                                            | Optional, inside the popover, outside the list.                                                                                                                                                                                                    |
| close        | `button`                   | Button's                                                                                                                                                                                                                                                             | Optional. Popover's: a visually hidden one lets touch screen-reader users close the popup, which hides the page (React Aria's Dismiss buttons).                                                                                                    |
| description  | any                        | `id` (unless it has one); state attributes                                                                                                                                                                                                                           | Field's, describing the trigger.                                                                                                                                                                                                                   |
| error        | any                        | `id` (unless it has one), `hidden` while not shown; state attributes                                                                                                                                                                                                 | Field's.                                                                                                                                                                                                                                           |
| hiddenSelect | `select`, empty            | its `<option>`s (element-owned), the `value` and `selected` properties, `multiple`, `required`, `disabled`, `aria-hidden="true"`, `tabindex="-1"`, visually hidden styles                                                                                            | Optional; the consumer puts `name`, `form` and `autocomplete` here, as on NumberField's `hiddenInput`. Submits the value and takes browser autofill (Resolved questions 11).                                                                       |

Changed on 2026-10-22 (owner), the items spec (`../button/items.md`): two
parts inside the root, `triggerFrame` around the trigger and its
`triggerExtras` beside it (Button's `frame` and `extras`, with the
trigger's state attributes). The popup is placed against the anchor part,
else the frame, else the trigger. Two links: `tooltip`, the trigger's
tooltip, as Button's, its overflow tooltip measuring the `value` part; and
`optionTooltip`, one tooltip for every option (Listbox's). The item part
`optionExtras` is Listbox's.

Item parts, as Listbox's and inside its list: `option`, `optionLabel`,
`optionDescription`, `optionExtras`, `group` and `groupLabel`, keyed by the
consumer's `data-key`, with Listbox's attributes. Options are rendered while the list is
closed, inside the hidden popover: the element reads its items from them, the
value text needs them, and the trigger's `aria-controls` points at a list
that has its selected option.

State attributes on every named part: Popover's `data-open`, `data-entering`
and `data-exiting`; Field's `data-disabled`, `data-readonly`,
`data-required` and `data-invalid`; `data-multiple` in multiple mode;
`data-placeholder` while nothing is selected; `data-focus-within` and
`data-focus-visible` while focus is on the trigger or in the popup.

A part keeps an `id` the consumer gives its element, in both adapters, and
every reference to the part follows it; UniAria writes an `id` only on a
part that has none (root AGENTS.md → DOM, lifecycle and SSR).

## Props

Boolean props read as predicates. Keys are strings.

| Prop                 | Type                                           | Default                       | Bindable | Change event  | Notes                                                                                                                                                                 |
| -------------------- | ---------------------------------------------- | ----------------------------- | -------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| items                | `readonly Item[]`                              | `[]`                          | no       | —             | Listbox's. The element reads them from its markup when unset.                                                                                                         |
| getKey               | `(item: Item) => string`                       | `item.key`                    | no       | —             | Listbox's.                                                                                                                                                            |
| getTextValue         | `(item: Item) => string`                       | `item.textValue`              | no       | —             | Listbox's. Also the displayed value and the hidden `<select>`'s option text.                                                                                          |
| isItemDisabled       | `(item: Item) => boolean`                      | `item.isDisabled === true`    | no       | —             | Listbox's.                                                                                                                                                            |
| getChildren          | `(item: Item) => readonly Item[] \| undefined` | `item.items`                  | no       | —             | Listbox's.                                                                                                                                                            |
| disabledKeys         | `readonly string[]`                            | `[]`                          | no       | —             | Listbox's.                                                                                                                                                            |
| value                | `readonly string[]`                            | `[]`                          | yes      | `valueChange` | Listbox's: the selected keys, at most one in single mode (Resolved questions 8). Keys with no item stay in it and show nothing.                                       |
| selectionMode        | `'single' \| 'multiple'`                       | `'single'`                    | no       | —             | Resolved questions 9.                                                                                                                                                 |
| isOpen               | `boolean`                                      | `false`                       | yes      | `openChange`  | Popover's. A controlled select that refuses to close stays open.                                                                                                      |
| placeholder          | `string \| undefined`                          | —                             | no       | —             | The value part's text while nothing is selected. No default text: UI Kit has none, and React Aria's "Select an item" would be English.                                |
| isDisabled           | `boolean`                                      | `false`                       | no       | —             | Field's. The trigger is natively `disabled`; nothing opens.                                                                                                           |
| isReadOnly           | `boolean`                                      | `false`                       | no       | —             | `aria-readonly="true"` on the trigger. It opens and focus moves in the list, but nothing selects, as Listbox read-only (Resolved questions 12). Attribute `readonly`. |
| isRequired           | `boolean`                                      | `false`                       | no       | —             | Field's: `aria-required` on the trigger, `required` on the hidden `<select>`.                                                                                         |
| isInvalid            | `boolean`                                      | `false`                       | no       | —             | Field's: `aria-invalid` on the trigger, shows and announces the error.                                                                                                |
| shouldFocusWrap      | `boolean`                                      | `false`                       | no       | —             | Listbox's. Attribute `focus-wrap`.                                                                                                                                    |
| positionArea         | `PositionArea`                                 | `'block-end span-inline-end'` | no       | —             | Popover's: below the trigger, aligned to its start edge, as React Aria, Zag, Radix's popper mode and the customizable `<select>` (UI Kit's default is `bottom end`).  |
| positionTryFallbacks | `string`                                       | `'flip-block, flip-inline'`   | no       | —             | Popover's.                                                                                                                                                            |
| triggerId            | `string \| undefined`                          | generated                     | no       | —             | Field's `controlId`: the trigger's `id` where it has none of its own.                                                                                                 |
| listId               | `string \| undefined`                          | generated                     | no       | —             | Listbox's: the list's `id` where it has none of its own. Option ids follow the list's id.                                                                             |
| labelElementType     | `string`                                       | `'span'`                      | no       | —             | Field's. The element reads the label's tag.                                                                                                                           |
| labelledBy           | `string \| undefined`                          | —                             | no       | —             | Field's; names the list too.                                                                                                                                          |
| describedBy          | `string \| undefined`                          | —                             | no       | —             | Field's.                                                                                                                                                              |

Fixed rather than props: the list's `shouldFocusOnHover` is on (React Aria
and UI Kit), its orientation is vertical, and the popover is modal and
dismissable (Resolved questions 7).

`Item` is Listbox's. Development warns when the select has no name: no label
part, no `labelledBy` and no `aria-label` or `aria-labelledby` on the trigger.

## Events

| Event         | Detail              | When                                                                                                                                                                  |
| ------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valueChange` | `readonly string[]` | The user changed the selection: in the list, or by typing or ArrowLeft and ArrowRight on the closed trigger. Never for a value the consumer sets.                     |
| `openChange`  | `boolean`           | The user opened or closed the list. Once per change; never for an `isOpen` the consumer sets (UI Kit reports twice, and once on mount).                               |
| `focusChange` | `boolean`           | Focus entered or left the select: the trigger and the popup count as one (React Aria), so choosing an option, which moves focus back to the trigger, reports nothing. |

Listbox's `action` closes the list in single mode and isn't reported.

## Public state

| Field          | Type                     | Meaning                                                                         |
| -------------- | ------------------------ | ------------------------------------------------------------------------------- |
| value          | `readonly string[]`      | The selected keys.                                                              |
| valueText      | `string`                 | The selected options' text, joined with `, `; `''` when none has an item.       |
| isPlaceholder  | `boolean`                | Nothing selected that has an item: the value part shows the placeholder.        |
| selectionMode  | `'single' \| 'multiple'` |                                                                                 |
| isOpen         | `boolean`                |                                                                                 |
| focusedKey     | `string \| null`         | Listbox's: the option with focus, or the one the list will focus when it opens. |
| isEmpty        | `boolean`                | Listbox's.                                                                      |
| isDisabled     | `boolean`                |                                                                                 |
| isReadOnly     | `boolean`                |                                                                                 |
| isRequired     | `boolean`                |                                                                                 |
| isInvalid      | `boolean`                |                                                                                 |
| isErrorShown   | `boolean`                | Field's.                                                                        |
| isFocusWithin  | `boolean`                | Focus is on the trigger or in the popup.                                        |
| isFocusVisible | `boolean`                | That focus came from the keyboard.                                              |

## Actions

Added on 2026-10-19 (owner): the definition's internal API is not public,
and these are the only members of it consumers may call. They are
`instance.actions`, the React handle's `actions` and methods of the element
(`select.open()`). Each runs in a batch.

| Action    | Effect                                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open()`  | Asks to open the list, as Enter on the trigger does: focus moves to the selected option, else the first enabled one (Focus). Controlled, only `openChange(true)` is reported. Nothing while disabled or open. |
| `close()` | Asks to close the list, as Escape does: focus returns to the trigger when it was in the popup (Focus). Controlled, only `openChange(false)` is reported. Nothing while closed.                                |

## Selection

- **Single mode.** Choosing an option (a press, Enter or Space) selects it,
  closes the list and returns focus to the trigger. Choosing the selected
  option again closes it with no `valueChange`, as React Aria and UI Kit
  (Listbox's `action`, Listbox Resolved questions 6). The list can't empty the
  selection; the consumer can, with `value: []`.
- **Multiple mode** (Resolved questions 9). Presses, Enter and Space toggle and
  the list stays open; Listbox's ranges and Ctrl+A (Cmd+A on Apple platforms)
  work as in Listbox. Escape, Tab and a press outside close it.
- **On the closed trigger**, single mode only: typing and ArrowLeft and
  ArrowRight change the value without opening (Resolved questions 3).
- **The value text** is each selected key's `getTextValue`, in the order of
  `value`, joined with `, `. A key with no item adds nothing; with none left
  the value part shows the placeholder and `data-placeholder` is set.

## Keyboard

On the closed trigger:

| Key                         | Behavior                                                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Enter, Space                | Open; focus the selected option, else the first (Resolved questions 4).                                                                                                                          |
| ArrowDown, Alt+ArrowDown    | The same.                                                                                                                                                                                        |
| ArrowUp, Alt+ArrowUp        | Open; focus the selected option, else the last.                                                                                                                                                  |
| ArrowLeft, ArrowRight       | Single mode: select the previous or next enabled option without opening; with nothing selected, both select the first. No wrap. Not mirrored right to left, as React Aria. Not in multiple mode. |
| Printable characters        | Single mode: typeahead (Listbox's 1 s query) selects the next matching option without opening. Space while a query is in progress joins it and doesn't open. Not in multiple mode.               |
| Home, End, PageUp, PageDown | Not handled.                                                                                                                                                                                     |
| Escape                      | Not handled, so it reaches a dialog around the select.                                                                                                                                           |

Keys with Ctrl or Meta, and Shift with the arrows, are left to the browser.
The keydown that opens the list is prevented, so Enter doesn't also click the
trigger; its key repeats and its keyup, which now land on an option, don't
select it (React Aria ignores both).

In the open list, focus is on an option and Listbox's keys apply: the arrows
(no wrap unless `shouldFocusWrap`), Home, End, the page keys, typeahead, and
in multiple mode the range keys. Besides them:

| Key            | Behavior                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Enter, Space   | Single mode: select and close (Selection). Multiple mode: toggle.                                                                                                      |
| Escape         | Close without changing the value; focus returns to the trigger. Listbox leaves Escape alone and Popover dismisses. Unless the consumer controls `isOpen` and keeps it. |
| Tab, Shift+Tab | Close without selecting, and focus moves on from the trigger: to what follows it, or with Shift to what precedes it (Resolved questions 5).                            |

## ARIA and state attributes per state

| State            | Part           | Attributes                                                                                                                                                                         |
| ---------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| always           | trigger        | `type="button"`, `role="combobox"`, `aria-haspopup="listbox"`, `aria-controls` = the list's id, `aria-labelledby` = the label (or `labelledBy`), `aria-describedby` while rendered |
|                  | popover        | `id`, `popover="manual"`; no `role`, no `tabindex`, no name                                                                                                                        |
|                  | list           | Listbox's: `role="listbox"`, `id`, `aria-labelledby` = the label, `aria-orientation="vertical"`                                                                                    |
|                  | hiddenSelect   | `aria-hidden="true"`, `tabindex="-1"`, one `<option value="">`, then one `<optgroup>` holding an `<option value={key}>{text}</option>` per option                                  |
| closed           | trigger        | `aria-expanded="false"`                                                                                                                                                            |
|                  | popover        | hidden (Popover's)                                                                                                                                                                 |
| open             | trigger        | `aria-expanded="true"`; every named part + `data-open`                                                                                                                             |
| nothing selected | trigger, value | + `data-placeholder`; the value part's text is the placeholder                                                                                                                     |
| selected         | option         | Listbox's `aria-selected="true"`, `data-selected`                                                                                                                                  |
|                  | hiddenSelect   | the `value` property (single), or each option's `selected` (multiple)                                                                                                              |
| multiple mode    | list           | + `aria-multiselectable="true"`; every named part + `data-multiple`                                                                                                                |
|                  | hiddenSelect   | + `multiple`                                                                                                                                                                       |
| disabled         | trigger        | + `disabled`; every part + `data-disabled`; the error hidden (Field)                                                                                                               |
|                  | hiddenSelect   | + `disabled`                                                                                                                                                                       |
| read-only        | trigger        | + `aria-readonly="true"`; every part + `data-readonly`                                                                                                                             |
|                  | list           | Listbox's `aria-readonly="true"`                                                                                                                                                   |
| required         | trigger        | + `aria-required="true"`; every named part + `data-required`                                                                                                                       |
|                  | hiddenSelect   | + `required`                                                                                                                                                                       |
| invalid          | trigger        | + `aria-invalid="true"`, `aria-describedby` gains the error's id; every named part + `data-invalid`                                                                                |
| empty            | list, empty    | Listbox's: the list takes `tabindex="0"` and is described by the empty part                                                                                                        |

`aria-controls` stays while closed, as the APG and Zag write it: Chromium
computes a select-only combobox's value from the selected option of the
listbox it controls (Chrome 84). React Aria and Radix write it only while
open. Whether a screen reader reads the value from the trigger's text when
the list is hidden needs a real one (Resolved questions 1).

## Focus

- **On open**, focus moves into the list: the selected option (the first
  selected in multiple mode), else the first enabled option, or the last for
  ArrowUp and Alt+ArrowUp; with no enabled option, the list itself. The option
  is scrolled into view (`block: 'nearest'`), except under a screen reader's
  virtual cursor, as Listbox (Resolved questions 4). Popover's own focus on open
  (its root) doesn't apply.
- **While open**, focus stays in the popup. A hovering mouse moves focus to the
  option unless the keyboard is in use (`shouldFocusOnHover`). Tab closes it
  (Keyboard). The trigger keeps `aria-expanded="true"`.
- **On close**, focus returns to the trigger as the closing phase starts, not
  after it, when focus is still in the popup: a key pressed during an exit
  animation would otherwise reach an option on its way out (UI Kit's fix,
  CUB-4839). After a press outside, focus stays where the press put it
  (Popover's rule). Returning focus doesn't count as entering the select, and
  a tooltip on the trigger doesn't open for it (Popover's rule).
- **The label**: a press on it focuses the trigger and shows focus as if from
  the keyboard.
- **A form submitted without a required value**: when the browser reports
  the hidden `<select>` as the form's first invalid control and focuses it,
  focus moves to the trigger and shows, as React Aria. The `invalid` event
  alone moves none: every invalid control in the form gets one, and
  `checkValidity()` sends it too. The browser's message points at the hidden
  `<select>`, which sits inside the root.

## Pointer and touch

- **A mouse or pen press on the trigger opens the list on press start**
  (pointerdown), as React Aria, UI Kit, Radix and native `<select>` do. Focus
  goes to the selected option, else the first.
- **Press, drag and release** (mouse and pen): with the button still held
  from the opening press, releasing it over an enabled option selects it, as
  React Aria, Radix and native `<select>`. Only once the pointer has moved
  10 px from where it went down (Radix's rule; Chromium's customizable select
  has its own threshold), so an option that opens under the pointer isn't
  chosen by the same click. A release anywhere else leaves the list open. (Resolved
  questions 6.)
- **Touch** opens on release (a tap), as React Aria and Radix: opening on touch
  start would open on a scroll. Options select on a tap: Listbox's press,
  released over the option it started on.
- **A press on the trigger while open** closes the list, without opening it
  again on release.
- **A press outside** closes the list and acts on what it hit (Popover's modal
  rule, from UI Kit). It doesn't select the focused option.
- **Hover** marks options (`data-hovered`) and moves focus to them
  (`shouldFocusOnHover`), so the highlight follows the pointer during a drag.
- **A screen reader's click** on the trigger opens the list with the first
  option focused, or the selected one.

## Styling tokens

| Token                                                                            | On             | Meaning                                                                                             |
| -------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| `data-open`, `data-entering`, `data-exiting`                                     | named parts    | Popover's phases.                                                                                   |
| `data-placeholder`                                                               | named parts    | Nothing selected.                                                                                   |
| `data-multiple`                                                                  | named parts    | Multiple mode.                                                                                      |
| `data-disabled`, `data-readonly`, `data-required`, `data-invalid`                | named parts    | Field's.                                                                                            |
| `data-focus-within`, `data-focus-visible`                                        | named parts    | Focus on the trigger or in the popup, and from the keyboard.                                        |
| `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`             | trigger        | Button's.                                                                                           |
| `data-selected`, `data-focused`, `data-hovered`, `data-pressed`, `data-disabled` | option         | Listbox's.                                                                                          |
| `data-placement`                                                                 | popover, arrow | Popover's: the side it opened on.                                                                   |
| `--anchor-width`, `--available-width`, `--available-height`                      | popover        | Popover's: for `min-width: var(--anchor-width)` and a `max-height`.                                 |
| visually hidden styles                                                           | hiddenSelect   | Written by UniAria: Safari won't autofill a `<select>` that is `display: none` (React Aria, Radix). |

No CSS variables of Select's own.

## Expected spoken output

Probed with `@guidepup/virtual-screen-reader` in Chromium, on a select "Fruit"
with the trigger Resolved questions 1 recommends:

| State                           | Spoken phrase                                                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| closed                          | `combobox, Fruit, has popup listbox, not expanded, 1 control`, then its text `Apple`                                                                                                           |
| closed, nothing selected        | the same, then `Pick a fruit`                                                                                                                                                                  |
| described, invalid and required | `combobox, Fruit, Pick some Pick one, has popup listbox, not expanded, 1 control, invalid, required`                                                                                           |
| read-only                       | `combobox, Fruit, has popup listbox, not expanded, 1 control, read only`                                                                                                                       |
| disabled                        | `combobox, Fruit, has popup listbox, not expanded, 1 control, disabled`                                                                                                                        |
| open                            | `listbox, Fruit, orientated vertically` and Listbox's options (`option, Apple, selected, position 1, set size 2`); not the trigger, which Popover's modal mode hides with the rest of the page |
| open, multiple                  | the list: `listbox, Fruit, orientated vertically, multi-selectable`                                                                                                                            |
| open, empty                     | the list: `listbox, Fruit, No fruit, orientated vertically`                                                                                                                                    |
| the hidden `<select>`           | nothing                                                                                                                                                                                        |

The virtual screen reader doesn't compute a combobox's value: it reads the
trigger's text as content after the role. Whether real screen readers read
the value in the combobox phrase is checked with them at gate 5.

For comparison, React Aria's button trigger reads
`button, Apple Fruit, not expanded, has popup listbox` and drops
`aria-required` and `aria-invalid` (a button can't have them):
`button, Fruit Apple, Pick one, not expanded, has popup listbox`.

## Adapter surface

```tsx
// React
const fruit = useBehavior(select, {
  items, // [{ key: 'apple', textValue: 'Apple' }, …]
  placeholder: 'Pick a fruit',
  defaultValue: ['banana'],
  onValueChange,
});
return (
  <div {...fruit.parts.root}>
    <span {...fruit.parts.label}>Fruit</span>
    <button {...fruit.parts.trigger}>
      <span {...fruit.parts.value} />
      <ChevronIcon aria-hidden />
    </button>
    <div {...fruit.parts.popover}>
      <ul {...fruit.parts.list}>
        {items.map((item) => (
          <li key={item.key} {...fruit.getItemProps('option', item.key)}>
            {item.textValue}
          </li>
        ))}
      </ul>
      <p {...fruit.parts.empty}>No fruit</p>
    </div>
    <p {...fruit.parts.error}>Pick one</p>
    <select {...fruit.parts.hiddenSelect} name="fruit" />
  </div>
);
```

```html
<!-- Custom elements: items read from the options -->
<uni-select placeholder="Pick a fruit" required>
  <span data-element="Label">Fruit</span>
  <button data-element="Trigger">
    <span data-element="Value"></span>
    <svg aria-hidden="true">…</svg>
  </button>
  <div data-element="Popover">
    <div data-element="List">
      <div data-element="Option" data-key="apple">Apple</div>
      <div data-element="Option" data-key="banana">Banana</div>
      <div data-element="Group" data-key="citrus">
        <span data-element="GroupLabel" data-key="citrus">Citrus</span>
        <div data-element="Option" data-key="lemon">Lemon</div>
      </div>
    </div>
    <p data-element="Empty">No fruit</p>
  </div>
  <select data-element="HiddenSelect" name="fruit" autocomplete="off"></select>
</uni-select>
```

`@uniaria/core/select` exports `select`, and the element registers from the
same subpath of `@uniaria/elements`. Attributes: `selection-mode`,
`disabled-keys`, `placeholder`, `disabled`, `readonly`, `required`,
`invalid`, `focus-wrap`, `position-area`, `position-try-fallbacks`,
`labelled-by`, `described-by`; properties `items`, `value`, `defaultValue`,
`isOpen` and `defaultOpen`; events `valuechange`, `openchange` and
`focuschange`. A rich value (an icon beside the text) is the consumer's
markup in the trigger, read from `value` in React; the element shows text.

## Mapping from Cube UI Kit

| UI Kit Select                                                                     | UniAria                                                                                                                                                   |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectedKey` / `defaultSelectedKey` / `onSelectionChange(key \| null)`           | `value` / `defaultValue` / `valueChange` with a `string[]` (Resolved questions 8)                                                                         |
| single only; Picker for multiple                                                  | `selectionMode` (Resolved questions 9)                                                                                                                    |
| `isOpen`, `defaultOpen`, `onOpenChange` (fires twice, and on mount)               | Popover's bindable `isOpen`, reported once per user change                                                                                                |
| `placeholder`                                                                     | `placeholder`, written into the value part                                                                                                                |
| `items`, `Select.Item`, `Select.Section`, `disabledKeys`                          | Listbox's `items`, accessors and `disabledKeys`; groups                                                                                                   |
| the selected item's rendered children in the trigger                              | the value part's text, or the consumer's markup from `value` (Resolved questions 10)                                                                      |
| `direction`, `placement` (`bottom end`), `shouldFlip`, `overlayOffset`            | `positionArea` (`block-end span-inline-end`), `positionTryFallbacks`; the gap is the consumer's margin (Popover)                                          |
| `targetRef`                                                                       | the `anchor` part                                                                                                                                         |
| min width = the trigger's width, read in render                                   | `--anchor-width`, kept current, for the consumer's CSS                                                                                                    |
| `50vh − 5x` max height; the computed max height lost on the wrapper               | `--available-height` on the popover                                                                                                                       |
| non-modal popup: closes on blur, on any ancestor scroll, on another popover       | Popover's modal mode: page hidden from assistive technology, closes when the trigger scrolls out of view, and a press outside acts (Resolved questions 7) |
| `HiddenSelect` (`<select>` up to 300 items), `name`; no `form`, no `autoComplete` | the `hiddenSelect` part, with the consumer's `name`, `form` and `autocomplete` (Resolved questions 11)                                                    |
| `isRequired`, `isInvalid` through UI Kit's Form; not on the trigger               | `aria-required`, `aria-invalid` on the trigger; `required` on the hidden `<select>`                                                                       |
| `isReadOnly` (only the clear button honors it)                                    | `isReadOnly`: opens, selects nothing (Resolved questions 12)                                                                                              |
| `isClearable`, `actions`                                                          | the consumer's buttons in `triggerExtras` (changed on 2026-10-22 (owner))                                                                                 |
| `tooltip`                                                                         | the `tooltip` link (changed on 2026-10-22 (owner))                                                                                                        |
| `isLoading`, `loadingIndicator`, `icon`, `prefix`, `suffix`, sizes and styles     | the consumer's markup and CSS                                                                                                                             |

UI Kit bugs found on the way, to file at cube-js/cube-ui-kit (all read from
code, none reproduced yet): `onOpenChange` fires twice per change and once on
mount; clearing fires `onSelectionChange(null)` twice; `isLoading` looks
disabled but the trigger still opens and typeahead still selects;
`isReadOnly` doesn't stop selection; `autoFocus`, `hideTrigger`,
`loadingIndicator`, `inputProps` and `autoComplete` do nothing; the computed
max height lands on the wrapper, not the scroller; PageUp and PageDown jump to
the ends because the `ul` doesn't scroll; opening focuses the option focused
last rather than the selected one, ignores ArrowUp's "last" and doesn't
scroll the selected option into view on the first open; the trigger has no
`aria-describedby` for the description or the error; the docs claim
`aria-activedescendant`, `aria-required` and `aria-invalid`. They are filed
after the owner reviews them.

## Differences from React Aria, Zag, Radix and native behavior

| #   | Topic                   | UI Kit / React Aria                                                                               | APG select-only                         | Zag / Radix                                                       | Native `<select>` / customizable          | UniAria (proposed)                                           |
| --- | ----------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ |
| 1   | Trigger                 | `button aria-haspopup="listbox"`, named "value label"                                             | `div role="combobox"`, named by label   | `button role="combobox"`, named by label                          | combobox (Windows), pop-up button (macOS) | `button role="combobox"`, named by the label (Q1)            |
| 2   | Required, invalid       | not on the trigger (a button can't)                                                               | on the combobox                         | on the trigger                                                    | `required`                                | on the trigger (Q1)                                          |
| 3   | Focus while open        | real focus on options                                                                             | stays on the trigger (activedescendant) | Zag: listbox with activedescendant; Radix: options                | customizable: real focus on options       | real focus on options, Listbox's roving focus (Q1)           |
| 4   | Typing, closed          | selects, stays closed                                                                             | opens                                   | selects, stays closed                                             | selects, stays closed                     | selects, stays closed (Q3)                                   |
| 5   | ArrowLeft/Right, closed | select previous/next                                                                              | —                                       | Zag: select; Radix: nothing                                       | Windows: select                           | select previous/next (Q3)                                    |
| 6   | Opening focus           | React Aria: selected, else first/last, else the list (mouse); UI Kit: the option focused last     | selected or last highlighted            | Zag: selected, else first/last; Radix: selected, else the content | selected                                  | selected, else first/last (Q4)                               |
| 7   | Tab while open          | React Aria: trapped; UI Kit: closes, moves on, no select                                          | selects, closes, moves on               | blocked                                                           | customizable: closes, stays, no select    | closes, moves on, no select (Q5)                             |
| 8   | Opens on                | mouse press start; touch release                                                                  | click                                   | Zag: click; Radix: mouse pointerdown, touch click                 | mousedown                                 | mouse press start; touch release (Q6)                        |
| 9   | Press-drag-release      | yes                                                                                               | no                                      | Zag: no; Radix: yes, 10 px                                        | yes                                       | yes, 10 px (Q6)                                              |
| 10  | Popup                   | React Aria: modal dialog, page inert, scroll locked; UI Kit: non-modal, closes on blur and scroll | listbox only                            | Zag: non-modal; Radix: page hidden, focus trapped, scroll locked  | in the top layer                          | Popover modal, no dialog role, page hidden from AT only (Q7) |
| 11  | Value type              | React Aria: key or keys; UI Kit: key or `null`                                                    | —                                       | Zag: `string[]`; Radix: `string`                                  | `value` / `selectedOptions`               | `string[]` (Q8)                                              |
| 12  | Multiple                | React Aria: yes; UI Kit Select: no                                                                | —                                       | Zag: yes; Radix: no                                               | `multiple` (a listbox, not a popup)       | yes (Q9)                                                     |
| 13  | Value shown             | the item's children (React Aria `SelectValue`)                                                    | text                                    | Zag: consumer; Radix: the item's text, portalled                  | text; customizable clones the option      | element-owned text, or the consumer's markup (Q10)           |
| 14  | Forms                   | hidden `<select>` up to 300 items, then hidden inputs                                             | none                                    | hidden `<select>`                                                 | native                                    | hidden `<select>` part (Q11)                                 |
| 15  | Empty list              | doesn't open                                                                                      | —                                       | opens                                                             | opens                                     | opens with the empty part (Q12)                              |
| 16  | Placement               | React Aria `bottom start`; UI Kit `bottom end`                                                    | below                                   | Zag: `bottom-start`; Radix: item-aligned                          | below, start-aligned; macOS: item-aligned | `block-end span-inline-end`                                  |
| 17  | Focus return on close   | React Aria: after the exit; UI Kit: at close start                                                | never leaves                            | after                                                             | —                                         | at close start                                               |

## Deviations from the WAI-ARIA pattern

- **Focus moves into the list** (Resolved questions 1). The select-only combobox
  keeps DOM focus on the combobox and moves `aria-activedescendant`. VoiceOver
  on iOS and TalkBack ignore `aria-activedescendant` (Higley, 2024), Safari
  read nothing for it on a select-only combobox before WebKit 272565 (2024),
  and the browser's own customizable select moves real focus to its options.
  Listbox's roving focus is reused as approved.
- **Typing on the closed trigger selects without opening** (Resolved questions 3).
  The APG opens the list so users perceive the options; every native
  `<select>`, React Aria, UI Kit, Zag and Radix select in place.
- **Tab doesn't select** (Resolved questions 5). The APG commits the highlighted
  option and moves on; UniAria closes and moves on, so arrowing through a list
  and leaving doesn't change the value.
- **A mouse opens on press start** (Resolved questions 6). The APG opens on click.

## Resolved questions

Decided by @tenphi on 2026-10-18, each as recommended.

1. **The trigger.** (a) A `<button>` with `role="combobox"`,
   `aria-haspopup="listbox"`, `aria-expanded` and `aria-controls`, named by
   the label alone; its text (the value part) is the combobox's value; real
   focus moves into the list. As Radix, and Zag's trigger. It can carry
   `aria-required`, `aria-invalid` and `aria-readonly`, which the virtual
   screen reader reads (Expected spoken output), and ARIA in HTML allows
   `role="combobox"` on a `<button>`. (b) The APG exactly: focus stays on
   the trigger and `aria-activedescendant` moves. That needs Listbox's
   virtual focus now rather than with Combobox, and mobile screen readers
   ignore it. (c) React Aria and UI Kit: `aria-haspopup="listbox"` on a plain
   button named "value label". Required, invalid and read-only can't be
   expressed: the error text in `aria-describedby` is all that is read
   (React Spectrum puts "(required)" into the label's text instead). Every
   option is unverified on real screen readers, which root AGENTS.md defers
   to gate 5; the open risk for (a) is a screen reader that doesn't read the
   value from the trigger's text, which `aria-controls` kept while closed
   addresses in Chromium. Decided: (a).
2. **The list's name.** The list is named by the label (React Aria, the APG),
   so the popup reads `listbox, Fruit`. Decided: as is; the alternative is
   the trigger's id, which reads its value too.
3. **Keys on the closed trigger.** (a) Single mode: typing selects without
   opening (native, React Aria, UI Kit, Zag, Radix), ArrowLeft and ArrowRight
   select the previous and next option (React Aria, UI Kit, Zag, native
   Windows); ArrowUp, ArrowDown, Enter and Space open; Home, End and the page
   keys do nothing. (b) The APG: typing, Home and End open the list at the
   match or the end. (c) Platform-dependent, as Lion: Windows arrows change
   the value. Decided: (a). Whether a screen reader reads a value changed
   while the trigger has focus is checked at gate 5.
4. **Focus on open.** (a) The selected option, else the first enabled option
   (the last for ArrowUp), for every way of opening. (b) React Aria: the same,
   except that a pointer opening with nothing selected focuses the list
   itself, so no option looks focused under the mouse. Listbox forwards focus
   on its list to the tab stop (Listbox, Focus), so (b) needs a Listbox
   change. Decided: (a).
5. **Tab while open.** (a) Close without selecting; focus moves on from the
   trigger (UI Kit). (b) Select the focused option, close and move on (APG,
   Fluent, the deprecated button pattern). (c) Trap Tab in the popup (React
   Aria, Radix, Zag). (d) Close and stay on the trigger (the customizable
   select). Decided: (a): leaving shouldn't change the value, and Tab
   still leaves.
6. **Opening on press start, and press-drag-release.** (a) A mouse or pen
   opens the list on pointerdown, and a release over an option that the
   pointer moved 10 px to selects it (React Aria, UI Kit, Radix, native);
   touch opens on a tap. Select adds this to the options it composes;
   Listbox's own press is unchanged. (b) Open on click, as the APG, Zag and
   UI Kit's Picker, with no drag. Decided: (a).
7. **The popup.** (a) Popover modal as approved: the page hidden from
   assistive technology but not inert, a press outside closes and acts, the
   list closes when the trigger scrolls out of view, scrolling stays free;
   the popover has no `role="dialog"`, `tabindex` or name, since the list is
   the popup (React Spectrum's popover is `presentation`); Tab follows
   question 5. (b) Non-modal, as UI Kit's Select: the page stays exposed and
   focus leaving closes it. With focus in the list on a touch screen reader,
   moving the reading cursor out could close it (Radix #1343). (c) A
   `role="dialog"` popover holding the list, as React Aria Components:
   screen readers then announce a dialog first. Decided: (a).
8. **The value.** (a) `readonly string[]` in both modes, as Listbox (Zag).
   (b) `string | null` in single mode, `string[]` in multiple (React Aria's
   `value`). Decided: (a), so Select passes Listbox's value through and a
   consumer switching modes keeps one type.
9. **Multiple selection.** (a) In Select: Listbox's multiple mode in the
   popup, which stays open; the trigger's typing and ArrowLeft and ArrowRight
   are off; the value text joins the options with `, `. React Aria's Select
   has it; UI Kit leaves it to Picker. (b) Single only for now. Decided:
   (a): it is mostly Listbox's work, and Picker can compose it later.
10. **The displayed value.** (a) The `value` part is element-owned in both
    adapters: UniAria writes its text (the selected options' `getTextValue`,
    or the placeholder) through the binder's `textContent` property, so it is
    the same in React and on the element and needs no runtime change.
    Consumers who want an icon or rich content leave the part out and render
    their own markup from `value` (React) or `valuechange` (elements). React
    renders the part empty on the server, so the text appears on hydration.
    (b) The consumer always renders the value (React Aria's `SelectValue`,
    Zag); the element writes text. (c) The element clones the selected
    option's content, as the customizable select's `<selectedcontent>` and
    Lion: duplicated ids, and the clone doesn't follow later changes.
    Decided: (a).
11. **Forms.** (a) A `hiddenSelect` part, a `<select>` the consumer leaves
    empty: UniAria writes one `<option>` per option (and an empty first one),
    the selection, `multiple`, `required` and `disabled`, and hides it
    visually but not with `display: none`. Browser autofill fills it (React
    Aria, Radix and Zag all use a hidden `<select>` for this), native
    `required` blocks an empty submit, a reset restores the default value,
    and multiple values submit under one name. Writing the options is an
    exception to root AGENTS.md's "the element never creates nodes it did not
    create", like the displayed value: the part is element-owned. (b) A
    `hiddenInput` part, as NumberField: `type="hidden"`, the selected key;
    no autofill, no `required`, and multiple mode would need one input per
    key, which the element can't create. Decided: (a), and the AGENTS.md
    exception recorded. React Aria switches to hidden inputs above 300 items
    for speed; UniAria keeps the `<select>` at every size (Listbox
    virtualization spec, Resolved questions 9).
12. **Empty and read-only.** (a) An empty list opens and shows Listbox's empty
    part, which describes it; a read-only select opens and moves focus, but
    nothing selects, and the closed trigger's typing and arrows change
    nothing. (b) React Aria: an empty select doesn't open (unless
    `allowsEmptyCollection`); UI Kit's read-only is unimplemented.
    Decided: (a): an empty or read-only select still shows what it holds.
13. **Position and size on options.** VoiceOver with Chrome reads wrong
    "position, set size" counts when real focus moves through a list that
    scrolls (Radix #3962, open); explicit `aria-posinset` and `aria-setsize`
    are the proposed fix. Listbox writes neither: browsers count them, per
    group (Listbox spec). (a) Listbox writes them on every option, per group,
    which Select inherits; a change to the approved Listbox. (b) Leave them
    to the browser until a real screen reader confirms the bug at gate 5.
    Decided: (b): the virtual screen reader already hears the right
    counts, and wrong explicit values would be worse.
