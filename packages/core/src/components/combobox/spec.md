# Combobox spec

Status: approved by @tenphi on 2026-10-18

## Summary

A combo box is a text input with a list of suggestions under it: typing
filters the options, and choosing one puts its text in the input and makes
it the value. It replaces `<input list>` with `<datalist>` where the options
need markup, groups, a styled popup, or a value separate from the text.
Combobox is Field, Listbox and Popover composed (`ctx.use`), as root
AGENTS.md says: Field names and describes the input; Listbox is the list
with its options and selection; Popover holds the list over the page,
places it and dismisses it. Combobox adds the input: filtering, which keys
and presses open the list, the highlighted option (focus stays in the
input), and how the typed text settles into a value.

Cube UI Kit's ComboBox is the model. Unlike its Select, it is UI Kit's own
implementation, not React Aria's `useComboBox`: UI Kit replaced it because
React Aria's patterns hurt its users (root AGENTS.md). Where UI Kit, React
Aria, the APG, Zag and the browser's `<datalist>` disagree, the difference
is in [Differences](#differences-from-ui-kit-react-aria-the-apg-and-zag)
and the choice is in [Resolved questions](#resolved-questions). UI Kit's
rough edges that UniAria doesn't copy are listed in
[Mapping from Cube UI Kit](#mapping-from-cube-ui-kit), to file there once
reviewed.

- **WAI-ARIA pattern:** the
  [combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) with list
  autocomplete
  (`references/aria-practices/content/patterns/combobox/examples/combobox-autocomplete-list.html`):
  `role="combobox"` on the input, `aria-autocomplete="list"`, DOM focus on
  the input and the highlighted option in `aria-activedescendant`, with a
  `tabindex="-1"` button that opens the list.
- **Builds on:** Field (`ctx.use`, its `control` part as `input`); Listbox
  (`ctx.use`: `list`, `empty` and the item parts, without its label,
  description and error), with a new virtual focus mode (Resolved questions 1);
  Popover (`ctx.use`: its `root` as `popover`, its `trigger` as the input,
  `anchor` and `arrow`), non-modal, with a new prop to leave focus where it
  is on open (Resolved questions 10); `createPress` for the button;
  `findByText`'s collator for the default filter; the live announcer.
- **Owner:** none.
- **Custom element:** yes, `<uni-combobox>`, hosting consumer markup. As
  `<uni-listbox>`, it reads its items from the options in the popover when
  `items` isn't set, and hides the options the filter leaves out with
  `hidden` (root design doc, Scope). Very large option lists virtualize, as
  Listbox's ([virtualization spec](../listbox/virtualization.md)): `items`
  set as a property, and the options rendered from `renderedKeys`.

Not part of Combobox:

- **Multiple selection** (tags in the field): a later TagField. Resolved
  questions 16.
- **A clear button.** The consumer's button: clearing sets `value` to `[]`
  and `inputValue` to `''`, as Select.
- **Loading and async options.** The consumer passes the items to show and
  turns the built-in filter off (`filter: false`) to filter on the server
  from `inputChange`. A loading list is an empty list whose empty part says
  so.
- **Inline completion** (`aria-autocomplete="both"`: the rest of the first
  match typed ahead and selected). React Aria lists it as a TODO, and UI Kit
  doesn't have it.
- **Sorting the selected option to the top** (UI Kit's `sortSelectedToTop`):
  the consumer orders the items.
- **A tray on small screens** (React Spectrum's `MobileComboBox`): a design
  system's choice.
- **Looks.** The chevron, highlight colors, the popup's width and height: the
  design system's, with the tokens in [Styling tokens](#styling-tokens).

## Anatomy

| Part        | Element                    | Attributes UniAria owns                                                                                                                                                                                                                                                                 | Notes                                                                                                                                                                                  |
| ----------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root        | any; usually `div`         | state attributes                                                                                                                                                                                                                                                                        | Field's root.                                                                                                                                                                          |
| label       | `label` by default         | `id`, `for`; state attributes                                                                                                                                                                                                                                                           | Field's. Names the input and the list.                                                                                                                                                 |
| anchor      | any; usually `div`         | state attributes                                                                                                                                                                                                                                                                        | Optional. The box around the input and the button (UI Kit's wrapper, Zag's control): the popup is placed against it and takes `--anchor-width` from it. Without it, the input is used. |
| input       | `input`                    | `id`, `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, Field's control attributes, `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`, `required`, `readonly`, `disabled`; the `value` property; state attributes | The text the user types, and the selected option's text once chosen. `type` is the consumer's (`text` or `search`).                                                                    |
| button      | `button`                   | Button's; `tabindex="-1"`, `aria-label`, `aria-labelledby`, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`, `disabled`; state attributes                                                                                                                                   | Optional. Opens and closes the list without taking focus (Resolved questions 11). Its icon is the consumer's, hidden from assistive technology.                                        |
| popover     | any; usually `div`         | Popover's root attributes except `role`, `tabindex` and the name: `id`, `popover="manual"`, `data-placement`, positioning styles; state attributes                                                                                                                                      | Render it always, after the input; hidden while closed. Not a dialog: the list inside is the popup.                                                                                    |
| arrow       | any                        | Popover's                                                                                                                                                                                                                                                                               | Optional.                                                                                                                                                                              |
| list        | any; usually `ul` or `div` | Listbox's list attributes in virtual focus mode (no `tabindex`), with `aria-labelledby` = the label (or `labelledBy`)                                                                                                                                                                   | Inside the popover.                                                                                                                                                                    |
| empty       | any                        | Listbox's                                                                                                                                                                                                                                                                               | Optional, inside the popover. Shown while no option matches; rendering it keeps the popup open then (Resolved questions 9).                                                            |
| description | any                        | `id`; state attributes                                                                                                                                                                                                                                                                  | Field's, describing the input.                                                                                                                                                         |
| error       | any                        | `id`, `hidden` while not shown; state attributes                                                                                                                                                                                                                                        | Field's.                                                                                                                                                                               |
| hiddenInput | `input`                    | `type="hidden"`, `disabled`; the `value` property                                                                                                                                                                                                                                       | Optional, as NumberField's: the consumer puts `name` and `form` here. Its value is the selected key, or the custom text (Resolved questions 13).                                       |

Item parts, as Listbox's and inside its list: `option`, `optionLabel`,
`optionDescription`, `group` and `groupLabel`, keyed by the consumer's
`data-key`, with Listbox's attributes and no `tabindex` (virtual focus). An
option the filter leaves out gets `hidden`, and so does a group with none
left. Options are rendered while the list is closed, inside the hidden
popover: the element reads its items from them.

State attributes on every named part: Popover's `data-open`,
`data-entering` and `data-exiting`; Field's `data-disabled`,
`data-readonly`, `data-required` and `data-invalid`; `data-focus-within`
and `data-focus-visible` while focus is on the input (or in the popup, for
an option holding a focusable control); `data-empty` while no option
matches.

## Props

Boolean props read as predicates. Keys are strings.

| Prop                    | Type                                                            | Default                                         | Bindable | Change event  | Notes                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------- | ----------------------------------------------- | -------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| items                   | `readonly Item[]`                                               | `[]`                                            | no       | —             | Listbox's: every option, unfiltered. The element reads them from its markup when unset.                                                                                                                                       |
| getKey                  | `(item: Item) => string`                                        | `item.key`                                      | no       | —             | Listbox's.                                                                                                                                                                                                                    |
| getTextValue            | `(item: Item) => string`                                        | `item.textValue`                                | no       | —             | Listbox's. Also what the filter matches and what the input shows once the option is chosen.                                                                                                                                   |
| isItemDisabled          | `(item: Item) => boolean`                                       | `item.isDisabled === true`                      | no       | —             | Listbox's.                                                                                                                                                                                                                    |
| getChildren             | `(item: Item) => readonly Item[] \| undefined`                  | `item.items`                                    | no       | —             | Listbox's.                                                                                                                                                                                                                    |
| disabledKeys            | `readonly string[]`                                             | `[]`                                            | no       | —             | Listbox's.                                                                                                                                                                                                                    |
| value                   | `readonly string[]`                                             | `[]`                                            | yes      | `valueChange` | The selected key, at most one; with `allowsCustomValue`, the custom text. Changes only when the text settles (Selection), never per keystroke.                                                                                |
| inputValue              | `string`                                                        | the selected option's text                      | yes      | `inputChange` | The input's text. `defaultInputValue` seeds it, else `defaultValue`'s option text.                                                                                                                                            |
| isOpen                  | `boolean`                                                       | `false`                                         | yes      | `openChange`  | Popover's. A controlled combo box that refuses to close stays open.                                                                                                                                                           |
| popoverTrigger          | `'input' \| 'focus' \| 'manual'`                                | `'input'`                                       | no       | —             | What opens the list besides the button and the arrow keys: typing (UI Kit's default), focus too, or neither (Resolved questions 8). React Aria's `menuTrigger`.                                                               |
| filter                  | `((textValue: string, inputValue: string) => boolean) \| false` | contains                                        | no       | —             | Which options match the typed text. The default: the text contains the trimmed input, ignoring case and accents, in the field's language. `false` shows every item as given (a `null` prop reads as unset, owner 2026-10-18). |
| allowsCustomValue       | `boolean`                                                       | `false`                                         | no       | —             | Text that matches no option becomes the value when it settles (Resolved questions 4).                                                                                                                                         |
| isDisabled              | `boolean`                                                       | `false`                                         | no       | —             | Field's. The input and the button are natively `disabled`.                                                                                                                                                                    |
| isReadOnly              | `boolean`                                                       | `false`                                         | no       | —             | The input is natively `readonly`; the list opens from the button and the arrows and the highlight moves, but nothing selects (Resolved questions 17). Attribute `readonly`.                                                   |
| isRequired              | `boolean`                                                       | `false`                                         | no       | —             | Field's `aria-required`, and the input's native `required` (Resolved questions 13).                                                                                                                                           |
| isInvalid               | `boolean`                                                       | `false`                                         | no       | —             | Field's.                                                                                                                                                                                                                      |
| shouldFocusWrap         | `boolean`                                                       | `false`                                         | no       | —             | Listbox's: the arrows wrap from the last option to the first. Attribute `focus-wrap`.                                                                                                                                         |
| positionArea            | `PositionArea`                                                  | `'block-end span-inline-end'`                   | no       | —             | Popover's: below the field, aligned to its start edge, as Select and UI Kit.                                                                                                                                                  |
| positionTryFallbacks    | `string`                                                        | `'flip-block, flip-inline'`                     | no       | —             | Popover's.                                                                                                                                                                                                                    |
| locale                  | `string \| undefined`                                           | the nearest `lang`                              | no       | —             | The default filter's language, as NumberField: the prop, else the nearest `lang`, else the browser's.                                                                                                                         |
| buttonLabel             | `string`                                                        | `'Show suggestions'`                            | no       | —             | The button's own name, read with the label ("Show suggestions Fruit"), as NumberField's button labels. English, replaced whole by a translation.                                                                              |
| optionCountAnnouncement | `(count: number) => string`                                     | `'1 option available'`, `'N options available'` | no       | —             | The live announcement of the option count (Live announcements). English, replaced whole by a translation. Property only.                                                                                                      |
| inputId                 | `string \| undefined`                                           | generated                                       | no       | —             | Field's `controlId`. The element adopts the input's `id`.                                                                                                                                                                     |
| listId                  | `string \| undefined`                                           | generated                                       | no       | —             | Listbox's: option ids follow it. The element adopts the list's `id`.                                                                                                                                                          |
| labelElementType        | `string`                                                        | `'label'`                                       | no       | —             | Field's. The element reads the label's tag.                                                                                                                                                                                   |
| labelledBy              | `string \| undefined`                                           | —                                               | no       | —             | Field's; names the list too.                                                                                                                                                                                                  |
| describedBy             | `string \| undefined`                                           | —                                               | no       | —             | Field's.                                                                                                                                                                                                                      |

Fixed rather than props: the list is in Listbox's virtual focus mode with
`shouldFocusOnHover` on and vertical orientation; the popover is non-modal
and dismissable and doesn't take focus on open (Resolved questions 10).

`Item` is Listbox's. Development warns when the input has no name, and when
the button has no `aria-label` of its own besides `buttonLabel`.

## Events

| Event         | Detail              | When                                                                                                                                                                                        |
| ------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valueChange` | `readonly string[]` | The value settled to something new: an option chosen, or the text settling on Enter or blur (Selection). Never per keystroke, and never for a value the consumer sets.                      |
| `inputChange` | `string`            | The text changed: typing, pasting, an IME commit, a chosen option's text written in, or the text reverting as it settles. Not when nothing changed (UI Kit reports every blur).             |
| `openChange`  | `boolean`           | The list opened or closed by the user. Once per change; never for an `isOpen` the consumer sets, and not on mount (UI Kit reports `false` on mount and flaps on every unmatched keystroke). |
| `focusChange` | `boolean`           | Focus entered or left the combo box: the input, the button and the popup count as one (UI Kit's composite focus).                                                                           |

Listbox's `action` closes the list and isn't reported.

## Public state

| Field          | Type                | Meaning                                                      |
| -------------- | ------------------- | ------------------------------------------------------------ |
| value          | `readonly string[]` | The selected key, or the custom text.                        |
| inputValue     | `string`            | The input's text.                                            |
| isOpen         | `boolean`           |                                                              |
| focusedKey     | `string \| null`    | The highlighted option (`aria-activedescendant`), or `null`. |
| isEmpty        | `boolean`           | No option matches the text (or there are no items).          |
| isDisabled     | `boolean`           |                                                              |
| isReadOnly     | `boolean`           |                                                              |
| isRequired     | `boolean`           |                                                              |
| isInvalid      | `boolean`           |                                                              |
| isErrorShown   | `boolean`           | Field's.                                                     |
| isFocusWithin  | `boolean`           | Focus is in the combo box.                                   |
| isFocusVisible | `boolean`           | That focus came from the keyboard.                           |

## Filtering

- **What matches.** Each option's `getTextValue` against the input's text,
  trimmed. An empty or blank text matches every option. Group headings
  aren't searched; a group with no matching option is hidden with its
  heading. Disabled options are filtered like the others.
- **When the filter applies.** Only once the user has typed since the text
  last settled (UI Kit's rule). The text a chosen option wrote, or the
  reverted text, filters nothing, so opening the list after choosing shows
  every option. After typing, opening again shows the matches, or every
  option when none match (UI Kit, Resolved questions 8).
- **What it hides.** Options and groups the filter leaves out get `hidden`;
  the arrows skip them, `aria-activedescendant` never points at them, and the
  list's option count leaves them out. React consumers may also render only
  the matching items; the consumer's own filtering (`filter: false`) shows
  `items` as they are.
- **No matches.** `isEmpty` and `data-empty`. With an empty part rendered,
  the list stays open and the empty part describes it ("No fruit"); without
  one, the list closes until something matches (Resolved questions 9).

## Selection

Combobox has one selected key at most. The text and the value settle
together, so a committed text is the selected option's text, the custom
text, or empty.

- **Choosing an option** (a press, or Enter on the highlighted option)
  selects it, writes its text into the input, closes the list, and leaves
  focus in the input. Choosing the selected option again closes the list with
  no `valueChange` (Listbox's `action`; UI Kit clears it, Mapping).
- **Typing** changes the text only. The value stays until the text settles,
  in both modes (Resolved questions 3 and 4).
- **The text settles** on Enter with nothing highlighted, and when focus
  leaves the combo box (Resolved questions 3):
  1. Text matching an enabled option's text exactly (ignoring case and
     accents, in the field's language) selects that option.
  2. Otherwise, with the filter applying and exactly one enabled option
     matching, that option is selected (UI Kit: "vio" selects Violet).
  3. Otherwise, blank text clears the value.
  4. Otherwise, with `allowsCustomValue`, the trimmed text becomes the value.
  5. Otherwise the text reverts to the selected option's text, or to empty.
     A selected option's text replaces what was typed in rules 1 and 2.
- **Keys with no item** (a value the consumer sets, or a custom value) stay
  in `value`; the input shows the text the consumer gives it, or the key's
  text for a custom value.

## Keyboard

On the input. Keys with Ctrl or Meta, and every key during IME composition,
are left to the browser.

| Key                                 | Closed                                                                                                                                                      | Open                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| ArrowDown                           | Open, highlighting the selected option, else the first.                                                                                                     | Highlight the next option; from none, the first. Wraps with `shouldFocusWrap`.            |
| ArrowUp                             | Open, highlighting the selected option, else the last.                                                                                                      | Highlight the previous option; from none, the last.                                       |
| Alt+ArrowDown                       | Open with nothing highlighted (APG).                                                                                                                        | Nothing.                                                                                  |
| Alt+ArrowUp                         | Nothing.                                                                                                                                                    | Close, keeping the text (APG).                                                            |
| PageDown, PageUp                    | Left to the browser.                                                                                                                                        | With an option highlighted, move it by the list's visible height (Listbox's).             |
| Home, End                           | Left to the browser: the caret moves.                                                                                                                       | The same, and the highlight clears (APG; Resolved questions 5).                           |
| ArrowLeft, Right                    | Left to the browser.                                                                                                                                        | The caret moves and the highlight clears (React Aria's NVDA fix).                         |
| Enter                               | Settle the text (Selection). Not prevented, so a form submits.                                                                                              | With an option highlighted: choose it, prevented. Otherwise as closed, and close.         |
| Escape                              | If the text differs from the settled text, revert it; prevented. Otherwise not handled, so it reaches a dialog around the combo box (Resolved questions 6). | Close, keeping the text; prevented.                                                       |
| Tab, Shift+Tab                      | Left to the browser; the text settles as focus leaves.                                                                                                      | The same: the list closes without choosing the highlighted option (Resolved questions 7). |
| Printable, Backspace, Delete, paste | Edit the text; with `popoverTrigger: 'input'` and non-blank text, open the list.                                                                            | Edit the text; the filter follows it and the highlight clears (Resolved questions 2).     |

## ARIA and state attributes per state

| State        | Part        | Attributes                                                                                                                                                                                  |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| always       | input       | `role="combobox"`, `aria-autocomplete="list"`, `aria-controls` = the list's id, Field's `id` and labelling (`<label for>`), `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"` |
|              | button      | `type="button"`, `tabindex="-1"`, `aria-label` = `buttonLabel`, `aria-labelledby` = itself and the label, `aria-haspopup="listbox"`, `aria-controls` = the list's id                        |
|              | popover     | `id`, `popover="manual"`; no `role`, no `tabindex`, no name                                                                                                                                 |
|              | list        | Listbox's: `role="listbox"`, `id`, `aria-labelledby` = the label, `aria-orientation="vertical"`; no `tabindex`                                                                              |
|              | option      | Listbox's: `role="option"`, `id` from `listId`, `aria-selected`; no `tabindex`                                                                                                              |
|              | hiddenInput | `type="hidden"`; its value the selected key or custom text, else empty                                                                                                                      |
| closed       | input       | `aria-expanded="false"`; no `aria-activedescendant`                                                                                                                                         |
|              | button      | `aria-expanded="false"`                                                                                                                                                                     |
| open         | input       | `aria-expanded="true"`; every named part + `data-open`                                                                                                                                      |
|              | button      | `aria-expanded="true"`                                                                                                                                                                      |
| highlighted  | input       | `aria-activedescendant` = the option's id                                                                                                                                                   |
|              | option      | `data-focused`; `data-focus-visible` when the highlight came from the keyboard                                                                                                              |
| filtered out | option      | `hidden`; a group with no option left, `hidden`                                                                                                                                             |
| no matches   | list, empty | Listbox's: the empty part shown and describing the list; every named part + `data-empty`                                                                                                    |
| disabled     | input       | + `disabled`; the button + `disabled`; every part + `data-disabled`; the error hidden (Field)                                                                                               |
|              | hiddenInput | + `disabled`                                                                                                                                                                                |
| read-only    | input       | + `readonly`; every part + `data-readonly`; the list Listbox's `aria-readonly="true"`                                                                                                       |
| required     | input       | + `aria-required="true"`, `required`; every named part + `data-required`                                                                                                                    |
| invalid      | input       | + `aria-invalid="true"`, `aria-describedby` gains the error's id; every named part + `data-invalid`                                                                                         |

`aria-controls` stays while closed, as Select and the APG's examples write
it. React Aria and UI Kit write it only while open.

## Focus

- **DOM focus stays in the input** throughout (Resolved questions 1). The
  highlighted option is virtual: `aria-activedescendant` on the input,
  `data-focused` on the option. Options and the list never take focus; a
  press on an option keeps focus in the input.
- **The highlight** moves with the arrows and the page keys, and with a
  hovering mouse (Resolved questions 12). It clears when the text changes, on
  ArrowLeft, ArrowRight, Home and End, and on close. Moved by the keyboard,
  the option is scrolled into view (`block: 'nearest'`), as browsers don't do
  it for `aria-activedescendant`; not under a screen reader's virtual cursor,
  as Listbox.
- **On open**, the popover leaves focus in the input. Opening by ArrowDown
  or ArrowUp highlights the selected option, else the first or last; by
  typing, Alt+ArrowDown, a mouse or touch press on the button, or focus,
  nothing is highlighted except the selected option when opened by the button
  (Resolved questions 2 and 11).
- **The button** never takes focus: a press focuses the input (React Aria,
  the APG; UI Kit's is a tab stop).
- **Focus leaving** the combo box (the input, the button and the popup)
  closes the list and settles the text (Selection), before the press that
  moved it acts (UI Kit's composite blur). Focus returning nowhere (the page
  hidden, the window losing focus) settles nothing.
- **A form submitted without a required value**: the input is the invalid
  element, so the browser focuses it and shows its message (Resolved questions
  13).

## Pointer and touch

- **A press on the input** places the caret. With `popoverTrigger: 'focus'`,
  focusing it opens the list. A press on the input while the list is open
  keeps it open (UI Kit closes it, Mapping).
- **The button.** A mouse or pen opens the list on press start and closes it
  on a press while open; touch opens on release, as Select. The input takes
  focus, which raises the on-screen keyboard on touch.
- **Options** select on a press released over the option it started on
  (Listbox's press). Hover marks options (`data-hovered`) and highlights them.
  A disabled option does nothing.
- **A press outside** closes the list and acts on what it hit (Popover's
  rule; UI Kit swallows it, Mapping). The text settles first, since focus
  leaves.
- **A screen reader's click** on the button opens the list with the first
  option, or the selected one, highlighted. On an option, it chooses it.

## Live announcements

Through the live announcer, politely (Resolved questions 14):

- **The option count** when the list opens, and when typing changes it while
  open: "3 options available", from `optionCountAnnouncement(count)` (English
  by default, replaced whole by a translation).

## Styling tokens

| Token                                                                                                  | On             | Meaning                                                             |
| ------------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------- |
| `data-open`, `data-entering`, `data-exiting`                                                           | named parts    | Popover's phases.                                                   |
| `data-empty`                                                                                           | named parts    | No option matches the text.                                         |
| `data-disabled`, `data-readonly`, `data-required`, `data-invalid`                                      | named parts    | Field's.                                                            |
| `data-focus-within`, `data-focus-visible`                                                              | named parts    | Focus in the combo box, and from the keyboard.                      |
| `data-pressed`, `data-hovered`                                                                         | button         | Button's.                                                           |
| `data-selected`, `data-focused`, `data-focus-visible`, `data-hovered`, `data-pressed`, `data-disabled` | option         | Listbox's; `data-focused` is the highlight.                         |
| `data-placement`                                                                                       | popover, arrow | Popover's: the side it opened on.                                   |
| `--anchor-width`, `--available-width`, `--available-height`                                            | popover        | Popover's: for `min-width: var(--anchor-width)` and a `max-height`. |
| `hidden`                                                                                               | option, group  | Filtered out.                                                       |

No CSS variables of Combobox's own.

## Expected spoken output

Probed with `@guidepup/virtual-screen-reader` in Chromium on an input
"Fruit" with the attributes above:

| State                           | Spoken phrase                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| closed, text "Ap"               | `combobox, Fruit, Ap, has popup listbox, not expanded, autocomplete in list, 1 control`                                                                |
| closed, empty                   | `combobox, Fruit, has popup listbox, not expanded, autocomplete in list, 1 control` (a placeholder isn't read)                                         |
| described, invalid and required | `combobox, Fruit, Pick some Pick one, has popup listbox, not expanded, autocomplete in list, 1 control, invalid, required`                             |
| read-only                       | `…, autocomplete in list, 1 control, read only`                                                                                                        |
| disabled                        | `…, autocomplete in list, 1 control, disabled`                                                                                                         |
| open, text "a"                  | `combobox, Fruit, a, has popup listbox, expanded, autocomplete in list, 1 control`, then `listbox, Fruit, orientated vertically` and Listbox's options |
| open, Banana highlighted        | `combobox, Fruit, a, has popup listbox, expanded, active descendant Banana, autocomplete in list, 1 control`                                           |
| the button                      | `button, Show suggestions Fruit, 1 control, not expanded, has popup listbox`                                                                           |
| filtered-out options            | not read                                                                                                                                               |
| the hidden input                | nothing                                                                                                                                                |

The virtual screen reader doesn't speak `aria-activedescendant` changes
while the input has focus: it reads the active descendant only in the
combobox's phrase. Whether each screen reader reads the highlighted option
as it moves (VoiceOver's support is contested: Zag announces it on Apple
devices, React Aria says VoiceOver reads it natively) is checked with real
ones at gate 5.

## Adapter surface

```tsx
// React
const fruit = useComponent(combobox, {
  items, // [{ key: 'apple', textValue: 'Apple' }, …]
  defaultValue: ['banana'],
  onValueChange,
});
return (
  <div {...fruit.parts.root}>
    <label {...fruit.parts.label}>Fruit</label>
    <div {...fruit.parts.anchor}>
      <input {...fruit.parts.input} />
      <button {...fruit.parts.button}>
        <ChevronIcon aria-hidden />
      </button>
    </div>
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
    <input {...fruit.parts.hiddenInput} name="fruit" />
  </div>
);
```

```html
<!-- Custom elements: items read from the options -->
<uni-combobox required>
  <label data-part="label">Fruit</label>
  <div data-part="anchor">
    <input data-part="input" />
    <button data-part="button"><svg aria-hidden="true">…</svg></button>
  </div>
  <div data-part="popover">
    <div data-part="list">
      <div data-part="option" data-key="apple">Apple</div>
      <div data-part="option" data-key="banana">Banana</div>
    </div>
    <p data-part="empty">No fruit</p>
  </div>
  <input data-part="hiddenInput" name="fruit" />
</uni-combobox>
```

`@uniaria/core/combobox` exports `combobox`, and the element registers from
the same subpath of `@uniaria/elements`. Attributes: `disabled-keys`,
`popover-trigger`, `allows-custom-value`, `disabled`, `readonly`,
`required`, `invalid`, `focus-wrap`, `position-area`,
`position-try-fallbacks`, `locale`, `button-label`, `labelled-by`,
`described-by`; properties `items`, `filter`, `value`, `defaultValue`,
`inputValue`, `defaultInputValue`, `isOpen`, `defaultOpen` and
`optionCountAnnouncement`; events `valuechange`, `inputchange`,
`openchange` and `focuschange`.

## Mapping from Cube UI Kit

| UI Kit ComboBox                                                         | UniAria                                                                                       |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `selectedKey` / `defaultSelectedKey` / `onSelectionChange(key \| null)` | `value` / `defaultValue` / `valueChange` with `[]` or `[key]` (Select's type)                 |
| `inputValue` / `defaultInputValue` / `onInputChange`                    | the same names; `inputChange` fires only when the text changed                                |
| `popoverTrigger`, `filter` (function or `false`), `allowsCustomValue`   | the same; `filter: false` for no filtering                                                    |
| `shouldCommitOnBlur`, `clearOnBlur`, `isClearable`, `sortSelectedToTop` | not included (Resolved questions 16)                                                          |
| `onOpenChange` (internal open state)                                    | `isOpen` / `defaultOpen` / `openChange`, as Select                                            |
| `onFocus` / `onBlur` over the field and popover                         | `focusChange`                                                                                 |
| `onKeyDown` first, `preventDefault()` skipping the built-in handling    | the consumer's handler on the input; a prevented keydown is left alone, as every UniAria part |
| `isLoading`, `icon`, `prefix`, `suffix`, sizes, styles                  | the consumer's markup and CSS                                                                 |
| Virtualized flat lists                                                  | `virtualizer`, forwarded to the list (Listbox virtualization spec)                            |
| Placement `bottom start`, width ≥ the field, ≤ 50vw                     | `positionArea`, `--anchor-width` for the consumer's CSS                                       |

Rough edges in UI Kit's ComboBox (its source, tests and changelog), which
UniAria doesn't copy; to file on cube-js/cube-ui-kit once reviewed:

1. `aria-label` and `aria-labelledby` never reach the input; an unlabelled
   ComboBox has no name.
2. No `aria-invalid`, `aria-describedby` or `aria-autocomplete` on the input,
   though the docs list the first two.
3. Re-picking the selected option clears it (click, or ArrowDown then
   Enter), because the single-mode toggle isn't suppressed.
4. `isReadOnly` only sets `readonly`: the list still opens and selects, and
   Escape still clears when clearable.
5. Blur can select a disabled option: the match ignores `disabledKeys`.
6. Blurring an empty, never-selected field reports `onSelectionChange(null)`
   and `onInputChange('')`; every blur reports `onInputChange(label)`.
7. `aria-activedescendant` goes stale when typing filters out the
   highlighted option.
8. Escape and Tab never propagate past the input, so a closed ComboBox in a
   Dialog swallows the Dialog's Escape.
9. A custom value that is part of an option's text can't be committed from
   the keyboard; with `shouldCommitOnBlur={false}` not at all, and blur wipes
   it.
10. `onOpenChange` fires `false` on mount and flaps with the trigger's
    `aria-expanded` on every keystroke that matches nothing.
11. A label isn't refreshed when items load after the selected key.
12. A press in the input while the list is open closes the list; native
    controls outside need two clicks while it is open.
13. No `name` and no hidden input: a native form submits nothing.
14. No IME guard on Enter.

## Differences from UI Kit, React Aria, the APG and Zag

| #   | Topic                      | UI Kit                                             | React Aria                                      | APG (list autocomplete)             | Zag                                 | UniAria                                                   |
| --- | -------------------------- | -------------------------------------------------- | ----------------------------------------------- | ----------------------------------- | ----------------------------------- | --------------------------------------------------------- |
| 1   | Highlight while typing     | first match (or selected), always                  | none                                            | none (`list`); first in "automatic" | none by default (`inputBehavior`)   | none (Q2)                                                 |
| 2   | Enter, nothing highlighted | no-op, or clears / commits custom when no match    | commit: revert or custom text                   | prevented, nothing                  | submit if text acceptable           | settle the text, form submits (Q3)                        |
| 3   | Blur                       | exact match, or the only match, else revert/clear  | revert, or commit custom text                   | doesn't close                       | revert invalid text                 | UI Kit's settle (Q3)                                      |
| 4   | Custom value               | the text becomes the selected key                  | value null, the text is `inputValue`            | —                                   | text only                           | UI Kit's (Q4)                                             |
| 5   | ArrowUp from closed        | first or selected                                  | last or selected                                | last (optional)                     | last                                | last or selected (Q5)                                     |
| 6   | Alt+ArrowDown / Up         | as plain arrows                                    | nothing                                         | open / close                        | open / close                        | APG (Q5)                                                  |
| 7   | Home, End while open       | first / last option                                | first / last option                             | caret                               | first / last option                 | caret (Q5)                                                |
| 8   | Escape                     | open: close, keep text; closed: clear if clearable | revert in both                                  | close; closed: clear                | close; revert invalid               | open: close; closed: revert, else propagate (Q6)          |
| 9   | Tab while open             | native, no select                                  | selects the highlight (not Shift+Tab)           | selects the highlight (JS)          | no select                           | no select (Q7)                                            |
| 10  | Reopen after typing        | the matches, or all if none                        | all                                             | the matches                         | the consumer's                      | UI Kit's (Q8)                                             |
| 11  | No matches                 | closes                                             | closes (unless `allowsEmptyCollection`)         | closes                              | the consumer's                      | the empty part if rendered, else closes (Q9)              |
| 12  | Popup                      | non-modal; outside presses swallowed               | non-modal; page `aria-hidden` but the field     | non-modal                           | non-modal; aria-hidden removed      | non-modal, page exposed, a press outside acts (Q10)       |
| 13  | Button                     | tabbable, takes focus, "Show options"              | `tabindex=-1`, "Show suggestions" + label       | `tabindex=-1`, named                | `tabindex=-1`, "Toggle suggestions" | React Aria's (Q11)                                        |
| 14  | Hover                      | a separate style                                   | moves the highlight                             | —                                   | moves the highlight                 | moves the highlight (Q12)                                 |
| 15  | Forms                      | none native (UI Kit's Form only)                   | hidden input per key, or `name` on the input    | the text                            | the text                            | `hiddenInput` with the key; `required` on the input (Q13) |
| 16  | Announcements              | none                                               | count (all), group and selection (Apple)        | none                                | highlight (Apple, assertive)        | the count, polite (Q14)                                   |
| 17  | State logic                | React state and effects                            | an every-render effect (fragile, per its TODOs) | —                                   | a statechart                        | cells and watches (Q15)                                   |
| 18  | Read-only                  | cosmetic                                           | doesn't open                                    | —                                   | opens, doesn't select               | opens, doesn't select (Q17)                               |
| 19  | Re-pick the selected       | clears it                                          | keeps it                                        | —                                   | keeps it                            | keeps it, closes                                          |

## Deviations from the WAI-ARIA pattern

- **Tab doesn't select the highlighted option** (Resolved questions 7). The APG
  example's script commits it; UniAria closes, and the text settles, so
  arrowing through and leaving doesn't change the value, as Select.
- **Enter with nothing highlighted settles the text and submits the form**
  (Resolved questions 3). The APG example prevents Enter always.
- **Escape on a closed combo box reverts rather than clears** (Resolved
  questions 6). The APG makes clearing optional.

## Resolved questions

Decided by @tenphi on 2026-10-18, each as recommended.

1. **Focus model.** (a) DOM focus stays in the input and the highlighted
   option is `aria-activedescendant` (UI Kit, React Aria, the APG, Zag,
   every reference). Listbox gains a virtual focus mode for it: a
   `shouldUseVirtualFocus` prop (React Aria's name), in which the list and
   its options take no `tabindex`, `data-focused` follows the highlight
   rather than DOM focus, hover highlights, a press keeps focus where it is,
   and the composing component moves the highlight from its input's keys.
   A change to the approved Listbox. (b) Real focus into the list, as
   Select: impossible while typing. Decided: (a).
2. **The highlight while typing.** (a) None: typing clears it, and Enter
   settles the text (question 3); ArrowDown highlights. React Aria, the
   APG's list example and Zag's default; React Aria found NVDA stops reading
   typed characters and caret moves while `aria-activedescendant` is set.
   (b) UI Kit: the first match (or the selected option) is highlighted as you
   type, so Enter picks it (UI Kit #886). It makes typing a custom value
   that is part of an option impossible to commit by Enter (Mapping 9).
   Decided: (a); question 3's rule 2 keeps "type a unique part, press
   Enter" working.
3. **Settling the text** (Enter with nothing highlighted, and blur). (a) UI
   Kit's rule (Selection): an exact text match selects, else the only
   remaining match selects, else blank clears, else custom text commits or
   the text reverts; with UI Kit's bugs fixed (disabled options never match,
   matching uses the filter's collator). (b) The exact match only, then the
   rest. (c) React Aria: revert, or commit custom text; text never selects.
   Enter is never prevented here, so a form submits after the text settles.
   Decided: (a).
4. **Custom values** (`allowsCustomValue`). (a) UI Kit: the settled text
   becomes the value (`value: ['Mango']`), which the hidden input submits;
   text matching an option's text selects the option instead (UI Kit's
   TagInput rule). (b) React Aria: the value stays `[]` and the text is the
   value, read from `inputValue`; the form submits the text (`formValue:
'text'`). Decided: (a): one value to read, and a form gets it.
5. **Keys besides the APG's core.** (a) ArrowUp opens on the last option
   (React Aria, the APG, Select); Alt+ArrowDown opens without a highlight and
   Alt+ArrowUp closes (APG); Home and End move the caret and clear the
   highlight (APG: "never intercept the platform's text-editing keys");
   ArrowLeft and ArrowRight clear the highlight (React Aria); PageUp and
   PageDown move a present highlight by a page. (b) UI Kit: ArrowUp opens on
   the first, Alt is ignored, Home and End move the highlight. (c) React Aria:
   Home and End move the highlight while open. Decided: (a).
6. **Escape.** (a) Open: close and keep the text (UI Kit). Closed: revert
   typed text to the settled text, else leave Escape alone so it reaches a
   dialog around the combo box (fixing Mapping 8). (b) UI Kit: closed, clear
   only with `isClearable`. (c) React Aria: revert in both. (d) The APG:
   closed, clear. Decided: (a).
7. **Tab while open.** (a) Close without choosing the highlight; the text
   settles as focus leaves (UI Kit, Zag, Select's resolved question 5).
   (b) Choose the highlight (React Aria, the APG's script). Decided: (a).
8. **Opening.** (a) `popoverTrigger`, as UI Kit (React Aria's
   `menuTrigger`): `'input'` opens on typing non-blank text, `'focus'` on
   focus too, `'manual'` only from the button and the arrows. Opening shows
   every option until the user types, and the matches after, or every option
   when none match (UI Kit). (b) React Aria: opening from the button or the
   arrows always shows every option. Decided: (a).
9. **No matches.** (a) With an empty part rendered, the list stays open and
   the empty part describes it ("No fruit"), as Listbox; without one, it
   closes until something matches, and `openChange` doesn't flap. (b) UI Kit:
   always close. (c) React Aria: close, unless `allowsEmptyCollection`.
   Decided: (a).
10. **The popup.** (a) Popover non-modal: the page stays exposed, a press
    outside closes and acts, the list closes when the field scrolls out of
    view; the popover has no role, tabindex or name. Popover gains a prop,
    `shouldFocusOnOpen` (default `true`), which Combobox sets `false` so focus
    stays in the input; a change to the approved Popover. The popover sits
    right after the input in the page, so swiping from the input reaches the
    options next. (b) React Aria: also hide everything but the field and the
    popup from assistive technology while open (its popover is portaled to
    the end of the page; Zag removed the same). (c) UI Kit: outside presses
    close without acting. Decided: (a).
11. **The button.** (a) React Aria's and the APG's: not a tab stop, never
    takes focus (the input does), named by `buttonLabel` ("Show
    suggestions") and the label as NumberField's buttons; a mouse opens it
    on press start, touch on release, as Select; it shows every option, or
    the matches after typing, highlighting the selected one. (b) UI Kit's: a
    tab stop that takes focus, named "Show options". Decided: (a).
12. **Hover.** (a) Hover highlights the option (React Aria, Zag, Select), so
    there is one highlight. (b) UI Kit: hover is a separate style, and two
    options can look highlighted. Decided: (a).
13. **Forms.** (a) A `hiddenInput` part, as NumberField: `type="hidden"`, the
    selected key or the custom text; native `required` on the visible input,
    since the settled text is empty exactly when the value is, so the browser
    blocks an empty submit and focuses the input; a form reset restores the
    default value and text. (b) No native validation: `aria-required` only,
    as Field. (c) React Aria's `formValue: 'key' | 'text'`. Decided: (a).
14. **Announcements.** (a) The option count when the list opens and when
    typing changes it, politely, on every platform, from a translatable
    `optionCountAnnouncement` (React Aria announces it assertively; GitHub's
    auto-complete politely). (b) Also React Aria's Apple-only messages (the
    group entered, "Apple, selected") or Zag's (the highlighted option),
    which their authors disagree on. (c) None until real screen readers are
    tested at gate 5. Decided: (a); (b) waits for gate 5.
15. **The statechart runtime.** The design doc (decision 3) names Combobox
    the first user of `ctx.machine()`. Combobox has no timers: its state is
    the open flag, the text, the value, the highlight and whether the filter
    applies, each a bindable or a cell, as Select and Tooltip (which has
    timers) are built. (a) No machine: cells and watches; `ctx.machine()`
    waits for a component that needs it (Menu's submenus, Toast). (b) Build
    `ctx.machine()` now, as decided then. Decided: (a), and the design
    doc updated.
16. **Scope.** (a) Single selection; no clear part, `shouldCommitOnBlur`,
    `clearOnBlur`, `isClearable` or `sortSelectedToTop` (UI Kit's): the
    consumer's button clears, and the consumer orders the items. Multiple
    selection is a later TagField. (b) Include UI Kit's props.
    Decided: (a).
17. **Read-only.** (a) As Select: the input is `readonly`, the list opens from
    the button and the arrows and the highlight moves, but nothing selects.
    (b) React Aria: a read-only combo box doesn't open. Decided: (a).
