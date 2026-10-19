# ToggleButton spec

Status: approved by @tenphi on 2026-10-15

## Summary

A toggle button switches something on or off, such as Bold in an editor
toolbar or Mute in a player. It is Button with one more piece of state,
`isSelected`, announced through `aria-pressed`. A native `<button>` sits
underneath by default. Every press toggles the state and reports
`selectedChange`; the label never changes with it.

- **WAI-ARIA pattern:** [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/),
  its toggle-button variant
  (`references/aria-practices/content/patterns/button/button-pattern.html`)
- **Builds on:** Button, composed with `ctx.use(button, props)` (decision 9).
  ToggleButton is the first component to use `ctx.use()`, so the runtime gains
  it with this component (see Resolved questions). Press, hover and focus-visible
  come from Button unchanged.
- **Owner:** none. A future ToggleButtonGroup would own selection through
  `ctx.owner()` (decision 11); it is not in the first scope.
- **Tooltip:** takes a Tooltip through its `tooltip` link (Tooltip spec, Resolved
  questions 2): the tooltip instance in React (`tooltip: hint.instance`),
  and on elements the `<uni-tooltip>` it sits in directly or a `tooltip`
  attribute naming one's id. As Button's, on the root. The Button
  it composes doesn't link: a link belongs to the component itself.
- **Custom element:** yes. `<uni-toggle-button>` hosts one native
  `<button class="uni-toggle-button">` written by the consumer, as
  `<uni-button>` does. The host has no role and never takes focus.

Not part of ToggleButton:

- **Link mode.** `aria-pressed` is not valid on a link, so there is no `href`.
  Cube UI Kit skips `aria-pressed` on links for the same reason.
- **Tabs, options and current links.** A button that acts as a tab or a
  listbox option needs `aria-selected`, and a link to the current page needs
  `aria-current`. Those belong to Tabs, Listbox and Button.
- **Form values.** The root is always `type="button"`, and ToggleButton has no
  `name` or `value`, as in React Aria. Use Checkbox or Switch for a value a
  form submits.
- **The mixed state** (`aria-pressed="mixed"`). Neither React Aria nor Cube UI
  Kit supports it, and no consumer needs it yet.
- **Read-only mode.** React Aria's toggle state has `isReadOnly`, but its
  ToggleButton doesn't expose it.

## Anatomy

| Part | Element                                                | Attributes UniAria owns                                                                                                                                                                                                        | Notes                                                                                                               |
| ---- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| root | `button` by default; any element through `elementType` | Button's (`type`, `disabled`, `aria-disabled`, `role`, `tabindex`, `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled`), plus `aria-pressed`, `data-selected`, the `uni-toggle-button` class | The consumer owns content, `id`, other classes and labelling (`aria-label`, `aria-labelledby`, `aria-describedby`). |

No element-owned parts. `data-pressed` keeps Button's meaning: a pointer or
key is down on the root. The selected state is `data-selected`, as in React
Aria Components.

## Props

| Prop                      | Type      | Default    | Bindable | Change event     | Notes                                                                                                     |
| ------------------------- | --------- | ---------- | -------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| isSelected                | `boolean` | `false`    | yes      | `selectedChange` | Seeded by `defaultSelected` when uncontrolled. Written to the root as `aria-pressed` and `data-selected`. |
| isDisabled                | `boolean` | `false`    | no       | —                | As in Button. A disabled toggle button keeps its selected state and never toggles.                        |
| isFocusableWhenDisabled   | `boolean` | `false`    | no       | —                | As in Button.                                                                                             |
| elementType               | `string`  | `'button'` | no       | —                | As in Button: anything but `button` and `input` gets `role="button"` and keyboard handling.               |
| shouldExcludeFromTabOrder | `boolean` | `false`    | no       | —                | As in Button.                                                                                             |
| shouldPreventFocusOnPress | `boolean` | `false`    | no       | —                | As in Button. The usual case: a formatting toggle that leaves focus in the editor.                        |

Button's `href` and `type` are not props: there is no link mode, and the
root is always `type="button"`.

### Events

| Event            | React prop         | When                                                                                       |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| `pressstart`     | `onPressStart`     | As in Button.                                                                              |
| `pressend`       | `onPressEnd`       | As in Button.                                                                              |
| `selectedchange` | `onSelectedChange` | A press asks to toggle. The detail is the requested value, `!isSelected`.                  |
| `press`          | `onPress`          | As in Button, after `selectedchange`. Handlers that read state see the value just toggled. |
| `focuschange`    | `onFocusChange`    | As in Button.                                                                              |

Order on activation: `pressstart`, `pressend`, `selectedchange`, `press`, the
order React Aria uses (it toggles, then calls `onPress`). A cancelled press
fires `pressstart` and `pressend` only. Press events carry Button's
`PressEvent`.

Controlled (`isSelected` passed): `selectedchange` reports the request, and
the state changes only when the consumer passes the new value back.
Uncontrolled: the state changes, then `selectedchange` fires. Setting
`isSelected` from outside never fires `selectedchange`.

The element adapter dispatches `selectedchange` as a bubbling, non-composed
`CustomEvent` on the host with the boolean in `detail`, like the press
events.

## Public state

Button's state plus one field.

| Field          | Type      | Meaning                                                                     |
| -------------- | --------- | --------------------------------------------------------------------------- |
| isSelected     | `boolean` | The toggle is on: the controlled value, or the uncontrolled one.            |
| isPressed      | `boolean` | As in Button: a pointer or key is down on the root. Unrelated to selection. |
| isHovered      | `boolean` | As in Button.                                                               |
| isFocused      | `boolean` | As in Button.                                                               |
| isFocusVisible | `boolean` | As in Button.                                                               |
| isDisabled     | `boolean` | As in Button.                                                               |

## Keyboard

| Key   | Where | Behavior                                                                                                    |
| ----- | ----- | ----------------------------------------------------------------------------------------------------------- |
| Space | root  | As in Button: the press starts on keydown and activates on keyup on the root. Activation toggles the state. |
| Enter | root  | Same as Space, on keyup, as in Button.                                                                      |
| Tab   | —     | As in Button.                                                                                               |

## ARIA and state attributes per state

`aria-pressed` is always present, with the string `"true"` or `"false"`:
without it the root would be announced as a plain button. Unlike
`aria-disabled`, `"false"` is the meaningful value here ("not pressed").
`data-selected` is a presence attribute, removed when not selected.

| State                     | Part | Attributes                                                                                                                                         |
| ------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| off                       | root | Button's idle attributes, `type="button"` on a native root, `aria-pressed="false"`, the `uni-toggle-button` class instead of Button's `uni-button` |
| on                        | root | `aria-pressed="true"`, `data-selected`                                                                                                             |
| non-native root           | root | `role="button"` and `aria-pressed` as above                                                                                                        |
| hovered, pressed, focused | root | As in Button (`data-hovered`, `data-pressed`, `data-focused`, `data-focus-visible`)                                                                |
| disabled                  | root | As in Button, and `aria-pressed` and `data-selected` keep the current state                                                                        |

## Focus

As in Button. Toggling never moves focus. With `shouldPreventFocusOnPress`, a
pointer press toggles and leaves focus where it was.

## Pointer and touch

As in Button. Every activation, whatever the input (mouse, pen, touch,
keyboard or a screen reader's virtual click), toggles once. A cancelled press,
a press released outside the root, and any press while disabled leave the
state alone.

## Expected spoken output

Confirmed with `@guidepup/virtual-screen-reader` (it reads `disabled` before
the pressed state).

| Markup and state                        | Spoken phrase                         |
| --------------------------------------- | ------------------------------------- |
| native root, text "Bold", off           | `button, Bold, not pressed`           |
| on                                      | `button, Bold, pressed`               |
| non-native root (`role="button"`), on   | `button, Bold, pressed`               |
| disabled, off                           | `button, Bold, disabled, not pressed` |
| disabled, on                            | `button, Bold, disabled, pressed`     |
| `isFocusableWhenDisabled`, disabled, on | `button, Bold, disabled, pressed`     |
| read again after a press toggles it on  | `button, Bold, pressed`               |

The simulated reader doesn't announce a change on the focused element, so
conformance checks the phrase read after a toggle. Real screen readers
announce the new state when it changes.

## Adapter surface

```tsx
// React, controlled
const bold = useComponent(toggleButton, {
  isSelected: isBold,
  onSelectedChange: setBold,
  shouldPreventFocusOnPress: true,
});
return <button {...bold.parts.root}>Bold</button>;

// Uncontrolled
const mute = useComponent(toggleButton, { defaultSelected: true });
```

```html
<!-- Custom element -->
<uni-toggle-button default-selected>
  <button class="uni-toggle-button">Mute</button>
</uni-toggle-button>
<script>
  document
    .querySelector('uni-toggle-button')
    .addEventListener('selectedchange', (event) => mute(event.detail));
</script>
```

Element attributes follow Button's (`disabled`, `focusable-when-disabled`,
`exclude-from-tab-order`, `prevent-focus-on-press`). The bindable follows the
runtime's rule: the `default-selected` attribute seeds the uncontrolled
state, and setting the `isSelected` property makes the element controlled.
Until the element upgrades, markup can carry `aria-pressed` matching
`default-selected` so the button is announced right before JavaScript runs;
UniAria owns the attribute from then on.

## Mapping from Cube UI Kit

Cube UI Kit has no ToggleButton. Its Button takes a controlled `isSelected`,
which the call site flips in `onPress`, and mirrors it into `aria-pressed`
(`references/cube-ui-kit/src/components/actions/Button/Button.tsx`). It skips
`aria-pressed` on links and on buttons with their own `role`, where the call
site wants `aria-selected` or `aria-current`.

- `<Button isSelected={x} onPress={() => setX(!x)}>` becomes a ToggleButton
  with `isSelected={x}` and `onSelectedChange={setX}`.
- `isSelected` with `role="tab"`, `role="option"` or `to` is not a toggle; see
  Resolved questions.

## Deviations from the WAI-ARIA pattern

None. The pattern's toggle example sets `aria-pressed` on keydown; UniAria
toggles on keyup, as Button activates (see Button's spec).

## Resolved questions

Decided by @tenphi on 2026-10-15.

1. **`ctx.use()` joins the runtime now.** ToggleButton composes Button with
   `ctx.use(button, props)` (decision 9), so there is one Button
   implementation. Select and Combobox will use the same mechanism.
2. **Cube UI Kit's other uses of `isSelected`** are not toggles. A link to
   the current page gets `aria-current` through a later Button prop, when a
   consumer needs it. Tabs and options wait for Tabs and Listbox. Until then
   UI Kit keeps writing those attributes itself.
3. **`focusChange`**, as Button's, from the gate 3 API review, approved by @tenphi on 2026-10-16.

## Open questions

None.
