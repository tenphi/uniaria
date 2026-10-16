# Switch spec

Status: approved by @tenphi on 2026-10-16

## Summary

A switch is an on/off control: a native `<input type="checkbox">` with
`role="switch"`, a label, a description and an error message. Switch is
Checkbox without the indeterminate state or a group: the same Field
labelling, selected state, read-only mode, form reset and interaction
state, and the browser keeps doing the toggling. Only the role and the
parts differ.

- **WAI-ARIA pattern:** [Switch](https://www.w3.org/WAI/ARIA/apg/patterns/switch/)
  (`references/aria-practices/content/patterns/switch/`). Its
  checkbox-based example is this markup: `role="switch"` on a native
  checkbox, whose `checked` state stands in for `aria-checked`.
- **Builds on:** Checkbox's core, moved out of `checkbox.ts` into a
  function both definitions call: the selected state with its controlled
  rule, read-only, form reset, hover, focus and Field. Checkbox keeps its
  indeterminate state and its group link on top. Composing Checkbox through
  `ctx.use()` instead would bundle CheckboxGroup with every switch and
  re-declare Checkbox's adopted props. Checkbox's 35 scenarios guard the
  move.
- **Owner:** none. A switch never joins a CheckboxGroup.
- **Custom element:** yes, `<uni-switch>`, hosting consumer markup.

Not part of Switch:

- **Indeterminate.** A switch is binary in the APG and ARIA, and has no
  `isIndeterminate`.
- **Groups.** A set of switches is consumer markup: a `fieldset` with a
  `legend`, or a `role="group"` named by its heading, as in the APG
  example. No value list, as there is no SwitchGroup in React Aria or Cube
  UI Kit.
- **Loading.** Cube UI Kit's `isLoading` only adds a spinner (Open
  questions 3).
- **Presentation.** The track, the thumb, sizes and the "On"/"Off" text are
  consumer markup. The label stays the same in both states, as the APG
  requires: a state word in the name is read twice.
- **Validation**, **a disabled `<fieldset>`** and **a pressed state**: as in
  Checkbox.

## Anatomy

| Part        | Element                                                        | Attributes UniAria owns                                                                                                                                                                                                               | Notes                                                                                                                                                    |
| ----------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root        | any; a `label` makes its whole area toggle the switch natively | state attributes                                                                                                                                                                                                                      | Optional. No role.                                                                                                                                       |
| input       | `input`                                                        | `type="checkbox"`, `role="switch"`; as Field's control: `id`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`; plus `disabled` (or `aria-disabled`), `aria-readonly`, the `checked` property, state attributes | The consumer owns `name`, `value`, `form`, `autofocus`, `tabindex`, the `checked` attribute, and the styles that hide the input or lay it over the root. |
| indicator   | any; usually `span`                                            | `aria-hidden="true"`, state attributes                                                                                                                                                                                                | Optional. The track drawn in place of the input; the thumb is consumer markup inside it (Resolved questions 1).                                          |
| label       | `label` by default; any element through `labelElementType`     | as Field: `id`, `for` (only on a `label`), state attributes                                                                                                                                                                           | Names the switch. Inside a `label` root it must be a `span`.                                                                                             |
| description | any                                                            | as Field                                                                                                                                                                                                                              | Outside a `label` root.                                                                                                                                  |
| error       | any                                                            | as Field                                                                                                                                                                                                                              | Outside a `label` root.                                                                                                                                  |

State attributes go on every part: `data-selected`, `data-hovered`,
`data-focused`, `data-focus-visible`, `data-disabled`, `data-readonly`,
`data-invalid` and `data-required`. The two layouts of Checkbox (a `label`
root, or a `div` root with a `label` part) work the same way.

## Props

As Checkbox, without `isIndeterminate` and `value`:

| Prop                    | Type                  | Default   | Bindable | Change event     | Notes                                                                                                     |
| ----------------------- | --------------------- | --------- | -------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| isSelected              | `boolean`             | `false`   | yes      | `selectedChange` | On or off: the input's `checked` property, with Checkbox's rules.                                         |
| isDisabled              | `boolean`             | `false`   | no       | —                | Native `disabled`, plus Field's `isDisabled`.                                                             |
| isFocusableWhenDisabled | `boolean`             | `false`   | no       | —                | As Checkbox's: `aria-disabled` instead of `disabled`, so a tooltip can explain it (Resolved questions 5). |
| isReadOnly              | `boolean`             | `false`   | no       | —                | `aria-readonly="true"`, and every toggle is cancelled. Attribute `readonly`.                              |
| isRequired              | `boolean`             | `false`   | no       | —                | Field's: `aria-required` (Resolved questions 2).                                                          |
| isInvalid               | `boolean`             | `false`   | no       | —                | Field's: `aria-invalid`, shows and announces the error (Resolved questions 2).                            |
| inputId                 | `string \| undefined` | generated | no       | —                | Field's `controlId`. The element adopts the input's `id`.                                                 |
| labelElementType        | `string`              | `'label'` | no       | —                | Field's. The element reads the label's tag.                                                               |
| labelledBy              | `string \| undefined` | —         | no       | —                | Field's.                                                                                                  |
| describedBy             | `string \| undefined` | —         | no       | —                | Field's.                                                                                                  |

`value` stays the consumer's attribute on the input, since no group needs
it at render time.

## Events

As Checkbox: `selectedChange` (`boolean`) when the user toggles the switch
or a form reset requests the default, and `focusChange` (`boolean`). In
React the input's `onInput`, `onClick`, `onFocus` and `onBlur` belong to
UniAria.

## Public state

As Checkbox, without `isIndeterminate`: `isSelected`, `isFocused`,
`isFocusVisible`, `isHovered`, `isDisabled`, `isReadOnly`, `isRequired`,
`isInvalid` and `isErrorShown`.

## Selection

Checkbox's rules, unchanged: the state is the `checked` property, written
only when it differs and rendered once by React as `defaultChecked`; never
`aria-checked`, which ARIA in HTML disallows on the native input and
Chromium ignores. A controlled toggle the consumer hasn't accepted goes
back right after the event. Read-only cancels the click, and so does a
disabled switch with `isFocusableWhenDisabled`, which is left out of its
form's data as a natively disabled one is. Form reset returns
to the mount state and writes it again after the native reset. The element
adopts the input's `checked` property on upgrade.

Switch never writes `indeterminate`. Chromium exposes an indeterminate
switch as `mixed`, which ARIA treats as off, so a consumer that sets the
property gets that.

## Keyboard

| Key   | Action                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Space | Toggles, natively. Nothing when read-only.                                                                                                                                                             |
| Enter | Nothing on the switch: it submits its form natively, as in React Aria (tested there), Cube UI Kit's code and Spectrum Web Components. The APG marks Enter optional, and its checkbox example has none. |
| Tab   | Moves focus natively; a disabled switch is skipped, unless `isFocusableWhenDisabled`.                                                                                                                  |

## ARIA and state attributes per state

| State             | Part       | Attributes                                                                                                      |
| ----------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| idle              | input      | `type="checkbox"`, `role="switch"`; Field's `id`, `aria-labelledby`, `aria-describedby`; the `checked` property |
|                   | indicator  | `aria-hidden="true"`                                                                                            |
| on                | input      | `checked` property true                                                                                         |
|                   | every part | + `data-selected`                                                                                               |
| hovered           | every part | + `data-hovered`                                                                                                |
| focused           | every part | + `data-focused`; + `data-focus-visible` after keyboard or virtual focus                                        |
| disabled          | input      | + `disabled`; `aria-disabled="true"` instead with `isFocusableWhenDisabled`                                     |
|                   | every part | + `data-disabled`; the error hidden (Field)                                                                     |
| read-only         | input      | + `aria-readonly="true"`                                                                                        |
|                   | every part | + `data-readonly`                                                                                               |
| invalid, required | as Field   | `aria-invalid="true"`, `aria-required="true"`, `data-invalid`, `data-required`                                  |

`switch` inherits `aria-readonly`, `aria-required` and `aria-invalid` from
`checkbox` in ARIA 1.2.

## Focus and pointer

As Checkbox: the input takes focus, Switch moves none, a click on the input
or a `label` toggles natively, and hover is tracked on the root and the
input, off while disabled.

## Expected spoken output

Confirmed with `@guidepup/virtual-screen-reader` on a label "Wi-Fi" and a
native checkbox with `role="switch"`.

| State                    | Spoken phrase                                          |
| ------------------------ | ------------------------------------------------------ |
| off                      | `switch, Wi-Fi, not checked`                           |
| on                       | `switch, Wi-Fi, checked`                               |
| with a description       | `switch, Wi-Fi, Uses more battery, not checked`        |
| read-only                | `switch, Wi-Fi, not checked, read only`                |
| required                 | `switch, Wi-Fi, not checked, required`                 |
| invalid, the error shown | `switch, Wi-Fi, Turn on to sync, not checked, invalid` |
| invalid and required     | `switch, Wi-Fi, not checked, invalid, required`        |
| disabled                 | `switch, Wi-Fi, not checked, disabled` (not focusable) |
| focusable and disabled   | `switch, Wi-Fi, not checked, disabled`                 |

The virtual reader says "checked" and "not checked" for every role; VoiceOver,
JAWS and current NVDA say "on" and "off" for a switch (from their
documentation, not tested here). As in Checkbox, it takes the state only
from the `checked` attribute, so scenarios check the property, and
`spoken()` covers the on state only where the markup carries the attribute.

## Adapter surface

```tsx
// React
const wifi = useComponent(toggleSwitch, {
  labelElementType: 'span',
  onSelectedChange,
});
return (
  <label {...wifi.parts.root}>
    <input {...wifi.parts.input} name="wifi" />
    <span {...wifi.parts.indicator}>
      <span className="thumb" />
    </span>
    <span {...wifi.parts.label}>Wi-Fi</span>
  </label>
);
```

```html
<!-- Custom element -->
<uni-switch>
  <label data-part="root">
    <input data-part="input" type="checkbox" name="wifi" checked />
    <span data-part="indicator"><span class="thumb"></span></span>
    <span data-part="label">Wi-Fi</span>
  </label>
</uni-switch>
```

The definition is exported from `@uniaria/core/switch` as `toggleSwitch`
(Resolved questions 4); its name, `data-scope` and element stay `switch`.

Element attributes: `default-selected`, `disabled`,
`focusable-when-disabled`, `readonly`, `required`,
`invalid`, `labelled-by`, `described-by`. Properties: `isSelected`
(controlled), `defaultSelected`. Events: `selectedchange`, `focuschange`.
The element adopts the input's `checked` property and `id`, and the label's
tag.

## Mapping from Cube UI Kit

Switch backs UI Kit's Switch.

- `isSelected`, `defaultSelected` and `onChange(isSelected)` map to
  `isSelected`, `defaultSelected` and `onSelectedChange`.
- `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `label`,
  `description`, `errorMessage` and `id` map as in Checkbox's spec, and
  `children` (the inline label) to the label part.
- `name`, `value`, `autoFocus` and `qa` are the consumer's attributes on
  the input.
- The `data-element="Input"` track maps to the indicator part, with the
  Thumb inside it. `size`, `isLoading` and its spinner, `inputStyles`,
  `labelPosition` and the necessity mark stay in UI Kit.
- Mods: `checked` maps to `data-selected`, `disabled`, `invalid` and
  `hovered` to the same `data-*`, and `focused` (focus-visible only) to
  `data-focus-visible`.
- **Fixes.** Read-only gets `data-readonly`, which UI Kit lacks, so it can
  be styled. Descriptions and errors become linked and announced (Field).
  UI Kit's docs say Enter toggles and that the switch sets `aria-checked`;
  the code does neither (cube-js/cube-ui-kit#1522).

## Deviations from the WAI-ARIA pattern

None. Enter is optional in the pattern.

## Resolved questions

Decided by @tenphi on 2026-10-16.

1. **One `indicator` part, no `thumb` part.** The track is Checkbox's
   `indicator` part, so styles and the shared core carry over. The thumb is
   plain markup inside it, styled from the track's state attributes
   (`[data-selected] > .thumb`, or Tasty's mods on the root); a `thumb`
   part would only copy those attributes onto it. Zag has `control` and
   `thumb`; Cube UI Kit draws a track with a Thumb inside.
2. **Required, invalid, the description and the error stay**, from Field as
   in Checkbox. React Aria's hook and Cube UI Kit's Switch have them; React
   Aria Components' plain `Switch` drops them and its `SwitchField` adds
   them back.
3. **Loading stays in Cube UI Kit.** UI Kit's `isLoading` renders an
   `aria-hidden` spinner and nothing else, while its story says it disables
   interaction and its docs say the state is announced. UI Kit passes
   `isReadOnly` while loading, which blocks toggles and keeps focus where it
   is. The mismatch is in cube-js/cube-ui-kit#1522.
4. **The export is `toggleSwitch`.** `switch` is a reserved word, so the
   definition can't be `export const switch` like `checkbox`.
   `toggleSwitch` is the control's common name and reads like
   `toggleButton`. Its name, `data-scope` and element stay `switch`.
5. **`isFocusableWhenDisabled`** (Tooltip spec, Resolved questions 12,
   decided by @tenphi on 2026-10-16): as Checkbox's, so a tooltip can
   explain a disabled switch to the keyboard. No automatic switch when a
   tooltip links: the design system sets it.

## Open questions

None.
