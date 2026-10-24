# Form spec

Status: approved by @tenphi on 2026-10-24

## Summary

Form is the behavior of a `<form>`. It holds the values of the fields bound
to it by name, checks them, shows each field's errors through the field's
Field, submits and resets. UniAria's fields show validation state today but
never decide it: Field's spec leaves rules, display timing and focusing the
first invalid field "to a later Form component". This is that component. It
follows Cube UI Kit's modern form
(`references/cube-ui-kit/src/components/form/Form/modern/`), the form UI Kit
recommends for new code, and takes React Aria and the platform as the
reference for submission, focus and assistive technology.

Form keeps UniAria's rule that internal state never renders a framework
component. A keystroke changes the form's store; the binder writes the
field's value, `aria-invalid` and error text, and no React or Vue component
renders unless it selected that state.

- **WAI-ARIA pattern:** none. A `<form>` with an accessible name is a form
  landmark; the APG's landmark practice asks for a visible heading as that
  name, and for native controls where they exist
  (`references/aria-practices/content/practices/landmark-regions/landmark-regions-practice.html`).
- **Builds on:** the runtime store; Field, which every UniAria field
  composes and which binds a field to the form; `dom/` announcer, modality
  tracker and `isFocusable`.
- **Owner:** none. Fields find the form through an inherited `form` link
  (How it works).
- **Custom element:** yes, `<uni-form>` around the consumer's `<form>`.

The differences from UI Kit's modern form are listed in Differences and
each is a resolved question. The main ones: focus moves to the first invalid
field after a failed submit, the native constraints a consumer writes on a
control still count, a form without a submit handler validates and then
posts natively, and disabled and read-only fields aren't checked.

Not part of Form:

- **A rule language.** UI Kit's rule objects (`{ type: 'email' }`,
  `{ min: 3 }`) stay in UI Kit, which turns them into a `validate` function.
  Form checks `isRequired`, the native constraints on a control, and
  `validate`.
- **Typed descriptors, `Form.Subscribe`, `useValue`.** React conveniences
  over the controller; `useBehaviorState` reads the state, and UI Kit keeps
  its own on top (Mapping from Cube UI Kit).
- **A dialog session.** A form in a Dialog works as any form. UI Kit's
  `DialogForm` (close on success, cancel on dismiss) builds on the
  `submitted` event and the `cancelSubmit()` action.
- **Submit and reset buttons.** A native `<button type="submit">` or a
  UniAria Button with `type: 'submit'` submits. Form disables nothing
  itself: a disabled submitter leaves the native post's data and turns off
  Enter (Keyboard).

## How it works

### Values live in the form

A field bound to a form gives the form its value. The form's store holds the
value under the field's name, and the field reads it back: the form is the
field's controlled value. Typing asks the form to change it; the form
commits it, checks it if the field's trigger says so, and the binder writes
the field again. Values exist before their fields mount and stay after they
unmount, as in UI Kit (`Form/modern/README.md:24`), so a wizard step can
unmount and keep its values.

A name is a string, one key (`'email'`, `'user.email'` is a key with a dot
in it), or a path for nested data, a list of keys and indexes
(`['users', 0, 'email']`), as in UI Kit (`Form/modern/values.ts:2`). Values,
defaults and the payload are nested along paths. A field bound to a parent
path holds the whole object, and writing a parent replaces its children, as
UI Kit's README describes (lines 38–42). The `name` the field writes on its
native control is UI Kit's escaped key (`users.0.email`, with `.` and `\` in
a key escaped), so a native post sends flat names.

The field keeps reporting its own change event (`valueChange`,
`selectedChange`) for the user's changes, so a consumer listening on the
field keeps working. Changes that start in the form (`setValue`, reset,
defaults) come out as the form's `valuesChange`, not the field's event. A
`value` the consumer passes to a bound field is ignored, with a development
warning; on elements, setting the bound field's value property is a
`setValue` on the form.

### Field binds

Every UniAria field composes Field, so the binding lives there, and any
control that uses Field binds: a UniAria field, a native control inside
`<uni-field>`, or a design system's own control in React and Vue
(`useBehavior(field, { name })`), as UI Kit binds any input through
`useFieldProps` (`docs/rules/input-components.md:3`).

Field gets the value it binds from:

1. **A composing field,** which hands Field its own bindable
   (`api.bindValue`), with a conversion where the shapes differ (Select's
   keys to a single key) and a reader for whether focus is in the field. A
   composing field may still compose its own fields; only the one that
   hands over a bindable binds.
2. **Its own `value` bindable** otherwise. With a native `input`, `select`
   or `textarea` as its `control`, Field follows the control's value:
   `input` and `change` events in, the `value`, `checked` or `selected`
   property out. A custom control reads `value` from Field's state and calls
   Field's `setValue` action.

A bound field's parts render the form's value from the first render: in
React and Vue the link comes from context, so server HTML already shows it.
Without `OwnerProvider` in React, server HTML shows the field's own default
until hydration links it.

### Finding the form

A field finds the form as a radio finds its group (root AGENTS.md,
Composition between instances), through a `form` link that reaches the
nearest form across other UniAria hosts (runtime change 1):

1. **An explicit link.** The `form` prop in React and Vue takes the form's
   instance or handle. On elements, the `form` attribute names the form by
   the id of its `<form>` element, as HTML's `form` attribute does.
2. **React context.** `OwnerProvider` around the form's content provides it.
   UI Kit's `Form` renders the provider.
3. **Vue provide.** Every `useBehavior` provides its instance; a field
   injects the nearest form.
4. **The nearest DOM ancestor,** with the composed request event an owned
   component sends; a nearer form that connects later takes over.

`form: null` in React and Vue, and `form=""` on elements (as HTML's empty
`form` attribute), leave a field unbound inside a form (runtime change 4).

A field inside a group never binds on its own: a Checkbox in a
CheckboxGroup and a Radio in a RadioGroup belong to the group, which binds.
A field with an owner doesn't bind while its owner request is pending or
while it sits inside an element of its owner's tag, defined or not, so a
`<uni-checkbox>` in a `<uni-checkbox-group>` that hasn't upgraded doesn't
bind as a boolean. UI Kit masks groups the same way (`FormScopeMask`,
`Form/Form.tsx:76`).

A field's control belongs to a form natively when `control.form` is that
form's `<form>`. When it isn't (a field outside the `<form>`, in a consumer's
portal, or linked explicitly), the field writes the form's id into the
`form` attribute of the native controls it submits through, so native
submission and reset follow. The form's root has an id for that (Anatomy).
A control in a shadow root can't join a `<form>` outside it; its value
reaches a native post through the `formdata` event instead (Submitting).

### Registering

A field registers with the form while it is started, linked, named and not
in a group. Registering is idempotent: StrictMode, an element moved in the
DOM and Vue's `<KeepAlive>` stop and start it again without a second
registration. The link resolving later (the DOM request) registers it then.

- **Stopping** makes the name inactive. Its value stays, out of the active
  payload; its errors stay and count again when it registers again. With
  `shouldPreserve: false`, the value goes a microtask later unless something
  writes it first, as in UI Kit (`Form/modern/store.ts:657`).
- **A changed `name`** releases the old name, as stopping does, and
  registers the new one.
- **Two fields with one name** share one value. The newest registration
  owns the checks (`validate`, the trigger, `dependsOn`, the delay);
  releasing it hands them back to the latest one left, as in UI Kit
  (`Form/modern/README.md:56`). Two standalone Checkboxes with one name
  would share one boolean, so development warns: use a CheckboxGroup.

### What a bound field hands over

| Concern             | Unbound field                                        | Bound field                                                                                                                  |
| ------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Value               | Its bindable.                                        | The form's value under its name.                                                                                             |
| Default             | `default<Name>`.                                     | The form's default for the name (Defaults).                                                                                  |
| Form reset          | The field resets itself on the form's `reset` event. | The form resets the value; the field's `reset()` does nothing. Its rewrite of the native control after a native reset stays. |
| Invalid             | `isInvalid`.                                         | `isInvalid` when set, `true` or `false`; else whether the form holds errors for it.                                          |
| Error text          | The consumer's content in the error part.            | The first error, written into the error text part when the consumer renders one (Errors shown).                              |
| Disabled, read-only | `isDisabled`, `isReadOnly`.                          | The field's, or the form's.                                                                                                  |
| Checks              | None.                                                | `isRequired`, native constraints and `validate` (Validation).                                                                |

Everything else stays the field's: its parts, keys, focus and announcements.

### The payload

`handleSubmit` gets the values of the **active** names: those with a
registered field now. Inactive values stay in `values` and leave the
payload, as in UI Kit; `submitValues: 'all'` sends every value the form
holds. A disabled field stays in the payload (UI Kit); a native post leaves
its control out, as HTML does.

## Fields in a form

| Field         | Form value                                    | Hands Field                                | Submits natively through | Focused after a failed submit | Default trigger |
| ------------- | --------------------------------------------- | ------------------------------------------ | ------------------------ | ----------------------------- | --------------- |
| TextField     | `string`                                      | `value`                                    | the input                | the input                     | `blur`          |
| NumberField   | `number \| null`                              | `value`                                    | the hidden input         | the input                     | `blur`          |
| Checkbox      | `boolean`                                     | `isSelected`                               | the input, when checked  | the input                     | `change`        |
| Switch        | `boolean`                                     | `isSelected`                               | the input, when on       | the input                     | `change`        |
| CheckboxGroup | `string[]`                                    | `value`                                    | each checked checkbox    | its first enabled checkbox    | `change`        |
| RadioGroup    | `string \| null`                              | `value`                                    | the checked radio        | its tab stop                  | `change`        |
| Select        | `string \| null`; `string[]` in multiple mode | `value`, converted to a key in single mode | the hidden `<select>`    | the trigger                   | `change`        |
| Combobox      | `string \| null`: the key or the custom text  | `value`, converted to a key                | the hidden input         | the input                     | `blur`          |
| Field alone   | the control's value, or what `setValue` gives | its own `value`                            | the control, when native | the control                   | `blur`          |

- **The conversion** reads Select's `selectionMode` on every read, so a mode
  that changes converts from then on. The form value in single mode is the
  key, not a one-key array, as UI Kit's Picker submits it.
- **The trigger** for a text field is focus leaving it, for a toggle or a
  selection its change, as UI Kit's docs say
  (`docs/rules/input-components.md:49`). Combobox's is `blur`, as in UI
  Kit's code (`fields/ComboBox/ComboBox.tsx:745` passes none, and none means
  `onBlur`): typing changes its text, not its value. UI Kit's Picker also
  defaults to `onBlur` in code; Select's `change` follows the docs instead.
  "Focus leaving" is the field's focus-within reader turning false, the one
  each field already reports as `focusChange` "for a form that validates on
  blur"; the check runs after the field's own flush, so Combobox has settled
  its text by then.
- **Listbox and Autocomplete** don't bind. The composition spec makes them
  controls, and a list has no form value (composition spec, Who resets a
  form value); a Select or a Combobox is the field around them.
- **Native submission** needs the optional hidden part of NumberField,
  Select and Combobox, and a native control under Field alone. A bound value
  with no native control in the form reaches a native post through the
  `formdata` event (Submitting).

## Anatomy

| Part  | Element | Attributes UniAria owns                                                             | Notes                                                                                                                             |
| ----- | ------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| root  | `form`  | `data-uni="form"`, `id` (unless it has one), `novalidate`, state attributes         | Required: the form is the element. The consumer owns `action`, `method`, `target`, `aria-labelledby` and the rest.                |
| error | any     | `id` (unless it has one), `hidden` while there is no submit error, state attributes | Optional. Shows the submit error; the consumer renders its content from `submitError`. Announced when shown (Live announcements). |

`novalidate` turns the browser's own validation off: the form checks fields
itself and shows errors through Field, and a browser bubble on top would
repeat them. Native constraints still count (Validation). Development warns
when the root lacks it at submit: without it the browser blocks the `submit`
event before Form sees it. Write it in server markup too, for a form that may
be submitted before the elements upgrade.

Field gains an `errorText` part (Changes to approved specs).

## Props

| Prop               | Type                                   | Default    | Bindable | Change event | Notes                                                                                                                                                                                                  |
| ------------------ | -------------------------------------- | ---------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| defaultValues      | `Readonly<Record<string, unknown>>`    | `{}`       | no       | —            | What names start with and reset goes back to (Defaults). Names no one changed follow it when it changes later, as a bindable follows `default<Name>`.                                                  |
| handleSubmit       | `(values, context) => unknown`         | —          | no       | —            | Called with the payload after the checks pass; the form waits for a promise it returns. `context` is `{ signal, submitter, include, formData }`. Without it, a valid form posts natively (Submitting). |
| submitValues       | `'active' \| 'all'`                    | `'active'` | no       | —            | The payload (How it works).                                                                                                                                                                            |
| validationTrigger  | `'change' \| 'blur' \| 'submit'`       | per field  | no       | —            | The trigger of every field that doesn't set its own.                                                                                                                                                   |
| validationDelay    | `number`                               | `0`        | no       | —            | Milliseconds a change or a blur waits before checking, for fields that don't set their own. Submit and `validate()` don't wait.                                                                        |
| validationMessages | `Partial<Record<MessageKey, Message>>` | —          | no       | —            | Messages for the built-in checks (Validation). A `Message` is a string or `(context) => string`.                                                                                                       |
| isDisabled         | `boolean`                              | `false`    | no       | —            | Disables every bound field.                                                                                                                                                                            |
| isReadOnly         | `boolean`                              | `false`    | no       | —            | Makes every bound field read-only.                                                                                                                                                                     |

`handleSubmit` is a function prop, not an event: an event can't be waited
for, and an event named `submit` would also collide with the native `submit`
that bubbles through `<uni-form>`. It isn't called `onSubmit`, which
UniAria keeps for event callbacks.

Element attributes: `submit-values`, `validation-trigger`,
`validation-delay`, `disabled`, `readonly`. `defaultValues`,
`handleSubmit` and `validationMessages` are properties only.

## Field props for the form

Field gains these props, and every field that composes Field passes them
on.

| Prop               | Type                                                   | Default      | Notes                                                                                                                                                                                                                                                               |
| ------------------ | ------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name               | `string \| readonly (string \| number)[] \| undefined` | —            | The name in the form. Written as the `name` of the native control the field submits through, while set. CheckboxGroup and RadioGroup have it already. Elements adopt it from that control's `name` attribute, so `<input data-element="Input" name="email">` binds. |
| form               | link                                                   | nearest form | The form to bind to (Finding the form).                                                                                                                                                                                                                             |
| validate           | `(value, context) => unknown`                          | —            | `context` is `{ name, values, signal }`. Returns or resolves `null`, `undefined`, `''` or `true` when valid; else an error, or a list of errors. A thrown error counts as one: its `message`, else the value thrown.                                                |
| validationTrigger  | `'change' \| 'blur' \| 'submit'`                       | the form's   | When it checks on its own (When checks run).                                                                                                                                                                                                                        |
| validationDelay    | `number`                                               | the form's   | As the form's, for this field.                                                                                                                                                                                                                                      |
| validationMessages | `Partial<Record<MessageKey, Message>>`                 | the form's   | This field's messages for the built-in checks.                                                                                                                                                                                                                      |
| dependsOn          | `readonly Name[]`                                      | `[]`         | Names whose changes check this field again, once it has been checked.                                                                                                                                                                                               |
| isEqual            | `(a, b) => boolean`                                    | shallow      | What counts as a change for `isDirty`: `Object.is`, then one level into arrays and plain objects, as UI Kit (`Form/modern/values.ts:62`).                                                                                                                           |
| shouldPreserve     | `boolean`                                              | `true`       | Keep the value when the field unmounts (Registering).                                                                                                                                                                                                               |

`isRequired` keeps its meaning (`aria-required`, `data-required`) and, when
bound, also checks that the field isn't empty. On elements, a native
`required` the consumer writes on the control is adopted into `isRequired`.

`isInvalid` becomes `boolean | undefined`: unset, a bound field shows the
form's state; `true` or `false` wins over it, as in UI Kit
(`Form/use-field/use-field-binding.ts:148`) and React Aria.

Element attributes: `name` (one key), `form`, `validation-trigger`,
`validation-delay`, `depends-on` (JSON, as `disabled-keys`),
`should-preserve="false"`. A path and `validate`, `isEqual` and
`validationMessages` are properties only.

## Events

| Event          | Detail                                                                                               | When                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `submitted`    | `{ values }`                                                                                         | `handleSubmit` resolved, or the native post went out.                                  |
| `submitFailed` | `{ status: 'invalid', errors: Record<string, unknown[]> }` or `{ status: 'failed', error: unknown }` | The checks failed, or `handleSubmit` threw or rejected. Reported before focus moves.   |
| `valuesChange` | `{ values, names: Name[], source: 'user' \| 'program', kind: 'set' \| 'reset' \| 'defaults' }`       | Once per batch of changes to values that the user made, or a program write that asked. |

## Public state

| Field         | Type                                   | Meaning                                                                                                                                                         |
| ------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| values        | `Readonly<Record<string, unknown>>`    | Every value the form holds, active or not.                                                                                                                      |
| activeValues  | `Readonly<Record<string, unknown>>`    | The values of active names: the default payload.                                                                                                                |
| defaultValues | `Readonly<Record<string, unknown>>`    | What reset goes back to.                                                                                                                                        |
| fields        | `Readonly<Record<string, FieldState>>` | One entry per name the form knows, keyed by its escaped key.                                                                                                    |
| isDirty       | `boolean`                              | Some value differs from its default, active or not (UI Kit, `Form/modern/store.ts:387`).                                                                        |
| isTouched     | `boolean`                              | Some field was changed by the user or left.                                                                                                                     |
| isValid       | `boolean`                              | Every active, checked field (enabled, not read-only) has been checked and passed. False with no active fields (UI Kit).                                         |
| isInvalid     | `boolean`                              | Some active field's status is `invalid`.                                                                                                                        |
| isValidating  | `boolean`                              | A check is waiting out its delay or running.                                                                                                                    |
| isSubmitting  | `boolean`                              | From a submit until `handleSubmit` settles, or until the native post is handed to the browser.                                                                  |
| submitError   | `unknown`                              | What `handleSubmit` threw, or what `setSubmitError` set, until the next submit or reset.                                                                        |
| canReset      | `boolean`                              | Reset would change something: a dirty or touched field, a field that has been checked, errors, a submit error. False while submitting (UI Kit, `store.ts:392`). |
| isDisabled    | `boolean`                              | The prop.                                                                                                                                                       |
| isReadOnly    | `boolean`                              | The prop.                                                                                                                                                       |

`FieldState` is `{ value, defaultValue, errors: unknown[], status:
'unvalidated' | 'validating' | 'valid' | 'invalid', isTouched, isDirty,
isActive }`.

`expose()` keeps what didn't change: `values`, `fields` and each
`FieldState` keep their identity until their content changes, so
`useBehaviorState(signup, (s) => s.fields.email)` renders only when the
email changes.

Field's public state gains its binding: `value`, `errors`, `status`,
`isTouched`, `isDirty`, `isBound`.

## Actions

Each runs in a batch. On elements they are methods of `<uni-form>`:
`signup.submit()`.

| Action                                        | Does                                                                                                                                                                                                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `submit(options?)`                            | Submits as a submit button does. `options`: `{ submitter, include, shouldFocus }`; `shouldFocus` is `true` by default, so an autosave passes `false`. Resolves to `{ status }`: `'submitted'`, `'invalid'` (with `errors`), `'failed'` (with `error`), `'stale'` or `'ignored'`. |
| `cancelSubmit()`                              | Aborts a running submit: the signal aborts and the submit settles `'stale'`, with values and errors kept. For a dialog closed while saving.                                                                                                                                      |
| `reset(options?)`                             | Resets as a native reset does (Resetting). `options.values` become the new defaults first, for starting a new record.                                                                                                                                                            |
| `validate(names?)`                            | Checks those names, or every active one, now. Resolves to `{ isValid, isStale, errors }`.                                                                                                                                                                                        |
| `focusInvalid()`                              | Focuses the first invalid field as a failed submit does, for errors set from the server.                                                                                                                                                                                         |
| `setValue(name, value, options?)`             | Writes a value. `options`: `{ validation: 'auto' \| 'always' \| 'never', source: 'user' \| 'program', shouldTouch, shouldNotify }`. By default a program write checks as UI Kit's `auto` does, touches nothing and reports no `valuesChange`.                                    |
| `setValues(values, options?)`                 | Several at once, with the same options.                                                                                                                                                                                                                                          |
| `setDefaultValues(values, options?)`          | Replaces the defaults. `options.replaceValues`: `'untouched'` (default: names no one changed follow, as always), `'clean'` (also names whose value equals the old default) or `'all'`. Names whose value it replaces lose touched, errors and status.                            |
| `touch(name, isTouched?)`                     | Marks a name touched, or not.                                                                                                                                                                                                                                                    |
| `setFieldErrors(name, errors)`                | Sets errors from the server (Server errors).                                                                                                                                                                                                                                     |
| `clearFieldErrors(name?)`                     | Clears them for one name or all; the status becomes `valid`, as in UI Kit (`store.ts:803`).                                                                                                                                                                                      |
| `setSubmitError(error)`, `clearSubmitError()` | The submit error.                                                                                                                                                                                                                                                                |
| `batch(fn)`                                   | Runs `fn`'s actions as one change: one `valuesChange`, one render of what selected the state.                                                                                                                                                                                    |

Field gains one action: `setValue(value)`, a user change from a custom
control.

All actions work without a root element: a form used only as a controller
submits through `submit()`, with no native post.

## Validation

### What a field checks

In this order, stopping at the first check that fails:

1. **Bad input.** A native control the browser can't read (letters in
   `type="number"`, a half-typed date) fails with the browser's message, so
   the user isn't told to fill out a field they filled.
2. **Required.** With `isRequired`, an empty value fails. Empty is `null`,
   `undefined`, `''`, `false` and `[]`, for every field. A field's display
   shows `null` and `undefined` as empty and never writes that back.
3. **Native constraints.** A field whose control is a native `input` or
   `textarea` checks the constraints the consumer wrote on it: `pattern`,
   `min`, `max`, `step`, `type="email"` and `type="url"`, and NumberField
   checks its own `minValue`, `maxValue` and `step`. Form doesn't read the
   live control, which the binder may not have written yet: it sets the
   value on a detached control with the same constraints and reads that, as
   React Aria's NumberField does (`react-aria/src/numberfield/useNumberField.ts:458`).
   `minlength` and `maxlength` Form checks itself, in UTF-16 code units as
   HTML counts them: a browser reports them only after a user edit, so a
   value set by script would never fail them.
4. **`validate`,** for every value, empty included. Its errors are the
   field's errors.

Form only reads `validity` and `validationMessage`; it never calls
`checkValidity()` or `reportValidity()` on a bound control, which would fire
`invalid` at Select's hidden `<select>` and at the modality tracker. A
`setCustomValidity()` someone else set on the live control doesn't count:
the detached control has none.

A disabled or read-only field isn't checked and holds no errors from
checks, as HTML bars them from constraint validation (Resolved questions 9).

### Messages

A built-in check's message comes from the field's `validationMessages`,
then the form's, then the browser:

| `MessageKey`                                                                                     | Browser's message from                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `valueMissing`                                                                                   | a detached `required` control of the field's kind: a text input, a checkbox, a `<select>`, or a radio in a detached `<form>` (a lone radio has no group and reports nothing) |
| `badInput`, `patternMismatch`, `typeMismatch`, `rangeUnderflow`, `rangeOverflow`, `stepMismatch` | the detached control                                                                                                                                                         |
| `tooShort`, `tooLong`                                                                            | none: the browser gives none for a script-set value, so Form's default is "Use at least {min} characters" and "Use at most {max} characters", in English                     |

Browser messages are in the browser's language, not the page's, and differ
between engines; a checkbox's ("Please check this box if you want to
proceed") reads oddly for a group. An app that is translated, or that
needs one wording everywhere, sets `validationMessages`. A function message
gets `{ name, value, min, max, step }`.

### When checks run

- **On the trigger.** `blur` checks when focus leaves the field, even with
  no change; `change` checks on each user change; `submit` only on submit.
  `validationDelay` waits after a change or a blur; the field's status is
  `validating` while it waits and while the check runs.
- **While errors show,** every change checks again, whatever the trigger,
  so an error goes as soon as it is fixed (UI Kit,
  `Form/modern/store.ts:296`). A user change that doesn't check clears the
  field's errors and sets its status back to `unvalidated`.
- **Program writes** with `validation: 'auto'` check what a user change
  would: a field with the `change` trigger, a field showing errors, and the
  fields that depend on it. `'always'` checks the field; `'never'` checks
  nothing and keeps its errors.
- **`dependsOn`.** A change to a listed name checks this field again if it
  has been checked or is being checked; a check already running is aborted
  and runs again.
- **On submit and `validate()`,** every active field that is checked runs
  at once, without delays.
- **Never on mount.** A field starts `unvalidated`.
- **A changed `validate`** doesn't check again by itself: functions can't
  be compared. A consumer whose check depends on outside data calls
  `validate([name])` when that data changes; UI Kit does this for its
  `deps`.

Each check runs after the field's own flush, so the field has settled
(Combobox's text) and the binder has written its control before the check
reads it.

### Async checks and stale results

`validate` may return a promise. Its `signal` aborts when the result can no
longer count: the value or a `dependsOn` value changed, the field
unmounted, the form reset, or `setFieldErrors` replaced it. A result that
arrives after that is dropped even if the function ignored the signal, as
in UI Kit (`Form/modern/store.ts:937`). Errors already shown stay until the
new result arrives.

### Errors shown

A field's errors show as soon as it holds them, as in UI Kit: since a text
field checks on blur, its first error shows when the user leaves it. Field
shows them: `aria-invalid` on the control, `data-invalid` on every part, the
error part unhidden and linked through `aria-describedby`.

Errors are any value, as UI Kit's are React nodes (`Form/modern/field.ts:17`).
Field writes the first error's text into its `errorText` part when the
consumer renders one inside the error part and the error is a string: an
element-owned part, as Select's `value` part is. To show rich errors (a
link, an icon, a React node), leave `errorText` out and render
`errors[0]` from Field's state yourself.

### Server errors

`setFieldErrors(name, errors)` shows errors that came back from the server,
for any name, mounted or not. They stay until the field's next check: a
change while they show, a blur on a `blur` field, or a submit. A field the
user didn't touch keeps its server error until submitting again, as React
Aria keeps one (`react-aria/src/form/useFormValidation.ts:68`). Errors set
for a name that isn't mounted show when its field mounts, where UI Kit
clears them on registering (`store.ts:594`). To move the user to them, call
`focusInvalid()`.

## Submitting

Form acts only on its own `<form>`'s `submit` event: a nested form's event,
or one that bubbled through a React portal, isn't its own. For its own:

1. **It prevents the native submission,** always, except for the second
   event it sends itself (step 7).
2. **It ignores the submit while one is running.** `submit()` resolves
   `'ignored'`.
3. **It clears `submitError`** and sets `isSubmitting`.
4. **It checks every active field that is checked,** waiting for async
   checks. A submitter with `formnovalidate` skips the checks, as HTML does
   for a "Save draft" button. Values that change meanwhile settle the
   submit as `'stale'`, and nothing is sent, as in UI Kit
   (`Form/modern/store.ts:1081`); the user presses again. With no active
   fields there is nothing to check, and the submit goes on.
5. **If a check fails,** it reports `submitFailed` with `status: 'invalid'`,
   then, in the next frame, so a consumer can reveal a tab or a wizard step
   first, focuses the first invalid field (Focus), and resolves
   `'invalid'`.
6. **If all pass, with `handleSubmit`,** it calls it with the payload and
   `{ signal, submitter, include, formData }`, where `formData` is the
   form's `FormData` with the submitter (Baseline widely available since
   October 2025), for controls Form doesn't bind (a CSRF token). It waits.
   Success reports `submitted`; a throw or rejection sets `submitError` and
   reports `submitFailed` with `status: 'failed'`. `submit()` never rejects.
7. **If all pass, without `handleSubmit`,** it posts natively: in a new
   task, once the first `submit` event's dispatch is over (a browser ignores
   `requestSubmit()` while it dispatches), it calls `requestSubmit` with
   the same submitter and lets that event through. The `<form>`'s `action`,
   `method` and `target` and the submitter's `formaction` apply. If the
   submitter left the form or stopped being a submit button meanwhile, the
   submit settles `'stale'` with a development warning. `isSubmitting` ends
   once the event went out; it ends too when the page comes back from the
   back/forward cache.

During a native post, the `formdata` event adds the active values whose
field has no native control in the form: a field in a shadow root, a
NumberField, Select or Combobox without its hidden part, a custom control
under Field. Strings and numbers go as they are, `true` as `on`, a list as
one entry per item; `false`, `null` and `undefined` add nothing. Development
warns for a value of another kind. With `submitValues: 'all'`, inactive
values are added too.

A reset, `cancelSubmit()` or the form stopping aborts the signal and settles
the submit as `'stale'`.

**React 19 actions.** A function in the `<form>`'s `action` runs on the
second, native event, so it works without `handleSubmit`, with the
`FormData` React builds. React then resets the form, which resets the
values to their defaults and clears errors, as it would without UniAria;
to keep server errors after a submit, use `handleSubmit`. With both,
`handleSubmit` runs and the action never does; development warns.

## Resetting

Form acts only on its own `<form>`'s `reset` event. The native reset runs
during the event; a listener after Form's, on the document or in React's
root, may still cancel it. So Form waits for the dispatch to end, in a new
task, and then, unless the event was cancelled:

- Every value the form holds goes back to its default; values with no
  default and no active field go, as in UI Kit (`store.ts:780`). The fields'
  own `reset()` does nothing while bound.
- Errors, touched and statuses clear; checks and a running submit are
  aborted; `submitError` clears. One `valuesChange` reports `kind: 'reset'`.
- Every bound field writes its native control again, since the native
  reset put back the attributes React rendered once, which may hold an old
  record. Unbound controls keep what the native reset gave them, as in HTML.

The `reset()` action resets the `<form>` natively, then the same way; with
no root element, only the store.

UI Kit prevents the native reset and resets unbound controls itself,
because React Aria's reset listeners ignore `preventDefault`
(`Form/ModernFormRoot.tsx:123`). UniAria's fields don't need that.

## Defaults

The default of a name is `defaultValues[name]` when the form has the key,
even `null` or `undefined`; else the first explicit default a field
registered with (its `default<Name>`, not its schema's default). Two fields
with different explicit defaults keep the first, with a development warning
(UI Kit, `store.ts:562`). `defaultValues` is read in `setup()`, so the order
in which fields and the form mount doesn't matter.

A name nobody changed follows its default, as an uncontrolled bindable
follows `default<Name>` (root AGENTS.md, Controlled and uncontrolled
values): a `defaultValues` property set after a `<uni-form>` connects still
applies, and `setDefaultValues()` moves those names along. `isDirty` compares
with the current default.

A value the field's control already holds when it binds, different from the
control's own default (text typed before the element upgraded, a value the
browser restored going back in history), counts as the user's change: the
form takes it, and the name is dirty.

## Keyboard

Form handles no keys. Enter submits natively, under HTML's rules:

- In a text field, Enter clicks the form's first submit button. With no
  submit button, it submits only a form with a single text field. A disabled
  first submit button turns Enter off.
- On a checkbox, a radio or a switch, Enter submits as well.
- Combobox settles its text and NumberField commits its number first.

## Focus

- **After a failed submit,** in the frame after `submitFailed`, Form scrolls
  the first invalid field's root into view (`block: 'nearest'`, so its label
  and error show) and focuses its target (Fields in a form), with keyboard
  modality first so focus shows, as Select and React Aria do
  (`react-aria/src/form/useFormValidation.ts:84`). "First" is in the order
  of the composed tree, shadow roots and portals included. A field that
  can't take focus (in a closed `<details>`, a hidden tab, an inert region)
  is skipped.
- **Unbound controls** with native constraints are checked on submit too;
  when one is the first invalid control, Form calls its `reportValidity()`,
  so the browser focuses it and shows its own message, as without UniAria.
- `focusInvalid()` does the same as a failed submit.
- Nothing else moves focus. A reset leaves it where it is.

## Pointer and touch

None of its own.

## ARIA and state attributes per state

| State                     | Part  | Attributes                            |
| ------------------------- | ----- | ------------------------------------- |
| idle                      | root  | `data-uni="form"`, `id`, `novalidate` |
|                           | error | `id`, `hidden`                        |
| submitting                | root  | `data-submitting`                     |
| some active field invalid | root  | `data-invalid`                        |
| dirty                     | root  | `data-dirty`                          |
| validating                | root  | `data-validating`                     |
| submit error              | error | `hidden` removed                      |
| disabled, read-only       | root  | `data-disabled`, `data-readonly`      |

On a bound field, through its Field: `aria-invalid="true"` on the control
and `data-invalid` on every part while it is invalid, the error part shown
and in `aria-describedby`, the first error in `errorText`, and
`data-validating` on every part while a check waits or runs. `isRequired`
stays the field's: the form adds `aria-required` nowhere.

## Live announcements

Field announces a newly shown error today (Field spec, Announcing the
error). With a form, the rules become:

- **An error shown on blur** is announced assertively with the field's
  label (the announcer's `aria-labelledby`, label then error), since focus
  is already on the next field.
- **A shown error whose text changes while its control has focus** isn't
  announced again: with every change checking again, that would speak on
  every key. The control's description holds the new text.
- **A field checked again through `dependsOn`,** without focus, isn't
  announced.
- **A submit.** Errors it shows aren't announced one by one: focus moves to
  the first invalid field, which reads its error with its description. An
  error shown by the blur the press on the submit button caused counts as
  the submit's. When focus doesn't move, because the first invalid field
  already has it (Enter in the field just left wrong) or no invalid field
  can take focus, Form announces the first error with its field's label,
  assertively: the user would hear nothing otherwise (Resolved questions 8).
- **`setFieldErrors`** announces nothing; `focusInvalid()` does what a
  submit does.
- **The submit error** is announced assertively when the error part shows,
  from its content once rendered, as Field watches its error part.
  Development warns when `handleSubmit` failed and no error part is
  rendered.

## Styling tokens

| Token                            | On                          | Meaning                                                          |
| -------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| `data-submitting`                | root                        | From a submit until `handleSubmit` settles or the post goes out. |
| `data-invalid`                   | root                        | Some active field is invalid.                                    |
| `data-dirty`                     | root                        | Some value differs from its default.                             |
| `data-validating`                | root; a bound field's parts | A check waits or runs.                                           |
| `data-disabled`, `data-readonly` | root                        | The props.                                                       |

A bound field keeps its own tokens. UniAria ships no CSS for Form.

## Expected spoken output

Checked with the virtual screen reader when the scenarios are written.
Setup: a form named by a heading "Sign up", an Email TextField with
`isRequired` and `validationMessages: { valueMissing: 'Enter your email' }`,
and a submit button.

| Flow                                                     | Spoken                                                |
| -------------------------------------------------------- | ----------------------------------------------------- |
| The form                                                 | `form, Sign up`                                       |
| A press on Submit with Email empty: focus moves to Email | `textbox, Email, Enter your email, invalid, required` |
| Enter in Email while empty: focus stays                  | `Email Enter your email`, assertively                 |
| Email left with a bad value                              | `Email` and the error, assertively                    |
| `handleSubmit` threw                                     | the error part's text, assertively                    |

## Adapter surface

```tsx
// React
const signup = useBehavior(form, {
  defaultValues: { email: '', plan: null },
  handleSubmit: (values, { signal }) => api.signUp(values, signal),
});
const error = useBehaviorState(signup, (s) => s.submitError);

return (
  <OwnerProvider owner={signup}>
    <form {...signup.parts.root} aria-labelledby="signup-title">
      <h2 id="signup-title">Sign up</h2>
      <EmailField name="email" isRequired validate={checkEmail} />
      <PlanSelect name="plan" isRequired />
      <p {...signup.parts.error}>{String(error ?? '')}</p>
      <button type="submit">Sign up</button>
    </form>
  </OwnerProvider>
);
```

```html
<!-- Custom elements: validates, then posts natively -->
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

## Runtime changes

1. **Inherited links.** A `LinkKey` takes `isInherited: true`: it resolves
   as an owner does, from the nearest provider across other UniAria hosts,
   not only from the host the element sits in directly. That needs:
   - React: `OwnerProvider` answers link keys (`answers()`), not only owner
     definitions, and `useBehavior` looks up inherited links in context.
   - Vue: `useBehavior` injects the nearest provider of an inherited link.
   - Elements: `requestOwner` sends the request event for an inherited link
     instead of stopping at `hostAround`, and a nearer provider that
     connects later takes over, as for owners.
   - A link prop takes an instance or a handle, unwrapped as
     `OwnerProvider` does.
   - Elements provide on the root part element too, so an id lookup finds
     `<form id="signup">` inside `<uni-form>`; ids are read with
     `getAttribute('id')`, since a control named `id` shadows a form's `id`
     property. The form's own methods are called from
     `HTMLFormElement.prototype`, for the same reason (`submit`, `reset`,
     `elements`).
2. **A bindable bound to a source.** `Bindable.bind(() => source | null)`
   makes the bindable read and write through the source the function
   returns, read on every `get()`: `isControlled()` is true while there is
   one, `set()` writes it and calls the change callback for the user's
   change, and `reset()` does nothing. Binding and unbinding count as a
   change for cached `connect()` and `expose()`. The function reads the
   link and the name, so a link that resolves late, a name that changes or
   StrictMode's second start needs no imperative bind and unbind. Field
   uses it for the bindable a composing field hands over.
3. **Following part of a linked instance.** `ctx.link(key, select)` re-runs
   the follower's `connect()`, `expose()` and watches only when `select`'s
   result changes (`Object.is`), so a keystroke in one field re-runs that
   field and the form, not every bound field.
4. **No link.** A link prop set to `null` means no link, where today a plain
   prop reads `null` as unset; on elements, an empty attribute.

The store's order: a user change in a field batches the field's change
callback, the form's write and the field's hidden control write; the form's
`valuesChange` comes after, once both stores flushed, so a listener's
`FormData` already holds the new value.

## Changes to approved specs

- **Field.** Binding (Field binds, Field props for the form), its own
  `value` bindable following a native control, the `setValue` action,
  `isInvalid` unset by default, the element-owned `errorText` part,
  `data-validating`, the binding in its public state, and the announcement
  rules above. "Not part of Field: Validation" points here.
- **TextField, NumberField, Checkbox, Switch, CheckboxGroup, RadioGroup,
  Select, Combobox.** The Field props for the form; handing Field their
  bindable; `name` written on the control each submits through while set,
  and `form` written there while the form is elsewhere (both were the
  consumer's: Field's control row, NumberField's input and hidden input,
  Select's hidden `<select>`, Combobox's hidden input, the radio input);
  `reset()` stepping aside while bound. NumberField checks its own range.
  "Not part of …: Validation" points here.
- **docs/guide/forms.md,** whose Validation state, Submitting and Reset
  sections describe forms without Form.
- **AGENTS.md.** Inherited links and `form: null` (runtime changes 1 and
  4); `ctx.link` with a selector (3); `Bindable.bind` (2); a fourth
  element-owned part (`errorText`); `name` and `form` on native controls
  written by fields; actions on a component that isn't an overlay
  ("Only the overlays have any" is already out of date: Autocomplete has
  `showAll`); the first scope gains Form.

Not here: Select's hidden `<select>` focuses its trigger on every `invalid`,
so with several invalid Selects the last one wins focus. With `novalidate`
the browser fires no `invalid` on submit, so this is a fix of its own.

## Implementation

- `@uniaria/core/form`: the definition, the store of values and field
  records, checks, submit and reset. Registered in `tsdown.config.ts`,
  `package.json` `exports`, `ssr-safety.test.ts` and `.size-limit.js`.
- The binding in Field, which every field bundles. It holds no store and
  doesn't import the form definition; `pnpm size` reports what it adds to
  each field.
- `<uni-form>` in `@uniaria/elements/form`, with its `sideEffects` entry.
- `docs/components/form.mdx` with a live demo, and docs/guide/forms.md
  rewritten.
- Conformance in `conformance/src/form/`, with the fields as nested
  components and real pointer and keyboard input: a submit started by
  script behaves differently (step 7). Each field binds, checks on its
  trigger, shows and clears errors, focuses after a failed submit, resets,
  and posts natively.

## Mapping from Cube UI Kit

| UI Kit                                                     | UniAria                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `Form.useController({ defaultValues })`                    | `useBehavior(form, { defaultValues })`                                                                        |
| `<Form form onSubmit>`                                     | `OwnerProvider` and `<form {...parts.root}>`; `handleSubmit` on the behavior                                  |
| `onSubmitFailed`, `onValuesChange`                         | `submitFailed`, `valuesChange`                                                                                |
| the internal `onSubmitted`, `cancelSubmission()`           | `submitted`, `cancelSubmit()`: what `DialogForm` needs                                                        |
| `Form.useSelector`, `useValue`, `useFieldState`            | `useBehaviorState(form, (s) => …)` on `values`, `activeValues`, `fields`                                      |
| `name="email"`, `name={['user', 'email']}`                 | the same                                                                                                      |
| `useFieldProps` around any input                           | Field: `useBehavior(field, { name })` and its `setValue` action                                               |
| `rules`                                                    | UI Kit compiles them into `validate`; `{ required: true, message }` is `isRequired` with `validationMessages` |
| `validateTrigger` (field and root)                         | `validationTrigger` (field and form)                                                                          |
| `validationDelay`, `dependsOn`, `isEqual`, `preserve`      | `validationDelay`, `dependsOn`, `isEqual`, `shouldPreserve`                                                   |
| `deps`, `rulesKey`                                         | UI Kit calls `validate([name])` when its `deps` change                                                        |
| `shouldUpdate`                                             | Stays in UI Kit, in its control's change handler                                                              |
| `errorPolicy`                                              | `validate` returns every error, or only the first; Field shows the first                                      |
| `errorMessage` overriding the form's error                 | Render it in the error part without `errorText`                                                               |
| `setValue` options `validate`, `source`, `touch`, `notify` | `validation`, `source`, `shouldTouch`, `shouldNotify`                                                         |
| `setDefaultValues`, `adoptDefaultValues(next, { when })`   | `setDefaultValues(next, { replaceValues })`                                                                   |
| `reset({ values })`                                        | `reset({ values })`                                                                                           |
| `submit({ include })`, `validate(paths)` results           | The same shapes                                                                                               |
| `touch`, `batch`                                           | `touch`, `batch`                                                                                              |
| `blur`, `subscribe`, `getSnapshot`                         | Field's own blur; `useBehaviorState`; the instance                                                            |
| `setFieldErrors`, `clearFieldErrors`, `setSubmitError`     | The same actions                                                                                              |
| `Form.SubmitError`                                         | The error part, with UI Kit's Alert look                                                                      |
| `Form.Submit`, `Form.Reset`                                | UI Kit's buttons, reading `isSubmitting` and `canReset`                                                       |

## Differences from Cube UI Kit, React Aria and the platform

From UI Kit's modern form; the owner decided each (Resolved questions):

- **Focus after a failed submit.** UI Kit moves none. React Aria focuses the
  first invalid field, and a user who presses Submit and hears nothing
  can't tell what failed.
- **Native constraints count.** UI Kit's roots are `novalidate` and ignore
  them, so a consumer's `pattern` or `type="email"` stops working inside a
  form.
- **Without a submit handler, a valid form posts natively.** UI Kit with
  `action` posts without checking anything (`Form/ModernFormRoot.tsx:176`),
  and without `action` posts nothing.
- **Disabled and read-only fields aren't checked.** UI Kit checks every
  active field (`store.ts:971`); HTML and React Aria bar them.
- **`formnovalidate` is honored;** UI Kit ignores the submitter.
- **A form with no active fields submits;** UI Kit resolves `'invalid'`
  (`store.ts:1005`). `isValid` stays false with no fields, as UI Kit's.
- **Server errors set before a field mounts show when it does;** UI Kit
  clears them on registering.
- **The required message** is the browser's unless one is given; UI Kit's
  is "Required", in English.
- **The native reset runs,** for unbound controls (Resetting).
- **Select's default trigger** is `change`, as UI Kit's docs say; UI Kit's
  Picker uses `onBlur` in code.
- **The submit handler** is `handleSubmit`, not `onSubmit` (Props).

From React Aria: Form works as React Aria's `validationBehavior: 'aria'`
(`novalidate`, `aria-required`, errors shown as soon as they exist), and
also reads the native constraints, which `aria` mode drops, and focuses the
first invalid field, which only `native` mode does. Server errors come
through `setFieldErrors`, not a `validationErrors` prop.

## Deviations from the WAI-ARIA pattern

None: there is no form pattern. Errors are linked with `aria-describedby`,
not `aria-errormessage`, for Field's reasons (Field spec, Deviations).

## Resolved questions

Decided by @tenphi on 2026-10-24, each as recommended.

1. **Where values live.** (a) The form holds the bound fields' values (UI
   Kit's modern form); (b) fields keep their values and the form only
   checks and collects them. (a) gives values before mount, retained
   values, program writes and a typed payload; (b) changes no bindable but
   leaves `setValue` and `defaultValues` to each field. Decided: (a).
2. **Where the binding lives.** (a) In Field, which every field composes
   and which binds any control, custom or native; (b) a separate
   `formField` behavior each field composes beside Field. (a) costs every
   field the binding's size, form or not; (b) costs the same in every field
   and adds a second public behavior for custom controls. Decided: (a).
3. **Rules.** (a) `isRequired`, native constraints and `validate`; UI Kit
   compiles its rule objects into `validate`; (b) UI Kit's rule objects
   built in. Decided: (a).
4. **Native constraints.** (a) Count them, through a detached control;
   (b) ignore them, as UI Kit does. Decided: (a).
5. **Error text.** (a) An optional element-owned `errorText` part inside
   the error part, which Field fills with a string error; leave it out to
   render errors yourself; (b) the whole error part element-owned while
   bound; (c) the consumer always renders errors from state, and elements
   need a script. Decided: (a).
6. **Focus after a failed submit.** (a) The first invalid field, visibly,
   and `submit()` does it too unless `shouldFocus: false`; (b) none, as UI
   Kit. Decided: (a).
7. **Without a submit handler.** (a) Check, then post natively; (b) post
   without checking when `action` is set, else nothing, as UI Kit.
   Decided: (a).
8. **Announcing a failed submit.** (a) Focus reads the first error; Form
   announces it only when focus doesn't move; (b) as (a), and also the
   number of invalid fields when there are several ("3 fields have
   errors"), politely, from a translatable message; (c) every field
   announces its own. Decided: (a).
9. **Disabled and read-only fields.** (a) Not checked, still in the payload;
   (b) checked, as UI Kit. Decided: (a).
10. **Names.** (a) Keys and paths, as UI Kit; (b) keys only, and UI Kit
    flattens its paths. Decided: (a).
11. **`handleSubmit`,** a function prop the form waits for, with
    `submitted`, `submitFailed` and `valuesChange` as events. Decided: yes.
12. **Server errors before mount.** (a) Kept until the field mounts and
    shown then; (b) cleared on registering, as UI Kit. Decided: (a).
