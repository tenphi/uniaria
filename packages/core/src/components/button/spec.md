# Button spec

Status: approved by @tenphi on 2026-10-14

## Summary

A button runs an action or navigates when pressed. A native `<button>` sits
underneath by default, and a native `<a href>` in link mode. UniAria adds one `press` event that behaves the same for mouse, pen,
touch, keyboard and screen-reader clicks. It also adds hover, pressed and
focus-visible states as data attributes, and an optional disabled mode that
stays focusable. Button is the phase 1 gate: it must pass the same conformance
suite in both adapters.

- **WAI-ARIA pattern:** [Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  (`references/aria-practices/content/patterns/button/button-pattern.html`)
- **Builds on:** `press`, `hover` and `focus-visible` from `dom/`.
  Text-selection suppression during touch presses and nested pressables
  arrive later in phase 2, together with their conformance scenarios.
- **Owner:** none
- **Tooltip:** takes a Tooltip through its `tooltip` link (Tooltip spec, Resolved
  questions 2): the tooltip instance in React (`tooltip: hint.instance`),
  and on elements the `<uni-tooltip>` it sits in directly or a `tooltip`
  attribute naming one's id. The root is where hover, focus and
  presses count and what the tooltip is placed against, and it carries
  the tooltip's id in `aria-describedby` (`aria-labelledby` with
  `relation: 'label'`) while the tooltip is enabled. Without a tooltip,
  the consumer's own `aria-describedby` on the root stays.
- **Custom element:** yes. `<uni-button>` hosts one native
  `<button data-uni="button">` (or `<a data-uni="button" href>`) written by
  the consumer. The inner element provides native semantics, form submission
  and link navigation, so the element needs no
  `ElementInternals` and no stand-in submit button (the workaround Spectrum
  Web Components uses because its host is the button). The host has no role
  and never takes focus.

Not part of Button: toggle buttons (ToggleButton, next in the first scope),
menu-button attributes (the composing component writes them) and a pending
state. See Resolved questions.

## Anatomy

| Part | Element                                                                  | Attributes UniAria owns                                                                                                                                                                    | Notes                                                                                                                                                                                                                                                                                        |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| root | `button` by default; `a` in link mode; any element through `elementType` | `type`, `href` (link mode), `disabled`, `aria-disabled`, `role` and `tabindex`, `data-uni="button"`, `data-pressed`, `data-hovered`, `data-focused`, `data-focus-visible`, `data-disabled` | The consumer owns content, `id`, classes, labelling (`aria-label`, `aria-labelledby`, `aria-describedby`), popup attributes (`aria-haspopup`, `aria-expanded`, `aria-controls`) form attributes (`name`, `value`, `form`, `formaction`, …) and link attributes (`target`, `rel`, `download`) |

No element-owned parts.

## Props

| Prop                      | Type                              | Default    | Bindable | Change event | Notes                                                                                                                                                                                                                                                                          |
| ------------------------- | --------------------------------- | ---------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| isDisabled                | `boolean`                         | `false`    | no       | —            | Native `disabled` on `button` and `input`; `aria-disabled="true"` and no `tabindex` elsewhere.                                                                                                                                                                                 |
| isFocusableWhenDisabled   | `boolean`                         | `false`    | no       | —            | When disabled, use `aria-disabled="true"` instead of `disabled` and keep the root focusable and in the tab order. Presses, clicks and form submission are still blocked.                                                                                                       |
| href                      | `string \| undefined`             | —          | no       | —            | Link mode: the root is a native `<a href>` with link semantics, and the same press events, states and data attributes. Removed while disabled.                                                                                                                                 |
| type                      | `'button' \| 'submit' \| 'reset'` | `'button'` | no       | —            | Native button roots only; ignored in link mode. Deliberately not HTML's `submit` default (see Resolved questions).                                                                                                                                                             |
| elementType               | `string`                          | `'button'` | no       | —            | The tag the consumer renders as root. `button` and `input` are native; anything else gets `role="button"` and keyboard handling. Ignored in link mode, where the root is `a`. The element adapter reads the real tag; the React adapter warns in development when they differ. |
| shouldExcludeFromTabOrder | `boolean`                         | `false`    | no       | —            | `tabindex="-1"`: still focusable by pointer and script, skipped by Tab.                                                                                                                                                                                                        |
| shouldPreventFocusOnPress | `boolean`                         | `false`    | no       | —            | A pointer press leaves focus where it was, for buttons that act on something else that keeps focus (a toolbar over an editor).                                                                                                                                                 |

### Events

| Event         | React prop      | When                                                                                 |
| ------------- | --------------- | ------------------------------------------------------------------------------------ |
| `pressstart`  | `onPressStart`  | A press begins: pointer down, Enter or Space down, or a virtual click.               |
| `pressend`    | `onPressEnd`    | A press ends, with or without activation (release, leave, cancel, key up elsewhere). |
| `press`       | `onPress`       | Activation: released over the root, key released on the root, or a virtual click.    |
| `focuschange` | `onFocusChange` | The root gained (`true`) or lost (`false`) focus.                                    |

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
| isDisabled     | `boolean` | The `isDisabled` prop is true.                                                    |

## Keyboard

| Key   | Where           | Behavior                                                                                                                                                                      |
| ----- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Space | root            | Keydown starts the press (`pressstart`). Keyup on the root ends it and activates (`pressend`, `press`). Default is prevented, so the page doesn't scroll.                     |
| Enter | root            | Same timing as Space: starts on keydown, activates on keyup.                                                                                                                  |
| —     | —               | Key repeats never start a press. A keyup that lands elsewhere because focus moved during the press ends it without activation. The keyup is tracked on the document for this. |
| Enter | root, link mode | The browser navigates on keydown, natively; UniAria doesn't prevent it. The press still starts on keydown and fires `press` on keyup.                                         |
| Space | root, link mode | Nothing, as on any link: the page scrolls.                                                                                                                                    |
| Tab   | —               | Normal focus order. The root is in the tab order unless it is natively disabled, disabled without `isFocusableWhenDisabled`, or `shouldExcludeFromTabOrder`.                  |

Exactly one `press` fires per activation. On `type="button"` and non-native
roots UniAria prevents the native activation click. On `type="submit"` and
`type="reset"` it leaves keyboard events alone, so implicit form submission
stays native, and it ignores the native click that follows. Space on a
submit button needs a real-browser test: React Aria's code suggests a double
fire there.

Enter activates on keyup, like React Aria, which Cube UI Kit uses today. If
activation happened on keydown and opened a dialog, the keyup would land on
whatever the dialog focused.

## ARIA and state attributes per state

State attributes are presence attributes (`data-pressed=""`) and are removed
when false. ARIA values are strings. UniAria never writes `aria-disabled="false"`
(screen readers announce "not disabled"); it removes the attribute.

| State                                   | Part | Attributes                                                                                                                                                 |
| --------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| idle, native                            | root | `type="button"` (or the `type` prop), `tabindex="0"`, `data-uni="button"`                                                                                  |
| idle, non-native                        | root | `role="button"`, `tabindex="0"`, `data-uni="button"`                                                                                                       |
| hovered                                 | root | + `data-hovered`                                                                                                                                           |
| pressed                                 | root | + `data-pressed`                                                                                                                                           |
| focused                                 | root | + `data-focused`; + `data-focus-visible` after keyboard or virtual interaction                                                                             |
| `shouldExcludeFromTabOrder`             | root | `tabindex="-1"`                                                                                                                                            |
| disabled, native                        | root | `disabled`, `data-disabled`; no hover or press attributes                                                                                                  |
| disabled, non-native                    | root | `aria-disabled="true"`, no `tabindex`, `data-disabled`                                                                                                     |
| disabled with `isFocusableWhenDisabled` | root | `aria-disabled="true"`, `tabindex` kept, `data-disabled`; no `disabled` attribute                                                                          |
| idle, link mode                         | root | `href`, `tabindex="0"`, `data-uni="button"`; no `role` (a link is already a link)                                                                          |
| disabled, link mode                     | root | `href` removed, `role="link"` (an `a` without `href` has no role), `aria-disabled="true"`, `data-disabled`; `tabindex` only with `isFocusableWhenDisabled` |

`tabindex` is set on native buttons too: Safari and Firefox on macOS focus a
button on click only when it has one. React Aria does the same.

## Focus

- Button never moves focus on activation. The action decides, as the APG
  pattern describes: opening a dialog moves focus into it, and a plain action
  leaves it on the button.
- A pointer press focuses the root in every browser, without scrolling,
  unless `shouldPreventFocusOnPress` is set. In that case focus stays where it was.
- `isFocusVisible` comes from the shared modality tracker: keyboard and
  virtual interaction make focus visible, pointer interaction does not.
- Disabling a focused button with native `disabled` drops focus to the body.
  For transient disabling, such as while an action is running, use
  `isFocusableWhenDisabled` so focus stays.

## Pointer and touch

- Only the primary button starts a press. After pointer down, UniAria tracks
  pointer up and cancel on the document.
- Leaving the root while pressed ends the press without activation
  (`pressend`) and clears `isPressed`. Coming back starts it again
  (`pressstart`). Releasing outside the root ends it without activation.
- Releasing over the root activates on the `click` that follows, so
  activation lines up with native click semantics. If no click arrives within
  80 ms (iOS and Android drop it after a long press), UniAria calls `click()`
  itself.
- Cancelled by `pointercancel` (including a browser scroll that takes over a
  touch), `dragstart` (Safari sends no `pointercancel`), or the button
  becoming disabled. A cancel fires `pressend` without `press`.
- A touch press suppresses text selection while it lasts: on the root, or on
  the document in iOS WebKit, restored 300 ms after the press. It is restored
  if the button unmounts mid-press.
- Pressable roots get `touch-action: pan-x pan-y pinch-zoom` from the one
  behavioral rule `dom/` adopts (see Resolved questions). It removes the
  double-tap delay and lets a scroll cancel the press; `manipulation` would
  break Safari's `pointercancel` on scroll.
- Hover starts on pointer enter for mouse and pen only. A mouse enter within
  500 ms of a touch pointer up is ignored, because iOS emulates one. Hover
  never starts while disabled, and it ends when the button becomes disabled
  or leaves the DOM.
- Virtual clicks press the button too. Screen readers (VoiceOver, TalkBack,
  NVDA and JAWS) click without a real pointer sequence. UniAria detects them the
  way React Aria does (`references/react-spectrum/packages/react-aria/src/utils/isVirtualEvent.ts`)
  and fires `pressstart`, `pressend` and `press` on the click with
  `pointerType: 'virtual'`. `element.click()` counts as virtual.
- Nested pressables: only the innermost one handles a press. UniAria never
  stops propagation (decision 4): a pressable ignores events whose target
  sits inside a nearer pressable, so the order listeners run in doesn't
  matter.
- While disabled, no press events fire and the click's default is prevented,
  which also blocks form submission in `isFocusableWhenDisabled` mode.
- Context menu and Escape have no special handling, matching React Aria.
- Link mode never prevents the link's default action. Navigation stays native,
  including modifier clicks, middle click and the context menu's "open in new
  tab". `press` carries the modifier keys, so a handler can tell a new-tab
  click apart. Client-side routing is the consumer's: render the router's link
  component as the root and spread the part props onto it.

## Expected spoken output

Phrases follow `@guidepup/virtual-screen-reader`'s format
(`references/virtual-screen-reader/test/int/disabled.int.test.ts`).

| Markup and state                               | Spoken phrase                         |
| ---------------------------------------------- | ------------------------------------- |
| native root, text "Save"                       | `button, Save`                        |
| non-native root (`role="button"`), text "Save" | `button, Save`                        |
| native, disabled                               | `button, Save, disabled`              |
| non-native, disabled                           | `button, Save, disabled`              |
| `isFocusableWhenDisabled`, disabled            | `button, Save, disabled`              |
| re-enabled after being disabled                | `button, Save` (never "not disabled") |
| link mode, text "Docs"                         | `link, Docs`                          |
| link mode, disabled                            | `link, Docs, disabled`                |

## Adapter surface

```tsx
// React
const save = useComponent(button, {
  onPress: submit,
  isDisabled: isSaving,
  isFocusableWhenDisabled: true,
});
const isPressed = useComponentState(save, (s) => s.isPressed); // only if the render needs it
return <button {...save.parts.root}>Save</button>;

// Link mode: same component, same look, link semantics
const docs = useComponent(button, { href: '/docs' });
return <a {...docs.parts.root}>Docs</a>; // or the router's link component
```

```html
<!-- Custom element -->
<uni-button focusable-when-disabled>
  <button data-uni="button">Save</button>
</uni-button>
<uni-button>
  <a data-uni="button" href="/docs">Docs</a>
</uni-button>
<script>
  document.querySelector('uni-button').addEventListener('press', save);
</script>
```

Element attributes are the props in kebab case without their `is` or
`should` prefix (`disabled`, `focusable-when-disabled`,
`exclude-from-tab-order`, `prevent-focus-on-press`); properties use the prop
names (`isDisabled`). There is no `elementType` attribute: the element reads the root's tag.
In link mode the element adopts the root's `href` on upgrade, so the link
works before JavaScript runs, and owns it from then on; set the `href`
property to change it.

## Deviations from the WAI-ARIA pattern

None from the pattern. APG's example code differs in two places, and the
pattern text doesn't require either:

- The example activates Enter on keydown; UniAria activates on keyup (see
  Keyboard).
- The example toggles `aria-pressed` on the same button; UniAria leaves toggle
  buttons to a separate component.

## Resolved questions

Decided by @tenphi on 2026-10-14.

1. **Links: Button covers navigation too.** In products and menus, actions
   and navigation often look identical, so one component carries both. With
   `href` the root is a native `<a href>`: link role, native navigation, and
   the same press events, states and data attributes as a button. Semantics
   follow the job, so screen-reader link and button lists stay correct; looks
   stay the consumer's. There is no separate Link component, and future menu
   items follow the same rule. Cube UI Kit's `to` maps to `href`.
2. **Toggle buttons** are a separate ToggleButton (bindable `isSelected` →
   `aria-pressed`, with a label that never changes), next in the first scope.
   Cube UI Kit's `isSelected` maps to it.
3. **No pending state in v1.** `isDisabled` with `isFocusableWhenDisabled` covers
   it without dropping focus. Spinner and label stay with the design system.
4. **`touch-action`.** `dom/` adopts one behavioral rule for pressable parts,
   `touch-action: pan-x pan-y pinch-zoom`, as React Aria does. It is
   behavior, not styling: UniAria ships CSS only where a behavior can't work
   without it (root AGENTS.md).
5. **`type` defaults to `button`**, deliberately unlike HTML's `submit`, as in
   React Aria, Cube UI Kit and Spectrum Web Components.
6. **Boolean props read as predicates** (@tenphi, 2026-10-14): `is…` for
   states, `should…` for behavior, as in Cube UI Kit. The props were renamed
   from `disabled`, `focusableWhenDisabled`, `excludeFromTabOrder` and
   `preventFocusOnPress`; element attributes keep the HTML-style names.
7. **`focusChange`**, from the gate 3 API review, approved by @tenphi on 2026-10-16: Button
   fires it as every other focusable UniAria component does, and as React
   Aria's `onFocusChange` does.

## Open questions

None.
