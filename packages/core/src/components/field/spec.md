# Field spec

Status: approved by @tenphi on 2026-10-15

## Summary

A field gives a form control its label, description and error message, and
wires them together with ids and ARIA, so a screen reader announces the
label, the description, the error and the required and invalid states when
the control gets focus. Field renders no control of its own. Its `control`
part goes on any control: a native `<input>`, `<textarea>` or `<select>`, or
a custom widget. The UniAria inputs (TextInput, TextArea, Checkbox, NumberInput,
Select and so on) compose Field with `ctx.use()` and put the `control` part on
their own element.

Field shows validation state; it doesn't validate. Whether a field is invalid,
and when that changes, is the form's business (in Cube UI Kit, its form
engine), so Field takes `isInvalid` as a prop.

- **WAI-ARIA pattern:** none. Field follows the APG practice on
  [names and descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
  (`references/aria-practices/content/practices/names-and-descriptions/names-and-descriptions-practice.html`).
- **Builds on:** the runtime only. UniAria inputs build on Field with
  `ctx.use(field, props, { parts: { control: 'input' } })`.
- **Owner:** none (see Resolved questions 1).
- **Custom element:** yes. `<uni-field>` hosts consumer markup with the
  parts around any control, including a native one.

Not part of Field:

- **Validation.** No rules, no constraint validation (`setCustomValidity`,
  the `invalid` event), no display timing and no focusing the first invalid
  field on submit. React Aria's native validation does these; Cube UI Kit's
  form engine does its own. A later Form component can take them on.
- **Disabling the control.** `isDisabled` marks the field's parts and hides
  the error, but the control is disabled by its own component (TextInput and
  the rest pass it on), or by the consumer for a native control.
- **Group messages on child controls.** A checkbox group's description and
  error reaching each checkbox belong to CheckboxGroup.
- **Presentation.** The required mark, an "(optional)" note, label position,
  tooltips and a success state stay in the design system.
- **`aria-errormessage`.** VoiceOver and NVDA don't support it, so React Aria,
  Lion and Spectrum Web Components all link errors with `aria-describedby`.
  The virtual screen reader only counts error messages
  (`1 error message`) and never reads them. The APG's one error example
  uses it (see Deviations).

## Anatomy

All parts are optional; a part counts once its element is rendered (see
Linking).

| Part        | Element                                                        | Attributes UniAria owns                                                                        | Notes                                                                                                                                                   |
| ----------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root        | any; usually `div`                                             | `data-scope="field"`, `data-part="root"`, `data-invalid`, `data-required`, `data-disabled`     | Optional wrapper for styling. No role.                                                                                                                  |
| label       | `label` by default; any element through `labelElementType`     | `id`, `for` (only on a `label`), state attributes                                              | The consumer owns the content. A required mark such as `*` must be `aria-hidden`: the control announces "required".                                     |
| control     | any control: `input`, `textarea`, `select`, or a custom widget | `id`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`, state attributes | The consumer, or the UniAria input composing Field, owns everything else: `name`, `type`, `value`, `disabled`, `readonly`, the role of a custom widget. |
| description | any                                                            | `id`, state attributes                                                                         |                                                                                                                                                         |
| error       | any                                                            | `id`, `hidden` while the error is not shown, state attributes                                  | Shown while `isInvalid` and not `isDisabled`. The consumer owns the content.                                                                            |

State attributes are `data-invalid`, `data-required` and `data-disabled`,
written on every part, so a design system can style the label, the control
and the messages without reading state.

## Props

| Prop             | Type                  | Default   | Bindable | Change event | Notes                                                                                                                                                                            |
| ---------------- | --------------------- | --------- | -------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| isInvalid        | `boolean`             | `false`   | no       | —            | `aria-invalid="true"` on the control, removed when false (never `"false"`: it reads "not invalid"). Shows and links the error.                                                   |
| isRequired       | `boolean`             | `false`   | no       | —            | `aria-required="true"` on the control, removed when false. Never the native `required`, which would start the browser's own validation.                                          |
| isDisabled       | `boolean`             | `false`   | no       | —            | `data-disabled` on every part, and hides the error, as Cube UI Kit does. It doesn't disable the control (see Summary).                                                           |
| controlId        | `string \| undefined` | generated | no       | —            | The control's `id`. Cube UI Kit derives it from the form field's name. The element adopts the control's `id` attribute on upgrade.                                               |
| labelElementType | `string`              | `'label'` | no       | —            | `for` goes on the label only when it is a `label`. Components whose control can't be labelled natively (a group, a listbox) pass another tag. The element reads the label's tag. |
| labelledBy       | `string \| undefined` | —         | no       | —            | More ids for the control's `aria-labelledby`, after the label.                                                                                                                   |
| describedBy      | `string \| undefined` | —         | no       | —            | More ids for the control's `aria-describedby`, after Field's own: a tooltip, or a hint outside the field.                                                                        |

Field has no events.

## Public state

| Field        | Type      | Meaning                                       |
| ------------ | --------- | --------------------------------------------- |
| isInvalid    | `boolean` | The `isInvalid` prop.                         |
| isRequired   | `boolean` | The `isRequired` prop.                        |
| isDisabled   | `boolean` | The `isDisabled` prop.                        |
| isErrorShown | `boolean` | The error is shown: invalid and not disabled. |

## Linking

- **Label.** The label gets an `id`, and `for` pointing at the control when
  it is a `label`. The control gets `aria-labelledby` with the label's id,
  then `labelledBy`, as React Aria, Lion and Zag do. The native `for` keeps
  label clicks focusing the control and names a native control before
  JavaScript runs; `aria-labelledby` names custom widgets too. While the
  label is rendered it names the control, so an `aria-label` on the control
  is ignored.
- **Description and error.** The control's `aria-describedby` lists the
  description, then the error while it is shown, then `describedBy`. Both
  messages stay linked together, as in React Aria Components and Lion, and as
  Cube UI Kit shows them; a screen reader reads them in that order.
- **Only rendered parts are linked.** An id goes into `aria-labelledby` or
  `aria-describedby` only once its part's element is rendered, as React Aria
  does, so no reference points at nothing. In React that is after the first
  commit, in a layout effect before paint: server HTML has every `id` and the
  label's `for`, and gains the references on hydration. Custom elements link
  on upgrade and whenever a part is added or removed.
- **A hidden error is unlinked.** Screen readers read content an
  `aria-describedby` points at even when it is `hidden` (the virtual screen
  reader does), so the error leaves `aria-describedby` whenever Field hides
  it.

## Announcing the error

Resolved question 2. Cube UI Kit gives its message
`role="alert"`, so a new error is read out at once. Field keeps that behavior
but announces through the live announcer (`dom/announcer.ts`): an alert that
appears by losing `hidden` is announced unreliably. React Aria announces
nothing, and Lion makes the error a live region.

- When the error is shown, Field announces its text assertively, as
  `role="alert"` would.
- While the error stays shown, a change to its text is announced too, as an
  alert's would be. The consumer owns that text, so Field watches the error
  element for changes.
- An error already shown when the field starts isn't announced: nothing
  changed, and it is read when the control gets focus.
- Nothing is announced while the field is disabled (the error is hidden), or
  when the error part isn't rendered or is empty.

## Keyboard

Field handles no keys. The control keeps its own.

## ARIA and state attributes per state

| State                     | Part        | Attributes                                                                  |
| ------------------------- | ----------- | --------------------------------------------------------------------------- |
| idle, every part rendered | label       | `id`, `for="<control id>"`                                                  |
|                           | control     | `id`, `aria-labelledby="<label id>"`, `aria-describedby="<description id>"` |
|                           | description | `id`                                                                        |
|                           | error       | `id`, `hidden`                                                              |
| invalid                   | control     | + `aria-invalid="true"`; `aria-describedby="<description id> <error id>"`   |
|                           | error       | `hidden` removed                                                            |
|                           | every part  | + `data-invalid`                                                            |
| required                  | control     | + `aria-required="true"`                                                    |
|                           | every part  | + `data-required`                                                           |
| disabled                  | every part  | + `data-disabled`                                                           |
|                           | error       | `hidden`, and unlinked, even while invalid                                  |
| label is not a `label`    | label       | no `for`                                                                    |
| `describedBy="tip"`       | control     | `aria-describedby="<description id> [<error id>] tip"`                      |

## Focus

Field moves no focus. A click on a `label` focuses a control that can be
labelled natively. A component whose control can't be (Select's trigger)
handles label clicks itself, as React Aria does.

## Pointer and touch

None.

## Expected spoken output

Confirmed with `@guidepup/virtual-screen-reader` on this markup: a `label`,
an `input` control, a description "We never share it" and an error "Enter a
valid email".

| State                                                    | Spoken phrase for the control                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| label only                                               | `textbox, Email`                                                           |
| with the description                                     | `textbox, Email, We never share it`                                        |
| required                                                 | `textbox, Email, We never share it, required`                              |
| invalid                                                  | `textbox, Email, We never share it Enter a valid email, invalid`           |
| invalid and required                                     | `textbox, Email, We never share it Enter a valid email, invalid, required` |
| valid again                                              | `textbox, Email, We never share it`                                        |
| invalid and disabled (native `disabled` on the input)    | `textbox, Email, We never share it, disabled, invalid`                     |
| checkbox control "Accept terms", error "You must accept" | `checkbox, Accept terms, You must accept, not checked, invalid, required`  |
| `role="radiogroup"` control, `span` label "Plan"         | `radiogroup, Plan, invalid, required`                                      |

A `role="group"` control announces neither `invalid` nor `required`: ARIA
supports `aria-invalid` and `aria-required` on `radiogroup` but not on
`group`, and the virtual screen reader reads only `group, Shipping`. There the
error text in `aria-describedby` is all a screen reader user gets.
CheckboxGroup's spec decides whether that is enough.

## Adapter surface

```tsx
// React, around a native input
const email = useComponent(field, { isInvalid: !!error, isRequired: true });
return (
  <div {...email.parts.root}>
    <label {...email.parts.label}>Email</label>
    <input {...email.parts.control} name="email" type="email" />
    <p {...email.parts.description}>We never share it</p>
    <p {...email.parts.error}>{error}</p>
  </div>
);
```

```html
<!-- Custom element -->
<uni-field required>
  <label data-part="label">Email</label>
  <input data-part="control" id="email" name="email" type="email" />
  <p data-part="description">We never share it</p>
  <p data-part="error">Enter a valid email</p>
</uni-field>
```

Element attributes: `invalid`, `required`, `disabled`, `labelled-by`,
`described-by`. There is no `control-id` or `label-element-type` attribute:
the element adopts the control's `id` and reads the label's tag. Set
`invalid` from the form's validation; the error stays hidden until then.

Composed into a UniAria input, Field's parts become the input's parts. TextInput,
for example, has `root`, `label`, `input`, `description` and `error`, and
`input` is Field's `control`.

## Mapping from Cube UI Kit

Cube UI Kit's inputs take `label`, `description`, `errorMessage`,
`isRequired`, `isInvalid` and `isDisabled` as props and render them through
`FieldWrapper`
(`references/cube-ui-kit/src/components/form/FieldWrapper/FieldWrapper.tsx`).

- Those props map to Field's parts and props. `id`, which UI Kit derives from
  the form field's name, maps to `controlId`.
- UI Kit shows `errorMessage` whenever it is set, so it passes
  `isInvalid: isInvalid || !!errorMessage`.
- The deprecated `message` becomes the description or the error.
- A tooltip's id goes into `describedBy`.
- `isValid`, `necessityIndicator`, `isOptional`, `labelPosition`,
  `labelTooltip`, `labelSuffix` and `extra` stay in UI Kit.
- **This fixes a gap.** UI Kit hands `description` and `errorMessage` to
  React Aria's `useTextField`, which points the input's `aria-describedby` at
  ids it generates, but `FieldWrapper` renders the description and the
  message without those ids. So today the input references elements that
  don't exist, descriptions are never announced, and errors reach screen
  readers only through the message's `role="alert"`. With Field the ids
  belong to the rendered parts.

## Deviations from the WAI-ARIA pattern

There is no field pattern, and the APG gives no guidance on errors: its
coverage report lists none for `aria-invalid`, `aria-errormessage` or
`aria-required`
(`references/aria-practices/content/about/coverage-and-quality/prop-coverage.csv`).
Field follows the names-and-descriptions practice: a visible native `label`
with `for`, and `aria-describedby` for descriptions. It differs from one APG
example:

- **The error goes in `aria-describedby`, not `aria-errormessage`.** The
  quantity spin button example
  (`references/aria-practices/content/patterns/spinbutton/examples/quantity-spinbutton.html`)
  links its errors with `aria-errormessage`, which screen readers don't read
  (see Summary). Like that example, Field removes `aria-invalid` when the
  value is valid instead of setting `"false"`.

## Resolved questions

Decided by @tenphi on 2026-10-15.

1. **Field is composed, not linked.** This changes decision 11, which named
   "a field and its control" as separate instances that find each other with
   `ctx.owner()`. UniAria inputs compose Field with `ctx.use()` instead, one
   instance, the way React Aria's `useTextField` calls `useField` and Cube UI
   Kit's inputs take their label as props. Every id is known in one
   `connect()`, so server HTML has the label's `for` and every `id`.
   `ctx.owner()` arrives with CheckboxGroup and RadioGroup, which do need
   separate instances.

   Composition is in the definition, so it holds in both adapters, and the
   conformance scenarios render one template through both.
   `<uni-text-input>` hosts its own label, description and error;
   `<uni-field>` is for native and third-party controls. With it comes a
   custom-element contract change: an element stops looking for parts at any
   nested UniAria element, not only at one of its own tag, and `<uni-field>`
   warns in development when it holds a UniAria input instead of a control.

2. **A new error is announced** through the live announcer, keeping Cube UI
   Kit's `role="alert"` behavior (see Announcing the error).

## Open questions

None.
