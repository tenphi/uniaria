# Checkbox spec

Status: approved by @tenphi on 2026-10-15

## Summary

A checkbox is a native `<input type="checkbox">` with a label, a description
and an error message. Checkbox composes Field for the labelling
(`ctx.use(field, props, { parts: { control: 'input' } })`) and adds the
selected and indeterminate states, read-only mode and interaction state. The
browser keeps doing the toggling: a click on the input or on its label, and
Space, toggle it natively, and Enter submits its form.

- **WAI-ARIA pattern:** [Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
  (`references/aria-practices/content/patterns/checkbox/`). The pattern
  builds `role="checkbox"` with `aria-checked`; UniAria uses the native input,
  which the APG examples recommend over ARIA ("No ARIA is better than Bad
  ARIA") and whose switch pattern describes.
- **Builds on:** Field (`ctx.use`), `hover` and `focus` from `dom/`, and the
  live-property channel TextField added (`checked`, `indeterminate`).
- **Owner:** none. CheckboxGroup will own its checkboxes through
  `ctx.owner()` (decision 11); its spec says which props the group sets.
- **Tooltip:** takes a Tooltip through its `tooltip` link (Tooltip spec, Resolved
  questions 2): the tooltip instance in React (`tooltip: hint.instance`),
  and on elements the `<uni-tooltip>` it sits in directly or a `tooltip`
  attribute naming one's id. Hover counts on the root, focus and
  presses on the input, and the tooltip is placed against the root
  (UI Kit's split trigger). The input carries the tooltip's id after its
  own references: `aria-describedby` after the description and error
  (`aria-labelledby` with `relation: 'label'`), while the tooltip is
  enabled.
- **Custom element:** yes, `<uni-checkbox>`, hosting consumer markup.

Not part of Checkbox:

- **Validation.** As in Field: Checkbox shows `isInvalid`, the form decides
  it. No native `required`, `setCustomValidity` or `invalid` handling.
- **Switch.** Next on the roadmap, as its own definition on Checkbox's core:
  `role="switch"` on the same native input, no indeterminate state. React
  Aria and Cube UI Kit have separate components, and the APG a separate
  pattern. It gets a short spec of its own.
- **Groups.** CheckboxGroup (`../checkbox-group/spec.md`): the `string[]`
  value, the group label, and group-wide disabled, read-only, required and
  invalid states. A checkbox finds its group through `ctx.owner()` and
  takes them from it; that spec's "A checkbox in a group" has the rules.
- **A disabled `<fieldset>`** disables the input natively, but `isDisabled`
  and `data-disabled` don't follow it. Zag watches for it; UniAria can when a
  form or group needs it.
- **A pressed state.** No `data-pressed`: CSS `:active` covers it, and Cube
  UI Kit has none.
- **Presentation.** The check and dash icons, sizes, tooltips and the
  validation indicator are consumer markup.

## Anatomy

| Part        | Element                                                          | Attributes UniAria owns                                                                                                                                                                                                                    | Notes                                                                                                                                                                                                             |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root        | any; a `label` makes its whole area toggle the checkbox natively | state attributes                                                                                                                                                                                                                           | Optional. No role.                                                                                                                                                                                                |
| input       | `input`                                                          | `type="checkbox"`; as Field's control: `id`, `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`; plus `disabled` (or `aria-disabled`), `aria-readonly`, the `checked` and `indeterminate` properties, state attributes | The consumer owns `name`, `value` (unless the `value` prop is set), `form`, `autofocus`, `tabindex`, the `checked` attribute, and the styles that hide the input or lay it over the root (Cube UI Kit's overlay). |
| indicator   | any; usually `span`                                              | `aria-hidden="true"`, state attributes                                                                                                                                                                                                     | Optional. The box drawn in place of the input, holding the check or the dash.                                                                                                                                     |
| label       | `label` by default; any element through `labelElementType`       | as Field: `id`, `for` (only on a `label`), state attributes                                                                                                                                                                                | Names the checkbox. Inside a `label` root it must be another element, a `span`: labels can't nest.                                                                                                                |
| description | any                                                              | as Field                                                                                                                                                                                                                                   | Outside a `label` root, where a click on it would toggle the checkbox.                                                                                                                                            |
| error       | any                                                              | as Field                                                                                                                                                                                                                                   | Outside a `label` root, as the description.                                                                                                                                                                       |

State attributes go on every part, so the box, the label and the messages can
be styled without reading state: `data-selected`, `data-indeterminate`,
`data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`,
`data-readonly`, `data-invalid` and `data-required`.

Two layouts work without any script for the click:

- **A `label` root** (Cube UI Kit, React Aria Components): the root wraps the
  input, the indicator and a `span` label part, so a click anywhere in it
  toggles. Cube UI Kit lays the transparent input over the whole root.
- **A `div` root**: the label part is a `label`, whose `for` Field writes.
  Only the input and the label toggle; an indicator outside the label
  doesn't.

## Props

| Prop                    | Type                  | Default   | Bindable | Change event     | Notes                                                                                                                                  |
| ----------------------- | --------------------- | --------- | -------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| isSelected              | `boolean`             | `false`   | yes      | `selectedChange` | The input's `checked` property. See Selection. The name follows React Aria, Cube UI Kit and ToggleButton.                              |
| isIndeterminate         | `boolean`             | `false`   | no       | —                | The input's `indeterminate` property. Presentational, as in React Aria and Cube UI Kit: see Selection.                                 |
| isDisabled              | `boolean`             | `false`   | no       | —                | Native `disabled` on the input, plus Field's `isDisabled` (marks every part, hides the error).                                         |
| isFocusableWhenDisabled | `boolean`             | `false`   | no       | —                | As Radio's: `aria-disabled` instead of `disabled`, so a tooltip can explain it; never toggles, never submitted (Resolved questions 3). |
| isReadOnly              | `boolean`             | `false`   | no       | —                | `aria-readonly="true"`, and every toggle is cancelled. Not the `readonly` attribute (see Selection). Attribute `readonly`.             |
| isRequired              | `boolean`             | `false`   | no       | —                | Field's: `aria-required`, never native `required`.                                                                                     |
| isInvalid               | `boolean`             | `false`   | no       | —                | Field's: `aria-invalid`, shows and announces the error.                                                                                |
| inputId                 | `string \| undefined` | generated | no       | —                | Field's `controlId`. The element adopts the input's `id`.                                                                              |
| labelElementType        | `string`              | `'label'` | no       | —                | Field's. Pass `'span'` for a label part inside a `label` root. The element reads the label's tag.                                      |
| labelledBy              | `string \| undefined` | —         | no       | —                | Field's.                                                                                                                               |
| describedBy             | `string \| undefined` | —         | no       | —                | Field's.                                                                                                                               |
| value                   | `string \| undefined` | —         | no       | —                | The key in a CheckboxGroup's value; required in a group. Written to the input's `value` when set, so a form submits it.                |

## Events

| Event            | Detail    | When                                                                                                                                                                                          |
| ---------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `selectedChange` | `boolean` | The user toggled the checkbox (the input's `input` event, right before `change`; the detail is its new `checked`), or a form reset requests the default. Never for a value the consumer sets. |
| `focusChange`    | `boolean` | The input gained or lost focus, as in TextField. In React the input's `onInput`, `onClick`, `onFocus` and `onBlur` belong to UniAria.                                                         |

## Public state

| Field           | Type      | Meaning                                                      |
| --------------- | --------- | ------------------------------------------------------------ |
| isSelected      | `boolean` | The current state.                                           |
| isIndeterminate | `boolean` | The prop.                                                    |
| isFocused       | `boolean` | The input has focus.                                         |
| isFocusVisible  | `boolean` | Focus arrived by keyboard or assistive technology.           |
| isHovered       | `boolean` | A mouse is over the root or the input; never while disabled. |
| isDisabled      | `boolean` | The prop.                                                    |
| isReadOnly      | `boolean` | The prop.                                                    |
| isRequired      | `boolean` | The prop.                                                    |
| isInvalid       | `boolean` | The prop.                                                    |
| isErrorShown    | `boolean` | Field's: invalid and not disabled.                           |

## Selection

A checkbox's state lives in its `checked` property, which no attribute
controls once the user has toggled it (the `checked` attribute is the
default, `defaultChecked`). Checkbox writes it through the live-property
channel: the binder sets it only when it differs from the element. React
renders it once as `defaultChecked` from the first render, so server HTML
shows the state and React never controls the input. UniAria never writes
`aria-checked` on the native input: browsers ignore it there (Chromium's
accessibility tree reads only the properties), and ARIA in HTML disallows it.

- **Uncontrolled.** Each `input` event stores the input's `checked` and
  reports `selectedChange`.
- **Controlled.** The click toggles the input natively and `input` and
  `change` fire as usual; Checkbox reports `selectedChange`. A toggle the
  consumer hasn't accepted once that event's work is done is put back, as
  React does for a controlled checkbox (Resolved questions 2).
- **Indeterminate.** `isIndeterminate` sets the `indeterminate` property,
  which has no attribute, so it appears once the binder attaches (after
  hydration in React). It is presentational, as in React Aria and Cube UI
  Kit: a click toggles `isSelected` from the browser's result (an unchecked
  indeterminate checkbox becomes selected), the browser clears the property,
  and Checkbox sets it again while the prop stays true. The consumer clears
  it; a select-all checkbox computes both from its rows, and the APG's
  mixed-state cycle (mixed, all, none, mixed) is consumer logic on top.
- **Read-only.** `aria-readonly="true"`, and Checkbox cancels the input's
  `click` (`preventDefault`), so neither a click, a label click nor Space
  toggles it, and no `input` or `change` fires; the browser restores
  `checked` and `indeterminate` itself. This is Zag's approach; React Aria
  lets the toggle happen and reverts it. The `readonly` attribute is not
  used: HTML ignores it on a checkbox, and Chromium and WebKit then drop the
  checkbox from constraint validation (`willValidate` is false).
- **Disabled.** Native `disabled`: not focusable, never toggles. With
  `isFocusableWhenDisabled`, `aria-disabled` instead: focusable, every
  toggle cancelled as read-only's, and its entry left out of the form's
  data (a `formdata` listener), as a natively disabled checkbox's is.
- **Form reset.** As TextField: on the form's `reset` event (skipped when
  `defaultPrevented`) the checkbox goes back to the state it mounted with,
  `defaultSelected` when uncontrolled. The native reset then sets `checked`
  from the attribute, so Checkbox writes its state again afterwards. A reset
  leaves `indeterminate` alone, natively and here.
- **Before JavaScript.** The element adopts the input's `checked` property
  as `defaultSelected` on upgrade: the markup's `checked`, or a click before
  the script loaded.

## Keyboard

| Key   | Action                                                                                                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Space | Toggles, natively. Nothing when read-only.                                                                                                                                         |
| Enter | Nothing on the checkbox: it submits its form natively, as in React Aria and Cube UI Kit (whose docs say Enter toggles; the code doesn't). The APG checkbox pattern has Space only. |
| Tab   | Moves focus natively; a disabled checkbox is skipped, unless `isFocusableWhenDisabled`.                                                                                            |

Checkbox handles no keys itself.

## ARIA and state attributes per state

| State             | Part       | Attributes                                                                                     |
| ----------------- | ---------- | ---------------------------------------------------------------------------------------------- |
| idle              | input      | `type="checkbox"`; Field's `id`, `aria-labelledby`, `aria-describedby`; the `checked` property |
|                   | indicator  | `aria-hidden="true"`                                                                           |
| selected          | input      | `checked` property true                                                                        |
|                   | every part | + `data-selected`                                                                              |
| indeterminate     | input      | `indeterminate` property true                                                                  |
|                   | every part | + `data-indeterminate`                                                                         |
| hovered           | every part | + `data-hovered`                                                                               |
| focused           | every part | + `data-focused`; + `data-focus-visible` after keyboard or virtual focus                       |
| disabled          | input      | + `disabled`; `aria-disabled="true"` instead with `isFocusableWhenDisabled`                    |
|                   | every part | + `data-disabled`; the error hidden (Field)                                                    |
| read-only         | input      | + `aria-readonly="true"`                                                                       |
|                   | every part | + `data-readonly`                                                                              |
| invalid, required | as Field   | `aria-invalid="true"`, `aria-required="true"`, `data-invalid`, `data-required`                 |

## Focus

The input takes focus; Checkbox moves none. Whether a click focuses a
checkbox is the browser's: WebKit doesn't, following macOS, and Cube UI Kit
leaves it so. React Aria and Zag focus the input on a label press; UniAria
doesn't, so `focusChange` follows the platform.

## Pointer and touch

Native. A click on the input, the label part when it is a `label`, or a
`label` root toggles. Interactive content inside a `label` root, such as a
link in "I accept the terms", keeps its own click: HTML doesn't activate the
label for it. Hover is tracked on the root and the input, so a visually
hidden input still reports it, and is off while disabled, as in Cube UI Kit.

## Expected spoken output

Confirmed with `@guidepup/virtual-screen-reader` on a label "Accept terms"
and a native checkbox. The `for`/`id`, wrapping-`label` and
`aria-labelledby` forms read the same.

| State                    | Spoken phrase                                                                     |
| ------------------------ | --------------------------------------------------------------------------------- |
| not selected             | `checkbox, Accept terms, not checked`                                             |
| selected                 | `checkbox, Accept terms, checked`                                                 |
| indeterminate            | Chromium exposes `mixed`; the virtual reader can't read it (Resolved questions 1) |
| with a description       | `checkbox, Accept terms, You must accept to continue, not checked`                |
| read-only                | `checkbox, Accept terms, not checked, read only`                                  |
| required                 | `checkbox, Accept terms, not checked, required`                                   |
| invalid, the error shown | `checkbox, Accept terms, You must accept to continue, not checked, invalid`       |
| invalid and required     | `checkbox, Accept terms, not checked, invalid, required`                          |
| disabled                 | `checkbox, Accept terms, not checked, disabled` (not focusable)                   |
| focusable and disabled   | `checkbox, Accept terms, not checked, disabled`                                   |

Focus reads the phrase once; a wrapper root adds nothing. Reading by line,
the label text is a stop of its own after the checkbox. The virtual reader
logs nothing on a toggle, while screen readers announce the new state of a
native checkbox themselves, so Checkbox announces nothing.

The virtual reader takes the checked state only from the `checked`
attribute, not the property browsers read (Resolved questions 1): the phrases
above were confirmed with the attribute.

## Adapter surface

```tsx
// React
const terms = useComponent(checkbox, {
  labelElementType: 'span',
  isRequired: true,
  onSelectedChange,
});
return (
  <>
    <label {...terms.parts.root}>
      <input {...terms.parts.input} name="terms" />
      <span {...terms.parts.indicator}>
        <CheckIcon />
      </span>
      <span {...terms.parts.label}>Accept the terms</span>
    </label>
    <p {...terms.parts.error}>You must accept to continue</p>
  </>
);
```

```html
<!-- Custom element -->
<uni-checkbox required>
  <label class="uni-checkbox">
    <input data-element="Input" type="checkbox" name="terms" checked />
    <span data-element="Indicator"></span>
    <span data-element="Label">Accept the terms</span>
  </label>
  <p data-element="Error" hidden>You must accept to continue</p>
</uni-checkbox>
```

Element attributes: `default-selected`, `indeterminate`, `disabled`,
`focusable-when-disabled`, `readonly`, `required`, `invalid`, `value`, `group` (the id of its
`<uni-checkbox-group>`, when not inside it), `labelled-by`,
`described-by`.
Properties: `isSelected` (controlled), `defaultSelected`, `isIndeterminate`.
Events: `selectedchange`, `focuschange`. The element adopts the input's
`checked` property and `id`, and the label's tag.

## Mapping from Cube UI Kit

Checkbox backs UI Kit's Checkbox standalone; inside `Checkbox.Group` it waits
for CheckboxGroup. Tree's checkboxes and TableView's select-all
(`isSelected` plus `isIndeterminate`) use it unchanged.

- `isSelected`, `defaultSelected` and `onChange(isSelected)` map to
  `isSelected`, `defaultSelected` and `onSelectedChange`. Casting `null` and
  non-booleans stays in UI Kit.
- `isIndeterminate` maps to `isIndeterminate`. A form-bound UI Kit checkbox
  still forces it off; that is UI Kit's choice.
- `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid` (after UI Kit
  resolves `validationState`), `description` and `errorMessage` map as in
  Field's spec. `id` maps to `inputId`.
- `children`, the inline label, maps to the label part (a `span` inside the
  `label` root). A field `label` alone maps to the label part too. With
  both, the field label is the label part and the inline text joins the name
  through `labelledBy`, so the name reads "Notifications Send me emails".
- `value` maps to the `value` prop. `name`, `form`, `autoFocus` and
  `excludeFromTabOrder` (`tabindex="-1"`) are the consumer's attributes on
  the input.
- `HiddenInput`'s overlay styles, the `data-element="Input"` box (the
  indicator part), `qa` on the input, `tooltip`, `labelPosition` and the
  necessity mark stay in UI Kit.
- Mods: `checked` maps to `data-selected`, `indeterminate`, `invalid` and
  `disabled` to the same `data-*`, `hovered` to `data-hovered`, and
  `focused` (UI Kit's is focus-visible only) to `data-focus-visible`.
  `valid`, `side-label` and `inside-form` stay in UI Kit.
- **Fixes.** Descriptions and errors become linked and announced (Field),
  and an error shows without the field wrapper. `data-hovered` works on a
  standalone checkbox, where UI Kit never sets `hovered`. A string `label`
  no longer replaces the inline text in the name through `aria-label`. A
  form value can't overwrite the native `value` attribute, since UniAria
  writes it from the `value` prop.

## Deviations from the WAI-ARIA pattern

None. The pattern's `role="checkbox"` and `aria-checked` are the native
input's role and state. Enter does nothing on the checkbox, as in the
pattern.

## Resolved questions

Decided by @tenphi on 2026-10-15.

1. **The `checked` attribute stays the default.** The virtual screen reader
   takes a native checkbox's state only from the `checked` attribute, while
   browsers and screen readers read the `checked` and `indeterminate`
   properties (probed in Chromium's accessibility tree), so after a toggle it
   reads the old state, and it never reads indeterminate. Checkbox leaves the
   attribute alone, as React Aria, Cube UI Kit, Lion and Spectrum Web
   Components do; Zag reflects it, which would make a native form reset
   restore nothing and hide edits from code comparing `checked` with
   `defaultChecked`. Scenarios check the state through the `checked` and
   `indeterminate` properties, and `spoken()` covers the name, the
   description, the other states, and the checked state only where the
   markup carries the attribute. `aria-checked` stays off the native input.
2. **A refused toggle goes back right after the event, not on blur.**
   TextField keeps refused typing until blur, Cube UI Kit's buffer, but a
   checkbox has no caret or keystrokes to protect, and WebKit doesn't focus a
   clicked checkbox, so a refused toggle could wait for a blur that never
   comes. React's rule, which Cube UI Kit's checkbox has today: the toggle
   shows, the consumer is told, and once the `change` event's work is done
   (its microtasks, where React applies a state update) the checkbox shows
   `isSelected` again. A store that answers later than that flickers, as in
   React.
3. **`isFocusableWhenDisabled`** (Tooltip spec, Resolved questions 12,
   decided by @tenphi on 2026-10-16): as Radio's, so a tooltip can explain
   a disabled checkbox to the keyboard. No automatic switch when a tooltip
   links: the design system sets it.

## Open questions

None.
