# RadioGroup spec

Status: approved by @tenphi on 2026-10-16

## Summary

A radio group is a labelled set of native `<input type="radio">` elements of
which at most one is selected; its value is the selected radio's `value`.
Two definitions, as CheckboxGroup and Checkbox:

- **RadioGroup** (`radioGroup`) composes Field on its root, which becomes a
  `role="radiogroup"` named by the group label and described by the group's
  description and error. It holds the value, the group's modes and states,
  the `name` every radio shares, and arrow-key movement.
- **Radio** (`radio`, `../radio/`) is one option. It finds its group through
  `ctx.owner()` (decision 11, as a checkbox finds its CheckboxGroup) and
  takes from it its checked state, its name and the group's modes. A radio
  outside a group does nothing useful; development warns.

- **WAI-ARIA pattern:** [Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/)
  (`references/aria-practices/content/patterns/radio/`). The pattern's
  `role="radio"` and `aria-checked` are the native input's role and
  `checked` state, as in Checkbox.
- **Builds on:** Field (`ctx.use`), `ctx.owner()` and `OwnerProvider` from
  CheckboxGroup, `createFocusWithin`, hover and focus from `dom/`.
- **Owner:** RadioGroup owns its radios.
- **Tooltip:** a radio takes a Tooltip through its `tooltip` link (Tooltip
  spec, Resolved questions 2): the tooltip instance in React
  (`tooltip: hint.instance`), and on elements the `<uni-tooltip>` it sits in
  directly or a `tooltip` attribute naming one's id. As Checkbox's: hover on
  the radio's wrapper (without one, its root), focus and presses on its
  input, which carries the tooltip's id after its own references and the
  group's error. The group
  itself takes none.
- **Custom elements:** yes, `<uni-radio-group>` and `<uni-radio>`, hosting
  consumer markup.

Not part of RadioGroup:

- **Validation.** As in Field: the group shows `isInvalid`, the form decides
  it. No native `required`.
- **Looks.** Cube UI Kit's button and tabs radios (`Radio.ButtonGroup`,
  `Radio.Tabs`) are the same two definitions with other styles; their
  segmented look is consumer CSS. So are the dot and Zag's sliding
  indicator, which measures the selected item.
- **Tabs.** A tab list is a different pattern, with panels; UI Kit's docs
  already send non-form uses to `Tabs`.
- **A disabled `<fieldset>`**: as in Checkbox.

## Anatomy

RadioGroup:

| Part        | Element                                                   | Attributes UniAria owns                                                                                                                                                                                                | Notes                                                                                                                                                                                |
| ----------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| root        | any; usually `div`                                        | `role="radiogroup"`; as Field's control: `id` (unless it has one), `aria-labelledby`, `aria-describedby`, `aria-invalid`, `aria-required`; plus `aria-disabled`, `aria-readonly`, `aria-orientation`, state attributes | The outermost element: holds the label, the description, the error and the radios. Unlike CheckboxGroup's `group`, a `radiogroup` takes and exposes required, invalid and read-only. |
| label       | `span` by default; any element through `labelElementType` | as Field: `id` (unless it has one), state attributes                                                                                                                                                                   | No `for`. A `<fieldset role="radiogroup">` root with a `<legend>` label works too.                                                                                                   |
| description | any                                                       | as Field                                                                                                                                                                                                               | Read when focus enters the group.                                                                                                                                                    |
| error       | any                                                       | as Field                                                                                                                                                                                                               | Announced by Field when it appears, and linked to every radio (Resolved questions 3).                                                                                                |

Changed on 2026-10-19 (owner): the root is the outermost element, so the label,
the description and the error go inside it, as in React Aria.

Radio:

| Part        | Element                                                       | Attributes UniAria owns                                                                                                                                                                             | Notes                                                                                                                                                               |
| ----------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root        | any; usually `div`; a `label` without a wrapper               | state attributes                                                                                                                                                                                    | Optional. The outermost element, around the wrapper and the description. No role. Without a wrapper, a `label` root makes its whole area select the radio natively. |
| wrapper     | any; a `label` makes its whole area select the radio natively | state attributes                                                                                                                                                                                    | Optional. The area around the input, the indicator and the label. No role.                                                                                          |
| input       | `input`                                                       | `type="radio"`, `name` (the group's), `value`, `tabindex`, `disabled` or `aria-disabled`, `id` (unless it has one), `aria-labelledby`, `aria-describedby`, the `checked` property, state attributes | The consumer owns `form`, the `checked` attribute and the styles that hide the input or lay it over the wrapper or a `label` root (UI Kit's overlay).               |
| indicator   | any; usually `span`                                           | `aria-hidden="true"`, state attributes                                                                                                                                                              | Optional. The circle and dot drawn in place of the input, or a button's face.                                                                                       |
| label       | `label` by default; any element through `labelElementType`    | as Field: `id` (unless it has one), `for` (only on a `label`), state attributes                                                                                                                     | Names the radio. Inside a `label` wrapper or root it must be a `span`.                                                                                              |
| description | any                                                           | as Field                                                                                                                                                                                            | Optional. Outside a `label` wrapper or root.                                                                                                                        |

Changed on 2026-10-19 (owner): the `label` area is now the `wrapper` part;
the root is the optional outermost element.

A radio has no error part: it has no required, invalid or error of its own
(Resolved questions 6).

State attributes on every part of the group: `data-disabled`,
`data-readonly`, `data-invalid`, `data-required`, `data-focus-within`,
`data-focus-visible` (focus within came by keyboard, for UI Kit's ring on
button and tabs groups) and `data-orientation` when given. On every part of
a radio: `data-selected`, `data-hovered`, `data-focused`,
`data-focus-visible`, `data-disabled`, `data-readonly` and `data-invalid`
(the group's, so a radio can be styled from it).

A part keeps an `id` the consumer gives its element, in both adapters, and
every reference to the part follows it; UniAria writes an `id` only on a
part that has none (root AGENTS.md → DOM, lifecycle and SSR).

## Props

RadioGroup:

| Prop             | Type                                      | Default   | Bindable | Change event  | Notes                                                                                                                |
| ---------------- | ----------------------------------------- | --------- | -------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| value            | `string \| null`                          | `null`    | yes      | `valueChange` | The selected radio's `value`; `null` is none (Resolved questions 4).                                                 |
| name             | `string \| undefined`                     | generated | no       | —             | Written to every radio's input, so they form one native group and the form submits the value (Resolved questions 2). |
| isDisabled       | `boolean`                                 | `false`   | no       | —             | Disables every radio natively; `aria-disabled="true"` on the root.                                                   |
| isReadOnly       | `boolean`                                 | `false`   | no       | —             | `aria-readonly="true"` on the root; arrows move focus but select nothing. Attribute `readonly`.                      |
| isRequired       | `boolean`                                 | `false`   | no       | —             | Field's: `aria-required` on the root.                                                                                |
| isInvalid        | `boolean`                                 | `false`   | no       | —             | Field's: `aria-invalid` on the root, shows and announces the error.                                                  |
| orientation      | `'horizontal' \| 'vertical' \| undefined` | —         | no       | —             | `aria-orientation` and `data-orientation`, only when given (Resolved questions 7).                                   |
| labelElementType | `string`                                  | `'span'`  | no       | —             | Field's. The element reads the label's tag.                                                                          |
| labelledBy       | `string \| undefined`                     | —         | no       | —             | Field's.                                                                                                             |
| describedBy      | `string \| undefined`                     | —         | no       | —             | Field's.                                                                                                             |

Radio:

| Prop                    | Type                  | Default   | Notes                                                                                                                   |
| ----------------------- | --------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| value                   | `string`              | —         | Its key in the group's value, written to the input. Required; development warns when missing.                           |
| isDisabled              | `boolean`             | `false`   | This radio only; the group's `isDisabled` disables every radio.                                                         |
| isFocusableWhenDisabled | `boolean`             | `false`   | As Button's: `aria-disabled` instead of `disabled`, so a tooltip can explain it; never selected (Resolved questions 5). |
| inputId                 | `string \| undefined` | generated | Field's `controlId`: the input's `id` where the input has none of its own.                                              |
| labelElementType        | `string`              | `'label'` | Field's. Pass `'span'` for a label part inside a `label` wrapper or root. The element reads the label's tag.            |
| labelledBy              | `string \| undefined` | —         | Field's.                                                                                                                |
| describedBy             | `string \| undefined` | —         | Field's.                                                                                                                |

A radio's `group` attribute (elements) and `owner` prop (React) link it to
a group it isn't inside, as a checkbox's do. The group's arrow keys reach
it too, in DOM order with the radios inside the root: the group's radios
are the radios of its name in its form.

## Events

| Definition | Event         | Detail           | When                                                                                                                             |
| ---------- | ------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| RadioGroup | `valueChange` | `string \| null` | A radio was selected by click, Space or an arrow key, or a form reset requests the default. Never for a value the consumer sets. |
| RadioGroup | `focusChange` | `boolean`        | Focus entered or left the group, for a form that validates on blur.                                                              |
| Radio      | `focusChange` | `boolean`        | The input gained or lost focus.                                                                                                  |

## Public state

RadioGroup: `value`, `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`,
`isErrorShown`, `isFocusWithin`, `isFocusVisible`. Radio: `isSelected`,
`isFocused`, `isFocusVisible`, `isHovered`, `isDisabled` (its own or the
group's), and the group's `isReadOnly` and `isInvalid` (Resolved questions
8).

## Selection

The value lives in the group; each radio's `checked` property shows whether
the value is its `value`, written only when it differs and rendered once by
React as `defaultChecked` from the first render (with `OwnerProvider`, so
server HTML shows the selection). Never `aria-checked`: Chromium ignores it
on a native radio.

- **Selecting.** A radio's `input` event (click, Space, a label click, or an
  arrow key) selects its value through the group, which reports
  `valueChange`. The browser has already unchecked the previous radio.
- **Controlled.** As Checkbox: the browser's change shows, the consumer is
  told, and once the event's work is done every radio shows the value
  again, so a refused change re-checks the previous radio.
- **Read-only.** `aria-readonly="true"` on the root, and each radio cancels
  its `click`. Probed in Chromium and WebKit: a cancelled click restores the
  previous radio, fires no `input` or `change`, and keeps the focus where
  the browser put it, so arrows move focus without selecting, as in React
  Aria. Zag disables the inputs instead, which takes them out of the Tab
  order.
- **Disabled.** The group's or the radio's own: native `disabled`, skipped
  by arrows and Tab. With `isFocusableWhenDisabled`, `aria-disabled` and a
  cancelled click instead, and its entry left out of the form's data (a
  `formdata` listener), as a natively disabled radio's is (Checkbox's rule).
- **Form reset.** As CheckboxGroup: the group goes back to its default
  (without `defaultValue`, the radio it adopted from the markup), and the
  radios write their state again after the native reset.
- **Before JavaScript.** The element group takes the `value` of the radio
  whose input is checked when it links (the markup's `checked`, or a click
  before upgrade) as its default.
- **Values with no radio** stay in the value: no radio is checked.
- **Focus on a press** (changed on 2026-10-24 (owner)): as Checkbox's, a
  pointer press on a radio's input or a `label` that activates it focuses
  the input in every browser, and that focus isn't visible. With its roving
  `tabindex`, WebKit already focuses a clicked radio; the rule holds for a
  radio without one too.

## Keyboard

UniAria moves focus itself (Resolved questions 1): native arrow keys differ
between browsers (WebKit doesn't wrap, and the engines disagree in
right-to-left), and Safari doesn't Tab to radios at all.

| Key                                    | Action                                                                                                                                                                                                                                                                                                               |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab, Shift+Tab                         | Enters at the selected radio; with none, the first (Tab) or the last (Shift+Tab). Leaves the group from any radio: Chromium would stop on the selected radio ahead of an unselected one (read-only), so UniAria moves that Tab on, as UI Kit does. Each radio's `tabindex` is `0` for that entry and `-1` otherwise. |
| ArrowDown, ArrowRight                  | Focuses the group's next enabled radio in DOM order, wrapping, and selects it (a native `click`, so `input` and `change` fire). Read-only or a focusable disabled radio: focus only.                                                                                                                                 |
| ArrowUp, ArrowLeft                     | The same, to the previous radio.                                                                                                                                                                                                                                                                                     |
| Right to left                          | ArrowLeft and ArrowRight swap when `orientation` is `horizontal`, as in React Aria.                                                                                                                                                                                                                                  |
| Space                                  | Selects the focused radio, natively. Nothing when read-only.                                                                                                                                                                                                                                                         |
| Enter                                  | Nothing on the radio: it submits the form natively, as in React Aria (tested there).                                                                                                                                                                                                                                 |
| Alt, Ctrl or Meta with an arrow        | The browser's: UniAria neither moves focus nor prevents the key, which may be a browser shortcut (Alt+ArrowLeft is Back on Windows).                                                                                                                                                                                 |
| Radios of another name inside the root | Their keys stay theirs, so a group nested in an option works.                                                                                                                                                                                                                                                        |

## ARIA and state attributes per state

| State     | Part             | Attributes                                                                                           |
| --------- | ---------------- | ---------------------------------------------------------------------------------------------------- |
| idle      | group root       | `role="radiogroup"`; Field's `id`, `aria-labelledby`, `aria-describedby`                             |
|           | radio input      | `type="radio"`, `name`, `value`, `tabindex`; Field's `id`, `aria-labelledby`; the `checked` property |
| selected  | radio input      | `checked` property true, `tabindex="0"`                                                              |
|           | every radio part | + `data-selected`                                                                                    |
| disabled  | group root       | + `aria-disabled="true"`; every group part + `data-disabled`; the error hidden (Field)               |
|           | radio input      | + `disabled` (or `aria-disabled="true"`); every radio part + `data-disabled`                         |
| read-only | group root       | + `aria-readonly="true"`; every part of the group and its radios + `data-readonly`                   |
| required  | group root       | + `aria-required="true"`; every group part + `data-required`                                         |
| invalid   | group root       | + `aria-invalid="true"`; every group part and radio part + `data-invalid`                            |
|           | radio input      | `aria-describedby` gains the group's error id while it is shown                                      |
| focus     | every group part | + `data-focus-within`, + `data-focus-visible` after keyboard focus                                   |
|           | every radio part | + `data-focused`, + `data-focus-visible`                                                             |

ARIA 1.2 gives `radiogroup` `aria-required`, `aria-invalid`, `aria-readonly`
and `aria-orientation`, and `radio` none of them; Chromium exposes them on
the group and not on the radios (probed).

## Expected spoken output

Confirmed with `@guidepup/virtual-screen-reader` on a group "Plan" with
radios Free, Pro and Team sharing a `name`.

| State                              | Spoken phrase                                                   |
| ---------------------------------- | --------------------------------------------------------------- |
| the group, with a description      | `radiogroup, Plan, Billed monthly`                              |
| required                           | `radiogroup, Plan, required`                                    |
| invalid, the error shown           | `radiogroup, Plan, Pick a plan, invalid`                        |
| disabled                           | `radiogroup, Plan, disabled`                                    |
| read-only                          | `radiogroup, Plan, read only`                                   |
| horizontal                         | `radiogroup, Plan, orientated horizontally`                     |
| a radio                            | `radio, Free, not checked, position 1, set size 3`              |
| a radio checked in the markup      | `radio, Pro, checked, position 2, set size 3`                   |
| a disabled radio                   | `radio, Pro, not checked, disabled, position 2, set size 3`     |
| a radio while the group is invalid | `radio, Free, Pick a plan, not checked, position 1, set size 3` |

Position and set size count the radios sharing the `name` in the form, so
without a name none is read. As with checkboxes, the virtual reader takes
the checked state only from the `checked` attribute: scenarios check the
property.

## Adapter surface

```tsx
// React
const plan = useBehavior(radioGroup, { defaultValue: 'pro', onValueChange });
return (
  <div {...plan.parts.root}>
    <span {...plan.parts.label}>Plan</span>
    <OwnerProvider owner={plan}>
      <Option value="free">Free</Option>
      <Option value="pro">Pro</Option>
    </OwnerProvider>
    <p {...plan.parts.error}>Pick a plan</p>
  </div>
);

function Option({ value, children }) {
  const option = useBehavior(radio, { value, labelElementType: 'span' });
  return (
    <label {...option.parts.root}>
      <input {...option.parts.input} />
      <span {...option.parts.indicator} />
      <span {...option.parts.label}>{children}</span>
    </label>
  );
}
```

```html
<!-- Custom elements -->
<uni-radio-group name="plan" required>
  <div data-uni="radio-group">
    <span data-element="Label">Plan</span>
    <uni-radio value="free">
      <label data-uni="radio">
        <input data-element="Input" type="radio" />
        <span data-element="Label">Free</span>
      </label>
    </uni-radio>
    <uni-radio value="pro">…</uni-radio>
  </div>
</uni-radio-group>
```

`@uniaria/core/radio-group` exports `radioGroup`, `@uniaria/core/radio`
exports `radio`, and the elements register from the same subpaths of
`@uniaria/elements`. Group attributes: `name`, `disabled`, `readonly`,
`required`, `invalid`, `orientation`, `labelled-by`, `described-by`;
properties `value` (controlled) and `defaultValue`; events `valuechange` and
`focuschange`. Radio attributes: `value`, `disabled`,
`focusable-when-disabled`, `group`, `labelled-by`, `described-by`.

## Mapping from Cube UI Kit

RadioGroup and Radio back `Radio.Group`, `Radio.ButtonGroup`, `Radio.Tabs`,
`Radio` and `Radio.Button`.

- `value`, `defaultValue` and `onChange(value)` map to `value`,
  `defaultValue` and `onValueChange`. UI Kit casts `null` to `undefined`,
  which makes `value={null}` uncontrolled; in UniAria `null` is a controlled
  empty value.
- `isDisabled`, `isReadOnly`, `isRequired`, `isInvalid`, `label`,
  `description` and `errorMessage` map as in Field's spec; `name` to
  `name`; `orientation` to `orientation` (UI Kit's default from `type`,
  horizontal for buttons and tabs, stays UI Kit's).
- `type`, `size`, `buttonType`, `groupStyles` and the segmented styles stay
  UI Kit's; a loading button radio passes `isDisabled`.
- UI Kit's focusable disabled radio with a tooltip (CUB-5387) maps to
  `isFocusableWhenDisabled`.
- Mods: the group's `focused` maps to `data-focus-visible`, `horizontal` to
  `data-orientation`; a radio's `checked` to `data-selected`, and
  `disabled`, `invalid`, `hovered` to the same `data-*`, `focused` to
  `data-focus-visible`.
- **Fixes.** The description and error become linked and announced (Field),
  read-only gets `data-readonly`, and `null` can clear a controlled group.

## Deviations from the WAI-ARIA pattern

None by default. With `isFocusableWhenDisabled`, arrows stop on a disabled
radio, which the pattern skips (Resolved questions 5).

## Resolved questions

Decided by @tenphi on 2026-10-16, as recommended.

1. **UniAria moves focus with the arrow keys, not the browser.** The design
   doc expected native arrow keys. Probed: WebKit doesn't wrap at the ends,
   ArrowRight in right-to-left goes back in Chromium and forward in WebKit,
   Safari doesn't Tab to radios without a `tabindex`, and Chromium's Tab
   from an unchecked radio stops on the checked one ahead. Cube UI Kit
   (through React Aria) wraps everywhere, swaps the horizontal arrows in
   right-to-left, and gives radios a roving `tabindex`, so Safari reaches
   them. Decided: the same, as above. UniAria only picks the radio and
   focuses it, then calls its `click()`, so native `input` and `change`
   fire and read-only and disabled cancel it like a pointer click. The
   alternative was native keys, with these differences listed as platform
   behavior.
2. **The group writes `name` to every radio**, its `name` prop or one
   generated from its id, as React Aria and Zag do. Without a shared name
   the radios aren't a native group: probed, an arrow key then checks the
   next radio without unchecking the first, and screen readers lose
   "position 1, set size 3". A `name` on an input in markup is overwritten,
   so it moves to the group.
3. **States on the group; the error also on each radio.** Required,
   invalid, read-only and disabled go on the `radiogroup`, where ARIA
   allows them and the virtual reader and Chromium read them (on a radio
   they are neither allowed nor read, unlike CheckboxGroup's case). The
   group's error joins each radio's `aria-describedby` while shown, its
   description doesn't, as CheckboxGroup decided. React Aria adds both.
4. **`string | null` value**, with `null` for none, as React Aria. An
   uncontrolled group starts at `null`; a controlled `null` clears it.
5. **`isFocusableWhenDisabled` on Radio**, as Button's, for UI Kit's
   disabled radio with a tooltip (CUB-5387): `aria-disabled`, a cancelled
   click, reached by arrows but never selected. Decided: yes; Tooltip
   follows on the roadmap. Without it, a disabled radio can't show a
   tooltip by keyboard.
6. **Radio composes Field without the error part.** A composed
   definition's parts must all exist on the outer one today, and a radio
   has no error. Decided: `ctx.use` accepts `parts: { error: null }`
   to leave a composed part out (a runtime change). The alternative was an
   error part on Radio that never shows.
7. **`aria-orientation` only when `orientation` is given.** React Aria
   always writes it (vertical by default), which adds "orientated
   vertically" to what screen readers say on every group. All four arrows
   work in either orientation; it only changes which arrows swap in
   right-to-left.
8. **Radio reports `isReadOnly` and `isInvalid`**, from the gate 3 API review, approved by @tenphi on 2026-10-16:
   its parts already carry both from the group, and Checkbox reports them.

## Open questions

None.
