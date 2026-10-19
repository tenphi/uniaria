# CheckboxGroup spec

Status: approved by @tenphi on 2026-10-15

## Summary

A checkbox group is a labelled set of checkboxes whose value is the list of
the selected ones. CheckboxGroup composes Field on its root, which becomes a
`role="group"` named by the group label and described by the group's
description and error. Each checkbox stays a separate Checkbox instance that
finds its group through `ctx.owner()` (decision 11) and takes from it its
selected state, disabled and read-only modes, and the group's required and
invalid states.

- **WAI-ARIA pattern:** [Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/):
  a group of checkboxes is `role="group"` with `aria-labelledby`, and
  `aria-describedby` for its description
  (`references/aria-practices/content/patterns/checkbox/checkbox-pattern.html`).
- **Builds on:** Field (`ctx.use`), `createFocusWithin` from `dom/`, Checkbox, and
  `ctx.owner()`, which the runtime and both adapters gain for it (Resolved
  questions 1). RadioGroup will use the same link.
- **Owner:** CheckboxGroup is the owner; its checkboxes are owned.
- **Custom element:** yes, `<uni-checkbox-group>`, hosting consumer markup
  with `<uni-checkbox>` elements inside it.

Not part of CheckboxGroup:

- **Validation.** As in Field: the group shows `isInvalid`, the form decides
  it.
- **A select-all checkbox.** A checkbox outside the group whose
  `isSelected` and `isIndeterminate` the consumer computes from the group's
  value, as Cube UI Kit's TableView does.
- **Orientation and layout.** Cube UI Kit's `orientation` only switches the
  layout, with no ARIA; it stays consumer styling.
- **Roving focus.** Checkboxes are each in the Tab order, as native ones
  are and as the APG has them. RadioGroup is where the owner tracks its
  children in DOM order.

## Anatomy

| Part        | Element                                                   | Attributes UniAria owns                                                                                                                | Notes                                                                                                                                                                                                                 |
| ----------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root        | any; usually `div`                                        | `role="group"`, `aria-disabled`; as Field's control: `id` (unless it has one), `aria-labelledby`, `aria-describedby`; state attributes | The outermost element: holds the label, the description, the error and the checkboxes. Field's `aria-invalid` and `aria-required` are left off: screen readers don't read them on a group (see Required and invalid). |
| label       | `span` by default; any element through `labelElementType` | as Field: `id` (unless it has one), state attributes                                                                                   | A group can't be labelled natively, so no `for`. A `<fieldset>` root with a `<legend>` label works too.                                                                                                               |
| description | any                                                       | as Field                                                                                                                               |                                                                                                                                                                                                                       |
| error       | any                                                       | as Field                                                                                                                               | Announced by Field when it appears.                                                                                                                                                                                   |

Changed on 2026-10-19 (owner): the root is the outermost element, so the label,
the description and the error go inside it, as in React Aria.

The checkboxes are `<uni-checkbox>` elements or `useComponent(checkbox)`
components inside the root, or linked from elsewhere (Owner link). State
attributes go on every part: `data-disabled`, `data-readonly`,
`data-invalid`, `data-required`, `data-focus-within` and
`data-focus-visible` (focus within came by keyboard).

A part keeps an `id` the consumer gives its element, in both adapters, and
every reference to the part follows it; UniAria writes an `id` only on a
part that has none (root AGENTS.md → DOM, lifecycle and SSR).

## Props

| Prop             | Type                  | Default  | Bindable | Change event  | Notes                                                                                                                                                              |
| ---------------- | --------------------- | -------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| value            | `string[]`            | `[]`     | yes      | `valueChange` | The `value` of each selected checkbox. A newly selected value goes last, as in React Aria.                                                                         |
| name             | `string \| undefined` | —        | no       | —             | Written to every checkbox's `name` while set, so a form submits each selected value under it. No generated name: checkboxes don't need one (Resolved questions 5). |
| isDisabled       | `boolean`             | `false`  | no       | —             | Disables every checkbox natively; `aria-disabled="true"` on the root.                                                                                              |
| isReadOnly       | `boolean`             | `false`  | no       | —             | Every checkbox becomes read-only.                                                                                                                                  |
| isRequired       | `boolean`             | `false`  | no       | —             | See Required and invalid.                                                                                                                                          |
| isInvalid        | `boolean`             | `false`  | no       | —             | Shows and announces the group's error; see Required and invalid.                                                                                                   |
| labelElementType | `string`              | `'span'` | no       | —             | Field's. The element reads the label's tag.                                                                                                                        |
| labelledBy       | `string \| undefined` | —        | no       | —             | Field's.                                                                                                                                                           |
| describedBy      | `string \| undefined` | —        | no       | —             | Field's.                                                                                                                                                           |

Checkbox gains one prop for groups (Resolved questions 2):

| Prop  | Type                  | Default | Notes                                                                                                                         |
| ----- | --------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| value | `string \| undefined` | —       | The checkbox's key in its group's value. Written to the input's `value` attribute, so a form submits it. Required in a group. |

## Events

| Event         | Detail     | When                                                                                                            |
| ------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| `valueChange` | `string[]` | A checkbox in the group was toggled, or a form reset requests the default. Never for a value the consumer sets. |
| `focusChange` | `boolean`  | Focus entered or left the group (focus within), for a form that validates on blur, as Cube UI Kit's does.       |

## Public state

| Field          | Type       | Meaning                              |
| -------------- | ---------- | ------------------------------------ |
| value          | `string[]` | The current value.                   |
| isDisabled     | `boolean`  | The prop.                            |
| isReadOnly     | `boolean`  | The prop.                            |
| isRequired     | `boolean`  | The prop.                            |
| isInvalid      | `boolean`  | The prop.                            |
| isErrorShown   | `boolean`  | Field's: invalid and not disabled.   |
| isFocusWithin  | `boolean`  | Focus is on a checkbox in the group. |
| isFocusVisible | `boolean`  | Focus within came by keyboard.       |

## A checkbox in a group

A checkbox with an owner group takes from it:

- **Selected.** `isSelected` is whether the group's value holds its `value`;
  a toggle adds or removes it through the group, which reports
  `valueChange`. Its own `isSelected`, `defaultSelected` and form reset are
  unused, as in React Aria and Cube UI Kit; a development warning names a
  controlled `isSelected` and a missing `value`. (`defaultSelected` gets no
  warning: an element's markup `checked` sets it, and joins the group's
  default instead.) Each toggle of a controlled group follows Checkbox's rule: the
  browser's toggle shows, and goes back after the event unless the
  consumer accepts the new value.
- **Name.** The group's `name`, while set.
- **Disabled and read-only.** The group's, or its own.
- **Required and invalid.** See below.
- **Description.** Its `aria-describedby` gains the group's error while it is
  shown (Resolved questions 4).
- **Indeterminate** stays its own.

The group's value only ever holds values the consumer puts there or a
checkbox adds: a value with no checkbox stays in it, and a checkbox removed
from the page keeps its value in the group, as in React Aria.

## Required and invalid

Screen readers don't read `aria-required` or `aria-invalid` on a group or a
`<fieldset>` (probed with the virtual screen reader; Chromium exposes invalid
but not required, and `aria-required` isn't allowed on `role="group"`). So,
as React Aria and Cube UI Kit do:

- **Required** puts `aria-required="true"` on every checkbox while the
  group's value is empty, and takes it off once one is selected (Resolved
  questions 3).
- **Invalid** puts `aria-invalid="true"` on every checkbox and links the
  group's error to each, so focusing any of them reads why.

The group's own error is announced once by its Field when it appears.

## Form reset

On the form's `reset` event (skipped when `defaultPrevented`) the group goes
back to its default, as TextField does, and its checkboxes follow. An
uncontrolled group follows `defaultValue` again, one set after mount
included; without one, the values its checkboxes adopted from the markup. A
controlled group asks for `defaultValue`, or without one the value it
mounted with. As in Checkbox, the native reset runs afterwards and
CheckboxGroup writes its checkboxes' state again.

## Owner link

How a checkbox finds its group, from decision 11:

1. **Explicit link.** React: the group's instance in the checkbox's `owner`
   prop, for a checkbox rendered apart (another root, a portal outside
   React). Elements: `<uni-checkbox group="notifications">`, the id of
   the group's host, resolved in the checkbox's root node.
2. **React context.** `<OwnerProvider owner={group}>` around the
   checkboxes provides the group's instance through a React context that
   holds only the stable instance, so a checkbox rendered inside it is
   linked from its first render: the server HTML already has `checked` for
   a selected value. A hook can't provide a context itself, so the consumer
   renders the provider; without it, step 3 links the checkbox after
   mount.
3. **Nearest DOM ancestor.** On connect, the checkbox dispatches a
   bubbling request event (the Context Community Protocol's shape), and the
   nearest group answers; a group that connects later announces itself and
   waiting checkboxes ask again. This links elements in any upgrade order,
   and a React checkbox inside a `<uni-checkbox-group>`.

The checkbox reads its group through `ctx.owner()`. Reading it subscribes
the checkbox's binder to the group's store, so a change of the group's value
re-runs each checkbox's `connect()` and nothing renders.

## Keyboard

None of its own: Tab moves through the checkboxes, and Space toggles each,
natively.

## ARIA and state attributes per state

| State           | Part       | Attributes                                                                 |
| --------------- | ---------- | -------------------------------------------------------------------------- |
| idle            | root       | `role="group"`, Field's `id`, `aria-labelledby`, `aria-describedby`        |
| disabled        | root       | + `aria-disabled="true"`                                                   |
|                 | every part | + `data-disabled`; the error hidden (Field)                                |
|                 | checkboxes | as a disabled Checkbox                                                     |
| read-only       | every part | + `data-readonly`; checkboxes as a read-only Checkbox                      |
| required, empty | checkboxes | `aria-required="true"`                                                     |
| required        | every part | + `data-required`                                                          |
| invalid         | every part | + `data-invalid`                                                           |
|                 | checkboxes | `aria-invalid="true"`, the group's error in `aria-describedby` while shown |
| focus within    | every part | + `data-focus-within`, + `data-focus-visible` after keyboard focus         |

## Focus

CheckboxGroup moves no focus. Focus within reports on every part, so the
group can show a ring around all of its checkboxes, and
`data-focus-visible` limits that ring to keyboard focus, as on RadioGroup.

## Pointer and touch

None of its own.

## Expected spoken output

Confirmed with `@guidepup/virtual-screen-reader` for a group "Notifications"
described by "Pick at least one", with checkboxes "Email" and "SMS".

| State                           | Spoken phrase                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| reading through                 | `group, Notifications, Pick at least one`, then each checkbox, then `end of group, Notifications, Pick at least one` |
| a checkbox focused              | `checkbox, Email, not checked` (the virtual reader doesn't name the group on focus; screen readers do on entering)   |
| disabled                        | `group, Notifications, disabled`                                                                                     |
| required, nothing selected      | `checkbox, Email, not checked, required`                                                                             |
| invalid, the error "Select one" | `checkbox, Email, Select one, not checked, invalid`                                                                  |

## Adapter surface

```tsx
// React
const group = useComponent(checkboxGroup, {
  name: 'notifications',
  defaultValue: ['email'],
  onValueChange,
});
return (
  <div {...group.parts.root}>
    <span {...group.parts.label}>Notifications</span>
    <OwnerProvider owner={group}>
      <Option value="email">Email</Option>
      <Option value="sms">SMS</Option>
    </OwnerProvider>
    <p {...group.parts.error}>Pick at least one</p>
  </div>
);

function Option({ value, children }) {
  // Linked to the group above through OwnerProvider.
  const option = useComponent(checkbox, { value, labelElementType: 'span' });
  return (
    <label {...option.parts.root}>
      <input {...option.parts.input} />
      <span {...option.parts.label}>{children}</span>
    </label>
  );
}
```

```html
<!-- Custom element -->
<uni-checkbox-group name="notifications" required>
  <div data-uni="checkbox-group">
    <span data-element="Label">Notifications</span>
    <uni-checkbox value="email">
      <label data-uni="checkbox">
        <input data-element="Input" type="checkbox" checked />
        <span data-element="Label">Email</span>
      </label>
    </uni-checkbox>
    <uni-checkbox value="sms">…</uni-checkbox>
  </div>
</uni-checkbox-group>
```

Element attributes: `name`, `disabled`, `readonly`, `required`, `invalid`,
`labelled-by`, `described-by`. Properties: `value` (controlled),
`defaultValue`. Events: `valuechange`, `focuschange`. The group's default is
the `value` of each checkbox whose input is checked when they link, so
markup `checked` and clicks before upgrade survive, as Checkbox's do.
`<uni-checkbox>` gains `value` and `group`.

## Mapping from Cube UI Kit

CheckboxGroup backs `Checkbox.Group`.

- `value`, `defaultValue` and `onChange(value)` map to `value`,
  `defaultValue` and `onValueChange`; casting non-arrays stays in UI Kit.
- `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `label`,
  `description` and `errorMessage` map as in Field's spec.
- Each `Checkbox` inside maps to a Checkbox with `value`; UI Kit's
  `CheckboxGroupContext` and its conditional hook swap go away, since the
  checkbox finds its group itself. The warnings for `isSelected` and a
  missing `value` move into UniAria.
- `orientation` stays UI Kit styling. `name` goes on each input, as UI Kit
  already passes it; the form binding stays UI Kit's.
- **Fixes.** The group's description and error become linked (the error to
  every checkbox), and a group without a `label` keeps `role="group"` and its
  name (fixed in UI Kit by #1509 too). A checkbox moving in or out of a group
  works, where UI Kit captures the group once at mount.

## Deviations from the WAI-ARIA pattern

None.

## Resolved questions

Decided by @tenphi on 2026-10-15.

1. **`ctx.owner()` in the runtime and adapters.** This is decision 11's
   first user:
   - A definition that can be owned names its owner and the element
     attribute for the explicit link:
     `defineComponent({ …, owner: { definition: checkboxGroup, attribute: 'group' } })`.
     Its props gain `owner` (an instance, React's explicit link), and its
     element gains the `group` attribute (the explicit link by id).
   - `ctx.owner(checkboxGroup)` in `setup()` returns `undefined` or the
     group's `instance`, `api` and `state()`; reading it subscribes the
     child to the group's store.
   - `dom/` holds the request event and the late announcement
     (`provideOwner`, `requestOwner`), which both adapters use.
   - React: the approved shape had `useComponent` provide every instance
     through one context, but a hook can't render a provider. The consumer
     renders `<OwnerProvider owner={group}>` around the checkboxes instead
     (Owner link). Without one, the DOM request links the checkbox after
     mount, so only the server HTML differs.
2. **Checkbox gains a `value` prop that UniAria writes to the input.** The
   checkbox needs its key at render time, before any DOM exists, so the
   server HTML of a group shows which are checked. UniAria writes the input's
   `value` when the prop is set, and the consumer leaves it.
3. **Required on every checkbox while nothing is selected**, as React Aria
   and Cube UI Kit do. Screen readers then say "required" on each checkbox,
   which can sound like each one must be checked, but nothing else is read:
   `aria-required` on a group is neither allowed nor read.
4. **The group's error on every checkbox, its description only on the
   group.** React Aria adds both to each checkbox's `aria-describedby`, so
   the description is read again on every checkbox. Screen readers read the
   group's name and description when focus enters it, so only the error
   goes on each checkbox: it explains an invalid checkbox wherever focus
   lands.
5. **`name` and focus-visible**, from the gate 3 API review, approved by @tenphi on 2026-10-16. The
   group writes its `name` to every checkbox, as RadioGroup does and as
   React Aria's CheckboxGroup does, but generates none. Focus within
   reports `isFocusVisible`, as RadioGroup's does.

## Open questions

None.
