# NumberField spec

Status: approved by @tenphi on 2026-10-17

## Summary

A number field is a text input for a number, with optional increment and
decrement buttons. It parses and formats the number for the page's language
and the consumer's format (currency, percent, units, numbering systems), keeps
it within `minValue` and `maxValue` and on `step`, and steps it with the arrow
keys, the buttons held down and, while focused, the mouse wheel. Cube UI Kit's
NumberInput is the model; it is React Aria's `useNumberField` with UI Kit's
input around it, so React Aria is the reference for most of the behavior.
`@internationalized/number` parses and formats (Resolved questions 9).

The input is a native `<input type="text">`, not `type="number"`: a number
input can't show a currency symbol, a percent sign or grouping, and its
selection APIs throw.

- **WAI-ARIA pattern:** [Spinbutton](https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/)
  (`references/aria-practices/content/patterns/spinbutton/`, the quantity
  example). NumberField follows its keys and its buttons; the input's role is
  Resolved questions 1.
- **Builds on:** Field (`ctx.use`) for the labelling, as TextField does;
  Button (`ctx.use`, twice) for the increment and decrement parts; `hover`,
  `focus`, `press` and the live announcer from `dom/`. New in `dom/`: phone
  detection for the keyboard (`inputmode`). New dependency, approved:
  `@internationalized/number` (Resolved questions 9).
- **Owner:** none.
- **Tooltip:** takes a Tooltip through its `tooltip` link (Tooltip spec,
  Resolved questions 2), as TextField: hover, focus and keys count on the
  input, so typing closes the tooltip, and the input carries its id after its
  own references.
- **Custom element:** yes, `<uni-number-field>`, hosting consumer markup.

Not part of NumberField:

- **Validation messages.** As in Field: NumberField shows `isInvalid`, the form
  decides it. React Aria's `commitBehavior: 'validate'` (out-of-range values
  kept and reported through a hidden `type="number"` input's native messages)
  is left out: UI Kit never uses it (Resolved questions 11).
- **Scrubbing** (Zag's drag-to-change handle with pointer lock): pointer lock
  is not Baseline. It can come later as its own part.
- **Formatting while typing** (grouping digits as they are typed): no reference
  does it; the text is formatted when it is committed.
- **Numbers beyond a double** (big integers, exact decimals): values are
  JavaScript numbers, as in every reference.
- **Translations.** UniAria ships no locale tables: the button names and the
  role description are props, with English defaults (Resolved questions 2).
  A way to register strings for the whole page is a library-wide design for
  when more components speak, not NumberField's.
- **Out-of-range validation.** A value outside `minValue` and `maxValue` only
  comes from the consumer, who sets `isInvalid` for it (Value, Controlled;
  Resolved questions 11).
- **Looks.** Stepper icons, their layout, right-aligned text and UI Kit's
  `hideStepper` (render no stepper parts) are the design system's.

## Anatomy

| Part        | Element               | Attributes UniAria owns                                                                                                                                                                                                                                                                | Notes                                                                                                                                                                               |
| ----------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root        | any; usually `div`    | state attributes                                                                                                                                                                                                                                                                       | Optional. The outermost element, around the label, the wrapper, the hidden input, the description and the error. No role (Resolved questions 1).                                    |
| wrapper     | any; usually `div`    | state attributes                                                                                                                                                                                                                                                                       | Optional. The box around the input and the buttons. No role. A press on it outside any control focuses the input, as TextField's.                                                   |
| label       | `label` by default    | as Field                                                                                                                                                                                                                                                                               |                                                                                                                                                                                     |
| input       | `input`               | as Field's control; `type="text"`, `inputmode` (Keyboard on phones), `autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`, `aria-roledescription` (Resolved questions 1), `disabled`, `readonly`, the `value` property (the text), state attributes                         | The consumer owns `placeholder`, `autofocus`, `enterkeyhint`, `size`, `tabindex` and `form`. Not `name`: the hidden input carries it, so the form gets the number and not the text. |
| increment   | `button`              | Button's (`type="button"`); `id` (unless it has one), `tabindex="-1"`, `aria-label` (`incrementLabel`, else "Increase"), `aria-labelledby` (itself and the label, with the default name only), `aria-controls` (the input), `aria-disabled` while it can't step (Resolved questions 5) | Optional. Out of the Tab order, as in the APG, React Aria and Zag: the arrow keys do the same. Still reachable by touch, voice control and a screen reader's browse mode.           |
| decrement   | `button`              | as increment, with `decrementLabel`                                                                                                                                                                                                                                                    | Optional.                                                                                                                                                                           |
| hiddenInput | `input type="hidden"` | the `value` property (the committed number, `''` when empty), `disabled` while the field is                                                                                                                                                                                            | Optional; the consumer puts `name` here (Resolved questions 4).                                                                                                                     |
| description | any                   | as Field                                                                                                                                                                                                                                                                               |                                                                                                                                                                                     |
| error       | any                   | as Field                                                                                                                                                                                                                                                                               |                                                                                                                                                                                     |

Changed on 2026-10-19 (owner): the box is now the `wrapper` part; the root is
the optional outermost element.

State attributes, as TextField's: `data-hovered` (the pointer is over the
input), `data-focused`, `data-focus-visible`, `data-disabled`, `data-readonly`,
`data-invalid` and `data-required` on the root, wrapper, label, input,
description and error. The buttons carry Button's own: `data-pressed`,
`data-hovered`, `data-focus-visible`, and `data-disabled` while they can't
step (at a bound, read-only or the field disabled).

Without `incrementLabel` and `decrementLabel`, the buttons are named
"Increase" and "Decrease" followed by the field's label, through
`aria-labelledby` pointing at the button itself and the label part (and
`labelledBy`), as React Aria does when its label isn't a string; without a
label part, just "Increase" and "Decrease". A name the consumer passes is the
button's whole name, as React Aria's `incrementAriaLabel` is, so a translation
can put the label anywhere (`Menge erhöhen`).

A part keeps an `id` the consumer gives its element, in both adapters, and
every reference to the part follows it; UniAria writes an `id` only on a
part that has none (root AGENTS.md → DOM, lifecycle and SSR).

## Props

| Prop             | Type                       | Default                     | Bindable | Change event  | Notes                                                                                                                                                              |
| ---------------- | -------------------------- | --------------------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| value            | `number \| null`           | `null`                      | yes      | `valueChange` | The committed number; `null` when empty (Resolved questions 3). Reported on commit and on each step, never per keystroke. See Value.                               |
| minValue         | `number \| undefined`      | —                           | no       | —             | Commits and steps stay at or above it. A minus sign can be typed only when it is unset or below 0.                                                                 |
| maxValue         | `number \| undefined`      | —                           | no       | —             | Commits and steps stay at or below it.                                                                                                                             |
| step             | `number \| undefined`      | —                           | no       | —             | When set, a commit snaps to it, counted from `minValue` (or 0). Steps move by it, else by 1, or 0.01 for `style: 'percent'` (1%).                                  |
| pageStep         | `number \| undefined`      | 10 steps                    | no       | —             | What PageUp and PageDown move by (Resolved questions 6).                                                                                                           |
| formatOptions    | `Intl.NumberFormatOptions` | `{}`                        | no       | —             | How the number is shown and read: `style` (`currency`, `percent`, `unit`), fraction digits, grouping, `signDisplay`, `currencySign`. Property only on the element. |
| locale           | `string \| undefined`      | the input's language        | no       | —             | A BCP 47 tag; without it, the input's `lang` (the nearest one), else the browser's language (Resolved questions 10).                                               |
| isWheelDisabled  | `boolean`                  | `false`                     | no       | —             | Turns off the wheel while focused (Resolved questions 7).                                                                                                          |
| isDisabled       | `boolean`                  | `false`                     | no       | —             | As TextField's; the buttons can't step and the hidden input is disabled, so the form leaves the value out, as a disabled native field.                             |
| isReadOnly       | `boolean`                  | `false`                     | no       | —             | As TextField's; no keys, wheel or buttons change it. Element attribute `readonly`.                                                                                 |
| isRequired       | `boolean`                  | `false`                     | no       | —             | Field's.                                                                                                                                                           |
| isInvalid        | `boolean`                  | `false`                     | no       | —             | Field's.                                                                                                                                                           |
| incrementLabel   | `string \| undefined`      | "Increase" and the label    | no       | —             | The increment button's whole name (Resolved questions 2).                                                                                                          |
| decrementLabel   | `string \| undefined`      | "Decrease" and the label    | no       | —             | The decrement button's whole name.                                                                                                                                 |
| roleDescription  | `string \| undefined`      | `'Number field'` in English | no       | —             | The input's `aria-roledescription`. Without it, none outside English, so a screen reader says its own role word (Resolved questions 1 and 2).                      |
| inputId          | `string \| undefined`      | generated                   | no       | —             | As TextField's.                                                                                                                                                    |
| labelElementType | `string`                   | `'label'`                   | no       | —             | As TextField's.                                                                                                                                                    |
| labelledBy       | `string \| undefined`      | —                           | no       | —             | As TextField's; also names the buttons.                                                                                                                            |
| describedBy      | `string \| undefined`      | —                           | no       | —             | As TextField's.                                                                                                                                                    |

## Events

| Event         | Detail           | When                                                                                                                                              |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valueChange` | `number \| null` | A commit or a step changed the value, or a form reset requests the default. Never for a value the consumer sets.                                  |
| `focusChange` | `boolean`        | The input gained or lost focus, as TextField's. In React the input's `onFocus`, `onBlur`, `onKeyDown`, `onInput` and `onPaste` belong to UniAria. |

## Public state

| Field          | Type             | Meaning                                                                            |
| -------------- | ---------------- | ---------------------------------------------------------------------------------- |
| value          | `number \| null` | The committed value.                                                               |
| canIncrement   | `boolean`        | A step up would change the value: not at the maximum, not read-only, not disabled. |
| canDecrement   | `boolean`        | The same, down.                                                                    |
| isFocused      | `boolean`        | As TextField's.                                                                    |
| isFocusVisible | `boolean`        | As TextField's.                                                                    |
| isHovered      | `boolean`        | As TextField's: the pointer is over the input.                                     |
| isDisabled     | `boolean`        | The prop.                                                                          |
| isReadOnly     | `boolean`        | The prop.                                                                          |
| isRequired     | `boolean`        | The prop.                                                                          |
| isInvalid      | `boolean`        | The prop.                                                                          |
| isErrorShown   | `boolean`        | Field's: invalid and not disabled.                                                 |

`canIncrement` and `canDecrement` follow the text as it is typed, as React
Aria's do: typing 100 with a maximum of 15 makes `canIncrement` false before
the text is committed.

## Value

The input shows text; the value is the number that text was last committed
as. They differ only while the user types.

### Typing

- **Each edit is checked before the browser applies it** (`beforeinput`), as
  React Aria, Zag and Spectrum Web Components do. An edit stays only if the
  text it leaves is a number in the making for the locale and format
  (`@internationalized/number`'s `isValidPartialNumber`): digits of one
  numbering system, the format's literals (a currency symbol, `%`, unit words)
  anywhere, group separators when grouping is on, one decimal separator unless
  the format allows no fraction digits, a minus sign at the start only when
  `minValue` is unset or below 0, and a plus sign only when the format shows
  one and `maxValue` is unset or above 0. Typing `1a` leaves `1`. Undo and redo
  are never refused.
- **IME composition** is checked when it ends, since Chromium doesn't let a
  composition be cancelled (crbug 1022204): text that isn't a number in the
  making is put back as it was before the composition started, as React Aria
  does.
- **Typing reports nothing.** `valueChange` waits for the commit. The buttons,
  the arrow keys and `canIncrement` work from the typed text.
- **A paste that replaces all the text** (or into an empty field) is committed
  at once, as React Aria does, so pasting `$1,234.50` into a currency field
  works even though its partial steps wouldn't. Other pastes are checked like
  typing.

### Commit

On blur, on Enter, and after a paste that replaced the text:

1. **Empty text:** the value becomes `null`.
2. **Text that isn't a number:** the text goes back to the committed value's,
   and nothing is reported.
3. **A number:** kept within `minValue` and `maxValue`; when `step` is set,
   moved to the nearest step counted from `minValue` (or 0), halfway rounding
   away from it, and never above the last step below `maxValue` (a maximum of
   21 with steps of 3 from 2 gives 20); then rounded to the precision the
   format shows (`maximumFractionDigits`, 3 by default for plain numbers), so
   the value is what the field displays.
4. The text is formatted again, and `valueChange` reports the value if it
   changed.

### Stepping

ArrowUp, ArrowDown, PageUp, PageDown, Home, End, the buttons and the wheel
step the value. Each step commits at once: the value, the text and
`valueChange` together.

- **From the typed text**, committed or not, as React Aria does.
- **From an empty field:** increment goes to `minValue`, decrement to
  `maxValue`, else both to 0.
- **From a value off the step:** to the next step in that direction (5 with
  steps of 5, from 2 up).
- **At a bound:** nothing; `canIncrement` or `canDecrement` is false and its
  button disabled. Home goes to `minValue`, End to the last step at or below
  `maxValue`; without that bound the key keeps its native meaning (Resolved
  questions 6).
- **Exact decimals:** steps add in decimal, so 0.1 + 0.2 shows 0.3.

### Controlled

- The text shows the consumer's value, formatted, and follows it when it
  changes, even while the field is focused.
- A commit or step reports `valueChange` and shows the consumer's value until
  it answers; a value the consumer doesn't take is replaced by its own on the
  next render, as React Aria does. The consumer's value is shown as it is,
  even off the step or out of range: React Aria clamps and snaps it for
  display without reporting, which leaves the state and the screen apart.
- **Out of range** (Resolved questions 11). A commit or a step always lands
  in range, so a value outside `minValue` and `maxValue` comes from the
  consumer: a controlled value, a `defaultValue`, or bounds that moved past
  it. The consumer, who owns both, marks it through `isInvalid`
  (`isInvalid: value !== null && value > maxValue`), which also shows, links
  and announces Field's error, so a screen reader hears why. Text the user
  hasn't edited is never committed, so focus leaving the field doesn't
  correct the consumer's value; a step moves it into range.

### Formatting and locale

- **`Intl.NumberFormat`** with the locale and `formatOptions`, through
  `@internationalized/number`, which also parses: currency symbols, codes and
  names, units, percent (`50%` is 0.5), accounting negatives in parentheses,
  and the Arabic, Devanagari, Bengali, Han and full-width digits. Text typed
  in another numbering system keeps it: Arabic digits typed in an English
  field stay Arabic after the commit.
- **The locale** is the `locale` prop, else the language of the input (its
  nearest `lang`), else `navigator.language` (Resolved questions 10). On the
  server, without a `locale`, the text is formatted for `en-US`, and the
  browser formats it again after hydration; a page rendered on the server
  passes `locale`.
- **A new locale or format** formats the text again. `formatOptions` are
  compared by value, so a new object with the same options changes nothing.
- The text stays formatted while focused; there is no raw editing mode.

### Forms

- **Submitting.** The hidden input part carries the committed value as a plain
  number (`1234.5`, `0.25` for 25%), or `''` when empty, and is disabled with
  the field (Resolved questions 4). Enter commits before the form submits; a
  press on a submit button blurs the input first, which commits.
- **Reset.** On the form's `reset` event (skipped when `defaultPrevented`) the
  value goes back to its default as TextField's does: an uncontrolled field
  follows `defaultValue` again (empty without one), and a controlled one asks
  for `defaultValue`, or without one the value it mounted with.
  `valueChange` reports it.
- **Before JavaScript** (the element): it takes the input's text, parsed for
  the locale, as `defaultValue`.

## Keyboard

On the input. A key whose default is already prevented is left alone, so a
consumer's handler that runs first can take a key over (UI Kit can't today:
React Aria runs before its handlers). Keys with modifiers keep their native
meaning (Shift+ArrowUp selects text). Nothing happens while composing text, or
while the field is read-only or disabled.

| Key                | Behavior                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| ArrowUp, ArrowDown | One step up or down; held, it repeats with the key. Prevented.                                                                                |
| PageUp, PageDown   | `pageStep` up or down, 10 steps by default (Resolved questions 6). Prevented.                                                                 |
| Home, End          | To `minValue` or to the last step at or below `maxValue`, when that bound is set; otherwise the caret moves, natively (Resolved questions 6). |
| Enter              | Commits, then the form submits as usual: not prevented, not stopped.                                                                          |
| Escape             | Nothing; it propagates (a dialog around it closes).                                                                                           |

On phones the input's `inputmode` picks a keyboard with what can be typed, as
React Aria and Spectrum Web Components do: on an iPhone, `text` when a minus
sign is allowed (its number keyboards have none), else `decimal` when the
format allows fraction digits, else `numeric`; on Android, `numeric` when a
minus sign is allowed, else `decimal` or `numeric` the same way; elsewhere
`numeric`. The server writes `numeric` or `decimal` and the browser adjusts it
for the phone after hydration.

## Pointer, touch and wheel

- **Buttons.** A press steps at once; held for 400 ms, it steps every 60 ms
  until released or at the bound. A touch press steps nothing at once, starts
  repeating after 600 ms, and steps once on release if it never repeated;
  scrolling away cancels it. React Aria's timings, which UI Kit has. A long
  touch on either button opens no context menu (React Aria blocks it on
  increment only).
- **Focus on a button press.** If the input has focus, it keeps it, so a
  phone's keyboard stays open. Otherwise a mouse press focuses the input, and a
  touch or screen-reader press focuses the button, so no keyboard opens and the
  reading position stays, as React Aria does.
- **A press on the wrapper** outside any control focuses the input, as
  TextField's.
- **Wheel**, while focus is in the field and the pointer over the input, unless
  `isWheelDisabled`, read-only or disabled: one step per event, up for a wheel
  turned up, as Chromium's own number input (Resolved questions 7). The page
  doesn't scroll meanwhile. A mostly horizontal scroll and a pinch zoom
  (Ctrl+wheel) are left alone.

## Announcements

The input is a text box, so a screen reader doesn't read a value that changes
under it. After a step (keys, buttons, wheel) and after a commit that changed
what was typed (clamped, snapped, rounded or formatted), NumberField announces
the new text through the live announcer, assertively, as React Aria does, with
a minus sign that VoiceOver reads as minus (U+2212). Typing announces nothing:
the screen reader already echoes it (Resolved questions 8).

## ARIA and state attributes per state

| State             | Part         | Attributes                                                                                                       |
| ----------------- | ------------ | ---------------------------------------------------------------------------------------------------------------- |
| idle              | input        | Field's `id`, `aria-labelledby`, `aria-describedby`; `type="text"`, `inputmode`, `aria-roledescription`; `value` |
|                   | increment    | `type="button"`, `tabindex="-1"`, `aria-label`, `aria-labelledby`, `aria-controls`                               |
|                   | hiddenInput  | `value` (the number, or `''`)                                                                                    |
| at the maximum    | increment    | + `aria-disabled="true"`, `data-disabled`                                                                        |
| at the minimum    | decrement    | + `aria-disabled="true"`, `data-disabled`                                                                        |
| hovered           | field parts  | + `data-hovered`                                                                                                 |
| focused           | field parts  | + `data-focused`; + `data-focus-visible` after keyboard or virtual focus                                         |
| read-only         | input        | + `readonly`                                                                                                     |
|                   | field parts  | + `data-readonly`                                                                                                |
|                   | both buttons | + `aria-disabled="true"`, `data-disabled`                                                                        |
| disabled          | input        | + `disabled`                                                                                                     |
|                   | field parts  | + `data-disabled`; the error hidden (Field)                                                                      |
|                   | both buttons | + `aria-disabled="true"`, `data-disabled`                                                                        |
|                   | hiddenInput  | + `disabled`                                                                                                     |
| invalid, required | as Field     | `aria-invalid="true"`, `aria-required="true"`, `data-invalid`, `data-required`                                   |
| on iOS            | input        | − `aria-roledescription`, so VoiceOver reads the required state (React Aria)                                     |
| another language  | input        | − `aria-roledescription` unless `roleDescription` is passed (Resolved questions 2)                               |

The input gets no `aria-valuenow`, `aria-valuemin`, `aria-valuemax` or
`aria-valuetext`: they belong to the spinbutton role (Resolved questions 1).

## Focus

Focus stays on the input. NumberField moves it only for a press on the wrapper
(to the input) and a button press when the input isn't focused (Pointer, touch
and wheel). The buttons are out of the Tab order.

## Styling tokens

UniAria is not a styling library: the consumer's CSS comes separately and binds
to these tokens. UniAria sets no look.

| Token                                                                                                                   | On                                              | Meaning                                                    |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| `data-uni="number-field"`                                                                                               | root                                            | The root part.                                             |
| `data-element`                                                                                                          | every other part                                | Which part an element is.                                  |
| `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`, `data-readonly`, `data-invalid`, `data-required` | root, wrapper, label, input, description, error | The field's state, as TextField's.                         |
| `data-pressed`, `data-hovered`, `data-focus-visible`, `data-disabled`                                                   | increment, decrement                            | Button's own; `data-disabled` while the button can't step. |
| `value`, `canIncrement`, `canDecrement`, `isFocused`, `isFocusVisible`, `isHovered`, `isInvalid`, …                     | public state (`useBehaviorState`)               | The same, for a framework's own bindings.                  |

## Expected spoken output

Probed with `@guidepup/virtual-screen-reader` for a `label` "Quantity" and the
input as decided (a text box with the role description "Number field"); the
scenarios confirm them in both engines.

| State                                            | Spoken phrase                                              |
| ------------------------------------------------ | ---------------------------------------------------------- |
| empty                                            | `Number field, Quantity`                                   |
| 1024 in `en-US`                                  | `Number field, Quantity, 1,024`                            |
| 12.5 as euros, label "Price"                     | `Number field, Price, €12.50`                              |
| read-only                                        | `Number field, Quantity, 5, read only`                     |
| disabled                                         | `Number field, Quantity, 5, disabled`                      |
| invalid and required, with an error "At most 10" | `Number field, Quantity, 5, At most 10, invalid, required` |
| 5 with `lang="de"`, label "Menge"                | `textbox, Menge, 5`                                        |
| the increment button, browsing                   | `button, Increase Quantity, 1 control`                     |
| at the maximum, browsing                         | `button, Increase Quantity, 1 control, disabled`           |
| after ArrowUp from 5 (live announcer)            | `assertive: 6`                                             |

A spinbutton instead (Resolved questions 1) reads `spinbutton, Quantity, max
value 10, min value 0, 1024`: the number in `aria-valuenow`, not the text, so a
formatted value needs `aria-valuetext` (`spinbutton, Price, current value
€12.50`).

## Adapter surface

```tsx
// React
const quantity = useBehavior(numberField, {
  minValue: 0,
  maxValue: 99,
  locale,
  onValueChange,
});
return (
  <div {...quantity.parts.root}>
    <label {...quantity.parts.label}>Quantity</label>
    <div {...quantity.parts.wrapper}>
      <input {...quantity.parts.input} />
      <button {...quantity.parts.decrement}>−</button>
      <button {...quantity.parts.increment}>+</button>
    </div>
    <input {...quantity.parts.hiddenInput} name="quantity" />
    <p {...quantity.parts.error}>Order at most 99</p>
  </div>
);
```

```html
<!-- Custom element -->
<uni-number-field min-value="0" max-value="99" lang="de">
  <div data-uni="number-field">
    <label data-element="Label">Menge</label>
    <div data-element="Wrapper">
      <input data-element="Input" value="5" />
      <button data-element="Decrement">−</button>
      <button data-element="Increment">+</button>
    </div>
    <input type="hidden" data-element="HiddenInput" name="quantity" />
  </div>
</uni-number-field>
```

Element attributes: `default-value`, `min-value`, `max-value`, `step`,
`page-step`, `locale`, `wheel-disabled`, `disabled`, `readonly`, `required`,
`invalid`, `increment-label`, `decrement-label`, `role-description`,
`labelled-by`, `described-by`. Properties: those by prop name, `formatOptions`
and `value` (controlled). Events: `valuechange`, `focuschange`.

## Mapping from Cube UI Kit

NumberField backs NumberInput.

- `value` and `defaultValue` (numbers, `NaN` when empty) map to `value` and
  `defaultValue` with `null` for empty; UI Kit converts `NaN` at its boundary.
  This fixes UI Kit's `null` turning the field uncontrolled
  (`castNullableNumberValue` maps it to `undefined`).
- `onChange(number)` maps to `onValueChange`, at the same moments: commits and
  steps.
- `minValue`, `maxValue`, `step`, `formatOptions` and `isWheelDisabled` keep
  their names. `incrementAriaLabel` and `decrementAriaLabel` become
  `incrementLabel` and `decrementLabel`, whole names in both. UI Kit passes
  its translated names there, and its role description as
  `roleDescription`.
- The locale from `useLocale()` (UI Kit's i18next language) is passed as
  `locale`.
- `commitBehavior` goes: UI Kit never sets it (Resolved questions 11).
- `hideStepper` is not rendering the button parts.
- `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid` (after UI Kit resolves
  `validationState`), `label`, `description` and `errorMessage` map as in
  TextField's spec; `id` maps to `inputId`.
- Its key handlers chain with the input part's. Enter no longer stops
  propagating, and a handler can take a key over by preventing it first.
- The `inputMode` override through `inputProps` goes: UniAria owns
  `inputmode`.
- **Fixes.** Descriptions and errors become linked (Field). A plain form
  submission gets the number through the hidden input, where today it gets
  nothing. UI Kit's own "Step up" and "Step down" translations, which React
  Aria's labels override today, can become `incrementLabel` and
  `decrementLabel`. A stepper press inside a popover no longer closes it (UI
  Kit's Button dismisses its popover on press).

## Differences from React Aria, Zag and native behavior

UI Kit's NumberInput is React Aria's, so its column is React Aria's unless
noted. Each row was decided with the resolved questions.

| #   | Topic                                           | Cube UI Kit and React Aria                                             | APG, Zag, Lion, Spectrum Web Components, native                                                            | Decided                                                                            |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | The input's role                                | Text box with `aria-roledescription` "Number field", none on iOS       | APG, Zag, Lion: `spinbutton` with `aria-valuenow`; SWC: plain text box; native `type="number"`: spinbutton | React Aria's (Q1)                                                                  |
| 2   | Group around input and buttons                  | `role="group"` with `aria-disabled`, `aria-invalid`                    | Zag: `role="group"`; APG quantity: none                                                                    | No role (Q1)                                                                       |
| 3   | Strings                                         | 34 locales built in; UI Kit's own labels unused                        | Zag: English, overridable; Lion: translated                                                                | English defaults; a passed name is whole; no role description outside English (Q2) |
| 4   | Empty                                           | `NaN`; UI Kit's `null` makes it uncontrolled                           | Zag: `''`; Lion: 0                                                                                         | `null` (Q3)                                                                        |
| 5   | Form submission                                 | UI Kit: nothing; React Aria Components: a hidden input with the number | Zag, Lion: `name` on the visible input, so the text                                                        | A hidden input part with the number (Q4)                                           |
| 6   | Buttons at a bound                              | Native `disabled` (focus falls to the body on touch)                   | APG: `aria-disabled`; Zag: `disabled`; Lion: `disabled`, focus moved to the input                          | `aria-disabled`, still focusable (Q5)                                              |
| 7   | PageUp, PageDown                                | One step                                                               | APG: optional larger step; Zag, Lion, SWC, native: nothing                                                 | `pageStep`, 10 steps (Q6)                                                          |
| 8   | Home, End without that bound                    | Prevented, nothing happens                                             | APG: only with a bound; native: the caret moves                                                            | The caret moves (Q6)                                                               |
| 9   | Wheel                                           | On while focused; a wheel turned down increments                       | Zag: opt-in; Chromium's number input: on while focused, up increments; WebKit, Firefox: off (probed)       | On while focused, up increments (Q7)                                               |
| 10  | Announcements                                   | Every change of the text while focused, typing included                | APG: button presses only (the spinbutton role reads the rest); Lion: a live output                         | Steps and corrected commits, not typing (Q8)                                       |
| 11  | Out of range when committed                     | Clamped and snapped; `commitBehavior: 'validate'` keeps it             | Zag: clamped on blur, no snapping; APG: `aria-invalid` while out of range                                  | Clamped and snapped (Q11)                                                          |
| 12  | A consumer's value off the step or out of range | Shown clamped and snapped, not reported                                | APG: `aria-invalid`                                                                                        | Shown as given; the consumer's `isInvalid` marks it (Q11)                          |
| 13  | Shift with arrows                               | Not intercepted (selects text)                                         | Zag, SWC: 10 steps                                                                                         | Not intercepted                                                                    |
| 14  | Enter                                           | Commits; UI Kit stops its propagation                                  | —                                                                                                          | Commits; never stopped                                                             |
| 15  | Holding a button                                | 400 ms, then every 60 ms; touch 600 ms                                 | Zag: 300 ms, 50 ms; SWC: 400 ms, every 5 frames                                                            | React Aria's                                                                       |
| 16  | Locale                                          | React Aria's `I18nProvider` (UI Kit: i18next)                          | SWC: `lang`, then `<html lang>`, then the browser's                                                        | Prop, else the input's `lang`, else the browser's (Q10)                            |

## Deviations from the WAI-ARIA pattern

The input is a text box with a role description, not a `spinbutton`
(Resolved questions 1). React Aria found that VoiceOver can't edit a
spinbutton's text ("we can't focus a spin button with VO"), and a text box
reads the formatted text without `aria-valuetext`. The APG's keys and buttons
stay; only the role differs. The APG's `aria-invalid` for a value out of range
comes from the consumer's `isInvalid` (Resolved questions 11).

## Resolved questions

Decided by @tenphi on 2026-10-17, each as recommended.

1. **The input's role.** (a) A text box with `aria-roledescription` (the
   `roleDescription` prop, "Number field"), left off on iOS so VoiceOver reads
   the required state, and no `aria-value*`: React Aria and UI Kit, read as
   `Number field, Quantity, 1,024`. (b) `role="spinbutton"` with
   `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext` (the
   formatted text): the APG, Zag and Lion, read as
   `spinbutton, Price, current value €12.50`. A screen reader reports a focused
   spinbutton's value changes itself (the APG's example announces only button
   presses for that reason), but React Aria found VoiceOver can't edit its
   text. With either, the root gets no `role="group"`: an unnamed group adds
   nothing a screen reader reads.
   Decided: (a), a deviation from the APG.
2. **Strings.** The button names and the role description are props with
   English defaults (`incrementLabel` "Increase", `decrementLabel` "Decrease",
   `roleDescription` "Number field"), and the field's label joins the button
   names by reference, so no string is formatted. React Aria ships 34
   locales; UI Kit has its own i18next strings to pass. Decided: props, no
   locale tables in UniAria. The owner then asked for English defaults
   extendable from outside, and whether translations are needed at all. The
   buttons need names (WCAG 4.1.2), which English gives; the role
   description is optional, and an English one replaces the screen reader's
   own localized role word. React Aria's names are templates
   (`{fieldLabel} erhöhen`), and its `incrementAriaLabel` is the whole name.
   Decided (same day): a passed `incrementLabel` or `decrementLabel` is the
   whole name, so a translation orders it freely, and only the English
   default is followed by the label by reference; `roleDescription` defaults
   to "Number field" in English and to none in other languages. A page-wide
   way to register strings waits for a library-wide design.
3. **Empty is `null`**, not `NaN`: `value: number | null`, `valueChange(null)`
   when cleared. `null` survives JSON and can't be mistaken for a number; UI
   Kit converts at its boundary. Decided: `null`.
4. **What a form submits.** An optional `hiddenInput` part
   (`<input type="hidden" name>`) that carries the committed number as plain
   digits (`1234.5`), `''` when empty, disabled with the field, as React Aria
   Components' hidden input. The visible input carries no `name`, so the
   formatted text isn't submitted. Decided: yes, named `hiddenInput`.
5. **Buttons at a bound.** `aria-disabled` through Button's
   `isFocusableWhenDisabled`, as the APG's quantity example: a touch or
   screen-reader user who pressed increment up to the maximum keeps focus on
   the button and hears it dimmed. React Aria and UI Kit use native
   `disabled`, which drops focus to the body there. Decided:
   `aria-disabled`.
6. **PageUp, PageDown, Home and End.** PageUp and PageDown move by `pageStep`,
   10 steps by default (the APG's optional larger step; React Aria and UI Kit
   move one step). Home and End go to a bound only when it is set, and
   otherwise move the caret, as in any text box (React Aria prevents them
   always, so the caret can't jump). Decided: both.
7. **The wheel.** On while the field is focused and the pointer over the
   input, unless `isWheelDisabled`, as UI Kit and React Aria; a wheel turned up
   increments, as Chromium's number input (probed), where React Aria
   increments on a wheel turned down. WebKit and Firefox don't step a number
   input on the wheel at all (probed), and Zag's is opt-in. Decided: on by
   default, up increments.
8. **What is announced.** The new text after a step and after a commit that
   changed what was typed, assertively. React Aria also announces each
   keystroke that changes the number, which a screen reader already echoes.
   Decided: steps and corrected commits only.
9. **The dependency.** `@internationalized/number` (^3.6.8, 1.7 kB with
   Brotli, depends only on `@swc/helpers`) is listed in AGENTS.md's approved
   runtime dependencies for NumberField. Decided: add it to `@uniaria/core`.
10. **Where the locale comes from.** The `locale` prop; without it, the
    input's language (its nearest `lang` attribute), then
    `navigator.language`, as Spectrum Web Components does. A page rendered on
    the server passes `locale`, or the text is formatted for `en-US` until
    hydration. Decided: as described.
11. **One commit behavior.** Commits clamp and snap. React Aria's
    `commitBehavior: 'validate'` (keep an out-of-range value and report it
    through native validation messages) is left out: UI Kit never uses it, and
    Field's `isInvalid` is how UniAria shows errors. Decided: snap only. The
    owner then asked whether values out of range need handling in UniAria:
    they only come from the consumer, who can mark them with `isInvalid` and
    an error that says why, where UniAria's own `aria-invalid` would say
    "invalid" without a reason and disagree with Field. Decided (same day):
    the consumer's (Value, Controlled).

## Open questions

None.
