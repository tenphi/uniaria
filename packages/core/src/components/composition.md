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

1. **Controls**: a behavior for one widget, with no Field of its own or
   with Field's parts as optional parts. Two are new:
   - **TextInput**: a native `<input>` or `<textarea>` with the value
     handling TextField has today (the buffered controlled value, IME, form
     reset), plus hover and focus.
   - **Autocomplete**: a text input that filters a list and moves a
     highlight through it while focus stays in the input. It is the part of
     Combobox that isn't about a value or a popup.

2. **Fields**: a control with Field around it and a form value.
   - TextField becomes Field and TextInput.
   - NumberField becomes Field, TextInput and two Buttons.
   - Combobox becomes Autocomplete and Popover, plus how the text settles
     into a value.

   None of them changes in API, and their behavior changes only in the few
   places [Changes to approved specs](#changes-to-approved-specs) lists.
   Their approved conformance suites pass unchanged.

3. **A composition contract** for definitions outside UniAria that compose
   its controls: what such a definition may rely on, and four runtime
   changes that let it ([Runtime changes](#runtime-changes)).

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
- **Custom element:** `<uni-autocomplete>`, which hosts consumer markup, in
  inline mode. TextInput has none ([Open questions](#open-questions) 2): a
  TextField that renders only its input part is the stand-alone input.

Not part of this spec:

- **The controls UI Kit builds on Autocomplete.** Each gets a spec of its
  own once a consumer asks for it: TagField (Combobox spec, Resolved
  questions 16); a search box that acts and then clears (UI Kit's
  SearchComboBox); a searchable picker (FilterPicker). All three are
  Autocomplete composed with Popover.
- **Combobox gaining Autocomplete's new options**: the first-match
  highlight and multiple selection. Combobox stays as approved; TagField
  brings multiple selection to a popup.
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

| Level    | Behaviors                                                               | What it owns                                                                                             | Labelled by                                                                                           |
| -------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Controls | Button, ToggleButton, TextInput, Listbox, Autocomplete, Popover, Dialog | One widget: its keys, state, ARIA and part props. It may compose another (Popover's trigger is a Button) | Its content or title, the behavior around it, or its own optional Field parts (Listbox, Autocomplete) |
| Fields   | TextField, NumberField, Select, Combobox                                | A form value, and Field around a control                                                                 | One Field: its own, or its control's (Combobox maps Autocomplete's)                                   |

The table names the behaviors this spec touches. Checkbox, Switch and the
groups are fields too.

Below both levels are the interactions in `dom/`: `createPress`,
`createHover`, `createFocus` and the rest, each the state and handlers for
one concern on one part. Definitions at either level use them.

**Names.**

- `<Name>Input` is a text control without labelling, and `<Name>Field` is
  Field around a control, with a form value. The TextField spec already
  uses the second half of that rule ("Field plus a text control is
  `<Name>Field`").
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

/** A hex color: TextInput, refusing typed characters that aren't hex. */
export const hexInput = defineBehavior({
  name: 'hex-input',
  parts: ['root', 'input', 'swatch'],
  props: {
    // The element adopts the text typed before it upgraded.
    value: bindable('', { adopt: { part: 'input', property: 'value' } }),
  },
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
focus come from TextInput. The consumer labels the input as any other: a
`<label for>` or an `aria-label`. Inside a form, `hexInput` would also reset
`value` itself, as TextField does
([Who resets a form value](#who-resets-a-form-value)). The veto can't refuse
IME text in Chromium, whose `insertCompositionText` can't be cancelled;
NumberField undoes such a composition at its end.

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

And three rules for putting them together:

- **Handlers.** A composer that adds handlers to a composed part merges
  them with `mergeHandlers` from `@uniaria/core/dom`; they run in the order
  given. Autocomplete ignores a `keydown` that is already prevented, so a
  composer that puts its own handler first takes a key over. A composer
  that acts on a key Autocomplete leaves to it puts its handler after, and
  skips a `keydown` that is prevented, mid-composition, with Ctrl or Meta,
  or while disabled, as Autocomplete does.
- **Item parts.** `parts` maps a composed definition's parts, not its item
  parts. A composer of Listbox or Autocomplete declares the item parts
  under their names (`option`, `group`, …) in its own `itemParts` and
  returns the composed `connectItem()` for them, as Combobox does.
- **Adoption.** An element adopts only into the definition it registers.
  A composer that wants an element to adopt the input's text declares
  `adopt` on its own bindable, as TextField and `hexInput` do.

`api` stays internal: outside code that reads it gets no compatibility
promise ([Open questions](#open-questions) 5). Autocomplete is designed so
that the list above is enough to build a combobox-like control on it.

### One Field per control

A control's label, description and error come from one Field whose
`control` part is that control, so its ARIA is written once. The behavior
that owns the control composes Field, and a composite maps that Field's
parts instead of adding a second one:

- **TextInput has no labelling.** It is meant to be composed, and the
  behavior around it labels it: TextField, NumberField, Autocomplete, or
  the consumer's own.
- **Listbox and Autocomplete carry labelling.** They are components in
  their own right, so they keep Field's label, description and error as
  optional parts.
  - Select leaves Listbox's out, because its own Field labels the trigger.
  - Autocomplete leaves Listbox's out and labels the input and the list
    with its own.
  - Combobox maps Autocomplete's onto its own label, description and
    error, and no longer composes Field itself.

### Who resets a form value

On a form reset, a value goes back to the default the consumer seeded it
with (`default<Name>`), and the behavior that holds that bindable does the
reset (owner, 2026-10-19). A composed control gets its value from the
composer, so the composer resets it and the control must not. Otherwise
TextInput inside TextField would report the value it mounted with right
after TextField reported its default. Runtime change 4 makes a composed
definition's controlled bindable ignore `reset()`.

- **TextInput** resets its value through `reset()`, which change 4 turns
  off when it is composed and given its value. A controlled TextInput with
  no `defaultValue` goes back to the value it mounted with, as TextField
  does. Composed or not, it drops its draft on a reset, and writes its text
  again after the native reset puts back the `value` attribute.
- **Autocomplete** resets its text the same way, as a field resets its
  value: the input's text is what a form would submit if the consumer names
  it. Its selection stays, as Listbox's does, since a list has no form
  value. Composed in Combobox, its text is Combobox's, which resets it.

## TextInput

TextInput is TextField without Field and without the wrapper: one native
`<input>` or `<textarea>`, with hover, focus, read-only and disabled
states. It takes the value handling in the TextField spec's Value section,
which moves here unchanged.

- `name: 'text-input'`; exported as `textInput` from
  `@uniaria/core/text-input`.
- **Builds on:** `createHover` and `createFocus` from `dom/`.
- **Custom element:** none ([Open questions](#open-questions) 2). React and
  Vue can still render it with `useBehavior`, since the adapters are
  generic.

### Anatomy

| Part | Element               | Attributes UniAria owns                                        | Notes                                                                                                                                                                         |
| ---- | --------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root | `input` or `textarea` | `disabled`, `readonly`, the `value` property, state attributes | The control itself, as Button's root is the button. A composer maps it to its own part (`{ parts: { root: 'input' } }`). The consumer owns the rest, as in TextField's input. |

### Props

| Prop       | Type      | Default | Bindable | Change event  | Notes                                                                                                        |
| ---------- | --------- | ------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| value      | `string`  | `''`    | yes      | `valueChange` | TextField's. It adopts nothing itself: an element adopts into the definition it registers ([Value](#value)). |
| isDisabled | `boolean` | `false` | no       | —             | The input is natively `disabled`.                                                                            |
| isReadOnly | `boolean` | `false` | no       | —             | The input is natively `readonly`. Attribute `readonly`.                                                      |

### Events

| Event         | Detail    | When                            |
| ------------- | --------- | ------------------------------- |
| `valueChange` | `string`  | Each edit, as TextField's.      |
| `focusChange` | `boolean` | The input gained or lost focus. |

### Public state

| Field          | Type      | Meaning                                                                                                          |
| -------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| value          | `string`  | The value, as TextField's: while a controlled consumer hasn't answered, the input shows typed text this doesn't. |
| isFocused      | `boolean` | The input has focus.                                                                                             |
| isFocusVisible | `boolean` | Focus arrived by keyboard or assistive technology.                                                               |
| isHovered      | `boolean` | A mouse or pen is over the input.                                                                                |
| isDisabled     | `boolean` | The prop.                                                                                                        |
| isReadOnly     | `boolean` | The prop.                                                                                                        |

### Value

These rules are the TextField spec's, moved:

- **The live property.** The value is written to the `value` property only
  when it differs from the element.
- **Uncontrolled.** Each edit stores the text and reports it.
- **Controlled and buffered.** While a controlled consumer hasn't answered,
  the typed text (the draft) stays on screen. An echo of a reported value
  is left alone, and any other value is written at once and drops the
  draft. A value the consumer never takes goes back on blur.
- **IME.** The value is never written mid-composition.
- **Form reset.** See [Who resets a form value](#who-resets-a-form-value).
- **Before JavaScript.** The text typed before the script loaded is
  adopted by the composer's element, which declares `adopt` on its own
  bindable (TextField's `value`).

Composed, the value belongs to the composer, so the buffer holds the typed
text until the composer passes it back. A composer whose own value is
uncontrolled passes it back at once, so the draft exists only while a
controlled consumer at the top hasn't answered. TextField, NumberField and
Autocomplete get their buffering from here, and Combobox through
Autocomplete.

UniAria's composers also read two things from TextInput's internal `api`:

- `text()`, the text on screen: the draft, else the value. Autocomplete
  filters by it and exposes it as its `inputValue` state, as Combobox does
  today.
- `revert()`, which drops the draft and has the next flush write the
  value, never mid-composition. NumberField calls it when it refuses an
  edit and when it undoes a composition, and puts the caret back itself;
  Combobox, through Autocomplete, wherever it drops its draft today
  (choosing, reverting, settling, a form reset).

### Keyboard, focus and pointer

TextInput handles no keys and moves no focus. Hover counts only over the
input. A press on the box around it is the composer's to handle, as
TextField's wrapper does.

### ARIA and state attributes per state

TextInput writes no ARIA: the input's role is native, and its name and
description come from the behavior around it. `disabled` and `readonly`
are native attributes.

| Token                                                                                  | On   | Meaning                                                                                       |
| -------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------- |
| `data-hovered`, `data-focused`, `data-focus-visible`, `data-readonly`, `data-disabled` | root | As TextField's. A composer passes on those it documents; Autocomplete passes on none of them. |

Composed, TextInput's root carries its composer's markers.
`@uniaria/styles` has no TextInput style, because its composers style the
input.

### Expected spoken output

None of its own: the input reads as the native control its composer
labels (TextField's spoken output).

### Adapter surface

```tsx
// React: an input labelled by the consumer
const search = useBehavior(textInput, { defaultValue: '' });
return <input {...search.parts.root} type="search" aria-label="Search" />;
```

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
- **Popup** (`hasPopup`), for definitions that show the list in a popup,
  as Combobox does with a Popover ([Open questions](#open-questions) 11).
  `isOpen` says whether the list shows. Autocomplete asks to open and close
  it from the keys, typing, focus and its button, as Combobox does today,
  and closes it when focus leaves. The composer maps Autocomplete's `popup`
  part to the element that holds the list, shows and hides it (Popover's
  top layer, or `hidden`), and handles what [Choosing](#choosing) and
  [Keyboard](#keyboard) leave to it. Development warns when popup mode has
  no popup part. The documentation shows inline mode only, and popup mode's
  props have no attribute.

`name: 'autocomplete'`; exported as `autocomplete` from
`@uniaria/core/autocomplete`; the element is `<uni-autocomplete>`.

### Anatomy

| Part        | Element                    | Attributes UniAria owns                                                                                                                                                                                                                                                                                              | Notes                                                                      |
| ----------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| root        | any; usually `div`         | state attributes                                                                                                                                                                                                                                                                                                     | Optional. Field's root, around every other part.                           |
| label       | `label` by default         | Field's                                                                                                                                                                                                                                                                                                              | Optional. Names the input and the list.                                    |
| input       | `input`                    | Combobox's, but not native `required`: `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`, Field's control attributes, `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`, `readonly`, `disabled`; TextInput's `value` property; state attributes | `type` is the consumer's.                                                  |
| button      | `button`                   | Combobox's button attributes                                                                                                                                                                                                                                                                                         | Optional; popup mode only. Opens and closes the list without taking focus. |
| popup       | any                        | state attributes                                                                                                                                                                                                                                                                                                     | Optional; popup mode only. The element the composer shows the list in.     |
| scroller    | any                        | Listbox's; inline, `tabindex="-1"`                                                                                                                                                                                                                                                                                   | Optional.                                                                  |
| list        | any; usually `ul` or `div` | Listbox's in virtual focus mode, with `aria-labelledby` = the label and `labelledBy`; inline, `tabindex="-1"`                                                                                                                                                                                                        |                                                                            |
| empty       | any                        | Listbox's                                                                                                                                                                                                                                                                                                            | Optional. Shown while no option matches.                                   |
| description | any                        | Field's                                                                                                                                                                                                                                                                                                              | Optional.                                                                  |
| error       | any                        | Field's                                                                                                                                                                                                                                                                                                              | Optional.                                                                  |

The item parts are Listbox's: `option`, `optionLabel`, `optionDescription`,
`optionExtras`, `group` and `groupLabel`. As in Combobox, an option the
filter leaves out gets `hidden`, and so does a group with no option left.

Inline, the list and the scroller take `tabindex="-1"` because Firefox and
Chromium make a scrolling element with no focusable child a tab stop, and
in virtual focus mode no option is focusable. An inline list usually
scrolls, so Tab from the input would land on a list that handles no keys.
Combobox's open list has the same problem, but an approved Combobox
scenario checks that its list has no `tabindex`, so fixing it there is a
follow-up with a change to that scenario.

### Props

From Listbox: `items`, `getKey`, `getTextValue`, `isItemDisabled`,
`getChildren`, `disabledKeys`, `value`, `selectionMode`, `shouldFocusWrap`,
`listId` and the virtualization props. Autocomplete fixes the rest, as
Combobox does: virtual focus on, vertical, and `shouldFocusOnHover` on, but
inline only while focus is in Autocomplete
([Focus](#focus-pointer-and-touch)).

From Field: `isDisabled`, `isRequired`, `isInvalid`, `inputId`,
`labelElementType`, `labelledBy` and `describedBy`.

`isReadOnly`, as Combobox's: the input is natively `readonly`, the list is
`aria-readonly`, and nothing selects.

From Combobox, moved: `filter`, `locale`, `buttonLabel` (popup mode) and
`optionCountAnnouncement`.

Its own:

| Prop                      | Type                             | Default   | Bindable | Change event  | Notes                                                                                                                             |
| ------------------------- | -------------------------------- | --------- | -------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| inputValue                | `string`                         | `''`      | yes      | `inputChange` | The input's text.                                                                                                                 |
| shouldHighlightFirstMatch | `boolean`                        | `false`   | no       | —             | Typing highlights the first match ([The highlight while typing](#the-highlight-while-typing)). Attribute `highlight-first-match`. |
| hasPopup                  | `boolean`                        | `false`   | no       | —             | Popup mode, for definitions: no attribute.                                                                                        |
| isOpen                    | `boolean`                        | `false`   | yes      | `openChange`  | Popup mode, no attribute: whether the list shows. Inline mode ignores it.                                                         |
| popupTrigger              | `'input' \| 'focus' \| 'manual'` | `'input'` | no       | —             | Popup mode, no attribute: Combobox's `popoverTrigger`, which Combobox passes on to it.                                            |

`hasPopup` says the list sits in a popup; it is not `aria-haspopup`, which
a combobox carries implicitly. `popupTrigger` is Combobox's
`popoverTrigger` under a name that doesn't assume a Popover. `buttonLabel`
has no attribute either, since only popup mode has a button.

The filter's type is `AutocompleteFilter`:
`(textValue: string, inputValue: string, item: Item) => boolean`, where
`item` is the item as `items` holds it, so a filter can match keywords or
descriptions. `ComboboxFilter` stays as an alias of it; filters written for
two arguments still work. `AutocompletePopupTrigger` is the trigger's type,
and `ComboboxPopoverTrigger` an alias of it.

### Events

| Event                | Detail              | When                                                                                                       |
| -------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `valueChange`        | `readonly string[]` | Listbox's: a press or Enter changed the selection.                                                         |
| `action`             | `string`            | Listbox's: an option was chosen by a press or Enter, with its key ([Choosing](#choosing)).                 |
| `inputChange`        | `string`            | The text changed: typing, pasting, an IME commit, or Escape clearing it inline.                            |
| `openChange`         | `boolean`           | Popup mode: the user opened or closed the list.                                                            |
| `focusChange`        | `boolean`           | Focus entered or left Autocomplete: the root, the input, the button, the popup and the list, taken as one. |
| `renderedKeysChange` | Listbox's           | Listbox's, when virtualized.                                                                               |

### Public state

| Field            | Type                | Meaning                                                                                        |
| ---------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| value            | `readonly string[]` | The selected keys.                                                                             |
| inputValue       | `string`            | The text on screen: typed text a controlled `inputValue` hasn't caught up with, as Combobox's. |
| isOpen           | `boolean`           | The list shows; always `true` inline.                                                          |
| focusedKey       | `string \| null`    | The highlighted option, or `null`.                                                             |
| isEmpty          | `boolean`           | No option matches the text, or there are no items.                                             |
| isDisabled       | `boolean`           |                                                                                                |
| isReadOnly       | `boolean`           |                                                                                                |
| isRequired       | `boolean`           |                                                                                                |
| isInvalid        | `boolean`           |                                                                                                |
| isErrorShown     | `boolean`           | Field's.                                                                                       |
| isFocusWithin    | `boolean`           | Focus is in Autocomplete, as `focusChange` counts it.                                          |
| isFocusVisible   | `boolean`           | That focus came from the keyboard.                                                             |
| isVirtualized    | `boolean`           | Listbox's.                                                                                     |
| renderedKeys     | `readonly string[]` | Listbox's.                                                                                     |
| renderedSections | `readonly string[]` | Listbox's.                                                                                     |

### Actions

| Action      | Effect                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `open()`    | Popup mode: Combobox's `open()`, which now passes the call on. Does nothing inline.                                             |
| `close()`   | Popup mode: Combobox's `close()`. Does nothing inline.                                                                          |
| `showAll()` | Stops the filter: every option shows, and the text stays ([Open questions](#open-questions) 9). It neither opens nor announces. |

### Filtering

The Combobox spec's Filtering section moves here, with one change of
wording. Combobox says the filter applies once the user has typed "since
the text last settled". Autocomplete has no settling, so the filter applies
once the user types, and stops only when:

- `showAll()` is called;
- a form reset resets the text;
- popup mode reopens the list after typing that matched nothing (Combobox's
  rule, moved).

Text the composer or the consumer sets doesn't stop it: an echo, a
transformed text, or a cleared one. Combobox calls `showAll()` wherever its
text settles today (choosing, reverting, settling), so its behavior doesn't
change.

Typing is every `input` event on the input. Autocomplete merges its own
`input` handler after TextInput's, so it reads the text TextInput took, and
filters, clears the highlight and opens even when the text is the value
already, as Combobox does today.

With no matches, popup mode behaves as Combobox's: with an empty part the
list stays open, and without one it closes. Inline, the list stays shown
with its empty part.

### The highlight while typing

By default, typing clears the highlight, as in Combobox (Combobox spec,
Resolved questions 2), and ArrowDown highlights. With
`shouldHighlightFirstMatch`, as in UI Kit's FilterListBox and React Aria's
Autocomplete ([Open questions](#open-questions) 10):

- Typing that inserts text (`insertText`, or an IME commit) highlights the
  first shown option, in list order, that is selected and enabled, else the
  first enabled shown option. The highlight isn't focus-visible, and it
  scrolls into view.
- Deleting, pasting, undoing and redoing clear the highlight.
- While typing holds the highlight, the input has no
  `aria-activedescendant`: it is written 500 ms after the last insertion,
  so a screen reader still reads the typed character (React Aria's delay,
  for NVDA). Arrow keys, presses and hover move the highlight and write it
  at once, ending the wait. The highlight itself, its `data-focused` and
  Enter act at once.

### Choosing

A press or Enter on the highlighted option selects it as Listbox does and
reports `action`. Autocomplete changes nothing else: the text, the filter,
`isOpen` and the highlight stay as they were. The composer acts on
`action`: Combobox writes the option's text, calls `showAll()` and closes;
a search box clears the text; a filter list does nothing more.

In multiple mode, Enter and a press toggle the option, as Listbox's press
does. Space types, and Shift+Arrows and Ctrl+A edit the text, so Listbox's
range selection and select-all don't apply.

### Keyboard

The Combobox spec's Keyboard table moves here, except the parts that are
about Combobox's value. Autocomplete leaves these unhandled and doesn't
prevent them, so the composer can act on them:

- **Enter with nothing highlighted.** Combobox settles the text and closes
  the list here, as today. Inline, a form submits.
- **Escape while the list is closed.** Combobox reverts the text here, as
  today.
- **Tab and Shift+Tab** are left to the browser, as in Combobox. Focus
  leaving closes the list in popup mode ([Focus](#focus-pointer-and-touch));
  Combobox settles the text then.

Autocomplete ignores a `keydown` that is already prevented, one during an
IME composition, and one with Ctrl or Meta, as Combobox does. A composer
that acts on the keys above skips the same ones
([What a composing definition may use](#what-a-composing-definition-may-use)).

Inline mode differs in three ways:

- ArrowDown and ArrowUp always move the highlight, since the list is
  always shown.
- Alt+ArrowDown and Alt+ArrowUp do nothing.
- Escape on non-empty text clears it, prevented, and reports `inputChange`
  with `''`, unless Autocomplete is read-only or disabled. On an empty
  input it isn't handled, so it reaches a dialog around the list. This is
  what UI Kit's FilterListBox does, and React Aria's search field inside
  its Autocomplete.

### ARIA and state attributes per state

The input, button, list and option rows of the Combobox spec's table apply
as written, except native `required` on the input, which Combobox adds
itself: inline, the text is no value, and an empty search would block a
form. The root, label, description and error rows are Field's.
Inline, the input is always `aria-expanded="true"` and there is no button.
In multiple mode the list is `aria-multiselectable="true"`, as Listbox's.

State attributes go on every named part, the input included:

- `data-open` while the list shows (always, inline);
- `data-empty`;
- `data-disabled`, `data-readonly`, `data-required` and `data-invalid`;
- `data-focus-within` and `data-focus-visible`.

The input carries these and not TextInput's `data-hovered` and
`data-focused`, as Combobox's input does today. In Combobox, Popover still
adds `data-entering` and `data-exiting`.

### Focus, pointer and touch

From the Combobox spec:

- **Focus.** DOM focus stays in the input, and the highlight follows the
  rules of its Focus section: how it moves and clears, what opening
  highlights, and the button never taking focus.
- **Pointer and touch.** The rules for the input, the button and the
  options, from its Pointer and touch section.

Popup mode: focus leaving Autocomplete closes the list, and its
focus-within counts the popup part, so focus on a control in the popup
stays inside. The Combobox rule moves here except settling the text, which
stays with Combobox. Autocomplete reports `focusChange` before it closes,
so a composer that settles on it acts first, as Combobox does today. The
window losing focus leaves the input focused and closes nothing. A press
in the popup, outside a control of its own, keeps focus in the input
(Combobox's rule, moved); a press outside is Popover's.

Inline mode adds four rules, since nothing closes:

- **Leaving.** The highlight clears when focus leaves Autocomplete, as it
  clears on close in popup mode, so no option looks highlighted while focus
  is elsewhere.
- **Hover** highlights an option only while focus is in Autocomplete; with
  focus elsewhere, the option gets only `data-hovered`. Otherwise a resting
  pointer would leave an option for Enter to choose after tabbing in.
- **Pressing in the list.** A press in the list, the scroller or the empty
  part, outside a control of its own, has its `mousedown` prevented for
  every pointer type. A mouse or pen press then moves focus to the input
  (`preventScroll`); a touch press doesn't, so the virtual keyboard doesn't
  open. The list and the scroller count as no control, though they carry a
  `tabindex`. The same goes for the popup in popup mode, which fixes
  Combobox's virtualized scroller taking focus on a press today.
- **Tab** passes the list by, since it is `tabindex="-1"`
  ([Anatomy](#anatomy-1)).

### Live announcements

The option count is announced politely, from `optionCountAnnouncement`:

- **Popup mode:** as Combobox's, when the list opens and when the count
  changes while it is open.
- **Inline:** whenever the number of shown options changes while focus is
  in Autocomplete, whatever changed it: typing, items arriving for a
  server-side filter (`filter: false`), Escape clearing the text,
  `showAll()`. Never on focus or on mount. A new count replaces one not yet
  read.

Development warns when the input or the list has no name. The list is
named by the label or `labelledBy`, so an input named only by an
`aria-label` leaves the list unnamed.

### Styling tokens

As Combobox's, without Popover's phases and positioning:

- `data-open`, `data-empty`, the state attributes and the focus attributes
  on the named parts;
- Button's on the button;
- Listbox's on the options;
- `hidden` on filtered-out options and groups.

`@uniaria/styles` gets an Autocomplete style built from TextField's input
box and Listbox's list.

### Expected spoken output

Popup mode reads as Combobox's. Inline phrases are derived from Combobox's
probed ones, with a label "Fruit"; the scenarios will probe them:

| State                   | Spoken phrase                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| text "a"                | `combobox, Fruit, a, has popup listbox, expanded, autocomplete in list, 1 control`                           |
| Banana highlighted      | `combobox, Fruit, a, has popup listbox, expanded, active descendant Banana, autocomplete in list, 1 control` |
| the list                | `listbox, Fruit, orientated vertically`, then Listbox's options                                              |
| the list, multiple mode | `listbox, Fruit, orientated vertically, multi-selectable`                                                    |
| no match                | the count, `optionCountAnnouncement(0)`, announced; the empty part is read where the reader moves to it      |
| filtered-out options    | not read                                                                                                     |

Real screen readers have checked Combobox's popup, not an always-expanded
list, so the highlight moving, the count and Escape get scenarios that
declare `needs: ['screenReader']`.

### Adapter surface

```tsx
// React: an inline filter list
const fruit = useBehavior(autocomplete, {
  items,
  selectionMode: 'multiple',
  defaultValue: ['banana'],
  shouldHighlightFirstMatch: true,
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
<uni-autocomplete selection-mode="multiple" highlight-first-match>
  <label data-element="Label">Fruit</label>
  <input data-element="Input" type="search" />
  <div data-element="List">
    <div data-element="Option" data-key="apple">Apple</div>
    <div data-element="Option" data-key="banana">Banana</div>
  </div>
  <p data-element="Empty">No fruit</p>
</uni-autocomplete>
```

The element follows `<uni-combobox>`, in inline mode:

- **Items.** Without `items`, it reads them from the options.
- **Attributes:** `disabled-keys`, `selection-mode`,
  `highlight-first-match`, `disabled`, `readonly`, `required`, `invalid`,
  `focus-wrap`, `locale`, `labelled-by` and `described-by`.
- **Properties:** `items`, `filter`, `value`, `defaultValue`,
  `inputValue`, `defaultInputValue` and `optionCountAnnouncement`. Popup
  mode's props are properties too, as every prop is, and are for
  definitions.
- **Events:** `valuechange`, `action`, `inputchange`, `focuschange` and
  `renderedkeyschange`.
- **Methods:** `showAll()`. `open()` and `close()` exist, as every action
  becomes a method, and do nothing inline.

## The components rebuilt on them

### TextField

TextField becomes Field and TextInput (`{ parts: { root: 'input' } }`),
plus the press on its wrapper and its tooltip link. TextInput gives it the
buffered value, the IME guard, hover and focus. TextField keeps its form
reset, because it holds `defaultValue`, the `adopt` on its `value`, and its
wrapper and tooltip. Its API and behavior don't change.

### NumberField

NumberField becomes Field, TextInput and two Buttons. It passes its text
(the draft, or else the formatted value) to TextInput as a controlled
`value`. From TextInput it gets the IME hold, hover, focus and the input's
attributes. It keeps everything that is about numbers: parsing, the
`beforeinput` veto, committing a paste, undoing an invalid composition,
stepping, the wheel and its form reset. Where it refuses an edit or undoes
a composition, it calls TextInput's `revert()`. Today an `input` that isn't
a partial number (autofill, a replacement the veto missed) stays on screen
until the next write; it now goes at the next flush.

### Combobox

| Today in Combobox                                                                       | After                                                                                  |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Field                                                                                   | Autocomplete's Field, its parts mapped to Combobox's                                   |
| The input's buffered text and IME guard                                                 | TextInput, inside Autocomplete. Combobox reads the text and drops the draft through it |
| Filtering, the collator, hidden options                                                 | Autocomplete                                                                           |
| The keys on the input, the highlight, opening by keys, typing or focus                  | Autocomplete                                                                           |
| The button                                                                              | Autocomplete                                                                           |
| The option count announcement and the missing-name warning                              | Autocomplete                                                                           |
| The option tooltip                                                                      | Autocomplete; Combobox passes its link on ([Runtime changes](#runtime-changes) 3)      |
| Focus leaving: closing                                                                  | Autocomplete, in popup mode                                                            |
| Popover                                                                                 | Combobox                                                                               |
| An unset `inputValue` showing the value's text; Selection; what choosing an option does | Combobox                                                                               |
| Escape reverting while closed; Enter settling with nothing highlighted                  | Combobox                                                                               |
| Focus leaving: settling                                                                 | Combobox, on Autocomplete's `focusChange`, with the popover mapped to its `popup` part |
| `hiddenInput`, native `required`, form reset                                            | Combobox                                                                               |

```ts
setup(ctx) {
  const { props } = ctx;
  // Before Autocomplete, so the popover shows before an option scrolls
  // into view: watchers run in the order they're composed.
  const layer = ctx.use(popover, () => ({ /* as today */ }), {
    parts: {
      root: 'popover',
      trigger: 'input',
      // Combobox has a description of its own; the rest it lacks.
      description: null,
      title: null,
      close: null,
      triggerLabel: null,
      triggerDescription: null,
      triggerFrame: null,
      triggerExtras: null,
    },
  });
  const search = ctx.use(
    autocomplete,
    () => ({
      // Listbox's and Field's props, as given.
      value: props.value.get(),
      onValueChange: (next: readonly string[]) => setValue(next),
      // The text without the draft: the consumer's, else the seed, else
      // the value's.
      inputValue: committedText(),
      onInputChange: (next: string) => props.inputValue.set(next),
      hasPopup: true,
      isOpen: props.isOpen.get(),
      onOpenChange: (next: boolean) => props.isOpen.set(next),
      popupTrigger: props.popoverTrigger(),
      onAction: (key: string) => onChosen(key),
      onFocusChange: (isFocusWithin: boolean) => onFocusChange(isFocusWithin),
    }),
    { parts: { popup: 'popover' }, links: [optionTooltipLink] },
  );
  // Selection, Escape while closed, Enter with nothing highlighted,
  // settling as focus leaves, the hidden input and form reset: as today,
  // with the text read and the draft dropped through `search.api`.
}
```

Combobox reads these from Autocomplete's internal `api`:

| Member          | For                                                                        |
| --------------- | -------------------------------------------------------------------------- |
| `text()`        | The text on screen, the draft included: settling, and Escape's check.      |
| `revertText()`  | Dropping the draft where Combobox drops it today.                          |
| `isFiltering()` | Whether a value from elsewhere writes its text in, and settling's matches. |
| `matchesFor()`  | The options a typed text matches, for settling.                            |
| `collection()`  | Every option, matching or not: the text a value shows, and settling.       |
| `collator()`    | The exact match settling looks for.                                        |

And its actions: `open()` (as the button opens), `close()` and `showAll()`.

Its props, events, public state, actions, parts and spoken output don't
change. Its behavior changes in three places, listed in
[Changes to approved specs](#changes-to-approved-specs): the filter's
third argument, a press on a virtualized scroller keeping focus in the
input, and the window losing focus dropping a controlled draft, since
TextInput puts a value the consumer hasn't taken back on blur.

## Runtime changes

These change the runtime contract (root AGENTS.md, Stop and ask the
owner). Changes 1, 3 and 4 are open questions 6 to 8; change 2 only adds.

1. **A part with nowhere to go is left out.** Today a composed definition's
   part goes to the composer's part of the same name, and composing throws
   when there is none. Adding an optional part to a control therefore
   breaks every definition that composes it.
   - The items spec's new Button parts had to be left out by hand in
     Combobox, Dialog, NumberField, Popover and Select (`NO_ITEM_PARTS`),
     and Combobox lists seven of Popover's.
   - Inside UniAria that cost one commit. For an outside definition
     composing TextInput or Autocomplete, it would be a break on a minor
     update.

   The change: a part with no part of the same name and no mapping is left
   out, as `null` leaves it out. The instance lists such parts, and the DOM
   binder warns about each once per page in development, keyed on the
   composer's, the composed definition's and the part's names: the DOM-free
   runtime can't tell a development build. A `null` mapping silences the
   warning, so UniAria's own composites keep their lists, and a composer of
   Autocomplete maps the parts it doesn't render to `null`. A mapping that
   names a part the composer doesn't have still throws.

   Change 1 covers only parts with nowhere to go. A part whose name the
   composer also has still binds to it, which is why `NO_ITEM_PARTS` keeps
   `label: null` and `description: null`, Autocomplete leaves Listbox's
   labelling out, and Combobox leaves Popover's `description` out. A new
   optional part named like a common composer part (`label`,
   `description`, `error`, `root`) still binds silently, so it is still a
   breaking change.

2. **`Composed<D>.actions`.** `ctx.use()` returns the composed behavior's
   actions, typed `ActionsOf<D>`, each run in a batch and checked to be a
   function of its `api`, as on the instance. A composing definition can
   then call `open()` without touching `api`.
3. **Links passed on.** `ctx.use(def, props, { links: [optionTooltipLink] })`
   passes the composer's link to the composed definition. Its
   `ctx.link(key)` then returns the composer's linked instance.
   - Passing a link on hands it over: the composer's own `ctx.link(key)`
     returns `undefined` from then on, so one definition drives a linked
     tooltip, as the items spec has it.
   - Composing throws unless the key is among both the composer's links
     (its own, or passed to it) and the composed definition's `links`, so a
     key passed on once can't be passed again.
   - A link prop given in the composed definition's props is ignored: the
     instance's link props are the top level's.
   - A composed definition reads only the links passed to it; any other
     stays `undefined`, as all of them do today.
   - Combobox passes `optionTooltip` on to Autocomplete, which drives it
     from its highlight. An outside definition can do the same, without
     UniAria's internal helpers ([Open questions](#open-questions) 7).
4. **A composed, controlled bindable doesn't reset.** When the composer
   passes a composed definition's value, `reset()` on that bindable
   returns the current value and changes nothing: no report, no
   `beforeReport`, and an uncontrolled value it held stays, because the
   composer resets its own
   ([Who resets a form value](#who-resets-a-form-value)). An
   uncontrolled bindable inside a composed definition resets as before
   ([Open questions](#open-questions) 8). No composed definition calls
   `reset()` today, so nothing changes for the existing components.

## Changes to approved specs

As with the items spec, these edits land with the implementation, each
marked in place as changed on its date (owner):

- **TextField:** the Summary and Builds on say Field and TextInput, and its
  Value section points to TextInput's. The behavior is the same.
- **NumberField:** Builds on gains TextInput; a refused edit and an undone
  composition revert through it, so an `input` that isn't a partial number
  goes at the next flush instead of at the next write.
- **Combobox:**
  - the Summary and Builds on name Autocomplete (Field, TextInput and
    Listbox) and Popover;
  - Filtering, the Keyboard rows except the cells about settling and
    reverting, Focus except settling, and Live announcements point to
    Autocomplete's;
  - `ComboboxFilter` is an alias of `AutocompleteFilter` and gains the
    item argument; `ComboboxPopoverTrigger` is an alias of
    `AutocompletePopupTrigger`;
  - a press on the popover's list or scroller, outside an option, keeps
    focus in the input, a virtualized scroller's `tabindex` included;
  - the window losing focus drops a controlled draft the consumer hasn't
    answered, as TextField does.
- **Listbox:** the composer it names for virtual focus mode becomes
  Autocomplete, and Combobox through it.
- **Virtualization:** Autocomplete forwards the virtualization props to
  its list, as Select and Combobox do, and its inline scroller is
  `tabindex="-1"`.
- **Items:** in Combobox, Autocomplete drives the option tooltip and owns
  the button that the triggers table lists; Option tooltips and New API
  name Autocomplete.
- **Styles:** the component table gains Autocomplete.
- **Root AGENTS.md:**
  - Behavior lives in definitions: Combobox is Autocomplete and Popover;
    the two levels; one Field per control; what a composing definition may
    use; `ctx.use()`'s `actions` and `links`, and parts with nowhere to go;
  - the actions sentence: Autocomplete has `open`, `close` and `showAll`;
  - Controlled and uncontrolled values: a composed, controlled bindable
    doesn't reset;
  - Packages and Custom elements: TextInput has no element, so "one
    registering entry per component" names the components that have one;
  - Component workflow: TextInput has no element and no suite of its own;
    naming: `<Name>Input` is a text control without labelling;
  - `packages/core/AGENTS.md` and `packages/elements/AGENTS.md`: the
    `text-input/` and `autocomplete/` folders hold a `spec.md` that points
    to this spec.

## Documentation

- **`docs/components/autocomplete.mdx`**, with a live demo of an inline
  filter list (`docs/components/demos/autocomplete.*` and
  `apps/docs/demo/autocomplete.ts`). The popup mode is shown by Combobox.
  It joins the navigation in `apps/docs/docs.config.ts` and the table in
  `docs/components/index.mdx`, whose sentence about every component having
  an element names TextInput as the exception.
- **`docs/guide/custom-components.md`**, a section "Build on the controls":
  TextInput and Autocomplete in a definition (the hex input above), the
  rules for handlers, item parts and adoption, and why two behaviors don't
  share one element.
- **`docs/api/core.md`:**
  - Composition: what a composing definition may rely on, `Composed`'s
    `actions`, `links`, and parts with nowhere to go;
  - Owners and links: a composed definition's `ctx.link()` reads the links
    passed to it;
  - Resetting a bindable: change 4;
  - the list of components with actions gains Autocomplete.
- **`docs/guide/composition.md`:** TextField is Field and TextInput.
- **`docs/guide/forms.md`**, Reset: Autocomplete resets its text and keeps
  its selection.
- **`@uniaria/styles`**' Default styles page: Autocomplete.
- **`docs/components/combobox.mdx`:** the filter's third argument.
- **Sentences this spec makes wrong:** that every component registers an
  element or has conformance scenarios (`docs/guide/introduction.md`,
  `docs/api/index.md`, `docs/contributing/index.md`,
  `docs/contributing/testing.md`, `docs/guide/accessibility.md`), that
  Combobox composes Listbox and that a composed definition takes no links
  (`docs/contributing/architecture.md`, `docs/guide/collections.md`), and
  the `ctx.use()` and `ctx.link()` JSDoc in `runtime/define.ts`.

## Implementation order and checks

1. **The runtime changes**, a commit each, with Node tests in `runtime/`.
2. **TextInput, then TextField on it.** TextField's suite passes unchanged,
   and TextInput gets browser tests of its own for what TextField never
   reaches: uncontrolled, its own reset, standalone markers.
3. **NumberField on TextInput.** Its suite passes unchanged.
4. **Autocomplete's conformance scenarios**, in a pull request of their
   own (Conformance): inline mode, and the real-reader scenarios above, at
   phase 6, so every adapter skips them until the implementation raises
   its run. Popup mode is covered by Combobox's suite, since only a
   composer uses it.
5. **Autocomplete, then Combobox on it.** Combobox's suite passes unchanged
   in every adapter, and so does Autocomplete's.
6. **The rest:** docs, the styles and the element entry.

Each new subpath, `text-input` and `autocomplete`, is registered in the
three places root AGENTS.md lists (`tsdown.config.ts`, `package.json`
`exports`, `src/ssr-safety.test.ts`) and in `.size-limit.js`. `pnpm size`
runs before and after: TextField and NumberField may grow a little, since
TextInput's buffer replaces less code in them than in Combobox, and the
pull request reports each entry's change. Render counts in React and Vue
stay at zero for internal interactions.

The main risk is order:

- Watchers run in the order definitions are composed. Popover now comes
  before Autocomplete, so Listbox's watchers (measuring for the virtualizer,
  scrolling into view) run after the popover shows, where today they run
  before it. Combobox's highlight-on-open, now Autocomplete's, still runs
  after it.
- Merged handlers run in order, and Autocomplete's `keydown` comes before
  Combobox's, which checks `defaultPrevented`.
- The draft now lives two levels down, so every place Combobox reads its
  text or drops its draft goes through Autocomplete.

The unchanged suites are what catch a difference.

## Mapping from Cube UI Kit

| UI Kit                                          | Today                                                                                                | In UniAria                                                                                            |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| ComboBox                                        | Its own input wiring; the highlight copied into React state                                          | Combobox: Autocomplete and Popover                                                                    |
| FilterListBox                                   | A search input wired to ListBox by hand (`role="combobox"`, always expanded); the highlight in state | Autocomplete, inline, with `shouldHighlightFirstMatch`                                                |
| FilterPicker                                    | A Picker trigger with FilterListBox in its popover                                                   | Button, Popover and Autocomplete (inline): a definition, or a later spec                              |
| SearchComboBox                                  | TextInputBase and ListBox; a state counter bumped on every highlight move to render the input again  | Autocomplete (popup) and Popover in a definition, clearing the text on `action`                       |
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
- **React Aria highlights the first match by default**
  (`disableAutoFocusFirst`). UniAria's is off by default, as in Combobox,
  and `shouldHighlightFirstMatch` turns it on with React Aria's delay.
- **React Aria switches to real focus on iOS and Android screen readers**,
  for its submenus. UniAria keeps virtual focus there, as Combobox does.
- **Zag's combobox is one machine** with no input primitive.
- **The APG** has no inline form. An inline Autocomplete is a combobox
  whose popup is always shown, so its `aria-expanded` is always `"true"`
  (WAI-ARIA 1.2's combobox).

## Deviations from the WAI-ARIA pattern

Autocomplete keeps Combobox's deviations, such as Tab not choosing the
highlighted option (Combobox spec, Resolved questions 7). It adds three:

- **Always expanded, inline.** The APG's popup is hidden by default. An
  inline list is always shown, so the input is always `aria-expanded`.
- **Escape, inline.** The APG's Escape dismisses a visible popup, and
  Alt+ArrowUp closes it. An inline list can't hide, so Escape clears the
  text instead, and then goes to the page; Alt+ArrowUp does nothing. A
  screen reader announces the input as expanded, so its user may expect
  Escape to collapse the list and loses the text instead. UI Kit's
  FilterListBox and React Aria's search field in its Autocomplete clear on
  Escape too.
- **Multiple selection.** The APG's combobox has no keys for it. Enter and
  a press toggle an option, and Space types (Choosing).

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
     TextInput is documented for definitions, and TextField's suite covers
     its behavior.
   - (b) `<uni-text-input>`, with a component page and a conformance suite
     of its own.

   Recommended: (a).

3. **The inline input's role.**
   - (a) `combobox`, always `aria-expanded="true"`, as UI Kit's
     FilterListBox does. Both modes share one ARIA path, which the virtual
     screen reader checks through Combobox; the always-expanded list gets
     real-reader scenarios of its own, and Escape's cost is in
     [Deviations](#deviations-from-the-wai-aria-pattern).
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
   - (a) It is left out, with a development warning that a `null` mapping
     silences ([Runtime changes](#runtime-changes) 1).
   - (b) Left out silently. A composer with no part of a needed name (an
     Autocomplete `list` its composer calls `listbox`) then leaves the
     input's `aria-controls` pointing at nothing without a word.
   - (c) Composing keeps throwing, so every new part on a control is a
     breaking change for definitions that compose it.

   Recommended: (a).

7. **Links in composed definitions.**
   - (a) Passed on explicitly through `ctx.use()`'s `links`, and handed
     over.
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
     outside. That can't tell the composer's echo of typed text from a new
     text, so a transform or a late echo would show every option.

   Recommended: (a).

10. **The highlight while typing.**
    - (a) `shouldHighlightFirstMatch`, off by default, with React Aria's
      delay for `aria-activedescendant`. Combobox's decision stays the
      default, and FilterListBox turns it on.
    - (b) On by default inline, as React Aria and UI Kit have it, and off
      in popup mode.
    - (c) None. Inline, Enter with nothing highlighted submits the form, so
      "type, then Enter" can't choose.

    Recommended: (a).

11. **Who uses popup mode.**
    - (a) Definitions only: popup mode's props have no attribute, and the
      docs show inline mode. The element still has them as properties, as
      every prop is one, and development warns when popup mode has no
      popup part. The composer shows and hides the list.
    - (b) Everyone: Autocomplete hides the list itself while closed
      (`hidden`), and `<uni-autocomplete has-popup>` works without a
      Popover. It would clash with a Popover's exit animation, and a list
      outside the top layer is clipped by its containers.

    Recommended: (a).
