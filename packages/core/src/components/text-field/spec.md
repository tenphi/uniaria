# TextField spec

Status: approved by @tenphi on 2026-10-15

## Summary

A text field is a native `<input>` or `<textarea>` with a label, a
description and an error message. TextField composes Field for the labelling
(`ctx.use(field, props, { parts: { control: 'input' } })`) and adds the value,
read-only mode and interaction state. The browser keeps doing the editing:
typing, selection, IME, autofill, undo, Enter submitting the form from an
`<input>` and adding a line in a `<textarea>`.

The name follows React Aria (TextField, NumberField, SearchField): Field plus a
text control is `<Name>Field`, and the control part keeps the element's name,
`input`.

- **WAI-ARIA pattern:** none; a native text control needs none. Labelling
  follows Field and the APG practice on names and descriptions.
- **Builds on:** Field (`ctx.use`), `hover` and `focus` from `dom/`, and a new
  part-prop channel for live DOM properties (Resolved questions 1).
- **Owner:** none.
- **Tooltip:** takes a Tooltip through its `tooltip` link (Tooltip spec, Resolved
  questions 2): the tooltip instance in React (`tooltip: hint.instance`),
  and on elements the `<uni-tooltip>` it sits in directly or a `tooltip`
  attribute naming one's id. Hover, focus and keys all count on the
  input, so typing closes the tooltip, and the input carries its id
  after its own references.
- **Custom element:** yes, `<uni-text-field>`, hosting consumer markup.

Not part of TextField:

- **Validation.** As in Field: TextField shows `isInvalid`, the form decides
  it. No native `required`, `setCustomValidity` or `invalid` handling. Native
  attributes the consumer writes (`pattern`, `maxlength`) keep their native
  effects.
- **Formatting, masking and filtering keystrokes.** NumberField will veto
  edits in `beforeinput`, as React Aria's formatted fields do; TextField
  accepts every edit.
- **Clear buttons, password visibility and search keys.** SearchField
  (Escape clears, Enter submits, a clear button) and a password toggle can
  come later on top of TextField. Until then Cube UI Kit's SearchInput and
  PasswordInput keep their own buttons and keys around a TextField.
- **Auto-sizing a textarea.** Cube UI Kit's TextArea `autoSize` measures an
  off-screen mirror; CSS `field-sizing: content` is not Baseline yet. It can
  come later as a TextField option (Resolved questions 2).
- **Presentation.** Prefix, suffix, icons, the validation and loading
  indicators and sizes are consumer markup inside the wrapper.

## Anatomy

| Part        | Element               | Attributes UniAria owns                                                                                                                                                                   | Notes                                                                                                                                                                                                               |
| ----------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root        | any; usually `div`    | state attributes                                                                                                                                                                          | Optional. The outermost element, around the label, the wrapper, the description and the error. No role.                                                                                                             |
| wrapper     | any; usually `div`    | state attributes                                                                                                                                                                          | Optional. Where a design system draws the box around the input, its prefix and suffix. No role. A press on it outside any control focuses the input (Resolved questions 4).                                         |
| label       | `label` by default    | as Field: `id` (unless it has one), `for`, state attributes                                                                                                                               |                                                                                                                                                                                                                     |
| input       | `input` or `textarea` | as Field's control: `id` (unless it has one), `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`; plus `disabled`, `readonly`, the `value` property, state attributes | The consumer owns `name`, `type`, `placeholder`, `autocomplete`, `inputmode`, `maxlength`, `minlength`, `pattern`, `autofocus`, `spellcheck`, `enterkeyhint`, `form`, `rows`, `tabindex` and the `value` attribute. |
| description | any                   | as Field                                                                                                                                                                                  |                                                                                                                                                                                                                     |
| error       | any                   | as Field                                                                                                                                                                                  |                                                                                                                                                                                                                     |

Changed on 2026-10-19 (owner): the box is now the `wrapper` part; the root is
the optional outermost element.

State attributes go on every part, as Field's do, so the box, the label and
the messages can be styled without reading state: `data-hovered`,
`data-focused`, `data-focus-visible`, `data-disabled`, `data-readonly`,
`data-invalid` and `data-required`.

TextField writes nothing that differs between `<input>` and `<textarea>`, so
it needs no `elementType`: the input part is whichever the consumer renders.

A part keeps an `id` the consumer gives its element, in both adapters, and
every reference to the part follows it; UniAria writes an `id` only on a
part that has none (root AGENTS.md → DOM, lifecycle and SSR).

## Props

| Prop             | Type                  | Default   | Bindable | Change event  | Notes                                                                                                   |
| ---------------- | --------------------- | --------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| value            | `string`              | `''`      | yes      | `valueChange` | Reported on every `input` event, IME composition included. See Value.                                   |
| isDisabled       | `boolean`             | `false`   | no       | —             | Native `disabled` on the input, plus Field's `isDisabled` (marks every part, hides the error).          |
| isReadOnly       | `boolean`             | `false`   | no       | —             | Native `readonly`: focusable, selectable, not editable, read "read only". Element attribute `readonly`. |
| isRequired       | `boolean`             | `false`   | no       | —             | Field's: `aria-required`, never native `required`.                                                      |
| isInvalid        | `boolean`             | `false`   | no       | —             | Field's: `aria-invalid`, shows and announces the error.                                                 |
| inputId          | `string \| undefined` | generated | no       | —             | Field's `controlId`: the input's `id` where the input has none of its own.                              |
| labelElementType | `string`              | `'label'` | no       | —             | Field's. The element reads the label's tag.                                                             |
| labelledBy       | `string \| undefined` | —         | no       | —             | Field's.                                                                                                |
| describedBy      | `string \| undefined` | —         | no       | —             | Field's.                                                                                                |

## Events

| Event         | Detail    | When                                                                                                                                            |
| ------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `valueChange` | `string`  | The user changed the value (every `input` event), or a form reset requests the default. Never for a value the consumer sets.                    |
| `focusChange` | `boolean` | The input gained or lost focus. Cube UI Kit's form validates on blur. In React the input's `onFocus`, `onBlur` and `onInput` belong to UniAria. |

## Public state

| Field          | Type      | Meaning                                                                   |
| -------------- | --------- | ------------------------------------------------------------------------- |
| value          | `string`  | The current value.                                                        |
| isFocused      | `boolean` | The input has focus.                                                      |
| isFocusVisible | `boolean` | Focus arrived by keyboard or assistive technology; typing doesn't set it. |
| isHovered      | `boolean` | A mouse or pen is over the input (not the wrapper), as in Cube UI Kit.    |
| isDisabled     | `boolean` | The prop.                                                                 |
| isReadOnly     | `boolean` | The prop.                                                                 |
| isRequired     | `boolean` | The prop.                                                                 |
| isInvalid      | `boolean` | The prop.                                                                 |
| isErrorShown   | `boolean` | Field's: invalid and not disabled.                                        |

## Value

The input's text lives in its `value` property, which no attribute controls
once the user has typed. TextField writes it through the new live-property
channel (Resolved questions 1): the binder sets `value` only when it differs
from the element, so the caret stays put while the two agree. React renders it
once as `defaultValue` from the first render, so server HTML shows the value
and React never controls the input.

- **Uncontrolled.** Each `input` event stores the element's value and reports
  `valueChange`. Nothing is written back.
- **Controlled.** Each `input` event reports `valueChange` and keeps the
  typed text on screen while the consumer answers. When `value` changes:
  - to a value TextField reported and is still waiting to see, it is the
    consumer's echo, and the input, already showing it, is left alone;
  - to anything else (a transform such as uppercasing, or a value set from
    outside), it is written to the input at once, which moves the caret to
    the end, as in React.
  - A value the consumer never accepts is put back when the input loses
    focus. This is Cube UI Kit's buffered value (`isBuffered`, its default),
    which keeps keystrokes and the caret when a form store echoes late. React
    and React Aria put it back right after the keystroke instead (Resolved
    questions 3).
- **IME composition.** `valueChange` reports composition text, as React Aria,
  Lion and Cube UI Kit do. TextField never writes the value while composing,
  which would break the IME; a write that arrives then waits for
  `compositionend`.
- **Form reset.** On the form's `reset` event (skipped when
  `defaultPrevented`, as React Aria and Zag do) the field goes back to its
  default, as a native field goes back to its `value` attribute: the
  `defaultValue` it has then, one set after mount included. An uncontrolled
  field follows `defaultValue` again until the next edit (`''` without one)
  and reports `valueChange` if its value changes. A controlled one reports
  `valueChange` with `defaultValue`, or without one the value it mounted
  with, as in React Aria, and keeps its value until the consumer accepts. The
  native reset runs after the event and puts back the `value` attribute, so
  TextField writes its value again afterwards. Cube UI Kit's Form cancels the
  native reset and resets its own fields.
- **Before JavaScript.** The element adopts the input's current `value` as
  `defaultValue` on upgrade: the markup's value, or what the user typed
  before the script loaded (Resolved questions 5).

## Keyboard

TextField handles no keys. The input keeps native editing; Enter in an
`<input>` submits its form, Enter in a `<textarea>` adds a line, and Escape
propagates (a dialog around it closes).

## ARIA and state attributes per state

| State             | Part       | Attributes                                                                     |
| ----------------- | ---------- | ------------------------------------------------------------------------------ |
| idle              | input      | Field's `id`, `aria-labelledby`, `aria-describedby`; `value` property          |
| hovered           | every part | + `data-hovered`                                                               |
| focused           | every part | + `data-focused`; + `data-focus-visible` after keyboard or virtual focus       |
| disabled          | input      | + `disabled`                                                                   |
|                   | every part | + `data-disabled`; the error hidden (Field)                                    |
| read-only         | input      | + `readonly`                                                                   |
|                   | every part | + `data-readonly`                                                              |
| invalid, required | as Field   | `aria-invalid="true"`, `aria-required="true"`, `data-invalid`, `data-required` |

## Focus

TextField moves focus only for a press on the wrapper outside the input and
any other control (a prefix icon, the box's padding): the press focuses the
input, since Cube UI Kit's box already shows a text cursor there (Resolved
questions 4).
A click on the label focuses the input natively. Hovering and focusing report
on every part, so the box can show the focus ring.

## Pointer and touch

None beyond the wrapper press above.

## Expected spoken output

Confirmed with `@guidepup/virtual-screen-reader` on a `label` "Email" and an
`input`; Field's spec covers description, error, invalid and required.

| State                                  | Spoken phrase                                 |
| -------------------------------------- | --------------------------------------------- |
| empty                                  | `textbox, Email`                              |
| with a value                           | `textbox, Email, jane@example.com`            |
| empty, `placeholder="you@example.com"` | `textbox, Email, placeholder you@example.com` |
| with a value and a placeholder         | `textbox, Email, jane@example.com`            |
| read-only with a value                 | `textbox, Email, jane@example.com, read only` |
| disabled                               | `textbox, Email, disabled` (not focusable)    |
| `<textarea>`                           | `textbox, Email`                              |
| `type="search"`                        | `searchbox, Email`                            |

The phrase reads the live `value` property. The root and the wrapper add
nothing when the input gets focus.

## Adapter surface

```tsx
// React
const email = useComponent(textField, { isRequired: true, onValueChange });
return (
  <div {...email.parts.root}>
    <label {...email.parts.label}>Email</label>
    <div {...email.parts.wrapper}>
      <input {...email.parts.input} name="email" type="email" />
    </div>
    <p {...email.parts.description}>We never share it</p>
    <p {...email.parts.error}>Enter a valid email</p>
  </div>
);
```

```html
<!-- Custom element -->
<uni-text-field required>
  <div data-uni="text-field">
    <label data-element="Label">Email</label>
    <div data-element="Wrapper">
      <input
        data-element="Input"
        name="email"
        type="email"
        value="jane@example.com"
      />
    </div>
    <p data-element="Error" hidden>Enter a valid email</p>
  </div>
</uni-text-field>
```

Element attributes: `default-value`, `disabled`, `readonly`, `required`,
`invalid`, `labelled-by`, `described-by`. Properties: `value` (controlled),
`defaultValue`. Events: `valuechange`, `focuschange`.

## Mapping from Cube UI Kit

TextField backs TextInput, TextArea (`multiLine` or the TextArea component),
and the input inside PasswordInput and SearchInput, which keep their own
toggle, clear button and keys until UniAria has them.

- `value`, `defaultValue` and `onChange(value)` map to `value`,
  `defaultValue` and `onValueChange`. Casting `null` and non-strings stays in
  UI Kit.
- `isBuffered` (default `true`) is TextField's controlled behavior; see Resolved
  questions 3 for `isBuffered={false}`.
- `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid` (after UI Kit
  resolves `validationState`), `label`, `description` and `errorMessage` map
  as in Field's spec. `id` maps to `inputId`.
- `onBlur` for the form maps to `focusChange(false)`. UI Kit passes its own
  `onFocus`, `onBlur` and key handlers with event objects by chaining them
  with the input part's handlers.
- `hovered` and `focused` mods map to `data-hovered` and `data-focused`;
  UI Kit puts them on the wrapper and the input, TextField on every part.
- Native attributes (`type`, `name`, `placeholder`, `autoComplete`,
  `maxLength`, `minLength`, `pattern`, `inputMode`, `autoFocus`, `rows`) are
  the consumer's attributes on the input.
- `prefix`, `suffix`, `icon`, `actions`, `isLoading`, `size`,
  `data-autofocus` and the validation indicator stay in UI Kit.
- **Fixes.** Descriptions and errors become linked (Field). A click on the
  box's padding focuses the input. Props UI Kit spreads after its merged
  input props (`maxLength`, `disabled`, `autoFocus`) can no longer clobber
  the consumer's, because the consumer owns those attributes.

## Deviations from the WAI-ARIA pattern

None; there is no pattern. Field's deviation (errors in `aria-describedby`,
not `aria-errormessage`) applies.

## Resolved questions

Decided by @tenphi on 2026-10-15.

1. **Live DOM properties in part props.** `connect()` can return DOM
   properties for a part next to `attrs`: an input's `value`, and later a
   checkbox's `checked` and `indeterminate`, which have no attribute that
   holds them. The binder sets each when it differs from the element; React
   renders them once as defaults (`defaultValue`, `defaultChecked`). This
   changes the runtime contract (part props).

2. **TextArea folds into TextField**, as in React Aria: the input part can be
   a `<textarea>`, and the first scope's TextArea is TextField. Auto-sizing
   comes later as a TextField option, when Cube UI Kit's TextArea moves.
   NumberInput becomes NumberField.
3. **Controlled typing is buffered only**, as Cube UI Kit's default: the
   typed text stays while the consumer answers, late echoes are recognised, a
   transformed or outside value wins at once, and a refused value is put back
   on blur. There is no prop for putting it back after each keystroke;
   filtering keystrokes belongs to `beforeinput` (NumberField). Cube UI Kit's
   `isBuffered={false}` keeps the typed text until blur too.
4. **A press on the root focuses the input**, outside the input and any other
   control. Since 2026-10-19 (owner) that is the `wrapper` part.
5. **Elements adopt a live value into a default.** `adopt` can read a part's
   DOM property and seed a bindable's `default<Key>`: `<uni-text-field>`
   reads the input's `value` property into `defaultValue` on upgrade, so the
   markup's value, or text typed before upgrade, isn't wiped. This changes
   the custom-element contract.

## Open questions

None.
