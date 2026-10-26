---
title: Forms
description: Labels, descriptions and errors, the Form that holds and checks the values, submission and reset.
---

UniAria's form controls are native controls underneath, so they submit, reset
and autofill the way HTML does. UniAria adds the labelling, the states and
the keyboard behavior, and [Form](../components/form.mdx) holds the values,
checks them and shows the errors. Without a Form, validation stays with you.

## Labels, descriptions and errors

Every control composes [Field](../components/field.mdx): optional `label`,
`description` and `error` parts, linked to the control with ids and ARIA, so
a screen reader reads the label, the description, the error and the required
and invalid states when the control gets focus.

```html
<uni-text-field required>
  <label data-element="Label">Email</label>
  <input data-element="Input" name="email" type="email" />
  <p data-element="Description">We never share it.</p>
  <p data-element="Error">Enter a valid email address.</p>
</uni-text-field>
```

- The label gets `for` (when it is a `<label>`) and names the control through
  `aria-labelledby`.
- The description and, while shown, the error go into the control's
  `aria-describedby`, in that order.
- Only parts you render are linked, so no reference points at nothing.
- A required mark such as `*` in the label should be `aria-hidden="true"`:
  the control already announces "required".

Field also works around any control of your own, native or custom: see the
[Field page](../components/field.mdx).

## Validation

Put the fields in a [Form](../components/form.mdx) and give each a `name`.
The form holds their values, checks them on each field's trigger, shows
their errors and focuses the first invalid field after a failed submit:

```html
<uni-form>
  <form data-uni="form" action="/signup" method="post" novalidate>
    <uni-text-field required>
      <label data-element="Label">Email</label>
      <input data-element="Input" name="email" type="email" />
      <p data-element="Error"><span data-element="ErrorText"></span></p>
    </uni-text-field>
    <button type="submit">Sign up</button>
  </form>
</uni-form>
```

A field checks `isRequired`, the native constraints you write on its input
(`type="email"`, `pattern`, `minlength`, …) and its own `validate`. A text
field checks when focus leaves it, a checkbox or a selection when it
changes, and every field on submit. The field shows the first error in its
`errorText` part. See [Form](../components/form.mdx#checks).

### Without a Form

Fields show validation state from `isInvalid` as well. Decide when a value is
invalid (on blur, on submit, from the server) and pass it:

```tsx
const email = useBehavior(textField, {
  isRequired: true,
  isInvalid: Boolean(errors.email),
});
```

Inside a form, `isInvalid` you set wins over the form's errors.

### What invalid looks and sounds like

While invalid, the control gets `aria-invalid="true"`, every part gets
`data-invalid`, and the error part is shown and linked. Outside a form, when
the error appears its text is announced, as `role="alert"` would, and a
change to the text while shown is announced too. An error already shown on
load isn't announced; it is read when the control gets focus. In a form, the
form decides what is said: an error shown when focus leaves a field is
announced with the field's label, and a failed submit moves focus to the
first error instead.

`isRequired` sets `aria-required="true"` and `data-required`, but not the
native `required` attribute, so the browser's own validation bubbles never
appear. `isDisabled` hides the error.

In groups (CheckboxGroup, RadioGroup), screen readers don't read required or
invalid on the group itself, so UniAria puts them on each checkbox or radio
and links the group's error to each.

## Submitting

| Component     | What the form submits                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| TextField     | The input's own `name` and value.                                                                             |
| Checkbox      | The input's `name` and `value` while selected.                                                                |
| CheckboxGroup | Each selected checkbox's `value`, under the group's `name`, which UniAria writes to every checkbox.           |
| Switch        | The input's `name` and `value` while on.                                                                      |
| RadioGroup    | The selected radio's value, under the group's `name`, which UniAria writes to every radio.                    |
| NumberField   | The number, unformatted (`1234.5`), from an optional `hiddenInput` part that carries your `name`.             |
| Select        | The selected keys, from an optional `hiddenSelect` part: a hidden native `<select>` that also takes autofill. |
| Combobox      | The selected key (or the custom text), from an optional `hiddenInput` part.                                   |
| Listbox       | Nothing: a listbox has no native form value. Read its `value` state.                                          |
| Autocomplete  | The input's text, under its own `name` if you give it one. The selection isn't submitted.                     |

Give a field its `name` (or put `name` on those parts; custom elements read it
from there), and UniAria writes it on the control the field submits through.
Put `autocomplete` on them yourself; UniAria owns the value. In a
[Form](../components/form.mdx), a field outside the `<form>` element gets the
form's id in its control's `form` attribute, so the native post includes it,
and a form without `handleSubmit` checks its fields before it posts. A checkbox or switch disabled with `isFocusableWhenDisabled` stays out of
the form's data, as a natively disabled one does.

Enter submits a form natively from a text input (a text area adds a line), a
number field (after committing the typed number), a checkbox, a switch, a
radio, a combo box (after settling its text) and an autocomplete with no
option highlighted, as it would without UniAria.

## Reset

In a [Form](../components/form.mdx), a reset puts every value back to the
form's default for its name and clears the errors; the fields write their
controls again. Outside a Form, on the `<form>`'s `reset` event, each control
goes back to its default, as a
native control goes back to its `value` or `checked` attribute. An
uncontrolled control forgets the user's changes and follows
`default<Value>` again, as it is at that moment: a default set after the
control rendered counts, such as a custom element's property set after it
connected, and so does one set after the reset, until the next change. It
reports the change. A controlled control reports `default<Value>`, or
without one the value it started with, through its change event, and waits
for you. A `reset` listener that calls `preventDefault()` cancels this.

Autocomplete resets its text the same way, to `defaultInputValue`, since a
form submits the input's text if you name it. It keeps its selection, as
Listbox does: a list has no form value.

## Before JavaScript runs

Custom elements read their starting state from your markup: a text field's
`value`, a checkbox's `checked`, a number field's text (parsed for the
locale). A server-rendered form shows the right values and submits them even
before the elements upgrade.
