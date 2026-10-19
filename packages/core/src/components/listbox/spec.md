# Listbox spec

Status: approved by @tenphi on 2026-10-18

## Summary

A listbox is a list of options from which the user selects one or, in
multiple mode, several: `role="listbox"` on the list and `role="option"` on
each option, with arrow keys, Home and End, Page Up and Page Down, typeahead
and, in multiple mode, range selection. It is used on its own, as a form
control, and later as the list inside Select and Combobox, which compose it
(`ctx.use`). There is no native element underneath: `<select size>` can't
hold styled options, groups with markup or descriptions.

Options are data (`items`, root AGENTS.md → Collections): the consumer
renders one element per item and spreads that item's props on it, so the
server renders the selection and the tab stop, and typeahead reads text
nobody has rendered yet. Cube UI Kit's ListBox is the model; it is React
Aria's `useListBox` with UI Kit's own selection API, scrolling and
virtualization around it, so React Aria is the reference for most of the
behavior.

Listbox needs one thing the runtime doesn't have: parts repeated per item,
with props computed for one item at a time. That is a runtime and
custom-element contract change, specified in [Item parts](#item-parts) and
decided in Resolved questions 1.

- **WAI-ARIA pattern:** [Listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/)
  (`references/aria-practices/content/patterns/listbox/`, the scrollable,
  multi-select and grouped examples).
- **Builds on:** Field (`ctx.use`, its `control` part as `list`) for the
  label, description and error, as RadioGroup does; `createTypeahead` and
  `findByText` from `collections/`; `press`, `hover`, focus-visible and
  focus-within from `dom/`. New in the runtime: item parts. New in
  `collections/`: a DOM-free list collection (key to index maps, the next
  and previous enabled key, ranges), built once per `items`.
- **Owner:** none. Select and Combobox will compose it rather than own it.
- **Custom element:** yes, `<uni-listbox>`, hosting consumer markup. Its
  options are the consumer's elements, found by `data-element` and keyed by the
  consumer's `data-key` (Resolved questions 3).

Not part of Listbox:

- **Virtualization.** Listbox works with every option rendered. Rendering only
  the visible ones (`@tanstack/virtual-core`, which root AGENTS.md approves if
  it fits) is its own spec, [virtualization.md](./virtualization.md)
  (Resolved questions 12). The item parts are built
  for it: props are lazy, items are data, and the collection knows positions
  without the DOM.
- **Actions and links.** React Aria's `onAction` modes (a press runs an
  action, a long press selects), `selectionBehavior: 'replace'` and options
  that are links belong to Menu and GridList. An option is for selecting.
- **Select all as an option.** UI Kit's select-all row sits outside the
  listbox and the arrow keys never reach it. The APG recommends separate
  buttons; Ctrl+A (Cmd+A on Apple platforms) selects all (Resolved questions 11).
- **Filtering, loading more and custom values**: Combobox's. The consumer
  passes the items to show.
- **Reordering** (UI Kit's `isReorderable`, Alt+Arrow): a later addition.
- **Form submission.** A listbox has no native form value; Select carries a
  hidden `<select>`. A consumer form reads `value`.
- **Interactive content in options.** The APG: a listbox option can't hold
  buttons, links or checkboxes; that is a grid.
- **Looks.** Checkmarks, checkboxes drawn in multiple mode (UI Kit's
  `isCheckable`), sizes, shapes, gaps, headers and footers are the design
  system's. Separators between groups are CSS: `separator` is not allowed in
  a listbox, and UI Kit's and React Aria Components' separators break that.

## Anatomy

Named parts, one element each:

| Part        | Element                                                   | Attributes UniAria owns                                                                                                                                                                                                                                   | Notes                                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root        | any; usually `div`                                        | as Field: state attributes                                                                                                                                                                                                                                | Optional wrapper around label, list, description and error.                                                                                                                                             |
| label       | `span` by default; any element through `labelElementType` | as Field: `id`, state attributes                                                                                                                                                                                                                          | No `for`: a listbox is not labelable.                                                                                                                                                                   |
| list        | any; usually `ul` or `div`                                | `role="listbox"`, `aria-orientation`, `aria-multiselectable`, `aria-disabled`, `aria-readonly`, `tabindex` (`0` while no option takes focus, else `-1`); as Field's control: `id`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required` | Holds the options and groups. Never left out when it is empty: a combobox's `aria-controls` points at it.                                                                                               |
| description | any                                                       | as Field                                                                                                                                                                                                                                                  | Read when focus enters the list.                                                                                                                                                                        |
| error       | any                                                       | as Field                                                                                                                                                                                                                                                  | Announced by Field when it appears.                                                                                                                                                                     |
| empty       | any; outside the list                                     | `id`, `hidden` while there are items                                                                                                                                                                                                                      | The consumer's "No items" text. While the list is empty it describes it, so focus on the list reads it (Resolved questions 10). Outside the list because a listbox may only contain options and groups. |

Item parts, one element per item and part, keyed by the item's key (in
custom elements, the consumer's `data-key` on the element):

| Part              | Element                    | Attributes UniAria owns                                                                                                      | Notes                                                                                                                                                       |
| ----------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| option            | any; usually `li` or `div` | `role="option"`, `id`, `tabindex`, `aria-selected`, `aria-disabled`, `aria-labelledby`, `aria-describedby`, state attributes | One per item that isn't a group. Its name is its text, or its `optionLabel` part.                                                                           |
| optionLabel       | any, inside the option     | `id`                                                                                                                         | Optional. When rendered, the option is named by it alone, so a description or a badge stays out of the name.                                                |
| optionDescription | any, inside the option     | `id`                                                                                                                         | Optional. When rendered, it describes the option: `option, Apple, Red and sweet, not selected`.                                                             |
| group             | any; usually `div`         | `role="group"`, `aria-labelledby`, state attributes                                                                          | One per item with children (a section). Holds its label and its options. In a `ul`, the group's own list needs `role="presentation"`, so `div`s are easier. |
| groupLabel        | any, first in the group    | `role="presentation"`, `id`                                                                                                  | Names the group. `presentation` because a listbox may not contain headings (React Aria, the APG's grouped example).                                         |

The root carries the `uni-listbox` class; every other part, item parts
included, carries `data-scope="listbox"` and `data-element`, the part name
capitalized (`List`, `Option`, `GroupLabel`). UniAria writes nothing on an
item part the consumer didn't render, and item ids are made from the list's
id and the key (Item parts).

## Props

Boolean props read as predicates. Keys are strings.

| Prop                  | Type                                           | Default                    | Bindable | Change event  | Notes                                                                                                                                                            |
| --------------------- | ---------------------------------------------- | -------------------------- | -------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| items                 | `readonly Item[]`                              | `[]`                       | no       | —             | The options and groups, in order. A property on the element; without it the element reads them from its markup (Resolved questions 3).                           |
| getKey                | `(item: Item) => string`                       | `item.key`                 | no       | —             | Unique per list; development warns about duplicates.                                                                                                             |
| getTextValue          | `(item: Item) => string`                       | `item.textValue`           | no       | —             | What typeahead matches. Development warns when an option has none.                                                                                               |
| isItemDisabled        | `(item: Item) => boolean`                      | `item.isDisabled === true` | no       | —             | Root AGENTS.md's `isDisabled` accessor, renamed so it doesn't collide with the list's own `isDisabled`.                                                          |
| getChildren           | `(item: Item) => readonly Item[] \| undefined` | `item.items`               | no       | —             | An item with children is a group; its children are its options. Groups don't nest.                                                                               |
| disabledKeys          | `readonly string[]`                            | `[]`                       | no       | —             | Disabled too, besides `isItemDisabled`: React Aria's and UI Kit's prop, and how markup says it (attribute `disabled-keys`, JSON).                                |
| value                 | `readonly string[]`                            | `[]`                       | yes      | `valueChange` | The selected keys, in the order they were selected; at most one in single mode (Resolved questions 5). Keys with no item stay in it.                             |
| selectionMode         | `'single' \| 'multiple'`                       | `'single'`                 | no       | —             | `aria-multiselectable="true"` in multiple mode.                                                                                                                  |
| isDisabled            | `boolean`                                      | `false`                    | no       | —             | `aria-disabled="true"` on the list and every option; no tab stop.                                                                                                |
| isReadOnly            | `boolean`                                      | `false`                    | no       | —             | `aria-readonly="true"` on the list; focus moves, nothing is selected. Attribute `readonly`. As RadioGroup and CheckboxGroup; React Aria's ListBox has none.      |
| isRequired            | `boolean`                                      | `false`                    | no       | —             | Field's: `aria-required` on the list.                                                                                                                            |
| isInvalid             | `boolean`                                      | `false`                    | no       | —             | Field's: `aria-invalid` on the list, shows and announces the error.                                                                                              |
| orientation           | `'vertical' \| 'horizontal'`                   | `'vertical'`               | no       | —             | Which arrows move; `aria-orientation`, always written, and `data-orientation`.                                                                                   |
| shouldFocusWrap       | `boolean`                                      | `false`                    | no       | —             | The arrows go from the last option to the first and back. Home, End and the page keys never wrap. Attribute `focus-wrap`.                                        |
| shouldFocusOnHover    | `boolean`                                      | `false`                    | no       | —             | A hovering mouse moves focus to the option, unless focus is visible (the keyboard is in use), as React Aria. Select will turn it on. Attribute `focus-on-hover`. |
| shouldUseVirtualFocus | `boolean`                                      | `false`                    | no       | —             | Virtual focus, for a component that keeps focus in its own input (Combobox, its Resolved questions 1): see Focus. Property only.                                 |
| listId                | `string \| undefined`                          | generated                  | no       | —             | Field's `controlId`. The element adopts the list's `id`. Item ids follow it.                                                                                     |
| labelElementType      | `string`                                       | `'span'`                   | no       | —             | Field's. The element reads the label's tag.                                                                                                                      |
| labelledBy            | `string \| undefined`                          | —                          | no       | —             | Field's.                                                                                                                                                         |
| describedBy           | `string \| undefined`                          | —                          | no       | —             | Field's.                                                                                                                                                         |

`Item` is whatever the accessors read. Without accessors it is
`{ key: string; textValue: string; isDisabled?: boolean; items?: Item[] }`,
so plain objects work as they are and custom data needs no copy.

An option is disabled when `isItemDisabled` or `disabledKeys` says so, or the
list is disabled. A disabled option can't be focused or selected and the keys
skip it: React Aria's `disabledBehavior: 'all'`, which UI Kit hard-codes. Its
`'selection'` (focusable, not selectable) is left out with actions.

Development warns when the list has no name: no label part, no
`labelledBy` and no `aria-label` or `aria-labelledby` from the consumer.

## Events

| Event         | Detail              | When                                                                                                                                                                                                                               |
| ------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valueChange` | `readonly string[]` | The user changed the selection: a press, Enter, Space, a range key or Ctrl+A. Never for a value the consumer sets.                                                                                                                 |
| `action`      | `string`            | The user chose an option by a press, Enter or Space, after any `valueChange`, also when the selection didn't change (single mode, the selected option again). Select will close on it (Resolved questions 6). Not while read-only. |
| `focusChange` | `boolean`           | Focus entered or left the list, for a form that validates on blur.                                                                                                                                                                 |

## Public state

| Field          | Type                     | Meaning                                                       |
| -------------- | ------------------------ | ------------------------------------------------------------- |
| value          | `readonly string[]`      | The selected keys.                                            |
| selectionMode  | `'single' \| 'multiple'` |                                                               |
| focusedKey     | `string \| null`         | The option with focus, or the one the list will focus on Tab. |
| isEmpty        | `boolean`                | No options (groups don't count).                              |
| isDisabled     | `boolean`                |                                                               |
| isReadOnly     | `boolean`                |                                                               |
| isRequired     | `boolean`                |                                                               |
| isInvalid      | `boolean`                |                                                               |
| isErrorShown   | `boolean`                | Field's.                                                      |
| isFocusWithin  | `boolean`                | Focus is on the list or an option.                            |
| isFocusVisible | `boolean`                | That focus came from the keyboard.                            |

Per option, a selector reads `value` and `focusedKey`
(`useComponentState(list, (s) => s.value.includes(key))`), or CSS reads the
option's state attributes.

## Item parts

The runtime change Listbox needs (Resolved questions 1). Today a definition has
named parts, one element each, and `connect()` returns props for all of them
at once, re-run after every flush. Item parts add, beside them:

- **Definition.** `itemParts: readonly ItemPart[]` and
  `connectItem(ctx, part, key): PartProps`, the same `PartProps` as
  `connect()`, called for one rendered item part at a time and never for
  items nobody rendered.
- **Ids.** `ctx.itemId(part, key)` is `<list id>-<part>-<key>`, the key passed
  through `encodeURIComponent`, so `"a b"` and `"ab"` don't collide (React
  Aria strips whitespace and they do) and no id holds a space. Item ids are
  not overridable one by one; overriding `listId` moves them all. Root
  AGENTS.md says consumers can override every id, so this needs the owner's
  word.
- **Elements.** `ctx.itemElement(part, key)` is the element rendered for an
  item part, or `null`: Listbox focuses and scrolls options through it.
- **Invalidation.** After a flush the runtime re-runs `connectItem` only for
  the keys the definition names with `ctx.invalidateItems(keys)` (all of them
  when it names none, and on every change of props), and only for item parts
  that are rendered. Moving focus rewrites two options and a click one, not
  every row: root AGENTS.md's "never for every row at once". Attaching or
  detaching an item part re-runs its key, so an option links to its
  `optionLabel` and `optionDescription` only while they are rendered, as
  Field does for its parts.
- **Handlers** are one per part and event type; the runtime finds the key
  from the element the event reached, so no closure is made per row.
- **Custom elements.** Item parts are found by `data-element`, every match
  rather than the first, and keyed by the consumer's `data-key`, which the
  `MutationObserver` also watches. An item part without `data-key` is skipped
  with a development warning. The element writes item props on the
  consumer's elements as it does on named parts, and owns the same
  attributes on them.
- **React.** `handle.getItemProps(part, key)` returns the item's React props,
  with a stable ref per part and key that attaches and detaches the element.
  The props come from `connectItem` during render, so server HTML has them;
  after that, focus and selection changes go through the binder, so the
  component that renders the list re-renders zero times when focus moves,
  as root AGENTS.md requires.

## Selection

- **Single mode.** A press, Enter or Space on an option selects it, replacing
  the selection. On the selected option they change nothing and report
  `action` (Resolved questions 6). The user can't empty the selection: neither
  re-picking nor Escape clears it, as in `<select>` and RadioGroup.
- **Multiple mode.** A press, Enter or Space toggles the option, as React
  Aria's default `selectionBehavior: 'toggle'` and the APG's recommended
  model: no key needs a modifier held. Modifiers add ranges:
  - Shift+ArrowDown and Shift+ArrowUp (Left and Right when horizontal) move
    focus and select from the anchor to the new option (Resolved questions 9).
  - Shift+Space and a Shift+click select from the anchor to the option.
  - Ctrl+Shift+Home and Ctrl+Shift+End (Cmd on Apple platforms) select from
    the anchor to the first or last option and move focus there.
  - Shift+PageUp and Shift+PageDown select from the anchor to where the page
    key lands.
  - Ctrl+A (Cmd+A on Apple platforms) selects every enabled option. With all
    of them selected it changes nothing; it never deselects (React Aria; the
    APG makes that optional).
- **The anchor** is the option last selected by a press, Enter or Space, as
  React Aria: a range from it replaces the previous range from the same
  anchor and keeps everything else selected. Toggling an option off leaves the
  anchor. With no anchor yet (the value came from props), the anchor is the
  option focused before the move, as `<select multiple>`; React Aria uses the
  target alone. Disabled options inside a range are skipped.
- **Selection doesn't follow focus.** Arrows, Home, End, the page keys and
  typeahead move focus only, in both modes: React Aria does so only in its
  `replace` behavior, the APG makes it optional for single selection, and the
  APG's keyboard guide warns against it where selecting has effects.
- **Read-only.** Focus moves; presses and keys select nothing and report no
  `action`.
- **Controlled.** As every bindable: the change is requested, and the options
  show the consumer's value once props change.
- **Order.** `value` keeps the order of selection; a range adds its options
  in list order. Removing an item keeps its key in `value`, as RadioGroup
  keeps a value with no radio.

## Keyboard

Keys act on `keydown` of the focused option and call `preventDefault`;
UniAria never stops propagation (design decision 4). Keys it doesn't handle
stay the browser's and the page's, Escape and Tab always among them.

Vertical (horizontal swaps ArrowDown for ArrowRight and ArrowUp for
ArrowLeft, and in right-to-left text ArrowLeft for ArrowRight, as
RadioGroup):

| Key                              | Action                                                                                                                                                                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab, Shift+Tab                   | The list is one tab stop. It enters at the option focused last; before any, at the first selected option, else the first enabled one (the APG, both modes). With no option to focus, the list itself takes the tab stop. Leaving is the browser's. |
| ArrowDown                        | Focuses the next enabled option, across groups. At the end, nothing, or the first with `shouldFocusWrap`.                                                                                                                                          |
| ArrowUp                          | The same, to the previous option.                                                                                                                                                                                                                  |
| ArrowLeft, ArrowRight (vertical) | Not handled: they pass, as in React Aria.                                                                                                                                                                                                          |
| ArrowUp, ArrowDown (horizontal)  | Not handled.                                                                                                                                                                                                                                       |
| Home, End                        | Focuses the first or last enabled option. Shift+Home and Shift+End do the same and select nothing (React Aria).                                                                                                                                    |
| PageDown, PageUp                 | Focuses the option a page further: the last option whose top is within the visible height of the list's scroll container below the focused one (React Aria's rect math). Without scrolling, the last or first option.                              |
| Space                            | Selects (single) or toggles (multiple) the focused option. Joins a typeahead query instead within a second of the last typed key.                                                                                                                  |
| Enter                            | The same as Space, never joining a query. React Aria selects on Enter too.                                                                                                                                                                         |
| Printable characters             | Typeahead (`collections/typeahead`, interaction layer §11 and its differences): focuses the next enabled option whose text starts with what was typed in the last second; selects nothing.                                                         |
| Shift, Ctrl+Shift, Ctrl/Cmd+A    | Multiple mode: ranges and select all (Selection). Single mode: Shift and Ctrl+Shift act as the key alone (React Aria), and Ctrl+A passes.                                                                                                          |
| Alt, Ctrl or Meta with an arrow  | Not handled: they pass (Alt+ArrowLeft is Back on Windows).                                                                                                                                                                                         |
| Escape                           | Not handled, so a popover around the list closes (Resolved questions 7). React Aria clears the selection.                                                                                                                                          |

## ARIA and state attributes per state

| State               | Part             | Attributes                                                                                                                                             |
| ------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| idle                | list             | `role="listbox"`, `aria-orientation`; Field's `id`, `aria-labelledby`, `aria-describedby`                                                              |
|                     | option           | `role="option"`, `id`, `aria-selected="false"`, `tabindex="-1"`; `aria-labelledby` and `aria-describedby` while its label and description are rendered |
|                     | group            | `role="group"`, `aria-labelledby` its label's id while rendered                                                                                        |
|                     | groupLabel       | `role="presentation"`, `id`                                                                                                                            |
| the tab stop        | option           | `tabindex="0"`                                                                                                                                         |
| multiple mode       | list             | + `aria-multiselectable="true"`; every named part + `data-multiple`                                                                                    |
| selected            | option           | `aria-selected="true"`, + `data-selected`                                                                                                              |
| focused             | option           | + `data-focused`, + `data-focus-visible` after keyboard focus                                                                                          |
|                     | every named part | + `data-focus-within`, + `data-focus-visible` after keyboard focus                                                                                     |
| hovered             | option           | + `data-hovered` (a mouse or pen, not touch; never on a disabled option)                                                                               |
| pressed             | option           | + `data-pressed`                                                                                                                                       |
| disabled option     | option           | + `aria-disabled="true"`, + `data-disabled`; no `tabindex`                                                                                             |
| disabled list       | list             | + `aria-disabled="true"`; no option `tabindex`; every part + `data-disabled`; the error hidden (Field)                                                 |
|                     | option           | + `aria-disabled="true"`                                                                                                                               |
| read-only           | list             | + `aria-readonly="true"`; every part + `data-readonly`                                                                                                 |
| required            | list             | + `aria-required="true"`; every named part + `data-required`                                                                                           |
| invalid             | list             | + `aria-invalid="true"`; every named part + `data-invalid`                                                                                             |
| empty               | list             | + `tabindex="0"`, `aria-describedby` gains the empty part's id; every named part + `data-empty`                                                        |
|                     | empty            | no `hidden`                                                                                                                                            |
| no focusable option | list             | `tabindex="0"` (every option disabled)                                                                                                                 |

`aria-selected="false"` is explicit on every unselected option: the APG
requires it for options that can be selected, and React Aria and Zag write
it. `aria-setsize` and `aria-posinset` are not written: with every option in
the DOM the browser counts them (Chromium across the list's groups, the
virtual screen reader per group, probed below). Virtualization writes them
([virtualization spec](./virtualization.md), ARIA).

## Focus

Roving tabindex (Resolved questions 4): DOM focus moves to the option, which has
`tabindex="0"` while it is the tab stop and `-1` otherwise. The list holds no
`aria-activedescendant`. While an option is the tab stop the list has
`tabindex="-1"`, as React Aria writes: Firefox makes an element that scrolls a
tab stop of its own. Focus on the list itself, from a click or a script, goes
on to the tab stop.

- **Moving** calls `focus({ preventScroll: true })` on the option. After a
  key, Listbox then scrolls it into view with
  `scrollIntoView({ block: 'nearest', inline: 'nearest' })`. After a pointer
  nothing scrolls, so a click on a half-visible option doesn't jump (React
  Aria scrolls only for the keyboard too). Under a screen reader's virtual
  cursor Listbox doesn't scroll either: VoiceOver on iOS scrolls itself and
  can close overlays when a page scrolls under it (React Aria).
- **Tab in** lands on the tab stop (Keyboard). The list itself takes the tab
  stop only while no option can be focused; focus on it reads its name and,
  when empty, the empty part.
- **A press** focuses the option on pointer down (it has a `tabindex`), so
  the tab stop moves there. A press on a disabled option prevents the
  `mousedown`, so focus doesn't fall to the body (React Aria).
- **The focused option goes away** (its item removed, or it becomes disabled):
  focus moves to the next enabled option in the old order, else the previous,
  else the list, as React Aria. Only when focus was on it.
- **The disabled list** has no tab stop and no focusable option.
- **Focus out** keeps the tab stop on the last focused option (React Aria; the
  APG lets the design choose).

## Pointer and touch

- **Selecting on release.** A press selects when it ends on the option it
  started on (`press` from `dom/`), for mouse, pen, touch and a screen
  reader's virtual click alike: UI Kit hard-codes React Aria's
  `shouldSelectOnPressUp`. A touch that scrolls the list selects nothing.
  React Aria's default selects a mouse press on `mousedown`.
- **Modifiers** (multiple mode): Shift+click selects the range from the
  anchor and doesn't select text. Ctrl+click and Cmd+click toggle, as a
  plain click does.
- **Other buttons.** Middle and right clicks do nothing.
- **Hover** marks the option with `data-hovered`, from a mouse or pen,
  never touch, never a disabled one. With `shouldFocusOnHover`, hovering also focuses the option
  while focus isn't visible (React Aria; Select will use it). UI Kit
  documents that as the default but its code leaves it off; UniAria's
  default is off.
- **Virtual focus** (`shouldUseVirtualFocus`, added with Combobox). DOM
  focus stays in the composing component's input, which points at the
  highlighted option with `aria-activedescendant`. The list and its options
  take no `tabindex`; `data-focused` follows the highlight, and
  `data-focus-visible` marks a highlight the keys moved, which the composing
  component sets through the api and Listbox scrolls into view. A press on
  an option prevents its `mousedown`, so focus stays in the input. With
  `shouldFocusOnHover`, hovering highlights, except over a highlight the keys
  moved, as hover never takes keyboard focus.

## Styling tokens

| Token                | On                  | Meaning                                                       |
| -------------------- | ------------------- | ------------------------------------------------------------- |
| `data-selected`      | option              | Selected.                                                     |
| `data-focused`       | option              | Has focus.                                                    |
| `data-focus-visible` | option, named parts | Keyboard focus.                                               |
| `data-focus-within`  | named parts         | Focus is on the list or an option.                            |
| `data-hovered`       | option              | A mouse or pen is over it.                                    |
| `data-pressed`       | option              | Being pressed.                                                |
| `data-disabled`      | option, every part  | The option, or the whole list.                                |
| `data-readonly`      | every part          |                                                               |
| `data-required`      | named parts         |                                                               |
| `data-invalid`       | named parts         |                                                               |
| `data-multiple`      | named parts         | Multiple mode, for checkbox-like looks.                       |
| `data-orientation`   | named parts         | `vertical` or `horizontal`.                                   |
| `data-empty`         | named parts         | No options.                                                   |
| `hidden`             | empty               | Written while there are options; the only style UniAria owns. |

No CSS variables.

## Expected spoken output

Confirmed with `@guidepup/virtual-screen-reader` in Chromium, on a list
"Fruit".

| State                                    | Spoken phrase                                                                    |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| the list                                 | `listbox, Fruit, orientated vertically`                                          |
| multiple mode                            | `listbox, Fruit, orientated vertically, multi-selectable`                        |
| described, invalid and required          | `listbox, Fruit, Pick one, orientated vertically, invalid, required`             |
| horizontal and disabled                  | `listbox, Fruit, orientated horizontally, disabled`                              |
| an option                                | `option, Apple, not selected, position 1, set size 2`                            |
| a selected option                        | `option, Banana, selected, position 2, set size 2`                               |
| a disabled option                        | `option, Cherry, not selected, disabled, position 1, set size 1`                 |
| an option with an `optionDescription`    | `option, Apple, Red and sweet, not selected, position 1, set size 1`             |
| a group, then its label, then its option | `group, Citrus`, `Citrus`, `option, Lemon, not selected, position 1, set size 1` |
| an empty list without an empty part      | `listbox, Fruit, orientated vertically`                                          |
| an empty list with an empty part         | `listbox, Fruit, No fruit, orientated vertically`                                |
| read-only                                | `listbox, Fruit, orientated vertically, read only`                               |

Position and set size are counted per group by the virtual screen reader;
Chromium numbers the options across a listbox's groups (virtualization spec,
Corrections). Probed for the
open questions: an option with `aria-checked` instead reads
`option, Apple, not selected, checked, position 1, set size 2` (Open
questions 8); an option standing in for the empty state reads
`option, No fruit, not selected, position 1, set size 1` (Resolved questions 10);
with `aria-posinset="42"` and `aria-setsize="100"` an option reads
`option, Kiwi, not selected, position 42, set size 100` (Resolved questions 12).

## Adapter surface

```tsx
// React
const fruit = useComponent(listbox, {
  items, // [{ key: 'apple', textValue: 'Apple' }, …]
  selectionMode: 'multiple',
  defaultValue: ['banana'],
  onValueChange,
});
return (
  <div {...fruit.parts.root}>
    <span {...fruit.parts.label}>Fruit</span>
    <ul {...fruit.parts.list}>
      {items.map((item) => (
        <li key={item.key} {...fruit.getItemProps('option', item.key)}>
          {item.textValue}
        </li>
      ))}
    </ul>
    <p {...fruit.parts.empty}>No fruit</p>
  </div>
);
```

```html
<!-- Custom elements: items read from the markup (Resolved questions 3) -->
<uni-listbox selection-mode="multiple" disabled-keys='["cherry"]'>
  <span data-element="Label">Fruit</span>
  <div data-element="List">
    <div data-element="Option" data-key="apple">Apple</div>
    <div data-element="Option" data-key="banana">Banana</div>
    <div data-element="Group" data-key="citrus">
      <span data-element="GroupLabel" data-key="citrus">Citrus</span>
      <div data-element="Option" data-key="lemon">
        <span data-element="OptionLabel" data-key="lemon">Lemon</span>
        <span data-element="OptionDescription" data-key="lemon">Sour</span>
      </div>
    </div>
  </div>
  <p data-element="Empty">No fruit</p>
</uni-listbox>
```

`@uniaria/core/listbox` exports `listbox`, and the element registers from the
same subpath of `@uniaria/elements`. Attributes: `selection-mode`,
`disabled-keys`, `disabled`, `readonly`, `required`, `invalid`,
`orientation`, `focus-wrap`, `focus-on-hover`, `labelled-by`,
`described-by`; properties `items`, `value` (controlled) and `defaultValue`;
events `valuechange`, `action` and `focuschange`. The host wraps the list: a
host never sits inside `<ul>`.

## Mapping from Cube UI Kit

Listbox backs ListBox, and later the lists of Select, Picker, ComboBox and
FilterListBox (UI Kit's Select has a second listbox of its own today).

- `selectedKey` / `selectedKeys` and their defaults map to `value` and
  `defaultValue`: `[key]` or `[]` in single mode. `'all'` becomes every
  enabled key. `onSelectionChange` maps to `onValueChange` (UI Kit unwraps
  single mode).
- `selectionMode`, `disabledKeys`, `shouldFocusWrap` and `isDisabled` keep
  their names; `focusOnHover` becomes `shouldFocusOnHover`.
- `label`, `description`, `errorMessage`, `isRequired` and validation map to
  Field's parts and props, as in TextField's spec.
- `items` and render functions, or static children, become `items` data
  plus the rendered options; `ListBox.Section` becomes an item with `items`.
  Item `textValue` keeps its name.
- `disableSelectionToggle` and `allowDuplicateSelectionEvents` go: single mode
  never deselects on a re-pick, and `action` reports every choice.
  `onOptionClick` maps to `onAction`.
- `onEscape` becomes the consumer's own `keydown` on the list: Listbox leaves
  Escape alone.
- `disallowEmptySelection` goes: single mode can't be emptied by the user.
- `stateRef` and `listRef` go: public state, the api and the list part.
- `isCheckable`, `size`, `shape`, `listGap`, `header`, `footer`,
  `optionHighlight` and the style props are the design system's.
  `emptyLabel` is the empty part's text.
- `showSelectAll` goes (Resolved questions 11); `isReorderable` waits;
  `shouldUseVirtualFocus` came with Combobox; `filter` is the consumer
  passing fewer items.
- **Fixes.** The list stays rendered when empty, and its empty state is read.
  No option outside the listbox (select-all), no `separator` inside it, no
  `role="footer"`. A non-string label names the list by reference instead of
  `[object Object]`. Ids don't collide on whitespace. Keys other than Escape
  and Tab reach the page again, prevented when Listbox used them.

## Differences from React Aria, Zag and native behavior

| #   | Topic                           | Cube UI Kit and React Aria                                                        | APG, Zag, native `<select>`                                                     | Decided                                         |
| --- | ------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Focus                           | Roving tabindex; virtual focus for Combobox                                       | APG examples, Zag: `aria-activedescendant` on the list                          | Roving; virtual focus with Combobox (Q4)        |
| 2   | Value                           | React Aria: a `Set` or `'all'`; UI Kit: a key in single mode, an array or `'all'` | Zag: `string[]` in every mode                                                   | `string[]` in every mode, no `'all'` (Q5)       |
| 3   | The selected option again       | React Aria: deselects (single); UI Kit: two flags                                 | Zag: deselects with `deselectable`; `<select>`: stays selected                  | Stays selected, `action` reported (Q6)          |
| 4   | Escape                          | React Aria: clears the selection; UI Kit: `onEscape` instead                      | Zag: clears with `deselectable`; APG: nothing                                   | Not handled (Q7)                                |
| 5   | Selected state in multiple mode | `aria-selected`                                                                   | APG: recommends `aria-checked`; Zag: `aria-selected`                            | `aria-selected` (Q8)                            |
| 6   | Shift+Arrow                     | Range from the anchor                                                             | APG text: toggles the next option; its example, Zag, `<select multiple>`: range | Range (Q9), an APG deviation                    |
| 7   | Selection follows focus         | React Aria: in `replace` behavior only                                            | APG: optional in single mode; `<select size>`: yes                              | Never                                           |
| 8   | Pointer timing                  | React Aria: `mousedown` for a mouse; UI Kit: on release                           | Zag: on click                                                                   | On release (UI Kit)                             |
| 9   | Empty state                     | React Aria: a `role="option"` wrapper; UI Kit: the list removed                   | APG: an empty list; Zag: nothing                                                | An `empty` part describing the list (Q10)       |
| 10  | Typeahead                       | React Aria: 1 s, a miss empties the query                                         | Zag: 350 ms, a repeated letter cycles; APG example: 500 ms                      | 1 s, a miss keeps the query (interaction layer) |
| 11  | Ctrl+A                          | All (`'all'`)                                                                     | APG: may deselect when all are selected; Zag: includes disabled options         | Every enabled option, never deselects           |
| 12  | Keys Listbox doesn't use        | React Aria: pass; UI Kit: stopped except Escape and Tab                           | —                                                                               | Pass; never stopped                             |
| 13  | Option ids                      | `<list id>-option-<key>`, whitespace stripped                                     | Zag: `listbox:<id>:item:<value>`                                                | `<list id>-option-<encoded key>`                |
| 14  | Set size and position           | React Aria: written when virtualized; UI Kit: always                              | APG: required when not every option is in the DOM; Zag: never                   | Written when virtualized (Q12)                  |
| 15  | Page Up, Page Down              | A page by the options' rects                                                      | APG: not listed; Zag: nothing; FilterListBox: first and last                    | React Aria's                                    |
| 16  | Hover focus                     | Off (UI Kit documents it on); Select turns it on                                  | Zag: highlight on hover                                                         | Off, `shouldFocusOnHover`                       |
| 17  | Tab in, before any focus        | React Aria: first selected, or from below the last selected                       | APG: the first selected option, else the first                                  | APG's                                           |
| 18  | Read-only                       | None                                                                              | `aria-readonly` allowed on `listbox`                                            | `isReadOnly`, as RadioGroup                     |

## Deviations from the WAI-ARIA pattern

Resolved questions 9: Shift+ArrowDown and Shift+ArrowUp extend a range
from the anchor instead of toggling the next option, as the APG's own
multi-select example, React Aria, UI Kit, Zag and `<select multiple>` do.
The rest follows the pattern; the APG's optional keys are all present except
Ctrl+A deselecting.

## Resolved questions

Decided by @tenphi on 2026-10-18, each as recommended.

1. **Item parts in the runtime.** The contract in [Item parts](#item-parts):
   `itemParts` and `connectItem` in definitions, `ctx.itemId`,
   `ctx.itemElement` and `ctx.invalidateItems`, item parts found in markup by
   `data-part` and the consumer's `data-key`, and `getItemProps(part, key)` in
   React. Item ids are made from `listId` and are not overridable one by one,
   unlike root AGENTS.md's "consumers can override every id". The
   alternative, each option its own instance (RadioGroup's radios), doesn't
   scale to long lists, can't virtualize and makes options components.
   Decided: approved, landing as its own runtime commit before Listbox.
   Part markers changed on 2026-10-19 (owner): item parts are found by
   `data-element` (`Option`, `Group`, …) instead of `data-part`.
2. **Accessors and `disabledKeys`.** Root AGENTS.md names `getKey`,
   `getTextValue` and `isDisabled`; the last becomes `isItemDisabled` so the
   list keeps `isDisabled`, and `disabledKeys` sits beside it for markup and
   for UI Kit (React Aria Components has both too). Decided: as written.
3. **Items from markup in custom elements.** Root AGENTS.md: the core never
   derives a collection from children. May the element adapter, as it adopts
   props from markup? (a) Yes: without an `items` property, the element reads
   its group and option parts in document order, the key from `data-key`, the
   text from `data-text-value` or else the option's text, disabled from
   `disabled-keys`, and reads them again when the markup changes. (b) No: the
   element needs its `items` property, so static HTML can't build a listbox.
   Decided: (a).
4. **Focus model.** (a) Roving tabindex standalone, as React Aria and UI Kit:
   real focus, `:focus-visible` in consumer CSS works, and mobile screen
   readers follow it. Virtual focus (`aria-activedescendant` on Combobox's
   input) is added with Combobox, which drives the list through its api.
   (b) `aria-activedescendant` on the list always, as the APG's examples and
   Zag: one focus model, but the option's focus look is all data attributes,
   and the APG warns the script must scroll every move. Decided: (a).
5. **The value.** (a) `value: readonly string[]` in both modes (Zag; UniAria's
   CheckboxGroup), so the type never changes with the mode; Select will
   expose a single key. (b) UI Kit's split: `selectedKey` in single mode,
   `selectedKeys` in multiple. Either way no `'all'`: it hides which keys are
   selected, and React Aria needs `fullCollection` tricks for it.
   Decided: (a).
6. **Choosing the selected option again** in single mode. UI Kit has three
   behaviors today (Picker clears, FilterPicker closes without an event,
   Combobox likely clears). (a) Nothing changes and `action` reports the
   choice, so Select closes; (b) React Aria's: it deselects. Decided: (a).
7. **Escape.** (a) Not handled, so it reaches a popover or dialog around the
   list in one press; (b) React Aria's: the first Escape clears the selection
   and the second closes the overlay. Decided: (a); UI Kit already turns
   React Aria's off wherever it can.
8. **The selected state in multiple mode.** The APG recommends `aria-checked`
   for multi-select listboxes; React Aria, UI Kit and Zag use `aria-selected`.
   Probed, `aria-checked` reads `not selected, checked`: the browser still
   exposes a selected state, so the option says both. Decided:
   `aria-selected` in both modes.
9. **Shift+Arrow.** (a) Extends a range from the anchor (React Aria, UI Kit,
   Zag, the APG's example, `<select multiple>`), an APG deviation; (b) the
   APG text: moves and toggles the next option. Decided: (a).
10. **The empty state.** (a) An `empty` part, hidden while there are options;
    while empty, the list takes the tab stop and is described by it:
    `listbox, Fruit, No fruit, …`. (b) React Aria's: a `role="option"` in the
    list, read as an option (`option, No fruit, not selected, position 1,
set size 1`), which isn't one. Decided: (a).
11. **Select all.** Out of scope beyond Ctrl+A: the APG recommends separate
    buttons, which a consumer builds with a Button setting `value`. UI Kit's
    `showSelectAll` row becomes such a button. Decided: as written.
12. **Virtualization.** Deferred to a follow-up spec: TanStack virtual-core
    (about 7 kB brotli) fits with a range that always keeps the focused
    option rendered, but the elements adapter can't render rows, so markup
    consumers must re-render from a range event, and React's rows must
    re-render when the range moves, which root AGENTS.md's render-count rule
    needs to allow. Decided: deferred; Listbox v1 renders every option.

## Open questions

None.
