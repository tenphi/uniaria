# Composition spec

Status: draft

## Summary

UniAria's text controls come only as whole fields. TextField is Field and an
input; Combobox is Field, Listbox, Popover and an input it builds itself.
Nothing smaller can be reused, so a design system that needs an input inside
its own control, or a text box that drives a list, has to copy the code.
UniAria copies it already: Combobox repeats TextField's buffered value, IME
guard and form reset (`combobox.ts`: "TextField's buffer"), and NumberField
repeats the IME guard.

Cube UI Kit shows where copying leads. Five of its controls put a text box
in front of a list (ComboBox, SearchComboBox, FilterListBox, TagInput,
CommandTextArea), and CommandMenu puts one in front of a menu. Each wires
`role="combobox"` and `aria-activedescendant` itself. Each also keeps the
list's highlight in React state, so that the input renders again on every
arrow key (`ComboBox.tsx:1056`, `FilterListBox.tsx:696`,
`SearchComboBox.tsx:492`, `CommandTextArea.tsx:429`,
`TagInput/useActiveOption.ts:54`). That render is the one UniAria exists to
avoid. UI Kit's shared `TextInputBase` is only the look: four fields add the
buffered value one by one, and NumberInput and CommandTextArea keep their
own text.

This spec gives UniAria two levels of behavior, both public, and builds the
fields on the lower one:

1. **Controls**: a behavior for one control and nothing around it. Two are
   new:
   - **TextInput**: a native `<input>` or `<textarea>` with the value
     handling TextField has today (the buffered controlled value, IME, form
     reset), plus hover and focus.
   - **Autocomplete**: a text input that filters a list and moves a
     highlight through it while focus stays in the input. It is the half of
     Combobox that isn't about a value or a popup.

   Button, Listbox and Popover are controls already.

2. **Fields and composites**: a control with Field around it, or several
   controls together.
   - TextField becomes Field and TextInput.
   - NumberField becomes Field, TextInput and two Buttons.
   - Combobox becomes Autocomplete and Popover, plus how the text settles
     into a value.

   None of them changes in API or behavior; their approved conformance
   suites are the check.

3. **A composition contract** for definitions outside UniAria that compose
   its controls: what such a definition may rely on, and four runtime
   changes that keep it working when a control changes
   ([Runtime changes](#runtime-changes)).

A custom combobox-like control is a definition that composes Autocomplete
(or TextInput and Listbox). It is not a React or Vue component that combines
two behaviors. As a definition it never renders again for a highlight,
works in every adapter and on the server, and is tested in Node like the
built-in ones ([Composing in a definition](#composing-in-a-definition)).

- **WAI-ARIA patterns:** none for TextInput, which is a native control. For
  Autocomplete, the
  [combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/) with list
  autocomplete, as Combobox.
- **Builds on:** Field, Listbox in its virtual focus mode, Popover and
  Button (`ctx.use`); `createHover`, `createFocus` and `createFocusWithin`
  from `dom/`; the live announcer. New: TextInput, Autocomplete, and four
  changes to `ctx.use()` ([Runtime changes](#runtime-changes)). The
  custom-element contract, the adapters and part props don't change.
- **Owner:** none. Links: Autocomplete takes `optionTooltip`, as Listbox and
  Combobox do.
- **Custom element:** `<uni-autocomplete>`, which hosts consumer markup.
  TextInput has none ([Open questions](#open-questions) 2): a TextField that
  renders only its input part is the stand-alone input.

Not part of this spec:

- **The controls UI Kit builds on Autocomplete.** Each gets a spec of its
  own once a consumer asks for it: TagField (Combobox spec, Resolved
  questions 16); a search box that acts and then clears (UI Kit's
  SearchComboBox); a searchable picker (FilterPicker). All three are
  Autocomplete composed with Popover.
- **Token completion in a `<textarea>`** (UI Kit's CommandTextArea). It
  needs a textbox role, since HTML allows no other role on a `<textarea>`,
  and a query that is the word at the caret rather than the whole text.
- **A command palette** (CommandMenu): it waits for Menu.
- **An Autocomplete for any collection.** React Aria's drives menus and
  grids through DOM events. UniAria's composes Listbox; Menu decides how it
  joins.
- **Splitting Listbox.** It stays one behavior with optional labelling
  parts, which Select and Combobox already leave out
  ([One Field per control](#one-field-per-control)).
- **A NumberInput** (NumberField without Field). It waits for a consumer,
  such as a slider's number box or a color channel.
- **Combining behaviors in React or Vue components**, that is, two
  behaviors' part props spread on one element
  ([Composing in a definition](#composing-in-a-definition)).
- **Inline completion** (`aria-autocomplete="both"`), as in the Combobox
  spec.

## How it works

### Two levels

| Level                 | Behaviors                                                      | What it owns                                                    | Labelled by                                                               |
| --------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Controls              | Button, TextInput, Listbox, Autocomplete, Popover              | One element or widget: its keys, state, ARIA and part props     | The behavior around it, or its own optional parts (Listbox, Autocomplete) |
| Fields and composites | ToggleButton, TextField, NumberField, Select, Combobox, Dialog | A form value, Field around a control, several controls together | One Field                                                                 |

Below both levels are the interactions in `dom/`: `createPress`,
`createHover`, `createFocus` and the rest, each the state and handlers for
one concern on one part. Definitions at either level use them.

**Names.**

- `<Name>Input` is a text control without labelling, and `<Name>Field` is
  Field around it. The TextField spec already uses that rule ("Field plus a
  text control is `<Name>Field`").
- `Autocomplete` is the name the APG (`aria-autocomplete="list"`) and React
  Aria give a text box that filters a list.

### Composing in a definition

Controls are composed with `ctx.use()` inside a definition. A consumer who
needs only an input for their own combobox-like control writes a definition
that composes TextInput or Autocomplete. They render it with `useBehavior`,
or register it with `defineElement`, like any other. Here TextInput takes
the value handling, and the definition adds a veto:

```ts
import { bindable, defineBehavior } from '@uniaria/core';
import { partEffect } from '@uniaria/core/dom';
import { textInput } from '@uniaria/core/text-input';

/** A hex color: TextInput, refusing anything but hex digits. */
export const hexInput = defineBehavior({
  name: 'hex-input',
  parts: ['root', 'input', 'swatch'],
  props: { value: bindable('') },
  setup(ctx) {
    const { value } = ctx.props;
    const text = ctx.use(
      textInput,
      () => ({
        value: value.get(),
        onValueChange: (next: string) => value.set(next),
      }),
      { parts: { root: 'input' } },
    );
    partEffect(ctx, 'input', (input) => {
      const veto = (event: InputEvent) => {
        if (event.data && !/^[\da-f]+$/i.test(event.data)) {
          event.preventDefault();
        }
      };
      input.addEventListener('beforeinput', veto);
      return () => input.removeEventListener('beforeinput', veto);
    });
    return { text };
  },
  expose: ({ api }) => api.text.state(),
  connect: ({ props, api }) => ({
    root: { attrs: {} },
    input: api.text.connect().root,
    swatch: { attrs: {}, style: { '--hex-color': `#${props.value.get()}` } },
  }),
});
```

Typing, IME, a controlled value that a form store echoes late, hover and
focus come from TextInput. Inside a form, `hexInput` would also reset
`value` itself, as TextField does
([Who resets a form value](#who-resets-a-form-value)).

Combining `useBehavior(textInput)` and `useBehavior(listbox)` in a
component instead doesn't work:

- **The props collide.** Two behaviors' part props on one element clash: a
  later spread replaces the earlier one's handlers (`onKeyDown`) and
  attributes. Every adapter would have to merge them by hand.
- **Every arrow key renders again.** The glue (which option is highlighted,
  whether the list shows) would live in React or Vue state, which is UI
  Kit's mirroring again.
- **A definition does more.** It works in React, in Vue and as an element,
  renders on the server, and runs in Node tests.

Simpler needs don't call for a definition at all. TextField's `wrapper`
holds prefix and suffix content. Autocomplete's own props and events
(`action`, `inputChange`) are enough for an inline search box that runs a
command and clears.

### What a composing definition may use

Today only UniAria's composites compose. They use each other's `api`, which
is internal (owner, 2026-10-19). That is safe because they ship in one
version (the `fixed` group). A definition outside UniAria may rely on these
parts of a control it composes:

- the props it passes, and the events it gets back through the `on<Event>`
  callbacks among them;
- `state()`, the public state its spec documents;
- `connect()` and `connectItem()`, the part props its spec's Anatomy and
  ARIA tables document;
- `actions` ([Runtime changes](#runtime-changes) 2);
- its part names, for `parts` mappings, and its link keys, for `links`
  ([Runtime changes](#runtime-changes) 3).

`api` stays internal: outside code that reads it gets no compatibility
promise ([Open questions](#open-questions) 5). Every control in this spec
is designed so that the list above is enough to build a combobox-like
control on it.

### One Field per control

A control's label, description and error come from one Field whose
`control` part is that control, so its ARIA is written once. The behavior
that owns the control composes Field, and a composite maps that Field's
parts instead of adding a second one:

- **TextInput has no labelling.** It is only ever composed, and the
  behavior around it labels it: TextField, NumberField, Autocomplete, or
  the consumer's own.
- **Listbox and Autocomplete carry labelling.** They are components in
  their own right, so they keep Field's label, description and error as
  optional parts.
  - Select leaves Listbox's out, because its own Field labels the trigger.
  - Combobox maps Autocomplete's onto its own label, description and
    error, and no longer composes Field itself.

### Who resets a form value

On a form reset, a value goes back to the default the consumer seeded it
with (`default<Name>`), and the behavior that holds that bindable does the
reset (owner, 2026-10-19). A composed control gets its value from the
composer, so the composer resets it and the control must not. Otherwise
TextInput inside TextField would report the value it mounted with right
after TextField reported its default. Runtime change 4 makes a composed
definition's controlled bindable ignore `reset()`. Composed or not,
TextInput still drops its draft, and it writes its text again after the
native reset.

## TextInput

TextInput is TextField without Field and without the wrapper: one native
`<input>` or `<textarea>`, with hover, focus, read-only and disabled
states. It takes the value handling in the TextField spec's Value section,
which moves here unchanged.

- `name: 'text-input'`; exported as `textInput` from
  `@uniaria/core/text-input`.
- No custom element ([Open questions](#open-questions) 2). React and Vue can
  still render it with `useBehavior`, since the adapters are generic.

### Anatomy

| Part | Element               | Attributes UniAria owns                                        | Notes                                                                                                                                                                         |
| ---- | --------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root | `input` or `textarea` | `disabled`, `readonly`, the `value` property, state attributes | The control itself, as Button's root is the button. A composer maps it to its own part (`{ parts: { root: 'input' } }`). The consumer owns the rest, as in TextField's input. |

### Props

| Prop       | Type      | Default | Bindable | Change event  | Notes                                                                                                     |
| ---------- | --------- | ------- | -------- | ------------- | --------------------------------------------------------------------------------------------------------- |
| value      | `string`  | `''`    | yes      | `valueChange` | TextField's. It adopts the input's current text where a composer's element reads it, as TextField's does. |
| isDisabled | `boolean` | `false` | no       | —             | The input is natively `disabled`.                                                                         |
| isReadOnly | `boolean` | `false` | no       | —             | The input is natively `readonly`. Attribute `readonly`.                                                   |

### Events

| Event         | Detail    | When                            |
| ------------- | --------- | ------------------------------- |
| `valueChange` | `string`  | Each edit, as TextField's.      |
| `focusChange` | `boolean` | The input gained or lost focus. |

### Public state

| Field          | Type      | Meaning                                            |
| -------------- | --------- | -------------------------------------------------- |
| value          | `string`  | The current value.                                 |
| isFocused      | `boolean` | The input has focus.                               |
| isFocusVisible | `boolean` | Focus arrived by keyboard or assistive technology. |
| isHovered      | `boolean` | A mouse or pen is over the input.                  |
| isDisabled     | `boolean` | The prop.                                          |
| isReadOnly     | `boolean` | The prop.                                          |

### Value

These rules are the TextField spec's, moved:

- **The live property.** The value is written to the `value` property only
  when it differs from the element.
- **Uncontrolled.** Each edit stores the text and reports it.
- **Controlled and buffered.** While a controlled consumer hasn't answered,
  the typed text stays on screen. An echo of a reported value is left
  alone, and any other value is written at once. A value the consumer never
  takes goes back on blur.
- **IME.** The value is never written mid-composition.
- **Form reset.** The value goes back to its default, and is written again
  after the native reset.
- **Before JavaScript.** Text typed before the script loaded is adopted.

Composed, the value belongs to the composer, so the buffer holds the typed
text until the composer passes it back. TextField, NumberField,
Autocomplete and Combobox all get their buffering from here. Form reset is
the composer's ([Who resets a form value](#who-resets-a-form-value)).

### Keyboard, focus and pointer

TextInput handles no keys and moves no focus. Hover counts only over the
input. A press on the box around it is the composer's to handle, as
TextField's wrapper does.

### Styling tokens

| Token                                                                                  | On   | Meaning                                          |
| -------------------------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| `data-hovered`, `data-focused`, `data-focus-visible`, `data-readonly`, `data-disabled` | root | As TextField's. A composer spreads them further. |

Composed, TextInput's root carries its composer's markers.
`@uniaria/styles` has no TextInput style, because its composers style the
input.

## Autocomplete

Autocomplete puts a text input in front of a list. Typing filters the
options; the arrows move a highlight through them while focus stays in the
input (`aria-activedescendant`); Enter or a press chooses one. It is Field,
TextInput and Listbox (in virtual focus mode) composed. It takes over what
the Combobox spec says about filtering, the keys on the input, the
highlight, the button and the option count. Combobox adds three things on
top: a value the text settles into, the popup and the form
([Combobox](#combobox)).

It has two modes:

- **Inline**, the default. The list is always shown, under or beside the
  input, as in UI Kit's FilterListBox or a command list in a dialog. The
  input is `aria-expanded="true"` and nothing opens or closes. Escape
  clears the text; on an empty input it is left to the page, so a dialog
  around it closes.
- **Popup** (`hasPopup`). A composer shows and hides the list, as Combobox
  does with a Popover. `isOpen` says whether the list shows. Autocomplete
  asks to open and close it from the keys, typing, focus and its button, as
  Combobox does today.

`name: 'autocomplete'`; exported as `autocomplete` from
`@uniaria/core/autocomplete`; the element is `<uni-autocomplete>`.

### Anatomy

| Part        | Element                    | Attributes UniAria owns                                                                                                                                                                                                                                                                   | Notes                                                                      |
| ----------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| root        | any; usually `div`         | state attributes                                                                                                                                                                                                                                                                          | Optional. Field's root, around every other part.                           |
| label       | `label` by default         | Field's                                                                                                                                                                                                                                                                                   | Optional. Names the input and the list.                                    |
| input       | `input`                    | Combobox's: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, Field's control attributes, `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`, `readonly`, `disabled`; TextInput's `value` property; state attributes | `type` is the consumer's.                                                  |
| button      | `button`                   | Combobox's button attributes                                                                                                                                                                                                                                                              | Optional; popup mode only. Opens and closes the list without taking focus. |
| scroller    | any                        | Listbox's                                                                                                                                                                                                                                                                                 | Optional.                                                                  |
| list        | any; usually `ul` or `div` | Listbox's in virtual focus mode, with `aria-labelledby` = the label (or `labelledBy`)                                                                                                                                                                                                     |                                                                            |
| empty       | any                        | Listbox's                                                                                                                                                                                                                                                                                 | Optional. Shown while no option matches.                                   |
| description | any                        | Field's                                                                                                                                                                                                                                                                                   | Optional.                                                                  |
| error       | any                        | Field's                                                                                                                                                                                                                                                                                   | Optional.                                                                  |

The item parts are Listbox's: `option`, `optionLabel`, `optionDescription`,
`optionExtras`, `group` and `groupLabel`. As in Combobox, an option the
filter leaves out gets `hidden`, and so does a group with no option left.

### Props

From Listbox: `items`, `getKey`, `getTextValue`, `isItemDisabled`,
`getChildren`, `disabledKeys`, `value`, `selectionMode`, `shouldFocusWrap`,
`listId` and the virtualization props.

From Field: `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`,
`inputId`, `labelElementType`, `labelledBy` and `describedBy`.

From Combobox, moved: `filter`, `locale`, `buttonLabel` and
`optionCountAnnouncement`.

Its own:

| Prop         | Type                             | Default   | Bindable | Change event  | Notes                                                                    |
| ------------ | -------------------------------- | --------- | -------- | ------------- | ------------------------------------------------------------------------ |
| inputValue   | `string`                         | `''`      | yes      | `inputChange` | The input's text.                                                        |
| hasPopup     | `boolean`                        | `false`   | no       | —             | Popup mode. Attribute `has-popup`.                                       |
| isOpen       | `boolean`                        | `false`   | yes      | `openChange`  | Popup mode: whether the list shows. Inline mode ignores it.              |
| popupTrigger | `'input' \| 'focus' \| 'manual'` | `'input'` | no       | —             | Popup mode: Combobox's `popoverTrigger`, which Combobox passes on to it. |

The filter's type, `AutocompleteFilter`, is Combobox's; `ComboboxFilter`
stays as an alias of it.

### Events

| Event                | Detail              | When                                                                    |
| -------------------- | ------------------- | ----------------------------------------------------------------------- |
| `valueChange`        | `readonly string[]` | Listbox's: a press or Enter changed the selection.                      |
| `action`             | `string`            | Listbox's: an option was chosen by a press or Enter, with its key.      |
| `inputChange`        | `string`            | The text changed: typing, pasting, an IME commit.                       |
| `openChange`         | `boolean`           | Popup mode: the user opened or closed the list.                         |
| `focusChange`        | `boolean`           | Focus entered or left the input, the button and the list, taken as one. |
| `renderedKeysChange` | Listbox's           | Listbox's, when virtualized.                                            |

### Public state

| Field            | Type                | Meaning                                            |
| ---------------- | ------------------- | -------------------------------------------------- |
| value            | `readonly string[]` | The selected keys.                                 |
| inputValue       | `string`            | The input's text.                                  |
| isOpen           | `boolean`           | The list shows; always `true` inline.              |
| focusedKey       | `string \| null`    | The highlighted option, or `null`.                 |
| isEmpty          | `boolean`           | No option matches the text, or there are no items. |
| isDisabled       | `boolean`           |                                                    |
| isReadOnly       | `boolean`           |                                                    |
| isRequired       | `boolean`           |                                                    |
| isInvalid        | `boolean`           |                                                    |
| isErrorShown     | `boolean`           | Field's.                                           |
| isFocusWithin    | `boolean`           | Focus is in the input, the button or the list.     |
| isFocusVisible   | `boolean`           | That focus came from the keyboard.                 |
| isVirtualized    | `boolean`           | Listbox's.                                         |
| renderedKeys     | `readonly string[]` | Listbox's.                                         |
| renderedSections | `readonly string[]` | Listbox's.                                         |

### Actions

| Action      | Effect                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------- |
| `open()`    | Popup mode: Combobox's `open()`, which now passes the call on. Does nothing inline.                       |
| `close()`   | Popup mode: Combobox's `close()`. Does nothing inline.                                                    |
| `showAll()` | Shows every option, and keeps the text, until the user types again ([Open questions](#open-questions) 9). |

### Filtering

The Combobox spec's Filtering section moves here, with one change of
wording. Combobox says the filter applies once the user has typed "since
the text last settled". Autocomplete has no settling, so the filter applies
once the user types, and stops when `showAll()` is called or the text is
set from outside (a chosen option's text, a reverted text, a cleared
search). Combobox calls `showAll()` wherever its text settles, so its
behavior doesn't change.

With no matches, popup mode behaves as Combobox's: with an empty part the
list stays open, and without one it closes. Inline, the list stays shown
with its empty part.

### Keyboard

The Combobox spec's Keyboard table moves here, except two rows that are
about Combobox's value. Autocomplete leaves these keys unhandled and
doesn't prevent them, so the composer can act on them:

- **Enter with nothing highlighted.** Combobox settles the text here, as
  today. Inline, a form submits.
- **Escape while the list is closed.** Combobox reverts the text here, as
  today.

Inline mode differs in three ways:

- ArrowDown and ArrowUp always move the highlight, since the list is
  always open.
- Alt+ArrowDown and Alt+ArrowUp do nothing.
- Escape on non-empty text clears it, prevented, and reports `inputChange`
  with `''`. On an empty input it isn't handled, so it reaches a dialog
  around the list. This is what UI Kit's FilterListBox does, and React Aria's search
  field inside its Autocomplete.

### ARIA and state attributes per state

The input, button, list and option rows of the Combobox spec's table apply
as written, and the root, label, description and error rows are Field's.
Inline, the input is always `aria-expanded="true"` and there is no button.

State attributes go on every named part:

- `data-open` while the list shows (always, inline);
- `data-empty`;
- Field's `data-disabled`, `data-readonly`, `data-required` and
  `data-invalid`;
- `data-focus-within` and `data-focus-visible`.

In Combobox, Popover still adds `data-entering` and `data-exiting`.

### Focus, pointer and touch

These come from the Combobox spec:

- **Focus.** DOM focus stays in the input, and the highlight follows the
  rules of its Focus section: how it moves and clears, what opening
  highlights, and the button never taking focus.
- **Pointer and touch.** The rules for the input, the button and the
  options, from its Pointer and touch section.

Two rules stay with Combobox:

- focus leaving the combo box, which settles the text and closes the list;
- a press outside, which is Popover's.

### Live announcements

The option count is announced politely, from `optionCountAnnouncement`:

- **Popup mode:** as Combobox's, when the list opens and when typing
  changes the count while it is open.
- **Inline:** when typing changes the count while focus is in the input.
  A screen reader then hears what the filter left, as it does with a
  popup.

### Styling tokens

As Combobox's, without Popover's phases and positioning:

- `data-open`, `data-empty`, Field's state and the focus attributes on the
  named parts;
- Button's on the button;
- Listbox's on the options;
- `hidden` on filtered-out options and groups.

`@uniaria/styles` gets an Autocomplete style built from TextField's input
box and Listbox's list.

### Expected spoken output

Popup mode reads as Combobox's. Inline phrases are derived from Combobox's
probed ones, with a label "Fruit"; the scenarios will probe them:

| State                | Spoken phrase                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| text "a"             | `combobox, Fruit, a, has popup listbox, expanded, autocomplete in list, 1 control`                           |
| Banana highlighted   | `combobox, Fruit, a, has popup listbox, expanded, active descendant Banana, autocomplete in list, 1 control` |
| the list             | `listbox, Fruit, orientated vertically`, then Listbox's options                                              |
| filtered-out options | not read                                                                                                     |

### Adapter surface

```tsx
// React: an inline filter list
const fruit = useBehavior(autocomplete, {
  items,
  selectionMode: 'multiple',
  defaultValue: ['banana'],
});
return (
  <div {...fruit.parts.root}>
    <label {...fruit.parts.label}>Fruit</label>
    <input {...fruit.parts.input} type="search" />
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
<!-- Custom elements: items read from the options -->
<uni-autocomplete selection-mode="multiple">
  <label data-element="Label">Fruit</label>
  <input data-element="Input" type="search" />
  <div data-element="List">
    <div data-element="Option" data-key="apple">Apple</div>
    <div data-element="Option" data-key="banana">Banana</div>
  </div>
  <p data-element="Empty">No fruit</p>
</uni-autocomplete>
```

The element follows `<uni-combobox>`:

- **Items.** Without `items`, it reads them from the options.
- **Attributes:** `disabled-keys`, `selection-mode`, `has-popup`,
  `popup-trigger`, `disabled`, `readonly`, `required`, `invalid`,
  `focus-wrap`, `locale`, `button-label`, `labelled-by` and
  `described-by`.
- **Properties:** `items`, `filter`, `value`, `defaultValue`,
  `inputValue`, `defaultInputValue`, `isOpen`, `defaultOpen` and
  `optionCountAnnouncement`.
- **Events:** `valuechange`, `action`, `inputchange`, `openchange`,
  `focuschange` and `renderedkeyschange`.
- **Methods:** `open()`, `close()` and `showAll()`.

## The components rebuilt on them

### TextField

TextField becomes Field and TextInput (`{ parts: { root: 'input' } }`),
plus the press on its wrapper and its tooltip link. TextInput gives it the
buffered value, the IME guard, hover and focus. TextField keeps its form
reset, because it holds `defaultValue`, and its wrapper and tooltip. Its API
and behavior don't change.

### NumberField

NumberField becomes Field, TextInput and two Buttons. It passes its text
(the draft, or else the formatted value) to TextInput as a controlled
`value`. From TextInput it gets the IME hold, hover, focus and the input's
attributes. It keeps everything that is about numbers: parsing, the
`beforeinput` veto, committing a paste, undoing an invalid composition,
stepping, the wheel and its form reset.

### Combobox

| Today in Combobox                                                                                                                 | After                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Field                                                                                                                             | Autocomplete's Field, its parts mapped to Combobox's                              |
| The input's buffered text and IME guard                                                                                           | TextInput, inside Autocomplete                                                    |
| Filtering, the collator, hidden options                                                                                           | Autocomplete                                                                      |
| The keys on the input, the highlight, opening by keys, typing or focus                                                            | Autocomplete                                                                      |
| The button                                                                                                                        | Autocomplete                                                                      |
| The option count announcement and the missing-name warning                                                                        | Autocomplete                                                                      |
| The option tooltip                                                                                                                | Autocomplete; Combobox passes its link on ([Runtime changes](#runtime-changes) 3) |
| Popover                                                                                                                           | Combobox                                                                          |
| An unset `inputValue` showing the value's text; Selection; Escape reverting while closed; Enter settling with nothing highlighted | Combobox                                                                          |
| Focus leaving: settling and closing                                                                                               | Combobox                                                                          |
| `hiddenInput`, native `required`, form reset                                                                                      | Combobox                                                                          |

```ts
setup(ctx) {
  const { props } = ctx;
  // Before Autocomplete, so the popover shows before an option scrolls
  // into view: watchers run in the order they're composed.
  const layer = ctx.use(popover, () => ({ /* as today */ }), {
    parts: { root: 'popover', trigger: 'input' },
  });
  const search = ctx.use(
    autocomplete,
    () => ({
      // Listbox's and Field's props, as given.
      value: props.value.get(),
      onValueChange: setValue,
      inputValue: text(),
      onInputChange: (next: string) => props.inputValue.set(next),
      hasPopup: true,
      isOpen: props.isOpen.get(),
      onOpenChange: (next: boolean) => props.isOpen.set(next),
      popupTrigger: props.popoverTrigger(),
      onAction: onChosen,
    }),
    { links: [optionTooltipLink] },
  );
  // Selection, Escape while closed, Enter with nothing highlighted, focus
  // leaving, the hidden input and form reset: as today.
}
```

Its props, events, public state, actions, parts and spoken output don't
change.

## Runtime changes

Each of these changes the runtime contract (root AGENTS.md, Stop and ask the
owner), so each is also an open question.

1. **A part with nowhere to go is left out.** Today a composed definition's
   part goes to the composer's part of the same name, and composing throws
   when there is none. Adding an optional part to a control therefore
   breaks every definition that composes it.
   - The items spec's four new Button parts had to be left out by hand in
     Combobox, Dialog, NumberField, Popover and Select (`NO_ITEM_PARTS`),
     and Combobox lists seven of Popover's.
   - Inside UniAria that cost one commit. For an outside definition
     composing TextInput or Autocomplete, it would be a break on a minor
     update.

   The change: a part with no part of the same name and no mapping is left
   out, as `null` leaves it out. A mapping that names a part the composer
   doesn't have still throws. `NO_ITEM_PARTS` and the lists of `null`s go
   ([Open questions](#open-questions) 6).

2. **`Composed<D>.actions`.** `ctx.use()` returns the composed behavior's
   actions, typed `ActionsOf<D>`, each run in a batch as on the instance.
   A composing definition can then call `open()` without touching `api`.
3. **Links passed on.** `ctx.use(def, props, { links: [optionTooltipLink] })`
   passes the composer's link to the composed definition. Its
   `ctx.link(key)` then returns the composer's linked instance, and the
   composer leaves that link to it.
   - A composed definition reads only the links passed to it; any other
     stays `undefined`, as all of them do today.
   - Combobox passes `optionTooltip` on to Autocomplete, which drives it
     from its highlight. An outside definition can do the same, without
     UniAria's internal helpers ([Open questions](#open-questions) 7).
4. **A composed, controlled bindable doesn't reset.** When the composer
   passes a composed definition's value, `reset()` on that bindable
   returns the current value and reports nothing, because the composer
   resets its own ([Who resets a form value](#who-resets-a-form-value)). An
   uncontrolled bindable inside a composed definition resets as before
   ([Open questions](#open-questions) 8).

## Changes to approved specs

As with the items spec, these edits land with the implementation:

- **TextField:** Builds on gains TextInput, and its Value section points to
  TextInput's. The behavior is the same.
- **NumberField:** Builds on gains TextInput.
- **Combobox:** the Summary and Builds on name Autocomplete (Field,
  TextInput and Listbox) and Popover. Filtering, the Keyboard rows other
  than settling, Focus other than focus leaving, and Live announcements
  point to Autocomplete's. The behavior is the same.
- **Root AGENTS.md** (Behavior lives in definitions):
  - Combobox is Autocomplete and Popover;
  - the two levels;
  - one Field per control;
  - what a composing definition may use;
  - `ctx.use()`'s `links`, and parts with nowhere to go being left out.

## Documentation

- **`docs/components/autocomplete.mdx`**, with a live demo of an inline
  filter list. The popup mode is shown by Combobox.
- **`docs/guide/custom-components.md`**, a section "Build on the controls":
  TextInput and Autocomplete in a definition (the hex input above), and why
  two behaviors don't share one element.
- **`docs/api/core.md`, Composition:** what a composing definition may rely
  on, `actions`, `links`, and parts with nowhere to go.
- **`docs/guide/composition.md`:** a line telling composites (one instance)
  apart from owners and links (several instances), pointing to the guide.

## Implementation order and checks

1. **The runtime changes**, a commit each, with Node tests in `runtime/`.
2. **TextInput, then TextField on it.** TextField's suite passes unchanged.
3. **NumberField on TextInput.** Its suite passes unchanged.
4. **Autocomplete's conformance scenarios** for inline mode, in a pull
   request of their own (Conformance).
5. **Autocomplete, then Combobox on it.** Combobox's suite passes unchanged
   in every adapter, and so does Autocomplete's.
6. **The rest:** docs, the styles, the element entry, and `pnpm size`
   before and after. TextField, NumberField and Combobox shouldn't grow.

Render counts in React and Vue stay at zero for internal interactions.

The main risk is order. Watchers run in the order definitions are composed
(Combobox's highlight-on-open runs after Popover's show today). Merged
handlers also run in order, and Autocomplete's keydown comes before
Combobox's, which checks `defaultPrevented`. The unchanged suites are what
catch a difference.

## Mapping from Cube UI Kit

| UI Kit                                          | Today                                                                                                | In UniAria                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ComboBox                                        | Its own input wiring; the highlight copied into React state                                          | Combobox: Autocomplete and Popover                                                                    |
| FilterListBox                                   | A search input wired to ListBox by hand (`role="combobox"`, always expanded); the highlight in state | Autocomplete, inline                                                                                  |
| FilterPicker                                    | A Picker trigger with FilterListBox in its popover                                                   | Button, Popover and Autocomplete (inline): a definition, or a later spec                              |
| SearchComboBox                                  | TextInputBase and ListBox; a state counter bumped on every highlight move to render the input again  | Autocomplete (popup) and Popover, clearing the text on `action`                                       |
| TagInput                                        | Its own virtual focus (`setActiveOption`)                                                            | TagField: Autocomplete (popup, multiple), Popover and the tags (Combobox spec, Resolved questions 16) |
| CommandTextArea                                 | `role="combobox"` on a `<textarea>`, which HTML doesn't allow; the query is a token                  | Later ([Summary](#summary))                                                                           |
| CommandMenu                                     | A searchbox in front of a menu, with virtual focus                                                   | Later, with Menu                                                                                      |
| TextInput, TextArea, SearchInput, PasswordInput | TextInputBase, with the buffered value added to each field                                           | TextField, with TextInput inside; search and password buttons are the consumer's (TextField spec)     |
| NumberInput                                     | TextInputBase, with its own text                                                                     | NumberField, with TextInput inside                                                                    |

## Differences from React Aria, Zag and the APG

- **React Aria labels at every level.** `useTextField` includes `useField`,
  and `useComboBox` calls `useTextField`, so there is no input hook without
  labelling. UniAria splits TextInput out because a definition holds one
  Field per control: a composite of TextField would run a second Field on
  the same input ([Open questions](#open-questions) 1).
- **React Aria's Autocomplete is inline only.** Its ComboBox isn't built on
  it; a popup autocomplete puts one inside a Popover or Dialog, and focus
  moves into it. UniAria's has a popup mode and Combobox is built on it, so
  the keys and the highlight have one implementation. React Aria's input is
  a textbox or searchbox, where UniAria's is a combobox
  ([Open questions](#open-questions) 3). Its Autocomplete drives any
  collection; UniAria's composes Listbox.
- **Zag's combobox is one machine** with no input primitive.
- **The APG** has no inline form. An inline Autocomplete is a combobox
  whose popup is always shown, so its `aria-expanded` is always `"true"`
  (WAI-ARIA 1.2's combobox).

## Deviations from the WAI-ARIA pattern

One, inline only. The APG's Escape dismisses a visible popup, and
Alt+ArrowUp closes it. An inline list isn't a popup that can hide, so
Escape clears the text instead (as a search field's does, and as the APG
allows for Escape on a combobox whose popup is hidden), then goes to the
page. Alt+ArrowUp does nothing.

## Open questions

1. **Two levels.**
   - (a) Controls and fields, both public, as this spec describes.
   - (b) React Aria's layering: every behavior carries optional labelling,
     and composites leave it out or map it. There is no TextInput, and
     Combobox composes TextField with its label, wrapper and messages left
     out. That is one behavior fewer, but a composite of TextField runs a
     Field on the input and then overrides it, and "just an input" becomes
     a field with five parts left out.
   - (c) Fields only, as today; consumers copy the code.

   Recommended: (a).

2. **TextInput's element.**
   - (a) None. A TextField that renders only its input part is the input
     on its own, labelled by `aria-label` or `labelledBy`, and a second
     element for the same input would split the docs and the styles.
     TextInput is documented for definitions.
   - (b) `<uni-text-input>`, with a component page and a conformance suite
     of its own.

   Recommended: (a).

3. **The inline input's role.**
   - (a) `combobox`, always `aria-expanded="true"`, as UI Kit's
     FilterListBox does. Both modes share one ARIA path, which the virtual
     screen reader and the nightly readers already check through Combobox.
   - (b) React Aria's: a textbox, or a searchbox with `type="search"`, with
     `aria-controls` and `aria-activedescendant` and no expanded state.
     WAI-ARIA 1.2 allows it too, but no UniAria component uses it yet.

   Recommended: (a).

4. **The popup.**
   - (a) One Autocomplete with `hasPopup`, inline by default.
   - (b) Inline only, as React Aria's. Combobox would keep its own opening
     keys and its button, and TagField and a search-and-act box would copy
     them again.
   - (c) Two behaviors, an inline one and a popup one.

   Recommended: (a).

5. **What a composing definition may use.**
   - (a) Props, events, `state()`, `connect()`, `connectItem()`, `actions`,
     part names and link keys. `api` is documented as internal and stays
     typed as it is.
   - (b) The same, and `api` also leaves `Composed`'s public type: UniAria's
     composites reach it through an internal accessor, so outside code
     can't use it by accident.

   Recommended: (a). The `fixed` version group already protects UniAria's
   own use, and (b) can follow if outside definitions start reaching in.

6. **A part with nowhere to go.**
   - (a) It is left out ([Runtime changes](#runtime-changes) 1).
   - (b) Composing keeps throwing, so every new part on a control is a
     breaking change for definitions that compose it.

   Recommended: (a).

7. **Links in composed definitions.**
   - (a) Passed on explicitly through `ctx.use()`'s `links`.
   - (b) Passed automatically: a composed definition reads the composer's
     link for any key both declare. Then Listbox inside Autocomplete
     inside Combobox would all drive the one option tooltip.
   - (c) Not at all. Combobox links with internal helpers, and outside
     definitions can't link an option tooltip to their list.

   Recommended: (a).

8. **Resetting a composed value.**
   - (a) A composed, controlled bindable ignores `reset()`
     ([Runtime changes](#runtime-changes) 4).
   - (b) Each control gets a prop that turns its form reset off, and
     composers set it.
   - (c) Composers pass `default<Name>` down. TextField can't: its readers
     don't expose `defaultValue`, and a default set after mount would be
     missed.

   Recommended: (a).

9. **Showing every option again.**
   - (a) A `showAll()` action, which Combobox calls wherever its text
     settles; an outside definition reaches only actions, so it needs one.
     Autocomplete is then the first component outside the overlays with
     actions, `open()` and `close()` included.
   - (b) No action: the filter stops only when the text is set from
     outside. Combobox stops it through the internal API wherever the text
     settles without changing, and outside definitions can't do that.

   Recommended: (a).
