---
title: Forms
description: Labels, descriptions and errors, form submission, reset and validation state.
---

UniAria's form controls are native controls underneath, so they submit, reset
and autofill the way HTML does. UniAria adds the labelling, the states and
the keyboard behavior; validation itself stays with you.

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

## Validation state

UniAria shows validation state; it doesn't validate. Decide when a value is
invalid (on blur, on submit, from the server) and pass `isInvalid`:

```tsx
const email = useBehavior(textField, {
  isRequired: true,
  isInvalid: Boolean(errors.email),
});
```

While invalid, the control gets `aria-invalid="true"`, every part gets
`data-invalid`, and the error part is shown and linked. When the error
appears, its text is announced, as `role="alert"` would, and a change to the
text while shown is announced too. An error already shown on load isn't
announced; it is read when the control gets focus.

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

Put `name`, `form` and `autocomplete` on those parts yourself; UniAria owns the
value. A checkbox or switch disabled with `isFocusableWhenDisabled` stays out of
the form's data, as a natively disabled one does.

Enter submits a form natively from a text input (a text area adds a line), a
number field (after committing the typed number), a checkbox, a switch, a
radio and a combo box (after settling its text), as it would without UniAria.

## Reset

On the form's `reset` event, each control goes back to its default, as a
native control goes back to its `value` or `checked` attribute. An
uncontrolled control forgets the user's changes and follows
`default<Value>` again, as it is at that moment: a default set after the
control rendered counts, such as a custom element's property set after it
connected, and so does one set after the reset, until the next change. It
reports the change. A controlled control reports `default<Value>`, or
without one the value it started with, through its change event, and waits
for you. A `reset` listener that calls `preventDefault()` cancels this.

## Before JavaScript runs

Custom elements read their starting state from your markup: a text field's
`value`, a checkbox's `checked`, a number field's text (parsed for the
locale). A server-rendered form shows the right values and submits them even
before the elements upgrade.
