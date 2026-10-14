# Button spec

Status: draft <!-- draft | approved by @tenphi on YYYY-MM-DD -->

## Summary

A button runs an action when pressed. A native `<button>` sits underneath by
default. Sous adds one `press` event that behaves the same for mouse, pen,
touch, keyboard and screen-reader clicks. It also adds hover, pressed and
focus-visible states as data attributes, and an optional disabled mode that
stays focusable. Button is the phase 1 gate: it must pass the same conformance
suite in both adapters.

- **WAI-ARIA pattern:** [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  (`references/aria-practices/content/patterns/button/button-pattern.html`)
- **Builds on:** `press`, `hover` and `focus-visible` from `dom/`. Phase 1
  ships a minimal press: keyboard, mouse and disabled behavior. Touch,
  virtual-click and hover behavior arrive with the full interaction layer in
  phase 2, together with their conformance scenarios.
- **Owner:** none
- **Custom element:** yes. `<sous-button>` hosts one native
  `<button data-part="root">` written by the consumer. The inner button
  provides native semantics and form submission, so the element needs no
  `ElementInternals` and no stand-in submit button (the workaround Spectrum
  Web Components uses because its host is the button). The host has no role
  and never takes focus.

Not part of Button: toggle buttons (`aria-pressed`), menu buttons, links and
a pending state. See Open questions.

## Anatomy

| Part | Element                                                | Attributes Sous owns                                                                                                                                                                         | Notes                                                                                                                                                                                                                                          |
| ---- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root | `button` by default; any element through `elementType` | `type`, `disabled`, `aria-disabled`, `role` and `tabindex`, `data-scope="button"`, `data-part="root"`, `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled` | The consumer owns content, `id`, classes, labelling (`aria-label`, `aria-labelledby`, `aria-describedby`), popup attributes (`aria-haspopup`, `aria-expanded`, `aria-controls`) and form attributes (`name`, `value`, `form`, `formaction`, …) |

No element-owned parts.

## Props

| Prop                  | Type                              | Default    | Bindable | Change event | Notes                                                                                                                                                                                                                             |
| --------------------- | --------------------------------- | ---------- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| disabled              | `boolean`                         | `false`    | no       | —            | Native `disabled` on `button` and `input`; `aria-disabled="true"` and no `tabindex` elsewhere.                                                                                                                                    |
| focusableWhenDisabled | `boolean`                         | `false`    | no       | —            | When disabled, use `aria-disabled="true"` instead of `disabled` and keep the root focusable and in the tab order. Presses, clicks and form submission are still blocked.                                                          |
| type                  | `'button' \| 'submit' \| 'reset'` | `'button'` | no       | —            | Native roots only. Deliberately not HTML's `submit` default (see Open questions).                                                                                                                                                 |
| elementType           | `string`                          | `'button'` | no       | —            | The tag the consumer renders as root. `button` and `input` are native; anything else gets `role="button"` and keyboard handling. The element adapter reads the real tag; the React adapter warns in development when they differ. |
| excludeFromTabOrder   | `boolean`                         | `false`    | no       | —            | `tabindex="-1"`: still focusable by pointer and script, skipped by Tab.                                                                                                                                                           |
| preventFocusOnPress   | `boolean`                         | `false`    | no       | —            | A pointer press leaves focus where it was, for buttons that act on something else that keeps focus (a toolbar over an editor).                                                                                                    |

### Events

| Event        | React prop     | When                                                                                 |
| ------------ | -------------- | ------------------------------------------------------------------------------------ |
| `pressstart` | `onPressStart` | A press begins: pointer down, Enter or Space down, or a virtual click.               |
| `pressend`   | `onPressEnd`   | A press ends, with or without activation (release, leave, cancel, key up elsewhere). |
| `press`      | `onPress`      | Activation: released over the root, key released on the root, or a virtual click.    |

Order on activation: `pressstart`, `pressend`, `press`. A cancelled press
fires `pressstart`, then `pressend` and no `press`. There is no
`presschange` event, because `isPressed` is public state (read it with a
selector).

Every event carries a press event:

```ts
type PressEvent = {
  type: 'pressstart' | 'pressend' | 'press';
  pointerType: 'mouse' | 'pen' | 'touch' | 'keyboard' | 'virtual';
  target: Element; // the root part
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  key?: string; // keyboard presses only
  x: number; // relative to the root; its centre when there are no coordinates
  y: number;
};
```

The element adapter dispatches them as bubbling, non-composed `CustomEvent`s
on the host, with the press event in `detail`.

## Public state

What `expose()` returns. Selectors (`useComponentState`) read it, so it is
public API: adding a field is a feature, changing one is a breaking change.

| Field          | Type      | Meaning                                                                           |
| -------------- | --------- | --------------------------------------------------------------------------------- |
| isPressed      | `boolean` | A pointer or key is down on the root, and releasing it now would activate.        |
| isHovered      | `boolean` | A mouse or pen is over the root. Never set by touch, never while disabled.        |
| isFocused      | `boolean` | The root has focus.                                                               |
| isFocusVisible | `boolean` | The root has focus and the last interaction was keyboard or virtual, not pointer. |
| isDisabled     | `boolean` | `disabled` is true.                                                               |

## Keyboard

| Key   | Where | Behavior                                                                                                                                                                      |
| ----- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Space | root  | Keydown starts the press (`pressstart`). Keyup on the root ends it and activates (`pressend`, `press`). Default is prevented, so the page doesn't scroll.                     |
| Enter | root  | Same timing as Space: starts on keydown, activates on keyup.                                                                                                                  |
| —     | —     | Key repeats never start a press. A keyup that lands elsewhere because focus moved during the press ends it without activation. The keyup is tracked on the document for this. |
| Tab   | —     | Normal focus order. The root is in the tab order unless it is natively disabled, disabled without `focusableWhenDisabled`, or `excludeFromTabOrder`.                          |

Exactly one `press` fires per activation. On `type="button"` and non-native
roots Sous prevents the native activation click. On `type="submit"` and
`type="reset"` it leaves keyboard events alone, so implicit form submission
stays native, and it ignores the native click that follows. Space on a
submit button needs a real-browser test: React Aria's code suggests a double
fire there.

Enter activates on keyup, like React Aria, which Cube UI Kit uses today. If
activation happened on keydown and opened a dialog, the keyup would land on
whatever the dialog focused.

## ARIA and state attributes per state

State attributes are presence attributes (`data-pressed=""`) and are removed
when false. ARIA values are strings. Sous never writes `aria-disabled="false"`
(screen readers announce "not disabled"); it removes the attribute.

| State                                 | Part | Attributes                                                                                      |
| ------------------------------------- | ---- | ----------------------------------------------------------------------------------------------- |
| idle, native                          | root | `type="button"` (or the `type` prop), `tabindex="0"`, `data-scope="button"`, `data-part="root"` |
| idle, non-native                      | root | `role="button"`, `tabindex="0"`, `data-scope`, `data-part`                                      |
| hovered                               | root | + `data-hovered`                                                                                |
| pressed                               | root | + `data-pressed`                                                                                |
| focused                               | root | + `data-focused`; + `data-focus-visible` after keyboard or virtual interaction                  |
| `excludeFromTabOrder`                 | root | `tabindex="-1"`                                                                                 |
| disabled, native                      | root | `disabled`, `data-disabled`; no hover or press attributes                                       |
| disabled, non-native                  | root | `aria-disabled="true"`, no `tabindex`, `data-disabled`                                          |
| disabled with `focusableWhenDisabled` | root | `aria-disabled="true"`, `tabindex` kept, `data-disabled`; no `disabled` attribute               |

`tabindex` is set on native buttons too: Safari and Firefox on macOS focus a
button on click only when it has one. React Aria does the same.

## Focus

- Button never moves focus on activation. The action decides, as the APG
  pattern describes: opening a dialog moves focus into it, and a plain action
  leaves it on the button.
- A pointer press focuses the root in every browser, without scrolling,
  unless `preventFocusOnPress` is set. In that case focus stays where it was.
- `isFocusVisible` comes from the shared modality tracker: keyboard and
  virtual interaction make focus visible, pointer interaction does not.
- Disabling a focused button with native `disabled` drops focus to the body.
  For transient disabling, such as while an action is running, use
  `focusableWhenDisabled` so focus stays.

## Pointer and touch

- Only the primary button starts a press. After pointer down, Sous tracks
  pointer up and cancel on the document.
- Leaving the root while pressed ends the press without activation
  (`pressend`) and clears `isPressed`. Coming back starts it again
  (`pressstart`). Releasing outside the root ends it without activation.
- Releasing over the root activates on the `click` that follows, so
  activation lines up with native click semantics. If no click arrives within
  80 ms (iOS and Android drop it after a long press), Sous calls `click()`
  itself.
- Cancelled by `pointercancel` (including a browser scroll that takes over a
  touch), `dragstart` (Safari sends no `pointercancel`), or the button
  becoming disabled. A cancel fires `pressend` without `press`.
- A touch press suppresses text selection while it lasts: on the root, or on
  the document in iOS WebKit, restored 300 ms after the press. It is restored
  if the button unmounts mid-press.
- Pressable roots need `touch-action: pan-x pan-y pinch-zoom`: it removes the
  double-tap delay and lets a scroll cancel the press. `manipulation` breaks
  Safari's `pointercancel` on scroll. How Sous applies it is an open
  question.
- Hover starts on pointer enter for mouse and pen only. A mouse enter within
  500 ms of a touch pointer up is ignored, because iOS emulates one. Hover
  never starts while disabled, and it ends when the button becomes disabled
  or leaves the DOM.
- Virtual clicks press the button too. Screen readers (VoiceOver, TalkBack,
  NVDA and JAWS) click without a real pointer sequence. Sous detects them the
  way React Aria does (`references/react-spectrum/packages/react-aria/src/utils/isVirtualEvent.ts`)
  and fires `pressstart`, `pressend` and `press` on the click with
  `pointerType: 'virtual'`. `element.click()` counts as virtual.
- Nested pressables: only the innermost one handles a press. Sous marks the
  event as handled instead of stopping propagation (decision 4).
- While disabled, no press events fire and the click's default is prevented,
  which also blocks form submission in `focusableWhenDisabled` mode.
- Context menu and Escape have no special handling, matching React Aria.

## Expected spoken output

Phrases follow `@guidepup/virtual-screen-reader`'s format
(`references/virtual-screen-reader/test/int/disabled.int.test.ts`).

| Markup and state                               | Spoken phrase                         |
| ---------------------------------------------- | ------------------------------------- |
| native root, text "Save"                       | `button, Save`                        |
| non-native root (`role="button"`), text "Save" | `button, Save`                        |
| native, disabled                               | `button, Save, disabled`              |
| non-native, disabled                           | `button, Save, disabled`              |
| `focusableWhenDisabled`, disabled              | `button, Save, disabled`              |
| re-enabled after being disabled                | `button, Save` (never "not disabled") |

## Adapter surface

```tsx
// React
const button = useButton({
  onPress: save,
  disabled: isSaving,
  focusableWhenDisabled: true,
});
const isPressed = useButtonState(button, (s) => s.isPressed); // only if the render needs it
return <button {...button.parts.root}>Save</button>;
```

```html
<!-- Custom element -->
<sous-button focusable-when-disabled>
  <button data-part="root">Save</button>
</sous-button>
<script>
  document.querySelector('sous-button').addEventListener('press', save);
</script>
```

Element attributes mirror the props in kebab case (`focusable-when-disabled`,
`exclude-from-tab-order`, `prevent-focus-on-press`); properties use camel
case. There is no `elementType` attribute: the element reads the root's tag.

## Deviations from the WAI-ARIA pattern

None from the pattern. APG's example code differs in two places, and the
pattern text doesn't require either:

- The example activates Enter on keydown; Sous activates on keyup (see
  Keyboard).
- The example toggles `aria-pressed` on the same button; Sous leaves toggle
  buttons to a separate component.

## Open questions

1. **Links.** Should Button render links (`<a href>`)? Recommendation: no.
   `elementType: 'a'` gets a development warning, and a later Link
   definition shares the press behavior. APG says buttons and links do
   different jobs, and Spectrum Web Components deprecated `href` on its
   button for that reason. Cube UI Kit's `to` prop would map to Link.
2. **Toggle buttons.** Recommendation: a separate ToggleButton (bindable
   `selected` → `aria-pressed`, with a label that never changes), added to
   the first scope right after Button. Cube UI Kit's `isSelected` needs it.
3. **Pending state.** Recommendation: no `pending` prop in v1. `disabled`
   with `focusableWhenDisabled` covers it without dropping focus, which
   Cube UI Kit's `isLoading` does today because it uses native `disabled`.
   Spinner and label stay with the design system.
4. **`touch-action`.** Sous ships no styles, but press behavior depends on
   this one property. Recommendation: `dom/` adopts one behavioral rule for
   pressable parts, `touch-action: pan-x pan-y pinch-zoom`, as React Aria
   does. The alternative is documenting it and accepting double-tap delay
   and missed scroll cancels when a consumer forgets.
5. **Default `type="button"`.** Confirm the deliberate break from HTML's
   `submit` default. React Aria, Cube UI Kit and Spectrum Web Components all
   make it.
